"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export default function SidebarSkeleton() {
    return (
        <aside
            className="flex flex-col h-full w-full overflow-hidden"
            style={{
                background: 'linear-gradient(180deg, #2f2f33 0%, #18181b 42%, #050505 100%)',
            }}
        >
            {/* Logo Section */}
            <div className="px-4 py-6 flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-full bg-white/10" />
                <Skeleton className="h-5 w-32 bg-white/10" />
            </div>

            {/* Navigation Items Section */}
            <div className="flex-1 px-4 space-y-4 mt-4 overflow-hidden">
                <Skeleton className="h-3 w-20 bg-white/5 mb-6" />

                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 py-1">
                        <Skeleton className="w-5 h-5 rounded-md bg-white/10" />
                        <Skeleton className="h-4 w-28 bg-white/10" />
                    </div>
                ))}

                <div className="pt-8 space-y-4">
                    <Skeleton className="h-3 w-24 bg-white/5 mb-4" />
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-start gap-3 py-1">
                            <Skeleton className="w-5 h-5 rounded-md bg-white/10 mt-1" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-3 w-full bg-white/10" />
                                <Skeleton className="h-2 w-2/3 bg-white/5" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom section */}
            <div className="p-4 mt-auto">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                    <Skeleton className="w-8 h-8 rounded-lg bg-white/10" />
                    <div className="space-y-2 flex-1">
                        <Skeleton className="h-3 w-20 bg-white/10" />
                        <Skeleton className="h-2 w-16 bg-white/5" />
                    </div>
                </div>
            </div>
        </aside>
    );
}
