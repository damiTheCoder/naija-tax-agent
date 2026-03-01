"use client";

import { accountingEngine, parseTransactionFromChatWithAI } from "@/lib/accounting/transactionBridge";
import type { RawTransaction, TransactionType } from "@/lib/accounting/types";
import { resolveWorkspaceRouteFromText } from "@/lib/agent/routeResolver";
import { detectTaxType, taxEngine, type TaxTransactionType } from "@/lib/tax/taxEngine";
import {
  generateBalanceSheetPDF,
  generateCashFlowStatementPDF,
  generateFinancialStatementsPDF,
  generateIncomeStatementPDF,
  generateTaxPayablesPDF,
  generateTrialBalancePDF,
  type FinancialStatementData,
} from "@/lib/accountingPdfGenerator";
import { generateTaxSchedule as generateAccountingTaxSchedule } from "@/lib/accounting/transactionTaxAnalyzer";
import {
  run_tax_computation,
  generate_schedule as generateTaxSchedule,
  list_issues as listTaxIssues,
  apply_classification_rules as applyTaxClassificationRules,
  generate_filing_pack as generateTaxFilingPack,
  reconcile_tax as reconcileTaxReport,
} from "@/lib/tax/compliance/agent";
import type { TaxType as ComplianceTaxType } from "@/lib/tax/compliance/types";
import {
  walletEngine,
  generateFundingResponse,
  generateTransferResponse,
  formatNaira as formatWalletNaira,
} from "@/lib/wallet/walletEngine";
import type {
  AgentConversationMessage,
  UnifiedActionExecutionResult,
  UnifiedAgentAction,
  UnifiedAgentRequest,
  UnifiedAgentResponse,
} from "@/lib/agent/unifiedTypes";

let enginesLoaded = false;
const PLAN_TIMEOUT_MS = 30000;
const ACCOUNTING_PARSE_TIMEOUT_MS = 7000;
const UI_SNAPSHOT_MAX_ITEMS = 14;
const UI_STEP_DELAY_MS = 260;
const UI_SCROLL_SETTLE_DELAY_MS = 180;
const AGENT_LOOP_MAX_CYCLES = 3;
const AGENT_MEMORY_MAX_ITEMS = 40;
const EFFECTFUL_ACTION_TYPES = new Set<UnifiedAgentAction["type"]>([
  "accounting.postTransaction",
  "report.downloadPdf",
  "tax.recordTransaction",
  "tax.runComputation",
  "tax.generateSchedule",
  "tax.listIssues",
  "tax.applyClassificationRules",
  "tax.generateFilingPack",
  "tax.reconcile",
  "wallet.sendMoney",
  "wallet.fund",
  "projections.updateAssumption",
  "projections.resetAssumptions",
  "ui.operate",
]);

export type AgentPlanSource = "fast-path" | "gemini" | "fallback";
export type UnifiedCustomActionExecutor = (
  action: UnifiedAgentAction
) => Promise<UnifiedActionExecutionResult | null | undefined> | UnifiedActionExecutionResult | null | undefined;
type UiStepAction = "click" | "type" | "select" | "check" | "focus";
type UiRollbackHandler = () => void;
type ReportPdfType =
  | "trial_balance"
  | "income_statement"
  | "balance_sheet"
  | "cashflow"
  | "financial_statements"
  | "financial_summary"
  | "tax_payables";

type ProjectionAssumptionMeta = {
  key: string;
  min: number;
  max: number;
  kind: "percent" | "ratio" | "currency";
  aliases: string[];
};

const PROJECTION_ASSUMPTION_META: ProjectionAssumptionMeta[] = [
  {
    key: "revenueGrowthRate",
    min: -0.2,
    max: 0.6,
    kind: "percent",
    aliases: ["revenue growth", "rev growth", "growth rate", "sales growth"],
  },
  {
    key: "operatingExpenseGrowthRate",
    min: -0.1,
    max: 0.35,
    kind: "percent",
    aliases: ["operating expense growth", "opex growth", "expense growth"],
  },
  {
    key: "fixedCostInflationRate",
    min: 0,
    max: 0.15,
    kind: "percent",
    aliases: ["fixed cost inflation", "fixed inflation"],
  },
  {
    key: "cogsRatio",
    min: 0.01,
    max: 0.9,
    kind: "percent",
    aliases: ["cogs ratio", "cost of sales ratio", "cogs"],
  },
  {
    key: "variableCostRatio",
    min: 0.01,
    max: 0.9,
    kind: "percent",
    aliases: ["variable cost ratio", "variable costs"],
  },
  {
    key: "marketingSpendRatio",
    min: 0,
    max: 0.5,
    kind: "percent",
    aliases: ["marketing spend", "marketing ratio", "marketing"],
  },
  {
    key: "cashCollectionRatio",
    min: 0.4,
    max: 1.6,
    kind: "ratio",
    aliases: ["cash collection ratio", "collection ratio", "collection"],
  },
  {
    key: "cashDisbursementRatio",
    min: 0.4,
    max: 1.7,
    kind: "ratio",
    aliases: ["cash disbursement ratio", "disbursement ratio", "disbursement"],
  },
  {
    key: "fixedCostBaseline",
    min: 0,
    max: 100000000000,
    kind: "currency",
    aliases: ["fixed cost baseline", "fixed baseline", "fixed cost"],
  },
];

interface UiStepTarget {
  selector?: string;
  text?: string;
  placeholder?: string;
  label?: string;
  role?: string;
  exact?: boolean;
  index?: number;
}

interface UiStepPayload {
  action: UiStepAction;
  target: UiStepTarget;
  value: string;
}

interface PendingUiApproval {
  actions: UnifiedAgentAction[];
  planSource: AgentPlanSource;
}

interface AgentMemoryEntry {
  timestamp: number;
  module: string;
  objective: string;
  actionTypes: string[];
  observation: string;
  success: boolean;
}

let pendingUiApproval: PendingUiApproval | null = null;

export function formatPlanSourceLabel(source?: AgentPlanSource): string {
  const normalized = source || "fallback";
  return `AI plan source: ${normalized}`;
}

function normalizeModuleId(moduleId?: string): string {
  const cleaned = (moduleId || "general").toLowerCase().trim();
  return cleaned || "general";
}

function memoryKey(moduleId?: string): string {
  return `ql::agent-memory::${normalizeModuleId(moduleId)}`;
}

function loadAgentMemory(moduleId?: string): AgentMemoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(memoryKey(moduleId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is AgentMemoryEntry => Boolean(entry && typeof entry === "object"))
      .map((entry) => ({
        timestamp: typeof entry.timestamp === "number" ? entry.timestamp : Date.now(),
        module: typeof entry.module === "string" ? entry.module : normalizeModuleId(moduleId),
        objective: typeof entry.objective === "string" ? entry.objective : "",
        actionTypes: Array.isArray(entry.actionTypes) ? entry.actionTypes.filter((item): item is string => typeof item === "string") : [],
        observation: typeof entry.observation === "string" ? entry.observation : "",
        success: Boolean(entry.success),
      }))
      .slice(-AGENT_MEMORY_MAX_ITEMS);
  } catch {
    return [];
  }
}

function appendAgentMemory(moduleId: string, entry: AgentMemoryEntry): void {
  if (typeof window === "undefined") return;
  const existing = loadAgentMemory(moduleId);
  const next = [...existing, entry].slice(-AGENT_MEMORY_MAX_ITEMS);
  window.localStorage.setItem(memoryKey(moduleId), JSON.stringify(next));
}

function summarizeAgentMemory(moduleId?: string, limit = 6): string {
  const recent = loadAgentMemory(moduleId).slice(-limit);
  if (recent.length === 0) return "";
  return recent
    .map((entry) => {
      const actionSummary = entry.actionTypes.length > 0 ? entry.actionTypes.join(", ") : "conversation";
      const trimmedObservation = entry.observation.replace(/\s+/g, " ").trim().slice(0, 180);
      return `- goal: ${entry.objective.slice(0, 140)} | actions: ${actionSummary} | success: ${entry.success ? "yes" : "no"} | observation: ${trimmedObservation}`;
    })
    .join("\n");
}

