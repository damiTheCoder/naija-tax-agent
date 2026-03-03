export type ResolvedWorkspaceRoute = {
  route: string;
  label: string;
  reason: string;
};

const ROUTE_LABELS: Record<string, string> = {
  "/accounting": "Accounting Studio",
  "/accounting/workspace": "Accounting Workspace",
  "/accounting/reports": "Accounting Reports",
  "/accounting/reconciliation": "Bank Reconciliation",
  "/accounting/projections": "Financial Projections",
  "/accounting/assets": "Fixed Assets",
  "/accounting/depreciation": "Depreciation",
  "/accounting/receipts": "Receipts",
  "/accounting/invoices": "Invoices",
  "/accounting/vendors": "Vendors",
  "/accounting/bills": "Bills",
  "/accounting/approvals": "Approvals",
  "/accounting/periods": "Period Locks",
  "/accounting/recurring": "Recurring",
  "/accounting/fx": "Exchange Rates",
  "/accounting/dimensions": "Dimensions",
  "/accounting/action-logs": "Action Logs",
  "/accounting/payroll": "Payroll",
  "/accounting/banks": "Bank Connections",
  "/tax/workspace": "Tax Workspace",
  "/tax/computation": "Tax Computation",
  "/tax/file-taxes": "File Taxes",
  "/tax/returns": "Tax Returns",
  "/tax/payments": "Tax Payments",
  "/tax/calendar": "Tax Calendar",
  "/tax/transactions": "Tax Transactions",
  "/tax/settings": "Tax Settings",
  "/tax/adjustments": "Tax Adjustments",
};

function isTaxContext(text: string, currentRoute?: string, moduleHint?: string): boolean {
  const moduleLower = (moduleHint || "").toLowerCase();
  return (
    /(^|\s)(tax|vat|wht|cit|paye|firs|filing|return|compliance)(\s|$)/.test(text) ||
    (currentRoute || "").startsWith("/tax") ||
    moduleLower === "tax" ||
    moduleLower === "tax-tools"
  );
}

function isAccountingContext(text: string, currentRoute?: string, moduleHint?: string): boolean {
  const moduleLower = (moduleHint || "").toLowerCase();
  return (
    /(^|\s)(accounting|journal|ledger|trial balance|statement|reports|reconciliation|transaction)(\s|$)/.test(text) ||
    (currentRoute || "").startsWith("/accounting") ||
    moduleLower === "accounting"
  );
}

function asResolved(route: string, reason: string): ResolvedWorkspaceRoute {
  return {
    route,
    label: ROUTE_LABELS[route] || route,
    reason,
  };
}

