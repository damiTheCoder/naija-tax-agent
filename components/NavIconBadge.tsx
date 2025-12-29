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
      // ChatGPT logo - hexagonal aperture design
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
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
    case "cashflow":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      );
    case "intelligence":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
    default:
      return null;
  }
}

