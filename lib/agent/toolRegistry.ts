import type { UnifiedAgentAction, UnifiedAgentActionType } from "@/lib/agent/unifiedTypes";

export type ModuleDomain = "financial" | "reporting" | "customer" | "payment" | "operations";

export type ToolKind = "action" | "internal";

export interface ToolDefinition {
  name: string;
  kind: ToolKind;
  description: string;
  domains: ModuleDomain[];
  payloadSchema: Record<string, string>;
  mapsToAction?: UnifiedAgentActionType;
}

export interface ToolRequest {
  name: string;
  arguments?: Record<string, unknown>;
  reason?: string;
  confidence?: number;
}

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "getTransactions",
    kind: "internal",
    description: "Fetch relevant transaction records for the active module context.",
    domains: ["financial", "reporting"],
    payloadSchema: {
      limit: "number (optional)",
      dateFrom: "string YYYY-MM-DD (optional)",
      dateTo: "string YYYY-MM-DD (optional)",
      account: "string (optional)",
    },
  },
  {
    name: "getBalance",
    kind: "internal",
    description: "Read balance-related values from active ledger and context snapshots.",
    domains: ["financial", "payment", "reporting"],
    payloadSchema: {
      account: "string (optional)",
      asOfDate: "string YYYY-MM-DD (optional)",
    },
  },
  {
    name: "createTransaction",
    kind: "action",
    description: "Create and post a financial transaction into accounting records.",
    domains: ["financial"],
    mapsToAction: "accounting.postTransaction",
    payloadSchema: {
      description: "string (required)",
      amount: "number > 0 (required)",
      date: "string YYYY-MM-DD (optional)",
      category: "string (optional)",
      transactionType: "income|expense|asset|liability|equity|other (optional)",
    },
  },
  {
    name: "createBill",
    kind: "action",
    description: "Create a bill draft in accounts payable.",
    domains: ["financial", "operations"],
    mapsToAction: "accounting.createBill",
    payloadSchema: {
      vendorName: "string (required if vendorId not set)",
      vendorId: "string (optional)",
      date: "string YYYY-MM-DD (optional)",
      dueDate: "string YYYY-MM-DD (optional)",
      lines: "array of { description, quantity, unitPrice, taxRate? } (required)",
      currency: "string (optional, default NGN)",
    },
  },
  {
    name: "submitBill",
    kind: "action",
    description: "Submit a bill draft for approval.",
    domains: ["financial", "operations"],
    mapsToAction: "accounting.submitBill",
    payloadSchema: {
      billId: "string (required)",
      actor: "string (optional)",
      actorRole: "staff|manager|owner (optional)",
    },
  },
  {
    name: "approveBill",
    kind: "action",
    description: "Approve a submitted bill and post liability journal.",
    domains: ["financial", "operations"],
    mapsToAction: "accounting.approveBill",
    payloadSchema: {
      billId: "string (required)",
      actor: "string (optional)",
      actorRole: "manager|owner (optional)",
      decisionNote: "string (optional)",
    },
  },
  {
    name: "payBill",
    kind: "action",
    description: "Pay an approved bill and clear AP.",
    domains: ["financial", "payment", "operations"],
    mapsToAction: "accounting.payBill",
    payloadSchema: {
      billId: "string (required)",
      amount: "number > 0 (optional, defaults outstanding)",
      date: "string YYYY-MM-DD (optional)",
      method: "string (optional)",
      reference: "string (optional)",
    },
  },
  {
    name: "lockPeriod",
    kind: "action",
    description: "Lock an accounting period to block postings.",
    domains: ["financial", "operations"],
    mapsToAction: "accounting.lockPeriod",
    payloadSchema: {
      period: "string YYYY-MM (required)",
      actor: "string (optional)",
      reason: "string (optional)",
    },
  },
  {
    name: "unlockPeriod",
    kind: "action",
    description: "Unlock a locked accounting period.",
    domains: ["financial", "operations"],
    mapsToAction: "accounting.unlockPeriod",
    payloadSchema: {
      period: "string YYYY-MM (required)",
      actor: "string (optional)",
      reason: "string (optional)",
    },
  },
  {
    name: "createRecurringTemplate",
    kind: "action",
    description: "Create a recurring bill or journal template.",
    domains: ["financial", "operations"],
    mapsToAction: "accounting.createRecurringTemplate",
    payloadSchema: {
      name: "string (required)",
      resourceType: "bill|journal (required)",
      frequency: "monthly|quarterly (required)",
      startDate: "string YYYY-MM-DD (required)",
      payload: "object (required)",
    },
  },
  {
    name: "generateReport",
    kind: "internal",
    description: "Generate a report summary from reporting and module data in context.",
    domains: ["reporting", "financial", "operations"],
    payloadSchema: {
      reportType: "cashflow|pnl|balance_sheet|tax|custom (optional)",
      period: "string e.g. monthly|quarterly|yearly (optional)",
    },
  },
  {
    name: "getCustomerDetails",
    kind: "internal",
    description: "Retrieve customer-level details from available customer context.",
    domains: ["customer", "operations", "payment"],
    payloadSchema: {
      customerId: "string (optional)",
      email: "string (optional)",
      phone: "string (optional)",
      name: "string (optional)",
    },
  },
  {
    name: "calculateMetrics",
    kind: "internal",
    description: "Compute key metrics from current context (growth, margin, burn, runway, etc).",
    domains: ["reporting", "financial", "operations"],
    payloadSchema: {
      metric: "string (required)",
      period: "string (optional)",
    },
  },
  {
    name: "recordTaxTransaction",
    kind: "action",
    description: "Record a tax-relevant transaction.",
    domains: ["operations", "financial"],
    mapsToAction: "tax.recordTransaction",
    payloadSchema: {
      description: "string (required)",
      amount: "number > 0 (required)",
      date: "string YYYY-MM-DD (optional)",
      category: "string (optional)",
      transactionType: "string (optional)",
      isResident: "boolean (optional)",
    },
  },
  {
    name: "sendPayment",
    kind: "action",
    description: "Send money to a recipient.",
    domains: ["payment", "financial"],
    mapsToAction: "wallet.sendMoney",
    payloadSchema: {
      amount: "number > 0 (required)",
      recipient: "string (required)",
      provider: "string (optional)",
      recipientType: "phone|email|account (optional)",
    },
  },
  {
    name: "fundWallet",
    kind: "action",
    description: "Fund wallet balance.",
    domains: ["payment", "financial"],
    mapsToAction: "wallet.fund",
    payloadSchema: {
      amount: "number > 0 (required)",
    },
  },
  {
    name: "analyzeCashflow",
    kind: "action",
    description: "Analyze cashflow summary, runway, or burn.",
    domains: ["reporting", "financial", "operations"],
    mapsToAction: "cashflow.analyze",
    payloadSchema: {
      focus: "runway|burn|summary (optional)",
    },
  },
  {
    name: "updateProjectionAssumption",
    kind: "action",
    description: "Update one or more projection assumptions or financial model inputs.",
    domains: ["reporting", "financial"],
    mapsToAction: "projections.updateAssumption",
    payloadSchema: {
      updates:
        "array of { key: assumption key OR active model input key/label, value: number, unit?: percent|decimal|ratio|currency }",
    },
  },
  {
    name: "resetProjectionAssumptions",
    kind: "action",
    description: "Reset projection assumptions to auto.",
    domains: ["reporting", "financial"],
    mapsToAction: "projections.resetAssumptions",
    payloadSchema: {},
  },
  {
    name: "navigate",
    kind: "action",
    description: "Navigate to another route in the software.",
    domains: ["financial", "reporting", "customer", "payment", "operations"],
    mapsToAction: "navigate",
    payloadSchema: {
      route: "string starting with / (required)",
    },
  },
  {
    name: "operateInterface",
    kind: "action",
    description: "Operate UI controls via click/type/select/focus/check steps.",
    domains: ["financial", "reporting", "customer", "payment", "operations"],
    mapsToAction: "ui.operate",
    payloadSchema: {
      steps:
        "array of { action: click|type|select|check|focus, target: { selector?: string, text?: string, placeholder?: string, label?: string, role?: string, exact?: boolean, index?: number }, value?: string }",
    },
  },
];

