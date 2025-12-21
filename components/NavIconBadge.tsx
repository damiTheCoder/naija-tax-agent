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
    case "chart":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16v-4M11 16v-8M15 16v-5M19 16v-10" />
        </svg>
      );
    case "calculator":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h8M8 10h2M11 10h2M14 10h2M8 14h2M11 14h2M14 14h2M8 18h2M11 18h5" />
        </svg>
      );
    case "folder":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h7l2 2h9v11H3z" />
        </svg>
      );
    case "chat":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12c0 4.418-4.03 8-9 8a9.862 9.862 0 0 1-4.255-.92L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01" />
        </svg>
      );
    case "bank":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" />
        </svg>
      );
    case "report":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17H7v-5h2v5ZM13 17h-2V8h2v9ZM17 17h-2v-7h2v7ZM19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2Z" />
        </svg>
      );
    default:
      return null;
  }
}
