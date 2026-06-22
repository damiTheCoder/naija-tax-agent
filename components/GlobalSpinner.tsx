"use client";

import { useNavigation } from "@/lib/NavigationContext";
import PageSkeleton from "@/components/PageSkeleton";

export default function GlobalSpinner() {
    const { isNavigating } = useNavigation();

    if (!isNavigating) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#fdfcfb]/80 backdrop-blur-sm transition-opacity duration-300 dark:bg-[#0a0a0a]/80">
            <PageSkeleton />
        </div>
    );
}
