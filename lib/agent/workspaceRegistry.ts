export type WorkspaceModuleId =
  | "accounting"
  | "tax"
  | "wallet"
  | "budgeting"
  | "cashflow"
  | "marketplace"
  | "personal"
  | "dashboard"
  | "supersheet"
  | "profile"
  | "general";

export interface WorkspacePageDefinition {
  route: string;
  label: string;
  module: WorkspaceModuleId;
  purpose: string;
  keyFunctions: string[];
  executionLogic: string;
  keywords: string[];
}

const WORKSPACE_PAGES: WorkspacePageDefinition[] = [
  {
    route: "/",
    label: "Home",
    module: "general",
    purpose: "Global landing and product-level entry point.",
    keyFunctions: ["Open core modules", "Start assistant flows"],
    executionLogic: "Use as default fallback when no domain route is confidently identified.",
    keywords: ["home", "landing", "start", "main page"],
  },
  {
    route: "/dashboard",
    label: "Business Dashboard",
    module: "dashboard",
    purpose: "Top-level financial health and KPI summary.",
    keyFunctions: ["Review business KPIs", "Open module drill-downs"],
    executionLogic: "Use for summary/overview intents before detailed module actions.",
    keywords: ["dashboard", "overview", "summary", "business health", "kpi"],
  },
  {
    route: "/profile",
    label: "Profile",
    module: "profile",
    purpose: "User profile and account settings.",
    keyFunctions: ["Manage profile", "Update account details"],
    executionLogic: "Use only for account/profile intents.",
    keywords: ["profile", "account settings", "user settings"],
  },
  {
    route: "/marketplace",
    label: "Marketplace",
    module: "marketplace",
    purpose: "Browse financial products and service integrations.",
    keyFunctions: ["Browse products", "Connect external services"],
    executionLogic: "Use for product discovery/integration intents.",
    keywords: ["marketplace", "products", "integrations", "apps"],
  },
  {
    route: "/marketplace/profile",
    label: "Marketplace Profile",
    module: "marketplace",
    purpose: "Manage marketplace provider profile and settings.",
    keyFunctions: ["Edit marketplace profile", "Manage listing preferences"],
    executionLogic: "Use for provider/listing profile updates.",
    keywords: ["marketplace profile", "listing profile", "seller profile"],
  },
  {
    route: "/supersheet",
    label: "SuperSheet",
    module: "supersheet",
    purpose: "Spreadsheet workspace for formulas and tabular analysis.",
    keyFunctions: ["Edit sheets", "Run formula analysis"],
    executionLogic: "Use for spreadsheet/formula tasks.",
    keywords: ["supersheet", "spreadsheet", "sheet", "formula", "cell"],
  },
  {
    route: "/personal",
    label: "Personal Workspace",
    module: "personal",
    purpose: "Personal finance command center.",
    keyFunctions: ["Manage personal flows", "Cross-module personal actions"],
    executionLogic: "Use for personal-finance intents.",
    keywords: ["personal", "personal finance", "my finances"],
  },
  {
    route: "/personal/dashboard",
    label: "Personal Dashboard",
    module: "personal",
    purpose: "Personal KPI and spending dashboard.",
    keyFunctions: ["Review personal metrics", "Track trends"],
    executionLogic: "Use for personal summary/insight requests.",
    keywords: ["personal dashboard", "my dashboard", "personal summary"],
  },
  {
    route: "/personal/apps",
    label: "Personal Apps",
    module: "personal",
    purpose: "Manage app shortcuts and connected personal utilities.",
    keyFunctions: ["Open tools", "Manage app links"],
    executionLogic: "Use for personal app/tool navigation.",
    keywords: ["personal apps", "apps", "tools"],
  },
  {
    route: "/wallet",
    label: "Wallet",
    module: "wallet",
    purpose: "Wallet balance, transfers, and funding actions.",
    keyFunctions: ["Fund wallet", "Send money", "Review wallet activity"],
    executionLogic: "Use for wallet transfer, funding, and balance intents.",
    keywords: ["wallet", "transfer", "send money", "fund", "top up", "balance"],
  },
  {
    route: "/cashflow-intelligence",
    label: "Cashflow Intelligence",
    module: "cashflow",
    purpose: "Cashflow analytics, runway, and burn monitoring.",
    keyFunctions: ["Analyze runway", "Analyze burn", "Review inflow/outflow"],
    executionLogic: "Use for cashflow diagnostics and metrics.",
    keywords: ["cashflow", "cash flow", "runway", "burn rate", "liquidity"],
  },
  {
    route: "/cashflow-intelligence/chat",
    label: "Cashflow Intelligence Chat",
    module: "cashflow",
    purpose: "Conversational cashflow diagnostics and insights.",
    keyFunctions: ["Ask cashflow questions", "Generate insight guidance"],
    executionLogic: "Use for conversational cashflow analysis.",
    keywords: ["cashflow chat", "cash flow chat", "runway chat"],
  },
  {
    route: "/cashflow-intelligence/ratios",
    label: "Cashflow Ratios",
    module: "cashflow",
    purpose: "Ratio-based cashflow and financial stability analysis.",
    keyFunctions: ["Review ratios", "Compare efficiency metrics"],
    executionLogic: "Use for ratio-focused analysis intents.",
    keywords: ["ratios", "cash ratios", "liquidity ratios", "financial ratios"],
  },
  {
    route: "/budgeting",
    label: "Budgeting Workspace",
    module: "budgeting",
    purpose: "Budgeting control center and planning workflows.",
    keyFunctions: ["Manage budget workflows", "Navigate budget modules"],
    executionLogic: "Use for budgeting intents when specific sub-route is unknown.",
    keywords: ["budget", "budgeting", "plan budget"],
  },
  {
    route: "/budgeting/dashboard",
    label: "Budgeting Dashboard",
    module: "budgeting",
    purpose: "Budget KPI summary and variance highlights.",
    keyFunctions: ["Review budget health", "Monitor variances"],
    executionLogic: "Use for budgeting summary requests.",
    keywords: ["budget dashboard", "budget summary", "budget kpi"],
  },
  {
    route: "/budgeting/budgets",
    label: "Budgets",
    module: "budgeting",
    purpose: "Create and manage budget plans.",
    keyFunctions: ["Create budget", "Edit budget", "Track allocations"],
    executionLogic: "Use for budget creation and maintenance intents.",
    keywords: ["budgets", "create budget", "edit budget", "budget plan"],
  },
  {
    route: "/budgeting/categories",
    label: "Budget Categories",
    module: "budgeting",
    purpose: "Maintain budget categories and mapping rules.",
    keyFunctions: ["Manage categories", "Assign categories"],
    executionLogic: "Use for category structure updates.",
    keywords: ["budget categories", "categories", "category mapping"],
  },
  {
    route: "/budgeting/departments",
    label: "Budget Departments",
    module: "budgeting",
    purpose: "Department-level budget ownership and controls.",
    keyFunctions: ["Manage departments", "Assign budget owners"],
    executionLogic: "Use for department budgeting intents.",
    keywords: ["departments", "department budget", "cost centers"],
  },
  {
    route: "/budgeting/forecasting",
    label: "Budget Forecasting",
    module: "budgeting",
    purpose: "Rolling forecast and budget trend projections.",
    keyFunctions: ["Update forecasts", "Review forecast scenarios"],
    executionLogic: "Use for budgeting forecast adjustments.",
    keywords: ["forecasting", "budget forecast", "rolling forecast"],
  },
  {
    route: "/budgeting/scenarios",
    label: "Budget Scenarios",
    module: "budgeting",
    purpose: "Scenario planning and stress testing.",
    keyFunctions: ["Create scenarios", "Compare scenarios"],
    executionLogic: "Use for what-if/scenario intents.",
    keywords: ["scenarios", "what if", "scenario planning", "stress test"],
  },
  {
    route: "/budgeting/variance",
    label: "Budget Variance",
    module: "budgeting",
    purpose: "Actual-vs-budget variance analysis.",
    keyFunctions: ["Review variances", "Investigate drivers"],
    executionLogic: "Use for variance analysis tasks.",
    keywords: ["variance", "actual vs budget", "budget variance"],
  },
  {
    route: "/budgeting/budget-vs-actual",
    label: "Budget vs Actual",
    module: "budgeting",
    purpose: "Compare planned budgets against real outcomes.",
    keyFunctions: ["Compare budget to actual", "Review performance gaps"],
    executionLogic: "Use for plan-vs-actual requests.",
    keywords: ["budget vs actual", "actual comparison", "plan vs actual"],
  },
  {
    route: "/budgeting/templates",
    label: "Budget Templates",
    module: "budgeting",
    purpose: "Reusable budget structures and defaults.",
    keyFunctions: ["Create templates", "Apply templates"],
    executionLogic: "Use for template management intents.",
    keywords: ["budget templates", "template", "budget defaults"],
  },
  {
    route: "/budgeting/ai-assistant",
    label: "Budgeting AI Assistant",
    module: "budgeting",
    purpose: "AI-guided budgeting support.",
    keyFunctions: ["AI budget guidance", "Assisted budget updates"],
    executionLogic: "Use for budgeting AI-specific interactions.",
    keywords: ["budget ai", "budget assistant", "ai budgeting"],
  },
  {
    route: "/accounting",
    label: "Accounting Dashboard",
    module: "accounting",
    purpose: "Primary accounting page for transaction posting and ledger operations.",
    keyFunctions: ["Post journal entries", "Review accounting overview"],
    executionLogic: "Default route for accounting transaction execution.",
    keywords: ["accounting", "journal", "ledger", "record transaction", "post entry"],
  },
  {
    route: "/accounting/workspace",
    label: "Accounting Workspace",
    module: "accounting",
    purpose: "Detailed accounting workspace and journal workflows.",
    keyFunctions: ["Manage journal entries", "Review cashbook"],
    executionLogic: "Use for cashbook, tax payables, and ledger workflows.",
    keywords: ["workspace", "cashbook", "journal entries", "ledger workspace", "trial balance"],
  },
  {
    route: "/accounting/reports",
    label: "Financial Reporting",
    module: "accounting",
    purpose: "Financial statements and report generation.",
    keyFunctions: ["View statements", "Generate exports", "Review balances"],
    executionLogic: "Use for income statement, balance sheet, cash flow, and trial balance tasks.",
    keywords: ["financial reporting", "reports", "income statement", "balance sheet", "cash flow statement", "trial balance", "financial statements"],
  },
  {
    route: "/accounting/reconciliation",
    label: "Bank Reconciliation",
    module: "accounting",
    purpose: "Reconcile bank transactions against ledger entries.",
    keyFunctions: ["Match transactions", "Resolve discrepancies"],
    executionLogic: "Use for unmatched transaction and reconciliation actions.",
    keywords: ["reconciliation", "reconcile", "bank statement", "match transactions", "discrepancy"],
  },
  {
    route: "/accounting/banks",
    label: "Bank Connections",
    module: "accounting",
    purpose: "Connect bank accounts and sync transactions.",
    keyFunctions: ["Connect bank", "Sync transactions", "Review imported records"],
    executionLogic: "Use for bank connection and sync intents before downstream posting/edit steps.",
    keywords: ["bank connection", "connect bank", "bank link", "sync bank", "import transactions"],
  },
  {
    route: "/accounting/payroll",
    label: "Payroll",
    module: "accounting",
    purpose: "Payroll runs, payroll tax, and net pay operations.",
    keyFunctions: ["Run payroll", "Review payroll journals"],
    executionLogic: "Use for salary run and payroll compliance actions.",
    keywords: ["payroll", "salary run", "employee salary", "paye", "staff pay"],
  },
  {
    route: "/accounting/invoices",
    label: "Invoices",
    module: "accounting",
    purpose: "Customer invoice lifecycle management.",
    keyFunctions: ["Create invoices", "Track receivables"],
    executionLogic: "Use for invoice/quotation intents.",
    keywords: ["invoice", "invoices", "bill customer", "quotation", "accounts receivable"],
  },
  {
    route: "/accounting/receipts",
    label: "Receipts",
    module: "accounting",
    purpose: "Receipt uploads and expense capture.",
    keyFunctions: ["Upload receipts", "Capture expense evidence"],
    executionLogic: "Use for document upload and receipt processing intents.",
    keywords: ["receipt", "receipts", "upload receipt", "expense receipt", "upload document"],
  },
  {
    route: "/accounting/vendors",
    label: "Vendors",
    module: "accounting",
    purpose: "Vendor master records and supplier controls.",
    keyFunctions: ["Manage vendors", "Maintain supplier records"],
    executionLogic: "Use for supplier data and vendor onboarding intents.",
    keywords: ["vendors", "vendor", "supplier", "supplier management"],
  },
  {
    route: "/accounting/bills",
    label: "Bills",
    module: "accounting",
    purpose: "Accounts payable bill creation and tracking.",
    keyFunctions: ["Create bills", "Track AP status"],
    executionLogic: "Use for bill drafting and payable workflows.",
    keywords: ["bills", "bill", "accounts payable", "ap"],
  },
  {
    route: "/accounting/approvals",
    label: "Approvals",
    module: "accounting",
    purpose: "Approval queue for payable and accounting operations.",
    keyFunctions: ["Review approvals", "Approve/reject requests"],
    executionLogic: "Use for approval routing and decision intents.",
    keywords: ["approvals", "approval", "approve bill", "approval queue"],
  },
  {
    route: "/accounting/periods",
    label: "Period Locks",
    module: "accounting",
    purpose: "Lock/unlock accounting periods.",
    keyFunctions: ["Lock period", "Unlock period"],
    executionLogic: "Use for close-books and posting control intents.",
    keywords: ["period lock", "lock period", "unlock period", "close books", "close period"],
  },
  {
    route: "/accounting/recurring",
    label: "Recurring",
    module: "accounting",
    purpose: "Recurring journal and bill templates.",
    keyFunctions: ["Create recurring templates", "Manage recurring schedules"],
    executionLogic: "Use for repeat-entry scheduling intents.",
    keywords: ["recurring", "repeat entry", "scheduled entry", "monthly template", "quarterly template"],
  },
  {
    route: "/accounting/fx",
    label: "Exchange Rates",
    module: "accounting",
    purpose: "FX rates and currency conversion management.",
    keyFunctions: ["Manage FX rates", "Update currency pairs"],
    executionLogic: "Use for exchange rate and currency intents.",
    keywords: ["fx", "exchange rate", "currency rate", "forex"],
  },
  {
    route: "/accounting/dimensions",
    label: "Dimensions",
    module: "accounting",
    purpose: "Class/location/department reporting dimensions.",
    keyFunctions: ["Manage dimensions", "Enable segmented reporting"],
    executionLogic: "Use for class tracking and branch/department analytics intents.",
    keywords: ["dimensions", "class tracking", "location tracking", "department reporting", "branch reporting"],
  },
  {
    route: "/accounting/assets",
    label: "Fixed Assets",
    module: "accounting",
    purpose: "Fixed asset register and controls.",
    keyFunctions: ["Manage asset register", "Track asset lifecycle"],
    executionLogic: "Use for fixed-asset records and schedules.",
    keywords: ["fixed asset", "asset register", "assets register", "asset schedule"],
  },
  {
    route: "/accounting/depreciation",
    label: "Depreciation",
    module: "accounting",
    purpose: "Depreciation runs and accumulated depreciation tracking.",
    keyFunctions: ["Run depreciation", "Track accumulated depreciation"],
    executionLogic: "Use for depreciation posting intents.",
    keywords: ["depreciation", "depreciate", "accumulated depreciation"],
  },
  {
    route: "/accounting/action-logs",
    label: "Action Logs",
    module: "accounting",
    purpose: "Audit trail for executed accounting actions.",
    keyFunctions: ["Review execution logs", "Inspect automation history"],
    executionLogic: "Use for log/audit trace intents.",
    keywords: ["action log", "execution log", "agent log", "audit log", "receipt log"],
  },
  {
    route: "/accounting/employees",
    label: "Employees",
    module: "accounting",
    purpose: "Employee records for payroll/accounting integrations.",
    keyFunctions: ["Manage employee list", "Maintain payroll identities"],
    executionLogic: "Use for employee master data tasks.",
    keywords: ["employees", "employee records", "staff records"],
  },
  {
    route: "/accounting/projections",
    label: "Financial Projections",
    module: "accounting",
    purpose: "Projection dashboard and forecast monitoring.",
    keyFunctions: ["Review projections", "Update assumptions"],
    executionLogic: "Use for forecast scenario and projection result intents.",
    keywords: ["projections", "projection", "forecast", "scenario", "financial projections"],
  },
  {
    route: "/accounting/projections/modelling",
    label: "Projection Modelling",
    module: "accounting",
    purpose: "Detailed financial model input editing.",
    keyFunctions: ["Edit model inputs", "Tune assumptions"],
    executionLogic: "Use for model-input update intents (rate, growth, churn, CAC, LTV, etc).",
    keywords: ["modelling", "model", "model inputs", "assumptions model", "financial model"],
  },
  {
    route: "/tax-tools",
    label: "Tax Tools",
    module: "tax",
    purpose: "Tax tools overview and helper utilities.",
    keyFunctions: ["Open tax workflows", "Run quick tax tasks"],
    executionLogic: "Use as tax fallback route when sub-route is unclear.",
    keywords: ["tax tools", "tax", "tax utility"],
  },
  {
    route: "/tax/workspace",
    label: "Tax Workspace",
    module: "tax",
    purpose: "Primary tax workspace and compliance actions.",
    keyFunctions: ["Manage tax records", "Review compliance state"],
    executionLogic: "Default route for tax operations.",
    keywords: ["tax workspace", "tax operations", "compliance workspace"],
  },
  {
    route: "/tax/computation",
    label: "Tax Computation",
    module: "tax",
    purpose: "Compute VAT/WHT/CIT/PAYE liabilities.",
    keyFunctions: ["Run tax computation", "Review liabilities"],
    executionLogic: "Use for computation requests across tax types.",
    keywords: ["tax computation", "compute tax", "vat", "wht", "cit", "paye", "education tax"],
  },
  {
    route: "/tax/file-taxes",
    label: "File Taxes",
    module: "tax",
    purpose: "Prepare and submit filings.",
    keyFunctions: ["Prepare filing pack", "Submit returns"],
    executionLogic: "Use for filing and authority submission intents.",
    keywords: ["file taxes", "submit return", "tax filing", "tax authority", "upload filing"],
  },
  {
    route: "/tax/returns",
    label: "Tax Returns",
    module: "tax",
    purpose: "Track return status and filing history.",
    keyFunctions: ["Review return states", "Monitor draft/ready status"],
    executionLogic: "Use for return lifecycle/status intents.",
    keywords: ["returns", "tax returns", "filed return", "draft return", "ready return"],
  },
  {
    route: "/tax/payments",
    label: "Tax Payments",
    module: "tax",
    purpose: "Tax payment records and outstanding balances.",
    keyFunctions: ["Review tax payments", "Track outstanding liabilities"],
    executionLogic: "Use for tax payment intents.",
    keywords: ["tax payments", "pay tax", "outstanding tax", "tax receipt"],
  },
  {
    route: "/tax/calendar",
    label: "Tax Calendar",
    module: "tax",
    purpose: "Tax deadlines and compliance schedule.",
    keyFunctions: ["View deadlines", "Track reminders"],
    executionLogic: "Use for due date and calendar intents.",
    keywords: ["tax calendar", "deadline", "reminder", "due date"],
  },
  {
    route: "/tax/transactions",
    label: "Tax Transactions",
    module: "tax",
    purpose: "Tax-classified transaction ledger.",
    keyFunctions: ["Review classified transactions", "Apply tax rules"],
    executionLogic: "Use for classification and tax-transaction intents.",
    keywords: ["tax transactions", "classification", "vat eligible", "withholding applicable", "bulk edit"],
  },
  {
    route: "/tax/settings",
    label: "Tax Settings",
    module: "tax",
    purpose: "Jurisdiction, rates, and fiscal settings.",
    keyFunctions: ["Update tax settings", "Configure company tax profile"],
    executionLogic: "Use for rate/configuration intents.",
    keywords: ["tax settings", "jurisdiction", "tax rates", "fiscal year", "company info"],
  },
  {
    route: "/tax/adjustments",
    label: "Tax Adjustments",
    module: "tax",
    purpose: "Adjustments, credits, deductions, and allowances.",
    keyFunctions: ["Apply adjustments", "Track carryforward values"],
    executionLogic: "Use for adjustments and credits intents.",
    keywords: ["tax adjustments", "deduction", "allowance", "tax credit", "loss carryforward"],
  },
];

