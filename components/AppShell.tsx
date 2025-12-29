"use client";

import { useState, Suspense } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { APP_LOGO_ALT, APP_LOGO_SRC } from "@/lib/constants";
import { useEffect } from "react";
import { clearAllData } from "@/lib/utils/system";

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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      <div className="min-h-screen flex flex-col bg-[#fafafa]">
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area - offset by sidebar width on desktop */}
      <div className="lg:ml-[252px] min-h-screen flex flex-col">
        {/* Mobile Header Only */}
        <header className="sticky top-0 z-40 bg-[#f5f5f7] lg:hidden">
          <div className="px-4 py-4 flex items-center justify-between">
            {/* Mobile Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="relative w-8 h-8 overflow-hidden rounded-full border-2 border-[#64B5F6]">
                <Image src={APP_LOGO_SRC} alt={APP_LOGO_ALT} fill className="object-cover" priority />
              </div>
              <span className="text-base font-extrabold text-[#0a0a0a]">Insight</span>
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-9 h-9 rounded-lg bg-[#e0e0e0] text-[#333333] flex items-center justify-center p-1.5"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
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
        <footer className="py-6 px-4 lg:px-8 text-center text-sm text-[#999999] border-t border-[#e0e0e0]/50">
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
