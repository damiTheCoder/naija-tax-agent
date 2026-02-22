"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export default function InvoiceSkeleton() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-52" />
                    <Skeleton className="h-4 w-72" />
                </div>
                <Skeleton className="h-10 w-36 rounded-lg" />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-7 w-28" />
                        <Skeleton className="h-3 w-16" />
                    </div>
                ))}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-24 rounded-full" />
                ))}
            </div>

            {/* Invoice table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex gap-4 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-4 flex-1" />
                    ))}
                </div>
                {Array.from({ length: 5 }).map((_, row) => (
                    <div key={row} className="flex gap-4 p-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
                        {Array.from({ length: 6 }).map((_, col) => (
                            <Skeleton key={col} className="h-4 flex-1" />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
