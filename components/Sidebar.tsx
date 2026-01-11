"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { APP_LOGO_ALT, APP_LOGO_SRC } from "@/lib/constants";
import { TAX_NAV_ITEMS, ACCOUNTING_NAV_ITEMS, INTELLIGENCE_NAV_ITEMS, WALLET_NAV_ITEMS, AppMode } from "@/lib/navigation";
import { useNavigation } from "@/lib/NavigationContext";
import { NavIconBadge } from "./NavIconBadge";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { navigateTo } = useNavigation();

  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  // Clear navigating state when pathname changes (navigation complete)
  useEffect(() => {
    setNavigatingTo(null);
  }, [pathname]);

  // Determine initial mode based on current path
  const getInitialMode = (): AppMode => {

    if (pathname.startsWith("/wallet")) return "wallet";
    if (pathname.startsWith("/cashflow-intelligence")) return "intelligence";
    if (pathname.startsWith("/accounting") || pathname.startsWith("/dashboard")) return "accounting";
    return "tax";
  };

  const [mode, setMode] = useState<AppMode>(getInitialMode);

  // Update mode when pathname changes
  useEffect(() => {
    if (pathname.startsWith("/wallet")) {
      setMode("wallet");
    } else if (pathname.startsWith("/cashflow-intelligence")) {
      setMode("intelligence");
    } else if (pathname.startsWith("/accounting") || pathname.startsWith("/dashboard")) {
      setMode("accounting");
    } else if (pathname.startsWith("/main") || pathname.startsWith("/tax-tools") || pathname.startsWith("/tax")) {
      setMode("tax");
    }
  }, [pathname]);

  const navItems = mode === "tax"
    ? TAX_NAV_ITEMS
    : mode === "intelligence"
      ? INTELLIGENCE_NAV_ITEMS
      : mode === "wallet"
        ? WALLET_NAV_ITEMS
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
        className="hidden lg:flex fixed left-3 top-3 bottom-3 w-60 flex-col z-50 overflow-hidden rounded-2xl"
        style={{
          background: 'var(--app-bg)',
          border: '1px solid var(--border-color, #e5e7eb)'
        }}
      >
        {/* Decorative gradient blurs - removed for cleaner look */}

        {/* Logo Section */}
        <div className="px-2 py-3">
          <Link href="/" className="flex items-center gap-3 group px-2 py-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <div className="relative w-7 h-7 overflow-hidden rounded-md ring-1 ring-[#64B5F6]/30 group-hover:ring-[#64B5F6]/60 transition-all">
              <Image src={APP_LOGO_SRC} alt={APP_LOGO_ALT} fill className="object-cover" priority />
            </div>
            <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>CashOS</h1>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-2 space-y-1 overflow-y-auto mt-2">
          <p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 opacity-80">
            {mode === "tax" ? "Tax Tools" : mode === "intelligence" ? "Cash Intelligence" : mode === "wallet" ? "Wallet" : "Accounting"}
          </p>
          {navItems.map((item) => {
            // Exact match or exact path match (not startsWith to avoid /accounting matching /accounting/workspace)
            const isActive = pathname === item.href;
            const isNavigating = navigatingTo === item.href;

            // Clean, no-background style as requested
            return (
              <button
                key={item.href}
                onClick={() => {
                  if (pathname !== item.href) {
                    setNavigatingTo(item.href);
                    navigateTo(item.href);
                  }
                }}
                className={`
                  relative flex items-center gap-3 px-2 py-1.5 rounded-md text-[15px] transition-all duration-200 w-full text-left group my-0.5
                  ${isActive
                    ? "text-[#64B5F6] font-semibold"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  }
                `}
              >
                {/* Icon */}
                <span className={`w-5 h-5 flex items-center justify-center transition-opacity ${isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
                  {isNavigating ? (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                  ) : (
                    <NavIconBadge icon={item.icon} className="w-4 h-4" />
                  )}
                </span>

                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Profile Switcher Section (Moved to Bottom) */}
        <div className="px-2 py-3 mt-auto">
          <button className="w-full flex items-center gap-2 p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left group">
            <div className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-medium text-gray-700 dark:text-gray-300">
              D
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate flex-1">
              Dami Oluwa's Notion
            </span>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
        </div>
      </aside>

      {/* Mobile Slide Panel - Right side, dark theme */}
      <div className={`
        fixed top-0 right-0 h-screen w-72 bg-[#0a0a0a] flex flex-col z-50 overflow-hidden
        transition-transform duration-300 ease-in-out lg:hidden
        ${isOpen ? "translate-x-0" : "translate-x-full"}
      `}>
        {/* Decorative gradient blurs */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#64B5F6]/20 rounded-full blur-3xl pointer-events-none"></div>
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
        <nav className="flex-1 p-4 space-y-2 overflow-hidden">
          <p className="px-3 py-2 text-xs font-semibold text-white/40 uppercase tracking-wider">
            {mode === "tax" ? "Tax Tools" : mode === "intelligence" ? "Cash Intelligence" : mode === "wallet" ? "Wallet" : "Accounting"}
          </p>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const isNavigating = navigatingTo === item.href;

            return (
              <button
                key={item.href}
                onClick={() => {
                  if (pathname !== item.href) {
                    setNavigatingTo(item.href);
                    navigateTo(item.href);
                  }
                  onClose();
                }}
                className={`
                  relative flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 w-full text-left
                  ${isActive
                    ? "bg-[#64B5F6] text-[#0a0a0a]"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                  }
                `}
              >
                {isNavigating && (
                  <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                )}
                <span>{item.label}</span>
                {isNavigating && (
                  <span className="ml-auto text-xs opacity-60">Loading...</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
