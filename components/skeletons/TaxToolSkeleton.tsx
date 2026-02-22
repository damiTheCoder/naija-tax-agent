"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export default function TaxToolSkeleton() {
    return (
        <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
            {/* Centered header */}
            <div className="space-y-3 text-center mb-8">
                <Skeleton className="h-4 w-24 mx-auto rounded-full bg-blue-500/10" /> {/* Category Badge info */}
                <Skeleton className="h-10 w-[320px] mx-auto rounded-xl" /> {/* Tool Title */}
                <Skeleton className="h-5 w-[480px] mx-auto opacity-70" /> {/* Description line */}
            </div>

            {/* Form card - matching exactly the tool's form card layout */}
            <div className="bg-white dark:bg-[#121212] rounded-3xl border border-gray-100 dark:border-gray-800 p-8 shadow-sm space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="space-y-2.5">
                            <Skeleton className="h-4 w-28" /> {/* Field Label */}
                            <Skeleton className="h-12 w-full rounded-2xl" /> {/* Input Field */}
                        </div>
                    ))}
                </div>

                {/* Optional listed items section (WHT/VAT items) */}
                <div className="space-y-4 pt-4 border-t border-gray-50 dark:border-gray-900">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-5 w-40" /> {/* Section Title */}
                        <Skeleton className="h-8 w-24 rounded-xl" /> {/* Add button */}
                    </div>
                    {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                            <div className="space-y-1.5 flex-1">
                                <Skeleton className="h-5 w-1/3" />
                                <Skeleton className="h-3 w-1/2 opacity-60" />
                            </div>
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-5 w-24" />
                                <Skeleton className="h-8 w-8 rounded-lg" /> {/* Remove icon */}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Form Footer Action */}
                <div className="flex justify-end pt-4">
                    <Skeleton className="h-14 w-44 rounded-2xl shadow-lg" />
                </div>
            </div>

            {/* Results / Calculation Statistics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#121212] p-6 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="w-8 h-8 rounded-xl opacity-20" />
                        </div>
                        <Skeleton className="h-9 w-40" />
                        <Skeleton className="h-3 w-24 rounded-full" />
                    </div>
                ))}
            </div>

            {/* Footer Notice */}
            <div className="text-center pt-8">
                <Skeleton className="h-4 w-64 mx-auto opacity-40" />
            </div>
        </div>
    );
}
