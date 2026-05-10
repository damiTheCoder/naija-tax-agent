import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { GoogleGenAI, mcpToTool, type FunctionDeclaration } from "@google/genai";
import type { UnifiedAgentAction, UnifiedAgentRequest, UnifiedAgentResponse } from "@/lib/agent/unifiedTypes";
import { createFinancialMcpServer } from "@/lib/mcp/financialServer";
import { resolveWorkspaceRouteFromText } from "@/lib/agent/routeResolver";

const DEFAULT_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

const thoughtStateByThread = new Map<string, string[]>();

const MCP_SYSTEM_PROMPT = `You are the Bace MCP bridge planner.
You must orchestrate financial workflows using MCP tools when the user is requesting actions.

Rules:
1) For explanation-only questions, answer directly and avoid tool calls.
2) For operational requests (post transaction, process payroll, check tax rules, verify budget, or navigate to a page), call relevant tools.
3) For link/page/navigation questions, call find_workspace_route and return the internal route.
4) For print/download/export/report requests, call prepare_report_pdf.
5) Use the provided live context snapshot and UI snapshot as source-of-truth for user-specific figures.
6) Never claim you lack access to figures when context snapshot contains metrics.
7) Keep responses concise and execution-focused.`;

function normalizeIntentText(message: string): string {
  return (message || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bpls\b/g, "please")
    .replace(/\bprintout\b/g, "print out")
    .replace(/\btayable\s+payable\b/g, "tax payable")
    .replace(/\btayable\b/g, "payable")
    .replace(/\bpayble\b/g, "payable")
    .replace(/\bliablities\b/g, "liabilities");
}

function resolveReportTypeFromText(message: string): string {
  const lower = normalizeIntentText(message);
  if (/\btrial\s*balance\b/.test(lower)) return "trial_balance";
  if (/\b(balance\s*sheet|statement of financial position|sfp)\b/.test(lower)) return "balance_sheet";
  if (/\b(income\s*statement|profit\s*&?\s*loss|profit and loss|p&l|pnl)\b/.test(lower)) return "income_statement";
  if (/\b(cash\s*flow|cashflow)\b/.test(lower)) return "cashflow";
  if (/\bfinancial\s+statements?\b/.test(lower)) return "financial_statements";
  if (/\bfinancial\s+summary\b/.test(lower)) return "financial_summary";
  if (
    /\b(tax payable|tax payables|tax liability|tax liabilities|vat payable|wht payable|cit payable|paye payable|education tax)\b/.test(
      lower
    ) ||
    /\bpayable payable\b/.test(lower)
  ) {
    return "tax_payables";
  }
  return "financial_statements";
}

function isReportExecutionIntent(request: UnifiedAgentRequest): boolean {
  const lower = normalizeIntentText(request.message || "");
  const reportVerb = /\b(print|print out|download|export|generate|get|give me|pull)\b/.test(lower);
  const reportObject =
    /\b(report|statement|trial balance|balance sheet|income statement|profit and loss|p&l|pnl|cash flow|tax payable|tax payables|tax liability|tax liabilities|payable)\b/.test(
      lower
    );
  const moduleId = (request.module || "").toLowerCase();
  const taxModulePayableAsk =
    moduleId === "tax" &&
    /\b(payable|liabilit|vat|wht|cit|paye|education tax|tax)\b/.test(lower) &&
    /\b(print|download|export|report|statement|show|give me)\b/.test(lower);
  return (reportVerb && reportObject) || taxModulePayableAsk;
}

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

function resolveModelCandidates(): string[] {
  const preferred = (process.env.GOOGLE_GEMINI_MODEL || process.env.GEMINI_MODEL || "").trim();
  const models = preferred ? [preferred, ...DEFAULT_GEMINI_MODELS] : DEFAULT_GEMINI_MODELS;
  return Array.from(new Set(models));
}

function trimModelText(value: string | undefined, limit = 3600): string {
  const text = (value || "").trim();
  if (!text) return "";
  return text.length <= limit ? text : `${text.slice(0, limit)}...`;
}

function buildThreadKey(request: UnifiedAgentRequest): string {
  const moduleId = (request.module || "general").toLowerCase();
  const transcript = (request.conversation || [])
    .slice(-8)
    .map((item) => `${item.role}:${item.content}`)
    .join("\n");
  const hash = createHash("sha1").update(`${moduleId}|${transcript}`).digest("hex").slice(0, 12);
  return `${moduleId}:${hash}`;
}

