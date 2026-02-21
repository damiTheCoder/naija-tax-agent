"use client";

import { useNavigation } from "@/lib/NavigationContext";
import PageSkeleton from "@/components/PageSkeleton";

export default function GlobalSpinner() {
    const { isNavigating, pendingPath } = useNavigation();

    if (!isNavigating) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm flex items-center justify-center transition-opacity duration-300">
            <div className="w-full max-w-6xl px-6">
                <PageSkeleton overridePath={pendingPath || undefined} />
            </div>
        </div>
    );
}
