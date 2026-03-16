"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
    automationEngine,
    EMBEDDED_FINANCE_PRODUCTS,
    generateAutomationResponse,
    generateReturnsSummary,
    type AutomationRule,
    type AutomationState,
    type EmbeddedFinanceProduct,
} from "@/lib/cashflow/automationEngine";
import {
    calculateCashflowAnalytics,
    formatNaira,
    formatPercent,
    TBILLS_RATES,
    SAVINGS_RATE,
    type CashflowAnalytics,
} from "@/lib/cashflow/investmentCalculator";
import { accountingEngine } from "@/lib/accounting/transactionBridge";
import type { JournalEntry } from "@/lib/accounting/doubleEntry";
import { SendHorizontal, Plus, Trash2, Power, TrendingUp, ArrowRight } from "lucide-react";
import { runUnifiedAgentMessage } from "@/lib/agent/unifiedClient";
import type { AgentConversationMessage } from "@/lib/agent/unifiedTypes";

// =============================================================================
// TYPES
// =============================================================================

type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
};

type CashMetricMode = "inflow" | "outflow" | "balance";

function createIntroChatMessage(): ChatMessage {
    return {
        id: "intro",
        role: "assistant",
        content:
            "Welcome to Cashflow Chat! 👋\n\nI can help you set up investment automations and track your returns. Try saying:\n\n• \"Invest 5% of my inflow in T-Bills\"\n• \"Save 10% automatically\"\n• \"What's my projected return?\"\n• \"Show my automations\"",
        timestamp: Date.now(),
    };
}

function formatNairaCompact(amount: number): string {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? "-" : "";

    const build = (divisor: number, suffix: "K" | "M" | "B") => {
        const compact = (abs / divisor).toFixed(abs / divisor >= 100 ? 0 : 1).replace(/\.0$/, "");
        return `${sign}₦${compact}${suffix}`;
    };

    if (abs >= 1_000_000_000) return build(1_000_000_000, "B");
    if (abs >= 1_000_000) return build(1_000_000, "M");
    if (abs >= 1_000) return build(1_000, "K");
    return `${sign}₦${abs.toLocaleString("en-NG", { maximumFractionDigits: 1 })}`;
}

