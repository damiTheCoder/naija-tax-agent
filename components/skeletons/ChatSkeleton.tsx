"use client";

import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Skeleton that matches chat pages (/personal, /accounting).
 * Shows a centred welcome area with logo, greeting, 2×2 suggestion cards,
 * and a floating composer bar at the bottom.
 */
export default function ChatSkeleton() {
    return (
        <div className="flex flex-col h-[calc(100vh-120px)] lg:h-[calc(100vh-80px)] relative">
            <div className="flex-1 flex flex-col items-center justify-start lg:justify-center px-4 pt-8 lg:pt-0">
                <div className="max-w-2xl w-full text-center space-y-8">
                    {/* Logo placeholder */}
                    <div className="flex justify-center">
                        <Skeleton className="w-12 h-12 rounded-full" />
                    </div>

                    {/* Greeting text */}
                    <div className="flex flex-col items-center gap-2">
                        <Skeleton className="h-7 w-72" />
                        <Skeleton className="h-4 w-56" />
                    </div>

                    {/* Suggestion cards – 2×2 grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div
                                key={i}
                                className="rounded-2xl p-4 space-y-3 bg-gray-100 dark:bg-gray-800/70"
                            >
                                <Skeleton className="w-9 h-9 rounded-lg" />
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-28" />
                                    <Skeleton className="h-3 w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Floating composer bar */}
            <div className="fixed bottom-6 left-1/2 lg:left-[calc(50%_+_7.5rem)] -translate-x-1/2 z-50">
                <Skeleton className="h-10 w-28 rounded-full" />
            </div>
        </div>
    );
}
