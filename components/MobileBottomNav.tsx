"use client";

import { usePathname } from "next/navigation";
import { useNavigation } from "@/lib/NavigationContext";
import { NavIconBadge } from "@/components/NavIconBadge";
import type { NavIcon } from "@/lib/navigation";
import { useEffect, useState } from "react";

type MobileNavItemKey = "home" | "reports" | "projections" | "tax";

const MOBILE_PROJECTIONS_ENTRY_STORAGE_KEY = "ql::mobile-projections-entry";
const MOBILE_PROJECTIONS_ENTRY_EVENT = "ql:mobile-projections-entry-change";

const NAV_ITEMS: Array<{ key: MobileNavItemKey; label: string; href: string; icon: NavIcon }> = [
    {
        key: "home",
        label: "Home",
        href: "/accounting",
        icon: "home",
    },
    {
        key: "reports",
        label: "Reports",
        href: "/accounting/workspace",
        icon: "report",
    },
    {
        key: "projections",
        label: "Projections",
        href: "/dashboard",
        icon: "trend",
    },
    {
        key: "tax",
        label: "Tax",
        href: "/tax/workspace",
        icon: "calculator",
    },
];

export default function MobileBottomNav() {
    const pathname = usePathname();
    const { navigateTo, prefetchTo } = useNavigation();
    const [isProjectionsEntryMode, setIsProjectionsEntryMode] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const readMode = () => {
            try {
                setIsProjectionsEntryMode(window.localStorage.getItem(MOBILE_PROJECTIONS_ENTRY_STORAGE_KEY) === "1");
            } catch {
                setIsProjectionsEntryMode(false);
            }
        };

        const handleModeEvent = (event: Event) => {
            const customEvent = event as CustomEvent<{ enabled?: boolean }>;
            if (typeof customEvent.detail?.enabled === "boolean") {
                setIsProjectionsEntryMode(customEvent.detail.enabled);
                return;
            }
            readMode();
        };

        readMode();
        window.addEventListener(MOBILE_PROJECTIONS_ENTRY_EVENT, handleModeEvent as EventListener);
        window.addEventListener("storage", readMode);

        return () => {
            window.removeEventListener(MOBILE_PROJECTIONS_ENTRY_EVENT, handleModeEvent as EventListener);
            window.removeEventListener("storage", readMode);
        };
    }, []);

    const updateProjectionsEntryMode = (enabled: boolean) => {
        if (typeof window === "undefined") return;
        try {
            if (enabled) {
                window.localStorage.setItem(MOBILE_PROJECTIONS_ENTRY_STORAGE_KEY, "1");
            } else {
                window.localStorage.removeItem(MOBILE_PROJECTIONS_ENTRY_STORAGE_KEY);
            }
        } catch {
            // no-op
        }
        setIsProjectionsEntryMode(enabled);
        window.dispatchEvent(new CustomEvent(MOBILE_PROJECTIONS_ENTRY_EVENT, { detail: { enabled } }));
    };

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 bg-white lg:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            aria-label="Mobile navigation"
        >
            <div className="grid grid-cols-4 px-2 py-1.5">
                {NAV_ITEMS.map((item) => {
                    const isActive =
                        item.key === "home"
                            ? pathname === "/accounting" && !isProjectionsEntryMode
                            : item.key === "projections"
                                ? pathname.startsWith("/accounting/projections") || (pathname === "/dashboard" && isProjectionsEntryMode)
                                : pathname.startsWith(item.href);

                    return (
                        <button
                            key={item.key}
                            type="button"
                            onTouchStart={() => prefetchTo(item.key === "projections" ? "/dashboard" : item.href)}
                            onClick={() => {
                                if (item.key === "projections") {
                                    updateProjectionsEntryMode(true);
                                    if (pathname !== "/dashboard") {
                                        navigateTo("/dashboard");
                                    }
                                    return;
                                }

                                updateProjectionsEntryMode(false);
                                if (pathname !== item.href) navigateTo(item.href);
                            }}
                            className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 transition-colors ${
                                isActive ? "text-[#2264ff]" : "text-[#8f8f8f]"
                            }`}
                            aria-current={isActive ? "page" : undefined}
                            aria-label={item.label}
                            title={item.label}
                        >
                            <NavIconBadge icon={item.icon} className="h-[20px] w-[20px]" />
                            <span className={`text-[10px] leading-none ${isActive ? "font-semibold" : "font-medium"}`}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
