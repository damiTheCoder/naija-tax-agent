"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export default function EmployeesSkeleton() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-32" />
                    <Skeleton className="h-4 w-56" />
                </div>
                <Skeleton className="h-10 w-40 rounded-lg" />
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-7 w-16" />
                    </div>
                ))}
            </div>

            {/* Employee table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex gap-4 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-4 flex-1" />
                    ))}
                </div>
                {Array.from({ length: 4 }).map((_, row) => (
                    <div key={row} className="flex gap-4 p-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        {Array.from({ length: 5 }).map((_, col) => (
                            <Skeleton key={col} className="h-4 flex-1" />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