function extractThoughtSignatures(response: unknown): string[] {
  if (!response || typeof response !== "object") return [];

  const candidateArray = (response as { candidates?: unknown[] }).candidates;
  if (!Array.isArray(candidateArray)) return [];

  const signatures = new Set<string>();
  for (const candidate of candidateArray) {
    if (!candidate || typeof candidate !== "object") continue;
    const parts = (candidate as { content?: { parts?: unknown[] } }).content?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (!part || typeof part !== "object") continue;
      const signature = (part as { thoughtSignature?: unknown }).thoughtSignature;
      if (typeof signature === "string" && signature.trim()) {
        signatures.add(signature.trim());
      }
    }
  }

  return Array.from(signatures);
}

function convertMcpToolsToFunctionDeclarations(
  tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>
): FunctionDeclaration[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description || "",
    parametersJsonSchema:
      tool.inputSchema && typeof tool.inputSchema === "object"
        ? tool.inputSchema
        : {
            type: "object",
            properties: {},
          },
  }));
}

type ObservedMcpToolCall = {
  toolName: string;
  arguments: Record<string, unknown>;
  result?: unknown;
};

function extractToolCalls(response: unknown): ObservedMcpToolCall[] {
  const observed: ObservedMcpToolCall[] = [];
  const callById = new Map<string, ObservedMcpToolCall>();

  if (!response || typeof response !== "object") return observed;

  const history = (response as { automaticFunctionCallingHistory?: unknown[] }).automaticFunctionCallingHistory;

  if (Array.isArray(history)) {
    for (const content of history) {
      if (!content || typeof content !== "object") continue;
      const parts = (content as { parts?: unknown[] }).parts;
      if (!Array.isArray(parts)) continue;

      for (const part of parts) {
        if (!part || typeof part !== "object") continue;

        const type = (part as { type?: unknown }).type;
        if (type === "mcp_server_tool_call") {
          const id = String((part as { id?: unknown }).id || "").trim();
          const toolName = String((part as { name?: unknown }).name || "").trim();
          const args =
            (part as { arguments?: unknown }).arguments && typeof (part as { arguments?: unknown }).arguments === "object"
              ? ((part as { arguments: Record<string, unknown> }).arguments)
              : {};

          const item: ObservedMcpToolCall = {
            toolName,
            arguments: args,
          };

          observed.push(item);
          if (id) {
            callById.set(id, item);
          }
        }

        if (type === "mcp_server_tool_result") {
          const callId = String((part as { call_id?: unknown }).call_id || "").trim();
          const directName = String((part as { name?: unknown }).name || "").trim();
          const result = (part as { result?: unknown }).result;

          if (callId && callById.has(callId)) {
            const target = callById.get(callId);
            if (target) target.result = result;
          } else if (directName) {
            const item: ObservedMcpToolCall = {
              toolName: directName,
              arguments: {},
              result,
            };
            observed.push(item);
          }
        }
      }
    }
  }

  const fallbackFunctionCalls = (response as { functionCalls?: unknown[] }).functionCalls;
  if (Array.isArray(fallbackFunctionCalls) && fallbackFunctionCalls.length > 0) {
    for (const fnCall of fallbackFunctionCalls) {
      if (!fnCall || typeof fnCall !== "object") continue;
      const toolName = String((fnCall as { name?: unknown }).name || "").trim();
      const args =
        (fnCall as { args?: unknown }).args && typeof (fnCall as { args?: unknown }).args === "object"
          ? ((fnCall as { args: Record<string, unknown> }).args)
          : {};
      if (toolName) {
        observed.push({ toolName, arguments: args });
      }
    }
  }

  return observed;
}

function readReadyActionSignal(result: unknown): { readyAction?: UnifiedAgentAction } {
  if (!result || typeof result !== "object") {
    return {};
  }

  const raw = result as Record<string, unknown>;
  const structured = raw.structuredContent && typeof raw.structuredContent === "object"
    ? (raw.structuredContent as Record<string, unknown>)
    : null;

  if (structured) {
    const readyAction =
      structured.readyAction && typeof structured.readyAction === "object"
        ? (structured.readyAction as UnifiedAgentAction)
        : undefined;
    return { readyAction };
  }

  return {};
}

