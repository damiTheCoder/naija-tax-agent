"use client";

import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { AppMode, ProjectionsModuleOwner, getStoredProjectionsModuleOwner, getServerProjectionsModuleOwnerSnapshot, subscribeToProjectionsModuleOwner, resolveModuleForPath } from "@/lib/navigation";
import { useNavigation } from "@/lib/NavigationContext";

export default function ModeSelector() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { navigateTo, prefetchTo, isNavigating } = useNavigation();
    const projectionsOwner = useSyncExternalStore<ProjectionsModuleOwner>(
        subscribeToProjectionsModuleOwner,
        getStoredProjectionsModuleOwner,
        getServerProjectionsModuleOwnerSnapshot
    );

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Determine current mode based on pathname
    const getCurrentMode = (): AppMode => {
        return resolveModuleForPath(pathname, projectionsOwner);
    };

    const mode = getCurrentMode();

    const getModeHref = (targetMode: AppMode) => {
        if (targetMode === "tax") return "/tax/workspace";
        if (targetMode === "budgeting") return "/budgeting/dashboard";
        if (targetMode === "markets") return "/markets";
        if (targetMode === "wallet") return "/wallet";
        return "/accounting";
    };

    const handleModeSwitch = (newMode: AppMode) => {
        setIsOpen(false);
        if (mode === newMode) return;
        navigateTo(getModeHref(newMode));
    };

    const getModeLabel = (m: AppMode) => {
        switch (m) {
            case "tax": return "Tax Manager";
            case "budgeting": return "Budgeting";
            case "markets": return "Markets";
            case "wallet": return "Wallet";
            case "accounting": return "Accounting";
            default: return "Tax Manager";
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-600 hover:bg-gray-700 transition-all text-sm font-bold text-white"
            >
                <div className="flex items-center gap-2">
                    {isNavigating && (
                        <div className="w-3 h-3 rounded-full bg-white/30 animate-pulse" />
                    )}
                    <span className="text-xs">{getModeLabel(mode)}</span>
                </div>
                <svg
                    className={`w-3 h-3 text-white transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 lg:top-full lg:mt-2 bottom-full mb-2 lg:bottom-auto lg:mb-0 w-48 bg-gray-100/90 dark:bg-[#2a2a2a]/90 backdrop-blur-xl rounded-xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl py-1 z-50 animate-in fade-in">
                    <div className="divide-y divide-gray-200 dark:divide-gray-600">
                        <ModeOption
                            mode="accounting"
                            label="Accounting"
                            currentMode={mode}
                            onHover={() => prefetchTo(getModeHref("accounting"))}
                            onClick={() => handleModeSwitch("accounting")}
                        />
                        <ModeOption
                            mode="tax"
                            label="Tax Manager"
                            currentMode={mode}
                            onHover={() => prefetchTo(getModeHref("tax"))}
                            onClick={() => handleModeSwitch("tax")}
                        />
                        <ModeOption
                            mode="budgeting"
                            label="Budgeting"
                            currentMode={mode}
                            onHover={() => prefetchTo(getModeHref("budgeting"))}
                            onClick={() => handleModeSwitch("budgeting")}
                        />
                        <ModeOption
                            mode="markets"
                            label="Markets"
                            currentMode={mode}
                            onHover={() => prefetchTo(getModeHref("markets"))}
                            onClick={() => handleModeSwitch("markets")}
                        />
                        <ModeOption
                            mode="wallet"
                            label="Wallet"
                            currentMode={mode}
                            onHover={() => prefetchTo(getModeHref("wallet"))}
                            onClick={() => handleModeSwitch("wallet")}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function ModeOption({
    mode,
    label,
    currentMode,
    onHover,
    onClick
}: {
    mode: AppMode;
    label: string;
    currentMode: AppMode;
    onHover: () => void;
    onClick: () => void;
}) {
    const isSelected = mode === currentMode;

    return (
        <button
            onMouseEnter={onHover}
            onFocus={onHover}
            onClick={onClick}
            className={`
                w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-all
                ${isSelected
                    ? "text-[#2563EB]"
                    : "text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
                }
            `}
        >
            <span>{label}</span>
            {isSelected && (
                <svg className="w-4 h-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            )}
        </button>
    );
}