function extractAmount(text: string): number | null {
  const match = text.match(/(?:₦|ngn|naira)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function detectRecipient(text: string): string | null {
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch?.[1]) return emailMatch[1];
  const phoneMatch = text.match(/(?:\+?234|0)?(\d{10})/);
  if (phoneMatch?.[1]) return phoneMatch[1];
  const toMatch = text.match(/\bto\s+([a-zA-Z][\w\s.-]{2,40})$/i);
  if (toMatch?.[1]) return toMatch[1].trim();
  return null;
}

function extractSignedNumber(text: string): number | null {
  const match = text.match(/-?\d[\d,]*(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function extractSnapshotMetric(snapshot: string, label: string): string {
  const regex = new RegExp(`${label}:\\s*([^\\n]+)`, "i");
  const match = snapshot.match(regex);
  return match?.[1]?.trim() || "";
}

function toMetricNumber(value: string): number | null {
  if (!value) return null;
  const cleaned = value.replace(/,/g, "");
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCompactNumber(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1).replace(/\.0$/, "")}t`;
  if (absolute >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}b`;
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  return Math.round(value).toLocaleString("en-NG");
}

function formatCompactNaira(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  const sign = value < 0 ? "-" : "";
  const formatted = formatCompactNumber(Math.abs(value));
  return `${sign}₦${formatted}`;
}

function formatSnapshotPercent(raw: string): string {
  if (!raw) return "n/a";
  if (/%/.test(raw)) return raw;
  const value = toMetricNumber(raw);
  if (value === null) return raw;
  if (Math.abs(value) <= 1) return `${(value * 100).toFixed(2)}%`;
  return `${value.toFixed(2)}%`;
}

function looksLikeProjectionSnapshotQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  return /\b(projection|forecast|model|analysis|insight|summary|trend|revenue|profit|margin|runway|cash|break[- ]?even)\b/.test(
    lower
  );
}

function looksLikeFigureGroundingRequest(message: string): boolean {
  const lower = normalizeIntentText(message);
  return /\b(figure|figures|number|numbers|data|respect to|based on|actual values|real values|from the dashboard|from my dashboard|from my projections)\b/.test(
    lower
  );
}

function looksLikeProjectionAssumptionChange(message: string): boolean {
  const lower = message.toLowerCase();
  const verb = /(set|update|change|adjust|input|apply|reset|clear)/.test(lower);
  const target = /(assumption|growth|cogs|baseline|collection|disbursement|marketing|opex|expense)/.test(lower);
  return verb && target;
}

function buildProjectionSnapshotReply(contextSnapshot: string): string {
  if (!contextSnapshot.trim()) {
    return "Open the projections dashboard so I can read the live metrics first.";
  }

  const modelName = extractSnapshotMetric(contextSnapshot, "Financial Modelling");
  const updatedAt = extractSnapshotMetric(contextSnapshot, "Updated at");

  if (modelName) {
    const summary = extractSnapshotMetric(contextSnapshot, "Summary");
    const topMetrics = extractSnapshotMetric(contextSnapshot, "Top metrics");
    const inputs = extractSnapshotMetric(contextSnapshot, "Key inputs");
    const header = updatedAt ? `Model snapshot (updated ${updatedAt}): ${modelName}` : `Model snapshot: ${modelName}`;
    const lines = [summary && `Summary: ${summary}`, topMetrics && `Top metrics: ${topMetrics}`, inputs && `Key inputs: ${inputs}`].filter(
      Boolean
    );
    return [header, ...lines].join("\n");
  }

  const annualRevenue = toMetricNumber(extractSnapshotMetric(contextSnapshot, "Projected annual revenue"));
  const netProfit6m = toMetricNumber(extractSnapshotMetric(contextSnapshot, "Projected net profit \\(6M\\)"));
  const grossMargin = extractSnapshotMetric(contextSnapshot, "Projected gross margin");
  const burnRate = toMetricNumber(extractSnapshotMetric(contextSnapshot, "Burn rate"));
  const cashBalance = toMetricNumber(extractSnapshotMetric(contextSnapshot, "Projected cash balance"));
  const runway = toMetricNumber(extractSnapshotMetric(contextSnapshot, "Runway months"));
  const breakEven = extractSnapshotMetric(contextSnapshot, "Break-even month");
  const recentWindow = extractSnapshotMetric(contextSnapshot, "Recent window");
  const recentAvgRevenue = toMetricNumber(extractSnapshotMetric(contextSnapshot, "Recent avg revenue"));
  const recentAvgNet = toMetricNumber(extractSnapshotMetric(contextSnapshot, "Recent avg net profit"));

  const header = updatedAt ? `Current projections snapshot (updated ${updatedAt}):` : "Current projections snapshot:";
  const lines = [
    `Annual revenue (projected): ${formatCompactNaira(annualRevenue)}`,
    `Net profit (next 6M): ${formatCompactNaira(netProfit6m)}`,
    `Gross margin: ${formatSnapshotPercent(grossMargin)}`,
    `Burn rate: ${burnRate && burnRate > 0 ? formatCompactNaira(burnRate) : "No burn"}`,
    `Projected cash balance: ${formatCompactNaira(cashBalance)}`,
    `Runway: ${runway ? `${Math.round(runway)} months` : "n/a"}`,
    `Break-even: ${breakEven || "n/a"}`,
  ];

  if (recentWindow) {
    const recentBits = [
      `Recent window: ${recentWindow}`,
      recentAvgRevenue ? `Avg revenue ${formatCompactNaira(recentAvgRevenue)}` : "",
      recentAvgNet ? `Avg net ${formatCompactNaira(recentAvgNet)}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    lines.push(recentBits);
  }

  return `${header}\n${lines.map((line) => `- ${line}`).join("\n")}`;
}

function buildProjectionHealthReply(contextSnapshot: string): string {
  if (!contextSnapshot.trim()) {
    return "I can assess that properly once I can read your live projections context. Open the projections page and ask again.";
  }

  const netProfit = toMetricNumber(extractSnapshotMetric(contextSnapshot, "Projected net profit \\(6M\\)"));
  const runway = toMetricNumber(extractSnapshotMetric(contextSnapshot, "Runway months"));
  const grossMargin = toMetricNumber(extractSnapshotMetric(contextSnapshot, "Projected gross margin"));
  const cashBalance = toMetricNumber(extractSnapshotMetric(contextSnapshot, "Projected cash balance"));
  const breakEvenMonth = extractSnapshotMetric(contextSnapshot, "Break-even month");

  const strengths: string[] = [];
  const risks: string[] = [];

  if (typeof netProfit === "number" && netProfit > 0) strengths.push("your 6-month net profit is positive");
  if (typeof grossMargin === "number" && grossMargin >= 35) strengths.push("gross margin is healthy");
  if (typeof runway === "number" && runway >= 9) strengths.push(`runway is comfortable at about ${Math.round(runway)} months`);
  if (typeof cashBalance === "number" && cashBalance > 0) strengths.push("projected cash stays above zero");

  if (typeof netProfit === "number" && netProfit <= 0) risks.push("6-month net profit is still negative");
  if (typeof runway === "number" && runway > 0 && runway < 6) risks.push(`runway is tight at about ${Math.round(runway)} months`);
  if (typeof grossMargin === "number" && grossMargin < 20) risks.push("gross margin is thin");
  if (breakEvenMonth && /not reached/i.test(breakEvenMonth)) risks.push("break-even is not reached in the current forecast window");

  if (strengths.length && risks.length === 0) {
    return `Your projections look solid overall: ${strengths.join(", ")}. If you want, I can pressure-test them with conservative and aggressive assumption scenarios.`;
  }

  if (!strengths.length && risks.length) {
    return `Right now, I would call the projections fragile: ${risks.join(", ")}. I can help you improve this by adjusting growth, COGS, and cost assumptions one by one.`;
  }

  if (strengths.length || risks.length) {
    return `Your projections are mixed. Positives: ${strengths.join(", ") || "none yet"}. Risks: ${
      risks.join(", ") || "no major red flags from current snapshot"
    }. If you want, I can tune assumptions now and show the likely impact.`;
  }

  return "I can review this properly, but I need a fuller projections snapshot first. Open the projections dashboard and ask again.";
}

function looksLikeProjectionQualityQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /\b(projection|forecast|runway|margin|cash|profit|break[- ]?even)\b/.test(lower) &&
    /\b(good|okay|ok|healthy|strong|bad|weak|how|review|assess|quality)\b/.test(lower)
  );
}

function normalizeIntentText(message: string): string {
  const compact = message.toLowerCase().replace(/\s+/g, " ").trim();
  return compact
    .replace(/\bpls\b/g, "please")
    .replace(/\bpls\s+/g, "please ")
    .replace(/\bprintout\b/g, "print out")
    .replace(/\btayable\s+payable\b/g, "tax payable")
    .replace(/\btayable\b/g, "payable")
    .replace(/\bpayble\b/g, "payable")
    .replace(/\bliablities\b/g, "liabilities")
    .replace(/\btaxable\s+payable\b/g, "tax payable");
}

function isReportActionIntent(message: string, moduleId?: string): boolean {
  const lower = normalizeIntentText(message);
  const reportVerb = /\b(print|print out|download|export|generate|get|give me|pull)\b/.test(lower);
  const reportObject =
    /\b(report|statement|trial balance|balance sheet|income statement|profit and loss|p&l|pnl|cash flow|tax payable|tax payables|tax liability|tax liabilities|payable)\b/.test(
      lower
    );
  const taxModulePayableAsk =
    (moduleId || "").toLowerCase() === "tax" &&
    /\b(payable|liabilit|vat|wht|cit|paye|education tax|tax)\b/.test(lower) &&
    /\b(print|download|export|report|statement|show|give me)\b/.test(lower);
  return (reportVerb && reportObject) || taxModulePayableAsk;
}

function isExplicitActionIntent(message: string): boolean {
  const lower = normalizeIntentText(message);
  return (
    /^(please\s+)?(?:post|record|create|add|log|save|run|analy[sz]e|calculate|compute|generate|export|download|print|print out|send|transfer|pay|fund|top up|navigate|go to|open|click|tap|select|type|fill|update|change|set|reset|apply|reconcile)\b/.test(
      lower
    ) ||
    /^(please\s+)?give me\b/.test(lower) ||
    /^(please\s+)?(?:put|increase|decrease)\b/.test(lower) ||
    /\b(?:can you|could you|please)\s+(?:post|record|create|run|analy[sz]e|calculate|generate|export|download|print|print out|send|transfer|pay|fund|navigate|go to|open|click|select|type|update|set|reset|apply|reconcile|put|increase|decrease)\b/.test(
      lower
    ) ||
    /\b(?:i want to|help me)\s+(?:post|record|create|run|analy[sz]e|calculate|generate|export|download|print|print out|send|transfer|pay|fund|navigate|open|update|set|reset|apply|reconcile|put|increase|decrease)\b/.test(
      lower
    )
  );
}

function isDataLookupIntent(message: string): boolean {
  const lower = normalizeIntentText(message);
  const asksQuestion = /\?|(?:\bwhat(?:'s| is)?\b)|\b(show|give|list|how much|how many|summari[sz]e|analy[sz]e|check)\b/.test(lower);
  const userScoped = /\b(my|our|current|latest|today|this|last)\b/.test(lower) || /\bhow much did i\b/.test(lower);
  const metricTopic = /\b(runway|burn|cash ?flow|cashflow|balance|revenue|profit|margin|expense|spend|transaction|tax|vat|wht|cgt|payable|liabilit)\b/.test(
    lower
  );
  return asksQuestion && userScoped && metricTopic;
}

function isExplainOnlyIntent(message: string): boolean {
  const lower = normalizeIntentText(message);
  const explanationPrompt =
    /\b(what is|what's|what does|meaning of|mean by|define|definition|explain|how does|difference between|why does|why is)\b/.test(
      lower
    );
  return explanationPrompt && !isExplicitActionIntent(message) && !isDataLookupIntent(message);
}

function buildNaturalQuestionReply(message: string, moduleId: string): string {
  const lower = message.toLowerCase();

  if (moduleId === "projections") {
    if (/\b(projection|forecast|runway|margin|cash|profit)\b/.test(lower)) {
      return "Good question. I can review the projection quality with you and point out what looks strong versus risky.";
    }
    return "Sure, we can talk through it naturally. I can also apply assumption changes when you want.";
  }

  if (moduleId === "accounting") {
    return "Good question. Let’s break it down clearly, and I can post the entry directly if you decide to execute.";
  }

  if (moduleId === "tax") {
    return "Good question. I’ll keep this practical and compliant, then we can execute the tax step if needed.";
  }

  if (moduleId === "wallet") {
    return "Good question. I can explain options first, then run the wallet action when you’re ready.";
  }

  return "Good question. We can talk it through naturally, and I can execute actions once you confirm details.";
}

function findProjectionAssumption(message: string): ProjectionAssumptionMeta | null {
  const lower = message.toLowerCase();
  for (const assumption of PROJECTION_ASSUMPTION_META) {
    if (assumption.aliases.some((alias) => lower.includes(alias))) {
      return assumption;
    }
  }
  return null;
}

function buildProjectionFallbackAction(message: string, moduleId: string): UnifiedAgentAction | null {
  if (moduleId !== "projections") return null;
  const lower = message.toLowerCase();

  if (/(reset|clear).*(assumption|inputs|projection)/.test(lower) || /reset to auto/.test(lower)) {
    return {
      type: "projections.resetAssumptions",
      payload: {},
      confidence: 0.72,
      reason: "Detected projection assumptions reset instruction",
    };
  }

  const updateIntent = /(set|update|change|adjust|input|apply|put|increase|decrease).*(assumption|growth|ratio|baseline|cogs|marketing|collection|disbursement|across all|all assumptions?)/.test(
    lower
  );
  if (!updateIntent) return null;

  const value = extractSignedNumber(message);
  if (value === null) return null;

  const acrossAllIntent = /\b(across all(?: assumptions)?|all assumptions?|all growth(?: rates?)?|all rates?)\b/.test(lower);
  if (acrossAllIntent) {
    const percentAssumptions = PROJECTION_ASSUMPTION_META.filter((assumption) => assumption.kind === "percent");
    if (percentAssumptions.length === 0) return null;
    return {
      type: "projections.updateAssumption",
      payload: {
        updates: percentAssumptions.map((assumption) => ({
          key: assumption.key,
          value,
          unit: "percent",
          min: assumption.min,
          max: assumption.max,
        })),
      },
      confidence: 0.74,
      reason: "Detected bulk projection assumption update instruction",
    };
  }

  const assumption = findProjectionAssumption(message);
  if (!assumption) return null;
  const explicitPercent = /%|percent/.test(lower);

  return {
    type: "projections.updateAssumption",
    payload: {
      updates: [
        {
          key: assumption.key,
          value,
          unit: explicitPercent || assumption.kind === "percent" ? "percent" : assumption.kind === "currency" ? "currency" : "decimal",
          min: assumption.min,
          max: assumption.max,
        },
      ],
    },
    confidence: 0.68,
    reason: "Detected projection assumption update instruction",
  };
}

function buildUiFallbackAction(message: string): UnifiedAgentAction | null {
  const cleaned = message.trim();
  if (!cleaned) return null;

  const typeMatch = cleaned.match(/\b(?:type|enter|fill)\s+["“']?(.+?)["”']?\s+(?:in|into|on)\s+(?:the\s+)?(.+)$/i);
  if (typeMatch) {
    return {
      type: "ui.operate",
      payload: {
        steps: [
          {
            action: "type",
            target: { text: typeMatch[2].trim() },
            value: typeMatch[1].trim(),
          },
        ],
      },
      confidence: 0.65,
      reason: "Detected UI typing instruction",
    };
  }

  const selectMatch = cleaned.match(/\b(?:select|choose)\s+["“']?(.+?)["”']?\s+(?:from|in)\s+(?:the\s+)?(.+)$/i);
  if (selectMatch) {
    return {
      type: "ui.operate",
      payload: {
        steps: [
          {
            action: "select",
            target: { text: selectMatch[2].trim() },
            value: selectMatch[1].trim(),
          },
        ],
      },
      confidence: 0.64,
      reason: "Detected UI selection instruction",
    };
  }

  const clickMatch = cleaned.match(/\b(?:click|tap|press|open|go to)\s+(?:on\s+|the\s+)?(.+)$/i);
  if (clickMatch?.[1]) {
    return {
      type: "ui.operate",
      payload: {
        steps: [
          {
            action: "click",
            target: { text: clickMatch[1].trim() },
          },
        ],
      },
      confidence: 0.62,
      reason: "Detected UI click instruction",
    };
  }

  return null;
}

function buildLocalFallbackPlan(request: UnifiedAgentRequest): UnifiedAgentResponse {
  const message = (request.message || "").trim();
  const lower = normalizeIntentText(message);
  const moduleId = (request.module || "general").toLowerCase();
  const contextSnapshot = typeof request.contextSnapshot === "string" ? request.contextSnapshot : "";
  const isLoopMetaMessage = /^goal\s*:/i.test(message) && /latest observation\s*:/i.test(lower);
  const amount = extractAmount(message);
  const actions: UnifiedAgentAction[] = [];

  if (isLoopMetaMessage) {
    return {
      reply: "Noted. I will wait for your next direct instruction.",
      actions: [],
      confidence: 0.72,
      reasoning: "Ignored loop meta prompt to avoid duplicated side effects.",
      planSource: "fallback",
    };
  }

  const greetingIntent = /\b(hi|hello|hey|yo|good morning|good afternoon|good evening)\b/.test(lower);
  const thanksIntent = /\b(thanks|thank you|appreciate)\b/.test(lower);
  const helpIntent = /\b(help|assist|what can you do|how do i|guide me)\b/.test(lower);
  const questionIntent =
    /\?$/.test(message) || /\b(what|why|how|when|where|who|can you|could you|should i|explain|tell me)\b/.test(lower);
  const uiIntent = /\b(click|tap|press|open|go to|select|choose|type|enter|fill|check|tick|toggle)\b/.test(lower);
  const walletIntent = /\b(send|transfer|pay|fund|top up|wallet)\b/.test(lower);
  const transactionIntent =
    /\b(sold|sale|invoice|received|receipt|paid|rent|salary|buy|bought|purchase|expense|transaction|journal|post)\b/.test(
      lower
    );
  const taxIntent = /\b(vat|wht|cgt|tax|firs|stamp|withholding)\b/.test(lower);
  const cashflowIntent = /\b(cashflow|cash flow|runway|burn)\b/.test(lower);
  const reportIntent = isReportActionIntent(message, moduleId);
  const complianceIntent = /\b(compute tax|run tax|tax computation|generate schedule|filing pack|reconcile|list issues|classification)\b/.test(lower);
  const projectionAdjustmentVerb = /(set|update|change|adjust|input|apply|reset|clear)/.test(lower);
  const projectionAssumptionIntent =
    projectionAdjustmentVerb && /(assumption|growth|cogs|baseline|collection|disbursement|marketing|opex|expense)/.test(lower);
  const explicitActionIntent = isExplicitActionIntent(message);
  const dataLookupIntent = isDataLookupIntent(message);
  const explainOnlyIntent = isExplainOnlyIntent(message);
  const navigationIntent =
    /\b(page|link|url|where|go to|open|navigate|take me|which page|location)\b/.test(lower) ||
    /\bupload (it|this|that)\b/.test(lower);
  const recentConversation = (request.conversation || [])
    .slice(-6)
    .map((item) => item.content)
    .join("\n");
  const routeSuggestion = resolveWorkspaceRouteFromText(
    `${message}\n${recentConversation}`,
    request.route,
    moduleId
  );

  const projectionAction = buildProjectionFallbackAction(message, moduleId);
  if (projectionAction && !explainOnlyIntent) actions.push(projectionAction);

  if (uiIntent && explicitActionIntent && !walletIntent && !transactionIntent && !taxIntent && !cashflowIntent && !explainOnlyIntent) {
    const uiAction = buildUiFallbackAction(message);
    if (uiAction) actions.push(uiAction);
  }

  if (
    routeSuggestion &&
    navigationIntent &&
    !walletIntent &&
    !transactionIntent &&
    !explainOnlyIntent
  ) {
    actions.push({
      type: "navigate",
      payload: { route: routeSuggestion.route },
      confidence: 0.78,
      reason: routeSuggestion.reason,
    });
  }

  if (thanksIntent && !walletIntent && !transactionIntent && !taxIntent && !cashflowIntent) {
    return {
      reply: "You’re welcome. We can keep chatting, or I can execute something whenever you’re ready.",
      actions: [],
      confidence: 0.82,
      reasoning: "Small-talk acknowledgement in client fallback planner.",
      planSource: "fallback",
    };
  }

  if (greetingIntent && !walletIntent && !transactionIntent && !taxIntent && !cashflowIntent) {
    return {
      reply: "Hi, I’m here. We can chat naturally and I can also run tasks directly in this module.",
      actions: [],
      confidence: 0.82,
      reasoning: "Greeting detected in client fallback planner.",
      planSource: "fallback",
    };
  }

  if (helpIntent && !walletIntent && !transactionIntent && !taxIntent && !cashflowIntent) {
    return {
      reply:
        "I can explain things conversationally, and I can also execute actions like posting entries, transfers, tax logs, and cashflow checks.",
      actions: [],
      confidence: 0.8,
      reasoning: "Help request in client fallback planner.",
      planSource: "fallback",
    };
  }

  if (walletIntent && amount && !explainOnlyIntent) {
    if (/fund|top up/.test(lower)) {
      actions.push({
        type: "wallet.fund",
        payload: { amount },
        confidence: 0.7,
        reason: "Detected wallet funding instruction",
      });
    } else {
      const recipient = detectRecipient(message);
      if (recipient) {
        actions.push({
          type: "wallet.sendMoney",
          payload: { amount, recipient },
          confidence: 0.72,
          reason: "Detected wallet transfer instruction",
        });
      }
    }
  }

  if (
    reportIntent &&
    !explainOnlyIntent &&
    (explicitActionIntent || /\b(my|current|latest|download|export|pdf|give me|print|print out|show)\b/.test(lower))
  ) {
    actions.push({
      type: "report.downloadPdf",
      payload: {
        reportType: normalizeReportPdfType("", message),
        format: "pdf",
        description: message,
      },
      confidence: 0.75,
      reason: "Detected report generation/download request",
    });
  }

  if (transactionIntent && amount && actions.length === 0 && !explainOnlyIntent) {
    actions.push({
      type: "accounting.postTransaction",
      payload: {
        description: message,
        amount,
      },
      confidence: 0.67,
      reason: "Detected accounting transaction instruction",
    });
  }

  if ((taxIntent || moduleId === "tax") && amount && !complianceIntent && !explainOnlyIntent) {
    actions.push({
      type: "tax.recordTransaction",
      payload: {
        description: message,
        amount,
      },
      confidence: 0.64,
      reason: "Detected tax transaction instruction",
    });
  }

  if (moduleId === "tax" && complianceIntent && !explainOnlyIntent && explicitActionIntent) {
    const periodMatch = message.match(/(20\\d{2}-Q[1-4]|20\\d{2}-\\d{2}|20\\d{2})/i);
    const taxTypeMatch = message.match(/\\b(vat|wht|cgt|cit|stamp)\\b/i);
    const period = periodMatch ? periodMatch[1].toUpperCase() : "current";
    const taxType = taxTypeMatch ? taxTypeMatch[1].toUpperCase() : undefined;

    if (/compute tax|run tax|tax computation/.test(lower)) {
      actions.push({
        type: "tax.runComputation",
        payload: { period, taxTypes: taxType ? [taxType] : undefined },
        confidence: 0.72,
        reason: "Detected tax computation request",
      });
    }

    if (/apply classification|classification rules/.test(lower)) {
      actions.push({
        type: "tax.applyClassificationRules",
        payload: { period },
        confidence: 0.7,
        reason: "Detected classification rule request",
      });
    }

    if (/list issues|issues/.test(lower)) {
      actions.push({
        type: "tax.listIssues",
        payload: { period },
        confidence: 0.7,
        reason: "Detected tax issues request",
      });
    }

    if (/generate schedule|schedule/.test(lower) && taxType) {
      actions.push({
        type: "tax.generateSchedule",
        payload: { period, taxType },
        confidence: 0.7,
        reason: "Detected schedule generation request",
      });
    }

    if (/filing pack|export|download/.test(lower) && taxType) {
      const format = /csv/.test(lower) ? "csv" : /xlsx/.test(lower) ? "xlsx" : "pdf";
      actions.push({
        type: "tax.generateFilingPack",
        payload: { period, taxType, format },
        confidence: 0.68,
        reason: "Detected filing pack request",
      });
    }

    if (/reconcile/.test(lower) && taxType) {
      actions.push({
        type: "tax.reconcile",
        payload: { period, taxType },
        confidence: 0.7,
        reason: "Detected reconciliation request",
      });
    }
  }

  if (cashflowIntent && (!explainOnlyIntent || dataLookupIntent || explicitActionIntent)) {
    actions.push({
      type: "cashflow.analyze",
      payload: {
        focus: lower.includes("runway") ? "runway" : lower.includes("burn") ? "burn" : "summary",
      },
      confidence: 0.64,
      reason: "Detected cashflow analysis instruction",
    });
  }

  if (actions.length > 0) {
    return {
      reply:
        actions[0]?.type === "ui.operate"
          ? "Understood. I’ll do that directly in the interface now."
          : actions[0]?.type === "navigate"
            ? `Understood. Opening ${toText(actions[0].payload?.route)} now.`
          : actions[0]?.type === "report.downloadPdf"
            ? "Understood. I’ll generate that report and attach a PDF download here."
          : actions[0]?.type === "projections.updateAssumption"
            ? "Understood. I’ll update the projection assumptions now."
            : actions[0]?.type === "projections.resetAssumptions"
              ? "Understood. I’ll reset projection assumptions back to auto."
              : "Understood. I’m executing that now.",
      actions: actions.slice(0, 4),
      confidence: Math.max(...actions.map((action) => action.confidence || 0.6)),
      reasoning: "Generated by client fallback planner.",
      planSource: "fallback",
    };
  }

  if (walletIntent && !explainOnlyIntent) {
    return {
      reply: "I can run that wallet request. Please include both amount and recipient in one sentence.",
      actions: [],
      confidence: 0.56,
      reasoning: "Wallet intent lacked required execution details.",
      planSource: "fallback",
    };
  }

  if (moduleId === "projections" && looksLikeProjectionQualityQuestion(message)) {
    return {
      reply: buildProjectionHealthReply(contextSnapshot),
      actions: [],
      confidence: 0.62,
      reasoning: "Projection quality question answered from context snapshot in client fallback.",
      planSource: "fallback",
    };
  }

  if (questionIntent) {
    return {
      reply: buildNaturalQuestionReply(message, moduleId),
      actions: [],
      confidence: 0.58,
      reasoning: "Conversational question without actionable payload in fallback planner.",
      planSource: "fallback",
    };
  }

  if (moduleId === "projections" && projectionAssumptionIntent) {
    return {
      reply:
        "I can update projection assumptions directly. Tell me the field and value, for example: set revenue growth assumption to 12%.",
      actions: [],
      confidence: 0.58,
      reasoning: "Projection intent without explicit actionable value.",
      planSource: "fallback",
    };
  }

  if (transactionIntent || taxIntent || moduleId === "accounting" || moduleId === "tax") {
    return {
      reply: "I can post this for you. Add the amount so I can execute it safely.",
      actions: [],
      confidence: 0.54,
      reasoning: "Posting intent lacked amount.",
      planSource: "fallback",
    };
  }

  if (uiIntent) {
    return {
      reply: "I can operate this screen for you. Tell me the exact button, field, or menu to use.",
      actions: [],
      confidence: 0.55,
      reasoning: "UI intent detected but action target was unclear.",
      planSource: "fallback",
    };
  }

  return {
    reply:
      "I’m ready to help. Tell me exactly what to do, for example: post sale ₦120,000, send ₦8,000 to a recipient, or analyze cashflow.",
    actions: [],
    confidence: 0.45,
    reasoning: "Client fallback planner could not map request to an execution action.",
    planSource: "fallback",
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

function normalizeAccountingType(value?: string): TransactionType {
  const normalized = (value || "").toLowerCase();
  if (normalized === "income" || normalized === "expense" || normalized === "asset" || normalized === "liability" || normalized === "equity") {
    return normalized;
  }
  return "other";
}

function mapParsedTypeToAccountingType(value?: string): TransactionType {
  const normalized = (value || "").toLowerCase();
  if (normalized === "sale" || normalized === "receipt") return "income";
  if (normalized === "purchase" || normalized === "expense" || normalized === "payment") return "expense";
  if (normalized === "transfer" || normalized === "asset") return "asset";
  if (normalized === "loan") return "liability";
  if (normalized === "equity") return "equity";
  return "other";
}

function ensureEnginesLoaded(): void {
  if (enginesLoaded || typeof window === "undefined") return;
  accountingEngine.load();
  taxEngine.load();
  walletEngine.load();
  enginesLoaded = true;
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeReportPdfType(value: unknown, fallbackText = ""): ReportPdfType {
  const candidate = normalizeIntentText(`${toText(value)} ${fallbackText}`);
  if (/\btrial\s*balance\b/.test(candidate)) return "trial_balance";
  if (/\b(balance\s*sheet|statement of financial position|sfp)\b/.test(candidate)) return "balance_sheet";
  if (/\b(income\s*statement|profit\s*&?\s*loss|profit and loss|p&l|pnl)\b/.test(candidate)) return "income_statement";
  if (/\b(cash\s*flow|cashflow)\b/.test(candidate)) return "cashflow";
  if (/\bfinancial\s+statements?\b/.test(candidate)) return "financial_statements";
  if (/\bfinancial\s+summary\b/.test(candidate)) return "financial_summary";
  if (
    /\b(tax payable|tax payables|tax liability|tax liabilities|vat payable|wht payable|cit payable|paye payable|education tax)\b/.test(
      candidate
    ) ||
    /\bpayable payable\b/.test(candidate)
  ) {
    return "tax_payables";
  }
  return "financial_statements";
}

function resolveReportYear(yearHint: unknown, hintText: string, entryDates: string[]): number {
  const currentYear = new Date().getFullYear();
  const entryYears = Array.from(
    new Set(
      entryDates
        .map((dateText) => new Date(`${dateText}T00:00:00`).getFullYear())
        .filter((year) => Number.isFinite(year) && year >= 1900 && year <= 2100)
    )
  ).sort((a, b) => a - b);

  const parsedHint = Number(yearHint);
  if (Number.isFinite(parsedHint) && parsedHint >= 1900 && parsedHint <= 2100) {
    return Math.round(parsedHint);
  }

  const yearMatches = normalizeIntentText(hintText).match(/\b(19|20)\d{2}\b/g);
  if (yearMatches?.length) {
    const latestMentioned = Number(yearMatches[yearMatches.length - 1]);
    if (Number.isFinite(latestMentioned)) return latestMentioned;
  }

  if (entryYears.length) return entryYears[entryYears.length - 1];
  return currentYear;
}

function buildYearlyFinancialStatement(entriesForYear: Array<{ lines: Array<{ accountCode: string; debit: number; credit: number }> }>): Omit<
  FinancialStatementData,
  "year" | "cashFlow" | "equityStatement"
> {
  let revenue = 0;
  let costOfSales = 0;
  let operatingExpenses = 0;
  let assets = 0;
  let liabilities = 0;
  let equity = 0;

  for (const entry of entriesForYear) {
    for (const line of entry.lines) {
      const code = line.accountCode || "";
      if (code.startsWith("4")) {
        revenue += line.credit || 0;
      } else if (code.startsWith("50")) {
        costOfSales += line.debit || 0;
      } else if (code.startsWith("5") || code.startsWith("6")) {
        operatingExpenses += line.debit || 0;
      } else if (code.startsWith("1")) {
        assets += (line.debit || 0) - (line.credit || 0);
      } else if (code.startsWith("2")) {
        liabilities += (line.credit || 0) - (line.debit || 0);
      } else if (code.startsWith("3")) {
        equity += (line.credit || 0) - (line.debit || 0);
      }
    }
  }

  const grossProfit = revenue - costOfSales;
  const netIncome = grossProfit - operatingExpenses;
  return {
    revenue,
    costOfSales,
    grossProfit,
    operatingExpenses,
    netIncome,
    assets,
    liabilities,
    equity,
  };
}

async function buildReportPdfBlob(
  reportType: ReportPdfType,
  businessName: string,
  hintText = "",
  reportYearHint?: unknown
): Promise<{ blob: Blob; fileName: string; label: string } | null> {
  ensureEnginesLoaded();
  const state = accountingEngine.getState();
  const entries = state.journalEntries || [];
  const entryDates = entries.map((entry) => entry.date);
  const selectedYear = resolveReportYear(reportYearHint, hintText, entryDates);
  const entriesForYear = entries.filter((entry) => {
    const year = new Date(`${entry.date}T00:00:00`).getFullYear();
    return year === selectedYear;
  });

  const statements = accountingEngine.generateStatements();
  const trialBalance = accountingEngine.generateTrialBalance();
  if (!entries.length) {
    return null;
  }

  const statementData: FinancialStatementData = {
    year: selectedYear,
    ...buildYearlyFinancialStatement(entriesForYear),
    cashFlow: {
      year: selectedYear,
      cashFromOperations: statements.cashFromOperations || 0,
      cashFromInvesting: statements.cashFromInvesting || 0,
      cashFromFinancing: statements.cashFromFinancing || 0,
    },
    equityStatement: {
      year: selectedYear,
      openingBalance: statements.equityStatement?.openingBalance || 0,
      additions: statements.equityStatement?.additions || 0,
      netIncome: statements.equityStatement?.netIncome || 0,
      drawings: statements.equityStatement?.drawings || 0,
      closingBalance: statements.equityStatement?.closingBalance || 0,
    },
  };

  if (reportType === "trial_balance") {
    if (!trialBalance.accounts.length) return null;
    const asAtDate = new Date().toLocaleDateString("en-NG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const blob = await generateTrialBalancePDF(trialBalance, asAtDate, businessName, { outputMode: "blob" });
    if (!(blob instanceof Blob)) return null;
    return {
      blob,
      fileName: `trial-balance-${asAtDate.replace(/\s/g, "-")}.pdf`,
      label: "Trial Balance",
    };
  }

  if (reportType === "income_statement") {
    if (!entriesForYear.length) return null;
    const blob = await generateIncomeStatementPDF(statementData, businessName, { outputMode: "blob" });
    if (!(blob instanceof Blob)) return null;
    return {
      blob,
      fileName: `income-statement-${selectedYear}.pdf`,
      label: "Income Statement",
    };
  }

  if (reportType === "balance_sheet") {
    if (!entriesForYear.length) return null;
    const blob = await generateBalanceSheetPDF(statementData, businessName, { outputMode: "blob" });
    if (!(blob instanceof Blob)) return null;
    return {
      blob,
      fileName: `balance-sheet-${selectedYear}.pdf`,
      label: "Balance Sheet",
    };
  }

  if (reportType === "cashflow") {
    const blob = await generateCashFlowStatementPDF(
      {
        year: selectedYear,
        cashFromOperations: statements.cashFromOperations || 0,
        cashFromInvesting: statements.cashFromInvesting || 0,
        cashFromFinancing: statements.cashFromFinancing || 0,
      },
      businessName,
      { outputMode: "blob" }
    );
    if (!(blob instanceof Blob)) return null;
    return {
      blob,
      fileName: `cash-flow-statement-${selectedYear}.pdf`,
      label: "Cash Flow Statement",
    };
  }

  if (reportType === "tax_payables") {
    const taxSchedule = generateAccountingTaxSchedule(entries, {
      isVatRegistered: true,
    });
    const blob = await generateTaxPayablesPDF(taxSchedule, businessName, { outputMode: "blob" });
    if (!(blob instanceof Blob)) return null;
    return {
      blob,
      fileName: `tax-payables-schedule-${taxSchedule.asAtDate}.pdf`,
      label: "Tax Payables Schedule",
    };
  }

  if (!entriesForYear.length) return null;
  const blob = await generateFinancialStatementsPDF(statementData, businessName, { outputMode: "blob" });
  if (!(blob instanceof Blob)) return null;
  return {
    blob,
    fileName: `financial-statements-${selectedYear}.pdf`,
    label: "Financial Statements",
  };
}

function normalizeUiText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function isVisibleElement(element: Element): boolean {
  const el = element as HTMLElement;
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
}

function getElementLabelText(element: Element): string {
  const input = element as HTMLInputElement;
  if (input.id) {
    const byFor = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    if (byFor?.textContent) return byFor.textContent.trim();
  }
  const parentLabel = element.closest("label");
  if (parentLabel?.textContent) return parentLabel.textContent.trim();
  return "";
}

function resolveUiTargetElement(target: UiStepTarget): HTMLElement | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;

  if (target.selector) {
    const el = document.querySelector(target.selector);
    return el instanceof HTMLElement ? el : null;
  }

  const normalizedText = normalizeUiText(target.text || "");
  const normalizedPlaceholder = normalizeUiText(target.placeholder || "");
  const normalizedLabel = normalizeUiText(target.label || "");

  const selector =
    "button, a, [role='button'], input, textarea, select, label, [data-testid], [aria-label], [name]";
  const candidates = Array.from(document.querySelectorAll(selector))
    .filter(isVisibleElement)
    .map((el) => {
      const textContent = normalizeUiText((el.textContent || "").trim());
      const ariaLabel = normalizeUiText(el.getAttribute("aria-label") || "");
      const placeholder = normalizeUiText((el as HTMLInputElement).placeholder || "");
      const name = normalizeUiText(el.getAttribute("name") || "");
      const label = normalizeUiText(getElementLabelText(el));
      return { el, textContent, ariaLabel, placeholder, name, label };
    });

  const matches = candidates.filter((candidate) => {
    const fields = [candidate.textContent, candidate.ariaLabel, candidate.placeholder, candidate.name, candidate.label];
    const textOk = normalizedText
      ? fields.some((field) => (target.exact ? field === normalizedText : field.includes(normalizedText)))
      : true;
    const placeholderOk = normalizedPlaceholder
      ? fields.some((field) => (target.exact ? field === normalizedPlaceholder : field.includes(normalizedPlaceholder)))
      : true;
    const labelOk = normalizedLabel
      ? fields.some((field) => (target.exact ? field === normalizedLabel : field.includes(normalizedLabel)))
      : true;
    return textOk && placeholderOk && labelOk;
  });

  const index = Number.isFinite(target.index) ? Math.max(0, Number(target.index)) : 0;
  const picked = matches[index]?.el || matches[0]?.el || null;
  return picked instanceof HTMLElement ? picked : null;
}

function setReactLikeInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (descriptor?.set) descriptor.set.call(element, value);
  else element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function parseUiSteps(action: UnifiedAgentAction): UiStepPayload[] {
  const payload = action.payload || {};
  const rawSteps = Array.isArray(payload.steps) ? payload.steps : [];
  const parsed = rawSteps
    .filter((step) => step && typeof step === "object")
    .map((step) => {
      const record = step as Record<string, unknown>;
      const actionName = toText(record.action).toLowerCase();
      if (!["click", "type", "select", "check", "focus"].includes(actionName)) return null;
      const targetRaw = record.target && typeof record.target === "object" ? (record.target as Record<string, unknown>) : {};
      const target: UiStepTarget = {
        selector: toText(targetRaw.selector),
        text: toText(targetRaw.text),
        placeholder: toText(targetRaw.placeholder),
        label: toText(targetRaw.label),
        role: toText(targetRaw.role),
        exact: typeof targetRaw.exact === "boolean" ? targetRaw.exact : undefined,
        index: typeof targetRaw.index === "number" && Number.isFinite(targetRaw.index) ? targetRaw.index : undefined,
      };
      return {
        action: actionName as UiStepAction,
        target,
        value: toText(record.value),
      };
    })
    .filter((step): step is UiStepPayload => Boolean(step));
  return parsed;
}

function describeUiTarget(target: UiStepTarget): string {
  return target.text || target.label || target.placeholder || target.selector || "target";
}

function uiStepNeedsConfirmation(step: UiStepPayload): boolean {
  const riskyWords = /(delete|remove|void|submit|confirm|pay|send|transfer|withdraw|erase|reset|clear)/i;
  const targetText = `${describeUiTarget(step.target)} ${step.value || ""}`;
  return riskyWords.test(targetText);
}

function uiActionNeedsConfirmation(action: UnifiedAgentAction): boolean {
  return parseUiSteps(action).some(uiStepNeedsConfirmation);
}

function isConfirmMessage(message: string): boolean {
  return /^(confirm|yes|yes proceed|proceed|go ahead|continue|do it|yes please|ok proceed|okay proceed|proceed now)$/i.test(
    message.trim().toLowerCase()
  );
}

function isCancelMessage(message: string): boolean {
  return /^(cancel|stop|no|don't|do not)$/i.test(message.trim());
}

function extractPendingInstructionFromConversation(
  conversation: AgentConversationMessage[] | undefined,
  confirmationMessage: string
): string | null {
  if (!isConfirmMessage(confirmationMessage) || !Array.isArray(conversation) || conversation.length === 0) return null;
  const normalizedConfirmation = confirmationMessage.trim().toLowerCase();
  const lastIndex = conversation.length - 1;
  if (lastIndex < 0) return null;
  const lastMessage = conversation[lastIndex];
  if (!lastMessage || lastMessage.role !== "user" || lastMessage.content.trim().toLowerCase() !== normalizedConfirmation) return null;

  const prior = conversation.slice(0, -1);
  const assistantIndex = [...prior].reverse().findIndex(
    (item) => item.role === "assistant" && /\b(confirm|proceed|approve|go ahead|continue)\b/i.test(item.content)
  );
  if (assistantIndex < 0) return null;

  const absoluteAssistantIndex = prior.length - 1 - assistantIndex;
  for (let i = absoluteAssistantIndex - 1; i >= 0; i -= 1) {
    const item = prior[i];
    if (item.role === "user" && item.content.trim()) {
      return item.content.trim();
    }
  }
  return null;
}

function captureUiSnapshot(): string {
  if (typeof window === "undefined" || typeof document === "undefined") return "";

  const collect = (selector: string, mapper: (el: Element) => string): string[] =>
    Array.from(document.querySelectorAll(selector))
      .filter(isVisibleElement)
      .map(mapper)
      .map((value) => value.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, UI_SNAPSHOT_MAX_ITEMS);

  const title = document.title || "";
  const headings = collect("h1, h2, h3", (el) => el.textContent || "");
  const buttons = collect("button, [role='button']", (el) => el.textContent || el.getAttribute("aria-label") || "");
  const links = collect("a[href]", (el) => `${el.textContent || ""} -> ${(el as HTMLAnchorElement).getAttribute("href") || ""}`);
  const inputs = collect("input, textarea, select", (el) => {
    const input = el as HTMLInputElement;
    const label = getElementLabelText(el);
    const placeholder = input.placeholder || "";
    const name = input.name || "";
    return [label, placeholder, name].filter(Boolean).join(" | ");
  });

  return [
    `Title: ${title}`,
    headings.length ? `Headings: ${headings.join(" ; ")}` : "",
    buttons.length ? `Buttons: ${buttons.join(" ; ")}` : "",
    inputs.length ? `Inputs: ${inputs.join(" ; ")}` : "",
    links.length ? `Links: ${links.join(" ; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2200);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function flashUiTarget(element: HTMLElement): void {
  const previousOutline = element.style.outline;
  const previousOutlineOffset = element.style.outlineOffset;
  const previousBoxShadow = element.style.boxShadow;
  const previousTransition = element.style.transition;

  element.style.transition = "box-shadow 140ms ease, outline-color 140ms ease";
  element.style.outline = "2px solid rgba(37, 99, 235, 0.9)";
  element.style.outlineOffset = "2px";
  element.style.boxShadow = "0 0 0 4px rgba(37, 99, 235, 0.18)";

  window.setTimeout(() => {
    element.style.outline = previousOutline;
    element.style.outlineOffset = previousOutlineOffset;
    element.style.boxShadow = previousBoxShadow;
    element.style.transition = previousTransition;
  }, 520);
}

function restoreCheckboxLikeInput(element: HTMLInputElement, checked: boolean): void {
  element.checked = checked;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function rollbackUiSteps(rollback: UiRollbackHandler[], notes: string[]): number {
  let restored = 0;
  for (let i = rollback.length - 1; i >= 0; i -= 1) {
    try {
      rollback[i]();
      restored += 1;
    } catch {
      notes.push("Rollback skipped for one step.");
    }
  }
  return restored;
}

async function executeUiOperate(
  action: UnifiedAgentAction,
  options?: {
    shouldStop?: () => boolean;
    rollbackOnStop?: boolean;
  }
): Promise<UnifiedActionExecutionResult> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      type: "ui.operate",
      success: false,
      message: "UI operator is only available in the browser runtime.",
    };
  }

  const steps = parseUiSteps(action);
  if (steps.length === 0) {
    return {
      type: "ui.operate",
      success: false,
      message: "No valid UI steps were provided.",
    };
  }

  const notes: string[] = [];
  const rollbackHandlers: UiRollbackHandler[] = [];
  for (const step of steps) {
    if (options?.shouldStop?.()) {
      const restoredCount = options.rollbackOnStop === false ? 0 : rollbackUiSteps(rollbackHandlers, notes);
      return {
        type: "ui.operate",
        success: false,
        message:
          options.rollbackOnStop === false
            ? `Agent action stopped by user. ${notes.join("\n")}`
            : `Agent action stopped by user and rolled back ${restoredCount} reversible UI step(s).\n${notes.join("\n")}`,
      };
    }

    const element = resolveUiTargetElement(step.target);
    if (!element) {
      notes.push(`Could not find ${describeUiTarget(step.target)}.`);
      continue;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    flashUiTarget(element);
    await sleep(UI_SCROLL_SETTLE_DELAY_MS);

    if (step.action === "focus") {
      const previousActive = document.activeElement;
      if (previousActive instanceof HTMLElement) {
        rollbackHandlers.push(() => previousActive.focus());
      }
      element.focus();
      notes.push(`Focused ${describeUiTarget(step.target)}.`);
      await sleep(UI_STEP_DELAY_MS);
      continue;
    }

    if (step.action === "click") {
      if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
        const previousChecked = element.checked;
        rollbackHandlers.push(() => restoreCheckboxLikeInput(element, previousChecked));
      }
      element.click();
      notes.push(`Clicked ${describeUiTarget(step.target)}.`);
      await sleep(UI_STEP_DELAY_MS);
      continue;
    }

    if (step.action === "type") {
      const value = step.value || "";
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        const previousValue = element.value;
        rollbackHandlers.push(() => setReactLikeInputValue(element, previousValue));
        setReactLikeInputValue(element, value);
        notes.push(`Entered text in ${describeUiTarget(step.target)}.`);
      } else {
        notes.push(`Could not type into ${describeUiTarget(step.target)}.`);
      }
      await sleep(UI_STEP_DELAY_MS);
      continue;
    }

    if (step.action === "select") {
      const value = step.value || "";
      if (element instanceof HTMLSelectElement) {
        const previousValue = element.value;
        rollbackHandlers.push(() => {
          element.value = previousValue;
          element.dispatchEvent(new Event("change", { bubbles: true }));
        });
        const optionByValue = Array.from(element.options).find((option) => normalizeUiText(option.value) === normalizeUiText(value));
        const optionByText = Array.from(element.options).find((option) => normalizeUiText(option.textContent || "") === normalizeUiText(value));
        element.value = (optionByValue || optionByText)?.value || value;
        element.dispatchEvent(new Event("change", { bubbles: true }));
        notes.push(`Selected ${value} in ${describeUiTarget(step.target)}.`);
      } else if (element instanceof HTMLElement) {
        element.click();
        notes.push(`Opened selector ${describeUiTarget(step.target)}.`);
      }
      await sleep(UI_STEP_DELAY_MS);
      continue;
    }

    if (step.action === "check") {
      if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
        const previousChecked = element.checked;
        rollbackHandlers.push(() => restoreCheckboxLikeInput(element, previousChecked));
        if (!element.checked) element.click();
        notes.push(`Checked ${describeUiTarget(step.target)}.`);
      } else {
        element.click();
        notes.push(`Toggled ${describeUiTarget(step.target)}.`);
      }
      await sleep(UI_STEP_DELAY_MS);
    }
  }

  const successCount = notes.filter((note) => !note.toLowerCase().startsWith("could not")).length;
  return {
    type: "ui.operate",
    success: successCount > 0,
    message:
      successCount > 0
        ? `UI operator completed ${successCount}/${steps.length} steps.\n${notes.join("\n")}`
        : `UI operator could not execute the requested steps.\n${notes.join("\n")}`,
  };
}

function shouldTryAdvancedAccountingParse(description: string, transactionType: TransactionType): boolean {
  const complexPattern =
    /\b(vat|wht|debit|credit|accrual|deferred|allocate|split|reclass|adjustment|amort|depreciation)\b/i;
  const isLongRequest = description.split(/\s+/).length >= 12;
  return transactionType === "other" || complexPattern.test(description) || isLongRequest;
}

type AccountingUiMirrorLine = {
  accountCode: string;
  debit: number;
  credit: number;
};

type AccountingUiMirrorPayload = {
  entryId: string;
  date: string;
  narration: string;
  lines: AccountingUiMirrorLine[];
};

function toAccountingUiMirrorPayload(fallbackNarration: string): AccountingUiMirrorPayload | null {
  if (typeof window === "undefined") return null;
  const entries = accountingEngine.getState().journalEntries || [];
  if (entries.length === 0) return null;
  const latest = entries[entries.length - 1];
  if (!latest || !Array.isArray(latest.lines)) return null;

  const lines = latest.lines
    .map((line) => ({
      accountCode: toText(line.accountCode),
      debit: Math.max(0, toNumber(line.debit)),
      credit: Math.max(0, toNumber(line.credit)),
    }))
    .filter((line) => line.accountCode && (line.debit > 0 || line.credit > 0));

  if (lines.length === 0) return null;

  return {
    entryId: toText(latest.id),
    date: toText(latest.date, getTodayDate()),
    narration: toText(latest.narration, fallbackNarration) || fallbackNarration,
    lines,
  };
}

async function runAccountingUiMirror(payload: AccountingUiMirrorPayload): Promise<string> {
  if (typeof window === "undefined" || typeof document === "undefined") return "";
  if (!window.location.pathname.startsWith("/accounting")) return "";
  const openButton = document.querySelector('[data-agent-target="open-post-journal-entry"]');
  if (!(openButton instanceof HTMLElement)) return "";
  const addLineButton = document.querySelector('[data-agent-target="post-entry-add-line"]');
  if (!(addLineButton instanceof HTMLElement)) return "";

  const normalizedLines = payload.lines
    .filter((line) => line.accountCode && (line.debit > 0 || line.credit > 0))
    .map((line) => ({
      accountCode: line.accountCode,
      debit: Math.max(0, line.debit || 0),
      credit: Math.max(0, line.credit || 0),
    }));
  if (normalizedLines.length === 0) return "";

  const steps: UiStepPayload[] = [
    {
      action: "click",
      target: { selector: '[data-agent-target="open-post-journal-entry"]' },
      value: "",
    },
    {
      action: "type",
      target: { selector: '[data-agent-target="post-entry-date"]' },
      value: payload.date,
    },
    {
      action: "type",
      target: { selector: '[data-agent-target="post-entry-narration"]' },
      value: payload.narration,
    },
  ];

  for (let index = 2; index < normalizedLines.length; index += 1) {
    steps.push({
      action: "click",
      target: { selector: '[data-agent-target="post-entry-add-line"]' },
      value: "",
    });
  }

  normalizedLines.forEach((line, index) => {
    const lineNumber = index + 1;
    steps.push(
      {
        action: "select",
        target: { selector: `[data-agent-target="post-entry-line-${lineNumber}-account"]` },
        value: line.accountCode,
      },
      {
        action: "type",
        target: { selector: `[data-agent-target="post-entry-line-${lineNumber}-debit"]` },
        value: line.debit > 0 ? String(line.debit) : "",
      },
      {
        action: "type",
        target: { selector: `[data-agent-target="post-entry-line-${lineNumber}-credit"]` },
        value: line.credit > 0 ? String(line.credit) : "",
      }
    );
  });

  const previewAction: UnifiedAgentAction = {
    type: "ui.operate",
    payload: {
      steps,
    },
  };

  const mirrorResult = await executeUiOperate(previewAction, { rollbackOnStop: false });
  if (mirrorResult.success) {
    window.dispatchEvent(
      new CustomEvent("accounting-agent-preview", {
        detail: {
          entryId: payload.entryId,
          date: payload.date,
          narration: payload.narration,
          lines: normalizedLines,
        },
      })
    );
  }
  return mirrorResult.success ? "Live UI preview updated in Post Journal Entry form." : "";
}

async function executeAccountingPost(action: UnifiedAgentAction): Promise<UnifiedActionExecutionResult> {
  const payload = action.payload || {};
  const description = toText(payload.description);
  const amount = Math.abs(toNumber(payload.amount));
  const looksLikeLoopMetaDescription = /^goal\s*:/i.test(description) && /latest observation\s*:/i.test(description.toLowerCase());

  if (!description || amount <= 0) {
    return {
      type: "accounting.postTransaction",
      success: false,
      message: "Skipped accounting post because amount or description was missing.",
    };
  }

  if (looksLikeLoopMetaDescription) {
    return {
      type: "accounting.postTransaction",
      success: false,
      message: "Skipped accounting post because the payload looked like agent loop metadata, not a real transaction description.",
    };
  }

  const date = toText(payload.date, getTodayDate());
  const category = toText(payload.category, "other");
  const forcedType = normalizeAccountingType(toText(payload.transactionType));
  const rawTx: RawTransaction = {
    id: `agent-tx-${Date.now()}`,
    date,
    description,
    category,
    amount,
    type: forcedType,
  };

  if (shouldTryAdvancedAccountingParse(description, forcedType)) {
    try {
      const parsed = await withTimeout(
        parseTransactionFromChatWithAI(`${description} ₦${amount.toLocaleString("en-NG")}`),
        ACCOUNTING_PARSE_TIMEOUT_MS,
        "Accounting parse timeout"
      );
      if (parsed?.debitAccount?.code && parsed?.creditAccount?.code) {
        rawTx.type = mapParsedTypeToAccountingType(parsed.parsedType);
        rawTx.category = parsed.category || category;
        rawTx.amount = parsed.amount || amount;

        const response = accountingEngine.processTransactionWithAIAccounts(rawTx, {
          debitCode: parsed.debitAccount.code,
          debitName: parsed.debitAccount.name || "Debit",
          creditCode: parsed.creditAccount.code,
          creditName: parsed.creditAccount.name || "Credit",
          confidence: parsed.aiConfidence || parsed.confidence || 0.7,
          reasoning: parsed.aiReasoning || action.reason || "AI-assisted posting",
          parsedType: parsed.parsedType,
          taxImplications: {
            outputVAT: parsed.taxImplications?.outputVAT || 0,
            inputVAT: parsed.taxImplications?.inputVAT || 0,
          },
        });

        window.dispatchEvent(new CustomEvent("accounting-update", { detail: { source: "unified-agent" } }));
        window.dispatchEvent(new StorageEvent("storage", { key: "insight::accounting-engine" }));
        const mirrorPayload = toAccountingUiMirrorPayload(description);
        const mirrorNote = mirrorPayload ? await runAccountingUiMirror(mirrorPayload) : "";
        return {
          type: "accounting.postTransaction",
          success: true,
          message: mirrorNote ? `${response.chatResponse}\n${mirrorNote}` : response.chatResponse,
        };
      }
    } catch (error) {
      console.warn("[Unified Agent] AI accounting parse fallback:", error);
    }
  }

  try {
    const result = accountingEngine.processTransactionEnhanced(rawTx);
    window.dispatchEvent(new CustomEvent("accounting-update", { detail: { source: "unified-agent" } }));
    window.dispatchEvent(new StorageEvent("storage", { key: "insight::accounting-engine" }));
    const mirrorPayload = toAccountingUiMirrorPayload(description);
    const mirrorNote = mirrorPayload ? await runAccountingUiMirror(mirrorPayload) : "";
    return {
      type: "accounting.postTransaction",
      success: true,
      message: mirrorNote ? `${result.chatResponse}\n${mirrorNote}` : result.chatResponse,
    };
  } catch (error) {
    return {
      type: "accounting.postTransaction",
      success: false,
      message: `Unable to post accounting entry: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

function normalizeTaxType(value: unknown, description: string, amount: number, category?: string): TaxTransactionType {
  const candidate = typeof value === "string" ? value.trim() : "";
  const valid: TaxTransactionType[] = [
    "income",
    "expense",
    "sale",
    "purchase",
    "service-payment",
    "rent-payment",
    "dividend",
    "royalty",
    "asset-disposal",
    "contract-payment",
    "bank-transfer",
    "property-sale",
    "share-transfer",
    "other",
  ];
  if (valid.includes(candidate as TaxTransactionType)) {
    return candidate as TaxTransactionType;
  }
  return detectTaxType(description, amount, category).transactionType;
}

function executeTaxPost(action: UnifiedAgentAction): UnifiedActionExecutionResult {
  const payload = action.payload || {};
  const description = toText(payload.description);
  const amount = Math.abs(toNumber(payload.amount));
  if (!description || amount <= 0) {
    return {
      type: "tax.recordTransaction",
      success: false,
      message: "Skipped tax posting because amount or description was missing.",
    };
  }

  const date = toText(payload.date, getTodayDate());
  const category = toText(payload.category, "chat-entry");
  const transactionType = normalizeTaxType(payload.transactionType, description, amount, category);
  const isResident = typeof payload.isResident === "boolean" ? payload.isResident : true;

  try {
    const result = taxEngine.processTransaction({
      date,
      description: description.slice(0, 100),
      amount,
      category,
      type: transactionType,
      isResident,
    });

    window.dispatchEvent(new StorageEvent("storage", { key: "insight::tax-engine" }));
    return {
      type: "tax.recordTransaction",
      success: true,
      message: result.chatResponse,
    };
  } catch (error) {
    return {
      type: "tax.recordTransaction",
      success: false,
      message: `Unable to post tax transaction: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function executeWalletSend(action: UnifiedAgentAction): Promise<UnifiedActionExecutionResult> {
  const payload = action.payload || {};
  const amount = Math.abs(toNumber(payload.amount));
  const recipient = toText(payload.recipient);
  const provider = toText(payload.provider);
  const recipientTypeRaw = toText(payload.recipientType, "phone");
  const recipientType = recipientTypeRaw === "email" || recipientTypeRaw === "account" ? recipientTypeRaw : "phone";

  if (!recipient || amount <= 0) {
    return {
      type: "wallet.sendMoney",
      success: false,
      message: "Skipped wallet transfer because recipient or amount was missing.",
    };
  }

  try {
    const txn = await walletEngine.sendMoney({
      amount,
      recipient,
      provider: provider || undefined,
      type: recipientType,
    });
    window.dispatchEvent(new StorageEvent("storage", { key: "naija-wallet-state" }));
    return {
      type: "wallet.sendMoney",
      success: true,
      message: generateTransferResponse(txn),
      data: txn,
    };
  } catch (error) {
    return {
      type: "wallet.sendMoney",
      success: false,
      message: `Unable to send wallet transfer: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function executeWalletFund(action: UnifiedAgentAction): Promise<UnifiedActionExecutionResult> {
  const payload = action.payload || {};
  const amount = Math.abs(toNumber(payload.amount));
  if (amount <= 0) {
    return {
      type: "wallet.fund",
      success: false,
      message: "Skipped wallet funding because amount was missing.",
    };
  }

  const state = walletEngine.getState();
  const defaultCard = state.cards.find((card) => card.isDefault) || state.cards[0];
  if (!defaultCard) {
    return {
      type: "wallet.fund",
      success: false,
      message: "Cannot fund wallet because no linked card exists yet.",
    };
  }

  try {
    const txn = await walletEngine.fundWallet(amount, defaultCard.id);
    window.dispatchEvent(new StorageEvent("storage", { key: "naija-wallet-state" }));
    return {
      type: "wallet.fund",
      success: true,
      message: generateFundingResponse(txn),
      data: txn,
    };
  } catch (error) {
    return {
      type: "wallet.fund",
      success: false,
      message: `Unable to fund wallet: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

function executeCashflowAnalyze(action: UnifiedAgentAction): UnifiedActionExecutionResult {
  const payload = action.payload || {};
  const focus = toText(payload.focus, "summary").toLowerCase();
  const statements = accountingEngine.generateStatements();
  const cashBalance = statements.assets || 0;
  const monthlyInflow = statements.revenue || 0;
  const monthlyOutflow = (statements.costOfSales || 0) + (statements.operatingExpenses || 0);
  const net = monthlyInflow - monthlyOutflow;
  const burnPerDay = monthlyOutflow / 30;
  const runwayMonths = monthlyOutflow > 0 ? Math.round((cashBalance / monthlyOutflow) * 10) / 10 : 999;

  if (focus === "runway") {
    return {
      type: "cashflow.analyze",
      success: true,
      message: `From your current records, runway is ${
        runwayMonths === 999 ? "healthy and sustainable" : `${runwayMonths} months`
      }. Cash on hand is ${formatWalletNaira(cashBalance)} and monthly burn is about ${formatWalletNaira(monthlyOutflow)}.`,
    };
  }

  if (focus === "burn") {
    return {
      type: "cashflow.analyze",
      success: true,
      message: `Your burn rate is about ${formatWalletNaira(Math.round(burnPerDay))} per day, with monthly outflow around ${formatWalletNaira(
        monthlyOutflow
      )}.`,
    };
  }

  const netDirection = net >= 0 ? "positive" : "negative";
  return {
    type: "cashflow.analyze",
    success: true,
    message: `Quick read: you brought in ${formatWalletNaira(monthlyInflow)} and spent ${formatWalletNaira(
      monthlyOutflow
    )}, so net cashflow is ${netDirection} at ${net >= 0 ? "+" : "-"}${formatWalletNaira(
      Math.abs(net)
    )}. Current cash balance is ${formatWalletNaira(cashBalance)}.`,
  };
}

function executeNavigate(action: UnifiedAgentAction): UnifiedActionExecutionResult {
  const route = toText(action.payload?.route);
  if (!route || !route.startsWith("/")) {
    return {
      type: "navigate",
      success: false,
      message: "Navigation action ignored because route was invalid.",
    };
  }
  return {
    type: "navigate",
    success: true,
    message: `Opening ${route}`,
    navigateTo: route,
  };
}

function normalizeComplianceTaxType(value?: string): string | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (upper.includes("VAT")) return "VAT";
  if (upper.includes("WHT") || upper.includes("WITHHOLD")) return "WHT";
  if (upper.includes("CIT")) return "CIT";
  if (upper.includes("CGT")) return "CGT";
  if (upper.includes("STAMP")) return "STAMP";
  return null;
}

function normalizeTaxTypes(value?: unknown): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value.map((item) => normalizeComplianceTaxType(String(item))).filter((item): item is string => Boolean(item));
  }
  const single = normalizeComplianceTaxType(String(value));
  return single ? [single] : undefined;
}

async function executeTaxRunComputation(action: UnifiedAgentAction): Promise<UnifiedActionExecutionResult> {
  const payload = action.payload || {};
  const entityId = toText(payload.entityId, "entity-default");
  const period = toText(payload.period, "current");
  const taxTypes = normalizeTaxTypes(payload.taxTypes) as ComplianceTaxType[] | undefined;
  const result = await run_tax_computation(entityId, period, taxTypes);
  return {
    type: action.type,
    success: Boolean(result?.success),
    message: result?.message || "Tax computation completed.",
    data: result?.data,
  };
}

async function executeTaxGenerateSchedule(action: UnifiedAgentAction): Promise<UnifiedActionExecutionResult> {
  const payload = action.payload || {};
  const entityId = toText(payload.entityId, "entity-default");
  const period = toText(payload.period);
  const taxType = normalizeComplianceTaxType(toText(payload.taxType));
  if (!period || !taxType) {
    return {
      type: action.type,
      success: false,
      message: "tax_type and period are required to generate a schedule.",
    };
  }
  const result = await generateTaxSchedule(entityId, period, taxType as ComplianceTaxType);
  return {
    type: action.type,
    success: Boolean(result?.success),
    message: result?.message || "Schedule generated.",
    data: result?.data,
  };
}

async function executeTaxListIssues(action: UnifiedAgentAction): Promise<UnifiedActionExecutionResult> {
  const payload = action.payload || {};
  const entityId = toText(payload.entityId, "entity-default");
  const period = toText(payload.period);
  if (!period) {
    return {
      type: action.type,
      success: false,
      message: "period is required to list issues.",
    };
  }
  const result = await listTaxIssues(entityId, period);
  return {
    type: action.type,
    success: Boolean(result?.success),
    message: result?.message || "Issue list ready.",
    data: result?.data,
  };
}

async function executeTaxApplyClassification(action: UnifiedAgentAction): Promise<UnifiedActionExecutionResult> {
  const payload = action.payload || {};
  const entityId = toText(payload.entityId, "entity-default");
  const period = toText(payload.period, undefined);
  const result = await applyTaxClassificationRules(entityId, period);
  return {
    type: action.type,
    success: Boolean(result?.success),
    message: result?.message || "Classification rules applied.",
    data: result?.data,
  };
}

async function executeTaxGenerateFilingPack(action: UnifiedAgentAction): Promise<UnifiedActionExecutionResult> {
  const payload = action.payload || {};
  const entityId = toText(payload.entityId, "entity-default");
  const period = toText(payload.period);
  const taxType = normalizeComplianceTaxType(toText(payload.taxType));
  const format = toText(payload.format, "pdf").toLowerCase() as "pdf" | "csv" | "xlsx";
  if (!period || !taxType) {
    return {
      type: action.type,
      success: false,
      message: "period and tax_type are required to generate a filing pack.",
    };
  }
  const result = await generateTaxFilingPack(entityId, period, taxType as ComplianceTaxType, format);
  return {
    type: action.type,
    success: Boolean(result?.success),
    message: result?.message || "Filing pack generated.",
    data: result?.data,
  };
}

async function executeTaxReconcile(action: UnifiedAgentAction): Promise<UnifiedActionExecutionResult> {
  const payload = action.payload || {};
  const entityId = toText(payload.entityId, "entity-default");
  const period = toText(payload.period);
  const taxType = normalizeComplianceTaxType(toText(payload.taxType));
  if (!period || !taxType) {
    return {
      type: action.type,
      success: false,
      message: "period and tax_type are required to reconcile.",
    };
  }
  const result = await reconcileTaxReport(entityId, period, taxType as ComplianceTaxType);
  return {
    type: action.type,
    success: Boolean(result?.success),
    message: result?.message || "Reconciliation complete.",
    data: result?.data,
  };
}

async function executeReportDownloadPdf(action: UnifiedAgentAction): Promise<UnifiedActionExecutionResult> {
  if (typeof window === "undefined") {
    return {
      type: action.type,
      success: false,
      message: "Report PDF generation is available only in the browser client.",
    };
  }

  const payload = action.payload || {};
  const requestedType = normalizeReportPdfType(payload.reportType, toText(payload.description));
  const businessName = toText(payload.businessName, "CashOS Business");
  const generated = await buildReportPdfBlob(requestedType, businessName, toText(payload.description), payload.year);

  if (!generated) {
    return {
      type: action.type,
      success: false,
      message: "No report data found yet. Record and post transactions first, then try again.",
    };
  }

  const blobUrl = URL.createObjectURL(generated.blob);
  return {
    type: action.type,
    success: true,
    message: `${generated.label} PDF ready for download.`,
    data: {
      download: {
        kind: "download",
        fileName: generated.fileName,
        url: blobUrl,
        mimeType: "application/pdf",
      },
      reportType: requestedType,
      fileName: generated.fileName,
    },
  };
}

export async function executeUnifiedAgentActions(
  actions: UnifiedAgentAction[],
  options?: {
    customActionExecutor?: UnifiedCustomActionExecutor;
    shouldStop?: () => boolean;
    rollbackOnStop?: boolean;
  }
): Promise<UnifiedActionExecutionResult[]> {
  ensureEnginesLoaded();
  const results: UnifiedActionExecutionResult[] = [];
  const executedDedupeKeys = new Set<string>();

  const getExecutionDedupeKey = (action: UnifiedAgentAction): string | null => {
    if (action.type !== "accounting.postTransaction") return null;
    const payload = action.payload || {};
    const description = toText(payload.description).toLowerCase().replace(/\s+/g, " ").trim();
    const amount = Math.round(Math.abs(toNumber(payload.amount)) * 100) / 100;
    const date = toText(payload.date, getTodayDate());
    if (!description || amount <= 0) return null;
    return `${action.type}|${description}|${amount}|${date}`;
  };

  for (const action of actions || []) {
    if (options?.shouldStop?.()) {
      results.push({
        type: action.type,
        success: false,
        message: "Stopped by user before this action could run.",
      });
      break;
    }

    const dedupeKey = getExecutionDedupeKey(action);
    if (dedupeKey) {
      if (executedDedupeKeys.has(dedupeKey)) {
        continue;
      }
      executedDedupeKeys.add(dedupeKey);
    }

    try {
      if (action.type === "accounting.postTransaction") {
        results.push(await executeAccountingPost(action));
      } else if (action.type === "report.downloadPdf") {
        results.push(await executeReportDownloadPdf(action));
      } else if (action.type === "tax.recordTransaction") {
        results.push(executeTaxPost(action));
      } else if (action.type === "tax.runComputation") {
        results.push(await executeTaxRunComputation(action));
      } else if (action.type === "tax.generateSchedule") {
        results.push(await executeTaxGenerateSchedule(action));
      } else if (action.type === "tax.listIssues") {
        results.push(await executeTaxListIssues(action));
      } else if (action.type === "tax.applyClassificationRules") {
        results.push(await executeTaxApplyClassification(action));
      } else if (action.type === "tax.generateFilingPack") {
        results.push(await executeTaxGenerateFilingPack(action));
      } else if (action.type === "tax.reconcile") {
        results.push(await executeTaxReconcile(action));
      } else if (action.type === "wallet.sendMoney") {
        results.push(await executeWalletSend(action));
      } else if (action.type === "wallet.fund") {
        results.push(await executeWalletFund(action));
      } else if (action.type === "cashflow.analyze") {
        results.push(executeCashflowAnalyze(action));
      } else if (action.type === "navigate") {
        results.push(executeNavigate(action));
      } else if (action.type === "ui.operate") {
        results.push(await executeUiOperate(action, { shouldStop: options?.shouldStop, rollbackOnStop: options?.rollbackOnStop }));
      } else if (options?.customActionExecutor) {
        const customResult = await options.customActionExecutor(action);
        if (customResult) {
          results.push(customResult);
        } else {
          results.push({
            type: action.type,
            success: false,
            message: `Action type is not supported in this module: ${action.type}`,
          });
        }
      } else {
        results.push({
          type: action.type,
          success: false,
          message: `Action type is not supported in this module: ${action.type}`,
        });
      }
    } catch (error) {
      results.push({
        type: action.type,
        success: false,
        message: `Action failed (${action.type}): ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    if (options?.shouldStop?.()) {
      break;
    }
  }

  return results;
}

export async function requestUnifiedAgentPlan(
  request: UnifiedAgentRequest
): Promise<UnifiedAgentResponse> {
  const localFallbackPlan = buildLocalFallbackPlan(request);
  const serviceErrorPlan: UnifiedAgentResponse = {
    ...localFallbackPlan,
    reasoning: localFallbackPlan.reasoning || "No planner response available",
    planSource: "fallback",
  };
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), PLAN_TIMEOUT_MS);
  const buildChatApiFallback = async (reason: string): Promise<UnifiedAgentResponse> => {
    if (Array.isArray(localFallbackPlan.actions) && localFallbackPlan.actions.length > 0) {
      return {
        ...localFallbackPlan,
        reasoning: `${localFallbackPlan.reasoning} | Local deterministic fallback used (${reason}).`,
        planSource: "fallback",
      };
    }

    try {
      const transcript = Array.isArray(request.conversation)
        ? request.conversation.slice(-10)
        : [];
      const messages = [
        ...transcript.map((item) => ({
          role: item.role,
          content: item.content,
        })),
      ];

      if (!messages.length || messages[messages.length - 1]?.content !== request.message) {
        messages.push({ role: "user", content: request.message });
      }

      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: request.module,
          messages,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { answer?: string; finalAnswer?: string };
        const reply =
          (typeof data.finalAnswer === "string" && data.finalAnswer.trim()) ||
          (typeof data.answer === "string" && data.answer.trim());
        if (reply) {
          return {
            reply,
            actions: localFallbackPlan.actions || [],
            confidence:
              typeof localFallbackPlan.confidence === "number" && Number.isFinite(localFallbackPlan.confidence)
                ? localFallbackPlan.confidence
                : 0.42,
            reasoning: `${localFallbackPlan.reasoning} | Fallback via /api/agent. ${reason}`,
            planSource: "fallback",
          };
        }
      }
    } catch {
      // Ignore and return serviceErrorPlan below.
    }

    return {
      ...localFallbackPlan,
      reasoning: `${localFallbackPlan.reasoning} | ${reason}`,
      planSource: "fallback",
    };
  };

  try {
    const response = await fetch("/api/agent/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      return buildChatApiFallback(`Endpoint status ${response.status}`);
    }

    const data = (await response.json()) as UnifiedAgentResponse;
    const remoteActions = Array.isArray(data.actions) ? data.actions : [];
    const localActions = Array.isArray(localFallbackPlan.actions) ? localFallbackPlan.actions : [];
    const hasLocalReportDownload = localActions.some((action) => action.type === "report.downloadPdf");
    const remoteOnlyUiOrNavigation =
      remoteActions.length > 0 &&
      remoteActions.every((action) => action.type === "navigate" || action.type === "ui.operate");
    const hasLocalNonUiExecution = localActions.some((action) => action.type !== "navigate" && action.type !== "ui.operate");
    const shouldPromoteLocalActions =
      localActions.length > 0 &&
      hasLocalNonUiExecution &&
      (remoteActions.length === 0 || remoteOnlyUiOrNavigation) &&
      (isExplicitActionIntent(request.message) ||
        hasLocalReportDownload ||
        /\b(post|record|paid|pay|sold|received|buy|purchase|expense|rent|salary|generate|download|print|export|run|compute|calculate)\b/i.test(
          request.message
        ));
    const actions = shouldPromoteLocalActions ? localActions : remoteActions;
    const promotedReply =
      shouldPromoteLocalActions &&
      typeof localFallbackPlan.reply === "string" &&
      localFallbackPlan.reply.trim()
        ? localFallbackPlan.reply.trim()
        : undefined;

    return {
      reply:
        promotedReply ||
        (typeof data.reply === "string" && data.reply.trim() ? data.reply.trim() : serviceErrorPlan.reply),
      actions,
      confidence:
        typeof data.confidence === "number" && Number.isFinite(data.confidence)
          ? Math.max(0, Math.min(1, data.confidence))
          : serviceErrorPlan.confidence,
      reasoning:
        shouldPromoteLocalActions
          ? `${typeof data.reasoning === "string" ? data.reasoning : serviceErrorPlan.reasoning} | Promoted local deterministic actions to avoid reply-only plan.`
          : typeof data.reasoning === "string"
            ? data.reasoning
            : serviceErrorPlan.reasoning,
      planSource:
        shouldPromoteLocalActions
          ? "fallback"
          : data.planSource === "gemini" || data.planSource === "fallback"
          ? data.planSource
          : "fallback",
    };
  } catch (error) {
    console.warn("[Unified Agent] Planner request failed:", error);
    return buildChatApiFallback(error instanceof Error ? error.message : "Planner unavailable");
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function buildFinalReplyFromExecution(planReply: string, execution: UnifiedActionExecutionResult[]): string {
  const normalizeSpaces = (value: string) => value.replace(/\s+/g, " ").trim();
  const soften = (value: string): string => {
    let next = normalizeSpaces(value);
    next = next.replace(/^i am a quantum ledger execution agent\.?\s*/i, "");
    next = next.replace(/^i(?:'|’)m designed to help you[^.]*\.\s*/i, "");
    next = next.replace(/^i can help you with accounting, tax, and wallet operations\.?\s*/i, "");
    next = next.replace(/^what would you like to do\??\s*/i, "");
    next = next.replace(/\bwould you like me to\b/gi, "if you want, I can");
    return next.trim();
  };
  const isBoilerplate = (value: string): boolean => {
    const lower = value.toLowerCase();
    return (
      lower.startsWith("i can help you") ||
      lower.startsWith("i am a quantum ledger execution agent") ||
      lower.includes("what would you like to do") ||
      lower.includes("how can i help you")
    );
  };

  const cleanedPlanReply = soften(planReply);
  const successes = execution
    .filter((result) => result.success && result.message && result.type !== "navigate")
    .map((result) => soften(result.message))
    .filter(Boolean);

  const failures = execution
    .filter((result) => !result.success && result.message && result.type !== "navigate")
    .map((result) => soften(result.message))
    .filter(Boolean);

  if (successes.length === 0 && failures.length === 0) {
    return cleanedPlanReply || "Sure, tell me what you want to do next.";
  }

  if (failures.length === 0) {
    if (!cleanedPlanReply || isBoilerplate(cleanedPlanReply) || cleanedPlanReply.endsWith("?")) {
      return successes.join("\n\n");
    }
    return `${cleanedPlanReply}\n\n${successes.join("\n\n")}`;
  }

  if (successes.length === 0) {
    const prefix = cleanedPlanReply && !isBoilerplate(cleanedPlanReply) ? `${cleanedPlanReply}\n\n` : "";
    return `${prefix}I could not complete everything yet.\n${failures.map((msg) => `- ${msg}`).join("\n")}`;
  }

  const prefix = cleanedPlanReply && !isBoilerplate(cleanedPlanReply) ? `${cleanedPlanReply}\n\n` : "";
  return `${prefix}Completed:\n${successes.map((msg) => `- ${msg}`).join("\n")}\n\nStill pending:\n${failures
    .map((msg) => `- ${msg}`)
    .join("\n")}`;
}

function normalizePlanSource(source?: string): AgentPlanSource {
  return source === "fast-path" || source === "gemini" || source === "fallback" ? source : "fallback";
}

function buildObservation(execution: UnifiedActionExecutionResult[], navigateTo?: string): string {
  if (execution.length === 0) {
    return "No tool action executed in this step.";
  }

  const actionNotes = execution.map((result) => {
    const status = result.success ? "success" : "failure";
    const note = result.message.replace(/\s+/g, " ").trim().slice(0, 220);
    return `${result.type}: ${status} - ${note}`;
  });

  if (navigateTo) {
    actionNotes.push(`navigate: success - route ${navigateTo}`);
  }

  return actionNotes.join(" | ");
}

function actionSignature(actions: UnifiedAgentAction[]): string {
  return JSON.stringify(
    actions.map((action) => ({
      type: action.type,
      payload: action.payload,
    }))
  );
}

export async function runUnifiedAgentMessage(params: {
  message: string;
  module?: string;
  route?: string;
  conversation?: AgentConversationMessage[];
  enableUiOperator?: boolean;
  executionMode?: "interactive" | "background";
  contextSnapshot?: string;
  customActionExecutor?: UnifiedCustomActionExecutor;
  shouldStop?: () => boolean;
  rollbackOnStop?: boolean;
  autoApproveUiActions?: boolean;
  onExecutionStart?: () => void;
}): Promise<{
  finalReply: string;
  baseReply: string;
  actions: UnifiedAgentAction[];
  execution: UnifiedActionExecutionResult[];
  navigateTo?: string;
  planSource: AgentPlanSource;
}> {
  const trimmedMessage = params.message.trim();
  const moduleId = normalizeModuleId(params.module);
  const objective = trimmedMessage;
  const snapshot = typeof params.contextSnapshot === "string" ? params.contextSnapshot : "";
  const executionMode = params.executionMode === "background" ? "background" : "interactive";
  const shouldStop = () => Boolean(params.shouldStop?.());
  let executionStartNotified = false;
  const notifyExecutionStart = () => {
    if (executionStartNotified) return;
    executionStartNotified = true;
    try {
      params.onExecutionStart?.();
    } catch {
      // Ignore UI callback failures to keep agent execution deterministic.
    }
  };

  if (executionMode === "background" && pendingUiApproval) {
    pendingUiApproval = null;
  }

  if (executionMode === "interactive" && pendingUiApproval && isCancelMessage(trimmedMessage)) {
    pendingUiApproval = null;
    return {
      finalReply: "Cancelled. I did not run the pending on-screen action.",
      baseReply: "Cancelled.",
      actions: [],
      execution: [],
      navigateTo: undefined,
      planSource: "fallback",
    };
  }

  if (executionMode === "interactive" && pendingUiApproval && isConfirmMessage(trimmedMessage)) {
    const approval = pendingUiApproval;
    pendingUiApproval = null;
    if (approval.actions.length > 0) notifyExecutionStart();
    const execution = await executeUnifiedAgentActions(approval.actions, {
      customActionExecutor: params.customActionExecutor,
      shouldStop: params.shouldStop,
      rollbackOnStop: params.rollbackOnStop,
    });
    const navigateTo = execution.find((result) => result.navigateTo)?.navigateTo;
    const observation = buildObservation(execution, navigateTo);
    appendAgentMemory(moduleId, {
      timestamp: Date.now(),
      module: moduleId,
      objective,
      actionTypes: approval.actions.map((action) => action.type),
      observation,
      success: execution.every((result) => result.success),
    });
    return {
      finalReply: buildFinalReplyFromExecution("Executing the confirmed on-screen action now.", execution),
      baseReply: "Executing the confirmed on-screen action now.",
      actions: approval.actions,
      execution,
      navigateTo,
      planSource: approval.planSource,
    };
  }

  if (executionMode === "interactive" && !pendingUiApproval && isConfirmMessage(trimmedMessage)) {
    const pendingInstruction = extractPendingInstructionFromConversation(params.conversation, trimmedMessage);
    if (pendingInstruction) {
      const inferredPlan = buildLocalFallbackPlan({
        message: pendingInstruction,
        module: params.module,
        route: params.route,
        contextSnapshot: params.contextSnapshot,
      });
      if (Array.isArray(inferredPlan.actions) && inferredPlan.actions.length > 0) {
        notifyExecutionStart();
        const execution = await executeUnifiedAgentActions(inferredPlan.actions, {
          customActionExecutor: params.customActionExecutor,
          shouldStop: params.shouldStop,
          rollbackOnStop: params.rollbackOnStop,
        });
        const navigateTo = execution.find((result) => result.navigateTo)?.navigateTo;
        const observation = buildObservation(execution, navigateTo);
        appendAgentMemory(moduleId, {
          timestamp: Date.now(),
          module: moduleId,
          objective,
          actionTypes: inferredPlan.actions.map((action) => action.type),
          observation,
          success: execution.every((result) => result.success),
        });
        return {
          finalReply: buildFinalReplyFromExecution("Confirmed. Executing the pending request now.", execution),
          baseReply: "Confirmed. Executing the pending request now.",
          actions: inferredPlan.actions,
          execution,
          navigateTo,
          planSource: "fallback",
        };
      }
    }
  }

  if (
    moduleId === "projections" &&
    snapshot.trim() &&
    (looksLikeProjectionSnapshotQuestion(trimmedMessage) || looksLikeFigureGroundingRequest(trimmedMessage)) &&
    !looksLikeProjectionAssumptionChange(trimmedMessage)
  ) {
    const reply = buildProjectionSnapshotReply(snapshot);
    return {
      finalReply: reply,
      baseReply: reply,
      actions: [],
      execution: [],
      navigateTo: undefined,
      planSource: "fallback",
    };
  }

  const uiSnapshot = params.enableUiOperator === false ? "" : captureUiSnapshot();
  const workingConversation: AgentConversationMessage[] = Array.isArray(params.conversation)
    ? params.conversation.slice(-12).map((message) => ({ role: message.role, content: message.content }))
    : [];
  if (!workingConversation.length || workingConversation[workingConversation.length - 1]?.content !== trimmedMessage) {
    workingConversation.push({ role: "user", content: trimmedMessage });
  }

  let latestReply = "";
  let latestPlanSource: AgentPlanSource = "fallback";
  let latestNavigateTo: string | undefined;
  const aggregateActions: UnifiedAgentAction[] = [];
  const aggregateExecution: UnifiedActionExecutionResult[] = [];
  const seenSignatures = new Set<string>();

  for (let cycle = 0; cycle < AGENT_LOOP_MAX_CYCLES; cycle += 1) {
    if (shouldStop()) {
      latestReply = latestReply || "Stopped by user.";
      pendingUiApproval = null;
      break;
    }

    const loopPrompt = trimmedMessage;

    const plan = await requestUnifiedAgentPlan({
      message: loopPrompt,
      module: params.module,
      route: params.route,
      conversation: workingConversation.slice(-12),
      uiSnapshot,
      contextSnapshot: params.contextSnapshot,
      objective,
      memorySnapshot: summarizeAgentMemory(moduleId),
    });

    latestReply = plan.reply;
    latestPlanSource = normalizePlanSource(plan.planSource);

    if (!Array.isArray(plan.actions) || plan.actions.length === 0) {
      pendingUiApproval = null;
      break;
    }

    const modeFilteredActions =
      executionMode === "background"
        ? plan.actions.filter((action) => action.type !== "ui.operate" && action.type !== "navigate")
        : plan.actions;
    const hasAccountingPost = modeFilteredActions.some(
      (action) => action.type === "accounting.postTransaction"
    );
    const normalizedActions = hasAccountingPost
      ? modeFilteredActions.filter((action) => action.type !== "tax.recordTransaction")
      : modeFilteredActions;
    const skippedForBackground = plan.actions.length - modeFilteredActions.length;
    if (normalizedActions.length === 0) {
      pendingUiApproval = null;
      if (executionMode === "background" && skippedForBackground > 0) {
        latestReply = `${latestReply}\n\nThis request needs on-screen steps. Switch to Agentic mode to run it live in the interface.`;
      }
      break;
    }

    const signature = actionSignature(normalizedActions);
    if (seenSignatures.has(signature)) {
      latestReply = `${latestReply}\n\nI reached the same step again, so I’m stopping here to avoid looping.`;
      pendingUiApproval = null;
      break;
    }
    seenSignatures.add(signature);

    const uiActions = normalizedActions.filter((action) => action.type === "ui.operate");
    const nonUiActions = normalizedActions.filter((action) => action.type !== "ui.operate");
    const requiresUiApproval = params.autoApproveUiActions ? false : uiActions.some(uiActionNeedsConfirmation);
    const actionsToExecute = requiresUiApproval ? nonUiActions : normalizedActions;

    aggregateActions.push(...actionsToExecute);

    if (actionsToExecute.length > 0) notifyExecutionStart();
    const execution = await executeUnifiedAgentActions(actionsToExecute, {
      customActionExecutor: params.customActionExecutor,
      shouldStop: params.shouldStop,
      rollbackOnStop: params.rollbackOnStop,
    });
    aggregateExecution.push(...execution);
    latestNavigateTo = execution.find((result) => result.navigateTo)?.navigateTo || latestNavigateTo;

    const observation = buildObservation(execution, latestNavigateTo);
    appendAgentMemory(moduleId, {
      timestamp: Date.now(),
      module: moduleId,
      objective,
      actionTypes: actionsToExecute.map((action) => action.type),
      observation,
      success: execution.every((result) => result.success),
    });

    workingConversation.push({ role: "assistant", content: `${plan.reply}\nObservation: ${observation}` });

    if (requiresUiApproval && uiActions.length > 0) {
      pendingUiApproval = { actions: uiActions, planSource: latestPlanSource };
      latestReply = `${latestReply}\n\nI found an on-screen action that may be sensitive. Reply "confirm" to run it, or "cancel" to skip it.`;
      break;
    }

    pendingUiApproval = null;

    const hasFailure = execution.some((result) => !result.success);
    if (shouldStop()) {
      latestReply = `${latestReply}\n\nAgent run stopped by user. Reversible UI changes were rolled back where possible.`;
      break;
    }

    if (hasFailure) {
      latestReply = `${latestReply}\n\nI stopped after a failed step. You can adjust the instruction and I’ll continue.`;
      break;
    }

    const hasEffectfulSuccess = execution.some((result) => result.success && EFFECTFUL_ACTION_TYPES.has(result.type));
    if (hasEffectfulSuccess) {
      break;
    }
  }

  const hasEffectfulSuccess = aggregateExecution.some(
    (result) => result.success && EFFECTFUL_ACTION_TYPES.has(result.type)
  );
  const requestedExecution =
    isExplicitActionIntent(trimmedMessage) ||
    isReportActionIntent(trimmedMessage, moduleId);

  let finalReply = buildFinalReplyFromExecution(latestReply || "Done.", aggregateExecution);
  if (requestedExecution && !hasEffectfulSuccess) {
    const noChangePrefix = "No changes were applied in your data.";
    if (!finalReply.toLowerCase().includes("no changes were applied")) {
      finalReply = `${noChangePrefix}\n\n${finalReply}`;
    }
  }

  return {
    finalReply,
    baseReply: latestReply || "Done.",
    actions: aggregateActions,
    execution: aggregateExecution,
    navigateTo: latestNavigateTo,
    planSource: latestPlanSource,
  };
}
