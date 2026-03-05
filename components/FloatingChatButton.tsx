"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { accountingEngine, parseTransactionFromChat } from "@/lib/accounting/transactionBridge";
import { RawTransaction, TransactionType } from "@/lib/accounting/types";
import { taxEngine } from "@/lib/tax/taxEngine";
import { walletEngine } from "@/lib/wallet/walletEngine";
import { calculateCashPosition, calculateCashflowMetrics } from "@/lib/cashflow/cashflowEngine";
import { loadBudgetingState } from "@/lib/budgeting/store";
import { payrollEngine } from "@/lib/payroll/payrollEngine";
import { playGoogleButtonClickSound } from "@/lib/sounds";
import {
    formatPlanSourceLabel,
    runUnifiedAgentMessage,
    type AgentPlanSource,
    type UnifiedCustomActionExecutor
} from "@/lib/agent/unifiedClient";
import type { UnifiedAgentAction } from "@/lib/agent/unifiedTypes";
import { resolveWorkspaceRouteFromText } from "@/lib/agent/routeResolver";
import { buildWorkspaceRouteCatalogText, findWorkspacePageByRoute } from "@/lib/agent/workspaceRegistry";
import {
    ChatConversation,
    ChatConversationMessage,
    PERSONAL_CHAT_HISTORY_UPDATED_EVENT,
    CHAT_HISTORY_SELECTED_EVENT,
    createChatConversation,
    createChatConversationAsync,
    consumeSelectedChatHistory,
    deleteChatConversationAsync,
    getChatConversation,
    getChatConversationAsync,
    loadChatConversationsAsync,
    renameChatConversation,
    renameChatConversationAsync,
    saveChatConversationMessages,
    saveChatConversationMessagesAsync,
    selectChatConversation,
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
const CHAT_MODAL_OPEN_EVENT = "ql:chat-open";
const HAS_WORKSPACE_ROUTE_CATALOG = buildWorkspaceRouteCatalogText({ maxItems: 1 }).trim().length > 0;

type ChatModalOpenDetail = {
    module?: string;
    prompt?: string;
    newChat?: boolean;
};

function toPlainChatText(content: string): string {
    if (!content) return "";

    return content
        .replace(/\r\n/g, "\n")
        .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, "").trim())
        .replace(/`([^`]+)`/g, "$1")
        .replace(/^\s{0,3}#{1,6}\s*/gm, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/(^|[\s(])\*(?!\s)([^*]+?)\*(?=[\s).,!?]|$)/g, "$1$2")
        .replace(/(^|[\s(])_(?!\s)([^_]+?)_(?=[\s).,!?]|$)/g, "$1$2")
        .replace(/^\s*>\s?/gm, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

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
    attachment?: ChatAttachmentDownload;
};

type AgentChatMode = "response-only" | "full-agentic";
type ChatAttachmentDownload = {
    kind: "download";
    fileName: string;
    url: string;
    mimeType?: string;
};

function toConversationMessages(messages: ChatMessage[]): ChatConversationMessage[] {
    return messages
        .filter((message) => message.id !== "intro")
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            timestamp: message.timestamp,
        }))
        .filter((message) => message.content.trim().length > 0);
}

function fromConversationMessages(messages: ChatConversationMessage[]): ChatMessage[] {
    return messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
    }));
}

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
            '"Set tax rate to 22 in this model"',
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
    budgeting: {
        id: "budgeting",
        name: "Budgeting",
        title: "Budgeting Assistant",
        placeholder: "Ask about budgets and forecasts...",
        greeting: "Hi! I can help with budgets, scenarios, variances, and forecasting workflows.",
        examples: [
            '"Create a monthly marketing budget"',
            '"Show budget vs actual for this month"',
            '"Open variance analysis"'
        ],
        color: "blue"
    },
    marketplace: {
        id: "marketplace",
        name: "Marketplace",
        title: "Marketplace Assistant",
        placeholder: "Ask about integrations and products...",
        greeting: "Hi! I can help you navigate products and integrations in the marketplace.",
        examples: [
            '"Open my marketplace profile"',
            '"Show available integrations"',
            '"Connect a new service"'
        ],
        color: "blue"
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

function getModuleFromId(moduleId?: string): ModuleConfig | null {
    if (!moduleId) return null;
    const normalized = moduleId.toLowerCase().trim();
    if (!normalized) return null;
    return (
        Object.values(moduleConfigs).find((config) => config.id.toLowerCase() === normalized) ||
        null
    );
}

type PageAssistantProfile = {
    label: string;
    guidance: string;
    crossPagePolicy: string;
};

function getPageAssistantProfile(pathname: string): PageAssistantProfile {
    const route = pathname || "/";
    if (route.startsWith("/accounting/projections")) {
        return {
            label: "Accounting Projections",
            guidance: "Analyze forecasts, update assumptions, and explain projection outcomes.",
            crossPagePolicy: "If user gives transaction instructions, execute accounting posting logic and sync ledger immediately.",
        };
    }
    if (route.startsWith("/accounting/reports")) {
        return {
            label: "Accounting Reports",
            guidance: "Generate statements, review balances, and export report outputs.",
            crossPagePolicy: "If user gives transaction instructions, execute accounting posting logic and refresh reports.",
        };
    }
    if (route.startsWith("/accounting/reconciliation")) {
        return {
            label: "Bank Reconciliation",
            guidance: "Match ledger to bank records, explain discrepancies, and provide reconciliation actions.",
            crossPagePolicy: "If user gives transaction instructions, execute accounting posting logic first, then continue reconciliation context.",
        };
    }
    if (route.startsWith("/accounting")) {
        return {
            label: "Accounting Workspace",
            guidance: "Post journal entries, manage ledgers, and keep statements accurate.",
            crossPagePolicy: "Handle accounting actions directly and use tax/wallet actions when explicitly requested.",
        };
    }
    if (route.startsWith("/tax")) {
        return {
            label: "Tax Workspace",
            guidance: "Compute liabilities, track filings, schedules, and compliance data.",
            crossPagePolicy: "If user gives accounting transaction instructions, post to accounting logic and keep tax computation in sync.",
        };
    }
    if (route.startsWith("/wallet")) {
        return {
            label: "Wallet",
            guidance: "Handle funding, transfers, and wallet balance activity.",
            crossPagePolicy: "If user gives accounting or tax requests, run those module actions in background while preserving wallet context.",
        };
    }
    const pageDefinition = findWorkspacePageByRoute(route);
    if (pageDefinition) {
        return {
            label: pageDefinition.label,
            guidance: `${pageDefinition.purpose} Key functions: ${pageDefinition.keyFunctions.join(", ")}.`,
            crossPagePolicy: `${pageDefinition.executionLogic} Always route to the best page before performing actions.`,
        };
    }
    return {
        label: "Workspace",
        guidance: "Use page context and conversation intent to decide execution steps.",
        crossPagePolicy: "Always execute the user intent in the correct module, even if it belongs to a different page.",
    };
}

function formatSnapshotNaira(value: number): string {
    const safe = Number.isFinite(value) ? value : 0;
    const sign = safe < 0 ? "-" : "";
    return `${sign}₦${Math.abs(safe).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

function buildGlobalDataSnapshot(): string {
    if (typeof window === "undefined") return "";

    try {
        const accountingState = accountingEngine.getState();
        if (accountingState.journalEntries.length === 0 && window.localStorage.getItem("insight::accounting-engine")) {
            accountingEngine.load();
        }
    } catch {
        // Ignore accounting load failures
    }

    try {
        const taxState = taxEngine.getState();
        if (taxState.transactions.length === 0 && window.localStorage.getItem("insight::tax-engine")) {
            taxEngine.load();
        }
    } catch {
        // Ignore tax load failures
    }

    try {
        if (window.localStorage.getItem("naija-wallet-state")) {
            walletEngine.load();
        }
    } catch {
        // Ignore wallet load failures
    }

    const lines: string[] = ["Cross-module live data snapshot:"];

    try {
        const accountingState = accountingEngine.getState();
        const statements = accountingEngine.generateStatements();
        const recentEntries = [...accountingState.journalEntries]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5)
            .map((entry) => `${entry.date} | ${entry.narration} | ${formatSnapshotNaira(entry.totalDebits || 0)}`);
        lines.push(
            `Accounting: entries=${accountingState.journalEntries.length}, revenue=${formatSnapshotNaira(statements.revenue || 0)}, expenses=${formatSnapshotNaira(((statements.costOfSales || 0) + (statements.operatingExpenses || 0)))}, netIncome=${formatSnapshotNaira(statements.netIncome || 0)}, assets=${formatSnapshotNaira(statements.assets || 0)}, liabilities=${formatSnapshotNaira(statements.liabilities || 0)}, equity=${formatSnapshotNaira(statements.equity || 0)}`
        );
        if (recentEntries.length > 0) {
            lines.push(`Recent journal entries: ${recentEntries.join(" ; ")}`);
        }
    } catch {
        lines.push("Accounting: unavailable");
    }

    try {
        const taxState = taxEngine.getState();
        const taxSummary = taxEngine.getTaxSummary();
        lines.push(
            `Tax: txns=${taxState.transactions.length}, schedules=${taxState.schedules.length}, VAT=${formatSnapshotNaira(taxSummary.totalVAT)}, inputVATCredit=${formatSnapshotNaira(taxSummary.inputVATCredit)}, netVATPayable=${formatSnapshotNaira(taxSummary.netVATPayable)}, WHT=${formatSnapshotNaira(taxSummary.totalWHT)}, CGT=${formatSnapshotNaira(taxSummary.totalCGT)}, totalTaxPayable=${formatSnapshotNaira(taxSummary.grandTotal)}`
        );
    } catch {
        lines.push("Tax: unavailable");
    }

    try {
        const walletState = walletEngine.getState();
        lines.push(
            `Wallet: balance=${formatSnapshotNaira(walletState.balance || 0)}, transactions=${walletState.transactions?.length || 0}, cards=${walletState.cards?.length || 0}`
        );
    } catch {
        lines.push("Wallet: unavailable");
    }

    try {
        const accountingState = accountingEngine.getState();
        const cashPosition = calculateCashPosition(accountingState);
        const cashMetrics = calculateCashflowMetrics(accountingState, 30);
        lines.push(
            `Cashflow: availableCash=${formatSnapshotNaira(cashPosition.availableCash)}, receivables=${formatSnapshotNaira(cashPosition.receivables)}, payables=${formatSnapshotNaira(cashPosition.payables)}, burnRate30d=${formatSnapshotNaira(cashMetrics.burnRate)}, runwayDays=${cashMetrics.runwayDays}, status=${cashMetrics.status}`
        );
    } catch {
        lines.push("Cashflow: unavailable");
    }

    try {
        const budgetingState = loadBudgetingState();
        const budgetedTotal = (budgetingState.budgets || []).reduce((sum, budget) => sum + (budget.totalAmount || 0), 0);
        lines.push(
            `Budgeting: budgets=${budgetingState.budgets?.length || 0}, scenarios=${budgetingState.scenarios?.length || 0}, totalBudgeted=${formatSnapshotNaira(budgetedTotal)}, fiscalStartMonth=${budgetingState.settings?.fiscalYearStartMonth || 1}`
        );
    } catch {
        lines.push("Budgeting: unavailable");
    }

    try {
        const runs = payrollEngine.getRuns();
        const latest = runs[0];
        lines.push(
            latest
                ? `Payroll: runs=${runs.length}, latest=${latest.month} ${latest.year}, status=${latest.status}, totalNet=${formatSnapshotNaira(latest.totalNet)}, totalTax=${formatSnapshotNaira(latest.totalTax)}`
                : "Payroll: runs=0"
        );
    } catch {
        lines.push("Payroll: unavailable");
    }

    return lines.join("\n");
}

