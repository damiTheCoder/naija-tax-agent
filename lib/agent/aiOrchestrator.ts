import type { UnifiedAgentRequest, UnifiedAgentResponse } from "@/lib/agent/unifiedTypes";
import { buildModuleContext, type BuiltModuleContext } from "@/lib/agent/contextBuilder";
import { AIService, type GeminiPlannerResponse } from "@/lib/agent/aiService";
import { GeminiClient } from "@/lib/agent/geminiClient";
import { getToolByName, type ToolRequest } from "@/lib/agent/toolRegistry";

type ProjectionAssumptionMeta = {
  key: string;
  kind: "percent" | "ratio" | "currency";
  aliases: string[];
};

const PROJECTION_ASSUMPTIONS: ProjectionAssumptionMeta[] = [
  {
    key: "revenueGrowthRate",
    kind: "percent",
    aliases: ["revenue growth", "rev growth", "growth rate", "sales growth"],
  },
  {
    key: "operatingExpenseGrowthRate",
    kind: "percent",
    aliases: ["operating expense growth", "opex growth", "expense growth"],
  },
  {
    key: "fixedCostInflationRate",
    kind: "percent",
    aliases: ["fixed cost inflation", "fixed inflation"],
  },
  {
    key: "cogsRatio",
    kind: "percent",
    aliases: ["cogs ratio", "cost of sales ratio", "cogs"],
  },
  {
    key: "variableCostRatio",
    kind: "percent",
    aliases: ["variable cost ratio", "variable costs"],
  },
  {
    key: "marketingSpendRatio",
    kind: "percent",
    aliases: ["marketing spend", "marketing ratio", "marketing"],
  },
  {
    key: "cashCollectionRatio",
    kind: "ratio",
    aliases: ["cash collection ratio", "collection ratio", "collection"],
  },
  {
    key: "cashDisbursementRatio",
    kind: "ratio",
    aliases: ["cash disbursement ratio", "disbursement ratio", "disbursement"],
  },
  {
    key: "fixedCostBaseline",
    kind: "currency",
    aliases: ["fixed cost baseline", "fixed baseline", "fixed cost"],
  },
];

