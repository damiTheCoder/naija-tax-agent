export type LLMRole = "system" | "user" | "assistant";

export type LLMMessage = {
  role: LLMRole;
  content: string;
};

export type LLMGenerateTextRequest = {
  prompt?: string;
  messages?: LLMMessage[];
  temperature?: number;
  timeoutMs?: number;
};

export type LLMGenerateTextResult = {
  text: string;
  model: string;
  provider: string;
  raw?: unknown;
};

export interface LLMProvider {
  readonly name: string;
  isConfigured(): boolean;
  generateText(request: LLMGenerateTextRequest): Promise<LLMGenerateTextResult>;
}

export interface LLMServiceInterface {
  isConfigured(): boolean;
  generateText(request: LLMGenerateTextRequest): Promise<LLMGenerateTextResult>;
}
