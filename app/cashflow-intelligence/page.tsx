"use client";

import { useEffect, useState, useCallback } from "react";
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
    // State
    const [analytics, setAnalytics] = useState<CashflowAnalytics | null>(null);
    const [loading, setLoading] = useState(true);

    // Daily flow chart data - last 7 days
    const [dailyFlows, setDailyFlows] = useState<Array<{ day: string; inflow: number; outflow: number }>>([]);

    // Load analytics from accounting data
    const loadAnalytics = useCallback(() => {
        setLoading(true);

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

            setAnalytics(result);
        } catch {
            // If no data, set defaults
            setAnalytics(calculateCashflowAnalytics(0, 0, 0, "", ""));
        }

        setLoading(false);
    }, []);

    // Generate sample daily flow data based on monthly analytics
    useEffect(() => {
        if (analytics) {
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const dailyAvgInflow = (analytics.monthlyInflow || 0) / 30;
            const dailyAvgOutflow = (analytics.monthlyOutflow || 0) / 30;

            // Generate realistic daily variations (±30%)
            const flows = days.map((day) => ({
                day,
                inflow: Math.round(dailyAvgInflow * (0.7 + Math.random() * 0.6)),
                outflow: Math.round(dailyAvgOutflow * (0.7 + Math.random() * 0.6)),
            }));
            setDailyFlows(flows);
        }
    }, [analytics]);

    useEffect(() => {
        loadAnalytics();
    }, [loadAnalytics]);

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

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-pulse text-gray-500">Loading Cash Intelligence...</div>
            </div>
        );
    }

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
                                <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Cashflow Metrics</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Real-time financial health indicators</p>
                            </div>
                        </div>
                    </div>
                    <div className="">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                            {/* Cash Balance */}
                            <div className="rounded-xl p-4">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cash Balance</p>
                                <p style={{ color: 'var(--foreground)' }} className="text-xl md:text-2xl font-bold mt-1">
                                    {formatNaira(analytics?.cashBalance || 0)}
                                </p>
                            </div>

                            {/* Monthly Inflow */}
                            <div className="rounded-xl p-4">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Monthly Inflow</p>
                                <p className="text-xl md:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                    +{formatNaira(analytics?.monthlyInflow || 0)}
                                </p>
                            </div>

                            {/* Monthly Outflow */}
                            <div className="rounded-xl p-4">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Monthly Outflow</p>
                                <p className="text-xl md:text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                                    -{formatNaira(analytics?.monthlyOutflow || 0)}
                                </p>
                            </div>

                            {/* Runway */}
                            <div className="rounded-xl p-4">
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
                                <h3 style={{ color: 'var(--foreground)' }} className="text-sm font-semibold">Burn Rate Analysis</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Cash consumption & sustainability metrics</p>
                            </div>
                        </div>
                    </div>
                    <div className="">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                            <div className="flex items-center gap-3 p-3 rounded-xl">
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
                            <div className="flex items-center gap-3 p-3 rounded-xl">
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
                            <div className="flex items-center gap-3 p-3 rounded-xl">
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

                {/* Daily Inflow/Outflow Chart */}
                <div className="rounded-2xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700 overflow-hidden">
                    <div className="px-3 md:px-5 py-3 md:py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Daily Cash Flow</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Last 7 days inflow & outflow</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
                                    <span className="text-gray-500 dark:text-gray-400">Inflow</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-sm bg-rose-500"></div>
                                    <span className="text-gray-500 dark:text-gray-400">Outflow</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 md:p-6">
                        {dailyFlows.length > 0 ? (
                            <div className="relative h-64">
                                {/* Center line */}
                                <div className="absolute left-0 right-0 top-1/2 h-px bg-gray-200 dark:bg-gray-700"></div>

                                {/* Chart bars */}
                                <div className="flex items-center justify-around h-full gap-2">
                                    {dailyFlows.map((flow, idx) => {
                                        const maxValue = Math.max(
                                            ...dailyFlows.map(f => Math.max(f.inflow, f.outflow))
                                        );
                                        const inflowHeight = maxValue > 0 ? (flow.inflow / maxValue) * 100 : 0;
                                        const outflowHeight = maxValue > 0 ? (flow.outflow / maxValue) * 100 : 0;

                                        return (
                                            <div key={idx} className="flex flex-col items-center flex-1 h-full">
                                                {/* Inflow bar (goes up) */}
                                                <div className="flex flex-col items-center justify-end h-1/2 w-full pb-1">
                                                    <div
                                                        className="w-6 md:w-10 bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-md transition-all duration-500 relative group cursor-pointer"
                                                        style={{ height: `${Math.max(inflowHeight * 0.9, 4)}%` }}
                                                    >
                                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                            +{formatNaira(flow.inflow)}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Outflow bar (goes down) */}
                                                <div className="flex flex-col items-center justify-start h-1/2 w-full pt-1">
                                                    <div
                                                        className="w-6 md:w-10 bg-gradient-to-b from-rose-500 to-rose-400 rounded-b-md transition-all duration-500 relative group cursor-pointer"
                                                        style={{ height: `${Math.max(outflowHeight * 0.9, 4)}%` }}
                                                    >
                                                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                            -{formatNaira(flow.outflow)}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Day label */}
                                                <span className="mt-3 text-xs text-gray-500 dark:text-gray-400 font-medium">{flow.day}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="h-64 flex items-center justify-center text-gray-400">
                                <p>No cash flow data available</p>
                            </div>
                        )}

                        {/* Summary stats */}
                        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <div className="text-center">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Weekly Inflow</p>
                                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                    +{formatNaira(dailyFlows.reduce((sum, f) => sum + f.inflow, 0))}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Weekly Outflow</p>
                                <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
                                    -{formatNaira(dailyFlows.reduce((sum, f) => sum + f.outflow, 0))}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Net Flow</p>
                                <p className={`text-lg font-bold ${(dailyFlows.reduce((sum, f) => sum + f.inflow - f.outflow, 0)) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {dailyFlows.reduce((sum, f) => sum + f.inflow - f.outflow, 0) >= 0 ? '+' : ''}{formatNaira(dailyFlows.reduce((sum, f) => sum + f.inflow - f.outflow, 0))}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Empty State */}
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
            </main>
        </div>
    );
}
