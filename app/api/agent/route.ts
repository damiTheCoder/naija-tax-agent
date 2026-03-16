import { NextRequest, NextResponse } from "next/server";
import { retrieveKnowledge, buildContextSnippet } from "@/lib/agent/rag";
import type { KnowledgeEntry } from "@/lib/agent/knowledge";
import { FPA_PROJECTION_MASTER_PROMPT } from "@/lib/agent/fpaProjectionMasterPrompt";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface AgentRequest {
  messages?: ChatMessage[];
  module?: string;
  draftReply?: string;
  includeSources?: boolean;
}

const DEFAULT_GEMINI_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];

const MODULE_PERSONAS: Record<string, string> = {
  accounting:
    "You are a hands-on finance operations partner. Confirm what was posted, highlight risk quickly, and ask one concise follow-up only when needed.",
  cashflow:
    "You are a CFO-style cashflow advisor. Focus on runway, burn, liquidity risks, and practical next actions.",
  tax:
    "You are a Nigerian tax advisor. Explain VAT, WHT, CGT, CIT, and compliance implications in plain language.",
  reconciliation:
    "You are a bank reconciliation specialist. Explain gaps, likely causes, and clean remediation steps.",
  wallet:
    "You are a treasury and wallet operations advisor. Keep responses practical and execution-focused.",
  personal:
    "You are a personal finance copilot. Be conversational, context-aware, and practical. Give educational guidance (not formal regulated advice) and help users execute supported software actions.",
  supersheet:
    "You are a spreadsheet coach. Explain formulas with short, clear examples and expected outcomes.",
  dashboard:
    "You are an executive finance analyst. Summarize what matters, then list key actions.",
  general: "You are a practical enterprise finance assistant for Atom Ledger.",
};

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
  return Array.from(new Set(models));
}

function formatResponse(text: string, entries: KnowledgeEntry[]): string {
  const sourceList = entries.map((entry) => `${entry.topic} -> ${entry.sources.join(", ")}`).join("; ");
  return `${text}\n\nSources: ${sourceList}`;
}

function fallbackAnswer(question: string, entries: KnowledgeEntry[], includeSources: boolean): string {
  const summary = entries.map((entry) => `- ${entry.topic}: ${entry.summary}`).join("\n");
  const base = `I do not have external AI access right now, but here is what this software documents about "${question}".\n${summary}`;
  return includeSources ? formatResponse(base, entries) : base;
}

function getModulePersona(module?: string): string {
  const normalized = (module || "general").toLowerCase();
  return MODULE_PERSONAS[normalized] || MODULE_PERSONAS.general;
}

function toTranscript(messages: ChatMessage[]): string {
  return messages.map((m) => `${m.role}: ${m.content}`).join("\n");
}

function buildHumanStyleSystemPrompt(module?: string): string {
  const normalized = (module || "general").toLowerCase();
  const shouldApplyFpaProtocol =
    normalized === "projections" ||
    normalized === "cashflow" ||
    normalized === "dashboard" ||
    normalized === "reporting";

  return `You are NaijaTaxAgent AI, the enterprise assistant inside Atom Ledger.
${getModulePersona(module)}

Tone and style requirements:
- Sound like a skilled human advisor, not a bot.
- Use plain English and short paragraphs.
- Avoid robotic phrases, filler, and excessive formatting.
- Keep the response direct and practical.
- Preserve all amounts, dates, rates, and factual constraints exactly as provided.
- If assumptions are required, state them briefly.
${shouldApplyFpaProtocol ? `\n\nFP&A MASTER PROTOCOL:\n${FPA_PROJECTION_MASTER_PROMPT}` : ""}`;
}

async function generateWithGemini({
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
          temperature: 0.4,
        },
      });
      const text = result.response.text();
      if (text && text.trim()) return text.trim();
    } catch (error) {
      lastError = error;
      console.error(`[Agent] Gemini model ${modelName} failed:`, error);
    }
  }

  throw new Error(
    `Unable to get model response. ${lastError instanceof Error ? lastError.message : "Unknown Gemini error"}`
  );
}

function rewriteFallback(draftReply: string): string {
  return `Here is the current update:\n\n${draftReply}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: AgentRequest = await request.json();
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    const draftReply = typeof body?.draftReply === "string" ? body.draftReply.trim() : "";
    const includeSources = body?.includeSources === true;

    if (messages.length === 0 && !draftReply) {
      return NextResponse.json({ error: "messages array or draftReply is required" }, { status: 400 });
    }

    const seedMessages: ChatMessage[] = messages.length > 0 ? messages : [{ role: "user", content: draftReply }];
    const entries = retrieveKnowledge(seedMessages);
    const context = buildContextSnippet(entries);
    const userQuestion = messages[messages.length - 1]?.content || draftReply || "";
    const stylePrompt = buildHumanStyleSystemPrompt(body.module);

    const apiKey = resolveGeminiApiKey();
    if (!apiKey) {
      const answer = draftReply
        ? rewriteFallback(draftReply)
        : fallbackAnswer(userQuestion, entries, includeSources);
      return NextResponse.json({ answer, sources: entries.map((entry) => entry.sources).flat() });
    }

    const prompt = draftReply
      ? `${stylePrompt}

Context:
${context}

User request:
${userQuestion}

Draft response with validated facts:
${draftReply}

Task:
Rewrite the draft into a natural, human-sounding assistant reply. Keep all facts and numbers intact.`
      : `${stylePrompt}

Context:
${context}

Conversation:
${toTranscript(messages)}

Task:
Answer the latest user message with a practical, human-style response.`;

    const answer = await generateWithGemini({
      apiKey,
      modelCandidates: resolveGeminiModels(),
      prompt,
    });

    const finalAnswer = includeSources ? formatResponse(answer, entries) : answer;
    return NextResponse.json({ finalAnswer, answer: finalAnswer, sources: entries.map((entry) => entry.sources).flat() });
  } catch (error) {
    console.error("Tax assistant error", error);
    return NextResponse.json({ error: "Unable to generate response" }, { status: 500 });
  }
}
