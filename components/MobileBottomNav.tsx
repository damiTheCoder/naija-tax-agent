"use client";

import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { useNavigation } from "@/lib/NavigationContext";
import { Calculator, FileText, LayoutDashboard, UserRound } from "lucide-react";

type MobileNavItemKey = "dashboard" | "chat" | "reporting" | "profile";

const NAV_ITEMS: Array<{ key: MobileNavItemKey; label: string; href: string; icon: ComponentType<{ className?: string; strokeWidth?: number }> }> = [
    {
        key: "dashboard",
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        key: "chat",
        label: "Accounting",
        href: "/accounting",
        icon: Calculator,
    },
    {
        key: "reporting",
        label: "Reporting",
        href: "/accounting/workspace",
        icon: FileText,
    },
    {
        key: "profile",
        label: "Profile",
        href: "/profile",
        icon: UserRound,
    },
];

export default function MobileBottomNav() {
    const pathname = usePathname();
    const { navigateTo, prefetchTo } = useNavigation();

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 bg-white lg:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            aria-label="Mobile navigation"
        >
            <div className="grid grid-cols-4 px-2 py-1.5">
                {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                        item.href === "/accounting"
                            ? pathname === "/accounting"
                            : pathname === item.href || pathname.startsWith(`${item.href}/`);

                    return (
                        <button
                            key={item.key}
                            type="button"
                            onTouchStart={() => prefetchTo(item.href)}
                            onClick={() => {
                                if (pathname !== item.href) navigateTo(item.href);
                            }}
                            className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 transition-colors ${
                                isActive ? "text-[#446b00]" : "text-[#8f8f8f]"
                            }`}
                            aria-current={isActive ? "page" : undefined}
                            aria-label={item.label}
                            title={item.label}
                        >
                            <Icon className="h-[20px] w-[20px]" strokeWidth={isActive ? 2.4 : 2} />
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
