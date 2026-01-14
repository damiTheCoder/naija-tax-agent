"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { accountingEngine, parseTransactionFromChat } from "@/lib/accounting/transactionBridge";
import { RawTransaction, TransactionType } from "@/lib/accounting/types";
import { taxEngine, detectTaxType } from "@/lib/tax/taxEngine";

type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
};

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
    default: {
        id: "general",
        name: "CashOS",
        title: "CashOS Assistant",
        placeholder: "Ask CashOS...",
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

export default function FloatingChatButton() {
    const pathname = usePathname();
    const [currentModule, setCurrentModule] = useState<ModuleConfig>(moduleConfigs.default);
    const [isExpanded, setIsExpanded] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Detect module from pathname
    useEffect(() => {
        const module = getModuleFromPath(pathname);
        setCurrentModule(module);

        // Reset messages with module-specific greeting when module changes
        setMessages([{
            id: "intro",
            role: "assistant",
            content: `${module.greeting}\n\nExamples:\n• ${module.examples.join('\n• ')}`,
            timestamp: Date.now(),
        }]);
    }, [pathname]);

    // Load engines on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            accountingEngine.load();
            taxEngine.load();
        }
    }, []);

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

    // Focus input when modal opens
    useEffect(() => {
        if (isModalOpen && textareaRef.current) {
            setTimeout(() => textareaRef.current?.focus(), 100);
        }
    }, [isModalOpen]);

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

    // Handle dashboard/general queries
    const handleDashboardMessage = useCallback((message: string) => {
        try {
            const statements = accountingEngine.generateStatements();
            const revenue = statements.revenue || 0;
            const expenses = (statements.costOfSales || 0) + (statements.operatingExpenses || 0);
            const profit = revenue - expenses;
            const profitMargin = revenue > 0 ? (profit / revenue * 100).toFixed(1) : 0;

            return `📊 **Business Overview**\n\nRevenue: ₦${revenue.toLocaleString()}\nExpenses: ₦${expenses.toLocaleString()}\nProfit: ${profit >= 0 ? '+' : ''}₦${profit.toLocaleString()}\nProfit Margin: ${profitMargin}%\n\n_Navigate to specific modules for detailed analysis._`;
        } catch {
            return "Welcome to CashOS! Start by recording transactions in the Accounting module.";
        }
    }, []);

    const handleSend = useCallback(async () => {
        const trimmed = inputValue.trim();
        if (!trimmed || isLoading) return;

        appendMessage("user", trimmed);
        setInputValue("");
        setIsLoading(true);

        try {
            let response: string;

            // Route to appropriate handler based on current module
            switch (currentModule.id) {
                case "accounting":
                    response = await handleAccountingMessage(trimmed);
                    break;
                case "cashflow":
                    response = handleCashflowMessage(trimmed);
                    break;
                case "tax":
                    response = handleTaxMessage(trimmed);
                    break;
                case "wallet":
                    response = handleWalletMessage(trimmed);
                    break;
                default:
                    response = handleDashboardMessage(trimmed);
            }

            appendMessage("assistant", response);
        } catch {
            appendMessage("assistant", "Sorry, I couldn't process that. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }, [inputValue, isLoading, currentModule.id, appendMessage, handleAccountingMessage, handleCashflowMessage, handleTaxMessage, handleWalletMessage, handleDashboardMessage]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            {/* Floating Chat Button */}
            <button
                onClick={() => setIsModalOpen(true)}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 bg-gradient-to-r from-[#4285F4] via-[#EA4335] via-[#FBBC05] to-[#34A853] text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                aria-label="Open chat"
            >
                <img
                    src="/google-logo.jpg"
                    alt="Google"
                    className="w-5 h-5 flex-shrink-0 rounded-full"
                />
                <span
                    className={`font-semibold text-xs overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? "max-w-16 opacity-100" : "max-w-0 opacity-0"}`}
                >
                    Chat
                </span>
            </button>

            {/* Chat Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-[100] flex flex-col"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsModalOpen(false);
                    }}
                >
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

                    <div
                        className="relative mt-auto mx-2 mb-4 lg:mx-auto lg:max-w-3xl lg:w-full lg:mb-8 rounded-[28px] shadow-2xl flex flex-col overflow-hidden"
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
                            <div className="flex items-center gap-3 px-5 py-4">
                                <h3 className="flex-1 font-semibold text-gray-900 dark:text-white text-base">
                                    {currentModule.title}
                                </h3>
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full bg-${currentModule.color}-100 text-${currentModule.color}-700 dark:bg-${currentModule.color}-900/30 dark:text-${currentModule.color}-400`}>
                                    {currentModule.name}
                                </span>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto px-5 pb-4">
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
                                            <div className="text-sm leading-relaxed text-gray-900 dark:text-gray-200 whitespace-pre-wrap">
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
                            <div className="px-4 py-4">
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
                                        onClick={handleSend}
                                        disabled={!inputValue.trim() || isLoading}
                                        className="w-10 h-10 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-gray-50 dark:hover:bg-gray-600"
                                    >
                                        {inputValue.trim() ? (
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
            )}
        </>
    );
}
