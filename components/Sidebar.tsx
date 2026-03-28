"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_LOGO_ALT, SIDEBAR_LOGO_SRC } from "@/lib/constants";
import { TAX_NAV_ITEMS, ACCOUNTING_NAV_ITEMS, BUDGETING_NAV_ITEMS, INTELLIGENCE_NAV_ITEMS, WALLET_NAV_ITEMS, SUPERSHEET_NAV_ITEMS, MARKETPLACE_NAV_ITEMS, PAYROLL_NAV_ITEMS, PERSONAL_NAV_ITEMS, AppMode, isNavItemActive, isProjectionsRoute, getStoredProjectionsModuleOwner, getServerProjectionsModuleOwnerSnapshot, setStoredProjectionsModuleOwner, subscribeToProjectionsModuleOwner, resolveModuleForPath } from "@/lib/navigation";
import { useNavigation } from "@/lib/NavigationContext";
import { NavIconBadge } from "./NavIconBadge";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { navigateTo, prefetchTo } = useNavigation();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const projectionsOwner = useSyncExternalStore(
    subscribeToProjectionsModuleOwner,
    getStoredProjectionsModuleOwner,
    getServerProjectionsModuleOwnerSnapshot
  );

  // Determine initial mode based on current path
  const getInitialMode = (): AppMode => {
    return resolveModuleForPath(pathname, projectionsOwner);
  };

  const mode = getInitialMode();


  const navItems = mode === "personal"
    ? PERSONAL_NAV_ITEMS
    : mode === "tax"
      ? TAX_NAV_ITEMS
      : mode === "intelligence"
        ? INTELLIGENCE_NAV_ITEMS
        : mode === "budgeting"
          ? BUDGETING_NAV_ITEMS
          : mode === "wallet"
            ? WALLET_NAV_ITEMS
            : mode === "supersheet"
              ? SUPERSHEET_NAV_ITEMS
              : mode === "marketplace"
                ? MARKETPLACE_NAV_ITEMS
                : mode === "payroll"
                  ? PAYROLL_NAV_ITEMS
                  : ACCOUNTING_NAV_ITEMS;

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
        className="hidden lg:flex fixed left-3 top-4 bottom-0 w-60 flex-col z-50 overflow-hidden rounded-t-[1rem]"
        style={{
          background: 'linear-gradient(180deg, #2f2f33 0%, #18181b 42%, #050505 100%)',
          border: '1px solid rgba(148, 163, 184, 0.28)'
        }}
      >
        {/* Decorative gradient blurs - removed for cleaner look */}

        {/* Logo Section */}
        <div className="px-2 py-3 space-y-2">
          <Link href="/" className="flex items-center gap-3 group px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors">
            <div className="relative w-9 h-9 overflow-hidden rounded-full transition-all">
              <Image src={SIDEBAR_LOGO_SRC} alt={APP_LOGO_ALT} fill className="object-cover" sizes="36px" priority />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-white">Atom Ledger</h1>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav-scrollbar flex-1 px-2 pr-1 space-y-1 overflow-y-auto mt-2">
          <p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-white/40 opacity-90">
            {mode === "personal" ? "Personal OS" : mode === "tax" ? "Tax Tools" : mode === "budgeting" ? "Budgeting" : mode === "intelligence" ? "Financial Management" : mode === "wallet" ? "Wallet" : mode === "supersheet" ? "SuperSheet" : mode === "marketplace" ? "Marketplace" : mode === "payroll" ? "Payroll & Compliance" : "Accounting"}
          </p>
          {navItems.map((item) => {
            const isActive = isNavItemActive(pathname, item.href);
            const isNavigating = navigatingTo === item.href && pathname !== item.href;

            // Clean, no-background style as requested
            return (
              <button
                key={item.href}
                onMouseEnter={() => prefetchTo(item.href)}
                onFocus={() => prefetchTo(item.href)}
                onClick={() => {
                  if (pathname !== item.href) {
                    if (isProjectionsRoute(item.href)) {
                      setStoredProjectionsModuleOwner(mode === "intelligence" ? "intelligence" : "accounting");
                    }
                    setNavigatingTo(item.href);
                    navigateTo(item.href);
                  }
                }}
                className={`
                  relative flex items-center gap-3 px-2 py-1.5 rounded-md text-[15px] transition-all duration-200 w-full text-left group my-0.5
                  ${isActive
                    ? "text-white font-semibold"
                    : "text-white/68 hover:text-white"
                  }
                `}
              >
                {/* Icon */}
                <span className={`w-5 h-5 flex items-center justify-center transition-opacity ${isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
                  {isNavigating ? (
                    <div className="w-3.5 h-3.5 rounded-full bg-white/30 animate-pulse" />
                  ) : (
                    <NavIconBadge icon={item.icon} className="w-4 h-4" />
                  )}
                </span>

                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Slide Panel - Right side, dark theme */}
      <div className={`
        fixed top-0 right-0 h-screen w-72 flex flex-col z-50 overflow-hidden border-l border-white/10
        transition-transform duration-300 ease-in-out lg:hidden
        ${isOpen ? "translate-x-0" : "translate-x-full"}
      `}
        style={{ background: "linear-gradient(180deg, #2f2f33 0%, #18181b 42%, #050505 100%)" }}
      >
        {/* Decorative gradient blurs */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#2264ff]/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-20 -left-10 w-32 h-32 bg-[#818cf8]/15 rounded-full blur-3xl pointer-events-none"></div>

        {/* Close button */}
        <div className="flex items-center justify-end p-5">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav-scrollbar flex-1 p-4 space-y-2 overflow-y-auto">
          <p className="px-3 py-2 text-xs font-semibold text-white/40 uppercase tracking-wider">
            {mode === "personal" ? "Personal OS" : mode === "tax" ? "Tax Tools" : mode === "budgeting" ? "Budgeting" : mode === "intelligence" ? "Financial Management" : mode === "wallet" ? "Wallet" : mode === "supersheet" ? "SuperSheet" : mode === "marketplace" ? "Marketplace" : mode === "payroll" ? "Payroll & Compliance" : "Accounting"}
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
                ? "bg-[#2264ff] text-[#0a0a0a]"
                : "text-white/70 hover:bg-white/10 hover:text-white"}
            `}
          >
            <span className="w-5 h-5 flex items-center justify-center">
              <NavIconBadge icon="shop" className="w-4 h-4" />
            </span>
            <span>Marketplace</span>
          </button>
          {navItems.map((item) => {
            const isActive = isNavItemActive(pathname, item.href);
            const isNavigating = navigatingTo === item.href && pathname !== item.href;

            return (
              <button
                key={item.href}
                onTouchStart={() => prefetchTo(item.href)}
                onClick={() => {
                  if (pathname !== item.href) {
                    if (isProjectionsRoute(item.href)) {
                      setStoredProjectionsModuleOwner(mode === "intelligence" ? "intelligence" : "accounting");
                    }
                    setNavigatingTo(item.href);
                    navigateTo(item.href);
                  }
                  onClose();
                }}
                className={`
                  relative flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 w-full text-left
                  ${isActive
                    ? "bg-[#2264ff] text-[#0a0a0a]"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                  }
                `}
              >
                {isNavigating && (
                  <div className="w-5 h-5 rounded-full bg-white/30 animate-pulse" />
                )}
                <span>{item.label}</span>
                {isNavigating && (
                  <span className="ml-auto h-2 w-12 rounded-full bg-white/20 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
