"use client";

import { usePathname } from "next/navigation";
import { useNavigation } from "@/lib/NavigationContext";
import { useMemo } from "react";

const NAV_ITEMS: Array<{ label: string; href: string }> = [
    {
        label: "Home",
        href: "/accounting",
    },
    {
        label: "Reports",
        href: "/accounting/workspace",
    },
    {
        label: "Projections",
        href: "/accounting/projections",
    },
    {
        label: "Tax",
        href: "/tax/workspace",
    },
];

export default function MobileBottomNav() {
    const pathname = usePathname();
    const { navigateTo } = useNavigation();
    const activeIndex = useMemo(
        () =>
            NAV_ITEMS.findIndex((item) =>
                item.href === "/accounting" ? pathname === "/accounting" : pathname.startsWith(item.href)
            ),
        [pathname]
    );
    const nextIndex = activeIndex >= 0 ? (activeIndex + 1) % NAV_ITEMS.length : 0;
    const nextItem = NAV_ITEMS[nextIndex];

    return (
        <button
            type="button"
            onClick={() => navigateTo(nextItem.href)}
            className="fixed left-1/2 z-50 inline-flex h-11 w-11 translate-x-[1rem] items-center justify-center rounded-full bg-[#2264ff] text-white shadow-lg transition hover:bg-[#1a50cc] focus:outline-none focus:ring-2 focus:ring-[#2264ff]/40 lg:hidden"
            style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
            aria-label="Go to next page"
            title="Go to next page"
        >
            <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
            </svg>
        </button>
    );
}
