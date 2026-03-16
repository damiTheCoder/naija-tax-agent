export type NavIcon = "home" | "shield" | "receipt" | "trend" | "ledger" | "chart" | "calculator" | "folder" | "chat" | "bank" | "report" | "cashflow" | "intelligence" | "wallet" | "spreadsheet" | "users" | "shop" | "message-square";

export type AppMode = "tax" | "accounting" | "budgeting" | "intelligence" | "wallet" | "supersheet" | "marketplace" | "payroll" | "personal";

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
    label: "Tax Workspace",
    href: "/tax/workspace",
    icon: "chat",
    description: "Chat + uploads for live tax classification",
    mode: "tax",
  },
  {
    label: "Tax Computation",
    href: "/tax/computation",
    icon: "calculator",
    description: "Transparent tax computations from accounting records",
    mode: "tax",
  },
  {
    label: "Tax Returns",
    href: "/tax/returns",
    icon: "report",
    description: "Filing center for VAT, CIT, PAYE, and WHT returns",
    mode: "tax",
  },
  {
    label: "File Taxes",
    href: "/tax/file-taxes",
    icon: "folder",
    description: "Generate documents, download returns, upload filings, and track submissions",
    mode: "tax",
  },
  {
    label: "Tax Payments",
    href: "/tax/payments",
    icon: "cashflow",
    description: "Track payment history, outstanding taxes, receipts, and payment status",
    mode: "tax",
  },
  {
    label: "Tax Calendar",
    href: "/tax/calendar",
    icon: "trend",
    description: "Compliance calendar for filing and payment deadlines with reminders",
    mode: "tax",
  },
  {
    label: "Tax Adjustments",
    href: "/tax/adjustments",
    icon: "spreadsheet",
    description: "Accountant-level deductions, allowances, tax credits, and manual adjustments",
    mode: "tax",
  },
  {
    label: "Tax Settings",
    href: "/tax/settings",
    icon: "shield",
    description: "Configure jurisdiction, tax rates, company information, and fiscal year settings",
    mode: "tax",
  },
  {
    label: "Tax Transactions",
    href: "/tax/transactions",
    icon: "ledger",
    description: "Source-of-truth taxable transactions table",
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
    label: "Financial Projections",
    href: "/accounting/projections",
    icon: "trend",
    description: "Forecast revenue, expenses, and cash position",
    mode: "accounting",
  },
  {
    label: "Financial Modelling",
    href: "/accounting/projections/modelling",
    icon: "spreadsheet",
    description: "Build assumptions, scenarios, and AI-native forecast models",
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
    label: "Vendors",
    href: "/accounting/vendors",
    icon: "users",
    description: "Manage supplier records and AP counterparties",
    mode: "accounting",
  },
  {
    label: "Bills (AP)",
    href: "/accounting/bills",
    icon: "ledger",
    description: "Draft, submit, approve, and pay bills",
    mode: "accounting",
  },
  {
    label: "Approvals",
    href: "/accounting/approvals",
    icon: "shield",
    description: "Owner/manager approval queue and policy controls",
    mode: "accounting",
  },
  {
    label: "Period Locks",
    href: "/accounting/periods",
    icon: "folder",
    description: "Close books and lock posting periods",
    mode: "accounting",
  },
  {
    label: "Recurring",
    href: "/accounting/recurring",
    icon: "trend",
    description: "Template recurring bills and journals",
    mode: "accounting",
  },
  {
    label: "Exchange Rates",
    href: "/accounting/fx",
    icon: "cashflow",
    description: "Maintain FX rates for NGN-base reporting",
    mode: "accounting",
  },
  {
    label: "Dimensions",
    href: "/accounting/dimensions",
    icon: "spreadsheet",
    description: "Track class and location dimensions",
    mode: "accounting",
  },
  {
    label: "Action Logs",
    href: "/accounting/action-logs",
    icon: "message-square",
    description: "Track AI/accounting execution receipts and statuses",
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
    label: "Fixed Assets",
    href: "/accounting/assets",
    icon: "ledger",
    description: "Track fixed assets and net book values from the ledger",
    mode: "accounting",
  },
  {
    label: "Depreciation",
    href: "/accounting/depreciation",
    icon: "trend",
    description: "Automatic depreciation schedule and monthly journal guidance",
    mode: "accounting",
  },
  {
    label: "Support",
    href: "/support",
    icon: "message-square",
    description: "Report issues and track support resolution",
    mode: "accounting",
  },
];

