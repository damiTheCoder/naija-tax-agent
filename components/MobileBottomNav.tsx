"use client";

import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { useNavigation } from "@/lib/NavigationContext";
import { resolveModuleForPath, isNavItemActive } from "@/lib/navigation";
import {
  Calculator,
  FileText,
  Folder,
  LayoutDashboard,
  MessageSquare,
  Store,
  Tag,
  UserRound,
  Wallet,
} from "lucide-react";

type MobileNavItem = {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

const MODULE_MOBILE_NAV: Record<string, MobileNavItem[]> = {
  tax: [
    { key: "workspace", label: "Workspace", href: "/tax/workspace", icon: MessageSquare },
    { key: "compute", label: "Compute", href: "/tax/computation", icon: Calculator },
    { key: "returns", label: "Returns", href: "/tax/returns", icon: FileText },
    { key: "profile", label: "Profile", href: "/profile", icon: UserRound },
  ],
  accounting: [
    { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { key: "chat", label: "Accounting", href: "/accounting", icon: Calculator },
    { key: "reporting", label: "Reporting", href: "/accounting/workspace", icon: FileText },
    { key: "profile", label: "Profile", href: "/profile", icon: UserRound },
  ],
  budgeting: [
    { key: "dashboard", label: "Budget", href: "/budgeting/dashboard", icon: LayoutDashboard },
    { key: "budgets", label: "Budgets", href: "/budgeting/budgets", icon: Folder },
    { key: "categories", label: "Categories", href: "/budgeting/categories", icon: Tag },
    { key: "profile", label: "Profile", href: "/profile", icon: UserRound },
  ],
  markets: [
    { key: "markets", label: "Markets", href: "/markets", icon: Store },
    { key: "sme", label: "SME", href: "/markets/profile", icon: UserRound },
    { key: "dashboard", label: "Home", href: "/dashboard", icon: LayoutDashboard },
    { key: "profile", label: "Profile", href: "/profile", icon: UserRound },
  ],
  wallet: [
    { key: "wallet", label: "Wallet", href: "/wallet", icon: Wallet },
    { key: "dashboard", label: "Home", href: "/dashboard", icon: LayoutDashboard },
    { key: "accounting", label: "Accounting", href: "/accounting", icon: MessageSquare },
    { key: "profile", label: "Profile", href: "/profile", icon: UserRound },
  ],
};

const DEFAULT_ITEMS: MobileNavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "chat", label: "Accounting", href: "/accounting", icon: Calculator },
  { key: "reporting", label: "Reporting", href: "/accounting/workspace", icon: FileText },
  { key: "profile", label: "Profile", href: "/profile", icon: UserRound },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { navigateTo, prefetchTo } = useNavigation();
  const module = resolveModuleForPath(pathname);
  const items = MODULE_MOBILE_NAV[module] || DEFAULT_ITEMS;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-4 px-2 py-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = isNavItemActive(pathname, item.href, items);

          return (
            <button
              key={item.key}
              type="button"
              onTouchStart={() => prefetchTo(item.href)}
              onClick={() => {
                if (pathname !== item.href) navigateTo(item.href);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 transition-colors ${
                isActive ? "text-[#4a3880]" : "text-[#8f8f8f]"
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
