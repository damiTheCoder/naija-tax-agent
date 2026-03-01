"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
    calculateCashflowAnalytics,
    formatNaira,
    type CashflowAnalytics,
} from "@/lib/cashflow/investmentCalculator";
import { accountingEngine, type AccountingState } from "@/lib/accounting/transactionBridge";

// =============================================================================
// CASH INTELLIGENCE PAGE - Standalone Analytics & Investment Modelling
// =============================================================================

const CASH_ACCOUNT_CODES = new Set(["1000", "1010", "1020", "1021"]);

function KpiCard({ label, value, hint, accent }: { label: string; value: string; hint: string; accent: string }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 min-w-0">
            <p className={`text-xs font-semibold uppercase tracking-wide ${accent}`}>{label}</p>
            <p className="mt-3 text-lg sm:text-xl font-semibold text-gray-900 leading-tight break-words">{value}</p>
            <p className="text-xs text-gray-500 mt-2">{hint}</p>
        </div>
    );
}

export default function CashIntelligencePage() {
    const [accountingState, setAccountingState] = useState<AccountingState | null>(null);
    const [analytics, setAnalytics] = useState<CashflowAnalytics | null>(null);

    const buildAnalyticsFromState = useCallback((state: AccountingState): CashflowAnalytics => {
        let cashBalance = 0;
        CASH_ACCOUNT_CODES.forEach((code) => {
            const account = state.ledgerAccounts.get(code);
            cashBalance += account?.closingBalance || 0;
        });

        const today = new Date();
        const start = new Date(today);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - 29);

        let monthlyInflow = 0;
        let monthlyOutflow = 0;
        state.journalEntries.forEach((entry) => {
            const entryDate = new Date(`${entry.date}T00:00:00`);
            if (entryDate < start || entryDate > today) return;
            entry.lines.forEach((line) => {
                if (!CASH_ACCOUNT_CODES.has(line.accountCode)) return;
                if (line.debit > 0) monthlyInflow += line.debit;
                if (line.credit > 0) monthlyOutflow += line.credit;
            });
        });

        return calculateCashflowAnalytics(
            cashBalance,
            monthlyInflow,
            monthlyOutflow,
            start.toISOString().split("T")[0],
            today.toISOString().split("T")[0]
        );
    }, []);

    const syncFromEngine = useCallback((reload = false) => {
        if (reload) {
            accountingEngine.load();
        }
        const state = accountingEngine.getState();
        const snapshot: AccountingState = {
            ...state,
            journalEntries: [...state.journalEntries],
            ledgerAccounts: new Map(state.ledgerAccounts),
        };
        setAccountingState(snapshot);
        setAnalytics(buildAnalyticsFromState(snapshot));
    }, [buildAnalyticsFromState]);

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            syncFromEngine(true);
        });
        const unsubscribe = accountingEngine.subscribe(() => syncFromEngine());

        const onAccountingUpdate = () => {
            syncFromEngine(true);
        };

        if (typeof window !== "undefined") {
            window.addEventListener("accounting-update", onAccountingUpdate);
        }

        return () => {
            window.cancelAnimationFrame(frame);
            unsubscribe();
            if (typeof window !== "undefined") {
                window.removeEventListener("accounting-update", onAccountingUpdate);
            }
        };
    }, [syncFromEngine]);

    const loadAnalytics = useCallback(() => {
        syncFromEngine(true);
    }, [syncFromEngine]);

    const formatNairaCompact = useCallback((amount: number): string => {
        const safe = Number.isFinite(amount) ? amount : 0;
        const abs = Math.abs(safe);
        const sign = safe < 0 ? "-" : "";
        if (abs >= 1_000_000_000_000) {
            return `${sign}₦${(abs / 1_000_000_000_000).toFixed(1).replace(/\.0$/, "")}T`;
        }
        if (abs >= 1_000_000_000) {
            return `${sign}₦${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
        }
        if (abs >= 1_000_000) {
            return `${sign}₦${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
        }
        return `${sign}${formatNaira(abs)}`;
    }, []);

    // Build 30-day receipt vs payment bars from accounting engine
    const cashBarData = useMemo(() => {
        const entries = accountingState?.journalEntries ?? [];
        const dailyFlows = new Map<string, { receipts: number; payments: number; txCount: number }>();

        // Initialize last 30 days
        const today = analytics?.periodEnd ? new Date(analytics.periodEnd) : new Date();
        for (let i = 29; i >= 0; i--) {
            const d = new Date(today);
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            dailyFlows.set(dateStr, { receipts: 0, payments: 0, txCount: 0 });
        }

        // Process entries: debit cash = receipt (inflow), credit cash = payment (outflow)
        entries.forEach(entry => {
            const dateStr = entry.date;
            const bucket = dailyFlows.get(dateStr);
            if (!bucket) return;

            entry.lines.forEach(line => {
                if (!CASH_ACCOUNT_CODES.has(line.accountCode)) return;
                if (line.debit > 0) bucket.receipts += line.debit;
                if (line.credit > 0) bucket.payments += line.credit;
                if (line.debit > 0 || line.credit > 0) bucket.txCount += 1;
            });
        });

        const bars = Array.from(dailyFlows.entries()).map(([dateStr, flow]) => {
            const dateObj = new Date(`${dateStr}T00:00:00`);
            return {
                date: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                receipts: flow.receipts,
                payments: flow.payments,
                net: flow.receipts - flow.payments,
                txCount: flow.txCount,
            };
        });
        return bars;
    }, [accountingState, analytics]);

    if (!analytics) {
        return null;
    }

    // Health status colors
    const getHealthColor = (status: CashflowAnalytics["healthStatus"]) => {
        const colors = {
            critical: "bg-red-500",
            low: "bg-orange-500",
            moderate: "bg-yellow-500",
            healthy: "bg-blue-500",
            strong: "bg-emerald-500",
        };
        return colors[status] || "bg-gray-500";
    };

    const getHealthBadge = (status: CashflowAnalytics["healthStatus"]) => {
        const badges = {
            critical: { bg: "bg-red-100", text: "text-red-700", label: "Critical" },
            low: { bg: "bg-orange-100", text: "text-orange-700", label: "Low" },
            moderate: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Moderate" },
            healthy: { bg: "bg-blue-100", text: "text-blue-700", label: "Healthy" },
            strong: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Strong" },
        };
        return badges[status] || badges.moderate;
    };

    const cashBarScale = Math.max(
        ...cashBarData.map((point) => Math.max(point.receipts, point.payments)),
        1
    );
    const trailingNetFlow = cashBarData.reduce((sum, point) => sum + point.net, 0);
    const hasCashMovement = cashBarData.some((point) => point.receipts > 0 || point.payments > 0);
    const netCashflow = analytics?.netCashflow || 0;
    const netCashflowLabel = `${netCashflow >= 0 ? "+" : "-"}${formatNairaCompact(Math.abs(netCashflow))}`;
    const runwayMonthsLabel = analytics?.runwayMonths === 999 ? "∞" : `${analytics?.runwayMonths || 0} months`;
    const runwayDaysLabel = analytics?.runwayDays === 999 ? "Sustainable" : `${analytics?.runwayDays || 0} days`;
    const healthBadge = getHealthBadge(analytics?.healthStatus || "moderate");

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Financial Management Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-1">Cashflow intelligence, runway monitoring, and treasury movement analytics.</p>
                    <div className="mt-2 inline-flex items-center gap-2 text-xs">
                        <span className={`px-3 py-1 rounded-md font-medium ${healthBadge.bg} ${healthBadge.text}`}>
                            {healthBadge.label} Health
                        </span>
                        <span className="text-gray-400">Updated from live accounting records</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={loadAnalytics}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard
                    label="Cash Balance"
                    value={formatNairaCompact(analytics?.cashBalance || 0)}
                    hint="Current cash on hand"
                    accent="text-blue-600"
                />
                <KpiCard
                    label="Monthly Inflow"
                    value={`+${formatNairaCompact(analytics?.monthlyInflow || 0)}`}
                    hint="Estimated average inflows"
                    accent="text-emerald-600"
                />
                <KpiCard
                    label="Monthly Outflow"
                    value={`-${formatNairaCompact(analytics?.monthlyOutflow || 0)}`}
                    hint="COGS + operating expenses"
                    accent="text-rose-600"
                />
                <KpiCard
                    label="Net Cashflow"
                    value={netCashflowLabel}
                    hint="Monthly inflow minus outflow"
                    accent={netCashflow >= 0 ? "text-emerald-600" : "text-rose-600"}
                />
                <KpiCard
                    label="Daily Burn Rate"
                    value={formatNairaCompact(analytics?.burnRate || 0)}
                    hint="Average daily cash consumption"
                    accent="text-amber-600"
                />
                <KpiCard
                    label="Runway (Months)"
                    value={runwayMonthsLabel}
                    hint="Months of cash remaining"
                    accent="text-indigo-600"
                />
                <KpiCard
                    label="Runway (Days)"
                    value={runwayDaysLabel}
                    hint="Days of cash remaining"
                    accent="text-cyan-600"
                />
                <KpiCard
                    label="30-day Net Movement"
                    value={`${trailingNetFlow >= 0 ? "+" : "-"}${formatNairaCompact(Math.abs(trailingNetFlow))}`}
                    hint="Aggregate cash movement"
                    accent={trailingNetFlow >= 0 ? "text-emerald-600" : "text-rose-600"}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-4 gap-4">
                        <div>
                            <h2 className="text-base font-semibold text-gray-900">Receipts vs Payments</h2>
                            <p className="text-xs text-gray-500">30-day treasury movement (green up, red down)</p>
                        </div>
                    </div>

                    <div className="relative pt-4 pb-0">
                        {/* Value axis on right */}
                        <div className="absolute right-4 top-4 bottom-14 w-16 flex flex-col justify-between text-right z-10">
                            {cashBarData.length > 0 && [1, 0.5, 0, -0.5, -1].map((multiplier, i) => {
                                const value = cashBarScale * multiplier;
                                return (
                                    <span key={i} className="text-[10px] text-gray-500 font-mono">
                                        {multiplier > 0 ? "+" : ""}{formatNairaCompact(value)}
                                    </span>
                                );
                            })}
                        </div>

                        {/* Chart area */}
                        <div className="h-64 pr-20">
                            {hasCashMovement ? (
                                <div className="relative h-full">
                                    {/* Horizontal grid lines */}
                                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className="w-full border-t border-dashed border-gray-200"></div>
                                        ))}
                                    </div>

                                    {/* Zero baseline */}
                                    <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-emerald-500/80 pointer-events-none" />

                                    {/* Diverging bars */}
                                    <div className="flex items-stretch h-full gap-[2px]">
                                        {cashBarData.map((point, idx) => {
                                            const receiptHeight = (point.receipts / cashBarScale) * 50;
                                            const paymentHeight = (point.payments / cashBarScale) * 50;
                                            const netPositive = point.net >= 0;

                                            return (
                                                <div key={idx} className="flex-1 relative group">
                                                    {/* Receipt bar (up, green) */}
                                                    {point.receipts > 0 && (
                                                        <div
                                                            className="absolute left-1/2 -translate-x-1/2 rounded-[2px] bg-emerald-500"
                                                            style={{
                                                                bottom: "50%",
                                                                height: `${Math.max(receiptHeight, 1)}%`,
                                                                width: "62%",
                                                                minWidth: "4px",
                                                                maxWidth: "10px",
                                                            }}
                                                        />
                                                    )}

                                                    {/* Payment bar (down, red) */}
                                                    {point.payments > 0 && (
                                                        <div
                                                            className="absolute left-1/2 -translate-x-1/2 rounded-[2px] bg-rose-500"
                                                            style={{
                                                                top: "50%",
                                                                height: `${Math.max(paymentHeight, 1)}%`,
                                                                width: "62%",
                                                                minWidth: "4px",
                                                                maxWidth: "10px",
                                                            }}
                                                        />
                                                    )}

                                                    {/* Hover tooltip */}
                                                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                                                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-[11px] leading-relaxed min-w-[170px] max-w-[220px]">
                                                            <div className="text-gray-500 mb-1 font-medium">{point.date}</div>
                                                            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-gray-700">
                                                                <span className="text-gray-400">Receipts:</span>
                                                                <span className="text-right font-mono text-emerald-600 truncate">+{formatNairaCompact(point.receipts)}</span>
                                                                <span className="text-gray-400">Payments:</span>
                                                                <span className="text-right font-mono text-rose-600 truncate">-{formatNairaCompact(point.payments)}</span>
                                                                <span className="text-gray-400">Net:</span>
                                                                <span className={`text-right font-mono font-medium ${netPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                    {point.net >= 0 ? "+" : "-"}{formatNairaCompact(Math.abs(point.net))}
                                                                </span>
                                                                <span className="col-span-2 text-xs text-gray-400 mt-1 border-t border-gray-100 pt-1">
                                                                    {point.txCount} cash transactions
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-400">
                                    <p>No data available</p>
                                </div>
                            )}
                        </div>

                        {/* Time axis */}
                        <div className="h-8 pr-20 flex justify-between items-center mt-2 border-t border-gray-100 pt-2">
                            {cashBarData.filter((_, i) => i % 5 === 0).map((point, idx) => (
                                <span key={idx} className="text-[10px] text-gray-400">{point.date}</span>
                            ))}
                        </div>
                    </div>

                    {/* Footer with net movement */}
                    {cashBarData.length > 0 && (
                        <div className="mt-4 flex items-center justify-between">
                            <span className="text-xs text-gray-500">30-day Net Movement</span>
                            <span
                                className={`px-3 py-1 rounded-full text-sm font-mono font-medium ${trailingNetFlow >= 0
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                    }`}
                            >
                                {trailingNetFlow >= 0 ? "+" : "-"}{formatNairaCompact(Math.abs(trailingNetFlow))}
                            </span>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Health status</span>
                        <span className={`px-2 py-1 rounded-md font-medium ${healthBadge.bg} ${healthBadge.text}`}>{healthBadge.label}</span>
                    </div>
                    <div className={`w-full h-1.5 rounded-full mt-2 ${getHealthColor(analytics?.healthStatus || "moderate")}`} />
                </div>
            </div>

            {(!analytics || analytics.monthlyInflow === 0) && (
                <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white overflow-hidden">
                    <div className="p-5">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-semibold text-amber-800">No Cashflow Data Yet</h3>
                                <p className="text-sm text-amber-700 mt-1">
                                    Add transactions in Accounting Studio to see your cashflow metrics and run investment scenarios.
                                </p>
                                <a
                                    href="/accounting"
                                    className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                    Go to Accounting Studio
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
