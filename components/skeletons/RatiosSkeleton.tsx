"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export default function RatiosSkeleton() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-44" />
                    <Skeleton className="h-4 w-72" />
                </div>
                <Skeleton className="h-10 w-36 rounded-lg" />
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-3 w-36" />
                    </div>
                ))}
            </div>

            {/* Ratio sections */}
            {Array.from({ length: 3 }).map((_, sectionIdx) => (
                <div key={sectionIdx} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                        <Skeleton className="h-5 w-40" />
                    </div>
                    {Array.from({ length: 4 }).map((_, row) => (
                        <div key={row} className="flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                            <div className="space-y-1">
                                <Skeleton className="h-4 w-36" />
                                <Skeleton className="h-3 w-56" />
                            </div>
                            <Skeleton className="h-6 w-16" />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
