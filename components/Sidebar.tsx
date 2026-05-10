"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_LOGO_ALT, SIDEBAR_LOGO_SRC } from "@/lib/constants";
import { TAX_NAV_ITEMS, ACCOUNTING_NAV_ITEMS, BUDGETING_NAV_ITEMS, INTELLIGENCE_NAV_ITEMS, WALLET_NAV_ITEMS, SUPERSHEET_NAV_ITEMS, MARKETPLACE_NAV_ITEMS, PAYROLL_NAV_ITEMS, PERSONAL_NAV_ITEMS, AppMode, NavIcon, ProjectionsModuleOwner, isNavItemActive, isProjectionsRoute, getStoredProjectionsModuleOwner, getServerProjectionsModuleOwnerSnapshot, setStoredProjectionsModuleOwner, subscribeToProjectionsModuleOwner, resolveModuleForPath } from "@/lib/navigation";
import { useNavigation } from "@/lib/NavigationContext";
import { NavIconBadge } from "./NavIconBadge";
import { useTheme } from "@/lib/ThemeContext";
import { useMode } from "@/lib/ModeContext";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { navigateTo, prefetchTo } = useNavigation();
  const { theme } = useTheme();
  const { mode: experienceMode } = useMode();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<AppMode | null>(null);
  const projectionsOwner = useSyncExternalStore<ProjectionsModuleOwner>(
    subscribeToProjectionsModuleOwner,
    getStoredProjectionsModuleOwner,
    getServerProjectionsModuleOwnerSnapshot
  );
  const isDark = theme === "dark";

  // Determine initial mode based on current path
  const getInitialMode = (): AppMode => {
    return resolveModuleForPath(pathname, projectionsOwner);
  };

  const currentModule = getInitialMode();
  const currentNavItems = currentModule === "personal"
    ? PERSONAL_NAV_ITEMS
    : currentModule === "tax"
      ? TAX_NAV_ITEMS
      : currentModule === "intelligence"
        ? INTELLIGENCE_NAV_ITEMS
        : currentModule === "budgeting"
          ? BUDGETING_NAV_ITEMS
          : currentModule === "wallet"
            ? WALLET_NAV_ITEMS
            : currentModule === "supersheet"
              ? SUPERSHEET_NAV_ITEMS
              : currentModule === "marketplace"
                ? MARKETPLACE_NAV_ITEMS
                : currentModule === "payroll"
                  ? PAYROLL_NAV_ITEMS
                  : ACCOUNTING_NAV_ITEMS;

  const defaultExpandedModule: AppMode = experienceMode === "user" ? "personal" : currentModule;
  const modules: { id: AppMode; label: string; icon: NavIcon; items: typeof TAX_NAV_ITEMS }[] = experienceMode === "user"
    ? [
      { id: "personal", label: "Personal OS", icon: "chat", items: PERSONAL_NAV_ITEMS },
    ]
    : [
      { id: "accounting", label: "Accounting", icon: "chart", items: ACCOUNTING_NAV_ITEMS },
      { id: "budgeting", label: "Budgeting", icon: "ledger", items: BUDGETING_NAV_ITEMS },
      { id: "payroll", label: "Payroll & Compliance", icon: "users", items: PAYROLL_NAV_ITEMS },
      { id: "tax", label: "Tax Manager", icon: "shield", items: TAX_NAV_ITEMS },
      { id: "intelligence", label: "Financial Management", icon: "intelligence", items: INTELLIGENCE_NAV_ITEMS },
      { id: "wallet", label: "Wallet", icon: "wallet", items: WALLET_NAV_ITEMS },
      { id: "supersheet", label: "SuperSheet", icon: "spreadsheet", items: SUPERSHEET_NAV_ITEMS },
      { id: "marketplace", label: "Marketplace", icon: "shop", items: MARKETPLACE_NAV_ITEMS },
    ];

  const toggleModule = (moduleId: AppMode) => {
    setExpandedModule((current) => (current === moduleId ? null : moduleId));
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar - Desktop (left) */}
      <aside
        className="fixed left-0 top-0 bottom-0 z-50 hidden w-1/4 overflow-hidden lg:flex"
        style={{
          background: isDark
            ? "linear-gradient(180deg, #2f2f33 0%, #18181b 42%, #050505 100%)"
            : "linear-gradient(180deg, #fffefd 0%, #fcfaf8 100%)",
          borderRight: isDark ? "1px solid rgba(148, 163, 184, 0.28)" : "1px solid #f5f1ec",
        }}
      >
        <div className="flex h-full w-full flex-col p-3">
          {/* Logo Section */}
          <div className="space-y-2">
            <Link
              href="/"
              className={`group flex items-center gap-3 rounded-md px-2.5 py-2 transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-white/70"}`}
            >
              <div className="relative h-9 w-9 overflow-hidden rounded-xl transition-all">
                <Image src={SIDEBAR_LOGO_SRC} alt={APP_LOGO_ALT} fill className="object-contain" sizes="36px" priority />
              </div>
              <h1 className={`text-lg font-semibold tracking-tight ${isDark ? "text-white" : "text-[#1f1f1f]"}`}>Bace</h1>
            </Link>
          </div>

          {/* Navigation Items */}
          <nav className="sidebar-nav-scrollbar mt-3 flex-1 space-y-1 overflow-y-auto">
            {modules.map((module) => {
              const isExpanded = (expandedModule ?? defaultExpandedModule) === module.id;
              const isCurrentModule = currentModule === module.id;

              return (
                <div key={module.id} className="space-y-1">
                  <button
                    onClick={() => toggleModule(module.id)}
                    className={`
                      flex w-full items-center justify-between rounded-xl px-2.5 py-2.5 text-left text-sm font-semibold transition-colors
                      ${isCurrentModule
                        ? isDark
                          ? "bg-white/5 text-white"
                          : "bg-white/85 text-[#446b00]"
                        : isDark
                          ? "text-white/72 hover:bg-white/5 hover:text-white"
                          : "text-[#2f2f2f] hover:bg-white/65"}
                    `}
                  >
                    <span className="flex items-center gap-3">
                      <span className={`flex h-5 w-5 items-center justify-center ${isCurrentModule ? "opacity-100" : isDark ? "opacity-80" : "opacity-75"}`}>
                        <NavIconBadge icon={module.icon} className="h-4 w-4" />
                      </span>
                      <span>{module.label}</span>
                    </span>
                    <svg
                      className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <div
                    className={`
                      overflow-hidden rounded-xl transition-all duration-300 ease-in-out
                      ${isExpanded ? "max-h-[32rem] opacity-100" : "max-h-0 opacity-0"}
                      ${isDark ? "bg-white/5" : "bg-white/55"}
                    `}
                  >
                    <div className="space-y-1 px-1.5 py-1.5">
                      {module.items.map((item) => {
                        const isActive = isNavItemActive(pathname, item.href);
                        const isNavigating = navigatingTo === item.href && pathname !== item.href;

                        return (
                          <button
                            key={item.href}
                            onMouseEnter={() => prefetchTo(item.href)}
                            onFocus={() => prefetchTo(item.href)}
                            onClick={() => {
                              if (pathname !== item.href) {
                                if (isProjectionsRoute(item.href)) {
                                  setStoredProjectionsModuleOwner(module.id === "intelligence" ? "intelligence" : "accounting");
                                }
                                setNavigatingTo(item.href);
                                navigateTo(item.href);
                              }
                            }}
                            className={`
                              flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-all
                              ${isActive
                                ? isDark
                                  ? "bg-white/10 text-white font-medium"
                                  : "bg-[#8fff00]/10 text-[#446b00] font-medium"
                                : isDark
                                  ? "text-white/68 hover:bg-white/6 hover:text-white"
                                  : "text-[#5f5a54] hover:bg-white/70 hover:text-[#1f1f1f]"}
                            `}
                          >
                            {isNavigating ? (
                              <div className={`h-4 w-4 rounded-full animate-pulse ${isDark ? "bg-white/30" : "bg-[#cfc9c1]"}`} />
                            ) : (
                              <NavIconBadge icon={item.icon} className="h-4 w-4" />
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
          </nav>
        </div>
      </aside>

      {/* Mobile Slide Panel */}
      <div className={`
        fixed top-0 right-0 h-screen w-72 flex flex-col z-50 overflow-hidden border-l border-white/10
        transition-transform duration-300 ease-in-out lg:hidden
        ${isOpen ? "translate-x-0" : "translate-x-full"}
      `}
        style={{
          background: isDark
            ? "linear-gradient(180deg, #2f2f33 0%, #18181b 42%, #050505 100%)"
            : "#fdfcfb",
          borderColor: isDark ? "rgba(255,255,255,0.1)" : "#f5f1ec",
        }}
      >
        {/* Decorative gradient blurs */}
        {isDark && (
          <>
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#8fff00]/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-20 -left-10 w-32 h-32 bg-[#818cf8]/15 rounded-full blur-3xl pointer-events-none"></div>
          </>
        )}

        {/* Close button */}
        <div className="flex items-center justify-end p-5">
          <button
            onClick={onClose}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-white/80 text-[#1f1f1f] hover:bg-white"}`}
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav-scrollbar flex-1 p-4 space-y-2 overflow-y-auto">
          <p className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#8a8680]"}`}>
            {currentModule === "personal" ? "Personal OS" : currentModule === "tax" ? "Tax Tools" : currentModule === "budgeting" ? "Budgeting" : currentModule === "intelligence" ? "Financial Management" : currentModule === "wallet" ? "Wallet" : currentModule === "supersheet" ? "SuperSheet" : currentModule === "marketplace" ? "Marketplace" : currentModule === "payroll" ? "Payroll & Compliance" : "Accounting"}
          </p>
          <button
            onClick={() => {
              if (!pathname.startsWith("/marketplace")) {
                setNavigatingTo("/marketplace");
                navigateTo("/marketplace");
              }
              onClose();
            }}
            className={`
              relative flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 w-full text-left
              ${pathname.startsWith("/marketplace")
                ? "bg-[#8fff00] text-[#0a0a0a]"
                : isDark
                  ? "text-white/70 hover:bg-white/10 hover:text-white"
                  : "text-[#5f5a54] hover:bg-white/70 hover:text-[#1f1f1f]"}
            `}
          >
            <span className="w-5 h-5 flex items-center justify-center">
              <NavIconBadge icon="shop" className="w-4 h-4" />
            </span>
            <span>Marketplace</span>
          </button>
          {currentNavItems.map((item) => {
            const isActive = isNavItemActive(pathname, item.href);
            const isNavigating = navigatingTo === item.href && pathname !== item.href;

            return (
              <button
                key={item.href}
                onTouchStart={() => prefetchTo(item.href)}
                onClick={() => {
                  if (pathname !== item.href) {
                    if (isProjectionsRoute(item.href)) {
                      setStoredProjectionsModuleOwner(currentModule === "intelligence" ? "intelligence" : "accounting");
                    }
                    setNavigatingTo(item.href);
                    navigateTo(item.href);
                  }
                  onClose();
                }}
                className={`
                  relative flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 w-full text-left
                  ${isActive
                    ? "bg-[#8fff00] text-[#0a0a0a]"
                    : isDark
                      ? "text-white/70 hover:bg-white/10 hover:text-white"
                      : "text-[#5f5a54] hover:bg-white/70 hover:text-[#1f1f1f]"
                  }
                `}
              >
                {isNavigating && (
                  <div className={`w-5 h-5 rounded-full animate-pulse ${isDark ? "bg-white/30" : "bg-[#cfc9c1]"}`} />
                )}
                <span>{item.label}</span>
                {isNavigating && (
                  <span className={`ml-auto h-2 w-12 rounded-full animate-pulse ${isDark ? "bg-white/20" : "bg-[#ddd8d2]"}`} />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
