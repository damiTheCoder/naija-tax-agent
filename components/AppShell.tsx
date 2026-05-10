"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import MobileMenu from "@/components/MobileMenu";
import DeferredFloatingChat from "@/components/DeferredFloatingChat";
import { APP_LOGO_ALT, SIDEBAR_LOGO_SRC } from "@/lib/constants";
import { clearAllData } from "@/lib/utils/system";
import { useTheme } from "@/lib/ThemeContext";
import { DesktopModeToggle, MobileModeToggle } from "@/components/ModeToggle";
import { useMode } from "@/lib/ModeContext";
import PageSkeleton from "@/components/PageSkeleton";

const ACCOUNTING_MIGRATION_MARKER_KEY = "ql::accounting::migration-v1";
const ACCOUNTING_ENGINE_STORAGE_KEY = "insight::accounting-engine";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPersonalRoute = pathname.startsWith("/personal");
  const [desktopActionsOpen, setDesktopActionsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const desktopActionsRef = useRef<HTMLDivElement | null>(null);
  const mobileActionsRef = useRef<HTMLDivElement | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { mode, mounted } = useMode();
  const isDark = theme === "dark";
  const isUser = mode === "user";
  const isModeMismatch =
    mounted &&
    ((mode === "user" && !isPersonalRoute) || (mode === "enterprise" && isPersonalRoute));

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

    void runMigration();

    return () => {
      active = false;
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

  // Keep route aligned with experience mode to avoid cross-mode UI bleed.
  useEffect(() => {
    if (!mounted) return;
    if (mode === "user") {
      if (!pathname.startsWith("/personal")) router.replace("/personal");
    } else if (pathname.startsWith("/personal")) {
      router.replace("/accounting");
    }
  }, [mode, mounted, pathname, router]);

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
      {/* Sidebar - Desktop Only (always visible on desktop, mobile overlay disabled) */}
      <div className="app-shell-sidebar">
        <Sidebar isOpen={false} onClose={() => { }} />
      </div>

      {/* Mobile Menu Dropdown */}
      <div className="app-shell-mobile-menu">
        <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      </div>

      {/* Main Content Area - offset by sidebar width on desktop */}
      <div className="app-shell-content-wrapper min-h-screen flex w-full flex-col pb-6 sm:pb-8 lg:ml-[25%] lg:w-[75%] lg:pb-0">
        {/* Desktop Header */}
        <header
          className="app-shell-topbar hidden lg:flex sticky top-0 z-50 items-center justify-end px-8 py-3 pointer-events-none backdrop-blur-xl"
          style={{
            background: theme === "dark" ? "rgba(0,0,0,0.82)" : "rgba(253,252,251,0.92)",
          }}
        >
          <div ref={desktopActionsRef} className="pointer-events-auto relative">
            <button
              onClick={() => setDesktopActionsOpen((prev) => !prev)}
              className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
              style={{
                color: isDark ? "#f5f5f5" : "#444444",
                background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.03)",
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
                className="absolute right-0 top-full z-50 mt-3 w-72 overflow-hidden rounded-2xl border shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl"
                style={{
                  background: isDark ? "rgba(17,17,17,0.96)" : "rgba(255,255,255,0.96)",
                  borderColor: isDark ? "rgba(255,255,255,0.08)" : "#f0ece6",
                }}
              >
                <div className="space-y-1 p-2">
                  <div className={`flex items-center gap-3 rounded-xl px-3 py-3 ${isDark ? "text-white" : "text-[#1f1f1f]"}`}>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8fff00]/20 text-[#446b00]">
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
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8fff00]/20 text-[#446b00]">
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
          className="app-shell-topbar sticky top-0 z-40 lg:hidden transition-colors duration-300 backdrop-blur-xl"
          style={{ background: isDark ? "rgba(0,0,0,0.8)" : "rgba(253,252,251,0.94)" }}
        >
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => {
                  setDesktopActionsOpen(false);
                  setMobileActionsOpen(false);
                  setMobileMenuOpen((prev) => !prev);
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors"
                style={{ color: isDark ? "#f5f5f5" : "#444444" }}
                aria-label="Open sidebar"
              >
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                  <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
                  <path strokeLinecap="round" d="M9 5v14M6 8.5h1.5M6 12h1.5M6 15.5h1.5" />
                </svg>
              </button>

              <Link href="/" className="flex min-w-0 items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-lg">
                  <Image src={SIDEBAR_LOGO_SRC} alt={APP_LOGO_ALT} fill className="object-contain" sizes="36px" priority />
                </div>
                <span
                  className="truncate text-[15px] font-semibold tracking-tight"
                  style={{ color: isDark ? "#ffffff" : "#1f1f1f" }}
                >
                  Bace
                </span>
              </Link>
            </div>

            <div ref={mobileActionsRef} className="relative">
              <button
                onClick={() => {
                  setDesktopActionsOpen(false);
                  setMobileMenuOpen(false);
                  setMobileActionsOpen((prev) => !prev);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
                style={{
                  color: isDark ? "#f5f5f5" : "#444444",
                  background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
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
                  className="absolute right-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-2xl border shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl"
                  style={{
                    background: isDark ? "rgba(17,17,17,0.96)" : "rgba(255,255,255,0.96)",
                    borderColor: isDark ? "rgba(255,255,255,0.08)" : "#f0ece6",
                  }}
                >
                  <div className="space-y-1 p-2">
                    <Link
                      href="/profile"
                      onClick={() => setMobileActionsOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${isDark ? "text-white hover:bg-white/5" : "text-[#1f1f1f] hover:bg-[#f8f6f3]"}`}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8fff00]/20 text-[#446b00]">
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

                    <div className={`flex items-center gap-3 rounded-xl px-3 py-3 ${isDark ? "text-white" : "text-[#1f1f1f]"}`}>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8fff00]/20 text-[#446b00]">
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
                        style={{ background: isDark ? "#8fff00" : "#d9d4cd" }}
                        aria-label="Toggle theme"
                      >
                        <span
                          className={`inline-flex h-5 w-5 rounded-full bg-white transition-transform duration-300 ${isDark ? "translate-x-6" : "translate-x-1"}`}
                        />
                      </button>
                    </div>

                    <div className={`flex items-center gap-3 rounded-xl px-3 py-3 ${isDark ? "text-white" : "text-[#1f1f1f]"}`}>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8fff00]/20 text-[#446b00]">
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
        <main className="app-shell-content-main flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
          <div className="app-shell-content-container max-w-[1320px] mx-auto w-full min-w-0">
            <Suspense fallback={<PageSkeleton />}>
              {children}
            </Suspense>

            {!isPersonalRoute && (
              <div className="app-shell-floating-chat">
                <DeferredFloatingChat />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
