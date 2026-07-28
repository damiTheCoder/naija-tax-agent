"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import DeferredFloatingChat from "@/components/DeferredFloatingChat";
import ModuleButtonBar from "@/components/ModuleButtonBar";
import MobileBottomNav from "@/components/MobileBottomNav";
import { clearAllData } from "@/lib/utils/system";
import { useTheme } from "@/lib/ThemeContext";
import { DesktopModeToggle, MobileModeToggle } from "@/components/ModeToggle";
import { useMode } from "@/lib/ModeContext";
import PageSkeleton from "@/components/PageSkeleton";
import { NavIconBadge } from "@/components/NavIconBadge";
import {
  ACCOUNTING_NAV_ITEMS,
  BUDGETING_NAV_ITEMS,
  MARKETS_NAV_ITEMS,
  TAX_NAV_ITEMS,
  WALLET_NAV_ITEMS,
  isNavItemActive,
  resolveModuleForPath,
  type TaxNavItem,
} from "@/lib/navigation";
import { APP_LOGO_ALT, SIDEBAR_LOGO_SRC } from "@/lib/constants";

const ACCOUNTING_MIGRATION_MARKER_KEY = "ql::accounting::migration-v1";
const ACCOUNTING_ENGINE_STORAGE_KEY = "insight::accounting-engine";
const BANK_CONNECTIONS_STORAGE_KEY = "insight::bank-connections";
const DEMO_BANK_CACHE_CLEANUP_KEY = "bace::demo-bank-cache-cleanup-v3";
const CHAT_MODAL_OPEN_EVENT = "ql:chat-open";
const MOBILE_PRIMARY_NAV_HREFS = new Set(["/dashboard", "/accounting", "/accounting/workspace", "/profile"]);

function getMobileOverflowNavItems(pathname: string): TaxNavItem[] {
  const activeModule = resolveModuleForPath(pathname);
  const items =
    activeModule === "tax"
      ? TAX_NAV_ITEMS
      : activeModule === "budgeting"
        ? BUDGETING_NAV_ITEMS
        : activeModule === "markets"
          ? MARKETS_NAV_ITEMS
          : activeModule === "wallet"
            ? WALLET_NAV_ITEMS
            : ACCOUNTING_NAV_ITEMS;

  return items.filter((item) => !MOBILE_PRIMARY_NAV_HREFS.has(item.href));
}

function isDemoBankConnectionRecord(record: unknown): boolean {
  if (!record || typeof record !== "object") return false;
  const connection = record as {
    id?: unknown;
    bankCode?: unknown;
    transactionCount?: unknown;
    accounts?: Array<{ accountName?: unknown }>;
  };

  return (
    connection.id === "conn_zenith_001" ||
    (connection.bankCode === "zenith" &&
      connection.transactionCount === 847 &&
      Array.isArray(connection.accounts) &&
      connection.accounts.some((account) => account.accountName === "Acme Technologies Ltd"))
  );
}