const TOOL_MAP: Record<string, ToolDefinition> = TOOL_DEFINITIONS.reduce((acc, tool) => {
  acc[tool.name] = tool;
  return acc;
}, {} as Record<string, ToolDefinition>);

export function getToolsForDomain(domain: ModuleDomain): ToolDefinition[] {
  return TOOL_DEFINITIONS.filter((tool) => tool.domains.includes(domain));
}

export function getToolByName(name: string): ToolDefinition | null {
  return TOOL_MAP[name] || null;
}

export function listToolNamesForDomain(domain: ModuleDomain): string[] {
  return getToolsForDomain(domain).map((tool) => tool.name);
}

export function toUnifiedAction(toolRequest: ToolRequest): UnifiedAgentAction | null {
  const tool = getToolByName(toolRequest.name);
  if (!tool || tool.kind !== "action" || !tool.mapsToAction) return null;

  return {
    type: tool.mapsToAction,
    payload: toolRequest.arguments && typeof toolRequest.arguments === "object" ? toolRequest.arguments : {},
    reason: typeof toolRequest.reason === "string" ? toolRequest.reason : undefined,
    confidence:
      typeof toolRequest.confidence === "number" && Number.isFinite(toolRequest.confidence)
        ? Math.max(0, Math.min(1, toolRequest.confidence))
        : undefined,
  };
}

export function isAllowedActionType(actionType: string): actionType is UnifiedAgentActionType {
  return (
    actionType === "accounting.postTransaction" ||
    actionType === "accounting.createBill" ||
    actionType === "accounting.submitBill" ||
    actionType === "accounting.approveBill" ||
    actionType === "accounting.payBill" ||
    actionType === "accounting.lockPeriod" ||
    actionType === "accounting.unlockPeriod" ||
    actionType === "accounting.createRecurringTemplate" ||
    actionType === "tax.recordTransaction" ||
    actionType === "wallet.sendMoney" ||
    actionType === "wallet.fund" ||
    actionType === "cashflow.analyze" ||
    actionType === "navigate" ||
    actionType === "ui.operate" ||
    actionType === "projections.updateAssumption" ||
    actionType === "projections.resetAssumptions"
  );
}
