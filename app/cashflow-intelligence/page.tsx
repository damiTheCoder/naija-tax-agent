"use client";

import { useMemo, useState, useCallback } from "react";
import {
    calculateCashflowAnalytics,
    formatNaira,
    type CashflowAnalytics,
} from "@/lib/cashflow/investmentCalculator";
import { accountingEngine } from "@/lib/accounting/transactionBridge";

// =============================================================================
// CASH INTELLIGENCE PAGE - Standalone Analytics & Investment Modelling
// =============================================================================

export default function CashIntelligencePage() {
    // Build analytics snapshot from accounting data
    const calculateAnalyticsSnapshot = useCallback((): CashflowAnalytics => {
        try {
            const statements = accountingEngine.generateStatements();

            // Get cashflow data from statements
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
            return result;
        } catch {
            // If no data, set defaults
            return calculateCashflowAnalytics(0, 0, 0, "", "");
        }
    }, []);

    // State
    const [analytics, setAnalytics] = useState<CashflowAnalytics | null>(() => calculateAnalyticsSnapshot());

    const loadAnalytics = useCallback(() => {
        setAnalytics(calculateAnalyticsSnapshot());
    }, [calculateAnalyticsSnapshot]);

    // Build 30-day receipt vs payment bars from accounting engine
    const cashBarData = useMemo(() => {
        const entries = accountingEngine.getState().journalEntries;
        const cashAccountCodes = new Set(['1000', '1010', '1020', '1021']); // Cash & Bank codes
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
                if (!cashAccountCodes.has(line.accountCode)) return;
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
    }, [analytics]);

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

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="px-3 md:px-4 py-3">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Cash Intelligence</p>
                        <p className="text-sm text-gray-500">Cashflow analytics, runway modelling & investment tools</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        {analytics && (
                            <span className={`px-3 py-1 rounded-md font-medium ${getHealthBadge(analytics.healthStatus).bg} ${getHealthBadge(analytics.healthStatus).text}`}>
                                {getHealthBadge(analytics.healthStatus).label}
                            </span>
                        )}
                        <button
                            onClick={loadAnalytics}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-600 font-medium transition-colors flex items-center gap-1.5"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-1 md:px-2 py-3 md:py-4 space-y-3">
                {/* Metrics Dashboard */}
                <div className="">
                    <div className="py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold !text-black dark:!text-white">Cashflow Metrics</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Real-time financial health indicators</p>
                            </div>
                        </div>
                    </div>
                    <div className="">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                            {/* Cash Balance */}
                            <div className="rounded-xl pt-2 pb-4">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cash Balance</p>
                                <p style={{ color: 'var(--foreground)' }} className="text-xl md:text-2xl font-bold mt-1">
                                    {formatNaira(analytics?.cashBalance || 0)}
                                </p>
                            </div>

                            {/* Monthly Inflow */}
                            <div className="rounded-xl pt-2 pb-4">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Monthly Inflow</p>
                                <p className="text-xl md:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                    +{formatNaira(analytics?.monthlyInflow || 0)}
                                </p>
                            </div>

                            {/* Monthly Outflow */}
                            <div className="rounded-xl pt-2 pb-4">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Monthly Outflow</p>
                                <p className="text-xl md:text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                                    -{formatNaira(analytics?.monthlyOutflow || 0)}
                                </p>
                            </div>

                            {/* Runway */}
                            <div className="rounded-xl pt-2 pb-4">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cash Runway</p>
                                <div className="flex items-end gap-2 mt-1">
                                    <p style={{ color: 'var(--foreground)' }} className="text-xl md:text-2xl font-bold">
                                        {analytics?.runwayMonths === 999 ? "∞" : analytics?.runwayMonths || 0}
                                    </p>
                                    <span className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">months</span>
                                </div>
                                <div className={`w-full h-1.5 rounded-full mt-2 ${getHealthColor(analytics?.healthStatus || "moderate")}`} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Burn Rate Analysis */}
                <div className="">
                    <div className="py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                                <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold !text-black dark:!text-white">Burn Rate Analysis</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Cash consumption & sustainability metrics</p>
                            </div>
                        </div>
                    </div>
                    <div className="">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                            <div className="flex items-center gap-3 pt-2 pb-3 rounded-xl">
                                <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Daily Burn Rate</p>
                                    <p style={{ color: 'var(--foreground)' }} className="text-lg font-semibold">{formatNaira(analytics?.burnRate || 0)}<span className="text-sm font-normal text-gray-500 dark:text-gray-400">/day</span></p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 pt-2 pb-3 rounded-xl">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${(analytics?.netCashflow || 0) >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                                    <svg className={`w-5 h-5 ${(analytics?.netCashflow || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Net Cashflow</p>
                                    <p className={`text-lg font-semibold ${(analytics?.netCashflow || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                        {(analytics?.netCashflow || 0) >= 0 ? "+" : ""}{formatNaira(analytics?.netCashflow || 0)}<span className="text-sm font-normal opacity-70">/mo</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 pt-2 pb-3 rounded-xl">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Runway Remaining</p>
                                    <p style={{ color: 'var(--foreground)' }} className="text-lg font-semibold">
                                        {analytics?.runwayDays === 999 ? "Sustainable" : `${analytics?.runwayDays || 0} days`}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Treasury Movement Chart */}
                <div className="rounded-2xl bg-transparent overflow-hidden">
                    {/* Header */}
                    <div className="py-3 md:py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold !text-black dark:!text-white">Receipts vs Payments</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">30-day treasury movement (green up, red down)</p>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Chart Body */}
                    <div className="relative pt-4 pb-0 md:pt-6">
                        {/* Value axis on right */}
                        <div className="absolute right-4 md:right-6 top-4 md:top-6 bottom-14 w-16 flex flex-col justify-between text-right z-10">
                            {cashBarData.length > 0 && [1, 0.5, 0, -0.5, -1].map((multiplier, i) => {
                                const value = cashBarScale * multiplier;
                                return (
                                    <span key={i} className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                                        {multiplier > 0 ? "+" : ""}{formatNaira(value)}
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
                                            <div key={i} className="w-full border-t border-dashed border-gray-200 dark:border-gray-800"></div>
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
                                                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-[11px] whitespace-nowrap">
                                                            <div className="text-gray-500 dark:text-gray-400 mb-1 font-medium">{point.date}</div>
                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700 dark:text-gray-300">
                                                                <span className="text-gray-400">Receipts:</span>
                                                                <span className="text-right font-mono text-emerald-600 dark:text-emerald-400">+{formatNaira(point.receipts)}</span>
                                                                <span className="text-gray-400">Payments:</span>
                                                                <span className="text-right font-mono text-rose-600 dark:text-rose-400">-{formatNaira(point.payments)}</span>
                                                                <span className="text-gray-400">Net:</span>
                                                                <span className={`text-right font-mono font-medium ${netPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                                    {point.net >= 0 ? "+" : "-"}{formatNaira(Math.abs(point.net))}
                                                                </span>
                                                                <span className="col-span-2 text-xs text-gray-400 mt-1 border-t border-gray-100 dark:border-gray-700 pt-1">
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
                                <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                                    <p>No data available</p>
                                </div>
                            )}
                        </div>

                        {/* Time axis */}
                        <div className="h-8 pr-20 flex justify-between items-center mt-2 border-t border-gray-100 dark:border-gray-800 pt-2">
                            {cashBarData.filter((_, i) => i % 5 === 0).map((point, idx) => (
                                <span key={idx} className="text-[10px] text-gray-400 dark:text-gray-500">{point.date}</span>
                            ))}
                        </div>
                    </div>

                    {/* Footer with net movement */}
                    {cashBarData.length > 0 && (
                        <div className="px-4 md:px-6 py-3 flex items-center justify-between">
                            <span className="text-xs text-gray-500 dark:text-gray-400">30-day Net Movement</span>
                            <span className={`px-3 py-1 rounded-full text-sm font-mono font-medium ${trailingNetFlow >= 0
                                ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400'
                                : 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400'
                                }`}>
                                {trailingNetFlow >= 0 ? "+" : "-"}{formatNaira(Math.abs(trailingNetFlow))}
                            </span>
                        </div>
                    )}
                </div>

                {/* Empty State */}
                {
                    (!analytics || analytics.monthlyInflow === 0) && (
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
                    )
                }
            </main >
        </div >
    );
}
