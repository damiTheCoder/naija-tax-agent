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
  NavIcon,
  ProjectionsModuleOwner,
  TAX_NAV_ITEMS,
  getServerProjectionsModuleOwnerSnapshot,
  getStoredProjectionsModuleOwner,
  isNavItemActive,
  isProjectionsRoute,
  resolveModuleForPath,
  setStoredProjectionsModuleOwner,
  subscribeToProjectionsModuleOwner,
} from "@/lib/navigation";
import { useNavigation } from "@/lib/NavigationContext";
import { NavIconBadge } from "./NavIconBadge";
import { useTheme } from "@/lib/ThemeContext";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const MODULES: { id: AppMode; label: string; icon: NavIcon; href: string; items: typeof TAX_NAV_ITEMS }[] = [
  { id: "accounting", label: "Accounting", icon: "chart", href: "/accounting", items: ACCOUNTING_NAV_ITEMS },
  { id: "tax", label: "Tax Manager", icon: "shield", href: "/tax/workspace", items: TAX_NAV_ITEMS },
  { id: "budgeting", label: "Budgeting", icon: "ledger", href: "/budgeting/dashboard", items: BUDGETING_NAV_ITEMS },
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

  const handleModuleSelect = (module: (typeof MODULES)[number]) => {
    onClose();
    if (module.id === currentModule.id) return;
    setNavigatingTo(module.href);
    navigateTo(module.href);
  };

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
        background: isDark ? "rgba(0,0,0,0.88)" : "rgba(253,252,251,0.94)",
      }}
      aria-label="Primary module navigation"
    >
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center pr-12 sm:pr-14 lg:pr-16">
          <Link href="/" className="flex shrink-0 items-center gap-2" onClick={onClose}>
            <div className="relative h-8 w-8 overflow-hidden rounded-xl sm:h-9 sm:w-9">
              <Image src={SIDEBAR_LOGO_SRC} alt={APP_LOGO_ALT} fill className="object-contain" sizes="36px" priority />
            </div>
            <span className={`text-base font-semibold tracking-tight sm:text-lg ${isDark ? "text-white" : "text-[#1f1f1f]"}`}>
              Bace
            </span>
          </Link>
        </div>

        <div className="sidebar-nav-scrollbar -mr-4 flex min-w-0 items-center gap-2 overflow-x-auto pr-16 sm:pr-20 lg:pr-24">
            {MODULES.map((module) => {
              const isActive = module.id === currentModule.id;
              const isNavigating = navigatingTo === module.href && pathname !== module.href;

              return (
                <button
                  key={module.id}
                  type="button"
                  onMouseEnter={() => prefetchTo(module.href)}
                  onFocus={() => prefetchTo(module.href)}
                  onTouchStart={() => prefetchTo(module.href)}
                  onClick={() => handleModuleSelect(module)}
                  className={`flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-xs font-semibold transition-colors sm:h-10 sm:px-3.5 sm:text-sm ${
                    isActive
                      ? "text-[#5fa800]"
                      : isDark
                        ? "text-white/80 hover:text-white"
                        : "text-[#303030] hover:text-[#5fa800]"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {isNavigating ? (
                    <span className="h-3.5 w-3.5 rounded-full bg-current/25 animate-pulse" />
                  ) : (
                    <NavIconBadge icon={module.icon} className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                  <span className="whitespace-nowrap">{module.label}</span>
                </button>
              );
            })}
        </div>

        <div className="sidebar-nav-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
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
                className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors sm:h-9 sm:gap-2 sm:px-3 sm:text-sm ${
                  isActive
                    ? "bg-[#8fff00] text-[#101010]"
                    : isDark
                      ? "bg-white/5 text-white/72 hover:bg-white/10 hover:text-white"
                      : "bg-[#f3f4f6] text-[#5f5a54] hover:bg-[#e9ecef] hover:text-[#1f1f1f]"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {isNavigating ? (
                  <span className="h-3.5 w-3.5 rounded-full bg-current/25 animate-pulse" />
                ) : (
                  <NavIconBadge icon={item.icon} className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                )}
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