const MODULE_HOME_ROUTE: Record<WorkspaceModuleId, string> = {
  accounting: "/accounting",
  tax: "/tax/workspace",
  wallet: "/wallet",
  budgeting: "/budgeting",
  cashflow: "/cashflow-intelligence",
  marketplace: "/marketplace",
  personal: "/personal",
  dashboard: "/dashboard",
  supersheet: "/supersheet",
  profile: "/profile",
  general: "/",
};

function normalizeIntentText(value: string): string {
  return (value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bpls\b/g, "please")
    .replace(/\bprintout\b/g, "print out")
    .replace(/\btayable\s+payable\b/g, "tax payable")
    .replace(/\btayable\b/g, "payable")
    .replace(/\bpayble\b/g, "payable")
    .replace(/\bliablities\b/g, "liabilities")
    .replace(/\baccouting\b/g, "accounting")
    .replace(/\bstatmenest\b/g, "statements");
}

function normalizeModuleHint(moduleHint?: string): WorkspaceModuleId | null {
  const normalized = (moduleHint || "").toLowerCase().trim();
  if (!normalized) return null;

  if (["accounting", "financial", "reconciliation", "projections"].includes(normalized)) return "accounting";
  if (["tax", "tax-tools"].includes(normalized)) return "tax";
  if (["wallet", "payment", "payments"].includes(normalized)) return "wallet";
  if (["budgeting", "budget"].includes(normalized)) return "budgeting";
  if (["cashflow", "cashflow-intelligence"].includes(normalized)) return "cashflow";
  if (["marketplace"].includes(normalized)) return "marketplace";
  if (["personal"].includes(normalized)) return "personal";
  if (["dashboard"].includes(normalized)) return "dashboard";
  if (["supersheet", "sheet", "spreadsheet"].includes(normalized)) return "supersheet";
  if (["profile"].includes(normalized)) return "profile";

  return null;
}