function toMonthKey(value?: string): string {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return "";
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

function getCurrentMonthKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

function formatMonthLabel(monthKey: string): string {
    if (!monthKey) return "Selected month";
    const match = monthKey.match(/^(\d{4})-(\d{2})$/);
    if (!match) return monthKey;
    const parsed = new Date(`${match[1]}-${match[2]}-01T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return monthKey;
    return parsed.toLocaleDateString("en-NG", { month: "short", year: "numeric" });
}

// =============================================================================
// EMBEDDED FINANCE CARD COMPONENT
// =============================================================================

function EmbeddedFinanceCard({ product }: { product: EmbeddedFinanceProduct }) {
    return (
        <a
            href={product.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="snap-start flex-shrink-0 flex flex-col items-center gap-2 p-3 group"
        >
            <div
                className="w-16 h-16 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden"
            >
                <img
                    src={product.logoUrl}
                    alt={product.name}
                    className="w-16 h-16 object-cover rounded-full"
                />
            </div>
            <div className="text-center">
                <p className="text-xs font-semibold text-gray-900">{product.name}</p>
                <p className="text-[10px] text-gray-500">{product.description}</p>
                {product.annualRate && (
                    <p className="text-[10px] font-medium text-emerald-600">
                        {formatPercent(product.annualRate)} p.a.
                    </p>
                )}
            </div>
        </a>
    );
}

// =============================================================================
// AUTOMATION SLIDER COMPONENT
// =============================================================================

function AutomationSlider({
    type,
    label,
    color,
    rate,
    value,
    onChange,
    monthlyInflow,
}: {
    type: "tbills" | "savings";
    label: string;
    color: string;
    rate: number;
    value: number;
    onChange: (value: number) => void;
    monthlyInflow: number;
}) {
    const monthlyAmount = (monthlyInflow * value) / 100;
    const annualReturn = monthlyAmount * 12 * (rate / 100) * 0.5; // Average 6-month exposure

    return (
        <div className="rounded-xl p-4 bg-white border border-gray-100">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${color}20` }}
                    >
                        <TrendingUp className="w-4 h-4" style={{ color }} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-900">{label}</p>
                        <p className="text-xs text-gray-500">{formatPercent(rate)} p.a.</p>
                    </div>
                </div>
                <span
                    className="text-lg font-bold"
                    style={{ color }}
                >
                    {value}%
                </span>
            </div>

            <input
                type="range"
                min="0"
                max="30"
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: color }}
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0%</span>
                <span>15%</span>
                <span>30%</span>
            </div>

            {/* Calculation */}
            {value > 0 && monthlyInflow > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Monthly allocation</span>
                        <span className="font-medium text-gray-900">{formatNaira(monthlyAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Projected annual return</span>
                        <span className="font-medium text-emerald-600">+{formatNaira(Math.round(annualReturn))}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// ACTIVE RULES COMPONENT
// =============================================================================

function ActiveRuleCard({
    rule,
    monthlyInflow,
    onToggle,
    onDelete,
}: {
    rule: AutomationRule;
    monthlyInflow: number;
    onToggle: () => void;
    onDelete: () => void;
}) {
    const monthlyAmount = (monthlyInflow * rule.percentOfInflow) / 100;
    let rate = SAVINGS_RATE;
    if (rule.type === "tbills" && rule.tenor) {
        rate = TBILLS_RATES.find(t => t.id === rule.tenor)?.rate || 20.65;
    }

    return (
        <div className={`rounded-xl p-3 border ${rule.isActive ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <p className={`text-sm font-medium ${rule.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                        {rule.name}
                    </p>
                    <p className="text-xs text-gray-500">
                        {formatNaira(monthlyAmount)}/mo • {formatPercent(rate)} p.a.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onToggle}
                        className={`p-1.5 rounded-lg transition-colors ${rule.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-400'}`}
                    >
                        <Power className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-1.5 rounded-lg bg-rose-100 text-rose-500 hover:bg-rose-200 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function CashflowChatPage() {
    // State
    const [messages, setMessages] = useState<ChatMessage[]>(() => [createIntroChatMessage()]);
    const [composerInput, setComposerInput] = useState("");
    const [automationState, setAutomationState] = useState<AutomationState | null>(null);
    const [analytics, setAnalytics] = useState<CashflowAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [cashMetricMode, setCashMetricMode] = useState<CashMetricMode>("inflow");
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey);
    const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

    // Quick automation sliders
    const [tbillsPercent, setTbillsPercent] = useState(0);
    const [savingsPercent, setSavingsPercent] = useState(0);

    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const chatEndRef = useRef<HTMLDivElement | null>(null);
    const monthPickerRef = useRef<HTMLDivElement | null>(null);

    // Load data
    const loadData = useCallback(() => {
        setLoading(true);

        // Load automation engine
        automationEngine.load();
        setAutomationState(automationEngine.getState());

        // Load analytics from accounting
        try {
            accountingEngine.load();
            const accountingState = accountingEngine.getState();
            setJournalEntries(accountingState.journalEntries.filter((entry) => entry.status === "posted"));
            const statements = accountingEngine.generateStatements();
            const cashBalance = statements.assets || 0;
            const monthlyInflow = statements.revenue || 0;
            const monthlyOutflow = (statements.costOfSales || 0) + (statements.operatingExpenses || 0);

            const today = new Date();
            const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

            const result = calculateCashflowAnalytics(
                cashBalance,
                monthlyInflow,
                monthlyOutflow,
                monthAgo.toISOString().split("T")[0],
                today.toISOString().split("T")[0]
            );
            setAnalytics(result);
        } catch {
            setAnalytics(calculateCashflowAnalytics(0, 0, 0, "", ""));
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        // Defer load
        if (typeof window !== 'undefined') {
            if ('requestIdleCallback' in window) {
                (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(loadData);
            } else {
                setTimeout(loadData, 0);
            }
        }
    }, [loadData]);

    // Subscribe to automation engine
    useEffect(() => {
        const unsubscribe = automationEngine.subscribe((state) => {
            setAutomationState(state);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const unsubscribe = accountingEngine.subscribe((state) => {
            setJournalEntries(state.journalEntries.filter((entry) => entry.status === "posted"));
        });
        return () => unsubscribe();
    }, []);

    // Auto-expand textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            const nextHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 24), 150);
            textareaRef.current.style.height = `${nextHeight}px`;
        }
    }, [composerInput]);

    // Scroll to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Append message helper
    const appendMessage = useCallback((role: ChatMessage["role"], content: string) => {
        setMessages((prev) => [
            ...prev,
            {
                id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                role,
                content,
                timestamp: Date.now(),
            },
        ]);
    }, []);

    // Handle send message
    const handleSendMessage = useCallback(async () => {
        const trimmed = composerInput.trim();
        if (!trimmed) return;

        appendMessage("user", trimmed);
        setComposerInput("");

        try {
            const conversation: AgentConversationMessage[] = [...messages, { role: "user" as const, content: trimmed }]
                .slice(-12)
                .map((item) => ({
                    role: item.role === "assistant" ? "assistant" : "user",
                    content: item.content,
                }));
            const result = await runUnifiedAgentMessage({
                message: trimmed,
                module: "cashflow",
                route: "/cashflow-intelligence/chat",
                conversation,
            });
            appendMessage("assistant", result.finalReply);
            return;
        } catch {
            // Fallback to existing local cashflow chat logic.
        }

        const monthlyInflow = analytics?.monthlyInflow || 0;
        const msg = trimmed.toLowerCase();

        // Check for automation creation
        const parsedRule = automationEngine.parseAutomationFromChat(trimmed);
        if (parsedRule && parsedRule.percentOfInflow) {
            const rule = automationEngine.addRule(parsedRule as Omit<AutomationRule, 'id' | 'createdAt'>);
            const response = generateAutomationResponse(rule, monthlyInflow);
            appendMessage("assistant", response);
            return;
        }

        // Check for returns query
        if (msg.includes("return") || msg.includes("earning") || msg.includes("projection")) {
            const rules = automationState?.rules || [];
            const response = generateReturnsSummary(rules, monthlyInflow);
            appendMessage("assistant", response);
            return;
        }

        // Check for show automations
        if (msg.includes("automation") || msg.includes("rules") || msg.includes("show")) {
            const rules = automationState?.rules || [];
            if (rules.length === 0) {
                appendMessage("assistant", "You don't have any automations set up yet. Try saying \"Invest 5% in T-Bills\" or \"Save 10% automatically\".");
            } else {
                const activeCount = rules.filter(r => r.isActive).length;
                const response = `📋 **Your Automations**\n\nYou have ${rules.length} rule${rules.length !== 1 ? 's' : ''} (${activeCount} active):\n\n${rules.map(r => `• ${r.name} - ${r.isActive ? '✅ Active' : '⏸️ Paused'}`).join('\n')}`;
                appendMessage("assistant", response);
            }
            return;
        }

        // Check for cashflow query
        if (msg.includes("cashflow") || msg.includes("balance") || msg.includes("inflow") || msg.includes("outflow")) {
            if (analytics) {
                const response = `💰 **Your Cashflow Summary**\n\n• Cash Balance: ${formatNaira(analytics.cashBalance)}\n• Monthly Inflow: ${formatNaira(analytics.monthlyInflow)}\n• Monthly Outflow: ${formatNaira(analytics.monthlyOutflow)}\n• Net Cashflow: ${formatNaira(analytics.netCashflow)}\n• Cash Runway: ${analytics.runwayMonths === 999 ? '∞ months (sustainable)' : `${analytics.runwayMonths} months`}`;
                appendMessage("assistant", response);
            } else {
                appendMessage("assistant", "I couldn't load your cashflow data. Make sure you have transactions recorded in Accounting Studio.");
            }
            return;
        }

        // Default response
        appendMessage("assistant", "I can help you with:\n\n• **Set up automations**: \"Invest 5% in T-Bills\", \"Save 10% automatically\"\n• **Check returns**: \"What's my projected return?\"\n• **View automations**: \"Show my automations\"\n• **Cashflow summary**: \"Show my cashflow\"\n\nTry one of these commands!");
    }, [appendMessage, composerInput, analytics, automationState, messages]);

    // Add quick automation
    const handleQuickAutomation = (type: "tbills" | "savings", percent: number) => {
        if (percent <= 0) return;

        const rule = automationEngine.addRule({
            name: type === "tbills" ? `Invest ${percent}% in 364-day T-Bills` : `Save ${percent}% automatically`,
            type,
            percentOfInflow: percent,
            tenor: type === "tbills" ? "364-day" : undefined,
            isActive: true,
        });

        appendMessage("assistant", generateAutomationResponse(rule, analytics?.monthlyInflow || 0));

        // Reset slider
        if (type === "tbills") setTbillsPercent(0);
        else setSavingsPercent(0);
    };

    const canSend = composerInput.trim().length > 0;
    const rules = automationState?.rules || [];
    const cashMetricLabelMap: Record<CashMetricMode, string> = {
        inflow: "Inflow",
        outflow: "Outflow",
        balance: "Balance",
    };
    const selectedMonthLabel = useMemo(() => formatMonthLabel(selectedMonth), [selectedMonth]);
    const monthlyCashMetrics = useMemo(() => {
        let inflow = 0;
        let outflow = 0;

        journalEntries.forEach((entry) => {
            if (toMonthKey(entry.date || entry.createdAt) !== selectedMonth) return;
            entry.lines.forEach((line) => {
                const isCashAccount = line.accountCode.startsWith("10") || /cash|bank/i.test(line.accountName);
                if (!isCashAccount) return;
                inflow += line.debit || 0;
                outflow += line.credit || 0;
            });
        });

        return {
            inflow,
            outflow,
            balance: inflow - outflow,
        };
    }, [journalEntries, selectedMonth]);
    const cashMetricValueMap = useMemo(() => ({
        inflow: monthlyCashMetrics.inflow,
        outflow: monthlyCashMetrics.outflow,
        balance: monthlyCashMetrics.balance,
    }), [monthlyCashMetrics]);
    const displayedCashMetric = cashMetricValueMap[cashMetricMode];

    const cycleCashMetricMode = useCallback(() => {
        setCashMetricMode((prev) => {
            if (prev === "inflow") return "outflow";
            if (prev === "outflow") return "balance";
            return "inflow";
        });
    }, []);

    useEffect(() => {
        if (!isMonthPickerOpen) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (!monthPickerRef.current) return;
            if (!monthPickerRef.current.contains(event.target as Node)) {
                setIsMonthPickerOpen(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsMonthPickerOpen(false);
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [isMonthPickerOpen]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-pulse text-gray-500">Loading Cashflow Chat...</div>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-6 pb-32">
                <main className="px-3 space-y-4">
                    {/* Inflow Display */}
                    {analytics && (
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-medium text-gray-500 mb-0.5">{cashMetricLabelMap[cashMetricMode]}</p>
                                <div className="flex items-center gap-2">
                                    <p className="text-2xl font-bold text-blue-500" style={{ color: "#2264ff" }} title={formatNaira(displayedCashMetric)}>
                                        {formatNairaCompact(displayedCashMetric)}
                                    </p>
                                    <div className="relative" ref={monthPickerRef}>
                                        <button
                                            type="button"
                                            onClick={() => setIsMonthPickerOpen((open) => !open)}
                                            className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-2 py-1 text-sm font-normal text-gray-500 hover:bg-gray-50"
                                            aria-haspopup="dialog"
                                            aria-expanded={isMonthPickerOpen}
                                            title={`Select month (currently ${selectedMonthLabel})`}
                                        >
                                            /mo
                                            <svg
                                                viewBox="0 0 20 20"
                                                className={`h-3 w-3 transition-transform ${isMonthPickerOpen ? "rotate-180" : ""}`}
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                aria-hidden="true"
                                            >
                                                <path d="m5 7 5 6 5-6" />
                                            </svg>
                                        </button>
                                        {isMonthPickerOpen ? (
                                            <div className="absolute left-0 z-20 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                                                <p className="mb-2 text-xs font-medium text-gray-700">Select month</p>
                                                <input
                                                    type="month"
                                                    value={selectedMonth}
                                                    onChange={(event) => setSelectedMonth(event.target.value || getCurrentMonthKey())}
                                                    className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#2264ff]/30"
                                                />
                                                <div className="mt-3 flex items-center justify-between">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedMonth(getCurrentMonthKey())}
                                                        className="text-xs font-medium text-blue-600 hover:text-blue-700"
                                                    >
                                                        This month
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsMonthPickerOpen(false)}
                                                        className="text-xs text-gray-500 hover:text-gray-700"
                                                    >
                                                        Close
                                                    </button>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                                <p className="mt-1 text-xs text-gray-400">For {selectedMonthLabel}</p>
                            </div>
                            <button
                                type="button"
                                onClick={cycleCashMetricMode}
                                className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#2264ff] text-white shadow-sm transition hover:bg-[#1a50cc] focus:outline-none focus:ring-2 focus:ring-[#2264ff]/40"
                                aria-label="Toggle cash metric"
                                title="Switch between Inflow, Outflow and Balance"
                            >
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    )}

                    {/* Embedded Finance Products - Horizontal Scroll */}
                    <div className="rounded-2xl overflow-hidden">
                        <div className="py-2">
                            <h3 className="text-sm font-semibold text-gray-900">Embedded Finance</h3>
                            <p className="text-xs text-gray-500">Explore investment products</p>
                        </div>
                        <div className="-mx-3 overflow-x-auto hide-scrollbar snap-x snap-mandatory">
                            <div className="flex min-w-max gap-1 py-2 pr-3">
                                {EMBEDDED_FINANCE_PRODUCTS.map((product) => (
                                    <EmbeddedFinanceCard key={product.id} product={product} />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Quick Automation Sliders */}
                    <div className="rounded-2xl overflow-hidden">
                        <div className="py-2">
                            <h3 className="text-sm font-semibold text-gray-900">Quick Automation Setup</h3>
                            <p className="text-xs text-gray-500">Drag to set allocation, then tap to activate</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <AutomationSlider
                                    type="tbills"
                                    label="T-Bills (364-day)"
                                    color="#7c3aed"
                                    rate={20.65}
                                    value={tbillsPercent}
                                    onChange={setTbillsPercent}
                                    monthlyInflow={analytics?.monthlyInflow || 0}
                                />
                                {tbillsPercent > 0 && (
                                    <button
                                        onClick={() => handleQuickAutomation("tbills", tbillsPercent)}
                                        className="w-full py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors"
                                    >
                                        Activate T-Bills Automation
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2">
                                <AutomationSlider
                                    type="savings"
                                    label="Savings Account"
                                    color="#3b82f6"
                                    rate={SAVINGS_RATE}
                                    value={savingsPercent}
                                    onChange={setSavingsPercent}
                                    monthlyInflow={analytics?.monthlyInflow || 0}
                                />
                                {savingsPercent > 0 && (
                                    <button
                                        onClick={() => handleQuickAutomation("savings", savingsPercent)}
                                        className="w-full py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                                    >
                                        Activate Savings Automation
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Active Rules */}
                    {rules.length > 0 && (
                        <div className="rounded-2xl overflow-hidden">
                            <div className="py-2">
                                <h3 className="text-sm font-semibold text-gray-900">Active Automations</h3>
                                <p className="text-xs text-gray-500">{rules.filter(r => r.isActive).length} of {rules.length} active</p>
                            </div>
                            <div className="p-2 space-y-2">
                                {rules.map((rule) => (
                                    <ActiveRuleCard
                                        key={rule.id}
                                        rule={rule}
                                        monthlyInflow={analytics?.monthlyInflow || 0}
                                        onToggle={() => automationEngine.toggleRule(rule.id)}
                                        onDelete={() => automationEngine.deleteRule(rule.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}


                </main>
            </div>
        </>
    );
}
