export type AgentChatRole = "user" | "assistant";

export interface AgentConversationMessage {
  role: AgentChatRole;
  content: string;
}

export type UnifiedAgentActionType =
  | "accounting.postTransaction"
  | "report.downloadPdf"
  | "tax.recordTransaction"
  | "tax.runComputation"
  | "tax.generateSchedule"
  | "tax.listIssues"
  | "tax.applyClassificationRules"
  | "tax.generateFilingPack"
  | "tax.reconcile"
  | "wallet.sendMoney"
  | "wallet.fund"
  | "cashflow.analyze"
  | "navigate"
  | "ui.operate"
  | "projections.updateAssumption"
  | "projections.resetAssumptions";

export interface UnifiedAgentAction {
  type: UnifiedAgentActionType;
  payload: Record<string, unknown>;
  reason?: string;
  confidence?: number;
}

export interface UnifiedAgentRequest {
  message: string;
  module?: string;
  route?: string;
  conversation?: AgentConversationMessage[];
  uiSnapshot?: string;
  contextSnapshot?: string;
  objective?: string;
  memorySnapshot?: string;
}

export interface UnifiedAgentResponse {
  reply: string;
  actions: UnifiedAgentAction[];
  confidence?: number;
  reasoning?: string;
  planSource?: "fast-path" | "gemini" | "fallback";
}

export interface UnifiedActionExecutionResult {
  type: UnifiedAgentActionType;
  success: boolean;
  message: string;
  navigateTo?: string;
  data?: unknown;
}
