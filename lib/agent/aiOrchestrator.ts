import type { UnifiedAgentRequest, UnifiedAgentResponse } from "@/lib/agent/unifiedTypes";
import { buildModuleContext, type BuiltModuleContext } from "@/lib/agent/contextBuilder";
import { AIService, type GeminiPlannerResponse } from "@/lib/agent/aiService";
import { GeminiClient } from "@/lib/agent/geminiClient";
import { getToolByName, type ToolRequest } from "@/lib/agent/toolRegistry";

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

    return this.aiService.generatePlan({
      userMessage: request.message,
      context,
      forceNoTools: true,
      toolObservations: observations,
    });
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

    if (!this.aiService.isConfigured()) {
      return {
        reply: "AI service is not configured. Add Gemini API key to continue.",
        actions: [],
        confidence: 0,
        reasoning: "Gemini API key missing",
        planSource: "fallback",
      };
    }

    const context = buildModuleContext(request);
    const initialPlan = await this.aiService.generatePlan({
      userMessage: message,
      context,
    });

    const requestedTools = normalizeToolRequests(initialPlan.toolRequests, context);
    const enrichedPlan = await this.runWithToolObservations(request, context, initialPlan, requestedTools);
    const finalToolRequests = normalizeToolRequests(enrichedPlan.toolRequests, context);

    return {
      reply: enrichedPlan.reply,
      confidence: enrichedPlan.confidence,
      reasoning: enrichedPlan.reasoning,
      actions: this.aiService.toActions(finalToolRequests),
      planSource: "gemini",
    };
  }
}
