"use client";

import { useMemo } from "react";
import { useTheme } from "@/lib/ThemeContext";
import { useConnectedApps } from "@/lib/ConnectedAppsContext";
import { BarChart2, TrendingUp, ArrowUpRight, PieChart as PieIcon } from "lucide-react";
import { getPortfolioMetrics, getPlatformInvestments, formatNaira, getAssetAllocation, getMonthlyPerformance } from "@/lib/personal/investmentData";
import Image from "next/image";
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend
} from "recharts";



export default function InvestmentDashboardPage() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const { apps } = useConnectedApps();
    const returnsTextClass = isDark ? "text-emerald-300" : "text-emerald-500";
    const cardSurfaceClass = isDark ? "bg-gray-800/70" : "bg-gray-100";

    // Data derived from connected apps
    const metrics = useMemo(() => getPortfolioMetrics(apps), [apps]);
    const platformInvestments = useMemo(() => getPlatformInvestments(apps), [apps]);
    const assetData = useMemo(() => getAssetAllocation(apps), [apps]);
    const assetChartData = useMemo(
        () =>
            assetData.map((entry, index) => {
                const palette = ["#3b82f6", "#86efac"];
                return { ...entry, color: palette[index % palette.length] };
            }),
        [assetData]
    );
    const performanceData = useMemo(() => getMonthlyPerformance(), []);

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] lg:h-[calc(100vh-80px)] relative">
            <div className="flex-1 overflow-y-auto hide-scrollbar pt-2 sm:pt-4 transition-all duration-300 pb-4 sm:pb-6">
                <div className="max-w-5xl mx-auto px-4 w-full">
                    <div className="space-y-8 mb-8 animate-in fade-in duration-500">
                        {/* Portfolio Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div>
                                    <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                                        Investment Portfolio
                                    </h1>
                                    <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                                        Overview of your connected assets and returns
                                    </p>
                                </div>
                            </div>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${isDark ? "bg-emerald-950/30 text-emerald-400 border border-emerald-800/50" : "bg-emerald-50 text-emerald-700 border border-emerald-100"}`}>
                                <TrendingUp className="w-3.5 h-3.5" />
                                Portfolio is up 4.2% this month
                            </div>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className={`p-5 rounded-2xl ${cardSurfaceClass}`}>
                                <p className={`text-xs font-medium mb-1 ${isDark ? "text-gray-500" : "text-gray-500"}`}>Total Portfolio Value</p>
                                <p className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{formatNaira(metrics.totalValue)}</p>
                                <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                                    <ArrowUpRight className="w-3 h-3" />
                                    <span>+₦124,500</span>
                                </div>
                            </div>
                            <div className={`p-5 rounded-2xl ${cardSurfaceClass}`}>
                                <p className={`text-xs font-medium mb-1 ${isDark ? "text-gray-500" : "text-gray-500"}`}>Cumulative Returns</p>
                                <p className={`text-xl font-bold ${returnsTextClass}`}>{formatNaira(metrics.cumulativeReturn)}</p>
                            </div>
                            <div className={`p-5 rounded-2xl ${cardSurfaceClass}`}>
                                <p className={`text-xs font-medium mb-1 ${isDark ? "text-gray-500" : "text-gray-500"}`}>Average ROI</p>
                                <p className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{metrics.averageRoi.toFixed(1)}%</p>
                            </div>
                            <div className={`p-5 rounded-2xl ${cardSurfaceClass}`}>
                                <p className={`text-xs font-medium mb-1 ${isDark ? "text-gray-500" : "text-gray-500"}`}>Monthly Inflow</p>
                                <p className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{formatNaira(metrics.monthlyInflow)}</p>
                            </div>
                        </div>

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Asset Allocation Pie Chart */}
                            <div className={`p-6 rounded-2xl ${cardSurfaceClass}`}>
                                <div className="flex items-center gap-2 mb-6">
                                    <PieIcon className="w-4 h-4 text-emerald-400" />
                                    <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Asset Allocation</h3>
                                </div>
                                <div className="h-[240px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={assetChartData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {assetChartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(value: number) => formatNaira(value)}
                                                contentStyle={{
                                                    backgroundColor: isDark ? "#111827" : "#ffffff",
                                                    borderColor: isDark ? "#374151" : "#e5e7eb",
                                                    borderRadius: "12px",
                                                    fontSize: "12px"
                                                }}
                                            />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Monthly Performance Bar Chart */}
                            <div className={`p-6 rounded-2xl ${cardSurfaceClass}`}>
                                <div className="flex items-center gap-2 mb-6">
                                    <BarChart2 className="w-4 h-4 text-emerald-500" />
                                    <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Monthly Performance</h3>
                                </div>
                                <div className="h-[240px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={performanceData}>
                                            <XAxis
                                                dataKey="month"
                                                axisLine={false}
                                                tickLine={false}
                                                fontSize={12}
                                                tick={{ fill: isDark ? "#9ca3af" : "#6b7280" }}
                                            />
                                            <YAxis
                                                hide
                                            />
                                            <Tooltip
                                                formatter={(value: number) => formatNaira(value)}
                                                contentStyle={{
                                                    backgroundColor: isDark ? "#111827" : "#ffffff",
                                                    borderColor: isDark ? "#374151" : "#e5e7eb",
                                                    borderRadius: "12px",
                                                    fontSize: "12px"
                                                }}
                                            />
                                            <Bar
                                                dataKey="returns"
                                                fill="#86efac"
                                                radius={[4, 4, 0, 0]}
                                                name="Returns"
                                            />
                                            <Bar
                                                dataKey="inflow"
                                                fill="#3b82f6"
                                                radius={[4, 4, 0, 0]}
                                                name="Inflow"
                                            />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Platform Breakdown */}
                        <div>
                            <h3 className={`text-sm font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>Connected Platforms</h3>
                            <div className="overflow-x-auto hide-scrollbar -mx-4 px-4">
                                <div className="flex gap-4 min-w-max pb-4">
                                    {platformInvestments.map((inv) => (
                                        <div key={inv.id} className={`w-48 p-4 rounded-2xl ${cardSurfaceClass}`}>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div
                                                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold overflow-hidden"
                                                    style={inv.logo ? undefined : { backgroundColor: inv.color }}
                                                >
                                                    {inv.logo ? (
                                                        <Image
                                                            src={inv.logo}
                                                            alt={`${inv.name} logo`}
                                                            width={36}
                                                            height={36}
                                                            className="w-9 h-9 object-contain rounded-2xl"
                                                        />
                                                    ) : (
                                                        inv.icon
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold">{inv.name}</p>
                                                    <p className="text-[10px] text-emerald-500">+{inv.roi}%</p>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-gray-500">Balance</p>
                                            <p className="text-sm font-bold">{formatNaira(inv.balance)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
