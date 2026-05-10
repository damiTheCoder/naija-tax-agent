"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export default function SidebarSkeleton() {
    const skeletonTone = "from-[#ddd8d2] via-[#ece8e2] to-[#ddd8d2] dark:from-gray-700 dark:via-gray-600 dark:to-gray-700";
    const mutedTone = "from-[#ebe7e1] via-[#f3f0eb] to-[#ebe7e1] dark:from-gray-800 dark:via-gray-700 dark:to-gray-800";

    return (
        <aside
            className="flex h-full w-full flex-col overflow-hidden bg-[linear-gradient(180deg,#fffefd_0%,#fcfaf8_100%)] dark:bg-[linear-gradient(180deg,#2f2f33_0%,#18181b_42%,#050505_100%)]"
        >
            <div className="flex h-full w-full flex-col p-3">
                {/* Logo Section */}
                <div className="flex items-center gap-3 px-2.5 py-2">
                    <Skeleton className={`h-9 w-9 rounded-full ${skeletonTone}`} />
                    <Skeleton className={`h-5 w-32 ${skeletonTone}`} />
                </div>

                {/* Navigation Items Section */}
                <div className="mt-3 flex-1 space-y-4 overflow-hidden">
                    <Skeleton className={`mb-6 h-3 w-20 ${mutedTone}`} />

                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-2.5 py-2">
                            <Skeleton className={`h-5 w-5 rounded-md ${skeletonTone}`} />
                            <Skeleton className={`h-4 w-28 ${skeletonTone}`} />
                        </div>
                    ))}

                    <div className="space-y-4 pt-8">
                        <Skeleton className={`mb-4 h-3 w-24 ${mutedTone}`} />
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-start gap-3 px-2.5 py-2">
                                <Skeleton className={`mt-1 h-5 w-5 rounded-md ${skeletonTone}`} />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className={`h-3 w-full ${skeletonTone}`} />
                                    <Skeleton className={`h-2 w-2/3 ${mutedTone}`} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom section */}
                <div className="mt-auto">
                    <div className="flex items-center gap-3 rounded-xl border border-[#f5f1ec] bg-white/75 p-3 dark:border-white/10 dark:bg-white/5">
                        <Skeleton className={`h-8 w-8 rounded-lg ${skeletonTone}`} />
                        <div className="flex-1 space-y-2">
                            <Skeleton className={`h-3 w-20 ${skeletonTone}`} />
                            <Skeleton className={`h-2 w-16 ${mutedTone}`} />
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
