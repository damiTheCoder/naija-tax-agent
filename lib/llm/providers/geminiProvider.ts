import type { LLMGenerateTextRequest, LLMGenerateTextResult, LLMMessage, LLMProvider } from "@/lib/llm/types";

const DEFAULT_GEMINI_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];

const DEFAULT_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  return new Promise<T>((resolve, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      });
  });
}

export function resolveGeminiApiKey(): string {
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

export function resolveGeminiModels(maxCandidates = 2): string[] {
  const preferred = (process.env.GOOGLE_GEMINI_MODEL || process.env.GEMINI_MODEL || "").trim();
  const models = preferred ? [preferred, ...DEFAULT_GEMINI_MODELS] : DEFAULT_GEMINI_MODELS;
  return Array.from(new Set(models)).slice(0, Math.max(1, maxCandidates));
}

export function resolveGeminiTimeoutMs(): number {
  const raw = Number(process.env.AGENT_MODEL_TIMEOUT_MS || process.env.GEMINI_PLANNER_TIMEOUT_MS || "");
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.max(4000, Math.min(30000, Math.round(raw)));
}

function toGeminiText(request: LLMGenerateTextRequest): string {
  if (request.prompt?.trim()) return request.prompt.trim();

  const messages: LLMMessage[] = Array.isArray(request.messages) ? request.messages : [];
  return messages
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join("\n\n")
    .trim();
}

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private readonly apiKey: string;
  private readonly modelCandidates: string[];
  private readonly timeoutMs: number;

  constructor(params?: { apiKey?: string; modelCandidates?: string[]; timeoutMs?: number }) {
    this.apiKey = (params?.apiKey || resolveGeminiApiKey()).trim();
    this.modelCandidates = params?.modelCandidates || resolveGeminiModels(2);
    this.timeoutMs = params?.timeoutMs || resolveGeminiTimeoutMs();
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async generateText(request: LLMGenerateTextRequest): Promise<LLMGenerateTextResult> {
    if (!this.isConfigured()) {
      throw new Error("Gemini API key is not configured.");
    }

    const prompt = toGeminiText(request);
    if (!prompt) {
      throw new Error("LLM prompt or messages are required.");
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const timeoutMs = request.timeoutMs || this.timeoutMs;
    let lastError: unknown = null;

    for (const modelName of this.modelCandidates) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await withTimeout(
          model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: request.temperature ?? 0.2,
            },
          }),
          timeoutMs,
          `Gemini timeout (${modelName})`,
        );

        const text = result.response.text();
        if (text && text.trim()) {
          return {
            text: text.trim(),
            model: modelName,
            provider: this.name,
            raw: result,
          };
        }
      } catch (error) {
        lastError = error;
        console.error(`[GeminiProvider] Model ${modelName} failed:`, error);
      }
    }

    throw new Error(
      `Unable to get Gemini response. ${lastError instanceof Error ? lastError.message : "Unknown Gemini error"}`,
    );
  }
}
