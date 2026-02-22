"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export default function SuperSheetSkeleton() {
    return (
        <div className="flex flex-col h-[calc(100vh-140px)] -m-4 lg:-m-8 bg-gray-50 dark:bg-[#0a0a0a] overflow-hidden">
            {/* Header bar */}
            <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-700">
                {/* Logo with Gradient placeholder */}
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center">
                    <Skeleton className="w-6 h-6 rounded-md opacity-50" />
                </div>
                <div className="space-y-1">
                    <Skeleton className="h-5 w-48" /> {/* Workbook name */}
                    <Skeleton className="h-3 w-20" /> {/* "SuperSheet" text */}
                </div>

                <div className="flex-1" />

                {/* Quick stats items */}
                <div className="hidden md:flex items-center gap-4">
                    <Skeleton className="h-7 w-20 rounded-full" /> {/* cells count */}
                    <Skeleton className="h-7 w-20 rounded-full" /> {/* saved badge */}
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-700 overflow-x-auto hide-scrollbar">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="w-8 h-8 rounded shrink-0" />
                ))}
                <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="w-8 h-8 rounded shrink-0" />
                ))}
                <div className="flex-1" />
                <Skeleton className="w-8 h-8 rounded shrink-0" /> {/* Export */}
            </div>

            {/* Formula bar */}
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-700">
                <Skeleton className="h-6 w-12 rounded bg-blue-500/10" /> {/* Cell Ref */}
                <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
                <Skeleton className="h-6 flex-1 rounded bg-gray-50 dark:bg-black/20" /> {/* Formula entry */}
            </div>

            {/* Spreadsheet grid */}
            <div className="flex-1 overflow-hidden bg-white dark:bg-[#0a0a0a]">
                {/* Column headers (A, B, C...) */}
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                    <div className="w-10 h-7 bg-gray-100 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-gray-700 shrink-0" />
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="flex-1 min-w-[100px] h-7 bg-gray-100 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-gray-700 flex items-center justify-center">
                            <Skeleton className="h-3 w-4 opacity-30" />
                        </div>
                    ))}
                </div>

                {/* Grid Rows */}
                {Array.from({ length: 20 }).map((_, row) => (
                    <div key={row} className="flex border-b border-gray-100 dark:border-gray-800">
                        <div className="w-10 h-7 bg-gray-100 dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-gray-700 shrink-0 flex items-center justify-center">
                            <Skeleton className="h-2 w-3 opacity-30" />
                        </div>
                        {Array.from({ length: 12 }).map((_, col) => (
                            <div key={col} className="flex-1 min-w-[100px] h-7 border-r border-gray-50 dark:border-gray-900" />
                        ))}
                    </div>
                ))}
            </div>

            {/* Sheet Tabs bar */}
            <div className="flex items-center gap-1 px-2 py-2 bg-gray-100 dark:bg-[#151515] border-t border-gray-200 dark:border-gray-700 overflow-x-auto hide-scrollbar">
                <Skeleton className="h-8 w-24 rounded-lg shadow-sm" /> {/* Active sheet tab */}
                <Skeleton className="h-8 w-24 rounded-lg opacity-60" /> {/* Other sheet tab */}
                <Skeleton className="w-8 h-8 rounded-lg" /> {/* Add sheet button */}
            </div>
        </div>
    );
}
