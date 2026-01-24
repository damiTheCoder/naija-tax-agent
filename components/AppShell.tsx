"use client";

import { useState, Suspense } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import MobileMenu from "@/components/MobileMenu";
import BottomSidebar from "@/components/BottomSidebar";
import FloatingChatButton from "@/components/FloatingChatButton";
import ModuleButtonBar from "@/components/ModuleButtonBar";
import { APP_LOGO_ALT, SIDEBAR_LOGO_SRC } from "@/lib/constants";
import { useEffect } from "react";
import { clearAllData } from "@/lib/utils/system";
import { useTheme } from "@/lib/ThemeContext";

// Skeleton loading component - shows placeholder shapes instead of spinner
function PageLoadingSpinner() {
  return (
    <div className="min-h-[60vh] px-4 py-6 space-y-5">
      {/* Header pill - centered */}
      <div className="flex justify-center">
        <div className="h-6 w-24 rounded-full bg-gray-300 dark:bg-gray-600" />
      </div>

      {/* Row with circle, text lines, and circle */}
      <div className="flex items-center gap-3 pt-2">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-28 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-2 w-16 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
      </div>

      {/* Content bars - varying widths */}
      <div className="space-y-3 pt-2">
        <div className="h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-3 w-3/4 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-3 w-1/3 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
      </div>

      {/* Search/input bar skeleton */}
      <div className="h-12 w-full rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />

      {/* Large card skeleton */}
      <div className="h-32 w-full rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse" />

      {/* Bottom row - label and two cards */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="h-3 w-20 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-3 w-16 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-20 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
      </div>
    </div>
  );
}


// Theme toggle switch component (Desktop)
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className="relative w-14 h-7 rounded-full transition-colors duration-300 flex items-center px-1"
      style={{ background: isDark ? '#333333' : '#e0e0e0' }}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {/* Sun icon (left) */}
      <svg
        className={`w-4 h-4 absolute left-1.5 transition-opacity ${isDark ? 'opacity-30' : 'opacity-100 text-amber-500'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
      </svg>

      {/* Moon icon (right) */}
      <svg
        className={`w-4 h-4 absolute right-1.5 transition-opacity ${isDark ? 'opacity-100 text-[#2264ff]' : 'opacity-30'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
      </svg>

      {/* Toggle thumb */}
      <div
        className="w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300"
        style={{ transform: isDark ? 'translateX(28px)' : 'translateX(0)' }}
      />
    </button>
  );
}

// Mobile theme toggle - WhatsApp status style ring
function MobileThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className="relative w-7 h-7 flex items-center justify-center transition-all"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {/* Segmented status ring using SVG */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 36 36"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* First segment */}
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke={isDark ? "#fbbf24" : "#64748b"}
          strokeWidth="2"
          strokeDasharray="25 5"
          strokeLinecap="round"
        />
      </svg>
      {isDark ? (
        // Sun icon when in dark mode (click to go light)
        <svg
          className="w-4 h-4 text-amber-400 relative z-10"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
        </svg>
      ) : (
        // Moon icon when in light mode (click to go dark)
        <svg
          className="w-4 h-4 text-gray-600 relative z-10"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
    </button>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme } = useTheme();

  // Determine if current page is a chat page (has chat input)
  const isChatPage = pathname.startsWith('/accounting') ||
    pathname.startsWith('/tax/chat') ||
    pathname.startsWith('/cashflow-intelligence/chat') ||
    pathname.startsWith('/wallet');

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

  if (isLanding) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--cream)' }}>
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ background: 'var(--app-bg)' }}>
      {/* Sidebar - Desktop Only (always visible on desktop, mobile overlay disabled) */}
      <Sidebar isOpen={false} onClose={() => { }} />

      {/* Mobile Menu Dropdown */}
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main Content Area - offset by sidebar width on desktop */}
      <div className="lg:ml-60 min-h-screen flex flex-col pb-20 lg:pb-0"> {/* pb-20 for mobile BottomNav, lg:pb-0 for desktop */}
        {/* Desktop Header */}
        <header className="hidden lg:flex sticky top-0 z-30 bg-transparent px-8 py-4 justify-between items-center pointer-events-none">
          {/* Module Buttons - Left Side */}
          <div className="pointer-events-auto">
            <ModuleButtonBar />
          </div>
          {/* Theme Toggle - Right Side */}
          <div className="pointer-events-auto">
            <ThemeToggle />
          </div>
        </header>

        {/* Mobile Header Only */}
        <header
          className="sticky top-0 z-40 lg:hidden transition-colors duration-300 backdrop-blur-xl"
          style={{ background: theme === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.85)' }}
        >
          <div className="px-4 py-3 flex items-center justify-between">
            {/* Logo and Name - Left Side */}
            <Link href="/" className="flex items-center gap-2">
              <div className="relative w-9 h-9 overflow-hidden rounded-full">
                <Image src={SIDEBAR_LOGO_SRC} alt={APP_LOGO_ALT} fill className="object-cover" priority />
              </div>
              <span className="text-lg font-semibold" style={{ color: theme === 'dark' ? '#ffffff' : '#000000' }}>CashOS</span>
            </Link>

            <div className="flex items-center gap-1 flex-shrink-0">
              <ThemeToggle />
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
                  stroke={theme === 'dark' ? '#ffffff' : '#333333'}
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
        <main className="flex-1 px-2 py-4 lg:p-8">
          <div className="max-w-6xl mx-auto w-full">
            <Suspense fallback={<PageLoadingSpinner />}>
              {children}
            </Suspense>
          </div>
        </main>
      </div>

      {/* Fixed Bottom Navigation - Visible on ALL screens as requested */}



      {/* Floating Chat Button for transaction input */}
      <FloatingChatButton />

      {/* Bottom-right sidebar with Profile and Workspace links */}
      <BottomSidebar />
    </div>
  );
}

function getPageTitle(pathname: string): string {
  if (pathname.includes("/accounting/workspace")) return "Accounting Records";
  if (pathname.includes("/accounting")) return "Accounting Studio";
  if (pathname.includes("/dashboard")) return "Dashboard";
  if (pathname.includes("/main")) return "Main Tax Computation";
  if (pathname.includes("/tax-tools/wht")) return "Withholding Tax";
  if (pathname.includes("/tax-tools/vat")) return "Value Added Tax";
  if (pathname.includes("/tax-tools/cgt")) return "Capital Gains Tax";
  return "CashOS";
}

function getPageDescription(pathname: string): string {
  if (pathname.includes("/accounting/workspace")) return "Real-time journals, ledgers, and statements";
  if (pathname.includes("/accounting")) return "Generate financial statements before tax";
  if (pathname.includes("/dashboard")) return "Business metrics and analytics overview";
  if (pathname.includes("/main")) return "Overview and core tax form";
  if (pathname.includes("/tax-tools/wht")) return "Record payments subject to WHT";
  if (pathname.includes("/tax-tools/vat")) return "Quick VAT estimator";
  if (pathname.includes("/tax-tools/cgt")) return "Capture asset disposals";
  return "Smart Nigerian Tax Manager";
}
