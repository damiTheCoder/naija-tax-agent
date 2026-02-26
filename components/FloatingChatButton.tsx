"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { accountingEngine, parseTransactionFromChat } from "@/lib/accounting/transactionBridge";
import { RawTransaction, TransactionType } from "@/lib/accounting/types";
import { taxEngine, detectTaxType } from "@/lib/tax/taxEngine";
import { playGoogleButtonClickSound } from "@/lib/sounds";
import {
    formatPlanSourceLabel,
    requestUnifiedAgentPlan,
    runUnifiedAgentMessage,
    type AgentPlanSource,
    type UnifiedCustomActionExecutor
} from "@/lib/agent/unifiedClient";
import type { UnifiedAgentAction } from "@/lib/agent/unifiedTypes";
import {
    addChatHistoryEntry,
    CHAT_HISTORY_SELECTED_EVENT,
    consumeSelectedChatHistory,
} from "@/lib/personalChatHistory";

// ============================================================================
// CLAWDBOT INTEGRATION
// ============================================================================
// Set to true to route all chat messages through Clawdbot AI (requires clawdbot daemon)
// Set to false to use Gemini for AI validation layer only
const USE_CLAWDBOT = process.env.NEXT_PUBLIC_USE_CLAWDBOT === "true";

interface ClawdbotResponse {
    reply: string;
    actions?: Array<{
        tool: string;
        result: unknown;
    }>;
    fallback?: boolean;
    error?: string;
}

interface AgentResponse {
    answer?: string;
    finalAnswer?: string;
    error?: string;
}

interface ClarificationData {
    transaction: {
        amount: number;
        date: string;
        description: string;
        bankName: string;
    };
}

type ProjectionActionUpdate = {
    key: string;
    value: number;
    unit?: string;
};

const PROJECTIONS_CONTEXT_STORAGE_KEY = "ql::projections-context";
const PROJECTIONS_UPDATE_EVENT = "ql:projections-assumptions-update";
const PROJECTIONS_RESET_EVENT = "ql:projections-assumptions-reset";
const AGENT_CHAT_MODE_STORAGE_KEY = "ql::agent-chat-mode";

function readProjectionsContextSnapshot(): string {
    if (typeof window === "undefined") return "";
    try {
        const raw = window.localStorage.getItem(PROJECTIONS_CONTEXT_STORAGE_KEY);
        return typeof raw === "string" ? raw : "";
    } catch {
        return "";
    }
}

/**
 * Send a message to Clawdbot AI and get a response
 */
async function sendToClawdbot(
    message: string,
    moduleId: string,
    userId?: string
): Promise<ClawdbotResponse> {
    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message,
                userId: userId || "default_user",
                context: {
                    module: moduleId,
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("[Clawdbot] Error:", error);
        return {
            reply: "I'm having trouble connecting to my AI brain. Please check that Clawdbot is running and try again.",
            fallback: true,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

async function humanizeDraftReply(
    message: string,
    moduleId: string,
    draftReply: string
): Promise<string> {
    if (!draftReply.trim()) return draftReply;

    try {
        const response = await fetch("/api/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                module: moduleId,
                draftReply,
                includeSources: false,
                messages: [{ role: "user", content: message }],
            }),
        });

        if (!response.ok) return draftReply;
        const data: AgentResponse = await response.json();

        if (typeof data.answer === "string" && data.answer.trim()) {
            return data.answer;
        }

        if (typeof data.finalAnswer === "string" && data.finalAnswer.trim()) {
            return data.finalAnswer;
        }

        return draftReply;
    } catch {
        return draftReply;
    }
}

type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
};

type AgentChatMode = "response-only" | "full-agentic";

type ModuleConfig = {
    id: string;
    name: string;
    title: string;
    placeholder: string;
    greeting: string;
    examples: string[];
    color: string;
};

