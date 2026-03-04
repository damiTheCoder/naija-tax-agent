"use client";

import { usePathname } from "next/navigation";
import { useNavigation } from "@/lib/NavigationContext";
import { NavIconBadge } from "@/components/NavIconBadge";
import type { NavIcon } from "@/lib/navigation";

const NAV_ITEMS: Array<{ label: string; href: string; icon: NavIcon }> = [
    {
        label: "Home",
        href: "/accounting",
        icon: "home",
    },
    {
        label: "Reports",
        href: "/accounting/workspace",
        icon: "report",
    },
    {
        label: "Projections",
        href: "/accounting/projections",
        icon: "trend",
    },
    {
        label: "Tax",
        href: "/tax/workspace",
        icon: "calculator",
    },
];

export default function MobileBottomNav() {
    const pathname = usePathname();
    const { navigateTo } = useNavigation();

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 bg-white lg:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            aria-label="Mobile navigation"
        >
            <div className="grid grid-cols-4 px-2 py-1.5">
                {NAV_ITEMS.map((item) => {
                    const isActive =
                        item.href === "/accounting"
                            ? pathname === "/accounting"
                            : pathname.startsWith(item.href);

                    return (
                        <button
                            key={item.href}
                            type="button"
                            onClick={() => {
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
