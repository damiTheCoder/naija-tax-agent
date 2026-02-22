"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export default function BankConnectionsSkeleton() {
    return (
        <div className="space-y-6">
            {/* Header card */}
            <div className="rounded-2xl bg-white dark:bg-[#121212] border border-gray-200 dark:border-gray-800 px-6 py-6 transition-colors duration-300">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-44" />
                            <Skeleton className="h-4 w-64" />
                        </div>
                    </div>
                    <Skeleton className="h-10 w-36 rounded-lg" />
                </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl bg-white dark:bg-[#121212] border border-gray-100 dark:border-gray-800 p-5 space-y-3">
                        <div className="flex items-center gap-3 mb-3">
                            <Skeleton className="w-10 h-10 rounded-xl" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-8 w-32" />
                    </div>
                ))}
            </div>

            {/* Connected banks list */}
            <div className="rounded-2xl bg-white dark:bg-[#121212] border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                    <Skeleton className="h-6 w-32" />
                </div>
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="p-5 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <Skeleton className="w-12 h-12 rounded-xl" />
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-5 w-48" />
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="h-5 w-24 rounded-full" />
                                        <Skeleton className="h-4 w-24" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Skeleton className="w-10 h-10 rounded-lg" />
                                <Skeleton className="w-10 h-10 rounded-lg" />
                            </div>
                        </div>
                        {/* Inner Account Card */}
                        <div className="mt-4 grid gap-3">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50">
                                <div className="space-y-1">
                                    <Skeleton className="h-4 w-40" />
                                    <Skeleton className="h-3 w-56" />
                                </div>
                                <div className="space-y-1 text-right">
                                    <Skeleton className="h-5 w-32" />
                                    <Skeleton className="h-3 w-40" />
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-4 w-40" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Supported banks row */}
            <div className="rounded-2xl bg-white dark:bg-[#121212] border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                    <Skeleton className="h-6 w-40" />
                </div>
                <div className="p-6">
                    <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex-shrink-0 flex flex-col items-center gap-3 p-4 rounded-2xl min-w-[140px] border border-gray-200 dark:border-gray-800">
                                <Skeleton className="w-12 h-12 rounded-xl shadow-sm" />
                                <div className="text-center space-y-2">
                                    <Skeleton className="h-4 w-20 mx-auto" />
                                    <Skeleton className="h-3 w-24 mx-auto" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Security Notice Banner */}
            <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 p-6 flex items-start gap-4">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                </div>
            </div>
        </div>
    );
}