// Module configurations
const moduleConfigs: Record<string, ModuleConfig> = {
    accounting: {
        id: "accounting",
        name: "Accounting",
        title: "Accounting Assistant",
        placeholder: "Record a transaction...",
        greeting: "Hi! Enter your transactions in natural language and I'll help you record them.",
        examples: [
            '"Sold goods for ₦50,000"',
            '"Paid rent ₦150,000"',
            '"Bought office supplies ₦5,000"'
        ],
        color: "purple"
    },
    projections: {
        id: "projections",
        name: "Projections",
        title: "Projections Assistant",
        placeholder: "Ask about projections or update assumptions...",
        greeting: "Hi! I can analyze your projection charts and update assumptions directly from this chat.",
        examples: [
            '"How do I calculate revenue growth rate?"',
            '"Set revenue growth assumption to 12%"',
            '"Reset assumptions to auto"'
        ],
        color: "blue"
    },
    reconciliation: {
        id: "reconciliation",
        name: "Reconciliation",
        title: "Bank Reconciliation Assistant",
        placeholder: "Ask about reconciliation...",
        greeting: "Hi! I can help you with bank reconciliation. Upload your files above, or ask me questions about the reconciliation process.",
        examples: [
            '"What are common discrepancy types?"',
            '"How do I match transactions?"',
            '"Explain timing differences"'
        ],
        color: "blue"
    },
    "cashflow-intelligence": {
        id: "cashflow",
        name: "Cashflow",
        title: "Cashflow Assistant",
        placeholder: "Ask about cash flow...",
        greeting: "Hi! I can help you understand your cash flow metrics and runway.",
        examples: [
            '"What\'s my current runway?"',
            '"How much did I spend this week?"',
            '"What\'s my burn rate?"'
        ],
        color: "emerald"
    },
    "tax-tools": {
        id: "tax",
        name: "Tax",
        title: "Tax Assistant",
        placeholder: "Calculate or ask about tax...",
        greeting: "Hi! I can help you with VAT, WHT, CGT calculations and Nigerian tax compliance.",
        examples: [
            '"Calculate VAT on ₦100,000"',
            '"What\'s the WHT rate for services?"',
            '"Is this expense tax deductible?"'
        ],
        color: "blue"
    },
    tax: {
        id: "tax",
        name: "Tax",
        title: "Tax Assistant",
        placeholder: "Ask about taxes...",
        greeting: "Hi! I can help you with tax calculations and FIRS compliance questions.",
        examples: [
            '"What taxes apply to my business?"',
            '"Calculate my tax liability"',
            '"Explain CIT for SMEs"'
        ],
        color: "blue"
    },
    wallet: {
        id: "wallet",
        name: "Wallet",
        title: "Wallet Assistant",
        placeholder: "Ask about your wallet...",
        greeting: "Hi! I can help you with your fintech wallet, savings, and investments.",
        examples: [
            '"What\'s my wallet balance?"',
            '"How much have I saved?"',
            '"Show my recent transfers"'
        ],
        color: "indigo"
    },
    personal: {
        id: "personal",
        name: "Personal",
        title: "Personal AI Assistant",
        placeholder: "Ask about your personal finances...",
        greeting: "Hi! I can chat naturally and also execute actions across your personal finance workflows.",
        examples: [
            '"Post salary income of ₦350,000"',
            '"Send ₦25,000 to John"',
            '"Analyze my cashflow and runway"'
        ],
        color: "blue"
    },
    dashboard: {
        id: "dashboard",
        name: "Dashboard",
        title: "Financial Assistant",
        placeholder: "Ask about your finances...",
        greeting: "Hi! I can give you an overview of your business finances.",
        examples: [
            '"How is my business doing?"',
            '"Summary of this month"',
            '"What\'s my profit margin?"'
        ],
        color: "gray"
    },
    supersheet: {
        id: "supersheet",
        name: "SuperSheet",
        title: "Spreadsheet Assistant",
        placeholder: "Ask about your spreadsheet...",
        greeting: "Hi! I can help you with formulas, data analysis, and spreadsheet operations.",
        examples: [
            '"How do I sum a column?"',
            '"Create an IF formula"',
            '"Analyze my data"'
        ],
        color: "green"
    },
    default: {
        id: "general",
        name: "Quantum Ledger",
        title: "Quantum Ledger Assistant",
        placeholder: "Ask Quantum Ledger...",
        greeting: "Hi! I'm your AI financial assistant. How can I help you today?",
        examples: [
            '"Record a transaction"',
            '"Check my cash flow"',
            '"Calculate my taxes"'
        ],
        color: "blue"
    }
};

function getModuleFromPath(pathname: string): ModuleConfig {
    // Remove leading slash and get first segment
    const segments = pathname.split('/').filter(Boolean);
    const firstSegment = segments[0] || '';
    const secondSegment = segments[1] || '';

    // Check for reconciliation path specifically
    if (firstSegment === 'accounting' && secondSegment === 'reconciliation') {
        return moduleConfigs.reconciliation;
    }
    if (firstSegment === 'accounting' && secondSegment === 'projections') {
        return moduleConfigs.projections;
    }

    // Check for exact match first
    if (moduleConfigs[firstSegment]) {
        return moduleConfigs[firstSegment];
    }

    // Check for partial matches
    if (firstSegment.startsWith('tax')) {
        return moduleConfigs['tax-tools'];
    }
    if (firstSegment.includes('cash') || firstSegment.includes('flow')) {
        return moduleConfigs['cashflow-intelligence'];
    }

    return moduleConfigs.default;
}

function createIntroMessage(module: ModuleConfig): ChatMessage {
    return {
        id: "intro",
        role: "assistant",
        content: `${module.greeting}\n\nExamples:\n• ${module.examples.join('\n• ')}`,
        timestamp: Date.now(),
    };
}

function resolvePreferredAgentRoute(message: string, currentPath: string): string | null {
    const lower = message.toLowerCase();
    const inAccounting = currentPath.startsWith("/accounting");
    const inTax = currentPath.startsWith("/tax") || currentPath.startsWith("/tax-tools");
    const accountingIntent = /\b(accounting|journal|ledger|trial balance|income statement|balance sheet|cash flow|invoice|receipt|payroll|reconciliation|transaction)\b/.test(lower);
    const taxIntent = /\b(tax|vat|wht|cit|paye|firs|filing|return)\b/.test(lower);

    if (inAccounting || accountingIntent) {
        if (/(reconcil|bank statement|match transactions?)/.test(lower)) return "/accounting/reconciliation";
        if (/(projection|forecast|model|scenario)/.test(lower)) return "/accounting/projections";
        if (/(fixed asset|assets register|asset register|asset schedule)/.test(lower)) return "/accounting/assets";
        if (/(depreciation|depreciate|accumulated depreciation)/.test(lower)) return "/accounting/depreciation";
        if (/(invoice|bill customer|quotation)/.test(lower)) return "/accounting/invoices";
        if (/(receipt|expense receipt|upload receipt)/.test(lower)) return "/accounting/receipts";
        if (/(payroll|employee salary|salary run|employee tax)/.test(lower)) return "/accounting/payroll";
        if (/(bank account|connect bank|bank link)/.test(lower)) return "/accounting/banks";
        if (/(report|financial statement|trial balance|p&l|profit|balance sheet|cash flow)/.test(lower)) return "/accounting/reports";
        if (/(workspace|ledger|journal entries|tax payables|cashbook)/.test(lower)) return "/accounting/workspace";
        if (/(post|record|create|journal|entry|transaction|sold|paid|received|buy|bought|expense|purchase)/.test(lower)) return "/accounting";
    }

    if (inTax || taxIntent) {
        if (/(calendar|deadline|reminder)/.test(lower)) return "/tax/calendar";
        if (/(payment|pay|receipt|outstanding)/.test(lower)) return "/tax/payments";
        if (/(file tax|submit|upload filing|download return|tax authority)/.test(lower)) return "/tax/file-taxes";
        if (/(return|filed|draft|ready)/.test(lower)) return "/tax/returns";
        if (/(adjustment|deduction|allowance|tax credit|loss carryforward)/.test(lower)) return "/tax/adjustments";
        if (/(setting|jurisdiction|rate|fiscal year|company info)/.test(lower)) return "/tax/settings";
        if (/(transaction|classif|bulk edit|vat eligible|withholding applicable)/.test(lower)) return "/tax/transactions";
        if (/(compute|computation|cit|vat|wht|paye|education tax|tax payable)/.test(lower)) return "/tax/computation";
        return "/tax/workspace";
    }

    return null;
}

