"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export default function ReceiptsSkeleton() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-52" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-10 w-36 rounded-lg" />
            </div>

            {/* Upload zone */}
            <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 flex flex-col items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-36" />
            </div>

            {/* Category filter chips */}
            <div className="flex gap-2 flex-wrap">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-24 rounded-full" />
                ))}
            </div>

            {/* Receipt cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-6 w-28" />
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
