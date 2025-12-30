"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TAX_NAV_ITEMS, ACCOUNTING_NAV_ITEMS, INTELLIGENCE_NAV_ITEMS, AppMode } from "@/lib/navigation";
import { useNavigation } from "@/lib/NavigationContext";
import { NavIconBadge } from "./NavIconBadge";

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { navigateTo } = useNavigation();
    const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

    // Clear navigating state when pathname changes
    useEffect(() => {
        setNavigatingTo(null);
    }, [pathname]);

    // Determine mode based on path (logic from Sidebar)
    const getInitialMode = (): AppMode => {
        if (pathname.startsWith("/cashflow-intelligence")) return "intelligence";
        if (pathname.startsWith("/accounting") || pathname.startsWith("/dashboard")) return "accounting";
        return "tax";
    };

    const [mode, setMode] = useState<AppMode>(getInitialMode);

    useEffect(() => {
        if (pathname.startsWith("/cashflow-intelligence")) {
            setMode("intelligence");
        } else if (pathname.startsWith("/accounting") || pathname.startsWith("/dashboard")) {
            setMode("accounting");
        } else if (pathname.startsWith("/main") || pathname.startsWith("/tax-tools") || pathname.startsWith("/tax")) {
            setMode("tax");
        }
    }, [pathname]);

    const navItems = mode === "tax"
        ? TAX_NAV_ITEMS
        : mode === "intelligence"
            ? INTELLIGENCE_NAV_ITEMS
            : ACCOUNTING_NAV_ITEMS;

    if (!isOpen) return null;

    return (
        <>
            {/* Invisible backdrop to close menu on click outside */}
            <div
                className="fixed inset-0 z-40 bg-transparent lg:hidden"
                onClick={onClose}
            />

            {/* Dropdown Menu */}
            <div className="absolute top-16 right-4 w-64 z-50 bg-white dark:!bg-[#1a1a1a] rounded-2xl shadow-xl border border-gray-100 dark:border-none lg:hidden overflow-hidden transform origin-top-right transition-all">
                <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">

                    {/* Section Header */}
                    <div className="px-4 py-3 bg-gray-50/50 dark:bg-white/5">
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            {mode === "tax" ? "Tax Tools" : mode === "intelligence" ? "Cash Intelligence" : "Accounting"}
                        </p>
                    </div>

                    {/* Links */}
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        const isNavigating = navigatingTo === item.href;

                        return (
                            <button
                                key={item.href}
                                onClick={() => {
                                    if (pathname !== item.href) {
                                        setNavigatingTo(item.href);
                                        navigateTo(item.href);
                                    }
                                    onClose();
                                }}
                                className={`
                  relative flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left
                  ${isActive
                                        ? "bg-[#64B5F6] text-[#0a0a0a]"
                                        : "text-gray-600 dark:text-white hover:bg-gray-50 dark:hover:bg-transparent"
                                    }
                `}
                            >
                                {isNavigating ? (
                                    <div className="w-5 h-5 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                                ) : (
                                    <NavIconBadge icon={item.icon} />
                                )}
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