function scoreIntentAgainstPage(params: {
  intentText: string;
  currentRoute?: string;
  moduleHint?: WorkspaceModuleId | null;
  page: WorkspacePageDefinition;
}): number {
  const { intentText, currentRoute, moduleHint, page } = params;
  let score = 0;

  if (intentText.includes(page.route.toLowerCase())) score += 8;
  if (intentText.includes(page.label.toLowerCase())) score += 6;

  for (const keyword of page.keywords) {
    if (intentText.includes(keyword.toLowerCase())) {
      score += keyword.split(" ").length >= 2 ? 4 : 3;
    }
  }

  if (currentRoute && currentRoute.startsWith(page.route)) score += 2;
  if (moduleHint && page.module === moduleHint) score += 2;

  return score;
}

export function getWorkspacePages(): WorkspacePageDefinition[] {
  return WORKSPACE_PAGES.slice();
}

export function findWorkspacePageByRoute(route?: string): WorkspacePageDefinition | null {
  const normalized = (route || "").trim();
  if (!normalized) return null;

  const matches = WORKSPACE_PAGES.filter((page) => normalized === page.route || normalized.startsWith(`${page.route}/`));
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.route.length - a.route.length)[0] || null;
}

export function buildWorkspaceRouteCatalogText(options?: {
  moduleFilter?: WorkspaceModuleId | string;
  maxItems?: number;
}): string {
  const moduleFilter = normalizeModuleHint(typeof options?.moduleFilter === "string" ? options.moduleFilter : "");
  const maxItems = Number.isFinite(options?.maxItems) ? Math.max(1, Number(options?.maxItems)) : WORKSPACE_PAGES.length;

  const filtered = moduleFilter ? WORKSPACE_PAGES.filter((page) => page.module === moduleFilter) : WORKSPACE_PAGES;
  return filtered
    .slice(0, maxItems)
    .map((page) => `${page.route} | ${page.label} | ${page.purpose} | actions: ${page.keyFunctions.slice(0, 2).join(", ")}`)
    .join("\n");
}

