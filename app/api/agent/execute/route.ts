import { NextRequest, NextResponse } from "next/server";
import { buildContextSnippet, retrieveKnowledge } from "@/lib/agent/rag";
import type {
  AgentConversationMessage,
  UnifiedAgentAction,
  UnifiedAgentRequest,
  UnifiedAgentResponse,
} from "@/lib/agent/unifiedTypes";

const DEFAULT_GEMINI_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];

const ALLOWED_ACTION_TYPES = new Set<UnifiedAgentAction["type"]>([
  "accounting.postTransaction",
  "tax.recordTransaction",
  "wallet.sendMoney",
  "wallet.fund",
  "cashflow.analyze",
  "navigate",
  "ui.operate",
  "projections.updateAssumption",
  "projections.resetAssumptions",
]);

const MAX_MODEL_CANDIDATES = 2;
const DEFAULT_PLANNER_TIMEOUT_MS = 7000;
const MAX_CONVERSATION_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 240;
const FAST_PATH_CONFIDENCE_THRESHOLD = 0.64;
const MAX_UI_SNAPSHOT_CHARS = 2200;
const MAX_CONTEXT_SNAPSHOT_CHARS = 2600;
const MAX_MEMORY_SNAPSHOT_CHARS = 1800;
const MAX_OBJECTIVE_CHARS = 260;

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

function resolveGeminiApiKey(): string {
  const keys = [
    process.env.GOOGLE_GEMINI_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY,
    process.env.NEXT_PUBLIC_GEMINI_API_KEY,
  ];

  for (const key of keys) {
    const value = (key || "").trim();
    if (value && value !== "your_api_key_here") return value;
  }

  return "";
}

function resolveGeminiModels(): string[] {
  const preferred = (process.env.GOOGLE_GEMINI_MODEL || process.env.GEMINI_MODEL || "").trim();
  const models = preferred ? [preferred, ...DEFAULT_GEMINI_MODELS] : DEFAULT_GEMINI_MODELS;
  return Array.from(new Set(models)).slice(0, MAX_MODEL_CANDIDATES);
}

function resolvePlannerTimeoutMs(): number {
  const raw = Number(process.env.AGENT_MODEL_TIMEOUT_MS || process.env.GEMINI_PLANNER_TIMEOUT_MS || "");
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_PLANNER_TIMEOUT_MS;
  return Math.max(3000, Math.min(20000, Math.round(raw)));
}

