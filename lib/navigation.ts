export type NavIcon = "home" | "shield" | "receipt" | "trend" | "ledger";

export interface TaxNavItem {
  label: string;
  href: string;
  icon: NavIcon;
  description?: string;
}

export const TAX_NAV_ITEMS: TaxNavItem[] = [
  {
    label: "Accounting Studio",
    href: "/accounting",
    icon: "ledger",
    description: "Generate financial statements before tax",
  },
  {
    label: "Main Tax Computation",
    href: "/main",
    icon: "home",
    description: "Overview and core tax form",
  },
  {
    label: "Files Workspace",
    href: "/accounting/workspace",
    icon: "ledger",
    description: "Real-time journals, ledgers, and statements",
  },
  {
    label: "Withholding Tax",
    href: "/tax-tools/wht",
    icon: "shield",
    description: "Record payments subject to WHT",
  },
  {
    label: "Value Added Tax",
    href: "/tax-tools/vat",
    icon: "receipt",
    description: "Quick VAT estimator",
  },
  {
    label: "Capital Gains Tax",
    href: "/tax-tools/cgt",
    icon: "trend",
    description: "Capture asset disposals",
  },
];
