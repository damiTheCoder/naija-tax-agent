"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import { SendHorizontal, Plus, Trash2, Power, TrendingUp } from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
};

// =============================================================================
// EMBEDDED FINANCE CARD COMPONENT
// =============================================================================

function EmbeddedFinanceCard({ product }: { product: EmbeddedFinanceProduct }) {
    return (
        <a
            href={product.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 flex flex-col items-center gap-2 p-3 group"
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
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [composerInput, setComposerInput] = useState("");
    const [automationState, setAutomationState] = useState<AutomationState | null>(null);
    const [analytics, setAnalytics] = useState<CashflowAnalytics | null>(null);
    const [loading, setLoading] = useState(true);

    // Quick automation sliders
    const [tbillsPercent, setTbillsPercent] = useState(0);
    const [savingsPercent, setSavingsPercent] = useState(0);

    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const chatEndRef = useRef<HTMLDivElement | null>(null);

    // Load data
    const loadData = useCallback(() => {
        setLoading(true);

        // Load automation engine
        automationEngine.load();
        setAutomationState(automationEngine.getState());

        // Load analytics from accounting
        try {
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

    // Initial message
    useEffect(() => {
        if (messages.length === 0) {
            setMessages([
                {
                    id: "intro",
                    role: "assistant",
                    content: "Welcome to Cashflow Chat! 👋\n\nI can help you set up investment automations and track your returns. Try saying:\n\n• \"Invest 5% of my inflow in T-Bills\"\n• \"Save 10% automatically\"\n• \"What's my projected return?\"\n• \"Show my automations\"",
                    timestamp: Date.now(),
                },
            ]);
        }
    }, [messages.length]);

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
    const handleSendMessage = useCallback(() => {
        const trimmed = composerInput.trim();
        if (!trimmed) return;

        appendMessage("user", trimmed);
        setComposerInput("");

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
    }, [appendMessage, composerInput, analytics, automationState]);

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
                {/* Header */}
                <header className="px-3 md:px-4 py-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Cashflow Chat</p>
                            <p className="text-sm text-gray-500">Set up automations and track your investment returns</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="px-3 py-1 rounded-md bg-emerald-50 text-emerald-600 font-medium">
                                {rules.filter(r => r.isActive).length} active rules
                            </span>
                        </div>
                    </div>
                </header>

                <main className="max-w-4xl mx-auto px-2 md:px-4 space-y-4">
                    {/* Embedded Finance Products - Horizontal Scroll */}
                    <div className="rounded-2xl overflow-hidden">
                        <div className="px-3 py-2">
                            <h3 className="text-sm font-semibold text-gray-900">Embedded Finance</h3>
                            <p className="text-xs text-gray-500">Explore investment products</p>
                        </div>
                        <div className="overflow-x-auto hide-scrollbar">
                            <div className="flex gap-1 px-2 py-2 min-w-max">
                                {EMBEDDED_FINANCE_PRODUCTS.map((product) => (
                                    <EmbeddedFinanceCard key={product.id} product={product} />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Inflow Display */}
                    {analytics && (
                        <div className="px-3">
                            <p className="text-2xl font-semibold text-gray-900">
                                Inflow: <span className="text-green-500">{formatNaira(analytics.monthlyInflow)}</span><span className="text-sm text-gray-500 font-normal">/mo</span>
                            </p>
                        </div>
                    )}

                    {/* Quick Automation Sliders */}
                    <div className="rounded-2xl overflow-hidden">
                        <div className="px-3 py-2">
                            <h3 className="text-sm font-semibold text-gray-900">Quick Automation Setup</h3>
                            <p className="text-xs text-gray-500">Drag to set allocation, then tap to activate</p>
                        </div>
                        <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-3">
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
                            <div className="px-3 py-2">
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

                    {/* Chat Messages */}
                    <div className="rounded-2xl overflow-hidden">
                        <div className="px-3 py-2">
                            <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Conversation</p>
                        </div>
                        <div className="p-2 space-y-3 max-h-[400px] overflow-y-auto">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed border whitespace-pre-wrap ${msg.role === "user"
                                            ? "bg-indigo-50 border-indigo-100 text-indigo-900"
                                            : "bg-slate-50 border-slate-200 text-slate-800"
                                            }`}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                    </div>
                </main>
            </div>

            {/* Fixed Bottom Composer */}
            <div className="fixed bottom-4 left-0 right-0 lg:left-[252px] z-40 px-4 sm:px-6 pointer-events-none">
                <div className="mx-auto w-full max-w-3xl">
                    <div className="pointer-events-auto flex items-end gap-2 rounded-[32px] bg-[#e5e5e5] px-3 py-1.5 shadow-lg transition-all">
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            placeholder="Ask about automations, returns, or set up a new rule..."
                            className="flex-1 bg-transparent border-none text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none resize-none py-2.5 min-h-[44px] ml-1"
                            value={composerInput}
                            onChange={(e) => setComposerInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                        />
                        <button
                            className={`w-9 h-9 rounded-full flex items-center justify-center mb-0.5 transition-all ${canSend ? "bg-white text-[#64B5F6] shadow-sm" : "bg-white/50 text-[#64B5F6] opacity-50 cursor-not-allowed"
                                }`}
                            onClick={handleSendMessage}
                            disabled={!canSend}
                        >
                            <SendHorizontal className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
