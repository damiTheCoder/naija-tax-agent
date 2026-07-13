import { AIOrchestrator } from "@/lib/agent/aiOrchestrator";
import type { AgentRuntimePhase, UnifiedAgentRequest, UnifiedAgentResponse } from "@/lib/agent/unifiedTypes";
import { runMcpGeminiBridge } from "@/lib/mcp/geminiBridge";

function normalizeIntentLabel(message: string): string {
  const lower = message.toLowerCase();
  if (/\b(post|record|create|add|save|log)\b/.test(lower)) return "create or record";
  if (/\b(download|export|print|generate)\b/.test(lower)) return "generate output";
  if (/\b(open|go to|navigate|show page)\b/.test(lower)) return "navigate";
  if (/\b(what|why|how|explain|define|meaning)\b/.test(lower)) return "explain";
  if (/\b(show|list|summari[sz]e|analy[sz]e|check)\b/.test(lower)) return "analyze";
  return "conversation";
}

function summarizeActions(response: UnifiedAgentResponse): string {
  if (!response.actions.length) return "No executable actions selected.";
  return response.actions.map((action) => action.type).join(", ");
}

function buildSuggestions(request: UnifiedAgentRequest, response: UnifiedAgentResponse): string[] {
  const moduleId = (request.module || "").toLowerCase();
  const suggestions: string[] = [];

  if (response.actions.length > 0) {
    suggestions.push("Show me what changed");
  }

  if (moduleId.includes("accounting") || response.actions.some((action) => action.type.startsWith("accounting."))) {
    suggestions.push("Show the audit trail");
    suggestions.push("Generate a report");
  } else if (moduleId.includes("tax") || response.actions.some((action) => action.type.startsWith("tax."))) {
    suggestions.push("Check tax impact");
    suggestions.push("Prepare filing pack");
  } else if (moduleId.includes("budget") || moduleId.includes("projection")) {
    suggestions.push("Run a scenario");
    suggestions.push("Explain the key assumptions");
  } else {
    suggestions.push("What should I do next?");
    suggestions.push("Explain this in simpler terms");
  }

  return Array.from(new Set(suggestions)).slice(0, 3);
}

function buildRuntimePhases(request: UnifiedAgentRequest, response: UnifiedAgentResponse): AgentRuntimePhase[] {
  const intent = normalizeIntentLabel(request.message || "");
  const actionSummary = summarizeActions(response);
  const observations =
    response.validationErrors?.length
      ? response.validationErrors.join(" | ")
      : response.approvalReasons?.length
        ? response.approvalReasons.join(" | ")
        : response.reasoning || "No extra observations.";

  return [
    {
      name: "understanding",
      status: "completed",
      summary: `Intent classified as ${intent}.`,
      detail: {
        module: request.module || "general",
        route: request.route || "",
      },
    },
    {
      name: "plan",
      status: "completed",
      summary: actionSummary,
      detail: {
        actionCount: response.actions.length,
        source: response.planSource || "fallback",
      },
    },
    {
      name: "observations",
      status: observations === "No extra observations." ? "skipped" : "completed",
      summary: observations,
    },
    {
      name: "answer",
      status: response.reply.trim() ? "completed" : "failed",
      summary: response.reply.trim() ? "Final assistant response prepared." : "No final response was produced.",
    },
    {
      name: "suggestions",
      status: "completed",
      summary: "Contextual follow-up suggestions prepared.",
    },
  ];
}

export class AgentRuntime {
  constructor(private readonly orchestrator = new AIOrchestrator()) {}

  async run(request: UnifiedAgentRequest): Promise<UnifiedAgentResponse> {
    const mcpBridgeResponse = await runMcpGeminiBridge(request);
    const response = mcpBridgeResponse || (await this.orchestrator.orchestrate(request));
    const suggestions = response.suggestions?.length ? response.suggestions : buildSuggestions(request, response);
    const phases = response.phases?.length ? response.phases : buildRuntimePhases(request, response);

    return {
      ...response,
      phases,
      suggestions,
    };
  }
}