function truncateText(text: string, maxChars = MAX_MESSAGE_CHARS): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}...`;
}

function moduleExamples(moduleId: string): string {
  switch (moduleId) {
    case "wallet":
      return `Try: "send ₦5,000 to 08031234567" or "fund wallet ₦10,000".`;
    case "tax":
      return `Try: "record VAT sale ₦250,000 for consulting".`;
    case "accounting":
      return `Try: "post rent expense ₦750,000 for Abuja office".`;
    case "cashflow":
      return `Try: "show runway" or "analyze burn rate".`;
    case "personal":
      return `Try: "track grocery spend ₦25,000" or "summarize my cashflow".`;
    case "projections":
      return `Try: "set revenue growth assumption to 12%" or "reset assumptions to auto".`;
    default:
      return `Try: "post sale ₦120,000", "send ₦8,000 to John", or "show cashflow summary".`;
  }
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
      reason: "Detected projection assumptions reset instruction",
      confidence: 0.72,
    };
  }

  const updateIntent = /(set|update|change|adjust|input|apply).*(assumption|growth|ratio|baseline|cogs|marketing|collection|disbursement)/.test(
    lower
  );
  if (!updateIntent) return null;

  const assumption = findProjectionAssumption(message);
  const value = extractSignedNumber(message);
  if (!assumption || value === null) return null;
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
    reason: "Detected projection assumption update instruction",
    confidence: 0.69,
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
      reason: "Detected UI typing instruction",
      confidence: 0.66,
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
      reason: "Detected UI selection instruction",
      confidence: 0.65,
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
      reason: "Detected UI click/navigation instruction",
      confidence: 0.64,
    };
  }

  return null;
}

function buildFallbackPlan(input: UnifiedAgentRequest): UnifiedAgentResponse {
  const message = (input.message || "").trim();
  const lower = message.toLowerCase();
  const moduleId = (input.module || "general").toLowerCase();
  const contextSnapshot = typeof input.contextSnapshot === "string" ? input.contextSnapshot : "";
  const amount = extractAmount(message);
  const actions: UnifiedAgentAction[] = [];

  const greetingIntent =
    /\b(hi|hello|hey|yo|good morning|good afternoon|good evening)\b/.test(lower);
  const thanksIntent = /\b(thanks|thank you|appreciate)\b/.test(lower);
  const helpIntent = /\b(help|assist|what can you do|how do i|guide me)\b/.test(lower);
  const questionIntent =
    /\?$/.test(message) || /\b(what|why|how|when|where|who|can you|could you|should i|explain|tell me)\b/.test(lower);
  const uiIntent =
    /\b(click|tap|press|open|go to|select|choose|type|enter|fill|check|tick|toggle)\b/.test(lower);
  const walletIntent = /\b(send|transfer|pay|fund|top up|wallet)\b/.test(lower);
  const transactionIntent =
    /\b(sold|sale|invoice|received|receipt|paid|rent|salary|buy|bought|purchase|expense|transaction|journal|post)\b/.test(
      lower
    );
  const taxIntent = /\b(vat|wht|cgt|tax|firs|stamp|withholding)\b/.test(lower);
  const cashflowIntent = /\b(cashflow|cash flow|runway|burn)\b/.test(lower);
  const projectionAdjustmentVerb = /(set|update|change|adjust|input|apply|reset|clear)/.test(lower);
  const projectionAssumptionIntent =
    projectionAdjustmentVerb && /(assumption|growth|cogs|baseline|collection|disbursement|marketing|opex|expense)/.test(lower);

  const projectionAction = buildProjectionFallbackAction(message, moduleId);
  if (projectionAction) {
    actions.push(projectionAction);
  }

  if (uiIntent && !walletIntent && !transactionIntent && !taxIntent && !cashflowIntent) {
    const uiAction = buildUiFallbackAction(message);
    if (uiAction) {
      actions.push(uiAction);
    }
  }

  if (thanksIntent && !walletIntent && !transactionIntent && !taxIntent && !cashflowIntent) {
    return {
      reply: "You are welcome. Send the next instruction whenever you're ready.",
      actions: [],
      confidence: 0.85,
      reasoning: "Small-talk acknowledgement fast-path.",
    };
  }

  if (greetingIntent && !walletIntent && !transactionIntent && !taxIntent && !cashflowIntent) {
    return {
      reply: `Hi, I’m here. We can chat normally, and I can also execute tasks when you want. ${moduleExamples(moduleId)}`,
      actions: [],
      confidence: 0.86,
      reasoning: "Greeting fast-path.",
    };
  }

  if (helpIntent && !walletIntent && !transactionIntent && !taxIntent && !cashflowIntent) {
    return {
      reply: `I can execute transactions, tax postings, wallet transfers, and cashflow analysis. ${moduleExamples(moduleId)}`,
      actions: [],
      confidence: 0.82,
      reasoning: "Help request fast-path.",
    };
  }

  if (walletIntent && amount) {
    const recipient = detectRecipient(message);
    if (/fund|top up/.test(lower)) {
      actions.push({
        type: "wallet.fund",
        payload: { amount },
        reason: "Detected wallet funding instruction",
        confidence: 0.68,
      });
    } else if (recipient) {
      actions.push({
        type: "wallet.sendMoney",
        payload: { amount, recipient },
        reason: "Detected wallet transfer instruction",
        confidence: 0.7,
      });
    }
  }

  if (transactionIntent && amount && actions.length === 0) {
    actions.push({
      type: "accounting.postTransaction",
      payload: {
        description: message,
        amount,
      },
      reason: "Detected accounting transaction entry",
      confidence: 0.66,
    });

    if (taxIntent || moduleId === "tax") {
      actions.push({
        type: "tax.recordTransaction",
        payload: {
          description: message,
          amount,
        },
        reason: "Detected tax-relevant transaction",
        confidence: 0.62,
      });
    }
  } else if ((taxIntent || moduleId === "tax") && amount) {
    actions.push({
      type: "tax.recordTransaction",
      payload: {
        description: message,
        amount,
      },
      reason: "Detected tax transaction intent",
      confidence: 0.63,
    });
  }

  if (cashflowIntent) {
    actions.push({
      type: "cashflow.analyze",
      payload: {
        focus: lower.includes("runway") ? "runway" : lower.includes("burn") ? "burn" : "summary",
      },
      reason: "Detected cashflow analytics request",
      confidence: 0.64,
    });
  }

  if (actions.length === 0) {
    if (walletIntent && !amount) {
      return {
        reply: "I can do that. Share the amount and recipient in one line, for example: send ₦5,000 to 08031234567.",
        actions: [],
        confidence: 0.6,
        reasoning: "Wallet intent missing amount.",
      };
    }

    if (walletIntent && amount && !detectRecipient(message) && !/fund|top up/.test(lower)) {
      return {
        reply: "I got the amount. Who should receive it? Add phone, email, or account identifier.",
        actions: [],
        confidence: 0.62,
        reasoning: "Wallet intent missing recipient.",
      };
    }

    if (moduleId === "projections" && looksLikeProjectionQualityQuestion(message)) {
      return {
        reply: buildProjectionHealthReply(contextSnapshot),
        actions: [],
        confidence: 0.63,
        reasoning: "Projection quality question answered from context snapshot.",
      };
    }

    if (moduleId === "projections" && projectionAssumptionIntent) {
      return {
        reply:
          "I can update projection assumptions directly. Tell me the exact field and value, for example: set revenue growth assumption to 12%.",
        actions: [],
        confidence: 0.6,
        reasoning: "Projection assumption intent missing precise field or numeric value.",
      };
    }

    if ((transactionIntent || moduleId === "accounting") && !amount) {
      return {
        reply: "I can post this entry. Add the amount so I can execute it correctly.",
        actions: [],
        confidence: 0.58,
        reasoning: "Accounting intent missing amount.",
      };
    }

    if ((taxIntent || moduleId === "tax") && !amount) {
      return {
        reply: "I can record this for tax, but I still need the transaction amount.",
        actions: [],
        confidence: 0.58,
        reasoning: "Tax intent missing amount.",
      };
    }

    if (uiIntent) {
      return {
        reply: "I can operate this on-screen. Tell me the exact button, field, or menu you want me to use.",
        actions: [],
        confidence: 0.56,
        reasoning: "UI intent detected but target/action was unclear.",
      };
    }

    if (questionIntent) {
      return {
        reply: buildNaturalChatFallback(message, moduleId),
        actions: [],
        confidence: 0.57,
        reasoning: "General conversational question without executable payload; provided natural response.",
      };
    }

    return {
      reply: `I can chat through this with you, or execute it directly once you share key details like amount or recipient. ${moduleExamples(moduleId)}`,
      actions: [],
      confidence: 0.45,
      reasoning: "Fallback planner could not confidently map request to executable tools.",
    };
  }

  const primaryAction = actions[0]?.type;
  const executionReply =
    primaryAction === "wallet.sendMoney"
      ? "Understood. I’ll run that transfer now and confirm what happened."
      : primaryAction === "wallet.fund"
        ? "Understood. I’ll fund the wallet now and confirm the result."
        : primaryAction === "tax.recordTransaction"
          ? "Understood. I’ll record this tax-related transaction now."
          : primaryAction === "cashflow.analyze"
            ? "Understood. I’ll run the cashflow analysis now."
            : primaryAction === "ui.operate"
              ? "Understood. I’ll perform that directly in the interface now."
              : primaryAction === "projections.updateAssumption"
                ? "Understood. I’ll update the projection assumptions now."
                : primaryAction === "projections.resetAssumptions"
                  ? "Understood. I’ll reset the projection assumptions back to auto."
              : "Understood. I’ll post this transaction now and confirm the outcome.";

  return {
    reply: executionReply,
    actions: actions.slice(0, 4),
    confidence: Math.max(...actions.map((a) => a.confidence || 0.6)),
    reasoning: "Generated by fallback intent planner.",
  };
}

function isFastPathPlan(message: string, plan: UnifiedAgentResponse): boolean {
  const executable = plan.actions.length > 0 && (plan.confidence || 0) >= FAST_PATH_CONFIDENCE_THRESHOLD;
  return executable;
}

function safeJsonParse(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model response.");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function normalizeAction(action: unknown): UnifiedAgentAction | null {
  if (!action || typeof action !== "object") return null;
  const candidate = action as Partial<UnifiedAgentAction>;
  if (typeof candidate.type !== "string" || !ALLOWED_ACTION_TYPES.has(candidate.type as UnifiedAgentAction["type"])) {
    return null;
  }
  const payload = candidate.payload && typeof candidate.payload === "object" ? candidate.payload : {};
  const normalized: UnifiedAgentAction = {
    type: candidate.type as UnifiedAgentAction["type"],
    payload: payload as Record<string, unknown>,
  };
  if (typeof candidate.reason === "string") normalized.reason = candidate.reason.trim();
  if (typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)) {
    normalized.confidence = Math.min(1, Math.max(0, candidate.confidence));
  }
  return normalized;
}

function normalizePlan(raw: unknown, fallback: UnifiedAgentResponse): UnifiedAgentResponse {
  if (!raw || typeof raw !== "object") return fallback;
  const plan = raw as Partial<UnifiedAgentResponse>;
  const reply =
    typeof plan.reply === "string" && plan.reply.trim()
      ? plan.reply.trim()
      : fallback.reply;
  const actions = Array.isArray(plan.actions)
    ? plan.actions.map(normalizeAction).filter((item): item is UnifiedAgentAction => Boolean(item)).slice(0, 4)
    : fallback.actions;
  const confidence =
    typeof plan.confidence === "number" && Number.isFinite(plan.confidence)
      ? Math.min(1, Math.max(0, plan.confidence))
      : fallback.confidence;
  const reasoning = typeof plan.reasoning === "string" ? plan.reasoning.trim() : fallback.reasoning;
  return { reply, actions, confidence, reasoning, planSource: fallback.planSource };
}

function isCapabilityBlurb(reply: string): boolean {
  const lower = reply.toLowerCase();
  if (!lower) return false;
  return (
    lower.includes("i am a quantum ledger execution agent") ||
    lower.includes("i can help you with accounting") ||
    lower.includes("what would you like to do") ||
    lower.includes("how can i help you")
  );
}

function buildNaturalChatFallback(message: string, moduleId: string): string {
  const lower = message.toLowerCase();

  if (/\bwhat do you think\b/.test(lower) && /\bsoftware|app|platform|product\b/.test(lower)) {
    return "It is strong on workflow coverage and execution across modules. The next big win is polishing conversational tone and context continuity so every reply feels natural and personal.";
  }

  if (/\bprofitable|profitability|am i profitable\b/.test(lower)) {
    return "Great direction. We can absolutely brainstorm profitability from your records. I can start with a quick read of inflow, outflow, and net trend, then suggest practical margin improvements.";
  }

  if (/\bdashboard|records|performance|how am i doing\b/.test(lower)) {
    return "Sure, let us read your current numbers together. I can summarize what is healthy, what is risky, and what to improve first.";
  }

  if (moduleId === "accounting") {
    return "Sure, let us work through it together. I can explain the logic in plain language, and execute any entry when you are ready.";
  }

  if (moduleId === "tax") {
    return "Sure, let us break it down clearly. I will keep it practical, and I can post the relevant tax entries once you confirm details.";
  }

  if (moduleId === "wallet") {
    return "Sure, we can chat through it naturally. If you want, I can execute transfers or wallet actions right from this conversation.";
  }

  if (moduleId === "projections") {
    if (/\b(projection|forecast|runway|margin|cash|profit)\b/.test(lower)) {
      return "Yes, let’s review it properly. I can read your projection metrics, explain what looks strong or risky, and then tune assumptions with you.";
    }
    return "Sure, we can walk through your projections naturally. I can also update assumptions for you directly when you ask.";
  }

  return "Sure, that is a good question. We can talk it through step by step, and I can execute actions whenever you want.";
}

function postProcessPlan(message: string, moduleId: string, plan: UnifiedAgentResponse): UnifiedAgentResponse {
  if (plan.actions.length === 0 && isCapabilityBlurb(plan.reply)) {
    return {
      ...plan,
      reply: buildNaturalChatFallback(message, moduleId),
    };
  }
  return plan;
}

function buildSystemPrompt(): string {
  return `You are Quantum Ledger's execution agent.

