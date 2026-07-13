import type { UnifiedAgentAction } from "@/lib/agent/unifiedTypes";
import type { BuiltModuleContext } from "@/lib/agent/contextBuilder";
import { getToolsForDomain, type ToolRequest, toUnifiedAction } from "@/lib/agent/toolRegistry";
import type { LLMServiceInterface } from "@/lib/llm";
import { getPromptDefinition } from "@/lib/agent/promptRegistry";
import { parsePlannerResponse } from "@/lib/agent/schemas";

export interface AgentPlannerResponse {
  reply: string;
  confidence: number;
  reasoning: string;
  toolRequests: ToolRequest[];
}

export type GeminiPlannerResponse = AgentPlannerResponse;

function stripMarkdownFences(text: string): string {
  return text.replace(/```json/gi, "```").replace(/```/g, "").trim();
}

function safeJsonParse(raw: string): unknown {
  const cleaned = stripMarkdownFences(raw);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in Gemini response.");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizePlannerResponse(raw: unknown): AgentPlannerResponse {
  const parsed = parsePlannerResponse(raw);
  return parsed;
}

function normalizeFromRawText(raw: string): AgentPlannerResponse {
  const cleaned = stripMarkdownFences(raw);
  return {
    reply: cleaned || "I reviewed your request but I need a bit more detail to proceed.",
    confidence: 0.45,
    reasoning: "LLM returned non-JSON text; using it as conversational reply with no tool requests.",
    toolRequests: [],
  };
}

function buildToolSpecText(context: BuiltModuleContext): string {
  return getToolsForDomain(context.module)
    .map((tool) => {
      const payload = Object.keys(tool.payloadSchema).length
        ? Object.entries(tool.payloadSchema)
            .map(([key, value]) => `${key}: ${value}`)
            .join(", ")
        : "no arguments";
      const mode = tool.kind === "action" ? "action" : "internal";
      return `- ${tool.name} [${mode}] -> ${tool.description}. args: { ${payload} }`;
    })
    .join("\n");
}

function buildSystemInstruction(context: BuiltModuleContext): string {
  const prompt = getPromptDefinition("unified-agent-planner");
  return `Prompt: ${prompt.id}@${prompt.version}
Purpose: ${prompt.purpose}

${prompt.build(context)}`;
}

function buildPlannerPrompt(params: {
  userMessage: string;
  context: BuiltModuleContext;
  forceNoTools?: boolean;
  toolObservations?: Array<{ tool: string; result: string }>;
}): string {
  const { userMessage, context, forceNoTools, toolObservations } = params;

  const toolInstruction = forceNoTools
    ? "You already have tool observations. Do not request additional tools. Return toolRequests as []."
    : "If needed, request tools from the available list. Only request tools relevant to the module and user objective.";

  const observationsBlock =
    Array.isArray(toolObservations) && toolObservations.length > 0
      ? toolObservations.map((item) => `- ${item.tool}: ${item.result}`).join("\n")
      : "No tool observations yet.";

  return `SYSTEM:
${buildSystemInstruction(context)}

CONTEXT (JSON):
${JSON.stringify(
    {
      module: context.module,
      moduleLabel: context.moduleLabel,
      route: context.route,
      activePageContext: context.activePageContext,
      routeCatalog: context.routeCatalog,
      availableFunctions: context.availableFunctions,
      relevantEntities: context.relevantEntities,
      databaseEntities: context.databaseEntities,
      userState: context.userState,
      relevantRecords: context.relevantRecords,
      snapshotMetrics: context.snapshotMetrics,
      uiSnapshot: context.uiSnapshot,
      contextSnapshot: context.contextSnapshot,
      knowledgeContext: context.knowledgeContext,
    },
    null,
    2
  )}

AVAILABLE TOOLS:
${buildToolSpecText(context)}

TOOL GUIDANCE:
${toolInstruction}

TOOL OBSERVATIONS:
${observationsBlock}

USER:
${userMessage}

Return strict JSON only with this schema:
{
  "reply": "string",
  "confidence": 0.0,
  "reasoning": "string",
  "toolRequests": [
    {
      "name": "toolName",
      "arguments": {},
      "reason": "why this tool",
      "confidence": 0.0
    }
  ]
}

Rules:
- Always respond as a deeply embedded system agent with contextual awareness.
- Ground every response in module context and system capabilities.
- If contextSnapshot or snapshotMetrics contains numbers, explain using those concrete figures.
- Never say you lack access to system data when context provides that data.
- If this is normal conversation, explanatory Q&A, or a definition request, return toolRequests: [] and provide a natural, human response.
- Never request action tools for pure meaning/definition/explanation questions.
- For user-data lookup questions (for example, "what is my runway"), use relevant analysis tools when needed.
- If toolRequests include action tools, include only what is necessary and safe.
- Every toolRequest must include confidence and reason.
- Never output markdown fences or extra prose outside the JSON.`;
}

export class AIService {
  constructor(private readonly llmService: LLMServiceInterface) {}

  isConfigured(): boolean {
    return this.llmService.isConfigured();
  }

  async generatePlan(params: {
    userMessage: string;
    context: BuiltModuleContext;
    forceNoTools?: boolean;
    toolObservations?: Array<{ tool: string; result: string }>;
  }): Promise<AgentPlannerResponse> {
    const prompt = buildPlannerPrompt(params);
    const result = await this.llmService.generateText({ prompt, temperature: 0.2 });
    const raw = result.text;
    let normalized: AgentPlannerResponse;
    try {
      const parsed = safeJsonParse(raw);
      normalized = normalizePlannerResponse(parsed);
    } catch {
      normalized = normalizeFromRawText(raw);
    }

    if (!normalized.reply) {
      normalized = normalizeFromRawText(raw);
    }

    return normalized;
  }

  toActions(toolRequests: ToolRequest[]): UnifiedAgentAction[] {
    return toolRequests.map(toUnifiedAction).filter((item): item is UnifiedAgentAction => Boolean(item)).slice(0, 4);
  }
}