function isRemovedDemoBankJournalEntry(record: unknown): boolean {
  if (!record || typeof record !== "object") return false;
  const entry = record as { reference?: unknown; matchedBankTransactionId?: unknown; narration?: unknown };
  const reference = String(entry.reference || "").toLowerCase();
  const matchedBankTransactionId = String(entry.matchedBankTransactionId || "").toLowerCase();
  const narration = String(entry.narration || "").toLowerCase();

  return (
    reference.startsWith("bank-sync-") ||
    matchedBankTransactionId.startsWith("sync-") ||
    narration.includes("invoice payment #2026-031") ||
    narration.includes("shoprite ikeja") ||
    narration.includes("ikedc prepaid meter recharge") ||
    narration.includes("salary credit - dec 2025") ||
    narration.includes("office supplies ltd") ||
    narration.includes("sms alert charge")
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPersonalRoute = pathname.startsWith("/personal");
  const [desktopActionsOpen, setDesktopActionsOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [isDesktopChatOpen, setIsDesktopChatOpen] = useState(false);
  const [isChatWaveAnimating, setIsChatWaveAnimating] = useState(false);
  const desktopActionsRef = useRef<HTMLDivElement | null>(null);
  const mobileActionsRef = useRef<HTMLDivElement | null>(null);
  const desktopChatRef = useRef<HTMLDivElement | null>(null);
  const chatWaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatRevealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { mode, mounted } = useMode();
  const isDark = theme === "dark";
  const isUser = mode === "user";
  const isModeMismatch = mounted && isPersonalRoute;
  const mobileOverflowNavItems = getMobileOverflowNavItems(pathname);

  const closeMobileChat = useCallback(() => {
    if (typeof document !== "undefined") {
      document.body.classList.remove("mobile-chat-section-visible");
    }
    setIsMobileChatOpen(false);
    setIsChatWaveAnimating(false);
    if (chatWaveTimeoutRef.current) {
      clearTimeout(chatWaveTimeoutRef.current);
      chatWaveTimeoutRef.current = null;
    }
    if (chatRevealTimeoutRef.current) {
      clearTimeout(chatRevealTimeoutRef.current);
      chatRevealTimeoutRef.current = null;
    }
  }, []);

  const cleanupMobileChatShell = useCallback(() => {
    if (typeof document !== "undefined") {
      document.body.classList.remove("mobile-chat-section-visible");
    }
    if (chatWaveTimeoutRef.current) {
      clearTimeout(chatWaveTimeoutRef.current);
      chatWaveTimeoutRef.current = null;
    }
    if (chatRevealTimeoutRef.current) {
      clearTimeout(chatRevealTimeoutRef.current);
      chatRevealTimeoutRef.current = null;
    }
  }, []);

  const openMobileChat = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    setMobileActionsOpen(false);
    setIsMobileChatOpen(true);
    setIsChatWaveAnimating(true);

    if (chatWaveTimeoutRef.current) {
      clearTimeout(chatWaveTimeoutRef.current);
    }
    if (chatRevealTimeoutRef.current) {
      clearTimeout(chatRevealTimeoutRef.current);
    }
    chatRevealTimeoutRef.current = setTimeout(() => {
      document.body.classList.add("mobile-chat-section-visible");
      window.dispatchEvent(new CustomEvent(CHAT_MODAL_OPEN_EVENT, { detail: { newChat: true } }));
      chatRevealTimeoutRef.current = null;
    }, 820);
    chatWaveTimeoutRef.current = setTimeout(() => {
      setIsChatWaveAnimating(false);
      chatWaveTimeoutRef.current = null;
    }, 1120);
  }, []);

  useEffect(() => {
    if (!isDesktopChatOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (desktopChatRef.current && !desktopChatRef.current.contains(event.target as Node)) {
        setIsDesktopChatOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsDesktopChatOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDesktopChatOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(DEMO_BANK_CACHE_CLEANUP_KEY)) return;

    let changedAccounting = false;

    try {
      const rawConnections = window.localStorage.getItem(BANK_CONNECTIONS_STORAGE_KEY);
      if (rawConnections) {
        const parsedConnections = JSON.parse(rawConnections) as unknown;
        if (Array.isArray(parsedConnections)) {
          const cleanedConnections = parsedConnections.filter((connection) => !isDemoBankConnectionRecord(connection));
          if (cleanedConnections.length !== parsedConnections.length) {
            window.localStorage.setItem(BANK_CONNECTIONS_STORAGE_KEY, JSON.stringify(cleanedConnections));
          }
        }
      }
    } catch {
      window.localStorage.removeItem(BANK_CONNECTIONS_STORAGE_KEY);
    }

    try {
      const rawAccounting = window.localStorage.getItem(ACCOUNTING_ENGINE_STORAGE_KEY);
      if (rawAccounting) {
        const parsedAccounting = JSON.parse(rawAccounting) as { journalEntries?: unknown[]; lastUpdated?: string; [key: string]: unknown };
        const journalEntries = Array.isArray(parsedAccounting.journalEntries) ? parsedAccounting.journalEntries : [];
        const cleanedJournals = journalEntries.filter((entry) => !isRemovedDemoBankJournalEntry(entry));

        if (cleanedJournals.length !== journalEntries.length) {
          window.localStorage.setItem(
            ACCOUNTING_ENGINE_STORAGE_KEY,
            JSON.stringify({
              ...parsedAccounting,
              journalEntries: cleanedJournals,
              lastUpdated: new Date().toISOString(),
            }),
          );
          changedAccounting = true;
        }
      }
    } catch {
      // Leave malformed accounting cache for the accounting engine's own recovery path.
    }

    window.localStorage.setItem(DEMO_BANK_CACHE_CLEANUP_KEY, new Date().toISOString());
    if (changedAccounting) {
      window.dispatchEvent(new CustomEvent("accounting-update", { detail: { source: "demo-bank-cache-cleanup" } }));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pathname.startsWith("/accounting") && !pathname.startsWith("/tax")) return;
    if (window.localStorage.getItem(ACCOUNTING_MIGRATION_MARKER_KEY)) return;

    let active = true;

    const runMigration = async () => {
      try {
        const raw = window.localStorage.getItem(ACCOUNTING_ENGINE_STORAGE_KEY);
        if (!raw) {
          window.localStorage.setItem(ACCOUNTING_MIGRATION_MARKER_KEY, "no-local-data");
          return;
        }

        const parsed = JSON.parse(raw) as { journalEntries?: unknown[]; vendors?: unknown[]; bills?: unknown[] };
        const journals = Array.isArray(parsed.journalEntries) ? parsed.journalEntries : [];
        const vendors = Array.isArray(parsed.vendors) ? parsed.vendors : [];
        const bills = Array.isArray(parsed.bills) ? parsed.bills : [];

        if (journals.length === 0 && vendors.length === 0 && bills.length === 0) {
          window.localStorage.setItem(ACCOUNTING_MIGRATION_MARKER_KEY, "empty-local-snapshot");
          return;
        }

        const clientId = `browser:${window.location.hostname}`;
        const migrateResponse = await fetch("/api/accounting/migrate-local", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityId: "entity-default",
            actorRole: "owner",
            clientId,
            snapshot: {
              journals,
              vendors,
              bills,
            },
          }),
        });

        const migrateData = (await migrateResponse.json().catch(() => ({}))) as { success?: boolean };
        if (!migrateResponse.ok || migrateData.success !== true) return;

        if (journals.length > 0) {
          await fetch("/api/tax/backfill", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entityId: "entity-default",
              journals,
              mode: "apply",
            }),
          }).catch(() => undefined);
        }

        if (active) {
          window.localStorage.setItem(ACCOUNTING_MIGRATION_MARKER_KEY, new Date().toISOString());
        }
      } catch {
        // Leave marker unset so migration can retry later.
      }
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(() => {
        void runMigration();
      }, { timeout: 6000 });
      return () => {
        active = false;
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = globalThis.setTimeout(() => {
      void runMigration();
    }, 2500);

    return () => {
      active = false;
      globalThis.clearTimeout(timeoutId);
    };
  }, [pathname]);

  // Global Keyboard Shortcut: Cmd+Shift+R to Reset System
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+Shift+R (Mac) or Ctrl+Shift+R (Win/Linux)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (confirm("Are you sure you want to reset all system data? This will clear all transactions and cannot be undone.")) {
          clearAllData();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Personal mode routes have been removed; keep legacy links from stranding users.
  useEffect(() => {
    if (!mounted) return;
    if (pathname.startsWith("/personal")) {
      router.replace("/accounting");
    }
  }, [mounted, pathname, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname.startsWith("/api")) return;
    if (process.env.NODE_ENV !== "production") return;

    const payload = JSON.stringify({
      eventType: "page_view",
      module: pathname.split("/")[1] || "landing",
      path: pathname,
      metadata: {
        referrer: document.referrer || "",
      },
    });

    const sendPageView = () => {
      if (navigator.sendBeacon) {
        const sent = navigator.sendBeacon("/api/usage/track", new Blob([payload], { type: "application/json" }));
        if (sent) return;
      }

      fetch("/api/usage/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => undefined);
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(sendPageView, { timeout: 1500 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(sendPageView, 500);
    return () => globalThis.clearTimeout(timeoutId);
  }, [pathname]);

  useEffect(() => {
    if (!desktopActionsOpen && !mobileActionsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const clickedDesktopMenu = desktopActionsRef.current?.contains(target);
      const clickedMobileMenu = mobileActionsRef.current?.contains(target);

      if (!clickedDesktopMenu) {
        setDesktopActionsOpen(false);
      }

      if (!clickedMobileMenu) {
        setMobileActionsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [desktopActionsOpen, mobileActionsOpen]);

  useEffect(() => {
    cleanupMobileChatShell();
  }, [pathname, cleanupMobileChatShell]);

  useEffect(() => {
    return () => {
      cleanupMobileChatShell();
    };
  }, [cleanupMobileChatShell]);

  useEffect(() => {
    if (!isMobileChatOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileChat();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closeMobileChat, isMobileChatOpen]);

  if (isModeMismatch) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--app-bg)' }}>
        <div className="w-full max-w-3xl">
          <PageSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell-root min-h-screen transition-colors duration-300" style={{ background: 'var(--app-bg)' }}>
      <Sidebar isOpen={false} onClose={() => { }} />

      <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr] lg:gap-4">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex lg:flex-col lg:gap-6 lg:py-0 lg:px-4 lg:w-[260px] lg:sticky lg:top-3 lg:h-screen lg:self-start z-50 overflow-hidden">
          <div className="flex items-center gap-2.5 px-2 pt-3 flex-shrink-0">
            <div className="relative h-9 w-9 overflow-hidden rounded-xl">
              <Image src={SIDEBAR_LOGO_SRC} alt={APP_LOGO_ALT} fill className="object-contain" sizes="36px" priority />
            </div>
            <span className={`text-lg font-semibold tracking-tight ${isDark ? "text-white" : "text-[#1f1f1f]"}`}>
              Bace
            </span>
          </div>

          <nav className="flex-1 space-y-6 overflow-y-auto hide-scrollbar">
            {(() => {
              const activeModule = resolveModuleForPath(pathname);
              const items =
                activeModule === "tax"
                  ? TAX_NAV_ITEMS
                  : activeModule === "budgeting"
                    ? BUDGETING_NAV_ITEMS
                    : activeModule === "markets"
                      ? MARKETS_NAV_ITEMS
                      : activeModule === "wallet"
                        ? WALLET_NAV_ITEMS
                        : ACCOUNTING_NAV_ITEMS;

              const sectionMap: Record<string, { label: string; keys: string[] }[]> = {
                accounting: [
                  { label: "Overview", keys: ["Dashboard"] },
                  { label: "Accounting", keys: ["Accounting Chat", "Financial Reporting", "Financial Projections", "Financial Modelling"] },
                  { label: "Banking", keys: ["Bank Connections", "Bank Reconciliation"] },
                  { label: "Vendors", keys: ["Vendors", "Bills (AP)", "Approvals"] },
                  { label: "Settings", keys: ["Period Locks", "Recurring", "Exchange Rates", "Dimensions", "Action Logs", "Receipts Management"] },
                ],
                tax: [
                  { label: "Overview", keys: ["Tax Workspace"] },
                  { label: "Tax Filing", keys: ["Tax Computation", "Tax Returns", "File Taxes"] },
                  { label: "Payments", keys: ["Tax Payments", "Tax Calendar"] },
                  { label: "Management", keys: ["Tax Adjustments", "Tax Settings", "Tax Transactions"] },
                ],
                budgeting: [
                  { label: "Overview", keys: ["Budget Dashboard"] },
                  { label: "Budgeting", keys: ["Budgets", "Create / Edit Budget", "Categories Budget", "Department Budgets"] },
                  { label: "Planning", keys: ["Forecasting", "Scenario Planning", "Variance Analysis", "Budget vs Actual"] },
                  { label: "Settings", keys: ["Budget Templates", "AI Budget Assistant"] },
                ],
                markets: [
                  { label: "Overview", keys: ["Market"] },
                  { label: "SME", keys: ["SME Profile"] },
                ],
                wallet: [
                  { label: "Overview", keys: ["Wallet"] },
                ],
              };

              const sections = sectionMap[activeModule] || sectionMap.accounting;

              return sections.map((section) => {
                const sectionItems = items.filter((item) => section.keys.includes(item.label));
                if (sectionItems.length === 0) return null;

                return (
                  <div key={section.label} className="space-y-1">
                    <p className={`px-3 text-[11px] font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#8a8680]"}`}>
                      {section.label}
                    </p>
                    <div className="space-y-0.5">
                      {sectionItems.map((item) => {
                        const isActive = isNavItemActive(pathname, item.href, items);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                              isActive
                                ? "bg-[#9080ee]/15 text-[#362780]"
                                : isDark
                                  ? "text-white/72 hover:text-white hover:bg-white/5"
                                  : "text-[#5f5a54] hover:text-[#1f1f1f] hover:bg-black/5"
                            }`}
                            aria-current={isActive ? "page" : undefined}
                          >
                            <NavIconBadge icon={item.icon} className="w-4 h-4 mr-2.5 shrink-0" />
                            <span className="whitespace-nowrap">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </nav>
        </aside>

        <div className="min-w-0">
          <div className="app-shell-content-wrapper min-h-screen flex w-full flex-col pb-24 sm:pb-24 lg:pb-0">
            {/* Desktop Header */}
            <header
              className="app-shell-topbar fixed right-4 top-3 z-50 hidden items-center justify-end gap-2 pointer-events-none lg:flex"
              style={{
                background: "transparent",
              }}
            >
              <div className="pointer-events-auto">
                <ModuleButtonBar />
              </div>

              {/* Desktop Chat Popup */}
              <div className="pointer-events-auto relative" ref={desktopChatRef}>
                <button
                  onClick={() => setIsDesktopChatOpen((prev) => !prev)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
                  style={{
                    color: isDark ? "#f5f5f5" : "#444444",
                    background: isDark ? "#000000" : "rgba(0,0,0,0.03)",
                  }}
                  aria-label="Open chat"
                  aria-expanded={isDesktopChatOpen}
                >
                  <Image src="/chatgpt.jpg" alt="" width={34} height={34} className="h-8 w-8 rounded-full object-cover" aria-hidden="true" />
                </button>
                {isDesktopChatOpen && (
                  <div className="absolute right-0 top-full mt-3 w-[420px] z-50">
                    <div className="rounded-2xl border shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-3xl backdrop-saturate-200 overflow-hidden"
                      style={{
                        background: isDark ? "rgba(20,20,20,0.35)" : "rgba(255,255,255,0.96)",
                        borderColor: isDark ? "rgba(255,255,255,0.18)" : "#f0ece6",
                        maxHeight: "calc(100vh - 120px)",
                      }}
                    >
                      <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>
                        <DeferredFloatingChat />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div ref={desktopActionsRef} className="pointer-events-auto relative">
                <button
                  onClick={() => setDesktopActionsOpen((prev) => !prev)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
                  style={{
                    color: isDark ? "#f5f5f5" : "#444444",
                    background: isDark ? "#000000" : "rgba(0,0,0,0.03)",
                  }}
                  aria-label="Open header menu"
                >
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="5.5" cy="12" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="18.5" cy="12" r="1.8" />
                  </svg>
                </button>

                {desktopActionsOpen && (
                  <div
                    className="absolute right-0 top-full z-50 mt-3 w-72 overflow-hidden rounded-2xl border shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-3xl backdrop-saturate-200"
                    style={{
                      background: isDark ? "rgba(20,20,20,0.35)" : "rgba(255,255,255,0.28)",
                      borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.7)",
                    }}
                  >
                    <div className="space-y-1 p-2">
                      <div className={`flex items-center gap-3 px-3 py-3 ${isDark ? "text-white" : "text-[#1f1f1f]"}`}>
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#9080ee]/20 text-[#4a3880]">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0012.56 5.56M19.5 12A7.5 7.5 0 016.94 6.44" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 4.5H19.5v3.75M8.25 19.5H4.5v-3.75" />
                          </svg>
                        </span>
                        <span className="flex-1">
                          <span className="block text-sm font-medium">Switch mode</span>
                          <span className={`block text-xs ${isDark ? "text-white/45" : "text-[#8a8680]"}`}>{isUser ? "Personal" : "Enterprise"}</span>
                        </span>
                        <DesktopModeToggle />
                      </div>

                      <Link
                        href="/profile"
                        onClick={() => setDesktopActionsOpen(false)}
                        className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${isDark ? "text-white hover:bg-white/5" : "text-[#1f1f1f] hover:bg-[#f8f6f3]"}`}
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#9080ee]/20 text-[#4a3880]">
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.8}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                        </span>
                        <span className="flex-1">
                          <span className="block font-medium">Profile</span>
                          <span className={`block text-xs ${isDark ? "text-white/45" : "text-[#8a8680]"}`}>Open account settings</span>
                        </span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </header>

            {/* Mobile Header Only */}
            <header
              className="app-shell-topbar fixed right-4 top-3 z-50 lg:hidden"
              style={{
                background: "transparent",
              }}
            >
              <div className="flex items-center justify-end gap-2">
                <ModuleButtonBar />
                <div ref={mobileActionsRef} className="relative">
                  <button
                    onClick={() => {
                      setDesktopActionsOpen(false);
                      setMobileActionsOpen((prev) => !prev);
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
                    style={{
                      color: isDark ? "#f5f5f5" : "#444444",
                      background: isDark ? "#000000" : "rgba(0,0,0,0.03)",
                    }}
                    aria-label="Open quick menu"
                  >
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="5.5" cy="12" r="1.8" />
                      <circle cx="12" cy="12" r="1.8" />
                      <circle cx="18.5" cy="12" r="1.8" />
                    </svg>
                  </button>

                  {mobileActionsOpen && (
                    <div
                      className="hide-scrollbar absolute right-0 top-full z-50 mt-3 max-h-[72vh] w-72 overflow-hidden rounded-3xl border shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-3xl backdrop-saturate-200"
                      style={{
                        background: isDark ? "rgba(20,20,20,0.35)" : "rgba(255,255,255,0.28)",
                        borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.7)",
                      }}
                    >
                  <div className="space-y-1 p-2">
                    {mobileOverflowNavItems.length > 0 ? (
                      <div className={`border-b pb-2 ${isDark ? "border-white/10" : "border-gray-200"}`}>
                        <p className={`px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] ${isDark ? "text-white/35" : "text-[#8a8680]"}`}>
                          More tools
                        </p>
                        {mobileOverflowNavItems.map((item) => {
                          const isActive = isNavItemActive(pathname, item.href, mobileOverflowNavItems);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setMobileActionsOpen(false)}
                              className={`flex items-center rounded-xl px-3 py-2.5 text-sm transition-colors ${
                                isActive
                                  ? "bg-[#9080ee]/15 text-[#362780]"
                                  : isDark
                                    ? "text-white hover:bg-white/5"
                                    : "text-[#1f1f1f] hover:bg-white/40"
                              }`}
                              aria-current={isActive ? "page" : undefined}
                            >
                              <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}

                    <Link
                      href="/profile"
                      onClick={() => setMobileActionsOpen(false)}
                      className={`flex items-center gap-3 px-3 py-3 text-sm transition-colors ${isDark ? "text-white hover:bg-white/5" : "text-[#1f1f1f] hover:bg-white/40"}`}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#9080ee]/20 text-[#4a3880]">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.8}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      </span>
                      <span className="flex-1">
                        <span className="block font-medium">Profile</span>
                        <span className={`block text-xs ${isDark ? "text-white/45" : "text-[#8a8680]"}`}>Open account settings</span>
                      </span>
                    </Link>

                    <div className={`flex items-center gap-3 px-3 py-3 ${isDark ? "text-white" : "text-[#1f1f1f]"}`}>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#9080ee]/20 text-[#4a3880]">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75 9.75 9.75 0 018.25 6c0-1.33.266-2.596.748-3.752A9.753 9.753 0 1021.752 15.002z" />
                        </svg>
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-medium">Theme</span>
                        <span className={`block text-xs ${isDark ? "text-white/45" : "text-[#8a8680]"}`}>{isDark ? "Dark mode" : "Light mode"}</span>
                      </span>
                      <button
                        onClick={toggleTheme}
                        role="switch"
                        aria-checked={isDark}
                        className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors"
                        style={{ background: isDark ? "#9080ee" : "#d9d4cd" }}
                        aria-label="Toggle theme"
                      >
                        <span
                          className={`inline-flex h-5 w-5 rounded-full bg-white transition-transform duration-300 ${isDark ? "translate-x-6" : "translate-x-1"}`}
                        />
                      </button>
                    </div>

                    <div className={`flex items-center gap-3 rounded-xl px-3 py-3 ${isDark ? "text-white" : "text-[#1f1f1f]"}`}>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#9080ee]/20 text-[#4a3880]">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0012.56 5.56M19.5 12A7.5 7.5 0 016.94 6.44" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 4.5H19.5v3.75M8.25 19.5H4.5v-3.75" />
                        </svg>
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-medium">Switch mode</span>
                        <span className={`block text-xs ${isDark ? "text-white/45" : "text-[#8a8680]"}`}>{isUser ? "Personal" : "Enterprise"}</span>
                      </span>
                      <MobileModeToggle />
                    </div>
                  </div>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Page Content */}
            <main className="app-shell-content-main flex-1 px-2 pb-4 pt-6 sm:px-6 sm:pb-4 lg:px-8 lg:py-8">
              <div className="app-shell-content-container mx-auto w-full min-w-0">
                <Suspense fallback={<PageSkeleton />}>
                  {children}
                </Suspense>
              </div>
            </main>
          </div>
        </div>
      </div>

      {!isPersonalRoute ? (
        <>
          <MobileBottomNav />
          {isChatWaveAnimating ? <div className="mobile-chat-wave" aria-hidden="true" /> : null}
          <button
            type="button"
            onClick={openMobileChat}
            className={`mobile-floating-chat-button ${isChatWaveAnimating ? "is-chat-triggering" : ""}`}
            aria-label="Open chat"
            aria-expanded={isMobileChatOpen}
          >
            <Image src="/chatgpt.jpg" alt="" width={34} height={34} className="h-8 w-8 rounded-full object-cover" aria-hidden="true" />
          </button>
        </>
      ) : null}
    </div>
  );
}