function getStructuredContent(result: unknown): Record<string, unknown> | null {
  if (!result || typeof result !== "object") return null;
  const raw = result as Record<string, unknown>;
  if (!raw.structuredContent || typeof raw.structuredContent !== "object") return null;
  return raw.structuredContent as Record<string, unknown>;
}

function mapToolCallsToActions(toolCalls: ObservedMcpToolCall[]): {
  actions: UnifiedAgentAction[];
} {
  const actions: UnifiedAgentAction[] = [];

  for (const call of toolCalls) {
    if (call.toolName === "create_ledger_entry") {
      const execution = readReadyActionSignal(call.result);
      if (execution.readyAction) {
        actions.push(execution.readyAction);
        continue;
      }

      const amount = Number(call.arguments.amount || 0);
      const description = typeof call.arguments.description === "string" ? call.arguments.description : "";
      if (amount > 0 && description.trim()) {
        actions.push({
          type: "accounting.postTransaction",
          payload: {
            description,
            amount,
            category: typeof call.arguments.category === "string" ? call.arguments.category : "other",
            date: typeof call.arguments.date === "string" ? call.arguments.date : undefined,
          },
          reason: "Mapped from MCP create_ledger_entry",
          confidence: 0.82,
        });
      }
    }

    if (call.toolName === "find_workspace_route") {
      const structured = getStructuredContent(call.result);
      const route = structured && typeof structured.route === "string" ? structured.route : "";
      const reason = structured && typeof structured.reason === "string" ? structured.reason : "";
      if (route.startsWith("/")) {
        actions.push({
          type: "navigate",
          payload: { route },
          reason: reason || "Mapped from MCP find_workspace_route",
          confidence: 0.84,
        });
      }
    }

    if (call.toolName === "prepare_report_pdf") {
      const structured = getStructuredContent(call.result);
      const readyAction =
        structured && structured.readyAction && typeof structured.readyAction === "object"
          ? (structured.readyAction as UnifiedAgentAction)
          : null;
      if (readyAction && readyAction.type === "report.downloadPdf") {
        actions.push(readyAction);
        continue;
      }

      const reportType =
        (structured && typeof structured.reportType === "string" && structured.reportType) ||
        (typeof call.arguments.report_type === "string" ? call.arguments.report_type : "financial_statements");
      actions.push({
        type: "report.downloadPdf",
        payload: {
          reportType,
          format: "pdf",
          description: typeof call.arguments.description === "string" ? call.arguments.description : "",
        },
        reason: "Mapped from MCP prepare_report_pdf",
        confidence: 0.86,
      });
    }
  }

  return { actions };
}

function isMcpEnabled(): boolean {
  const flag = (process.env.MCP_AGENT_ENABLED || "true").trim().toLowerCase();
  return flag !== "false" && flag !== "0";
}

function tryHandleRouteMessage(request: UnifiedAgentRequest): UnifiedAgentResponse | null {
  const navigationIntent = /\b(page|link|url|where|go to|open|navigate|take me|which page|location|upload)\b/i.test(
    request.message || ""
  );
  if (!navigationIntent) return null;

  const recentConversation = (request.conversation || [])
    .slice(-8)
    .map((item) => item.content)
    .join("\n");
  const searchText = `${recentConversation}\n${request.message || ""}`;
  const resolved = resolveWorkspaceRouteFromText(searchText, request.route, request.module);
  if (!resolved) return null;

  return {
    reply: `Open this page: ${resolved.route}. I will take you there now.`,
    actions: [
      {
        type: "navigate",
        payload: { route: resolved.route },
        reason: resolved.reason,
        confidence: 0.88,
      },
    ],
    confidence: 0.88,
    reasoning: `Navigation shortcut resolved route=${resolved.route}.`,
    planSource: "gemini",
  };
}

