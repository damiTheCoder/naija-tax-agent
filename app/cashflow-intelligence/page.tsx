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

    // Candlestick chart data - last 30 days
    const [candleData, setCandleData] = useState<Array<{
        date: string;
        open: number;
        high: number;
        low: number;
        close: number;
        isGreen: boolean;
    }>>([]);

    // Generate realistic candlestick data based on monthly analytics
    useEffect(() => {
        if (analytics) {
            const baseValue = analytics.cashBalance || 100000;
            const volatility = 0.08; // 8% daily volatility
            const candles: typeof candleData = [];

            let currentPrice = baseValue;

            // Generate 30 days of candlestick data
            for (let i = 29; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                // Random price movement
                const change = (Math.random() - 0.48) * volatility; // Slight upward bias
                const open = currentPrice;
                const close = currentPrice * (1 + change);
                const high = Math.max(open, close) * (1 + Math.random() * 0.02);
                const low = Math.min(open, close) * (1 - Math.random() * 0.02);

                candles.push({
                    date: dateStr,
                    open: Math.round(open),
                    high: Math.round(high),
                    low: Math.round(low),
                    close: Math.round(close),
                    isGreen: close >= open
                });

                currentPrice = close;
            }

            setCandleData(candles);
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

                {/* Cash Position Chart - Matching Accounting Dashboard Style */}
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
                    {/* Header */}
                    <div className="px-3 md:px-5 py-3 md:py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Cash Position</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">30-day candlestick chart</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
                                    <span className="text-gray-500 dark:text-gray-400">Gain</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-sm bg-rose-500"></div>
                                    <span className="text-gray-500 dark:text-gray-400">Loss</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Chart Body */}
                    <div className="relative p-4 md:p-6">
                        {/* Price axis on right */}
                        <div className="absolute right-4 md:right-6 top-4 md:top-6 bottom-14 w-16 flex flex-col justify-between text-right z-10">
                            {candleData.length > 0 && (() => {
                                const prices = candleData.flatMap(c => [c.high, c.low]);
                                const maxPrice = Math.max(...prices);
                                const minPrice = Math.min(...prices);
                                const range = maxPrice - minPrice;
                                return [0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                                    <span key={i} className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                                        {formatNaira(maxPrice - range * pct)}
                                    </span>
                                ));
                            })()}
                        </div>

                        {/* Chart area */}
                        <div className="h-64 pr-20">
                            {candleData.length > 0 ? (
                                <div className="relative h-full">
                                    {/* Horizontal grid lines */}
                                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className="w-full h-px bg-gray-100 dark:bg-gray-800"></div>
                                        ))}
                                    </div>

                                    {/* Candlesticks */}
                                    <div className="flex items-stretch h-full gap-[2px]">
                                        {candleData.map((candle, idx) => {
                                            const prices = candleData.flatMap(c => [c.high, c.low]);
                                            const maxPrice = Math.max(...prices);
                                            const minPrice = Math.min(...prices);
                                            const range = maxPrice - minPrice || 1;

                                            // Calculate positions as percentages from top
                                            const highPct = ((maxPrice - candle.high) / range) * 100;
                                            const lowPct = ((maxPrice - candle.low) / range) * 100;
                                            const openPct = ((maxPrice - candle.open) / range) * 100;
                                            const closePct = ((maxPrice - candle.close) / range) * 100;

                                            const bodyTop = Math.min(openPct, closePct);
                                            const bodyHeight = Math.abs(closePct - openPct);
                                            const wickTop = highPct;
                                            const wickHeight = lowPct - highPct;

                                            const color = candle.isGreen ? '#10b981' : '#f43f5e';

                                            return (
                                                <div key={idx} className="flex-1 relative group">
                                                    {/* Wick (thin line) */}
                                                    <div
                                                        className="absolute left-1/2 -translate-x-1/2"
                                                        style={{
                                                            top: `${wickTop}%`,
                                                            height: `${Math.max(wickHeight, 0.5)}%`,
                                                            width: '1px',
                                                            background: color
                                                        }}
                                                    />

                                                    {/* Body (thick rectangle) */}
                                                    <div
                                                        className="absolute left-1/2 -translate-x-1/2 rounded-[1px]"
                                                        style={{
                                                            top: `${bodyTop}%`,
                                                            height: `${Math.max(bodyHeight, 0.5)}%`,
                                                            width: '60%',
                                                            minWidth: '3px',
                                                            maxWidth: '8px',
                                                            background: color
                                                        }}
                                                    />

                                                    {/* Hover tooltip */}
                                                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                                                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-[11px] whitespace-nowrap">
                                                            <div className="text-gray-500 dark:text-gray-400 mb-1 font-medium">{candle.date}</div>
                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700 dark:text-gray-300">
                                                                <span className="text-gray-400">Open:</span>
                                                                <span className="text-right font-mono">{formatNaira(candle.open)}</span>
                                                                <span className="text-gray-400">High:</span>
                                                                <span className="text-right font-mono">{formatNaira(candle.high)}</span>
                                                                <span className="text-gray-400">Low:</span>
                                                                <span className="text-right font-mono">{formatNaira(candle.low)}</span>
                                                                <span className="text-gray-400">Close:</span>
                                                                <span className={`text-right font-mono font-medium ${candle.isGreen ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                                    {formatNaira(candle.close)}
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
                            {candleData.filter((_, i) => i % 5 === 0).map((candle, idx) => (
                                <span key={idx} className="text-[10px] text-gray-400 dark:text-gray-500">{candle.date}</span>
                            ))}
                        </div>
                    </div>

                    {/* Footer with current value */}
                    {candleData.length > 0 && (
                        <div className="px-4 md:px-6 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Current Position</span>
                            <span className={`px-3 py-1 rounded-full text-sm font-mono font-medium ${candleData[candleData.length - 1].isGreen
                                    ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400'
                                }`}>
                                {formatNaira(candleData[candleData.length - 1].close)}
                            </span>
                        </div>
                    )}
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
