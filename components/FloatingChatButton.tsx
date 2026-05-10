"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { accountingEngine } from "@/lib/accounting/transactionBridge";
import { taxEngine } from "@/lib/tax/taxEngine";
import { walletEngine } from "@/lib/wallet/walletEngine";
import { calculateCashPosition, calculateCashflowMetrics } from "@/lib/cashflow/cashflowEngine";
import { loadBudgetingState } from "@/lib/budgeting/store";
import { payrollEngine } from "@/lib/payroll/payrollEngine";
import {
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
        name: "Bace",
        title: "Bace Assistant",
        placeholder: "Ask Bace...",
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
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isAgentPerforming, setIsAgentPerforming] = useState(false);
    const [, setPlanSource] = useState<AgentPlanSource>("fallback");
    const [agentChatMode, setAgentChatMode] = useState<AgentChatMode>("response-only");
    const [clarificationData, setClarificationData] = useState<ClarificationData | null>(null);
    const [conversationList, setConversationList] = useState<ChatConversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [openConversationMenuId, setOpenConversationMenuId] = useState<string | null>(null);
    const [mobileConversationMenuPosition, setMobileConversationMenuPosition] = useState<{ top: number; left: number } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const chatSectionRef = useRef<HTMLElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const stopAgentRef = useRef(false);
    const blobUrlsRef = useRef<string[]>([]);
    const shouldAutoScrollRef = useRef(false);

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

    const queueAutoScroll = useCallback(() => {
        shouldAutoScrollRef.current = true;
    }, []);

    const focusComposer = useCallback((delay = 120) => {
        if (typeof window === "undefined") return;
        window.setTimeout(() => textareaRef.current?.focus(), delay);
    }, []);

    const revealChatSection = useCallback((options?: { focus?: boolean; behavior?: ScrollBehavior }) => {
        if (typeof window === "undefined") return;
        const behavior = options?.behavior ?? "smooth";
        window.requestAnimationFrame(() => {
            chatSectionRef.current?.scrollIntoView({ behavior, block: "start" });
        });
        if (options?.focus) {
            focusComposer(180);
        }
    }, [focusComposer]);

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
        revealChatSection({ focus: true });
    }, [currentModule, pathname, refreshConversationList, revealChatSection, revokeBlobUrls]);

    const handleSelectConversation = useCallback(async (conversationId: string) => {
        const conversation = (await getChatConversationAsync(conversationId)) || getChatConversation(conversationId);
        if (!conversation) return;
        setOpenConversationMenuId(null);
        setMobileConversationMenuPosition(null);
        if (conversation.route && conversation.route !== pathname) {
            selectChatConversation(conversation.id);
            router.push(conversation.route);
            return;
        }
        const moduleConfig = getModuleFromPath(conversation.route || pathname);
        setCurrentModule(moduleConfig);
        openConversation(conversation, moduleConfig, conversation.route || pathname);
        queueAutoScroll();
        revealChatSection({ focus: true });
    }, [openConversation, pathname, queueAutoScroll, revealChatSection, router]);

    const handleToggleConversationMenu = useCallback((conversationId: string, trigger?: HTMLElement | null) => {
        const menuWidth = 132;
        const viewportPadding = 8;
        setOpenConversationMenuId((current) => {
            const next = current === conversationId ? null : conversationId;
            if (!next) {
                setMobileConversationMenuPosition(null);
                return null;
            }

            if (trigger && typeof window !== "undefined") {
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
                    queueAutoScroll();
                    revealChatSection({ focus: true });
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
                queueAutoScroll();
                revealChatSection({ focus: !selected.response });
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
    }, [openConversation, pathname, queueAutoScroll, revealChatSection, revokeBlobUrls]);

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

            revealChatSection({ focus: true });
        };

        window.addEventListener(CHAT_MODAL_OPEN_EVENT, handleExternalChatOpen as EventListener);
        return () => {
            window.removeEventListener(CHAT_MODAL_OPEN_EVENT, handleExternalChatOpen as EventListener);
        };
    }, [pathname, revealChatSection]);

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
                    queueAutoScroll();
                    revealChatSection({ focus: true });
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
            queueAutoScroll();
            revealChatSection({ focus: !selected.response });
        };

        window.addEventListener(CHAT_HISTORY_SELECTED_EVENT, handleHistorySelection as EventListener);
        return () => {
            window.removeEventListener(CHAT_HISTORY_SELECTED_EVENT, handleHistorySelection as EventListener);
        };
    }, [openConversation, pathname, queueAutoScroll, refreshConversationList, revealChatSection]);

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
        if (!shouldAutoScrollRef.current) return;
        shouldAutoScrollRef.current = false;
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Inject clarification messages into the inline thread and bring the chat into view.
    useEffect(() => {
        if (!clarificationData) return;

        const { transaction } = clarificationData;
        const clarificationMsg = `Pls clarify transaction\n\n**Details:**\nAmount: ₦${transaction.amount.toLocaleString()}\nDate: ${transaction.date}\nDesc: ${transaction.description}\nBank: ${transaction.bankName}\n\nI need more context to categorise this correctly. What was this for?`;

        queueAutoScroll();
        revealChatSection({ focus: true });
        setMessages((prev) => {
            if (prev[prev.length - 1]?.content === clarificationMsg) {
                return prev;
            }
            return [
                ...prev,
                {
                    id: `clarify-${Date.now()}`,
                    role: "assistant",
                    content: clarificationMsg,
                    timestamp: Date.now(),
                },
            ];
        });
        setClarificationData(null);
    }, [clarificationData, queueAutoScroll, revealChatSection]);

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
        queueAutoScroll();
        revealChatSection();

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
                setPlanSource(result.planSource);
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
                const announceExecutionStart = () => {
                    queueAutoScroll();
                    revealChatSection();
                };

                const preferredRoute = resolvePreferredAgentRoute(trimmed, pathname);
                if (preferredRoute && preferredRoute !== pathname) {
                    activeRoute = preferredRoute;
                    activeModuleId = getModuleFromPath(preferredRoute).id;
                    router.push(preferredRoute);
                    await new Promise((resolve) => setTimeout(resolve, 850));
                    announceExecutionStart();
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
                    onExecutionStart: announceExecutionStart,
                });

                setPlanSource(result.planSource);
                if (result.navigateTo && result.navigateTo !== activeRoute) {
                    router.push(result.navigateTo);
                }

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
        queueAutoScroll,
        revealChatSection,
        router,
    ]);


    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (isAgentPerforming) return;
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const visibleMessages = messages.filter((message) => message.id !== "intro");
    const isEmptyConversation = visibleMessages.length === 0;
    const currentPageProfile = getPageAssistantProfile(pathname);

    const handleExampleClick = (example: string) => {
        const cleanedExample = example.replace(/^"(.*)"$/, "$1");
        setInputValue(cleanedExample);
        revealChatSection({ focus: true });
    };

    return (
        <section ref={chatSectionRef} className="sticky top-[4.75rem] scroll-mt-24 lg:top-24">
            <div className="flex h-[calc(100dvh-7.5rem)] min-h-[26rem] flex-col lg:h-[calc(100vh-8rem)]">
                <div className="px-0 pt-1 pb-2 sm:py-3">
                    <div className="flex items-center gap-2 overflow-x-auto overflow-y-visible pb-1 hide-scrollbar">
                        <button
                            onClick={handleStartNewChat}
                            className="shrink-0 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100"
                        >
                            New chat
                        </button>
                        {conversationList.map((conversation) => (
                            <div
                                key={conversation.id}
                                data-conversation-menu="true"
                                className={`relative shrink-0 flex max-w-[170px] items-center rounded-full transition-colors sm:max-w-[190px] ${
                                    activeConversationId === conversation.id
                                        ? "bg-[#eefbd9] text-[#446b00]"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                            >
                                <button
                                    onClick={() => handleSelectConversation(conversation.id)}
                                    className="min-w-0 max-w-[128px] rounded-l-full px-3 py-2 text-[11px] font-medium sm:max-w-[148px] sm:px-3.5 sm:text-xs"
                                >
                                    <span className="block truncate">{conversation.title}</span>
                                </button>
                                <button
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        handleToggleConversationMenu(conversation.id, event.currentTarget);
                                    }}
                                    className="shrink-0 rounded-r-full pr-2.5 text-gray-500 hover:text-gray-700"
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
                </div>

                <div className="min-h-0 flex-1 overflow-hidden py-0">
                    <div className="h-full overflow-y-auto pt-0 pb-2 pr-1 sm:py-4 lg:py-8 lg:pr-2">
                        {isEmptyConversation ? (
                            <div className="mx-auto flex h-full min-h-[20rem] max-w-3xl items-center justify-center py-6 text-center lg:min-h-[24rem]">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">
                                        Page-aware assistant for {currentPageProfile.label}
                                    </p>
                                    <h3 className="mt-3 text-3xl font-semibold tracking-tight text-[#1f1f1f] sm:text-4xl">
                                        What do you want to work on?
                                    </h3>
                                    <p className="mt-4 text-sm leading-7 text-gray-500 sm:text-[15px]">
                                        {currentModule.greeting} I stay inside this page now, keep your horizontal chat history,
                                        and can still execute cross-page tasks when needed.
                                    </p>
                                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                                        {currentModule.examples.map((example) => (
                                            <button
                                                key={example}
                                                type="button"
                                                onClick={() => handleExampleClick(example)}
                                                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
                                            >
                                                {example.replace(/^"(.*)"$/, "$1")}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="mx-auto -mt-2 max-w-4xl space-y-5 sm:mt-0 sm:space-y-8">
                                {visibleMessages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                    >
                                        {msg.role === "user" ? (
                                            <div className="max-w-[min(100%,42rem)] rounded-[28px] bg-gray-200 px-4 py-2.5 text-[14px] leading-6 text-gray-800">
                                                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                                            </div>
                                        ) : (
                                            <div className="max-w-[min(100%,46rem)]">
                                                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                                                    Bace AI
                                                </div>
                                                <div className="whitespace-pre-wrap break-words text-[14px] leading-6 text-[#1f2328] sm:leading-7">
                                                    {msg.content}
                                                </div>
                                                {msg.attachment?.kind === "download" && (
                                                    <a
                                                        href={msg.attachment.url}
                                                        download={msg.attachment.fileName}
                                                        className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#d7f4a6] bg-[#eefbd9] px-4 py-2 text-xs font-semibold text-[#446b00] transition-colors hover:bg-[#e6f7c5]"
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
                            </div>
                        )}

                        {isLoading && (
                            <div className="mx-auto mt-6 flex max-w-4xl justify-start">
                                <div className="flex items-center gap-1 rounded-full bg-gray-100 px-4 py-2">
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>
                </div>

                <div className="sticky bottom-0 bg-[var(--app-bg)]/96 pt-5 pb-0 backdrop-blur-md sm:py-3">
                    <div className="mx-auto max-w-4xl">
                        <div className="rounded-[30px] border border-gray-200 bg-white px-3 pb-3 pt-5">
                            <textarea
                                ref={textareaRef}
                                rows={1}
                                placeholder={currentModule.placeholder}
                                className="min-h-[48px] w-full resize-none border-none bg-transparent px-1.5 py-1.5 text-[15px] leading-7 text-[#1f2328] placeholder:text-gray-400 focus:outline-none"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />

                            <div className="mt-3 px-1 pt-1">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleStartNewChat}
                                        className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-200 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs"
                                    >
                                        <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                        </svg>
                                        New chat
                                    </button>
                                    <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1.5 sm:gap-2 sm:px-3 sm:py-2">
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-600 sm:text-[11px]">
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
                                            className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors sm:h-6 sm:w-10"
                                            style={{ background: agentChatMode === "full-agentic" ? "#8fff00" : "#d1d5db" }}
                                            aria-label="Toggle assistant mode"
                                            title="Toggle assistant mode"
                                        >
                                            <span
                                                className={`inline-flex h-4 w-4 rounded-full bg-white transition-transform duration-300 sm:h-[18px] sm:w-[18px] ${agentChatMode === "full-agentic" ? "translate-x-4 sm:translate-x-5" : "translate-x-1"}`}
                                            />
                                        </button>
                                    </div>
                                    </div>
                                    <button
                                        onClick={isAgentPerforming ? handleStopAgent : handleSend}
                                        disabled={isAgentPerforming ? false : !inputValue.trim() || isLoading}
                                        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all sm:h-11 sm:w-11 ${
                                            isAgentPerforming
                                                ? "bg-red-50 text-red-600 hover:bg-red-100"
                                                : "bg-[#8fff00] text-[#101010] shadow-[0_14px_35px_rgba(143,255,0,0.22)] hover:bg-[#7fe000] disabled:cursor-not-allowed disabled:bg-[#d8d3cb] disabled:text-white/75 disabled:shadow-none"
                                        }`}
                                        title={isAgentPerforming ? "Stop agent" : "Send"}
                                    >
                                        {isAgentPerforming ? (
                                            <span className="h-3.5 w-3.5 rounded-sm bg-red-500" />
                                        ) : (
                                            <svg className="h-4.5 w-4.5 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {openConversationMenuId && mobileConversationMenuPosition ? (
                    <div
                        data-conversation-menu="true"
                        className="fixed z-[160] min-w-[132px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.14)]"
                        style={{ top: mobileConversationMenuPosition.top, left: mobileConversationMenuPosition.left }}
                    >
                        <button
                            onClick={() => handleRenameConversation(openConversationMenuId)}
                            className="w-full px-3 py-2.5 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                        >
                            Rename chat
                        </button>
                        <button
                            onClick={() => handleDeleteConversation(openConversationMenuId)}
                            className="w-full border-t border-gray-100 px-3 py-2.5 text-left text-xs font-medium text-[#cf3f3f] transition-colors hover:bg-[#fff2f2]"
                        >
                            Delete
                        </button>
                    </div>
                ) : null}
            </div>
        </section>
    );
}