You must produce JSON only, with no markdown and no extra text.

Available tool actions:
1) accounting.postTransaction
payload fields:
- description (string, required)
- amount (number, required, > 0)
- date (YYYY-MM-DD, optional)
- category (string, optional)
- transactionType (income|expense|asset|liability|equity|other, optional)

2) tax.recordTransaction
payload fields:
- description (string, required)
- amount (number, required, > 0)
- date (YYYY-MM-DD, optional)
- category (string, optional)
- transactionType (optional)
- isResident (boolean, optional)

3) wallet.sendMoney
payload fields:
- amount (number, required, > 0)
- recipient (string, required)
- provider (string, optional)
- recipientType (phone|email|account, optional)

4) wallet.fund
payload fields:
- amount (number, required, > 0)

5) cashflow.analyze
payload fields:
- focus (runway|burn|summary, optional)

6) navigate
payload fields:
- route (string starting with /, required)

7) ui.operate
payload fields:
- steps (array, required)
Each step supports:
- action: click | type | select | check | focus
- target: { selector?: string, text?: string, placeholder?: string, label?: string, role?: string, exact?: boolean, index?: number }
- value: string (required for type/select)

8) projections.updateAssumption
payload fields:
- updates (array, required)
Each update item:
- key (revenueGrowthRate | operatingExpenseGrowthRate | fixedCostInflationRate | cogsRatio | variableCostRatio | marketingSpendRatio | cashCollectionRatio | cashDisbursementRatio | fixedCostBaseline)
- value (number, required)
- unit (percent|decimal|ratio|currency, optional)

