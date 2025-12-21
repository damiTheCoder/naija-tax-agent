export type NavIcon = "home" | "shield" | "receipt" | "trend" | "ledger" | "chart" | "calculator" | "folder" | "chat" | "bank" | "report";

export type AppMode = "tax" | "accounting";

export interface TaxNavItem {
  label: string;
  href: string;
  icon: NavIcon;
  description?: string;
  mode?: AppMode; // Which mode this nav item belongs to
}

// Tax-related navigation items
export const TAX_NAV_ITEMS: TaxNavItem[] = [
  {
    label: "Main Tax Computation",
    href: "/main",
    icon: "calculator",
    description: "Overview and core tax form",
    mode: "tax",
  },
  {
    label: "Withholding Tax",
    href: "/tax-tools/wht",
    icon: "shield",
    description: "Record payments subject to WHT",
    mode: "tax",
  },
  {
    label: "Value Added Tax",
    href: "/tax-tools/vat",
    icon: "receipt",
    description: "Quick VAT estimator",
    mode: "tax",
  },
  {
    label: "Capital Gains Tax",
    href: "/tax-tools/cgt",
    icon: "trend",
    description: "Asset disposal calculator",
    mode: "tax",
  },
];

// Accounting-related navigation items
export const ACCOUNTING_NAV_ITEMS: TaxNavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "chart",
    description: "Business metrics and analytics",
    mode: "accounting",
  },
  {
    label: "Accounting Studio",
    href: "/accounting",
    icon: "ledger",
    description: "Generate financial statements",
    mode: "accounting",
  },
  {
    label: "Files Workspace",
    href: "/accounting/workspace",
    icon: "folder",
    description: "Real-time journals, ledgers, and statements",
    mode: "accounting",
  },
  {
    label: "Bank Connections",
    href: "/accounting/banks",
    icon: "bank",
    description: "Connect and sync bank feeds",
    mode: "accounting",
  },
  {
    label: "Reports",
    href: "/accounting/reports",
    icon: "report",
    description: "Financial reports and exports",
    mode: "accounting",
  },
  {
    label: "AI Chat",
    href: "/accounting/chat",
    icon: "chat",
    description: "Talk to your accounting records",
    mode: "accounting",
  },
];
