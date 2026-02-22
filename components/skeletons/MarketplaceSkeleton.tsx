"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export default function MarketplaceSkeleton() {
    return (
        <div className="relative min-h-screen bg-[var(--app-bg)] -m-2 lg:-m-8 px-4 py-8 lg:p-12 transition-colors duration-300 overflow-hidden">
            {/* Background Decorative Blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '1s' }}></div>

            <div className="max-w-6xl mx-auto relative z-10">
                {/* Header Section */}
                <div className="mb-12 text-center lg:text-left">
                    <Skeleton className="h-12 lg:h-16 w-64 lg:w-80 mb-4 mx-auto lg:mx-0 rounded-xl" /> {/* Title */}
                    <Skeleton className="h-5 lg:h-6 w-full max-w-2xl mx-auto lg:mx-0 rounded-lg" /> {/* Description line 1 */}
                    <Skeleton className="h-5 lg:h-6 w-3/4 max-w-md mx-auto lg:mx-0 mt-2 rounded-lg" /> {/* Description line 2 */}
                </div>

                {/* Search Bar - Glassmorphism Placeholder */}
                <div className="relative mb-16 max-w-3xl">
                    <div className="w-full h-[68px] rounded-2xl bg-white/50 dark:bg-[#121212]/50 backdrop-blur-md border border-gray-200 dark:border-gray-800 shadow-lg flex items-center px-6">
                        <Skeleton className="w-7 h-7 rounded-lg shrink-0" /> {/* Search Icon */}
                        <Skeleton className="h-5 w-64 ml-4" /> {/* Placeholder text */}
                    </div>
                </div>

                {/* Professionals Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div
                            key={i}
                            className="bg-white dark:bg-[#121212] rounded-3xl border border-gray-100 dark:border-gray-800 p-8 flex flex-col shadow-sm space-y-6"
                        >
                            {/* Profile Header */}
                            <div className="flex items-start gap-5">
                                <Skeleton className="w-16 h-16 rounded-2xl shrink-0" /> {/* Avatar */}
                                <div className="space-y-2 flex-1 pt-1">
                                    <Skeleton className="h-6 w-3/4" /> {/* Name */}
                                    <Skeleton className="h-4 w-1/2" /> {/* Title */}
                                </div>
                            </div>

                            {/* Content Body */}
                            <div className="space-y-4 flex-1">
                                <Skeleton className="h-7 w-32 rounded-full" /> {/* Experience Badge */}
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-4/5" />
                                </div>

                                {/* Skills */}
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {Array.from({ length: 3 }).map((_, j) => (
                                        <Skeleton key={j} className="h-7 w-20 rounded-lg" />
                                    ))}
                                </div>
                            </div>

                            {/* WhatsApp Button Style */}
                            <div className="w-full h-14 rounded-2xl bg-[#25D366]/20 dark:bg-[#25D366]/10 border border-[#25D366]/30 flex items-center justify-center gap-2">
                                <Skeleton className="w-5 h-5 rounded-full bg-[#25D366]/40" />
                                <Skeleton className="h-4 w-32 bg-[#25D366]/40" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