9) projections.resetAssumptions
payload fields:
- none required

Rules:
- Add actions only when confidence is high enough to execute safely.
- Use at most 4 actions.
- If details are missing, return no actions and ask a concise clarification in reply.
- Keep reply human and practical, one short paragraph.
- For complex transactions, prefer accounting.postTransaction with the full user description and amount.
- This assistant is hybrid: if the user is conversing, asking for advice, brainstorming, or asking general questions, return a natural helpful reply with actions: [].
- Do not force a transactional clarification if the user is clearly in conversational mode.
- Speak like a thoughtful human teammate, not a bot.
- Do not introduce yourself as an execution agent.
- Avoid boilerplate lines like "I can help you with..." or "What would you like to do?".
- For conversational prompts, give a direct opinion or answer in 2-5 natural sentences.
- If the user asks to operate the screen (click/type/select/toggle), use ui.operate with clear steps.
- Use the provided UI snapshot to ground UI actions.
- If module is projections and the user asks to update assumptions, prefer projections.updateAssumption.
- Use the projections context snapshot to answer projection questions with concrete numbers.
- If user asks to calculate a projection metric then apply it in assumptions, calculate from context and return projections.updateAssumption.
- Treat this as an agent loop step: consider the objective and latest observation from context.
- If objective is already satisfied, return actions: [] with a completion-style reply.

