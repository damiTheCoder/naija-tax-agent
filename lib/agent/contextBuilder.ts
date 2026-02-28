import { buildContextSnippet, retrieveKnowledge } from "@/lib/agent/rag";
import type { AgentConversationMessage, UnifiedAgentRequest } from "@/lib/agent/unifiedTypes";
import { listToolNamesForDomain, type ModuleDomain } from "@/lib/agent/toolRegistry";

type ModuleProfile = {
  domain: ModuleDomain;
  label: string;
  description: string;
  relevantEntities: string[];
  databaseEntities: string[];
  routes: string[];
};

const MAX_SNAPSHOT_CHARS = 2800;
const MAX_UI_SNAPSHOT_CHARS = 2200;
const MAX_MEMORY_CHARS = 1800;
const MAX_MESSAGES = 12;

const MODULE_PROFILES: ModuleProfile[] = [
  {
    domain: "financial",
    label: "Financial Module",
    description: "Core accounting, ledger, transaction posting, and balance operations.",
    relevantEntities: ["Transaction", "JournalEntry", "Ledger", "Account", "Balance"],
    databaseEntities: ["transactions", "journal_entries", "ledger_accounts", "chart_of_accounts"],
    routes: ["/accounting", "/accounting/workspace", "/accounting/reconciliation", "/dashboard", "/personal", "/personal/dashboard"],
  },
  {
    domain: "reporting",
    label: "Reporting Module",
    description: "Financial reporting, analytics, scenario modeling, and projection analysis.",
    relevantEntities: ["Report", "Projection", "Scenario", "Metric", "Assumption"],
    databaseEntities: ["reports", "projection_runs", "projection_assumptions", "metrics"],
    routes: ["/accounting/reports", "/accounting/projections", "/accounting/projections/modelling", "/cashflow-intelligence"],
  },
  {
    domain: "customer",
    label: "Customer Module",
    description: "Customer-level records, account relationships, and interaction summaries.",
    relevantEntities: ["Customer", "CustomerAccount", "CustomerProfile", "Contact"],
    databaseEntities: ["customers", "customer_profiles", "customer_contacts", "customer_accounts"],
    routes: ["/customers", "/crm", "/contacts"],
  },
  {
    domain: "payment",
    label: "Payment Module",
    description: "Wallet operations, fund movement, recipients, and payment execution.",
    relevantEntities: ["Wallet", "Transfer", "Recipient", "PaymentInstruction"],
    databaseEntities: ["wallet_transactions", "wallet_balances", "payment_recipients"],
    routes: ["/wallet", "/wallet/history", "/wallet/cards"],
  },
  {
    domain: "operations",
    label: "Operational/System Module",
    description: "Tax, treasury, compliance, and system workflow operations.",
    relevantEntities: ["TaxRecord", "ComplianceTask", "RunwayMetric", "SystemAction"],
    databaseEntities: ["tax_transactions", "compliance_records", "system_events"],
    routes: ["/tax", "/tax-tools", "/cashflow-intelligence/chat"],
  },
];

function truncateText(text: string, limit: number): string {
  const cleaned = (text || "").trim();
  if (cleaned.length <= limit) return cleaned;
  return `${cleaned.slice(0, limit)}...`;
}

function normalizeConversation(conversation?: AgentConversationMessage[]): AgentConversationMessage[] {
  if (!Array.isArray(conversation)) return [];
  return conversation
    .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
    .slice(-MAX_MESSAGES)
    .map((item) => ({ role: item.role, content: truncateText(item.content, 260) }));
}

function findProfileByRoute(route?: string): ModuleProfile | null {
  if (!route) return null;
  return (
    MODULE_PROFILES.find((profile) => profile.routes.some((candidate) => route.startsWith(candidate))) || null
  );
}

