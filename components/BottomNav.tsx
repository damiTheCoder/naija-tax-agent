"use client";

import { usePathname } from "next/navigation";
import { AppMode } from "@/lib/navigation";
import { useNavigation } from "@/lib/NavigationContext";

export default function BottomNav() {
    const pathname = usePathname();
    const { navigateTo } = useNavigation();

    // Determine current mode based on pathname
    const getCurrentMode = (): AppMode => {
        if (pathname.startsWith("/inventory")) return "inventory";
        if (pathname.startsWith("/wallet")) return "wallet";
        if (pathname.startsWith("/cashflow-intelligence")) return "intelligence";
        if (pathname.startsWith("/accounting") || pathname.startsWith("/dashboard")) return "accounting";
        return "tax";
    };

    const currentMode = getCurrentMode();

    const handleModeSwitch = (newMode: AppMode) => {
        if (currentMode === newMode) return;

        if (newMode === "tax") {
            navigateTo("/main");
        } else if (newMode === "intelligence") {
            navigateTo("/cashflow-intelligence");
        } else if (newMode === "wallet") {
            navigateTo("/wallet");
        } else if (newMode === "inventory") {
            navigateTo("/inventory");
        } else {
            navigateTo("/accounting");
        }
    };

    const navItems: { mode: AppMode; label: string; icon: React.ReactNode }[] = [
        {
            mode: "accounting",
            label: "Accounting",
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h11l3 3v13H6z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9h14" />
                </svg>
            ),
        },
        {
            mode: "tax",
            label: "Tax Manager",
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                    <rect x="4" y="2" width="16" height="20" rx="2" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h8M8 10h2M14 10h2" />
                </svg>
            ),
        },
        {
            mode: "intelligence",
            label: "Intelligence",
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
            ),
        },
        {
            mode: "wallet",
            label: "Wallet",
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
            ),
        }
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 backdrop-blur-xl z-[100] pb-safe lg:hidden" style={{ background: 'var(--app-bg)' }}>
            <div className="flex items-center justify-center px-4 py-2 gap-2 max-w-xl mx-auto">
                {navItems.map((item) => {
                    const isActive = currentMode === item.mode;
                    return (
                        <button
                            key={item.mode}
                            onClick={() => handleModeSwitch(item.mode)}
                            className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all duration-200 flex-1 active:scale-95 ${isActive
                                ? "text-[#64B5F6]"
                                : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                                }`}
                        >
                            <div className={`flex items-center justify-center transition-transform duration-200 ${isActive ? "-translate-y-0.5" : ""}`}>
                                {item.icon}
                            </div>
                            <span className={`text-[10px] font-medium tracking-wide text-center ${isActive ? "font-semibold" : ""}`}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
