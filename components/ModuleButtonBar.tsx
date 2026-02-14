"use client";

import { usePathname } from "next/navigation";
import { AppMode } from "@/lib/navigation";
import { useNavigation } from "@/lib/NavigationContext";
import { useTheme } from "@/lib/ThemeContext";
import { useMode } from "@/lib/ModeContext";

// Module configurations with icons
const MODULES: {
    mode: AppMode;
    label: string;
    icon: React.ReactNode;
}[] = [
        {
            mode: "accounting",
            label: "Accounting",
            icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
            ),
        },
        {
            mode: "tax",
            label: "Tax Manager",
            icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
            ),
        },
        {
            mode: "intelligence",
            label: "Treasury Management",
            icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
            ),
        },
        {
            mode: "wallet",
            label: "Wallet",
            icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
            ),
        },
        {
            mode: "marketplace",
            label: "Marketplace",
            icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87m-4-12a4 4 0 010 7.75" />
                </svg>
            ),
        },
        {
            mode: "payroll",
            label: "Payroll",
            icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            ),
        },


    ];

export default function ModuleButtonBar() {
    const pathname = usePathname();
    const { navigateTo, isNavigating } = useNavigation();
    const { theme } = useTheme();
    const { mode: experienceMode } = useMode();
    const isDark = theme === 'dark';

    // Hide enterprise module buttons in personal mode
    if (experienceMode === "user") return null;

    // Determine current mode based on pathname
    const getCurrentMode = (): AppMode => {

        if (pathname.startsWith("/marketplace")) return "marketplace";
        if (pathname.startsWith("/wallet")) return "wallet";
        if (pathname.startsWith("/cashflow-intelligence")) return "intelligence";
        if (pathname.startsWith("/accounting/employees") || pathname.startsWith("/accounting/payroll")) return "payroll";
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
        } else if (newMode === "marketplace") {
            navigateTo("/marketplace");
        } else if (newMode === "payroll") {
            navigateTo("/accounting/employees");
        } else {
            navigateTo("/accounting");
        }
    };

    return (
        <div
            className="w-full overflow-x-auto mb-0 hidden lg:block -mx-2"
            style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch'
            }}
        >
            <style jsx>{`
                div::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
            <div className="flex items-center gap-2 pb-0 px-2" style={{ minWidth: 'max-content' }}>
                {MODULES.map((module) => {
                    const isActive = module.mode === currentMode;
                    return (
                        <button
                            key={module.mode}
                            onClick={() => handleModeSwitch(module.mode)}
                            disabled={isNavigating}
                            className={`
                                flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold
                                transition-all whitespace-nowrap
                                ${isNavigating ? 'cursor-wait' : 'cursor-pointer'}
                            `}
                            style={{
                                backgroundColor: isActive ? '#2264ff' : (isDark ? '#0a0a0a' : '#e5e5e5'),
                                color: isActive ? '#ffffff' : (isDark ? '#d1d5db' : '#374151'),
                            }}
                        >
                            <span>{module.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