function buildPageContextSnapshot(pathname: string, moduleId: string): string {
    const profile = getPageAssistantProfile(pathname);
    const pageDefinition = findWorkspacePageByRoute(pathname);
    const lines = [
        `Active route: ${pathname || "/"}`,
        `Active module id: ${moduleId || "general"}`,
        `Active page: ${profile.label}`,
        `Page guidance: ${profile.guidance}`,
        `Cross-page policy: ${profile.crossPagePolicy}`,
    ];
    if (pageDefinition) {
        lines.push(
            `Active page logic: ${pageDefinition.executionLogic}`,
            `Active page functions: ${pageDefinition.keyFunctions.join(", ")}`
        );
    }

    const moduleRouteCatalog = buildWorkspaceRouteCatalogText({
        moduleFilter: pageDefinition?.module || moduleId,
        maxItems: 18,
    });
    if (moduleRouteCatalog.trim()) {
        lines.push(`Module route map:\n${moduleRouteCatalog}`);
    }
    if (HAS_WORKSPACE_ROUTE_CATALOG) {
        lines.push("Global route intelligence: full page-function catalog loaded for cross-module execution.");
    }

    const globalDataSnapshot = buildGlobalDataSnapshot();
    if (globalDataSnapshot.trim()) {
        lines.push(globalDataSnapshot);
    }

    if (pathname.startsWith("/accounting/projections") || moduleId === "projections") {
        const projectionSnapshot = readProjectionsContextSnapshot();
        if (projectionSnapshot.trim()) {
            lines.push(`Projection snapshot:\n${projectionSnapshot}`);
        }
    }

    return lines.join("\n");
}

