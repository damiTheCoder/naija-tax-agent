"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_LOGO_ALT, SIDEBAR_LOGO_SRC } from "@/lib/constants";
import { TAX_NAV_ITEMS, ACCOUNTING_NAV_ITEMS, INTELLIGENCE_NAV_ITEMS, WALLET_NAV_ITEMS, SUPERSHEET_NAV_ITEMS, MARKETPLACE_NAV_ITEMS, PAYROLL_NAV_ITEMS, PERSONAL_NAV_ITEMS, AppMode } from "@/lib/navigation";
import { useNavigation } from "@/lib/NavigationContext";
import { NavIconBadge } from "./NavIconBadge";
import BottomSidebar from "./BottomSidebar";
import {
  PERSONAL_CHAT_HISTORY_UPDATED_EVENT,
  ChatHistoryEntry,
  formatHistoryTime,
  loadChatHistory,
  selectChatHistoryEntry,
} from "@/lib/personalChatHistory";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { navigateTo } = useNavigation();

  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>([]);

  // Determine initial mode based on current path
  const getInitialMode = (): AppMode => {
    if (pathname.startsWith("/personal")) return "personal";
    if (pathname.startsWith("/marketplace")) return "marketplace";
    if (pathname.startsWith("/supersheet")) return "supersheet";
    if (pathname.startsWith("/wallet")) return "wallet";
    if (pathname.startsWith("/cashflow-intelligence")) return "intelligence";
    if (pathname.startsWith("/accounting/employees") || pathname.startsWith("/accounting/payroll")) return "payroll";
    if (pathname.startsWith("/accounting") || pathname.startsWith("/dashboard")) return "accounting";
    return "tax";
  };

  const mode = getInitialMode();

  useEffect(() => {
    const refreshHistory = () => {
      setChatHistory(loadChatHistory());
    };
    refreshHistory();
    window.addEventListener("storage", refreshHistory);
    window.addEventListener(PERSONAL_CHAT_HISTORY_UPDATED_EVENT, refreshHistory);
    return () => {
      window.removeEventListener("storage", refreshHistory);
      window.removeEventListener(PERSONAL_CHAT_HISTORY_UPDATED_EVENT, refreshHistory);
    };
  }, []);

  const navItems = mode === "personal"
    ? PERSONAL_NAV_ITEMS
    : mode === "tax"
      ? TAX_NAV_ITEMS
      : mode === "intelligence"
        ? INTELLIGENCE_NAV_ITEMS
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
        className="hidden lg:flex fixed left-3 top-3 bottom-0 w-60 flex-col z-50 overflow-hidden rounded-t-2xl"
        style={{
          background: '#000000',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        {/* Decorative gradient blurs - removed for cleaner look */}

        {/* Logo Section */}
        <div className="px-2 py-3 space-y-2">
          <Link href="/" className="flex items-center gap-3 group px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors">
            <div className="relative w-9 h-9 overflow-hidden rounded-full transition-all">
              <Image src={SIDEBAR_LOGO_SRC} alt={APP_LOGO_ALT} fill className="object-cover" sizes="36px" priority />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-white">Quantum Ledger</h1>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav-scrollbar flex-1 px-2 pr-1 space-y-1 overflow-y-auto mt-2">
          <p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 opacity-80">
            {mode === "personal" ? "Personal OS" : mode === "tax" ? "Tax Tools" : mode === "intelligence" ? "Financial Management" : mode === "wallet" ? "Wallet" : mode === "supersheet" ? "SuperSheet" : mode === "marketplace" ? "Marketplace" : mode === "payroll" ? "Payroll & Compliance" : "Accounting"}
          </p>
          {navItems.map((item) => {
            // Exact match or exact path match (not startsWith to avoid /accounting matching /accounting/workspace)
            const isActive = pathname === item.href;
            const isNavigating = navigatingTo === item.href && pathname !== item.href;

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
                    ? "text-[#2264ff] font-semibold"
                    : "text-white/70 hover:text-white"
                  }
                `}
              >
                {/* Icon */}
                <span className={`w-5 h-5 flex items-center justify-center transition-opacity ${isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
                  {isNavigating ? (
                    <div className="w-3.5 h-3.5 rounded-full bg-white/20 animate-pulse" />
                  ) : (
                    <NavIconBadge icon={item.icon} className="w-4 h-4" />
                  )}
                </span>

                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Chat History Section */}
        <div className="sidebar-nav-scrollbar px-2 pr-1 mt-4 space-y-1 overflow-y-auto max-h-44 pt-4 pb-4">
          <p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 opacity-80">
            Chat History
          </p>
          {chatHistory.length === 0 ? (
            <p className="px-2 py-1 text-xs text-white/45">No chats yet</p>
          ) : (
            chatHistory.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  selectChatHistoryEntry(item);
                  const sameRoute = pathname === item.route;
                  if (!sameRoute) {
                    navigateTo(item.route);
                  }
                }}
                className={`
                  relative flex items-start gap-3 px-2 py-1.5 rounded-md text-[13px] transition-all duration-200 w-full text-left group my-0.5
                  text-white/70 hover:text-white hover:bg-white/5
                `}
              >
                <span className="w-5 h-5 flex items-center justify-center opacity-70 group-hover:opacity-100 mt-0.5">
                  <NavIconBadge icon="message-square" className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="truncate block">{item.title}</span>
                  <span className="truncate block text-[11px] text-white/45">
                    {item.module} · {formatHistoryTime(item.timestamp)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

        <div className="px-2 pb-4 pt-3">
          <BottomSidebar variant="sidebar" />
        </div>
      </aside>

      {/* Mobile Slide Panel - Right side, dark theme */}
      <div className={`
        fixed top-0 right-0 h-screen w-72 bg-[#0a0a0a] flex flex-col z-50 overflow-hidden
        transition-transform duration-300 ease-in-out lg:hidden
        ${isOpen ? "translate-x-0" : "translate-x-full"}
      `}>
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
            {mode === "personal" ? "Personal OS" : mode === "tax" ? "Tax Tools" : mode === "intelligence" ? "Financial Management" : mode === "wallet" ? "Wallet" : mode === "supersheet" ? "SuperSheet" : mode === "marketplace" ? "Marketplace" : mode === "payroll" ? "Payroll & Compliance" : "Accounting"}
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
            const isActive = pathname === item.href;
            const isNavigating = navigatingTo === item.href && pathname !== item.href;

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
