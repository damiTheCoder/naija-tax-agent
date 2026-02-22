"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export default function ReportsSkeleton() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-44" />
                    <Skeleton className="h-4 w-72" />
                </div>
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-36 rounded-lg" />
                    <Skeleton className="h-10 w-28 rounded-lg" />
                </div>
            </div>

            {/* Class filter buttons */}
            <div className="flex gap-2 flex-wrap">
                {["Assets", "Liabilities", "Equity", "Revenue", "Expenses"].map((_, i) => (
                    <Skeleton key={i} className="h-9 w-28 rounded-lg" />
                ))}
            </div>

            {/* Account accordion sections */}
            {Array.from({ length: 3 }).map((_, sectionIdx) => (
                <div key={sectionIdx} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Skeleton className="w-8 h-8 rounded-lg" />
                            <Skeleton className="h-5 w-32" />
                        </div>
                        <Skeleton className="h-5 w-20" />
                    </div>
                    {Array.from({ length: 3 }).map((_, row) => (
                        <div key={row} className="flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-4 w-12" />
                                <Skeleton className="h-4 w-40" />
                            </div>
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