Response JSON schema:
{
  "reply": string,
  "confidence": number,
  "reasoning": string,
  "actions": [
    {
      "type": "accounting.postTransaction" | "tax.recordTransaction" | "wallet.sendMoney" | "wallet.fund" | "cashflow.analyze" | "navigate" | "ui.operate" | "projections.updateAssumption" | "projections.resetAssumptions",
      "reason": string,
      "confidence": number,
      "payload": { }
    }
  ]
}`;
}

async function generatePlanWithGemini({
  apiKey,
  modelCandidates,
  prompt,
}: {
  apiKey: string;
  modelCandidates: string[];
  prompt: string;
}): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: unknown = null;

  for (const modelName of modelCandidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
        },
      });
      const text = result.response.text();
      if (text && text.trim()) return text.trim();
    } catch (error) {
      lastError = error;
      console.error(`[Agent Execute] Gemini model ${modelName} failed:`, error);
    }
  }

  throw new Error(
    `Unable to get planner response. ${lastError instanceof Error ? lastError.message : "Unknown Gemini error"}`
  );
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

function trimConversation(messages: UnifiedAgentRequest["conversation"]): AgentConversationMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_CONVERSATION_MESSAGES)
    .map((m) => ({ role: m.role, content: truncateText(m.content) }));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as UnifiedAgentRequest;
    const message = (body?.message || "").trim();
    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const conversation = trimConversation(body.conversation);
    const uiSnapshot = truncateText(typeof body.uiSnapshot === "string" ? body.uiSnapshot : "", MAX_UI_SNAPSHOT_CHARS);
    const contextSnapshot = truncateText(
      typeof body.contextSnapshot === "string" ? body.contextSnapshot : "",
      MAX_CONTEXT_SNAPSHOT_CHARS
    );
    const objective = truncateText(typeof body.objective === "string" ? body.objective : message, MAX_OBJECTIVE_CHARS);
    const memorySnapshot = truncateText(
      typeof body.memorySnapshot === "string" ? body.memorySnapshot : "",
      MAX_MEMORY_SNAPSHOT_CHARS
    );
    const seedConversation: Array<{ role: "user" | "assistant" | "system"; content: string }> =
      conversation.length > 0
        ? conversation
        : [{ role: "user" as const, content: message }];
    const knowledge = retrieveKnowledge(seedConversation, 2);
    const context = buildContextSnippet(knowledge);
    const fallback = buildFallbackPlan({
      message,
      module: body.module,
      route: body.route,
      conversation,
    });
    const moduleId = (body.module || "general").toLowerCase();

    if (isFastPathPlan(message, fallback)) {
      return NextResponse.json(postProcessPlan(message, moduleId, { ...fallback, planSource: "fast-path" as const }));
    }

    const apiKey = resolveGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json(postProcessPlan(message, moduleId, { ...fallback, planSource: "fallback" as const }));
    }

    const prompt = `${buildSystemPrompt()}

