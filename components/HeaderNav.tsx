"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { TAX_NAV_ITEMS } from "@/lib/navigation";
import { NavIconBadge } from "./NavIconBadge";

export default function HeaderNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleNavSelect = (href: string) => {
    if (pathname === href) {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      setIsMenuOpen(false);
      return;
    }

    router.push(href);
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#fafafa]/90 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-11 h-11 overflow-hidden rounded-xl">
            <Image src="/logo.png" alt="Taxy Logo" fill className="object-cover" priority />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-[#0a0a0a]">Taxy</h1>
            <p className="hidden text-xs text-[#666666] sm:block">Smart Nigerian Tax Manager</p>
          </div>
        </Link>

        <div className="relative">
          <button
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-[#0a0a0a] hover:bg-[#faff00]/30 transition-colors"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {isMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsMenuOpen(false)}
              />
              <div className="absolute right-0 mt-3 w-64 rounded-2xl border border-[#e0e0e0]/30 bg-white shadow-xl p-2 space-y-1 z-50 overflow-hidden">
                {/* Colorful blur circles */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#faff00]/40 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-[#818cf8]/30 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-[#ec4899]/20 rounded-full blur-3xl pointer-events-none"></div>
                
                {TAX_NAV_ITEMS.map((item) => (
                  <button
                    key={item.href}
                    className="relative w-full text-left px-4 py-3 rounded-xl hover:bg-[#faff00]/20 text-sm font-medium flex items-center gap-3 text-[#0a0a0a] transition-colors z-10"
                    onClick={() => handleNavSelect(item.href)}
                  >
                    <NavIconBadge icon={item.icon} />
                    <div>{item.label}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
