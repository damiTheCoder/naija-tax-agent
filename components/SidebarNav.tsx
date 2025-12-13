"use client";

import { usePathname, useRouter } from "next/navigation";
import { TAX_NAV_ITEMS } from "@/lib/navigation";
import { NavIconBadge } from "./NavIconBadge";

export default function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="hidden lg:block w-64 shrink-0">
      <nav className="space-y-2 bg-white rounded-2xl border border-[var(--border)] p-4 shadow-sm sticky top-32">
        <p className="text-sm font-semibold text-[var(--muted)] mb-2">Navigate</p>
        {TAX_NAV_ITEMS.map((item) => (
          <button
            key={item.href}
            className={`w-full text-left px-3 py-2 rounded-lg font-semibold text-sm transition flex items-center gap-2 ${
              pathname === item.href ? "bg-[var(--primary)] text-black" : "hover:bg-[var(--background)]"
            }`}
            onClick={() => {
              if (pathname === item.href) {
                if (typeof window !== "undefined") {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              } else {
                router.push(item.href);
              }
            }}
          >
            <span className="text-gray-700">
              <NavIconBadge icon={item.icon} />
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