function createIntroMessage(module: ModuleConfig, pathname: string): ChatMessage {
    const pageProfile = getPageAssistantProfile(pathname);
    return {
        id: "intro",
        role: "assistant",
        content: `${module.greeting}\n\nCurrent page: ${pageProfile.label}\nI am page-aware here and can also execute valid cross-page tasks when needed.\n\nExamples:\n• ${module.examples.join('\n• ')}`,
        timestamp: Date.now(),
    };
}

function resolvePreferredAgentRoute(message: string, currentPath: string): string | null {
    const lower = message.toLowerCase();
    const navigationIntent =
        /\b(page|link|url|where|go to|open|navigate|take me|which page|location|switch to|visit|move to)\b/.test(lower);
    const actionIntent =
        /\b(post|record|create|add|run|process|review|check|analy[sz]e|calculate|compute|connect|sync|classify|file|submit|upload|download|export|print|approve|pay|lock|unlock|set|update|change)\b/.test(
            lower
        );
    const pageIntent =
        /\b(report|statement|trial balance|balance sheet|cash flow|projections?|forecast|model|reconcil|bank connection|payroll|invoice|receipt|vendor|bill|approval|period|recurring|fx|dimension|tax|wallet|budget|cashflow|marketplace|supersheet|profile)\b/.test(
            lower
        );

    if (!navigationIntent && !actionIntent && !pageIntent) return null;
    const resolved = resolveWorkspaceRouteFromText(message, currentPath, getModuleFromPath(currentPath).id);
    if (!resolved || resolved.route === currentPath) return null;
    return resolved.route;
}

