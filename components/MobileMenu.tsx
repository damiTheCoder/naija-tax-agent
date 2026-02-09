"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    TAX_NAV_ITEMS,
    ACCOUNTING_NAV_ITEMS,
    INTELLIGENCE_NAV_ITEMS,
    WALLET_NAV_ITEMS,
    MARKETPLACE_NAV_ITEMS,
    AppMode
} from "@/lib/navigation";
import { useNavigation } from "@/lib/NavigationContext";
import { NavIconBadge } from "./NavIconBadge";
import { SIDEBAR_LOGO_SRC, APP_LOGO_ALT } from "@/lib/constants";
import Image from "next/image";

import { useTheme } from "@/lib/ThemeContext";

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
    const pathname = usePathname();
    const { navigateTo } = useNavigation();
    const { theme } = useTheme();
    const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
    const [expandedModule, setExpandedModule] = useState<AppMode | null>(null);

    const isDark = theme === "dark";

    // Clear navigating state when pathname changes
    useEffect(() => {
        setNavigatingTo(null);
        if (isOpen) {
            // Auto-expand the module matching the current path
            if (pathname.startsWith("/wallet")) setExpandedModule("wallet");
            else if (pathname.startsWith("/cashflow-intelligence")) setExpandedModule("intelligence");
            else if (pathname.startsWith("/accounting") || pathname.startsWith("/dashboard")) setExpandedModule("accounting");
            else if (pathname.startsWith("/marketplace")) setExpandedModule("marketplace");
            else setExpandedModule("tax");
        }
    }, [pathname, isOpen]);

    const toggleModule = (mode: AppMode) => {
        setExpandedModule(expandedModule === mode ? null : mode);
    };

    const modules: { id: AppMode; label: string; items: typeof TAX_NAV_ITEMS }[] = [
        { id: "accounting", label: "Accounting", items: ACCOUNTING_NAV_ITEMS },
        { id: "tax", label: "Tax Manager", items: TAX_NAV_ITEMS },
        { id: "intelligence", label: "Treasury Management", items: INTELLIGENCE_NAV_ITEMS },
        { id: "wallet", label: "Wallet", items: WALLET_NAV_ITEMS },
        { id: "marketplace", label: "Marketplace", items: MARKETPLACE_NAV_ITEMS },
    ];

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity"
                    onClick={onClose}
                />
            )}

            {/* Side Drawer */}
            <div className={`
                fixed top-0 left-0 h-full w-[85vw] max-w-[320px] z-50 
                shadow-2xl flex flex-col
                transform transition-transform duration-300 ease-in-out lg:hidden
                ${isOpen ? "translate-x-0" : "-translate-x-full"}
            `} style={{ background: 'var(--app-bg)' }}>
                {/* Header */}
                <div className="flex items-center justify-between p-5 relative">
                    <Link href="/" className="flex items-center gap-2" onClick={onClose}>
                        <div className="relative w-9 h-9 overflow-hidden rounded-full">
                            <Image src={SIDEBAR_LOGO_SRC} alt={APP_LOGO_ALT} fill className="object-cover" sizes="36px" />
                        </div>
                        <span className="text-base font-bold" style={{ color: isDark ? '#ffffff' : '#000000' }}>Quantum Ledger</span>
                    </Link>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-white/5"
                        style={{ color: isDark ? '#a0a0a0' : '#6b7280' }}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    {/* Bottom Border */}
                    <div className="absolute bottom-0 left-0 right-0 h-[1px]" style={{ background: isDark ? '#333333' : '#e5e5e5' }} />
                </div>

                {/* Modules List */}
                <div className="flex-1 overflow-y-auto py-2">
                    {modules.map((module) => {
                        const isExpanded = expandedModule === module.id;
                        return (
                            <div key={module.id} className="relative">
                                <button
                                    onClick={() => toggleModule(module.id)}
                                    className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-semibold transition-colors"
                                    style={{ color: isExpanded ? '#2264ff' : (isDark ? '#ffffff' : '#000000') }}
                                >
                                    <span>{module.label}</span>
                                    <svg
                                        className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                                {/* Separator Line */}
                                <div className="absolute bottom-0 left-0 right-0 h-[1px]" style={{ background: isDark ? '#333333' : '#e5e5e5' }} />

                                {/* Sub-menu Items */}
                                <div className={`
                                    overflow-hidden transition-all duration-300 ease-in-out bg-gray-50/50 dark:bg-white/5
                                    ${isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}
                                `}>
                                    <div className="px-3 pb-3 pt-1 space-y-1">
                                        {module.items.map((item) => {
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
                                                        w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all
                                                        hover:bg-gray-100 dark:hover:bg-white/10
                                                        ${isActive ? "bg-[#2264ff]/10 font-medium" : ""}
                                                    `}
                                                    style={{
                                                        color: isActive
                                                            ? '#2264ff'
                                                            : (isDark ? '#e5e5e5' : '#000000')
                                                    }}
                                                >
                                                    {isNavigating ? (
                                                        <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                                    ) : (
                                                        <NavIconBadge icon={item.icon} className="w-4 h-4" />
                                                    )}
                                                    <span className="truncate">{item.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Area (Settings/Profile placeholder) */}
                <div className="p-4 mt-auto relative">
                    {/* Top Border */}
                    <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: isDark ? '#333333' : '#e5e5e5' }} />
                    <p className="text-xs text-center" style={{ color: isDark ? '#a0a0a0' : '#9ca3af' }}>
                        © 2025 Quantum Ledger
                    </p>
                </div>
            </div>
        </>
    );
}
