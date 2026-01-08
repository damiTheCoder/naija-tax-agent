export type NavIcon = "home" | "shield" | "receipt" | "trend" | "ledger" | "chart" | "calculator" | "folder" | "chat" | "bank" | "report" | "cashflow" | "intelligence" | "wallet";

export type AppMode = "tax" | "accounting" | "intelligence" | "wallet";

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
    label: "Tax Workspace",
    href: "/tax/workspace",
    icon: "chat",
    description: "Chat + uploads for live tax classification",
    mode: "tax",
  },
  {
    label: "Tax Agent Chat",
    href: "/tax/chat",
    icon: "chat",
    description: "Dialogue tied directly to the tax engine",
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
    label: "Accounting Chat",
    href: "/accounting",
    icon: "chat",
    description: "Chat-based transaction entry",
    mode: "accounting",
  },
  {
    label: "Financial Reporting",
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
    label: "Invoice Management",
    href: "/accounting/invoices",
    icon: "receipt",
    description: "Create and manage sales invoices",
    mode: "accounting",
  },
  {
    label: "Receipts Management",
    href: "/accounting/receipts",
    icon: "folder",
    description: "Track and organize expense receipts",
    mode: "accounting",
  },
  {
    label: "Chart of Accounts",
    href: "/accounting/reports",
    icon: "report",
    description: "View accounts and post manual entries",
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

// Intelligence/Cash Management navigation (standalone)
export const INTELLIGENCE_NAV_ITEMS: TaxNavItem[] = [
  {
    label: "Cash Intelligence",
    href: "/cashflow-intelligence",
    icon: "intelligence",
    description: "Cashflow analytics, modelling & investment tools",
    mode: "intelligence",
  },
  {
    label: "Cashflow Chat",
    href: "/cashflow-intelligence/chat",
    icon: "chat",
    description: "Set up automations and track returns",
    mode: "intelligence",
  },
];

// Wallet/Fintech navigation
export const WALLET_NAV_ITEMS: TaxNavItem[] = [
  {
    label: "Wallet Home",
    href: "/wallet",
    icon: "wallet",
    description: "Send, receive, and manage money",
    mode: "wallet",
  },
  {
    label: "Transaction History",
    href: "/wallet/history",
    icon: "receipt",
    description: "View all your transactions",
    mode: "wallet",
  },
  {
    label: "Linked Cards",
    href: "/wallet/cards",
    icon: "bank",
    description: "Manage payment cards",
    mode: "wallet",
  },
  {
    label: "Settings",
    href: "/wallet/settings",
    icon: "chart",
    description: "Wallet preferences and security",
    mode: "wallet",
  },
];


