"use client";

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Skeleton matching the /main tax computation page.
 * Step indicator → form section with label–input pairs → action buttons.
 */
export default function TaxFormSkeleton() {
    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        {i < 2 && <Skeleton className="h-0.5 w-12" />}
                    </div>
                ))}
            </div>

            {/* Card with form fields */}
            <div className="rounded-2xl p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-6">
                {/* Section title */}
                <div className="space-y-2">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-72" />
                </div>

                {/* Form fields */}
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                ))}

                {/* Two-column fields */}
                <div className="grid grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-10 w-full rounded-lg" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-24 rounded-lg" />
                <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
        </div>
    );
}
