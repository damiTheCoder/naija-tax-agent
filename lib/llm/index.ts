import { GeminiProvider } from "@/lib/llm/providers/geminiProvider";
import { LLMService } from "@/lib/llm/service";
import type { LLMServiceInterface } from "@/lib/llm/types";

export function createDefaultLLMService(): LLMServiceInterface {
  return new LLMService(new GeminiProvider());
}

export type {
  LLMGenerateTextRequest,
  LLMGenerateTextResult,
  LLMMessage,
  LLMProvider,
  LLMRole,
  LLMServiceInterface,
} from "@/lib/llm/types";
