"use client";

import { useState } from "react";
import Image from "next/image";
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
    <header className="sticky top-0 z-50 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow ring-1 ring-gray-100">
            <Image src="/logo.png" alt="Taxy Logo" fill className="object-cover" priority />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-900">Taxy</h1>
            <p className="text-xs text-gray-500 hidden sm:block">Smart Nigerian Tax Manager</p>
          </div>
        </div>

        <div className="relative">
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-600"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 mt-3 w-60 rounded-2xl border border-gray-200 bg-white shadow-xl p-3 space-y-2">
              {TAX_NAV_ITEMS.map((item) => (
                <button
                  key={item.href}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium flex items-center gap-2"
                  onClick={() => handleNavSelect(item.href)}
                >
                  <NavIconBadge icon={item.icon} />
                  <div>{item.label}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