Module: ${(body.module || "general").toLowerCase()}
Route: ${body.route || "/"}
Objective: ${objective}

Memory snapshot:
${memorySnapshot || "No stored memory."}

UI snapshot:
${uiSnapshot || "No UI snapshot provided."}

Context snapshot:
${contextSnapshot || "No module context snapshot provided."}

Knowledge context:
${context}

Conversation:
${seedConversation.map((m) => `${m.role}: ${m.content}`).join("\n")}

Latest user message:
${message}

Return JSON only.`;

    try {
      const raw = await withTimeout(
        generatePlanWithGemini({
          apiKey,
          modelCandidates: resolveGeminiModels(),
          prompt,
        }),
        resolvePlannerTimeoutMs(),
        "Planner timeout"
      );

      const parsed = safeJsonParse(raw);
      const normalized = normalizePlan(parsed, fallback);
      return NextResponse.json(postProcessPlan(message, moduleId, { ...normalized, planSource: "gemini" as const }));
    } catch (plannerError) {
      console.warn("[Agent Execute] Planner fallback:", plannerError);
      return NextResponse.json(postProcessPlan(message, moduleId, {
        ...fallback,
        planSource: "fallback" as const,
        reasoning: `${fallback.reasoning || "Fallback"} Planner fallback: ${
          plannerError instanceof Error ? plannerError.message : "Unknown planner error"
        }`,
      }));
    }
  } catch (error) {
    console.error("[Agent Execute] Error:", error);
    return NextResponse.json(
      {
        reply: "I hit a planning error. Please retry with the transaction details in one sentence.",
        actions: [],
        confidence: 0.2,
        planSource: "fallback" as const,
        reasoning: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 200 }
    );
  }
}