export default function FloatingChatButton() {
    const pathname = usePathname();
    const router = useRouter();
    const [currentModule, setCurrentModule] = useState<ModuleConfig>(moduleConfigs.default);
    const [isExpanded, setIsExpanded] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isAgentPerforming, setIsAgentPerforming] = useState(false);
    const [planSource, setPlanSource] = useState<AgentPlanSource>("fallback");
    const [agentChatMode, setAgentChatMode] = useState<AgentChatMode>("response-only");
    const [clarificationData, setClarificationData] = useState<ClarificationData | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const stopAgentRef = useRef(false);

    // Detect module from pathname
    useEffect(() => {
        const activeModule = getModuleFromPath(pathname);
        setCurrentModule(activeModule);
        const introMessage = createIntroMessage(activeModule);
        const selected = consumeSelectedChatHistory({ pathname });

        if (selected && selected.module !== "personal") {
            const restoredMessages: ChatMessage[] = [introMessage];
            const baseTs = selected.timestamp || Date.now();
            restoredMessages.push({
                id: `hist-u-${selected.id}`,
                role: "user",
                content: selected.prompt,
                timestamp: baseTs,
            });
            if (selected.response) {
                restoredMessages.push({
                    id: `hist-a-${selected.id}`,
                    role: "assistant",
                    content: selected.response,
                    timestamp: baseTs + 1,
                });
            }

            setMessages(restoredMessages);
            setInputValue(selected.response ? "" : selected.prompt);
            setIsModalOpen(true);
            return;
        }

        // Reset messages with module-specific greeting when module changes
        setMessages([introMessage]);
    }, [pathname]);

    useEffect(() => {
        const handleHistorySelection = () => {
            const selected = consumeSelectedChatHistory({ pathname });
            if (!selected || selected.module === "personal") return;

            const activeModule = getModuleFromPath(pathname);
            setCurrentModule(activeModule);
            const introMessage = createIntroMessage(activeModule);
            const baseTs = selected.timestamp || Date.now();
            const restoredMessages: ChatMessage[] = [
                introMessage,
                {
                    id: `hist-u-${selected.id}`,
                    role: "user",
                    content: selected.prompt,
                    timestamp: baseTs,
                },
            ];

            if (selected.response) {
                restoredMessages.push({
                    id: `hist-a-${selected.id}`,
                    role: "assistant",
                    content: selected.response,
                    timestamp: baseTs + 1,
                });
            }

            setMessages(restoredMessages);
            setInputValue(selected.response ? "" : selected.prompt);
            setIsModalOpen(true);
        };

        window.addEventListener(CHAT_HISTORY_SELECTED_EVENT, handleHistorySelection as EventListener);
        return () => {
            window.removeEventListener(CHAT_HISTORY_SELECTED_EVENT, handleHistorySelection as EventListener);
        };
    }, [pathname]);

    // Listen for clarification requests
    useEffect(() => {
        const handleClarification = (e: CustomEvent) => {
            console.log("Clarification request received", e.detail);
            setClarificationData(e.detail as ClarificationData);
        };

        if (typeof window !== "undefined") {
            window.addEventListener("accounting-clarification-request", handleClarification as EventListener);
        }

        return () => {
            if (typeof window !== "undefined") {
                window.removeEventListener("accounting-clarification-request", handleClarification as EventListener);
            }
        };
    }, []);

    // Load engines on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            accountingEngine.load();
            taxEngine.load();
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const savedMode = window.localStorage.getItem(AGENT_CHAT_MODE_STORAGE_KEY);
        if (savedMode === "response-only" || savedMode === "full-agentic") {
            setAgentChatMode(savedMode);
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(AGENT_CHAT_MODE_STORAGE_KEY, agentChatMode);
    }, [agentChatMode]);

    // Animate the "Chat" text
    useEffect(() => {
        const interval = setInterval(() => {
            setIsExpanded(prev => !prev);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            const nextHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 24), 120);
            textareaRef.current.style.height = `${nextHeight}px`;
        }
    }, [inputValue]);

    // Scroll to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Focus input when modal opens and handle clarification message
    useEffect(() => {
        if (isModalOpen) {
            if (textareaRef.current) {
                setTimeout(() => textareaRef.current?.focus(), 100);
            }

            // Inject clarification message if available
            if (clarificationData) {
                const { transaction } = clarificationData;
                const clarificationMsg = `Pls clarify transaction\n\n**Details:**\nAmount: ₦${transaction.amount.toLocaleString()}\nDate: ${transaction.date}\nDesc: ${transaction.description}\nBank: ${transaction.bankName}\n\nI need more context to categorise this correctly. What was this for?`;

                // Add message only if it's not already the last message
                setMessages(prev => {
                    if (prev[prev.length - 1]?.content !== clarificationMsg) {
                        return [...prev, {
                            id: `clarify-${Date.now()}`,
                            role: "assistant",
                            content: clarificationMsg,
                            timestamp: Date.now()
                        }];
                    }
                    return prev;
                });

                // Clear the clarification flag so it doesn't trigger again for the same event
                setClarificationData(null);
            }
        }
    }, [isModalOpen, clarificationData]);

    const appendMessage = useCallback((role: ChatMessage["role"], content: string) => {
        setMessages(prev => [
            ...prev,
            {
                id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                role,
                content,
                timestamp: Date.now(),
            },
        ]);
    }, []);

    // Handle accounting module
    const handleAccountingMessage = useCallback(async (message: string) => {
        const parsedTx = parseTransactionFromChat(message);

        if (parsedTx && parsedTx.amount && parsedTx.amount > 0) {
            const typeMap: Record<string, TransactionType> = {
                'sale': 'income', 'receipt': 'income', 'purchase': 'expense',
                'expense': 'expense', 'payment': 'liability', 'transfer': 'asset',
                'asset': 'asset', 'equity': 'equity', 'loan': 'liability', 'other': 'expense',
            };

            const categoryToType: Record<string, TransactionType> = {
                'sales': 'income', 'service': 'income', 'receipt': 'income',
                'purchases': 'expense', 'rent': 'expense', 'salary': 'expense',
                'utilities': 'expense', 'transport': 'expense', 'expense': 'expense',
                'asset': 'asset', 'capital': 'equity', 'drawing': 'equity',
                'loan-received': 'liability', 'loan-repayment': 'liability',
                'supplier-payment': 'liability', 'payment': 'liability', 'transfer': 'asset',
            };

            const transactionType = categoryToType[parsedTx.category || ''] || typeMap[parsedTx.parsedType] || 'expense';

            const newTransaction: RawTransaction = {
                id: `chat-${Date.now()}`,
                date: new Date().toISOString().split("T")[0],
                description: parsedTx.description || message.substring(0, 150),
                category: parsedTx.category || "other",
                amount: parsedTx.amount,
                type: transactionType,
            };

            const results: string[] = [];

            try {
                const accountingResult = accountingEngine.processTransactionEnhanced(newTransaction);
                accountingEngine.generateStatements();

                const debitLine = accountingResult.journalEntry.lines.find(l => l.debit > 0);
                const creditLine = accountingResult.journalEntry.lines.find(l => l.credit > 0);
                const confidence = Math.round((accountingResult.analysis.debitAccount.confidence + accountingResult.analysis.creditAccount.confidence) / 2 * 100);

                results.push(`📚 **Accounting** (${confidence}% confidence): ${accountingResult.journalEntry.id}`);
                results.push(`   DR: ${debitLine?.accountName} ₦${debitLine?.debit.toLocaleString()}`);
                results.push(`   CR: ${creditLine?.accountName} ₦${creditLine?.credit.toLocaleString()}`);
            } catch {
                results.push("📚 **Accounting**: Could not post (check manually)");
            }

            try {
                const taxDetection = detectTaxType(parsedTx.description || message, parsedTx.amount, parsedTx.category);
                const taxResult = taxEngine.processTransaction({
                    date: new Date().toISOString().split("T")[0],
                    description: parsedTx.description || message.slice(0, 100),
                    amount: parsedTx.amount,
                    category: parsedTx.category || "chat-entry",
                    type: taxDetection.transactionType,
                    isResident: true,
                });
                results.push(`💰 **Tax**: ${taxResult.transaction.type.toUpperCase()} recorded for ₦${parsedTx.amount.toLocaleString()}`);
            } catch {
                results.push("💰 **Tax**: Could not compute (check manually)");
            }

            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("accounting-update", { detail: { source: "chat" } }));
                window.dispatchEvent(new StorageEvent("storage", { key: "insight::accounting-engine" }));
            }

            const confidenceText = parsedTx.confidence >= 0.9 ? "✓ High confidence" :
                parsedTx.confidence >= 0.7 ? "⚡ Medium confidence" : "⚠️ Low confidence";

            return `Transaction processed!\n\n${results.join("\n")}\n\n_${confidenceText} (${parsedTx.parsedType} detected)_`;
        }

        return "I couldn't detect a valid transaction. Please try again with an amount, e.g.:\n\n• \"Sold goods for ₦50,000\"\n• \"Paid rent ₦150,000\"";
    }, []);

    // Handle cashflow module
    const handleCashflowMessage = useCallback((message: string) => {
        const lowerMessage = message.toLowerCase();

        try {
            const statements = accountingEngine.generateStatements();
            const cashBalance = statements.assets || 0;
            const monthlyInflow = statements.revenue || 0;
            const monthlyOutflow = (statements.costOfSales || 0) + (statements.operatingExpenses || 0);
            const netCashflow = monthlyInflow - monthlyOutflow;
            const burnRate = monthlyOutflow / 30;
            const runway = monthlyOutflow > 0 ? Math.round(cashBalance / monthlyOutflow) : 999;

            if (lowerMessage.includes('runway')) {
                return `📊 **Cash Runway Analysis**\n\nCurrent Cash: ₦${cashBalance.toLocaleString()}\nMonthly Burn: ₦${monthlyOutflow.toLocaleString()}\n\n🗓️ **Runway: ${runway === 999 ? 'Sustainable (no burn)' : `${runway} months`}**`;
            }

            if (lowerMessage.includes('burn') || lowerMessage.includes('spend')) {
                return `🔥 **Burn Rate Analysis**\n\nDaily Burn: ₦${Math.round(burnRate).toLocaleString()}/day\nMonthly Outflow: ₦${monthlyOutflow.toLocaleString()}/month\n\n${netCashflow >= 0 ? '✅ Net positive cashflow' : '⚠️ Burning more than earning'}`;
            }

            if (lowerMessage.includes('balance') || lowerMessage.includes('cash')) {
                return `💰 **Cash Position**\n\nCash Balance: ₦${cashBalance.toLocaleString()}\nMonthly Inflow: +₦${monthlyInflow.toLocaleString()}\nMonthly Outflow: -₦${monthlyOutflow.toLocaleString()}\nNet Cashflow: ${netCashflow >= 0 ? '+' : ''}₦${netCashflow.toLocaleString()}`;
            }

            // Default: show summary
            return `📈 **Cashflow Summary**\n\nCash Balance: ₦${cashBalance.toLocaleString()}\nMonthly Inflow: +₦${monthlyInflow.toLocaleString()}\nMonthly Outflow: -₦${monthlyOutflow.toLocaleString()}\nRunway: ${runway === 999 ? 'Sustainable' : `${runway} months`}\n\nAsk me about runway, burn rate, or spending!`;
        } catch {
            return "I couldn't fetch your cashflow data. Please add some transactions first.";
        }
    }, []);

    // Handle tax module
    const handleTaxMessage = useCallback((message: string) => {
        const lowerMessage = message.toLowerCase();

        // Extract amount if present
        const amountMatch = message.match(/₦?\s*([\d,]+(?:\.\d{2})?)/);
        const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;

        if (lowerMessage.includes('vat') && amount > 0) {
            const vatRate = 0.075;
            const vatAmount = amount * vatRate;
            const total = amount + vatAmount;
            return `🧾 **VAT Calculation**\n\nBase Amount: ₦${amount.toLocaleString()}\nVAT (7.5%): ₦${vatAmount.toLocaleString()}\n**Total: ₦${total.toLocaleString()}**\n\n_VAT is charged at 7.5% on most goods and services in Nigeria._`;
        }

        if (lowerMessage.includes('wht') && amount > 0) {
            const whtRate = lowerMessage.includes('contract') ? 0.05 : 0.10;
            const whtAmount = amount * whtRate;
            const netAmount = amount - whtAmount;
            return `💼 **WHT Calculation**\n\nGross Amount: ₦${amount.toLocaleString()}\nWHT (${whtRate * 100}%): ₦${whtAmount.toLocaleString()}\n**Net Payment: ₦${netAmount.toLocaleString()}**\n\n_WHT rates: 5% contracts, 10% services/dividends_`;
        }

        if (lowerMessage.includes('cgt') && amount > 0) {
            const cgtRate = 0.10;
            const cgtAmount = amount * cgtRate;
            return `📈 **CGT Calculation**\n\nCapital Gain: ₦${amount.toLocaleString()}\nCGT (10%): ₦${cgtAmount.toLocaleString()}\n\n_CGT is 10% on chargeable gains from disposal of assets._`;
        }

        if (lowerMessage.includes('rate')) {
            return `📋 **Nigerian Tax Rates**\n\n• **VAT**: 7.5% on goods/services\n• **WHT**: 5-10% depending on payment type\n• **CGT**: 10% on capital gains\n• **CIT**: 0% (<₦25M), 20% (₦25M-100M), 30% (>₦100M)\n• **PIT**: 7-24% progressive rates\n\nTell me an amount and I'll calculate it!`;
        }

        return `I can help with Nigerian tax calculations!\n\nTry:\n• "Calculate VAT on ₦100,000"\n• "What\'s WHT on ₦50,000 for services"\n• "CGT on ₦1,000,000 gain"\n• "What are the tax rates?"`;
    }, []);

    // Handle wallet module
    const handleWalletMessage = useCallback((message: string) => {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('balance')) {
            return "💳 **Wallet Balance**\n\nMain Balance: ₦0.00\nSavings: ₦0.00\nInvestments: ₦0.00\n\n_Connect your wallet to see real balances._";
        }

        if (lowerMessage.includes('transfer') || lowerMessage.includes('send')) {
            return "📤 **Transfers**\n\nNo recent transfers found.\n\nTo make a transfer, go to the Wallet section and click 'Send Money'.";
        }

        return "💼 **Wallet Overview**\n\nYour fintech wallet is ready!\n\nAsk about:\n• Wallet balance\n• Recent transfers\n• Savings progress";
    }, []);

    // Handle reconciliation module
    const handleReconciliationMessage = useCallback(async (message: string) => {
        const lowerMessage = message.toLowerCase();

        // Help with discrepancy types
        if (lowerMessage.includes('discrepanc') || lowerMessage.includes('difference')) {
            return `📋 **Common Discrepancy Types**

• **Unmatched Bank**: Transaction in bank statement but not in ledger
• **Unmatched Ledger**: Entry in books but not in bank statement
• **Timing Difference**: Cheques/transfers not yet cleared
• **Duplicate**: Same transaction recorded twice
• **Amount Difference**: Matched transactions with different amounts

_Upload your files above to detect discrepancies automatically!_`;
        }

        // Help with matching
        if (lowerMessage.includes('match') || lowerMessage.includes('pair')) {
            return `🔗 **Transaction Matching**

The system automatically matches transactions by:
1. **Exact Amount** - Most important factor
2. **Date** - Same day or within 3 days
3. **Reference** - Cheque numbers, transfer IDs
4. **Description** - Similar keywords

**Match Confidence Scores:**
• 90%+ = Exact match
• 70-89% = Fuzzy match (review recommended)
• Below 70% = Manual review needed

_Upload your bank statement and ledger to start matching!_`;
        }

        // Help with timing differences
        if (lowerMessage.includes('timing') || lowerMessage.includes('outstanding') || lowerMessage.includes('cheque')) {
            return `⏱️ **Timing Differences**

Common timing differences include:

• **Outstanding Cheques**: Cheques written but not yet cleared
• **Deposits in Transit**: Deposits made but not yet credited
• **Bank Charges**: Deducted automatically but not yet recorded
• **Interest**: Credited by bank but not yet recorded

**Resolution:**
1. Add to reconciliation adjustments
2. Create journal entries if needed
3. Follow up on items older than 30 days`;
        }

        // Help with process
        if (lowerMessage.includes('how') || lowerMessage.includes('start') || lowerMessage.includes('process') || lowerMessage.includes('step')) {
            return `📝 **Bank Reconciliation Process**

**Step 1:** Upload Bank Statement (CSV)
**Step 2:** Upload Ledger/Journal (CSV)
**Step 3:** Click "Start Reconciliation"
**Step 4:** Review matched transactions
**Step 5:** Investigate discrepancies
**Step 6:** Click "AI Analysis" for insights

**File Format Required:**
• Bank: Date, Description, Debit, Credit
• Ledger: Date, Narration, Debit, Credit

_Ready to begin? Upload your files above!_`;
        }

        // AI-powered complex queries
        if (lowerMessage.includes('analyze') || lowerMessage.includes('insight') || lowerMessage.includes('explain') || lowerMessage.includes('why')) {
            try {
                const response = await fetch('/api/ai/bank-reconciliation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reconciliationResult: {
                            id: 'chat-query',
                            reconciliationDate: new Date().toISOString().split('T')[0],
                            bankStatementPeriod: { start: '', end: '' },
                            bankOpeningBalance: 0,
                            bankClosingBalance: 0,
                            ledgerOpeningBalance: 0,
                            ledgerClosingBalance: 0,
                            totalBankTransactions: 0,
                            totalLedgerTransactions: 0,
                            matchedPairs: [],
                            discrepancies: [],
                            unmatchedBankTransactions: [],
                            unmatchedLedgerTransactions: [],
                            summary: {
                                matchedCount: 0,
                                unmatchedBankCount: 0,
                                unmatchedLedgerCount: 0,
                                discrepancyCount: 0,
                                balanceDifference: 0,
                                reconciliationStatus: 'pending'
                            }
                        },
                        additionalContext: `User question: ${message}`
                    }),
                });

                if (response.ok) {
                    const result = await response.json();

                    if (result.conversationalResponse) {
                        return result.conversationalResponse;
                    }

                    return `🤖 **AI Insights**\n\n${result.summary || 'Upload your files and run reconciliation first for detailed insights.'}\n\n${result.recommendations?.slice(0, 3).map((r: string, i: number) => `${i + 1}. ${r}`).join('\n') || ''}`;
                }
            } catch {
                // Fall through to default
            }
        }

        // Default response
        return `🏦 **Bank Reconciliation Help**

I can help you with:
• "What are common discrepancy types?"
• "How do I match transactions?"
• "Explain timing differences"
• "How to start reconciliation?"

**Quick Start:**
1. Upload your bank statement CSV
2. Upload your ledger/journal CSV
3. Click 'Start Reconciliation'
4. Use 'AI Analysis' for insights

_Ask me anything about bank reconciliation!_`;
    }, []);

    // Handle dashboard/general queries
    const handleDashboardMessage = useCallback((message: string) => {
        void message;
        try {
            const statements = accountingEngine.generateStatements();
            const revenue = statements.revenue || 0;
            const expenses = (statements.costOfSales || 0) + (statements.operatingExpenses || 0);
            const profit = revenue - expenses;
            const profitMargin = revenue > 0 ? (profit / revenue * 100).toFixed(1) : 0;

            return `📊 **Business Overview**\n\nRevenue: ₦${revenue.toLocaleString()}\nExpenses: ₦${expenses.toLocaleString()}\nProfit: ${profit >= 0 ? '+' : ''}₦${profit.toLocaleString()}\nProfit Margin: ${profitMargin}%\n\n_Navigate to specific modules for detailed analysis._`;
        } catch {
            return "Welcome to Quantum Ledger! Start by recording transactions in the Accounting module.";
        }
    }, []);

    // Handle supersheet queries
    const handleSupersheetMessage = useCallback((message: string) => {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('sum') || lowerMessage.includes('add')) {
            return `📝 **SUM Formula**\n\nTo sum values, use:\n\`=SUM(A1:A10)\` - Sum range A1 to A10\n\`=SUM(A1,B1,C1)\` - Sum specific cells\n\n_Just type the formula in a cell starting with = sign!_`;
        }

        if (lowerMessage.includes('average') || lowerMessage.includes('avg') || lowerMessage.includes('mean')) {
            return `📊 **AVERAGE Formula**\n\nTo calculate average:\n\`=AVG(B1:B20)\` - Average of B1 to B20\n\`=AVERAGE(A1:A10)\` - Same function\n\n_Works with any range of numeric values._`;
        }

        if (lowerMessage.includes('if') || lowerMessage.includes('condition')) {
            return `🔀 **IF Formula**\n\nConditional logic:\n\`=IF(A1>100,"High","Low")\`\n\`=IF(B1=0,"Empty","Has Value")\`\n\n**Syntax:** IF(condition, true_value, false_value)`;
        }

        if (lowerMessage.includes('max') || lowerMessage.includes('highest')) {
            return `📈 **MAX Formula**\n\nFind the maximum:\n\`=MAX(A1:A100)\` - Highest in range\n\`=MAX(A1,B1,C1)\` - Highest of cells\n\n_Returns the largest numeric value._`;
        }

        if (lowerMessage.includes('min') || lowerMessage.includes('lowest')) {
            return `📉 **MIN Formula**\n\nFind the minimum:\n\`=MIN(A1:A100)\` - Lowest in range\n\`=MIN(A1,B1,C1)\` - Lowest of cells\n\n_Returns the smallest numeric value._`;
        }

        if (lowerMessage.includes('count')) {
            return `🔢 **COUNT Formula**\n\nCount numeric values:\n\`=COUNT(A1:A50)\` - Count numbers\n\`=COUNTA(A1:A50)\` - Count non-empty\n\n_COUNT only counts numbers, COUNTA counts any value._`;
        }

        if (lowerMessage.includes('formula') || lowerMessage.includes('function')) {
            return `📋 **Available Formulas**\n\n**Math:** SUM, AVG, MIN, MAX, COUNT, ROUND, ABS, SQRT, POWER\n\n**Text:** CONCAT, LEFT, RIGHT, LEN, UPPER, LOWER, TRIM\n\n**Logic:** IF\n\n**Financial:** PMT, FV, NPV\n\n**Date:** NOW, TODAY\n\n_Type = in a cell to start a formula!_`;
        }

        if (lowerMessage.includes('analyze') || lowerMessage.includes('insight')) {
            return `🔍 **Data Analysis**\n\nI can help you analyze your data! Try:\n• Click on a range of cells\n• Ask "What's the trend?"\n• Or "Give me statistics"\n\n_The AI chat in the bottom-right can provide deeper insights._`;
        }

        return `📊 **SuperSheet Help**\n\nI can help you with:\n• "How do I sum a column?"\n• "Create an IF formula"\n• "What formulas are available?"\n• "Analyze my data"\n\n_Use the chat button in SuperSheet for contextual AI assistance!_`;
    }, []);

    const handleProjectionsMessage = useCallback((message: string) => {
        const lower = message.toLowerCase();
        const context = readProjectionsContextSnapshot();
        if (!context) {
            return "Open the projections dashboard first so I can read live metrics and assumptions.";
        }

        if (lower.includes("assumption") || lower.includes("growth") || lower.includes("cogs") || lower.includes("baseline")) {
            return "I can update assumptions directly here. Try: set revenue growth assumption to 12%, or reset assumptions to auto.";
        }

        const topLines = context.split("\n").slice(0, 5).join("\n");
        return `Here is a quick projection snapshot from your live dashboard:\n\n${topLines}`;
    }, []);

    const executeProjectionAction = useCallback<UnifiedCustomActionExecutor>(async (action: UnifiedAgentAction) => {
        if (typeof window === "undefined") return null;

        if (action.type === "projections.resetAssumptions") {
            window.dispatchEvent(new CustomEvent(PROJECTIONS_RESET_EVENT));
            return {
                type: "projections.resetAssumptions",
                success: true,
                message: "Projection assumptions reset to auto-derived values.",
            };
        }

        if (action.type !== "projections.updateAssumption") {
            return null;
        }

        const payload = action.payload && typeof action.payload === "object" ? action.payload : {};
        const updates = Array.isArray((payload as Record<string, unknown>).updates)
            ? ((payload as Record<string, unknown>).updates as ProjectionActionUpdate[])
            : [payload as ProjectionActionUpdate];

        if (!updates.length) {
            return {
                type: "projections.updateAssumption",
                success: false,
                message: "No assumption update was provided.",
            };
        }

        window.dispatchEvent(new CustomEvent(PROJECTIONS_UPDATE_EVENT, { detail: { updates } }));
        return {
            type: "projections.updateAssumption",
            success: true,
            message: "Projection assumptions updated.",
            data: { updates },
        };
    }, []);


    const handleStopAgent = useCallback(() => {
        if (!isAgentPerforming) return;
        if (stopAgentRef.current) return;
        stopAgentRef.current = true;
        appendMessage("assistant", "Stopping agent actions...");
    }, [appendMessage, isAgentPerforming]);

    const handleSend = useCallback(async () => {
        const trimmed = inputValue.trim();
        if (!trimmed || isLoading || isAgentPerforming) return;

        appendMessage("user", trimmed);
        setInputValue("");
        setIsLoading(true);
        stopAgentRef.current = false;

        try {
            let activeRoute = pathname;
            let activeModuleId = currentModule.id;
            const conversation = [...messages, { role: "user" as const, content: trimmed }]
                .slice(-12)
                .map((msg) => ({ role: msg.role, content: msg.content }));
            if (agentChatMode === "response-only") {
                const plan = await requestUnifiedAgentPlan({
                    message: trimmed,
                    module: activeModuleId,
                    route: activeRoute,
                    conversation,
                    contextSnapshot: activeModuleId === "projections" ? readProjectionsContextSnapshot() : undefined,
                });
                const normalizedPlanSource: AgentPlanSource =
                    plan.planSource === "fast-path" || plan.planSource === "gemini" || plan.planSource === "fallback"
                        ? plan.planSource
                        : "fallback";
                setPlanSource(normalizedPlanSource);
                const response = plan.actions.length > 0
                    ? `${plan.reply}\n\nSwitch to "Full agentic" mode to run this action in your workspace.`
                    : plan.reply;
                addChatHistoryEntry({
                    module: activeModuleId,
                    route: pathname,
                    prompt: trimmed,
                    response,
                });
                appendMessage("assistant", response);
            } else {
                setIsAgentPerforming(true);
                let hasClosedForExecution = false;
                const closeModalForExecution = () => {
                    if (hasClosedForExecution) return;
                    hasClosedForExecution = true;
                    setIsModalOpen(false);
                };
                const preferredRoute = resolvePreferredAgentRoute(trimmed, pathname);
                if (preferredRoute && preferredRoute !== pathname) {
                    closeModalForExecution();
                    activeRoute = preferredRoute;
                    activeModuleId = getModuleFromPath(preferredRoute).id;
                    router.push(preferredRoute);
                    await new Promise((resolve) => setTimeout(resolve, 850));
                }

                const result = await runUnifiedAgentMessage({
                    message: trimmed,
                    module: activeModuleId,
                    route: activeRoute,
                    conversation,
                    contextSnapshot: activeModuleId === "projections" ? readProjectionsContextSnapshot() : undefined,
                    customActionExecutor: activeModuleId === "projections" ? executeProjectionAction : undefined,
                    shouldStop: () => stopAgentRef.current,
                    rollbackOnStop: true,
                    autoApproveUiActions: true,
                    onExecutionStart: closeModalForExecution,
                });

                const response = result.finalReply;
                setPlanSource(result.planSource);
                if (result.navigateTo && result.navigateTo !== activeRoute) {
                    router.push(result.navigateTo);
                }

                addChatHistoryEntry({
                    module: activeModuleId,
                    route: pathname,
                    prompt: trimmed,
                    response,
                });
                setIsModalOpen(true);
                await new Promise((resolve) => setTimeout(resolve, 120));
                appendMessage("assistant", response);
                const executedAnyAction = result.execution.some((step) => step.success);
                if (executedAnyAction && !/reply "confirm"|stopped by user|cancelled/i.test(response)) {
                    appendMessage("assistant", "Request complete.");
                }
            }
        } catch {
            setPlanSource("fallback");
            setIsModalOpen(true);
            appendMessage("assistant", "Sorry, I couldn't process that. Please try again.");
        } finally {
            setIsAgentPerforming(false);
            setIsLoading(false);
            stopAgentRef.current = false;
        }
    }, [inputValue, isLoading, isAgentPerforming, currentModule.id, pathname, appendMessage, messages, executeProjectionAction, router, agentChatMode]);


    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (isAgentPerforming) return;
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            {/* Floating Chat Button */}
            <button
                onClick={() => {
                    playGoogleButtonClickSound();
                    setIsModalOpen(true);
                }}
                className={`fixed bottom-8 left-1/2 lg:left-[calc(50%_+_7.5rem)] -translate-x-1/2 z-40 flex items-center justify-center bg-gradient-to-r from-[#2264ff] to-[#1a4fd6] text-white px-3 py-2 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 ${isExpanded ? "gap-2" : "gap-0"}`}
                aria-label="Open chat"
            >
                {/* Red badge for clarification */}
                {clarificationData && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm z-50 animate-bounce">
                        1
                    </div>
                )}
                <img
                    src="/google-logo.jpg"
                    alt="Google"
                    className="w-8 h-8 flex-shrink-0 rounded-full"
                />
                <span
                    className={`font-semibold text-sm overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? "max-w-16 opacity-100" : "max-w-0 opacity-0"}`}
                >
                    Chat
                </span>
            </button>

            {/* Chat Modal */}
            {
                isModalOpen && (
                    <div
                        className="fixed inset-0 z-[100] flex flex-col lg:pl-60"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setIsModalOpen(false);
                        }}
                    >
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

                        <div
                            className="relative mt-auto mx-1.5 sm:mx-2 mb-4 lg:mx-auto lg:max-w-3xl lg:w-full lg:mb-8 rounded-[28px] shadow-2xl flex flex-col overflow-hidden"
                            style={{ animation: "slideUp 0.3s ease-out forwards", maxHeight: "85vh" }}
                        >
                            <div
                                className="absolute inset-0 rounded-[28px] pointer-events-none"
                                style={{
                                    background: "conic-gradient(from 0deg, #4285F4, #EA4335, #FBBC05, #34A853, #4285F4)",
                                    animation: "spinBorder 1.5s linear forwards, fadeBorder 1.5s ease-out forwards",
                                }}
                            />
                            <div className="relative m-[3px] rounded-[25px] bg-gray-100 dark:bg-[#1a1a1a] flex flex-col" style={{ minHeight: "calc(100% - 6px)" }}>
                                {/* Header */}
                                <div className="flex items-center gap-3 px-4 sm:px-5 py-4">
                                    <h3 className="flex-1 font-semibold text-gray-900 dark:text-white text-base">
                                        {currentModule.title}
                                    </h3>
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full bg-${currentModule.color}-100 text-${currentModule.color}-700 dark:bg-${currentModule.color}-900/30 dark:text-${currentModule.color}-400`}>
                                        {currentModule.name}
                                    </span>
                                    <div className="flex items-center">
                                        <div className="relative">
                                            <select
                                                value={agentChatMode}
                                                onChange={(e) => setAgentChatMode(e.target.value as AgentChatMode)}
                                                className="h-7 w-[108px] appearance-none rounded-full border border-gray-300 bg-white pl-6 pr-6 text-[10px] font-semibold text-gray-700 outline-none transition-colors focus:border-blue-400"
                                                aria-label="Assistant mode"
                                            >
                                                <option value="response-only">Response</option>
                                                <option value="full-agentic">Agentic</option>
                                            </select>
                                            <svg
                                                className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-500"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                                aria-hidden="true"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.4 4.9L20 9l-4 3.9.9 5.5L12 16l-4.9 2.4.9-5.5L4 9l5.6-1.1L12 3z" />
                                            </svg>
                                            <svg
                                                className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-500"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.156l3.71-3.925a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="px-4 sm:px-5 pb-2 text-[11px] text-gray-500 dark:text-gray-400">
                                    {formatPlanSourceLabel(planSource)}{` • mode: ${agentChatMode === "full-agentic" ? "full agentic" : "response only"}`}
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-4">
                                    {messages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className={`mb-4 ${msg.role === "user" ? "text-right" : "text-left"}`}
                                        >
                                            {msg.role === "user" ? (
                                                <div className="inline-block max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap bg-blue-500 text-white">
                                                    {msg.content}
                                                </div>
                                            ) : (
                                                <div className="inline-block max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap bg-gray-100 text-gray-900 dark:bg-[#1a1a1a] dark:text-gray-100">
                                                    {msg.content}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {isLoading && (
                                        <div className="mb-4">
                                            <div className="flex gap-1">
                                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                            </div>
                                        </div>
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Input */}
                                <div className="px-3 sm:px-4 py-4">
                                    <div className="flex items-center gap-2 bg-gray-200 dark:bg-[#2a2a2a] rounded-full px-2 py-1.5">
                                        <button className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                            </svg>
                                        </button>

                                        <textarea
                                            ref={textareaRef}
                                            rows={1}
                                            placeholder={currentModule.placeholder}
                                            className="flex-1 bg-transparent border-none text-sm text-gray-700 dark:text-white placeholder:text-gray-400 focus:outline-none resize-none py-2.5 min-h-[40px]"
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                        />

                                        <button className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                            </svg>
                                        </button>

                                        <button
                                            onClick={isAgentPerforming ? handleStopAgent : handleSend}
                                            disabled={isAgentPerforming ? false : !inputValue.trim() || isLoading}
                                            className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-all ${isAgentPerforming
                                                ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
                                                : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600"
                                                }`}
                                            title={isAgentPerforming ? "Stop agent" : "Send"}
                                        >
                                            {isAgentPerforming ? (
                                                <span className="h-3.5 w-3.5 rounded-full bg-red-500" />
                                            ) : inputValue.trim() ? (
                                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                                                </svg>
                                            ) : (
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
}
