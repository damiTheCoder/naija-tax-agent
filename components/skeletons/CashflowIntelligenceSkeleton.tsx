"use client";

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Skeleton matching the /cashflow-intelligence page.
 * Header → 4 KPI cards → tab bar → chart area + breakdown table.
 */
export default function CashflowIntelligenceSkeleton() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-52" />
                    <Skeleton className="h-4 w-80" />
                </div>
                <Skeleton className="h-7 w-28 rounded-full" />
            </div>

            {/* KPI metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div
                        key={i}
                        className="rounded-2xl p-5 space-y-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                    >
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-7 w-28" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-28 rounded-full" />
                ))}
            </div>

            {/* Chart + breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
                <div className="rounded-2xl p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-4">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-56 w-full rounded-2xl" />
                </div>

                <div className="rounded-2xl p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-4">
                    <Skeleton className="h-4 w-28" />
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <Skeleton className="h-3 w-28" />
                            <Skeleton className="h-3 w-20" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
