"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export default function WorkspaceSkeleton() {
    return (
        <div className="space-y-6 px-2 md:px-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-60" /> {/* Financial Reporting Title */}
                    <Skeleton className="h-4 w-80" /> {/* Records summary text */}
                </div>
            </div>

            {/* Date Search & Year Filter Card */}
            <div className="bg-white dark:bg-[#121212] rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Skeleton className="w-5 h-5 rounded-md" /> {/* Icon */}
                        <Skeleton className="h-4 w-16" /> {/* Filter by label */}
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-10" /> {/* Year label */}
                        <Skeleton className="h-9 w-24 rounded-lg" /> {/* Selector */}
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-10" /> {/* From label */}
                        <Skeleton className="h-9 w-32 rounded-lg" /> {/* Date input */}
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-6" /> {/* To label */}
                        <Skeleton className="h-9 w-32 rounded-lg" /> {/* Date input */}
                    </div>
                </div>

                {/* Year Summary Cards Section */}
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <Skeleton className="h-3 w-40 mb-3" /> {/* Section label */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {Array.from({ length: 4 }).map((_, idx) => (
                            <div key={idx} className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 space-y-2">
                                <Skeleton className="h-6 w-12" /> {/* Year text */}
                                <Skeleton className="h-3 w-16" /> {/* Entries count */}
                                <Skeleton className="h-3 w-20" /> {/* Income amount */}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tabs Row */}
            <div className="flex gap-1 overflow-x-auto pb-0 -mx-2 px-2 hide-scrollbar">
                {Array.from({ length: 6 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-9 w-36 rounded-lg shrink-0" />
                ))}
            </div>

            {/* Content Card */}
            <div className="bg-white dark:bg-[#121212] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                {/* Tab Content Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-48" /> {/* Tab Title (e.g. General Journal) */}
                        <Skeleton className="h-3 w-64" /> {/* Subtitle */}
                    </div>
                    <Skeleton className="h-8 w-32 rounded-lg" /> {/* Download button */}
                </div>

                {/* Secondary Filter Row (Journal Class buttons) */}
                <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-black/20">
                    <div className="flex flex-wrap gap-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-7 w-20 rounded-full" />
                        ))}
                    </div>
                </div>

                {/* Table Layout */}
                <div className="overflow-x-auto">
                    <div className="min-w-[1040px]">
                        {/* Table Header */}
                        <div className="flex bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 px-2 py-3">
                            <Skeleton className="h-4 w-[100px] mx-2" /> {/* Date */}
                            <Skeleton className="h-4 w-[100px] mx-2" /> {/* Number */}
                            <Skeleton className="h-4 w-[80px] mx-2" />  {/* Class */}
                            <Skeleton className="h-4 flex-1 mx-2" />    {/* Reference */}
                            <Skeleton className="h-4 w-[150px] mx-2" /> {/* Journal */}
                            <Skeleton className="h-4 w-[120px] mx-2" /> {/* Total */}
                            <Skeleton className="h-4 w-[100px] mx-2" /> {/* Status */}
                        </div>
                        {/* Table Rows */}
                        {Array.from({ length: 5 }).map((_, rowIndex) => (
                            <div key={rowIndex} className="flex px-2 py-4 border-b border-gray-100 dark:border-gray-800/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                                <Skeleton className="h-4 w-[100px] mx-2" />
                                <Skeleton className="h-4 w-[100px] mx-2" />
                                <Skeleton className="h-6 w-[70px] mx-2 rounded-full" />
                                <Skeleton className="h-4 flex-1 mx-2" />
                                <Skeleton className="h-4 w-[150px] mx-2" />
                                <Skeleton className="h-4 w-[120px] mx-2" />
                                <Skeleton className="h-6 w-[80px] mx-2 rounded-full" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