export function resolveWorkspaceRouteFromText(
  textInput: string,
  currentRoute?: string,
  moduleHint?: string
): ResolvedWorkspaceRoute | null {
  const text = (textInput || "").toLowerCase();
  const taxContext = isTaxContext(text, currentRoute, moduleHint);
  const accountingContext = isAccountingContext(text, currentRoute, moduleHint);

  if (/(upload|attach|submit|certificate|manual filing|tax summary)/.test(text)) {
    if (taxContext || /(withholding|wht|vat|cit|paye|tax)/.test(text)) {
      return asResolved("/tax/file-taxes", "Tax upload or filing flow requested.");
    }
    if (accountingContext || /(receipt|invoice|bank statement|document)/.test(text)) {
      return asResolved("/accounting/receipts", "Accounting document upload requested.");
    }
  }

  if (taxContext) {
    if (/(calendar|deadline|reminder)/.test(text)) return asResolved("/tax/calendar", "Tax calendar intent.");
    if (/(payment|pay tax|receipt|outstanding)/.test(text)) return asResolved("/tax/payments", "Tax payment intent.");
    if (/(file tax|submit return|download return|filing center|tax authority)/.test(text)) return asResolved("/tax/file-taxes", "Tax filing intent.");
    if (/(return|filed|draft|ready)/.test(text)) return asResolved("/tax/returns", "Tax return status intent.");
    if (/(adjustment|deduction|allowance|tax credit|loss carryforward)/.test(text)) return asResolved("/tax/adjustments", "Tax adjustment intent.");
    if (/(setting|jurisdiction|rate|fiscal year|company info)/.test(text)) return asResolved("/tax/settings", "Tax settings intent.");
    if (/(transaction|classif|bulk edit|vat eligible|withholding applicable)/.test(text)) return asResolved("/tax/transactions", "Tax transactions intent.");
    if (/(compute|computation|cit|vat|wht|paye|education tax|tax payable)/.test(text)) return asResolved("/tax/computation", "Tax computation intent.");
    return asResolved("/tax/workspace", "Default tax route.");
  }

  if (accountingContext) {
    if (/(vendor|supplier)\b/.test(text)) return asResolved("/accounting/vendors", "Vendor management intent.");
    if (/(bill|accounts payable|ap)\b/.test(text)) return asResolved("/accounting/bills", "Bill workflow intent.");
    if (/(approval|approve bill|approval queue)\b/.test(text)) return asResolved("/accounting/approvals", "Approvals intent.");
    if (/(close books|close period|period lock|lock period|unlock period)\b/.test(text)) return asResolved("/accounting/periods", "Period lock intent.");
    if (/(recurring|repeat entry|scheduled entry)\b/.test(text)) return asResolved("/accounting/recurring", "Recurring workflow intent.");
    if (/(exchange rate|fx|currency rate)\b/.test(text)) return asResolved("/accounting/fx", "FX management intent.");
    if (/(class tracking|location tracking|dimension|department reporting|branch reporting)\b/.test(text)) return asResolved("/accounting/dimensions", "Dimensions intent.");
    if (/(action log|execution log|agent log|receipt log)\b/.test(text)) return asResolved("/accounting/action-logs", "Execution log intent.");
    if (/(reconcil|bank statement|match transactions?)/.test(text)) return asResolved("/accounting/reconciliation", "Reconciliation intent.");
    if (/(projection|forecast|model|scenario)/.test(text)) return asResolved("/accounting/projections", "Projection intent.");
    if (/(fixed asset|assets register|asset register|asset schedule)/.test(text)) return asResolved("/accounting/assets", "Assets intent.");
    if (/(depreciation|depreciate|accumulated depreciation)/.test(text)) return asResolved("/accounting/depreciation", "Depreciation intent.");
    if (/(invoice|bill customer|quotation)/.test(text)) return asResolved("/accounting/invoices", "Invoice intent.");
    if (/(receipt|expense receipt|upload receipt|upload document)/.test(text)) return asResolved("/accounting/receipts", "Receipt upload intent.");
    if (/(payroll|employee salary|salary run|employee tax)/.test(text)) return asResolved("/accounting/payroll", "Payroll intent.");
    if (/(bank account|connect bank|bank link)/.test(text)) return asResolved("/accounting/banks", "Bank connection intent.");
    if (/(report|financial statement|trial balance|p&l|profit|balance sheet|cash flow)/.test(text)) return asResolved("/accounting/reports", "Reporting intent.");
    if (/(workspace|ledger|journal entries|tax payables|cashbook)/.test(text)) return asResolved("/accounting/workspace", "Accounting workspace intent.");
    if (/(post|record|create|journal|entry|transaction|sold|paid|received|buy|bought|expense|purchase)/.test(text)) return asResolved("/accounting", "Accounting posting intent.");
    return asResolved("/accounting", "Default accounting route.");
  }

  if ((currentRoute || "").startsWith("/tax") || (moduleHint || "").toLowerCase().includes("tax")) {
    return asResolved("/tax/workspace", "Module fallback route.");
  }
  if ((currentRoute || "").startsWith("/accounting") || (moduleHint || "").toLowerCase().includes("accounting")) {
    return asResolved("/accounting", "Module fallback route.");
  }

  return null;
}
