"use client";

import { useNavigation } from "@/lib/NavigationContext";
import PageSkeleton from "@/components/PageSkeleton";
import SidebarSkeleton from "@/components/skeletons/SidebarSkeleton";

export default function GlobalSpinner() {
    const { isNavigating, pendingPath } = useNavigation();

    if (!isNavigating) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm transition-opacity duration-300 overflow-hidden">
            {/* Sidebar Skeleton - Desktop Only */}
            <div className="hidden lg:block fixed left-3 top-3 bottom-0 w-60 z-[101]">
                <div className="h-full rounded-t-2xl overflow-hidden shadow-2xl border border-white/10">
                    <SidebarSkeleton />
                </div>
            </div>

            {/* Content Area Skeleton */}
            <div className="w-full h-full lg:ml-[15.75rem] flex flex-col">
                {/* Simulated Header */}
                <header className="h-16 w-full flex items-center justify-between px-8 py-3 bg-white/50 dark:bg-black/50 backdrop-blur-md border-b border-gray-100 dark:border-white/5">
                    <div className="flex gap-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-8 w-24 rounded-lg bg-gray-200/50 dark:bg-white/10 animate-pulse" />
                        ))}
                    </div>
                    <div className="h-8 w-24 rounded-lg bg-gray-200/50 dark:bg-white/10 animate-pulse" />
                </header>

                {/* Main Content Skeleton */}
                <main className="flex-1 px-4 py-6 lg:p-8 overflow-y-auto subtle-scrollbar">
                    <div className="max-w-6xl mx-auto w-full">
                        <PageSkeleton overridePath={pendingPath || undefined} />
                    </div>
                </main>
            </div>
        </div>
    );
}
