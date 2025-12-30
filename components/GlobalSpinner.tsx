"use client";

import { useNavigation } from "@/lib/NavigationContext";

export default function GlobalSpinner() {
    const { isNavigating } = useNavigation();

    if (!isNavigating) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm flex items-center justify-center transition-opacity duration-300">
            <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                <div className="relative w-12 h-12">
                    <div
                        className="absolute inset-0 rounded-full"
                        style={{ border: '2px solid rgba(100, 181, 246, 0.3)' }}
                    ></div>
                    <div
                        className="absolute inset-0 rounded-full animate-spin"
                        style={{ border: '2px solid transparent', borderTopColor: '#64B5F6' }}
                    ></div>
                </div>
                <p className="text-sm font-medium text-gray-500 dark:!text-gray-300 animate-pulse">
                    Loading...
                </p>
            </div>
        </div>
    );
}
