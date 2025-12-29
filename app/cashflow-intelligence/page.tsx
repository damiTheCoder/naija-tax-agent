"use client";

import { useEffect, useState, useCallback } from "react";
import {
    calculateCashflowAnalytics,
    modelInflowInvestment,
    calculateTBillsReturn,
    calculateSavingsReturn,
    TBILLS_RATES,
    SAVINGS_RATE,
    formatNaira,
    formatPercent,
    type CashflowAnalytics,
    type InvestmentScenario,
    type TBillsTenor,
} from "@/lib/cashflow/investmentCalculator";
import { accountingEngine } from "@/lib/accounting/transactionBridge";

// =============================================================================
// CASH INTELLIGENCE PAGE - Standalone Analytics & Investment Modelling
// =============================================================================

export default function CashIntelligencePage() {
    // State
    const [analytics, setAnalytics] = useState<CashflowAnalytics | null>(null);
    const [loading, setLoading] = useState(true);

    // Calculator state
    const [tbillsPercent, setTbillsPercent] = useState(5);
    const [tbillsTenor, setTbillsTenor] = useState<TBillsTenor["id"]>("364-day");
    const [savingsPercent, setSavingsPercent] = useState(5);

    // Scenarios
    const [tbillsScenario, setTbillsScenario] = useState<InvestmentScenario | null>(null);
    const [savingsScenario, setSavingsScenario] = useState<InvestmentScenario | null>(null);

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

    // Calculate scenarios when inputs change
    useEffect(() => {
        if (analytics && analytics.monthlyInflow > 0) {
            setTbillsScenario(
                modelInflowInvestment(analytics.monthlyInflow, tbillsPercent, "tbills", tbillsTenor)
            );
            setSavingsScenario(
                modelInflowInvestment(analytics.monthlyInflow, savingsPercent, "savings")
            );
        }
    }, [analytics, tbillsPercent, tbillsTenor, savingsPercent]);

    useEffect(() => {
        loadAnalytics();
    }, [loadAnalytics]);

    // Health status colors
    const getHealthColor = (status: CashflowAnalytics["healthStatus"]) => {
        const colors = {
            critical: "bg-red-500",
            low: "bg-orange-500",
            moderate: "bg-yellow-500",
            healthy: "bg-green-500",
            strong: "bg-emerald-500",
        };
        return colors[status] || "bg-gray-500";
    };

    const getHealthBadge = (status: CashflowAnalytics["healthStatus"]) => {
        const badges = {
            critical: { bg: "bg-red-100", text: "text-red-700", label: "Critical" },
            low: { bg: "bg-orange-100", text: "text-orange-700", label: "Low" },
            moderate: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Moderate" },
            healthy: { bg: "bg-green-100", text: "text-green-700", label: "Healthy" },
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
                <div className="rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden">
                    <div className="px-3 md:px-5 py-2 md:py-4 border-b border-gray-100/50">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900">Cashflow Metrics</h3>
                                <p className="text-xs text-gray-500">Real-time financial health indicators</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-3 md:p-5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                            {/* Cash Balance */}
                            <div className="rounded-xl p-4 bg-white border border-gray-100">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Cash Balance</p>
                                <p className="text-xl md:text-2xl font-bold text-gray-900 mt-1">
                                    {formatNaira(analytics?.cashBalance || 0)}
                                </p>
                            </div>

                            {/* Monthly Inflow */}
                            <div className="rounded-xl p-4 bg-white border border-gray-100">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Monthly Inflow</p>
                                <p className="text-xl md:text-2xl font-bold text-emerald-600 mt-1">
                                    +{formatNaira(analytics?.monthlyInflow || 0)}
                                </p>
                            </div>

                            {/* Monthly Outflow */}
                            <div className="rounded-xl p-4 bg-white border border-gray-100">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Monthly Outflow</p>
                                <p className="text-xl md:text-2xl font-bold text-rose-600 mt-1">
                                    -{formatNaira(analytics?.monthlyOutflow || 0)}
                                </p>
                            </div>

                            {/* Runway */}
                            <div className="rounded-xl p-4 bg-white border border-gray-100">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Cash Runway</p>
                                <div className="flex items-end gap-2 mt-1">
                                    <p className="text-xl md:text-2xl font-bold text-gray-900">
                                        {analytics?.runwayMonths === 999 ? "∞" : analytics?.runwayMonths || 0}
                                    </p>
                                    <span className="text-sm text-gray-500 mb-0.5">months</span>
                                </div>
                                <div className={`w-full h-1.5 rounded-full mt-2 ${getHealthColor(analytics?.healthStatus || "moderate")}`} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Burn Rate Analysis */}
                <div className="rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden">
                    <div className="px-3 md:px-5 py-2 md:py-4 border-b border-gray-100/50">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                                <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900">Burn Rate Analysis</h3>
                                <p className="text-xs text-gray-500">Cash consumption & sustainability metrics</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-3 md:p-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100">
                                <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Daily Burn Rate</p>
                                    <p className="text-lg font-semibold text-gray-900">{formatNaira(analytics?.burnRate || 0)}<span className="text-sm font-normal text-gray-500">/day</span></p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${(analytics?.netCashflow || 0) >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                                    <svg className={`w-5 h-5 ${(analytics?.netCashflow || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Net Cashflow</p>
                                    <p className={`text-lg font-semibold ${(analytics?.netCashflow || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                        {(analytics?.netCashflow || 0) >= 0 ? "+" : ""}{formatNaira(analytics?.netCashflow || 0)}<span className="text-sm font-normal opacity-70">/mo</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Runway Remaining</p>
                                    <p className="text-lg font-semibold text-gray-900">
                                        {analytics?.runwayDays === 999 ? "Sustainable" : `${analytics?.runwayDays || 0} days`}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Investment Calculators */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* T-Bills Calculator */}
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden">
                        <div className="px-3 md:px-5 py-2 md:py-4 border-b border-gray-100/50">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900">Treasury Bills</h3>
                                    <p className="text-xs text-gray-500">Nigerian T-Bills at {formatPercent(TBILLS_RATES.find(t => t.id === tbillsTenor)?.rate || 0)} p.a.</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 md:p-5 space-y-4">
                            {/* Tenor Selection */}
                            <div>
                                <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Select Tenor</label>
                                <div className="flex flex-wrap gap-2">
                                    {TBILLS_RATES.map(tenor => (
                                        <button
                                            key={tenor.id}
                                            onClick={() => setTbillsTenor(tenor.id)}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${tbillsTenor === tenor.id
                                                ? "bg-purple-600 text-white"
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
                                                }`}
                                        >
                                            {tenor.name.replace(" T-Bills", "")}
                                            <span className="block text-xs opacity-75">{formatPercent(tenor.rate)}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Percentage Slider */}
                            <div>
                                <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 flex justify-between">
                                    <span>% of Monthly Inflow to Invest</span>
                                    <span className="font-semibold text-purple-600">{tbillsPercent}%</span>
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="30"
                                    value={tbillsPercent}
                                    onChange={(e) => setTbillsPercent(parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                />
                                <div className="flex justify-between text-xs text-gray-400 mt-1">
                                    <span>1%</span>
                                    <span>15%</span>
                                    <span>30%</span>
                                </div>
                            </div>

                            {/* Results */}
                            {tbillsScenario && (
                                <div className="rounded-xl p-4 bg-purple-50 border border-purple-100 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Monthly Investment</span>
                                        <span className="font-semibold text-gray-900">{formatNaira(tbillsScenario.monthlyInvestment)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">12-Month Total Investment</span>
                                        <span className="font-semibold text-gray-900">{formatNaira(tbillsScenario.monthlyInvestment * 12)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-3 border-t border-purple-200">
                                        <span className="text-sm text-gray-600">Projected Return (12mo)</span>
                                        <span className="font-bold text-emerald-600">+{formatNaira(tbillsScenario.projectedReturn12Months)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Total Value After 12mo</span>
                                        <span className="font-bold text-purple-700">{formatNaira(tbillsScenario.projectedValue12Months)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Savings Calculator */}
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden">
                        <div className="px-3 md:px-5 py-2 md:py-4 border-b border-gray-100/50">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900">Savings Account</h3>
                                    <p className="text-xs text-gray-500">Nigerian bank average at {formatPercent(SAVINGS_RATE)} p.a.</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 md:p-5 space-y-4">
                            {/* Rate Info */}
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100">
                                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <p className="text-sm text-blue-700">
                                    Based on CBN directive: 30% of MPR (27.25%) = ~{formatPercent(SAVINGS_RATE)}
                                </p>
                            </div>

                            {/* Percentage Slider */}
                            <div>
                                <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 flex justify-between">
                                    <span>% of Monthly Inflow to Save</span>
                                    <span className="font-semibold text-blue-600">{savingsPercent}%</span>
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="30"
                                    value={savingsPercent}
                                    onChange={(e) => setSavingsPercent(parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                                <div className="flex justify-between text-xs text-gray-400 mt-1">
                                    <span>1%</span>
                                    <span>15%</span>
                                    <span>30%</span>
                                </div>
                            </div>

                            {/* Results */}
                            {savingsScenario && (
                                <div className="rounded-xl p-4 bg-blue-50 border border-blue-100 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Monthly Deposit</span>
                                        <span className="font-semibold text-gray-900">{formatNaira(savingsScenario.monthlyInvestment)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">12-Month Total Deposits</span>
                                        <span className="font-semibold text-gray-900">{formatNaira(savingsScenario.monthlyInvestment * 12)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-3 border-t border-blue-200">
                                        <span className="text-sm text-gray-600">Interest Earned (12mo)</span>
                                        <span className="font-bold text-emerald-600">+{formatNaira(savingsScenario.projectedReturn12Months)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Final Balance After 12mo</span>
                                        <span className="font-bold text-blue-700">{formatNaira(savingsScenario.projectedValue12Months)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Scenario Comparison */}
                {tbillsScenario && savingsScenario && (
                    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                        <div className="px-3 md:px-5 py-2 md:py-4 border-b border-gray-100 bg-gray-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900">Scenario Comparison</h3>
                                    <p className="text-xs text-gray-500">Side-by-side investment analysis</p>
                                </div>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/30">
                                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Metric</th>
                                        <th className="text-right text-xs font-medium text-purple-600 uppercase tracking-wider px-5 py-3">T-Bills ({tbillsTenor})</th>
                                        <th className="text-right text-xs font-medium text-blue-600 uppercase tracking-wider px-5 py-3">Savings</th>
                                        <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Difference</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    <tr className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-5 py-3 text-gray-700">Annual Rate</td>
                                        <td className="text-right px-5 py-3 font-semibold text-gray-900">{formatPercent(tbillsScenario.annualRate)}</td>
                                        <td className="text-right px-5 py-3 font-semibold text-gray-900">{formatPercent(savingsScenario.annualRate)}</td>
                                        <td className="text-right px-5 py-3 font-medium text-emerald-600">+{formatPercent(tbillsScenario.annualRate - savingsScenario.annualRate)}</td>
                                    </tr>
                                    <tr className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-5 py-3 text-gray-700">12-Month Return</td>
                                        <td className="text-right px-5 py-3 font-semibold text-emerald-600">+{formatNaira(tbillsScenario.projectedReturn12Months)}</td>
                                        <td className="text-right px-5 py-3 font-semibold text-emerald-600">+{formatNaira(savingsScenario.projectedReturn12Months)}</td>
                                        <td className="text-right px-5 py-3 font-medium text-emerald-600">+{formatNaira(tbillsScenario.projectedReturn12Months - savingsScenario.projectedReturn12Months)}</td>
                                    </tr>
                                    <tr className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-5 py-3 text-gray-700">Final Value</td>
                                        <td className="text-right px-5 py-3 font-bold text-gray-900">{formatNaira(tbillsScenario.projectedValue12Months)}</td>
                                        <td className="text-right px-5 py-3 font-bold text-gray-900">{formatNaira(savingsScenario.projectedValue12Months)}</td>
                                        <td className="text-right px-5 py-3 font-bold text-emerald-600">+{formatNaira(tbillsScenario.projectedValue12Months - savingsScenario.projectedValue12Months)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100">
                            <p className="text-xs text-gray-500">
                                * Projections based on current Nigerian rates. T-Bills: {TBILLS_RATES.map(t => `${t.name.replace(' T-Bills', '')} (${formatPercent(t.rate)})`).join(', ')}. Savings: {formatPercent(SAVINGS_RATE)} average.
                            </p>
                        </div>
                    </div>
                )}

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
