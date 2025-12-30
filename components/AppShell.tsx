"use client";

import { useState, Suspense } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import MobileMenu from "@/components/MobileMenu";
import ModeSelector from "@/components/ModeSelector";
import { APP_LOGO_ALT, APP_LOGO_SRC } from "@/lib/constants";
import { useEffect } from "react";
import { clearAllData } from "@/lib/utils/system";
import { useTheme } from "@/lib/ThemeContext";

// Loading spinner component
function PageLoadingSpinner() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-gray-200"></div>
          <div className="absolute inset-0 rounded-full border-2 border-t-[#64B5F6] animate-spin"></div>
        </div>
        <p className="text-sm text-gray-500">Loading page...</p>
      </div>
    </div>
  );
}

// Theme toggle switch component
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
        className={`w-4 h-4 absolute right-1.5 transition-opacity ${isDark ? 'opacity-100 text-[#64B5F6]' : 'opacity-30'}`}
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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme } = useTheme();

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
      <div className="lg:ml-[252px] min-h-screen flex flex-col">
        {/* Desktop Header */}
        <header className="hidden lg:flex sticky top-0 z-30 bg-transparent px-8 py-4 justify-end items-center pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3">
            <ThemeToggle />
            <ModeSelector />
          </div>
        </header>

        {/* Mobile Header Only */}
        <header className="sticky top-0 z-40 lg:hidden transition-colors duration-300" style={{ background: 'var(--app-bg)' }}>
          <div className="px-4 py-4 flex items-center justify-between">
            {/* Mobile Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="relative w-8 h-8 overflow-hidden rounded-full border-2 border-[#64B5F6]">
                <Image src={APP_LOGO_SRC} alt={APP_LOGO_ALT} fill className="object-cover" priority />
              </div>
              <span className="text-base font-extrabold" style={{ color: 'var(--foreground)' }}>Insight</span>
            </Link>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <ModeSelector />
              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="w-9 h-9 rounded-lg flex items-center justify-center p-1.5 transition-colors"
                style={{ background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e0e0e0', color: theme === 'dark' ? '#f5f5f5' : '#333333' }}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8">
          <div className="max-w-6xl mx-auto w-full">
            <Suspense fallback={<PageLoadingSpinner />}>
              {children}
            </Suspense>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-6 px-4 lg:px-8 text-center text-sm border-t transition-colors duration-300" style={{ color: 'var(--muted)', borderColor: 'var(--border)' }}>
          <p>© 2024 Insight · Smart Nigerian Tax Manager</p>
        </footer>
      </div>
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
  return "Insight";
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
