"use client";

import { useNavigation } from "@/lib/NavigationContext";
import PageSkeleton from "@/components/PageSkeleton";
import SidebarSkeleton from "@/components/skeletons/SidebarSkeleton";

export default function GlobalSpinner() {
    const { isNavigating, pendingPath } = useNavigation();

    if (!isNavigating) return null;

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden bg-[#fdfcfb]/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm transition-opacity duration-300">
            {/* Sidebar Skeleton - Desktop Only */}
            <div className="fixed left-0 top-0 bottom-0 z-[101] hidden w-1/4 lg:block">
                <div className="h-full overflow-hidden border-r border-[#f5f1ec] dark:border-slate-400/25">
                    <SidebarSkeleton />
                </div>
            </div>

            {/* Content Area Skeleton */}
            <div className="flex h-full w-full flex-col lg:ml-[25%] lg:w-[75%]">
                {/* Simulated Header */}
                <header className="flex h-16 w-full items-center justify-end border-b border-[#f6f2ed] bg-[#fdfcfb]/70 px-8 py-3 backdrop-blur-md dark:border-white/5 dark:bg-black/50">
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