function tryHandleReportMessage(request: UnifiedAgentRequest): UnifiedAgentResponse | null {
  if (!isReportExecutionIntent(request)) return null;
  const reportType = resolveReportTypeFromText(request.message || "");

  return {
    reply: "Understood. I’ll generate that report and attach a PDF download.",
    actions: [
      {
        type: "report.downloadPdf",
        payload: {
          reportType,
          format: "pdf",
          description: request.message || "",
        },
        reason: "Deterministic report intent shortcut in MCP bridge.",
        confidence: 0.9,
      },
    ],
    confidence: 0.9,
    reasoning: `Report shortcut resolved reportType=${reportType}.`,
    planSource: "gemini",
  };
}

export async function runMcpGeminiBridge(request: UnifiedAgentRequest): Promise<UnifiedAgentResponse | null> {
  if (!isMcpEnabled()) return null;

  const routeOverride = tryHandleRouteMessage(request);
  if (routeOverride) return routeOverride;

  const reportOverride = tryHandleReportMessage(request);
  if (reportOverride) return reportOverride;

  const apiKey = resolveGeminiApiKey();
  if (!apiKey) return null;

  const threadKey = buildThreadKey(request);
  const priorThoughtSignatures = thoughtStateByThread.get(threadKey) || [];

  const mcpServer = createFinancialMcpServer();
  const mcpClient = new Client({
    name: "quantum-ledger-gemini-bridge",
    version: "1.0.0",
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  try {
    await Promise.all([mcpServer.connect(serverTransport), mcpClient.connect(clientTransport)]);

    const listed = await mcpClient.listTools();
    const declarations = convertMcpToolsToFunctionDeclarations(
      listed.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }))
    );

    const transcript = (request.conversation || [])
      .slice(-10)
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");

    const modelInput = [
      `Module: ${request.module || "general"}`,
      request.route ? `Route: ${request.route}` : "",
      priorThoughtSignatures.length ? `Prior thought signatures: ${priorThoughtSignatures.join(", ")}` : "",
      transcript ? `Conversation:\n${transcript}` : "",
      request.contextSnapshot ? `Live context snapshot:\n${trimModelText(request.contextSnapshot, 5000)}` : "",
      request.uiSnapshot ? `UI snapshot:\n${trimModelText(request.uiSnapshot, 2500)}` : "",
      `User request: ${request.message}`,
      "Return a concise execution response for the user.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const ai = new GoogleGenAI({ apiKey });
    let lastResponse: unknown = null;
    let lastError: unknown = null;

    for (const model of resolveModelCandidates()) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: modelInput,
          config: {
            systemInstruction: MCP_SYSTEM_PROMPT,
            tools: [mcpToTool(mcpClient)],
            automaticFunctionCalling: {
              disable: false,
              maximumRemoteCalls: 8,
            },
            // Keep thought summaries available for Gemini 3+/thinking-capable models.
            thinkingConfig: {
              includeThoughts: true,
              thinkingBudget: -1,
            },
            temperature: 0.2,
          },
        });
        lastResponse = response;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!lastResponse) {
      throw new Error(lastError instanceof Error ? lastError.message : "No Gemini model returned a response");
    }

    const text =
      typeof (lastResponse as { text?: unknown }).text === "string"
        ? ((lastResponse as { text: string }).text || "").trim()
        : "";

    const toolCalls = extractToolCalls(lastResponse);
    const { actions } = mapToolCallsToActions(toolCalls);

    const newThoughtSignatures = extractThoughtSignatures(lastResponse);
    if (newThoughtSignatures.length > 0) {
      thoughtStateByThread.set(threadKey, newThoughtSignatures.slice(-5));
    }

    const reply = text || "Request analyzed through MCP bridge.";

    return {
      reply,
      actions,
      confidence: actions.length > 0 ? 0.86 : 0.7,
      reasoning:
        `MCP bridge active. Tools available=${declarations.length}. ` +
        `Tools called=${toolCalls.map((call) => call.toolName).join(", ") || "none"}. ` +
        `Thought signatures=${newThoughtSignatures.length}.`,
      planSource: "gemini",
    };
  } finally {
    await Promise.allSettled([mcpClient.close(), mcpServer.close()]);
  }
}

export function getMcpSettingsSample() {
  return {
    mcpServers: {
      "quantum-ledger-financial": {
        command: "npx",
        args: ["tsx", "scripts/mcp-financial-server.ts"],
        cwd: process.cwd(),
        env: {
          GEMINI_API_KEY: "${GEMINI_API_KEY}",
        },
      },
    },
  };
}