// Budgeting module navigation
export const BUDGETING_NAV_ITEMS: TaxNavItem[] = [
  {
    label: "Budget Dashboard",
    href: "/budgeting/dashboard",
    icon: "chart",
    description: "Overview of budget utilization, alerts, and risks",
    mode: "budgeting",
  },
  {
    label: "Budgets",
    href: "/budgeting/budgets",
    icon: "folder",
    description: "View and manage all budgets",
    mode: "budgeting",
  },
  {
    label: "Create / Edit Budget",
    href: "/budgeting/budgets/new",
    icon: "calculator",
    description: "Create a new budget or edit an existing one",
    mode: "budgeting",
  },
  {
    label: "Categories Budget",
    href: "/budgeting/categories",
    icon: "ledger",
    description: "Control budgets per spending category",
    mode: "budgeting",
  },
  {
    label: "Department Budgets",
    href: "/budgeting/departments",
    icon: "users",
    description: "Allocate and monitor departmental budgets",
    mode: "budgeting",
  },
  {
    label: "Forecasting",
    href: "/budgeting/forecasting",
    icon: "trend",
    description: "Forecast cash, expense, and revenue outcomes",
    mode: "budgeting",
  },
  {
    label: "Scenario Planning",
    href: "/budgeting/scenarios",
    icon: "spreadsheet",
    description: "Simulate financial what-if scenarios",
    mode: "budgeting",
  },
  {
    label: "Variance Analysis",
    href: "/budgeting/variance",
    icon: "report",
    description: "Analyze plan vs actual variance by category",
    mode: "budgeting",
  },
  {
    label: "Budget vs Actual",
    href: "/budgeting/budget-vs-actual",
    icon: "cashflow",
    description: "Visual comparison of budgeted and actual amounts",
    mode: "budgeting",
  },
  {
    label: "Budget Templates",
    href: "/budgeting/templates",
    icon: "bank",
    description: "Use reusable budget templates",
    mode: "budgeting",
  },
  {
    label: "AI Budget Assistant",
    href: "/budgeting/ai-assistant",
    icon: "chat",
    description: "AI guidance for optimization and budgeting decisions",
    mode: "budgeting",
  },
];

// Payroll & Compliance navigation
export const PAYROLL_NAV_ITEMS: TaxNavItem[] = [
  {
    label: "Staff List",
    href: "/accounting/employees",
    icon: "users",
    description: "Manage employee records",
    mode: "payroll",
  },
  {
    label: "Run Payroll",
    href: "/accounting/payroll",
    icon: "report",
    description: "Process monthly salaries",
    mode: "payroll",
  },
];


// Intelligence/Cash Management navigation (standalone)
export const INTELLIGENCE_NAV_ITEMS: TaxNavItem[] = [
  {
    label: "Financial Management",
    href: "/cashflow-intelligence",
    icon: "intelligence",
    description: "Cashflow analytics, treasury movement, and investment tools",
    mode: "intelligence",
  },
  {
    label: "Financial Ratios",
    href: "/cashflow-intelligence/ratios",
    icon: "report",
    description: "Profitability, liquidity, and solvency ratios",
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

// SuperSheet navigation
export const SUPERSHEET_NAV_ITEMS: TaxNavItem[] = [
  {
    label: "SuperSheet",
    href: "/supersheet",
    icon: "spreadsheet",
    description: "AI-powered spreadsheet for calculations and analysis",
    mode: "supersheet",
  },
];

// Marketplace navigation
export const MARKETPLACE_NAV_ITEMS: TaxNavItem[] = [
  {
    label: "Browse Professionals",
    href: "/marketplace",
    icon: "shop",
    description: "Find accountants and tax consultants",
    mode: "marketplace",
  },
  {
    label: "My Profile",
    href: "/marketplace/profile",
    icon: "shop",
    description: "Manage your professional listing",
    mode: "marketplace",
  },
];

// Personal OS navigation
export const PERSONAL_NAV_ITEMS: TaxNavItem[] = [
  {
    label: "Chat",
    href: "/personal",
    icon: "chat",
    description: "Talk to your finances",
    mode: "personal",
  },
  {
    label: "Dashboard",
    href: "/personal/dashboard",
    icon: "chart",
    description: "Investment and portfolio metrics",
    mode: "personal",
  },
  {
    label: "Connected Apps",
    href: "/personal/apps",
    icon: "bank",
    description: "Manage linked financial services",
    mode: "personal",
  },
];
