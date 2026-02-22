"use client";

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Skeleton matching the /personal/apps connected apps page.
 * Header → grid of app connection cards with icon + label.
 */
export default function ConnectedAppsSkeleton() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="space-y-2">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-4 w-64" />
            </div>

            {/* App cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="rounded-2xl p-5 bg-gray-100 dark:bg-gray-800/70 space-y-4"
                    >
                        <div className="flex items-center gap-3">
                            <Skeleton className="w-12 h-12 rounded-xl" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                        </div>
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-9 w-full rounded-lg" />
                    </div>
                ))}
            </div>
        </div>
    );
}
