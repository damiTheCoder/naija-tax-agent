"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppMode } from "@/lib/navigation";
import { useNavigation } from "@/lib/NavigationContext";

export default function ModeSelector() {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { navigateTo, isNavigating } = useNavigation();

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
        if (pathname.startsWith("/inventory")) return "inventory";
        if (pathname.startsWith("/wallet")) return "wallet";
        if (pathname.startsWith("/cashflow-intelligence")) return "intelligence";
        if (pathname.startsWith("/accounting") || pathname.startsWith("/dashboard")) return "accounting";
        return "tax";
    };

    const mode = getCurrentMode();

    const handleModeSwitch = (newMode: AppMode) => {
        setIsOpen(false);
        if (mode === newMode) return;

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

    const getModeLabel = (m: AppMode) => {
        switch (m) {
            case "tax": return "Tax Manager";
            case "intelligence": return "Cash Intelligence";
            case "accounting": return "Accounting";
            case "wallet": return "Wallet";
            case "inventory": return "Inventory";
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
                        <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
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
                            onClick={() => handleModeSwitch("accounting")}
                        />
                        <ModeOption
                            mode="tax"
                            label="Tax Manager"
                            currentMode={mode}
                            onClick={() => handleModeSwitch("tax")}
                        />
                        <ModeOption
                            mode="intelligence"
                            label="Cash Intelligence"
                            currentMode={mode}
                            onClick={() => handleModeSwitch("intelligence")}
                        />
                        <ModeOption
                            mode="wallet"
                            label="Wallet"
                            currentMode={mode}
                            onClick={() => handleModeSwitch("wallet")}
                        />
                        <ModeOption
                            mode="inventory"
                            label="Inventory"
                            currentMode={mode}
                            onClick={() => handleModeSwitch("inventory")}
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
    onClick
}: {
    mode: AppMode;
    label: string;
    currentMode: AppMode;
    onClick: () => void;
}) {
    const isSelected = mode === currentMode;

    return (
        <button
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

function ModeIcon({ mode, className }: { mode: AppMode; className?: string }) {
    if (mode === "accounting") {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h11l3 3v13H6z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9h14" />
            </svg>
        );
    }

    if (mode === "tax") {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h8M8 10h2M14 10h2" />
            </svg>
        );
    }

    if (mode === "intelligence") {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
        );
    }

    return null;
}
