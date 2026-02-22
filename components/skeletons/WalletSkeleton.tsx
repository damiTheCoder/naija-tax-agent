"use client";

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Skeleton matching the /wallet page.
 * Balance card → card carousel → quick-action circles → transaction list.
 */
export default function WalletSkeleton() {
    return (
        <div className="space-y-6">
            {/* Balance area */}
            <div className="flex flex-col items-center gap-2 py-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-3 w-28" />
            </div>

            {/* Card carousel */}
            <div className="flex gap-4 overflow-hidden px-2">
                <div className="flex-shrink-0 w-full min-w-[300px] max-w-[340px]">
                    <Skeleton className="w-full h-52 rounded-2xl" />
                </div>
                <div className="flex-shrink-0 w-full min-w-[300px] max-w-[340px]">
                    <div className="w-full h-52 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-3">
                        <Skeleton className="w-12 h-12 rounded-full" />
                        <Skeleton className="h-3 w-16" />
                    </div>
                </div>
            </div>

            {/* Quick action circles */}
            <div className="flex justify-center gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                        <Skeleton className="w-12 h-12 rounded-full" />
                        <Skeleton className="h-3 w-12" />
                    </div>
                ))}
            </div>

            {/* Transaction list */}
            <div className="space-y-1">
                <div className="flex items-center justify-between mb-3">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-16" />
                </div>
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                            <Skeleton className="w-10 h-10 rounded-full" />
                            <div className="space-y-1.5">
                                <Skeleton className="h-3.5 w-28" />
                                <Skeleton className="h-2.5 w-20" />
                            </div>
                        </div>
                        <Skeleton className="h-3.5 w-20" />
                    </div>
                ))}
            </div>
        </div>
    );
}
