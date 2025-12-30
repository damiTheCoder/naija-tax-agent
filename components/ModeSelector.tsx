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
        } else {
            navigateTo("/accounting");
        }
    };

    const getModeLabel = (m: AppMode) => {
        switch (m) {
            case "tax": return "Tax Manager";
            case "intelligence": return "Cash Intelligence";
            case "accounting": return "Accounting";
            default: return "Tax Manager";
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#64B5F6]/10 hover:bg-[#64B5F6]/20 transition-all text-sm font-bold text-[#2563EB] w-full md:w-auto justify-between"
            >
                <div className="flex items-center gap-2">
                    {isNavigating ? (
                        <div className="w-4 h-4 rounded-full border-2 border-[#2563EB]/30 border-t-[#2563EB] animate-spin" />
                    ) : (
                        <ModeIcon mode={mode} className="w-5 h-5 text-[#2563EB]" />
                    )}
                    <span>{getModeLabel(mode)}</span>
                </div>
                <svg
                    className={`w-4 h-4 text-[#2563EB] transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-gray-100 shadow-xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="absolute -top-10 -right-10 w-20 h-20 bg-[#64B5F6]/10 rounded-full blur-2xl pointer-events-none"></div>

                    <div className="relative">
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
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
        ${isSelected
                    ? "bg-[#64B5F6]/10 text-[#64B5F6]"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }
      `}
        >
            <ModeIcon mode={mode} className={`w-4 h-4 ${isSelected ? "text-[#64B5F6]" : "text-gray-400"}`} />
            <span>{label}</span>
            {isSelected && (
                <svg className="w-4 h-4 ml-auto text-[#64B5F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
