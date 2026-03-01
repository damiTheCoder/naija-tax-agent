"use client";

import { Skeleton } from "@/components/ui/Skeleton";

const INVESTMENT_BAR_HEIGHTS: Array<{ left: number; right: number }> = [
    { left: 62, right: 47 },
    { left: 55, right: 42 },
    { left: 70, right: 53 },
    { left: 60, right: 45 },
    { left: 68, right: 51 },
    { left: 58, right: 43 },
];

/**
 * Skeleton matching the /personal/dashboard Investment Portfolio page.
 * Header + badge → 4 rounded metric cards → 2 chart areas → horizontal platform cards.
 */
export default function InvestmentDashboardSkeleton() {
    return (
        <div className="flex flex-col h-[calc(100vh-120px)] lg:h-[calc(100vh-80px)] relative">
            <div className="flex-1 overflow-hidden pt-2 sm:pt-4 pb-4 sm:pb-6">
                <div className="max-w-5xl mx-auto px-4 w-full space-y-8">
                    {/* Header row */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2">
                            <Skeleton className="h-7 w-48" />
                            <Skeleton className="h-4 w-64" />
                        </div>
                        <Skeleton className="h-7 w-52 rounded-full" />
                    </div>

                    {/* Four metric cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div
                                key={i}
                                className="p-5 rounded-2xl bg-gray-100 dark:bg-gray-800/70 space-y-3"
                            >
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-6 w-32" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                        ))}
                    </div>

                    {/* Two chart areas side by side */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Pie chart */}
                        <div className="p-6 rounded-2xl bg-gray-100 dark:bg-gray-800/70 space-y-4">
                            <div className="flex items-center gap-2">
                                <Skeleton className="w-4 h-4 rounded" />
                                <Skeleton className="h-4 w-28" />
                            </div>
                            <div className="flex justify-center py-4">
                                <Skeleton className="w-[160px] h-[160px] rounded-full" />
                            </div>
                            <div className="flex justify-center gap-4">
                                <Skeleton className="h-3 w-14" />
                                <Skeleton className="h-3 w-14" />
                            </div>
                        </div>

                        {/* Bar chart */}
                        <div className="p-6 rounded-2xl bg-gray-100 dark:bg-gray-800/70 space-y-4">
                            <div className="flex items-center gap-2">
                                <Skeleton className="w-4 h-4 rounded" />
                                <Skeleton className="h-4 w-36" />
                            </div>
                            <div className="flex items-end gap-3 h-[200px] pt-4">
                                {INVESTMENT_BAR_HEIGHTS.map((item, i) => (
                                    <div key={i} className="flex-1 flex gap-1 items-end h-full">
                                        <Skeleton
                                            className="flex-1 rounded-t-md"
                                            style={{ height: `${item.left}%` }}
                                        />
                                        <Skeleton
                                            className="flex-1 rounded-t-md"
                                            style={{ height: `${item.right}%` }}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between px-1">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <Skeleton key={i} className="h-3 w-7" />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Platform cards – horizontal scroll */}
                    <div className="space-y-4">
                        <Skeleton className="h-4 w-40" />
                        <div className="flex gap-4 overflow-hidden">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="w-48 flex-shrink-0 p-4 rounded-2xl bg-gray-100 dark:bg-gray-800/70 space-y-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="w-10 h-10 rounded-2xl" />
                                        <div className="space-y-1">
                                            <Skeleton className="h-3 w-16" />
                                            <Skeleton className="h-2 w-10" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-2 w-12" />
                                    <Skeleton className="h-4 w-20" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
