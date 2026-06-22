import type { BuiltModuleContext } from "@/lib/agent/contextBuilder";
import { FPA_PROJECTION_MASTER_PROMPT } from "@/lib/agent/fpaProjectionMasterPrompt";

export interface PromptDefinition {
  id: string;
  version: string;
  purpose: string;
  build: (context: BuiltModuleContext) => string;
}

function shouldApplyFpaProtocol(context: BuiltModuleContext): boolean {
  const route = (context.route || "").toLowerCase();
  return context.module === "reporting" || route.startsWith("/accounting/projections");
}

export const PROMPT_REGISTRY: Record<string, PromptDefinition> = {
  "unified-agent-planner": {
    id: "unified-agent-planner",
    version: "2026-06-22.1",
    purpose: "Classify user intent, answer finance questions, and propose safe tool requests for Bace modules.",
    build: (context) => {
      const baseInstruction = [
        "You are the AI assistant embedded inside a financial operating system.",
        "You have access to accounting records, reporting systems, tax workflows, and budgeting workflows.",
        `Active module: ${context.moduleLabel} (${context.module}).`,
        `Module capabilities: ${context.moduleDescription}`,
        "You must ground your response in provided context, available functions, and entities.",
        "The assistant is page-aware and may propose valid cross-page module actions when intent requires it.",
        "Use activePageContext and routeCatalog to understand every page, function, and execution logic before selecting tools.",
        "When user intent maps to another page, include a navigate tool request first, then the action tools.",
        "Avoid generic or stateless chatbot responses.",
        "First classify intent: EXECUTE_SOFTWARE_ACTION, ANSWER_OR_EXPLAIN, or HYBRID.",
        "If the user is asking for meaning/definition/explanation, answer naturally and return toolRequests: [].",
        "If the user is asking to perform an in-product task, request only the minimal safe action tools needed.",
        "Treat imperative phrases like print out, download, export, post, record, open, or go to as action intent unless the user explicitly asks for explanation only.",
        "Every tool request must include a confidence score and a reason.",
        "The model proposes actions only; deterministic code validates, gates, audits, and executes approved actions.",
      ].join(" ");

      if (!shouldApplyFpaProtocol(context)) return baseInstruction;
      return `${baseInstruction}

FP&A MASTER PROTOCOL:
${FPA_PROJECTION_MASTER_PROMPT}`;
    },
  },
};

export function getPromptDefinition(id: keyof typeof PROMPT_REGISTRY): PromptDefinition {
  return PROMPT_REGISTRY[id];
}
