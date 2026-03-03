"use client";

import { usePathname } from "next/navigation";
import { useNavigation } from "@/lib/NavigationContext";
import { useTheme } from "@/lib/ThemeContext";
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
        href: "/accounting/reports",
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
    const { theme } = useTheme();
    const isDark = theme === "dark";

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around lg:hidden"
            style={{
                background: isDark ? "#000000" : "#ffffff",
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
        >
            {NAV_ITEMS.map((item) => {
                const isActive =
                    item.href === "/accounting"
                        ? pathname === "/accounting"
                        : pathname.startsWith(item.href);

                return (
                    <button
                        key={item.href}
                        onClick={() => {
                            if (pathname !== item.href) navigateTo(item.href);
                        }}
                        className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 transition-colors"
                        style={{
                            color: isActive ? "#2264ff" : isDark ? "#888" : "#999",
                        }}
                    >
                        <NavIconBadge icon={item.icon} className="w-[18px] h-[18px]" />
                        <span
                            style={{
                                fontSize: "10px",
                                fontWeight: isActive ? 600 : 400,
                                lineHeight: 1,
                            }}
                        >
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}
