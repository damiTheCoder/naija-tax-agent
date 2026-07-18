"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_LOGO_ALT, SIDEBAR_LOGO_SRC } from "@/lib/constants";
import {
  ACCOUNTING_NAV_ITEMS,
  AppMode,
  BUDGETING_NAV_ITEMS,
  MARKETS_NAV_ITEMS,
  ProjectionsModuleOwner,
  TAX_NAV_ITEMS,
  WALLET_NAV_ITEMS,
  getServerProjectionsModuleOwnerSnapshot,
  getStoredProjectionsModuleOwner,
  isNavItemActive,
  isProjectionsRoute,
  resolveModuleForPath,
  setStoredProjectionsModuleOwner,
  subscribeToProjectionsModuleOwner,
} from "@/lib/navigation";
import { useNavigation } from "@/lib/NavigationContext";
import { useTheme } from "@/lib/ThemeContext";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const MODULES: { id: AppMode; label: string; iconSrc: string; activeColor: string; href: string; items: typeof TAX_NAV_ITEMS }[] = [
  {
    id: "accounting",
    label: "Accounting",
    iconSrc: "/accounting.jpeg?v=20260713-0015",
    activeColor: "#4f8f00",
    href: "/accounting",
    items: ACCOUNTING_NAV_ITEMS,
  },
  {
    id: "tax",
    label: "Tax Manager",
    iconSrc: "/tax.jpeg",
    activeColor: "#3157d5",
    href: "/tax/workspace",
    items: TAX_NAV_ITEMS,
  },
  {
    id: "budgeting",
    label: "Budgeting",
    iconSrc: "/budgeting.jpeg",
    activeColor: "#d05a00",
    href: "/budgeting/dashboard",
    items: BUDGETING_NAV_ITEMS,
  },
  {
    id: "markets",
    label: "Markets",
    iconSrc: "/Market.jpg?v=20260713-1",
    activeColor: "#0f766e",
    href: "/markets",
    items: MARKETS_NAV_ITEMS,
  },
  {
    id: "wallet",
    label: "Wallet",
    iconSrc: "/coin.jpeg",
    activeColor: "#4f8f00",
    href: "/wallet",
    items: WALLET_NAV_ITEMS,
  },
];

function getModuleForPath(pathname: string, projectionsOwner: ProjectionsModuleOwner) {
  const resolved = resolveModuleForPath(pathname, projectionsOwner);
  return MODULES.find((module) => module.id === resolved) ?? MODULES[0];
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const { navigateTo, prefetchTo } = useNavigation();
  const { theme } = useTheme();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const projectionsOwner = useSyncExternalStore<ProjectionsModuleOwner>(
    subscribeToProjectionsModuleOwner,
    getStoredProjectionsModuleOwner,
    getServerProjectionsModuleOwnerSnapshot
  );
  const isDark = theme === "dark";
  const currentModule = getModuleForPath(pathname, projectionsOwner);

  const handleNavSelect = (href: string) => {
    onClose();
    if (pathname === href) {
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (isProjectionsRoute(href)) {
      setStoredProjectionsModuleOwner("accounting");
    }
    setNavigatingTo(href);
    navigateTo(href);
  };

  return (
    <nav
      className="sticky top-0 z-40 backdrop-blur-xl"
      style={{
        background: isDark ? "rgba(0,0,0,0.88)" : "#ffffff",
      }}
      aria-label="Primary module navigation"
    >
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="sidebar-logo-row flex min-w-0 items-center pr-12 sm:pr-14 lg:pr-16">
          <Link href="/" className="flex shrink-0 items-center gap-2" onClick={onClose}>
            <div className="relative h-8 w-8 overflow-hidden rounded-xl sm:h-9 sm:w-9">
              <Image src={SIDEBAR_LOGO_SRC} alt={APP_LOGO_ALT} fill className="object-contain" sizes="36px" priority />
            </div>
            <span className={`text-base font-semibold tracking-tight sm:text-lg ${isDark ? "text-white" : "text-[#1f1f1f]"}`}>
              Bace
            </span>
          </Link>
        </div>

        <div className="sidebar-subnav-row sidebar-nav-scrollbar -mx-4 mt-3 hidden gap-2 overflow-x-auto px-4 pb-1 transition-all duration-200 sm:-mx-6 sm:px-6 lg:-mx-8 lg:flex lg:px-8">
          {currentModule.items.map((item) => {
            const isActive = isNavItemActive(pathname, item.href);
            const isNavigating = navigatingTo === item.href && pathname !== item.href;

            return (
              <button
                key={item.href}
                type="button"
                onMouseEnter={() => prefetchTo(item.href)}
                onFocus={() => prefetchTo(item.href)}
                onTouchStart={() => prefetchTo(item.href)}
                onClick={() => handleNavSelect(item.href)}
                className={`flex h-8 shrink-0 items-center rounded-full px-2.5 text-xs font-medium transition-colors sm:h-9 sm:px-3 sm:text-sm ${
                  isActive
                    ? isDark
                      ? "text-[#8fff00]"
                      : "text-[#4f8f00]"
                    : isDark
                      ? "text-white/72 hover:text-white"
                      : "text-[#5f5a54] hover:text-[#1f1f1f]"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {isNavigating ? (
                  <span className="mr-1.5 h-2 w-2 rounded-full bg-current/30 animate-pulse" />
                ) : null}
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
