import type { LLMGenerateTextRequest, LLMGenerateTextResult, LLMProvider, LLMServiceInterface } from "@/lib/llm/types";

export class LLMService implements LLMServiceInterface {
  constructor(private readonly provider: LLMProvider) {}

  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  async generateText(request: LLMGenerateTextRequest): Promise<LLMGenerateTextResult> {
    return this.provider.generateText(request);
  }
}