function extractDownloadAttachment(data: unknown): ChatAttachmentDownload | null {
    if (!data || typeof data !== "object") return null;
    const record = data as Record<string, unknown>;
    const download = record.download;
    if (!download || typeof download !== "object") return null;
    const payload = download as Record<string, unknown>;
    const kind = typeof payload.kind === "string" ? payload.kind : "download";
    const fileName = typeof payload.fileName === "string" ? payload.fileName : "";
    const url = typeof payload.url === "string" ? payload.url : "";
    const mimeType = typeof payload.mimeType === "string" ? payload.mimeType : undefined;
    if (!fileName || !url) return null;
    return {
        kind: kind === "download" ? "download" : "download",
        fileName,
        url,
        mimeType,
    };
}

export default function FloatingChatButton() {
    const pathname = usePathname();
    const router = useRouter();
    const [currentModule, setCurrentModule] = useState<ModuleConfig>(moduleConfigs.default);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isAgentPerforming, setIsAgentPerforming] = useState(false);
    const [planSource, setPlanSource] = useState<AgentPlanSource>("fallback");
    const [agentChatMode, setAgentChatMode] = useState<AgentChatMode>("response-only");
    const [clarificationData, setClarificationData] = useState<ClarificationData | null>(null);
    const [conversationList, setConversationList] = useState<ChatConversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [openConversationMenuId, setOpenConversationMenuId] = useState<string | null>(null);
    const [mobileConversationMenuPosition, setMobileConversationMenuPosition] = useState<{ top: number; left: number } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const stopAgentRef = useRef(false);
    const blobUrlsRef = useRef<string[]>([]);

    const revokeBlobUrls = useCallback(() => {
        for (const url of blobUrlsRef.current) {
            try {
                URL.revokeObjectURL(url);
            } catch {
                // Ignore bad/revoked URLs.
            }
        }
        blobUrlsRef.current = [];
    }, []);

    const refreshConversationList = useCallback(async () => {
        const conversations = await loadChatConversationsAsync();
        setConversationList(conversations);
    }, []);

    const openConversation = useCallback((conversation: ChatConversation, module: ModuleConfig, route: string) => {
        const introMessage = createIntroMessage(module, route);
        const restored = fromConversationMessages(conversation.messages);
        setMessages(restored.length > 0 ? [introMessage, ...restored] : [introMessage]);
        setActiveConversationId(conversation.id);
        setInputValue("");
    }, []);

    const persistConversation = useCallback(async (
        nextMessages: ChatMessage[],
        moduleId: string,
        route: string,
        preferredConversationId?: string | null
    ): Promise<string | null> => {
        const conversationMessages = toConversationMessages(nextMessages);
        if (conversationMessages.length === 0) return preferredConversationId || activeConversationId || null;

        let conversationId = preferredConversationId || activeConversationId;
        if (!conversationId) {
            const firstUserMessage = conversationMessages.find((item) => item.role === "user")?.content || "New chat";
            const created = (await createChatConversationAsync({
                module: moduleId,
                route,
                title: firstUserMessage,
            })) || createChatConversation({
                    module: moduleId,
                    route,
                    title: firstUserMessage,
                });
            conversationId = created.id;
            setActiveConversationId(created.id);
        }

        let saved = (await saveChatConversationMessagesAsync({
            conversationId,
            module: moduleId,
            route,
            messages: conversationMessages,
        })) || saveChatConversationMessages({
            conversationId,
            module: moduleId,
            route,
            messages: conversationMessages,
        });

        if (!saved) {
            const firstUserMessage = conversationMessages.find((item) => item.role === "user")?.content || "New chat";
            const created = (await createChatConversationAsync({
                module: moduleId,
                route,
                title: firstUserMessage,
            })) || createChatConversation({
                    module: moduleId,
                    route,
                    title: firstUserMessage,
                });
            conversationId = created.id;
            setActiveConversationId(created.id);
            saved = (await saveChatConversationMessagesAsync({
                conversationId,
                module: moduleId,
                route,
                messages: conversationMessages,
            })) || saveChatConversationMessages({
                conversationId,
                module: moduleId,
                route,
                messages: conversationMessages,
            });
        }

        await refreshConversationList();
        return saved?.id || conversationId || null;
    }, [activeConversationId, refreshConversationList]);

    const handleStartNewChat = useCallback(() => {
        revokeBlobUrls();
        setActiveConversationId(null);
        setOpenConversationMenuId(null);
        setMobileConversationMenuPosition(null);
        setMessages([createIntroMessage(currentModule, pathname)]);
        setInputValue("");
        setPlanSource("fallback");
        void refreshConversationList();
        setIsModalOpen(true);
    }, [currentModule, pathname, refreshConversationList, revokeBlobUrls]);

    const handleSelectConversation = useCallback(async (conversationId: string) => {
        const conversation = (await getChatConversationAsync(conversationId)) || getChatConversation(conversationId);
        if (!conversation) return;
        setOpenConversationMenuId(null);
        setMobileConversationMenuPosition(null);
        if (conversation.route && conversation.route !== pathname) {
            selectChatConversation(conversation.id);
            router.push(conversation.route);
            setIsModalOpen(true);
            return;
        }
        const moduleConfig = getModuleFromPath(conversation.route || pathname);
        setCurrentModule(moduleConfig);
        openConversation(conversation, moduleConfig, conversation.route || pathname);
        setIsModalOpen(true);
    }, [openConversation, pathname, router]);

    const handleToggleConversationMenu = useCallback((conversationId: string, trigger?: HTMLElement | null) => {
        const menuWidth = 132;
        const viewportPadding = 8;
        setOpenConversationMenuId((current) => {
            const next = current === conversationId ? null : conversationId;
            if (!next) {
                setMobileConversationMenuPosition(null);
                return null;
            }

            if (trigger && typeof window !== "undefined" && window.innerWidth < 1024) {
                const rect = trigger.getBoundingClientRect();
                const left = Math.min(
                    Math.max(viewportPadding, rect.right - menuWidth),
                    window.innerWidth - menuWidth - viewportPadding
                );
                const top = Math.max(
                    viewportPadding,
                    Math.min(rect.bottom + 8, window.innerHeight - 96)
                );
                setMobileConversationMenuPosition({ top, left });
            } else {
                setMobileConversationMenuPosition(null);
            }
            return next;
        });
    }, []);

    const handleRenameConversation = useCallback(async (conversationId: string) => {
        const conversation = (await getChatConversationAsync(conversationId)) || getChatConversation(conversationId);
        if (!conversation) return;
        const renamed = window.prompt("Rename chat", conversation.title);
        if (renamed === null) return;
        const nextTitle = renamed.trim();
        if (!nextTitle) return;

        const updated = (await renameChatConversationAsync({
            conversationId,
            title: nextTitle,
        })) || renameChatConversation({
            conversationId,
            title: nextTitle,
        });
        if (!updated) return;

        setOpenConversationMenuId(null);
        setMobileConversationMenuPosition(null);
        await refreshConversationList();

        if (activeConversationId === conversationId) {
            const moduleConfig = getModuleFromPath(updated.route || pathname);
            setCurrentModule(moduleConfig);
            openConversation(updated, moduleConfig, updated.route || pathname);
        }
    }, [activeConversationId, openConversation, pathname, refreshConversationList]);

    const handleDeleteConversation = useCallback(async (conversationId: string) => {
        const conversation = (await getChatConversationAsync(conversationId)) || getChatConversation(conversationId);
        if (!conversation) return;
        const confirmed = window.confirm(`Delete chat "${conversation.title}"?`);
        if (!confirmed) return;

        const deleted = await deleteChatConversationAsync(conversationId);
        if (!deleted) return;

        setOpenConversationMenuId(null);
        setMobileConversationMenuPosition(null);
        await refreshConversationList();

        if (activeConversationId === conversationId) {
            setActiveConversationId(null);
            setMessages([createIntroMessage(currentModule, pathname)]);
            setInputValue("");
        }
    }, [activeConversationId, currentModule, pathname, refreshConversationList]);

    // Detect module from pathname
    useEffect(() => {
        let active = true;
        const run = async () => {
            const activeModule = getModuleFromPath(pathname);
            setCurrentModule(activeModule);
            setOpenConversationMenuId(null);
            revokeBlobUrls();
            const selected = consumeSelectedChatHistory({ pathname });
            const allConversations = await loadChatConversationsAsync();
            if (!active) return;
            setConversationList(allConversations);

            if (selected && selected.module !== "personal" && selected.conversationId) {
                const selectedConversation =
                    (await getChatConversationAsync(selected.conversationId)) ||
                    getChatConversation(selected.conversationId);
                if (selectedConversation) {
                    openConversation(selectedConversation, activeModule, pathname);
                    setIsModalOpen(true);
                    return;
                }
            }

            if (selected && selected.module !== "personal") {
                const introMessage = createIntroMessage(activeModule, pathname);
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
                setActiveConversationId(null);
                setIsModalOpen(true);
                return;
            }

            const routeConversations = allConversations.filter((conversation) => conversation.route === pathname);
            const latestConversation = routeConversations[0];
            if (latestConversation) {
                openConversation(latestConversation, activeModule, pathname);
                return;
            }

            setActiveConversationId(null);
            setMessages([createIntroMessage(activeModule, pathname)]);
            setInputValue("");
        };

        void run();
        return () => {
            active = false;
        };
    }, [pathname, openConversation, revokeBlobUrls]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const handleExternalChatOpen = (event: Event) => {
            const customEvent = event as CustomEvent<ChatModalOpenDetail>;
            const detail = customEvent.detail || {};
            const requestedModule = getModuleFromId(detail.module);
            const resolvedModule = requestedModule || getModuleFromPath(pathname);
            const shouldStartNewChat = detail.newChat === true;

            setCurrentModule(resolvedModule);
            setOpenConversationMenuId(null);

            if (shouldStartNewChat) {
                setActiveConversationId(null);
                setMessages([createIntroMessage(resolvedModule, pathname)]);
                setPlanSource("fallback");
            }

            if (typeof detail.prompt === "string") {
                setInputValue(detail.prompt);
            }

            setIsModalOpen(true);
        };

        window.addEventListener(CHAT_MODAL_OPEN_EVENT, handleExternalChatOpen as EventListener);
        return () => {
            window.removeEventListener(CHAT_MODAL_OPEN_EVENT, handleExternalChatOpen as EventListener);
        };
    }, [pathname]);

    useEffect(() => {
        const handleHistorySelection = () => {
            const selected = consumeSelectedChatHistory({ pathname });
            if (!selected || selected.module === "personal") return;

            const activeModule = getModuleFromPath(pathname);
            setCurrentModule(activeModule);
            void refreshConversationList();

            if (selected.conversationId) {
                const selectedConversation = getChatConversation(selected.conversationId);
                if (selectedConversation) {
                    openConversation(selectedConversation, activeModule, pathname);
                    setIsModalOpen(true);
                    return;
                }
            }

            const introMessage = createIntroMessage(activeModule, pathname);
            const baseTs = selected.timestamp || Date.now();
            const restoredMessages: ChatMessage[] = [introMessage];
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
            setActiveConversationId(null);
            setMessages(restoredMessages);
            setInputValue(selected.response ? "" : selected.prompt);
            setIsModalOpen(true);
        };

        window.addEventListener(CHAT_HISTORY_SELECTED_EVENT, handleHistorySelection as EventListener);
        return () => {
            window.removeEventListener(CHAT_HISTORY_SELECTED_EVENT, handleHistorySelection as EventListener);
        };
    }, [openConversation, pathname, refreshConversationList]);

    useEffect(() => {
        const refresh = () => {
            void refreshConversationList();
        };
        refresh();
        window.addEventListener("storage", refresh);
        window.addEventListener(PERSONAL_CHAT_HISTORY_UPDATED_EVENT, refresh as EventListener);
        return () => {
            window.removeEventListener("storage", refresh);
            window.removeEventListener(PERSONAL_CHAT_HISTORY_UPDATED_EVENT, refresh as EventListener);
        };
    }, [pathname, refreshConversationList]);

    useEffect(() => {
        if (!openConversationMenuId) return;

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-conversation-menu='true']")) return;
            setOpenConversationMenuId(null);
        };

        document.addEventListener("mousedown", handlePointerDown);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
        };
    }, [openConversationMenuId]);

    useEffect(() => {
        if (!openConversationMenuId) {
            setMobileConversationMenuPosition(null);
        }
    }, [openConversationMenuId]);

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

    useEffect(() => {
        return () => {
            revokeBlobUrls();
        };
    }, [revokeBlobUrls]);

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

    const buildChatMessage = useCallback((role: ChatMessage["role"], content: string, attachment?: ChatAttachmentDownload): ChatMessage => ({
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role,
        content,
        timestamp: Date.now(),
        attachment,
    }), []);

    const appendMessage = useCallback((role: ChatMessage["role"], content: string, attachment?: ChatAttachmentDownload) => {
        if (attachment?.url && attachment.url.startsWith("blob:")) {
            blobUrlsRef.current.push(attachment.url);
        }
        setMessages(prev => [
            ...prev,
            buildChatMessage(role, content, attachment),
        ]);
    }, [buildChatMessage]);

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

            results.push("💰 **Tax**: Synced from posted journal to ledger-first tax engine");

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

        if (lower.includes("assumption") || lower.includes("growth") || lower.includes("cogs") || lower.includes("baseline") || lower.includes("input") || lower.includes("model")) {
            return "I can update projections and model inputs directly here. Try: set revenue growth assumption to 12%, set tax rate to 22, or reset assumptions to auto.";
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
            message: "Projection assumptions/model inputs updated.",
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

        let activeRoute = pathname;
        let activeModuleId = currentModule.id;
        let workingConversationId: string | null = activeConversationId;

        const userMessage = buildChatMessage("user", trimmed);
        let workingMessages: ChatMessage[] = [...messages, userMessage];
        setMessages(workingMessages);
        setInputValue("");
        setIsLoading(true);
        stopAgentRef.current = false;

        const savedAfterUser = await persistConversation(workingMessages, activeModuleId, activeRoute, workingConversationId);
        if (savedAfterUser) {
            workingConversationId = savedAfterUser;
        }

        const appendAssistantAndPersist = async (content: string, attachment?: ChatAttachmentDownload) => {
            if (attachment?.url && attachment.url.startsWith("blob:")) {
                blobUrlsRef.current.push(attachment.url);
            }
            const cleanContent = toPlainChatText(content);
            const assistantMessage = buildChatMessage("assistant", cleanContent, attachment);
            workingMessages = [...workingMessages, assistantMessage];
            setMessages(workingMessages);
            const savedConversationId = await persistConversation(workingMessages, activeModuleId, activeRoute, workingConversationId);
            if (savedConversationId) {
                workingConversationId = savedConversationId;
            }
        };

        try {
            const conversation = toConversationMessages(workingMessages)
                .slice(-12)
                .map((msg) => ({ role: msg.role, content: msg.content }));

            if (agentChatMode === "response-only") {
                const runtimeContextSnapshot = buildPageContextSnapshot(activeRoute, activeModuleId);
                const result = await runUnifiedAgentMessage({
                    message: trimmed,
                    module: activeModuleId,
                    route: activeRoute,
                    conversation,
                    contextSnapshot: runtimeContextSnapshot,
                    customActionExecutor: activeModuleId === "projections" ? executeProjectionAction : undefined,
                    enableUiOperator: false,
                    executionMode: "background",
                    autoApproveUiActions: false,
                });
                const normalizedPlanSource: AgentPlanSource = result.planSource;
                setPlanSource(normalizedPlanSource);
                await appendAssistantAndPersist(result.finalReply);
                const downloadAttachments = result.execution
                    .filter((step) => step.success)
                    .map((step) => extractDownloadAttachment(step.data))
                    .filter((attachment): attachment is ChatAttachmentDownload => Boolean(attachment));
                for (const attachment of downloadAttachments) {
                    await appendAssistantAndPersist(`Report ready: ${attachment.fileName}`, attachment);
                }
                const executedAnyAction = result.execution.some((step) => step.success);
                if (executedAnyAction) {
                    await appendAssistantAndPersist("Completed in background.");
                }
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

                const savedAfterRouteChange = await persistConversation(workingMessages, activeModuleId, activeRoute, workingConversationId);
                if (savedAfterRouteChange) {
                    workingConversationId = savedAfterRouteChange;
                }

                const runtimeContextSnapshot = buildPageContextSnapshot(activeRoute, activeModuleId);
                const result = await runUnifiedAgentMessage({
                    message: trimmed,
                    module: activeModuleId,
                    route: activeRoute,
                    conversation,
                    contextSnapshot: runtimeContextSnapshot,
                    customActionExecutor: activeModuleId === "projections" ? executeProjectionAction : undefined,
                    shouldStop: () => stopAgentRef.current,
                    rollbackOnStop: true,
                    autoApproveUiActions: true,
                    executionMode: "interactive",
                    onExecutionStart: closeModalForExecution,
                });

                setPlanSource(result.planSource);
                if (result.navigateTo && result.navigateTo !== activeRoute) {
                    router.push(result.navigateTo);
                }

                setIsModalOpen(true);
                await new Promise((resolve) => setTimeout(resolve, 120));
                await appendAssistantAndPersist(result.finalReply);

                const downloadAttachments = result.execution
                    .filter((step) => step.success)
                    .map((step) => extractDownloadAttachment(step.data))
                    .filter((attachment): attachment is ChatAttachmentDownload => Boolean(attachment));
                for (const attachment of downloadAttachments) {
                    await appendAssistantAndPersist(`Report ready: ${attachment.fileName}`, attachment);
                }

                const executedAnyAction = result.execution.some((step) => step.success);
                if (executedAnyAction && !/reply "confirm"|stopped by user|cancelled/i.test(result.finalReply)) {
                    await appendAssistantAndPersist("Request complete.");
                }
            }
        } catch {
            setPlanSource("fallback");
            setIsModalOpen(true);
            await appendAssistantAndPersist("Sorry, I couldn't process that. Please try again.");
        } finally {
            setIsAgentPerforming(false);
            setIsLoading(false);
            stopAgentRef.current = false;
        }
    }, [
        activeConversationId,
        agentChatMode,
        buildChatMessage,
        currentModule.id,
        executeProjectionAction,
        inputValue,
        isAgentPerforming,
        isLoading,
        messages,
        pathname,
        persistConversation,
        router,
    ]);


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
                className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-8 left-1/2 -translate-x-1/2 lg:left-[calc(50%_+_7.5rem)] lg:-translate-x-1/2 z-40 flex items-center justify-center gap-2 bg-gradient-to-r from-[#2264ff] to-[#1a4fd6] text-white px-2.5 py-1.5 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
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
                <span className="font-semibold text-sm">Chat</span>
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
                            <div className="relative m-[3px] rounded-[25px] bg-white flex flex-col" style={{ minHeight: "calc(100% - 6px)" }}>
                                {/* Header */}
                                <div className="flex items-center gap-3 px-4 sm:px-5 py-4">
                                    <h3 className="flex-1 font-semibold text-gray-900 dark:text-white text-base">
                                        {currentModule.title}
                                    </h3>
                                    <span className={`hidden lg:inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-${currentModule.color}-100 text-${currentModule.color}-700 dark:bg-${currentModule.color}-900/30 dark:text-${currentModule.color}-400`}>
                                        {currentModule.name}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#2264ff]">
                                            {agentChatMode === "full-agentic" ? "Agentic" : "Response"}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setAgentChatMode((prev) =>
                                                    prev === "response-only" ? "full-agentic" : "response-only"
                                                )
                                            }
                                            role="switch"
                                            aria-checked={agentChatMode === "full-agentic"}
                                            className="relative inline-flex h-7 w-11 items-center rounded-full transition-colors"
                                            style={{ background: "#2264ff" }}
                                            aria-label="Toggle assistant mode"
                                            title="Toggle assistant mode"
                                        >
                                            <span
                                                className={`inline-flex h-5 w-5 rounded-full bg-white transition-transform duration-300 ${agentChatMode === "full-agentic" ? "translate-x-5" : "translate-x-1"
                                                    }`}
                                            />
                                        </button>
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
                                <div className="px-4 sm:px-5 pb-3 lg:hidden">
                                    <div className="flex items-center gap-2 overflow-x-auto overflow-y-visible hide-scrollbar">
                                        <button
                                            onClick={handleStartNewChat}
                                            className="shrink-0 rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-300"
                                        >
                                            New chat
                                        </button>
                                        {conversationList.map((conversation) => (
                                            <div
                                                key={conversation.id}
                                                data-conversation-menu="true"
                                                className={`relative shrink-0 flex max-w-[180px] items-center rounded-full ${activeConversationId === conversation.id
                                                    ? "bg-gray-300 text-blue-700"
                                                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                                    }`}
                                            >
                                                <button
                                                    onClick={() => handleSelectConversation(conversation.id)}
                                                    className="min-w-0 max-w-[140px] rounded-l-full px-3 py-1 text-xs"
                                                >
                                                    <span className="block truncate">{conversation.title}</span>
                                                </button>
                                                <button
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleToggleConversationMenu(conversation.id, event.currentTarget);
                                                    }}
                                                    className="shrink-0 rounded-r-full pr-2 text-gray-500 hover:text-gray-700"
                                                    aria-label={`Chat options for ${conversation.title}`}
                                                >
                                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                                        <circle cx="6" cy="12" r="1.8" />
                                                        <circle cx="12" cy="12" r="1.8" />
                                                        <circle cx="18" cy="12" r="1.8" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    {openConversationMenuId && mobileConversationMenuPosition ? (
                                        <div
                                            data-conversation-menu="true"
                                            className="fixed z-[160] min-w-[128px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
                                            style={{ top: mobileConversationMenuPosition.top, left: mobileConversationMenuPosition.left }}
                                        >
                                            <button
                                                onClick={() => handleRenameConversation(openConversationMenuId)}
                                                className="w-full px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50"
                                            >
                                                Rename chat
                                            </button>
                                            <button
                                                onClick={() => handleDeleteConversation(openConversationMenuId)}
                                                className="w-full border-t border-gray-100 px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="flex min-h-0 flex-1">
                                    <aside className="hidden w-56 flex-col border-r border-gray-200 bg-white/70 lg:flex">
                                        <div className="border-b border-gray-200 p-3">
                                            <button
                                                onClick={handleStartNewChat}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                            >
                                                + New chat
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2">
                                            {conversationList.length === 0 ? (
                                                <p className="px-2 py-2 text-xs text-gray-500">No chat history yet.</p>
                                            ) : (
                                                conversationList.map((conversation) => (
                                                    <div
                                                        key={conversation.id}
                                                        data-conversation-menu="true"
                                                        className={`relative mb-1 w-full rounded-lg px-1 py-1 ${activeConversationId === conversation.id
                                                            ? "bg-blue-50 text-blue-700"
                                                            : "text-gray-700 hover:bg-gray-100"
                                                            }`}
                                                    >
                                                        <div className="flex min-w-0 items-start gap-1">
                                                            <button
                                                                onClick={() => handleSelectConversation(conversation.id)}
                                                                className="min-w-0 flex-1 rounded-md px-1 py-1 text-left"
                                                            >
                                                                <p className="truncate text-xs font-semibold">{conversation.title}</p>
                                                                <p className="truncate text-[11px] text-gray-500">{conversation.preview}</p>
                                                            </button>
                                                            <button
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    handleToggleConversationMenu(conversation.id, event.currentTarget);
                                                                }}
                                                                className="mt-0.5 shrink-0 rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                                                                aria-label={`Chat options for ${conversation.title}`}
                                                            >
                                                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                                                    <circle cx="6" cy="12" r="1.8" />
                                                                    <circle cx="12" cy="12" r="1.8" />
                                                                    <circle cx="18" cy="12" r="1.8" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                        {openConversationMenuId === conversation.id ? (
                                                            <div className="absolute right-1 top-9 z-30 min-w-[132px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                                                                <button
                                                                    onClick={() => handleRenameConversation(conversation.id)}
                                                                    className="w-full px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50"
                                                                >
                                                                    Rename chat
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteConversation(conversation.id)}
                                                                    className="w-full border-t border-gray-100 px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </aside>

                                    <div className="flex min-h-0 flex-1 flex-col">
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
                                                        <div className="inline-block max-w-[90%]">
                                                            <div className="px-1 py-1 text-sm leading-relaxed whitespace-pre-wrap text-gray-900">
                                                                {msg.content}
                                                            </div>
                                                            {msg.attachment?.kind === "download" && (
                                                                <a
                                                                    href={msg.attachment.url}
                                                                    download={msg.attachment.fileName}
                                                                    className="mt-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                                                >
                                                                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                                                        <path d="M10 2a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 10.586V3a1 1 0 011-1z" />
                                                                        <path d="M3 14a1 1 0 011 1v1h12v-1a1 1 0 112 0v2a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 011-1z" />
                                                                    </svg>
                                                                    Download PDF
                                                                </a>
                                                            )}
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
                                                <button
                                                    onClick={handleStartNewChat}
                                                    title="New chat"
                                                    className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                                >
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
                        </div>
                    </div>
                )
            }
        </>
    );
}
