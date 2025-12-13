"use client";

import { NavIcon } from "@/lib/navigation";

export function NavIconBadge({ icon }: { icon: NavIcon }) {
  const className = "w-4 h-4";

  switch (icon) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 4l9 6.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10v9h5v-5h4v5h5v-9" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4.5 6v6c0 4.28 2.99 8.19 7.5 9 4.51-.81 7.5-4.72 7.5-9V6L12 3Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.5 11 14l4-4" />
        </svg>
      );
    case "receipt":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h10l2 3v13l-2-1-2 1-2-1-2 1-2-1-2 1V6l2-3Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h6M9 13h6" />
        </svg>
      );
    case "trend":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 17 10 11l4 4 6-8" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 7h5v5" />
        </svg>
      );
    case "ledger":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h11l3 3v13H6z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9h14" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 13h4M10 17h4" />
        </svg>
      );
    default:
      return null;
  }
}
