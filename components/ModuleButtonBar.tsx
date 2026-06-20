"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { AppMode, ProjectionsModuleOwner, getStoredProjectionsModuleOwner, getServerProjectionsModuleOwnerSnapshot, subscribeToProjectionsModuleOwner, resolveModuleForPath } from "@/lib/navigation";
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
            mode: "budgeting",
            label: "Budgeting",
            icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16v-3M12 16V8M16 16v-6M20 16v-9" />
                </svg>
            ),
        },
    ];

export default function ModuleButtonBar() {
    const pathname = usePathname();
    const { navigateTo, prefetchTo, isNavigating } = useNavigation();
    const { theme } = useTheme();
    const { mode: experienceMode } = useMode();
    const isDark = theme === 'dark';
    const projectionsOwner = useSyncExternalStore<ProjectionsModuleOwner>(
        subscribeToProjectionsModuleOwner,
        getStoredProjectionsModuleOwner,
        getServerProjectionsModuleOwnerSnapshot
    );

    // Hide enterprise module buttons in personal mode
    if (experienceMode === "user") return null;

    // Determine current mode based on pathname
    const getCurrentMode = (): AppMode => {
        return resolveModuleForPath(pathname, projectionsOwner);
    };

    const currentMode = getCurrentMode();

    const getModuleHref = (targetMode: AppMode) => {
        if (targetMode === "tax") return "/tax/workspace";
        if (targetMode === "budgeting") return "/budgeting/dashboard";
        return "/accounting";
    };

    const handleModeSwitch = (newMode: AppMode) => {
        if (currentMode === newMode) return;
        navigateTo(getModuleHref(newMode));
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
                            onMouseEnter={() => prefetchTo(getModuleHref(module.mode))}
                            onFocus={() => prefetchTo(getModuleHref(module.mode))}
                            onClick={() => handleModeSwitch(module.mode)}
                            disabled={isNavigating}
                            className={`
                                flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold
                                transition-all whitespace-nowrap
                                ${isNavigating ? 'cursor-wait' : 'cursor-pointer'}
                            `}
                            style={{
                                backgroundColor: 'transparent',
                                color: isActive ? '#5fa800' : (isDark ? '#d1d5db' : '#374151'),
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
