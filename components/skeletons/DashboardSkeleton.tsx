"use client";

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Skeleton matching the /dashboard page.
 * Header row → 4 metric cards → 2-column chart area → table.
 */
export default function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-28 rounded-lg" />
                    <Skeleton className="h-9 w-28 rounded-lg" />
                </div>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div
                        key={i}
                        className="rounded-2xl p-5 space-y-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                    >
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-7 w-28" />
                        <Skeleton className="h-3 w-16" />
                    </div>
                ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie chart placeholder */}
                <div className="rounded-2xl p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-4">
                    <Skeleton className="h-4 w-36" />
                    <div className="flex justify-center py-4">
                        <Skeleton className="w-40 h-40 rounded-full" />
                    </div>
                    <div className="flex justify-center gap-4">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-16" />
                    </div>
                </div>

                {/* Bar chart placeholder */}
                <div className="rounded-2xl p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-4">
                    <Skeleton className="h-4 w-32" />
                    <div className="flex items-end gap-2 h-40">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton
                                key={i}
                                className="flex-1 rounded-t-md"
                                style={{ height: `${40 + Math.random() * 60}%` }}
                            />
                        ))}
                    </div>
                    <div className="flex justify-between">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-3 w-8" />
                        ))}
                    </div>
                </div>
            </div>

            {/* Table skeleton */}
            <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex gap-4 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-4 flex-1" />
                    ))}
                </div>
                {Array.from({ length: 4 }).map((_, rowIdx) => (
                    <div
                        key={rowIdx}
                        className="flex gap-4 p-4 border-b border-gray-100 dark:border-gray-800 last:border-0"
                    >
                        {Array.from({ length: 4 }).map((_, colIdx) => (
                            <Skeleton key={colIdx} className="h-4 flex-1" />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
