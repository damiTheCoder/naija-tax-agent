"use client";

import { useState, Suspense } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import Sidebar from "@/components/Sidebar";
import MobileMenu from "@/components/MobileMenu";
import ModuleButtonBar from "@/components/ModuleButtonBar";
import { APP_LOGO_ALT, SIDEBAR_LOGO_SRC } from "@/lib/constants";
import { useEffect } from "react";
import { clearAllData } from "@/lib/utils/system";
import { useTheme } from "@/lib/ThemeContext";
import { NavIconBadge } from "@/components/NavIconBadge";
import { DesktopModeToggle, MobileModeToggle } from "@/components/ModeToggle";
import { useMode } from "@/lib/ModeContext";
import UserModeExperience from "@/components/UserModeExperience";
import PageSkeleton from "@/components/PageSkeleton";

const FloatingChatButton = dynamic(() => import("@/components/FloatingChatButton"), {
  ssr: false,
  loading: () => null,
});


export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLanding = pathname === "/";
  const isPersonalRoute = pathname.startsWith("/personal");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme } = useTheme();
  const { mode, mounted } = useMode();
  const isModeMismatch = mounted && ((mode === "user" && !isPersonalRoute) || (mode === "enterprise" && isPersonalRoute));

  useEffect(() => {
    const routesToPrefetch = [
      "/accounting",
      "/dashboard",
      "/accounting/workspace",
      "/accounting/projections",
      "/accounting/projections/modelling",
      "/tax-tools",
      "/wallet",
      "/marketplace",
      "/personal",
      "/personal/dashboard",
    ];

    routesToPrefetch.forEach((route) => {
      router.prefetch(route);
    });
  }, [router]);

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

  if (isLanding) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--cream)' }}>
        <main className="flex-1">{children}</main>
      </div>
    );
  }

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
      <div className="app-shell-content-wrapper lg:ml-[15.75rem] min-h-screen flex flex-col pb-6 sm:pb-8 lg:pb-0">
        {/* Desktop Header */}
        <header
          className="app-shell-topbar hidden lg:flex sticky top-0 z-50 px-8 py-3 justify-between items-center pointer-events-none backdrop-blur-xl"
          style={{
            background: theme === "dark" ? "rgba(0,0,0,0.82)" : "rgba(255,255,255,0.92)",
          }}
        >
          {/* Module Buttons - Left Side */}
          <div className="pointer-events-auto">
            <ModuleButtonBar />
          </div>
          {/* Mode Toggle - Right Side */}
          <div className="pointer-events-auto">
            <DesktopModeToggle />
          </div>
        </header>

        {/* Mobile Header Only */}
        <header
          className="app-shell-topbar sticky top-0 z-40 lg:hidden transition-colors duration-300 backdrop-blur-xl"
          style={{ background: theme === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.85)' }}
        >
          <div className="px-4 py-3 flex items-center justify-between">
            {/* Logo and Name - Left Side */}
            <Link href="/" className="flex items-center gap-2">
              <div className="relative w-9 h-9 overflow-hidden rounded-full">
                <Image src={SIDEBAR_LOGO_SRC} alt={APP_LOGO_ALT} fill className="object-cover" sizes="36px" priority />
              </div>
              <span className="text-lg font-semibold" style={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}>Quantum Ledger</span>
            </Link>

            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Marketplace Link - Mobile */}
              <Link
                href="/marketplace"
                className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                style={{
                  background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                }}
                aria-label="Marketplace"
              >
                <NavIconBadge icon="shop" className="w-4 h-4 text-[#2264ff]" />
              </Link>
              <MobileModeToggle />
              {/* Profile Icon - Mobile */}
              <Link
                href="/profile"
                className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                style={{
                  background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                }}
                aria-label="Profile"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="#2264ff"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </Link>
              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="w-8 h-8 flex items-center justify-center transition-colors"
                style={{ color: theme === 'dark' ? '#f5f5f5' : '#333333' }}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M8 12h12M12 18h8" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="app-shell-content-main flex-1 px-4 sm:px-6 py-4 lg:p-8">
          <div className="app-shell-content-container max-w-6xl mx-auto w-full">
            <Suspense fallback={<PageSkeleton />}>
              {children}
            </Suspense>
          </div>
        </main>
      </div>

      {/* Fixed Bottom Navigation - Visible on ALL screens as requested */}



      {/* Floating Chat Button for transaction input */}
      {!isPersonalRoute && (
        <div className="app-shell-floating-chat">
          <FloatingChatButton />
        </div>
      )}

    </div>
  );
}

function getPageTitle(pathname: string): string {
  if (pathname.includes("/accounting/projections")) return "Financial Projections";
  if (pathname.includes("/accounting/workspace")) return "Accounting Records";
  if (pathname.includes("/accounting")) return "Accounting Studio";
  if (pathname.includes("/dashboard")) return "Dashboard";
  if (pathname.includes("/main")) return "Main Tax Computation";
  if (pathname.includes("/tax-tools/wht")) return "Withholding Tax";
  if (pathname.includes("/tax-tools/vat")) return "Value Added Tax";
  if (pathname.includes("/tax-tools/cgt")) return "Capital Gains Tax";
  return "Quantum Ledger";
}

function getPageDescription(pathname: string): string {
  if (pathname.includes("/accounting/projections")) return "Forward-looking forecasts from your accounting records";
  if (pathname.includes("/accounting/workspace")) return "Real-time journals, ledgers, and statements";
  if (pathname.includes("/accounting")) return "Generate financial statements before tax";
  if (pathname.includes("/dashboard")) return "Business metrics and analytics overview";
  if (pathname.includes("/main")) return "Overview and core tax form";
  if (pathname.includes("/tax-tools/wht")) return "Record payments subject to WHT";
  if (pathname.includes("/tax-tools/vat")) return "Quick VAT estimator";
  if (pathname.includes("/tax-tools/cgt")) return "Capture asset disposals";
  return "Your Financial operating system, automate your accouting, know your projections, estimate your tax liabilities";
}
