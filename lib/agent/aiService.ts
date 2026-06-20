import type { UnifiedAgentAction } from "@/lib/agent/unifiedTypes";
import type { BuiltModuleContext } from "@/lib/agent/contextBuilder";
import { getToolsForDomain, type ToolRequest, toUnifiedAction } from "@/lib/agent/toolRegistry";
import { GeminiClient } from "@/lib/agent/geminiClient";
import { FPA_PROJECTION_MASTER_PROMPT } from "@/lib/agent/fpaProjectionMasterPrompt";

export interface GeminiPlannerResponse {
  reply: string;
  confidence: number;
  reasoning: string;
  toolRequests: ToolRequest[];
}

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

function normalizeToolRequest(input: unknown): ToolRequest | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<ToolRequest>;
  if (typeof candidate.name !== "string" || !candidate.name.trim()) return null;

  return {
    name: candidate.name.trim(),
    arguments: candidate.arguments && typeof candidate.arguments === "object" ? candidate.arguments : {},
    reason: typeof candidate.reason === "string" ? candidate.reason.trim() : undefined,
    confidence:
      typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)
        ? Math.max(0, Math.min(1, candidate.confidence))
        : undefined,
  };
}

function normalizePlannerResponse(raw: unknown): GeminiPlannerResponse {
  const fallback: GeminiPlannerResponse = {
    reply: "",
    confidence: 0.4,
    reasoning: "Gemini response normalized with defaults.",
    toolRequests: [],
  };

  if (!raw || typeof raw !== "object") return fallback;
  const obj = raw as Partial<GeminiPlannerResponse> & { toolRequests?: unknown[] };

  return {
    reply: typeof obj.reply === "string" ? obj.reply.trim() : fallback.reply,
    confidence:
      typeof obj.confidence === "number" && Number.isFinite(obj.confidence)
        ? Math.max(0, Math.min(1, obj.confidence))
        : fallback.confidence,
    reasoning: typeof obj.reasoning === "string" ? obj.reasoning.trim() : fallback.reasoning,
    toolRequests: Array.isArray(obj.toolRequests)
      ? obj.toolRequests.map(normalizeToolRequest).filter((item): item is ToolRequest => Boolean(item)).slice(0, 6)
      : fallback.toolRequests,
  };
}

function normalizeFromRawText(raw: string): GeminiPlannerResponse {
  const cleaned = stripMarkdownFences(raw);
  return {
    reply: cleaned || "I reviewed your request but I need a bit more detail to proceed.",
    confidence: 0.45,
    reasoning: "Gemini returned non-JSON text; using it as conversational reply with no tool requests.",
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

function shouldApplyFpaProtocol(context: BuiltModuleContext): boolean {
  const route = (context.route || "").toLowerCase();
  return (
    context.module === "reporting" ||
    route.startsWith("/accounting/projections")
  );
}

function buildSystemInstruction(context: BuiltModuleContext): string {
  const baseInstruction = [
    "You are the AI assistant embedded inside a financial operating system.",
    "You have access to accounting records, reporting systems, tax workflows, and budgeting workflows.",
    `Active module: ${context.moduleLabel} (${context.module}).`,
    `Module capabilities: ${context.moduleDescription}`,
    "You must ground your response in provided context, available functions, and entities.",
    "The assistant is page-aware and may execute valid cross-page module actions when intent requires it.",
    "Use activePageContext and routeCatalog to understand every page, function, and execution logic before selecting tools.",
    "When user intent maps to another page, include a navigate tool request first, then the action tools.",
    "Avoid generic or stateless chatbot responses.",
    "First classify intent: EXECUTE_SOFTWARE_ACTION, ANSWER_OR_EXPLAIN, or HYBRID.",
    "If the user is asking for meaning/definition/explanation, answer naturally and return toolRequests: [].",
    "If the user is asking to perform an in-product task, request only the minimal safe action tools needed.",
    "Treat imperative phrases like 'print out', 'download', 'export', 'post', 'record', 'open', or 'go to' as action intent unless the user explicitly asks for explanation only.",
    "When an operation is required, choose the best tool request.",
  ].join(" ");

  if (!shouldApplyFpaProtocol(context)) return baseInstruction;
  return `${baseInstruction}

FP&A MASTER PROTOCOL:
${FPA_PROJECTION_MASTER_PROMPT}`;
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
- Never output markdown fences or extra prose outside the JSON.`;
}

export class AIService {
  constructor(private readonly geminiClient: GeminiClient) {}

  isConfigured(): boolean {
    return this.geminiClient.isConfigured();
  }

  async generatePlan(params: {
    userMessage: string;
    context: BuiltModuleContext;
    forceNoTools?: boolean;
    toolObservations?: Array<{ tool: string; result: string }>;
  }): Promise<GeminiPlannerResponse> {
    const prompt = buildPlannerPrompt(params);
    const raw = await this.geminiClient.generateText(prompt, 0.2);
    let normalized: GeminiPlannerResponse;
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
