"use client";

export default function SkeletonLoader() {
    return (
        <div className="min-h-screen px-4 py-6 space-y-5" style={{ background: 'var(--app-bg)' }}>
            {/* Header pill - centered */}
            <div className="flex justify-center">
                <div className="h-6 w-24 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>

            {/* Row with circle, text lines, and circle */}
            <div className="flex items-center gap-3 pt-2">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="flex-1 space-y-2">
                    <div className="h-3 w-28 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-2 w-16 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                </div>
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>

            {/* Content bars - varying widths */}
            <div className="space-y-3 pt-2">
                <div className="h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-3 w-3/4 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-3 w-1/3 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>

            {/* Search/input bar skeleton */}
            <div className="h-12 w-full rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />

            {/* Large card skeleton */}
            <div className="h-32 w-full rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse" />

            {/* Bottom row - label and two cards */}
            <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                    <div className="h-3 w-20 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-3 w-16 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="h-20 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    <div className="h-20 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
                </div>
            </div>
        </div>
    );
}