export function resolveWorkspacePageFromIntent(
  textInput: string,
  currentRoute?: string,
  moduleHint?: string
): WorkspacePageDefinition | null {
  const intentText = normalizeIntentText(textInput);
  if (!intentText) return null;

  const hintedModule = normalizeModuleHint(moduleHint) || findWorkspacePageByRoute(currentRoute)?.module || null;
  const hasNavigationCue = /\b(go to|open|navigate|take me|switch to|visit|move to|show page)\b/.test(intentText);
  const hasActionCue = /\b(post|record|create|add|run|process|review|check|analyze|analyse|connect|sync|classify|file|submit|upload|download|export|print|approve|pay|lock|unlock|set|update|change)\b/.test(
    intentText
  );

  let best: WorkspacePageDefinition | null = null;
  let bestScore = 0;

  for (const page of WORKSPACE_PAGES) {
    const score = scoreIntentAgainstPage({
      intentText,
      currentRoute,
      moduleHint: hintedModule,
      page,
    });
    if (score > bestScore) {
      bestScore = score;
      best = page;
    }
  }

  const threshold = hasNavigationCue ? 3 : hasActionCue ? 5 : 7;
  if (best && bestScore >= threshold) {
    return best;
  }

  if (hasNavigationCue && hintedModule) {
    const homeRoute = MODULE_HOME_ROUTE[hintedModule];
    return findWorkspacePageByRoute(homeRoute);
  }

  return null;
}

