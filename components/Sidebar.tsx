"use client";

import { useState, useEffect, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { APP_LOGO_ALT, APP_LOGO_SRC } from "@/lib/constants";
import { TAX_NAV_ITEMS, ACCOUNTING_NAV_ITEMS, INTELLIGENCE_NAV_ITEMS, AppMode } from "@/lib/navigation";
import { NavIconBadge } from "./NavIconBadge";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startNavTransition] = useTransition();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [switchingToMode, setSwitchingToMode] = useState<AppMode | null>(null);

  // Clear navigating state when pathname changes (navigation complete)
  useEffect(() => {
    setNavigatingTo(null);
    setSwitchingToMode(null);
  }, [pathname]);

  // Determine initial mode based on current path
  const getInitialMode = (): AppMode => {
    if (pathname.startsWith("/cashflow-intelligence")) return "intelligence";
    if (pathname.startsWith("/accounting") || pathname.startsWith("/dashboard")) return "accounting";
    return "tax";
  };

  const [mode, setMode] = useState<AppMode>(getInitialMode);

  // Update mode when pathname changes
  useEffect(() => {
    if (pathname.startsWith("/cashflow-intelligence")) {
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
      : ACCOUNTING_NAV_ITEMS;

  const handleModeSwitch = (newMode: AppMode) => {
    if (mode === newMode) return;
    setSwitchingToMode(newMode);
    startNavTransition(() => {
      setMode(newMode);
      // Navigate to the first page of the selected mode
      if (newMode === "tax") {
        router.push("/main");
      } else if (newMode === "intelligence") {
        router.push("/cashflow-intelligence");
      } else {
        router.push("/accounting");
      }
    });
    onClose();
  };

  const ModeToggle = () => (
    <div className="relative py-3 px-5 border-b border-white/10">
      <div className="flex items-center gap-0.5 p-1 bg-white/5 rounded-xl overflow-x-auto hide-scrollbar">
        <button
          onClick={() => handleModeSwitch("accounting")}
          disabled={switchingToMode !== null}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${mode === "accounting"
            ? "text-[#64B5F6]"
            : "text-white/60 hover:text-white hover:bg-white/10"
            } ${switchingToMode === "accounting" ? "bg-white/10" : ""}`}
        >
          {switchingToMode === "accounting" ? (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-[#64B5F6] animate-spin flex-shrink-0" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h11l3 3v13H6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9h14" />
            </svg>
          )}
          <span className="truncate">{switchingToMode === "accounting" ? "Loading..." : "Accounting"}</span>
        </button>
        <button
          onClick={() => handleModeSwitch("tax")}
          disabled={switchingToMode !== null}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${mode === "tax"
            ? "text-[#64B5F6]"
            : "text-white/60 hover:text-white hover:bg-white/10"
            } ${switchingToMode === "tax" ? "bg-white/10" : ""}`}
        >
          {switchingToMode === "tax" ? (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-[#64B5F6] animate-spin flex-shrink-0" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 flex-shrink-0">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h8M8 10h2M14 10h2" />
            </svg>
          )}
          <span className="truncate">{switchingToMode === "tax" ? "Loading..." : "Tax"}</span>
        </button>
        <button
          onClick={() => handleModeSwitch("intelligence")}
          disabled={switchingToMode !== null}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${mode === "intelligence"
            ? "text-[#64B5F6]"
            : "text-white/60 hover:text-white hover:bg-white/10"
            } ${switchingToMode === "intelligence" ? "bg-white/10" : ""}`}
        >
          {switchingToMode === "intelligence" ? (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-[#64B5F6] animate-spin flex-shrink-0" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          )}
          <span className="truncate">{switchingToMode === "intelligence" ? "Loading..." : "Cash"}</span>
        </button>
      </div>
    </div>
  );

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
      <aside className="hidden lg:flex fixed left-3 top-3 bottom-3 w-60 bg-[#0a0a0a] flex-col z-50 overflow-hidden rounded-2xl">
        {/* Decorative gradient blurs */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-[#64B5F6]/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-20 -right-10 w-32 h-32 bg-[#818cf8]/15 rounded-full blur-3xl pointer-events-none"></div>

        {/* Logo Section */}
        <div className="relative p-6 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-8 h-8 overflow-hidden rounded-lg ring-2 ring-[#64B5F6]/30 group-hover:ring-[#64B5F6]/60 transition-all">
              <Image src={APP_LOGO_SRC} alt={APP_LOGO_ALT} fill className="object-cover" priority />
            </div>
            <h1 className="text-lg font-extrabold tracking-tight text-white">Insight</h1>
          </Link>
        </div>

        {/* Mode Toggle */}
        <ModeToggle />

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="px-3 py-2 text-xs font-semibold text-white/40 uppercase tracking-wider">
            {mode === "tax" ? "Tax Tools" : mode === "intelligence" ? "Cash Intelligence" : "Accounting"}
          </p>
          {navItems.map((item) => {
            // Exact match or exact path match (not startsWith to avoid /accounting matching /accounting/workspace)
            const isActive = pathname === item.href;
            const isNavigating = navigatingTo === item.href;

            return (
              <button
                key={item.href}
                onClick={() => {
                  if (pathname !== item.href) {
                    setNavigatingTo(item.href);
                    startNavTransition(() => {
                      router.push(item.href);
                    });
                  }
                }}
                className={`
                  relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 w-full text-left
                  ${isActive
                    ? "bg-[#64B5F6] text-[#0a0a0a]"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                  }
                `}
              >
                {isNavigating ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <NavIconBadge icon={item.icon} />
                )}
                <span>{item.label}</span>
                {isNavigating && (
                  <span className="ml-auto text-xs opacity-60">Loading...</span>
                )}
              </button>
            );
          })}
        </nav>
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

        {/* Mode Toggle */}
        <ModeToggle />

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-2 overflow-hidden">
          <p className="px-3 py-2 text-xs font-semibold text-white/40 uppercase tracking-wider">
            {mode === "tax" ? "Tax Tools" : mode === "intelligence" ? "Cash Intelligence" : "Accounting"}
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
                    startNavTransition(() => {
                      router.push(item.href);
                    });
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
                {isNavigating ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <NavIconBadge icon={item.icon} />
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
