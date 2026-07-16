"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AppMode, ProjectionsModuleOwner, getStoredProjectionsModuleOwner, getServerProjectionsModuleOwnerSnapshot, subscribeToProjectionsModuleOwner, resolveModuleForPath } from "@/lib/navigation";
import { useNavigation } from "@/lib/NavigationContext";
import { useTheme } from "@/lib/ThemeContext";
import { useMode } from "@/lib/ModeContext";

// Module configurations with icons
const MODULES: {
    mode: AppMode;
    label: string;
    iconSrc: string;
    activeColor: string;
}[] = [
        {
            mode: "accounting",
            label: "Accounting",
            iconSrc: "/accounting.jpeg?v=20260713-0015",
            activeColor: "#4f8f00",
        },
        {
            mode: "tax",
            label: "Tax Manager",
            iconSrc: "/tax.jpeg",
            activeColor: "#3157d5",
        },
        {
            mode: "budgeting",
            label: "Budgeting",
            iconSrc: "/budgeting.jpeg",
            activeColor: "#d05a00",
        },
        {
            mode: "markets",
            label: "Markets",
            iconSrc: "/Market.jpg?v=20260713-1",
            activeColor: "#0f766e",
        },
        {
            mode: "wallet",
            label: "Wallet",
            iconSrc: "/coin.jpeg",
            activeColor: "#4f8f00",
        },
    ];

export default function ModuleButtonBar() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { navigateTo, prefetchTo, isNavigating } = useNavigation();
    const { theme } = useTheme();
    const { mode: experienceMode } = useMode();
    const isDark = theme === 'dark';
    const projectionsOwner = useSyncExternalStore<ProjectionsModuleOwner>(
        subscribeToProjectionsModuleOwner,
        getStoredProjectionsModuleOwner,
        getServerProjectionsModuleOwnerSnapshot
    );

    // Determine current mode based on pathname
    const getCurrentMode = (): AppMode => {
        return resolveModuleForPath(pathname, projectionsOwner);
    };

    const currentMode = getCurrentMode();
    const currentModule = MODULES.find((module) => module.mode === currentMode) ?? MODULES[0];

    const getModuleHref = (targetMode: AppMode) => {
        if (targetMode === "tax") return "/tax/workspace";
        if (targetMode === "budgeting") return "/budgeting/dashboard";
        if (targetMode === "markets") return "/markets";
        if (targetMode === "wallet") return "/wallet";
        return "/accounting";
    };

    const handleModeSwitch = (newMode: AppMode) => {
        setIsOpen(false);
        if (currentMode === newMode) return;
        navigateTo(getModuleHref(newMode));
    };

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (!dropdownRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setIsOpen(false);
        };

        document.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    // Hide enterprise module buttons in personal mode
    if (experienceMode === "user") return null;

    return (
        <div className="relative block" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                onMouseEnter={() => prefetchTo(getModuleHref(currentModule.mode))}
                onFocus={() => prefetchTo(getModuleHref(currentModule.mode))}
                className="flex h-9 items-center gap-1.5 rounded-full border px-2.5 pr-3 text-xs font-semibold backdrop-blur-2xl transition-colors"
                style={{
                    background: isDark ? "rgba(20,20,20,0.34)" : "rgba(255,255,255,0.34)",
                    backdropFilter: "blur(22px) saturate(180%)",
                    WebkitBackdropFilter: "blur(22px) saturate(180%)",
                    borderColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.72)",
                    color: isDark ? "#f5f5f5" : "#262626",
                }}
                aria-haspopup="menu"
                aria-expanded={isOpen}
            >
                <Image src={currentModule.iconSrc} alt="" width={24} height={24} className="h-6 w-6 rounded-full object-cover" aria-hidden="true" />
                <span className="max-w-[7.25rem] truncate">{currentModule.label}</span>
                <svg className={`h-3 w-3 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
            </button>

            {isOpen ? (
                <div
                    className="absolute right-0 top-full z-50 mt-3 w-[min(16rem,calc(100vw-2rem))] overflow-hidden rounded-lg border p-1.5 shadow-[0_18px_45px_rgba(15,23,42,0.14)] backdrop-blur-2xl"
                    style={{
                        background: isDark ? "rgba(0,0,0,0.78)" : "rgba(255,255,255,0.76)",
                        borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(240,236,230,0.78)",
                    }}
                    role="menu"
                    aria-label="Modules"
                >
                {MODULES.map((module) => {
                    const isActive = module.mode === currentMode;
                    return (
                        <button
                            key={module.mode}
                            type="button"
                            onMouseEnter={() => prefetchTo(getModuleHref(module.mode))}
                            onFocus={() => prefetchTo(getModuleHref(module.mode))}
                            onClick={() => handleModeSwitch(module.mode)}
                            disabled={isNavigating}
                            className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm font-semibold transition-colors ${
                                isDark ? "hover:bg-white/10" : "hover:bg-[#f8f6f3]/90"
                            } ${isNavigating ? "cursor-wait" : "cursor-pointer"}`}
                            style={{
                                color: isActive ? module.activeColor : (isDark ? "#e5e7eb" : "#303030"),
                            }}
                            role="menuitem"
                            aria-current={isActive ? "page" : undefined}
                        >
                            {isNavigating ? (
                                <span className="h-8 w-8 rounded-lg bg-current/20 animate-pulse" />
                            ) : (
                                <Image src={module.iconSrc} alt="" width={32} height={32} className="h-8 w-8 rounded-lg object-cover" aria-hidden="true" />
                            )}
                            <span>{module.label}</span>
                            {isActive ? (
                                <span className="ml-auto h-2 w-2 rounded-full bg-current" aria-hidden="true" />
                            ) : null}
                        </button>
                    );
                })}
                </div>
            ) : null}
        </div>
    );
}