function findProfileByModule(module?: string): ModuleProfile | null {
  const normalized = (module || "").toLowerCase().trim();
  if (!normalized) return null;

  if (["accounting", "reconciliation", "financial", "personal", "general"].includes(normalized)) {
    return MODULE_PROFILES.find((profile) => profile.domain === "financial") || null;
  }
  if (["reports", "reporting", "projections", "dashboard", "cashflow"].includes(normalized)) {
    return MODULE_PROFILES.find((profile) => profile.domain === "reporting") || null;
  }
  if (["customer", "customers", "crm"].includes(normalized)) {
    return MODULE_PROFILES.find((profile) => profile.domain === "customer") || null;
  }
  if (["wallet", "payment", "payments"].includes(normalized)) {
    return MODULE_PROFILES.find((profile) => profile.domain === "payment") || null;
  }

  return MODULE_PROFILES.find((profile) => profile.domain === "operations") || null;
}

function extractSnapshotRecords(snapshot: string): string[] {
  if (!snapshot) return [];
  return snapshot
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function parseSnapshotMetrics(snapshot: string): Record<string, string> {
  const metrics: Record<string, string> = {};
  for (const line of extractSnapshotRecords(snapshot)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key && value) {
      metrics[key] = value;
    }
  }
  return metrics;
}

function toKnowledgeContext(conversation: AgentConversationMessage[]): string {
  const seed = conversation.length > 0 ? conversation : [{ role: "user" as const, content: "general context" }];
  const entries = retrieveKnowledge(seed, 2);
  return buildContextSnippet(entries);
}

function resolveCrossDomainFunctions(primary: ModuleDomain): string[] {
  const orderedDomains: ModuleDomain[] = [
    primary,
    "financial",
    "reporting",
    "operations",
    "payment",
    "customer",
  ];
  const unique = new Set<string>();
  for (const domain of orderedDomains) {
    for (const name of listToolNamesForDomain(domain)) {
      unique.add(name);
    }
  }
  return Array.from(unique);
}

export interface BuiltModuleContext {
  module: ModuleDomain;
  moduleLabel: string;
  moduleDescription: string;
  route: string;
  availableFunctions: string[];
  relevantEntities: string[];
  databaseEntities: string[];
  userState: {
    objective: string;
    memorySnapshot: string;
    conversationSummary: string;
  };
  contextSnapshot: string;
  uiSnapshot: string;
  relevantRecords: string[];
  snapshotMetrics: Record<string, string>;
  knowledgeContext: string;
}

export function buildModuleContext(request: UnifiedAgentRequest): BuiltModuleContext {
  const conversation = normalizeConversation(request.conversation);
  const route = typeof request.route === "string" && request.route.trim() ? request.route.trim() : "/";
  const byModule = findProfileByModule(request.module);
  const byRoute = findProfileByRoute(route);
  const profile = byModule || byRoute || MODULE_PROFILES.find((item) => item.domain === "operations")!;

  const objective = truncateText(typeof request.objective === "string" ? request.objective : request.message || "", 260);
  const memorySnapshot = truncateText(typeof request.memorySnapshot === "string" ? request.memorySnapshot : "", MAX_MEMORY_CHARS);
  const contextSnapshot = truncateText(typeof request.contextSnapshot === "string" ? request.contextSnapshot : "", MAX_SNAPSHOT_CHARS);
  const uiSnapshot = truncateText(typeof request.uiSnapshot === "string" ? request.uiSnapshot : "", MAX_UI_SNAPSHOT_CHARS);

  return {
    module: profile.domain,
    moduleLabel: profile.label,
    moduleDescription: `${profile.description} Cross-page execution is enabled when user intent maps to another module.`,
    route,
    availableFunctions: resolveCrossDomainFunctions(profile.domain),
    relevantEntities: profile.relevantEntities,
    databaseEntities: profile.databaseEntities,
    userState: {
      objective,
      memorySnapshot,
      conversationSummary: conversation.map((item) => `${item.role}: ${item.content}`).join("\n"),
    },
    contextSnapshot,
    uiSnapshot,
    relevantRecords: extractSnapshotRecords(contextSnapshot),
    snapshotMetrics: parseSnapshotMetrics(contextSnapshot),
    knowledgeContext: toKnowledgeContext(conversation),
  };
}