function extractNumber(value: string): number | null {
  const cleaned = value.replace(/,/g, "");
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSnapshotNumberMap(metrics: Record<string, string>): Record<string, number> {
  const output: Record<string, number> = {};
  for (const [key, value] of Object.entries(metrics)) {
    const parsed = extractNumber(value);
    if (parsed !== null) {
      output[key] = parsed;
    }
  }
  return output;
}

function normalizeToolRequests(toolRequests: ToolRequest[], context: BuiltModuleContext): ToolRequest[] {
  const allowed = new Set(context.availableFunctions);
  return toolRequests.filter((request) => allowed.has(request.name)).slice(0, 6);
}

function isActionToolRequest(request: ToolRequest): boolean {
  const tool = getToolByName(request.name);
  return tool?.kind === "action";
}

function toolRequestSignature(request: ToolRequest): string {
  const args = request.arguments && typeof request.arguments === "object" ? request.arguments : {};
  return `${request.name}:${JSON.stringify(args)}`;
}

function mergeActionToolRequests(...groups: ToolRequest[][]): ToolRequest[] {
  const seen = new Set<string>();
  const merged: ToolRequest[] = [];
  for (const group of groups) {
    for (const request of group) {
      if (!isActionToolRequest(request)) continue;
      const signature = toolRequestSignature(request);
      if (seen.has(signature)) continue;
      seen.add(signature);
      merged.push(request);
    }
  }
  return merged.slice(0, 6);
}

function extractAmount(message: string): number | null {
  const match = message.match(/(?:₦|ngn|naira)?\s*([0-9][0-9,]*(?:\.\d+)?)/i);
  if (!match?.[1]) return null;
  const parsed = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function extractSignedNumber(message: string): number | null {
  const match = message.match(/-?\d[\d,]*(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function detectRecipient(message: string): string | null {
  const emailMatch = message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch?.[1]) return emailMatch[1];

  const phoneMatch = message.match(/(?:\+?234|0)?(\d{10})/);
  if (phoneMatch?.[1]) return phoneMatch[1];

  const toMatch = message.match(/\bto\s+([a-zA-Z][\w\s.-]{2,40})$/i);
  if (toMatch?.[1]) return toMatch[1].trim();
  return null;
}

function findProjectionAssumption(message: string): ProjectionAssumptionMeta | null {
  const lower = message.toLowerCase();
  for (const assumption of PROJECTION_ASSUMPTIONS) {
    if (assumption.aliases.some((alias) => lower.includes(alias))) {
      return assumption;
    }
  }
  return null;
}

function inferNavigationRoute(message: string, currentRoute: string): string | null {
  const lower = message.toLowerCase();
  if (!/(go to|open|navigate|take me to)/.test(lower)) return null;

  if (/\bprojection|forecast|model\b/.test(lower)) return "/accounting/projections";
  if (/\breconciliation\b/.test(lower)) return "/accounting/reconciliation";
  if (/\breport\b/.test(lower)) return "/accounting/reports";
  if (/\btax\b/.test(lower)) return "/tax-tools";
  if (/\bwallet\b/.test(lower)) return "/wallet";
  if (/\baccounting\b/.test(lower)) return "/accounting";
  if (/\bpersonal\b/.test(lower)) return "/personal";
  if (/\bdashboard\b/.test(lower)) {
    return currentRoute.startsWith("/personal") ? "/personal/dashboard" : "/dashboard";
  }

  return null;
}

function buildExecutionReplyForAction(request: ToolRequest): string {
  switch (request.name) {
    case "createTransaction":
      return "Understood. I’ll post this transaction now.";
    case "recordTaxTransaction":
      return "Understood. I’ll record this as a tax transaction now.";
    case "sendPayment":
      return "Understood. I’ll execute that payment now.";
    case "fundWallet":
      return "Understood. I’ll fund the wallet now.";
    case "analyzeCashflow":
      return "Understood. I’ll analyze your cashflow now.";
    case "updateProjectionAssumption":
      return "Understood. I’ll update that projection assumption now.";
    case "resetProjectionAssumptions":
      return "Understood. I’ll reset projection assumptions to auto now.";
    case "navigate":
      return "Understood. I’ll open that page now.";
    case "operateInterface":
      return "Understood. I’ll perform that interface action now.";
    default:
      return "Understood. I’m executing that now.";
  }
}

function buildDeterministicToolRequests(message: string, context: BuiltModuleContext): ToolRequest[] {
  const lower = message.toLowerCase();
  const allowed = new Set(context.availableFunctions);
  const generated: ToolRequest[] = [];
  const amount = extractAmount(message);

  const addRequest = (request: ToolRequest): void => {
    if (!allowed.has(request.name)) return;
    generated.push(request);
  };

  const projectionResetIntent =
    /(reset|clear).*(assumption|inputs|projection)/.test(lower) || /reset to auto/.test(lower);
  if (projectionResetIntent) {
    addRequest({
      name: "resetProjectionAssumptions",
      arguments: {},
      reason: "Detected projection reset instruction",
      confidence: 0.74,
    });
  }

  const projectionUpdateIntent = /(set|update|change|adjust|input|apply).*(assumption|growth|ratio|baseline|cogs|marketing|collection|disbursement)/.test(
    lower
  );
  const assumption = findProjectionAssumption(message);
  const signedValue = extractSignedNumber(message);
  if (projectionUpdateIntent && assumption && signedValue !== null) {
    const explicitPercent = /%|percent/.test(lower);
    const unit =
      assumption.kind === "currency"
        ? "currency"
        : explicitPercent || assumption.kind === "percent"
          ? "percent"
          : "decimal";

    addRequest({
      name: "updateProjectionAssumption",
      arguments: {
        updates: [
          {
            key: assumption.key,
            value: signedValue,
            unit,
          },
        ],
      },
      reason: "Detected projection assumption update instruction",
      confidence: 0.72,
    });
  }

  if (/\b(runway|burn|cash ?flow|cashflow)\b/.test(lower)) {
    addRequest({
      name: "analyzeCashflow",
      arguments: {
        focus: lower.includes("runway") ? "runway" : lower.includes("burn") ? "burn" : "summary",
      },
      reason: "Detected cashflow analysis instruction",
      confidence: 0.68,
    });
  }

  if (typeof amount === "number" && amount > 0) {
    if (/\b(fund|top up|deposit)\b/.test(lower)) {
      addRequest({
        name: "fundWallet",
        arguments: { amount },
        reason: "Detected wallet funding instruction",
        confidence: 0.72,
      });
    } else if (/\b(send|transfer|pay)\b/.test(lower)) {
      const recipient = detectRecipient(message);
      if (recipient) {
        addRequest({
          name: "sendPayment",
          arguments: {
            amount,
            recipient,
          },
          reason: "Detected payment transfer instruction",
          confidence: 0.73,
        });
      }
    } else if (/\b(vat|wht|cgt|tax|firs|withholding)\b/.test(lower)) {
      addRequest({
        name: "recordTaxTransaction",
        arguments: {
          description: message,
          amount,
        },
        reason: "Detected tax transaction instruction",
        confidence: 0.67,
      });
    } else if (
      /\b(sold|sale|invoice|received|receipt|paid|rent|salary|buy|bought|purchase|expense|transaction|journal|post)\b/.test(
        lower
      )
    ) {
      addRequest({
        name: "createTransaction",
        arguments: {
          description: message,
          amount,
        },
        reason: "Detected accounting transaction instruction",
        confidence: 0.7,
      });
    }
  }

  const navigateRoute = inferNavigationRoute(message, context.route);
  if (navigateRoute) {
    addRequest({
      name: "navigate",
      arguments: { route: navigateRoute },
      reason: "Detected navigation instruction",
      confidence: 0.66,
    });
  }

  return mergeActionToolRequests(generated);
}

function summarizeReportContext(context: BuiltModuleContext): string {
  const topMetrics = Object.entries(context.snapshotMetrics)
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" | ");

  if (topMetrics) return `Report summary from context -> ${topMetrics}`;

  if (context.relevantRecords.length > 0) {
    return `Report summary from records -> ${context.relevantRecords.slice(0, 4).join(" | ")}`;
  }

  return "No report-ready records found in current context snapshot.";
}

function findLikelyBalance(metrics: Record<string, string>): string {
  const entries = Object.entries(metrics);
  const preferred = entries.find(([key]) => /balance|cash/i.test(key));
  if (preferred) return `${preferred[0]}: ${preferred[1]}`;
  return entries[0] ? `${entries[0][0]}: ${entries[0][1]}` : "No balance metric found in snapshot.";
}

export class AIOrchestrator {
  private readonly aiService: AIService;

  constructor() {
    this.aiService = new AIService(new GeminiClient());
  }

  private executeInternalTool(toolRequest: ToolRequest, context: BuiltModuleContext): string {
    switch (toolRequest.name) {
      case "getTransactions": {
        const transactionLines = context.relevantRecords.filter((line) =>
          /(transaction|journal|entry|invoice|receipt|payment|transfer)/i.test(line)
        );
        if (transactionLines.length > 0) {
          return `Found ${transactionLines.length} relevant transaction records: ${transactionLines
            .slice(0, 6)
            .join(" | ")}`;
        }
        return "No explicit transaction rows found in the supplied context snapshot.";
      }
      case "getBalance":
        return findLikelyBalance(context.snapshotMetrics);
      case "generateReport":
        return summarizeReportContext(context);
      case "getCustomerDetails": {
        const customerLines = context.relevantRecords.filter((line) => /(customer|client|buyer|email|phone|name)/i.test(line));
        if (customerLines.length > 0) {
          return `Customer context found: ${customerLines.slice(0, 4).join(" | ")}`;
        }
        return "No customer-specific details found in current context snapshot.";
      }
      case "calculateMetrics": {
        const args = toolRequest.arguments && typeof toolRequest.arguments === "object" ? toolRequest.arguments : {};
        const metric = typeof args.metric === "string" ? args.metric.toLowerCase() : "";
        const numericMetrics = parseSnapshotNumberMap(context.snapshotMetrics);
        const values = Object.values(numericMetrics);

        if (!values.length) {
          return "No numeric metrics found to calculate from current context snapshot.";
        }

        const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);

        if (metric.includes("growth")) {
          return `Computed growth proxy from available metrics: average=${avg.toFixed(2)}, max=${max.toFixed(2)}, min=${min.toFixed(2)}.`;
        }

        return `Computed metrics summary: average=${avg.toFixed(2)}, max=${max.toFixed(2)}, min=${min.toFixed(2)}.`;
      }
      default:
        return "Tool is not executable as internal context tool.";
    }
  }

  private async runWithToolObservations(
    request: UnifiedAgentRequest,
    context: BuiltModuleContext,
    initialPlan: GeminiPlannerResponse,
    toolRequests: ToolRequest[]
  ): Promise<GeminiPlannerResponse> {
    const internal = toolRequests.filter((requestItem) => {
      const tool = getToolByName(requestItem.name);
      return tool?.kind === "internal";
    });

    if (internal.length === 0) return initialPlan;

    const observations = internal.map((requestItem) => ({
      tool: requestItem.name,
      result: this.executeInternalTool(requestItem, context),
    }));

    try {
      return await this.aiService.generatePlan({
        userMessage: request.message,
        context,
        forceNoTools: true,
        toolObservations: observations,
      });
    } catch (error) {
      return {
        ...initialPlan,
        reasoning: `${initialPlan.reasoning} | Tool-observation follow-up failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  async orchestrate(request: UnifiedAgentRequest): Promise<UnifiedAgentResponse> {
    const message = (request.message || "").trim();
    if (!message) {
      return {
        reply: "message is required",
        actions: [],
        confidence: 0,
        reasoning: "Missing user message",
        planSource: "fallback",
      };
    }

    const context = buildModuleContext(request);

    if (!this.aiService.isConfigured()) {
      const deterministic = buildDeterministicToolRequests(message, context);
      return {
        reply:
          deterministic.length > 0
            ? buildExecutionReplyForAction(deterministic[0])
            : "AI service is not configured. Add Gemini API key to continue.",
        actions: this.aiService.toActions(deterministic),
        confidence: deterministic.length > 0 ? 0.62 : 0,
        reasoning:
          deterministic.length > 0
            ? "Gemini API key missing; deterministic action compiler produced executable action."
            : "Gemini API key missing",
        planSource: "fallback",
      };
    }

    let initialPlan: GeminiPlannerResponse;
    try {
      initialPlan = await this.aiService.generatePlan({
        userMessage: message,
        context,
      });
    } catch (error) {
      const deterministic = buildDeterministicToolRequests(message, context);
      return {
        reply:
          deterministic.length > 0
            ? buildExecutionReplyForAction(deterministic[0])
            : "AI service is temporarily unavailable for this request. Please retry.",
        actions: this.aiService.toActions(deterministic),
        confidence: deterministic.length > 0 ? 0.6 : 0,
        reasoning:
          deterministic.length > 0
            ? `Gemini plan failed; deterministic action compiler fallback used. ${
                error instanceof Error ? error.message : "Unknown Gemini error"
              }`
            : error instanceof Error
              ? error.message
              : "Unknown Gemini error",
        planSource: "fallback",
      };
    }

    const requestedTools = normalizeToolRequests(initialPlan.toolRequests, context);
    const enrichedPlan = await this.runWithToolObservations(request, context, initialPlan, requestedTools);
    const enrichedTools = normalizeToolRequests(enrichedPlan.toolRequests, context);

    const mergedActionRequests = mergeActionToolRequests(
      requestedTools.filter(isActionToolRequest),
      enrichedTools.filter(isActionToolRequest)
    );

    const deterministicFallbackActions =
      mergedActionRequests.length === 0 ? buildDeterministicToolRequests(message, context) : [];
    const finalActionRequests =
      mergedActionRequests.length > 0
        ? mergedActionRequests
        : mergeActionToolRequests(deterministicFallbackActions);
    const usedDeterministicFallback = mergedActionRequests.length === 0 && finalActionRequests.length > 0;

    const safeReply = (enrichedPlan.reply || initialPlan.reply || "").trim();

    return {
      reply:
        usedDeterministicFallback && finalActionRequests.length > 0
          ? buildExecutionReplyForAction(finalActionRequests[0])
          : safeReply || "I’m ready to help with that.",
      confidence: usedDeterministicFallback
        ? Math.max(
            0.58,
            ...finalActionRequests.map((requestItem) =>
              typeof requestItem.confidence === "number" && Number.isFinite(requestItem.confidence)
                ? requestItem.confidence
                : 0.58
            )
          )
        : enrichedPlan.confidence,
      reasoning: usedDeterministicFallback
        ? `${enrichedPlan.reasoning} | Deterministic action compiler injected executable tool request.`
        : enrichedPlan.reasoning,
      actions: this.aiService.toActions(finalActionRequests),
      planSource: usedDeterministicFallback ? "fallback" : "gemini",
    };
  }
}
