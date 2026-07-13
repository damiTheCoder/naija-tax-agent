import { z } from "zod";
import type { UnifiedAgentAction, UnifiedAgentResponse } from "@/lib/agent/unifiedTypes";

const confidenceSchema = z.number().finite().min(0).max(1);
const payloadSchema = z.record(z.string(), z.unknown());

export const toolRequestSchema = z.object({
  name: z.string().trim().min(1),
  arguments: payloadSchema.optional().default({}),
  reason: z.string().trim().min(1).optional(),
  confidence: confidenceSchema.optional(),
});

export const plannerResponseSchema = z.object({
  reply: z.string().trim().default(""),
  confidence: confidenceSchema.default(0.4),
  reasoning: z.string().trim().default("Planner response validated with defaults."),
  toolRequests: z.array(toolRequestSchema).default([]),
});

export const unifiedAgentActionSchema = z.object({
  type: z.enum([
    "accounting.postTransaction",
    "accounting.createBill",
    "accounting.submitBill",
    "accounting.approveBill",
    "accounting.payBill",
    "accounting.lockPeriod",
    "accounting.unlockPeriod",
    "accounting.createRecurringTemplate",
    "report.downloadPdf",
    "tax.recordTransaction",
    "tax.runComputation",
    "tax.generateSchedule",
    "tax.listIssues",
    "tax.applyClassificationRules",
    "tax.generateFilingPack",
    "tax.reconcile",
    "wallet.sendMoney",
    "wallet.fund",
    "cashflow.analyze",
    "navigate",
    "ui.operate",
    "projections.updateAssumption",
    "projections.resetAssumptions",
  ]),
  payload: payloadSchema.default({}),
  reason: z.string().trim().min(1).optional(),
  confidence: confidenceSchema.optional(),
});

const runtimePhaseSchema = z.object({
  name: z.enum(["understanding", "plan", "observations", "answer", "suggestions"]),
  status: z.enum(["completed", "skipped", "failed"]),
  summary: z.string(),
  detail: z.unknown().optional(),
});

export const unifiedAgentResponseSchema = z.object({
  reply: z.string(),
  actions: z.array(unifiedAgentActionSchema).default([]),
  confidence: confidenceSchema.optional(),
  reasoning: z.string().optional(),
  planSource: z.enum(["fast-path", "gemini", "fallback"]).optional(),
  phases: z.array(runtimePhaseSchema).optional(),
  suggestions: z.array(z.string()).optional(),
  requiresApproval: z.boolean().optional(),
  approvalReasons: z.array(z.string()).optional(),
  validationErrors: z.array(z.string()).optional(),
  auditId: z.string().optional(),
});

export type ValidatedPlannerResponse = Omit<z.infer<typeof plannerResponseSchema>, "toolRequests"> & {
  toolRequests: Array<z.infer<typeof toolRequestSchema>>;
};

export function parsePlannerResponse(input: unknown): ValidatedPlannerResponse {
  const parsed = plannerResponseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      reply: "",
      confidence: 0.4,
      reasoning: `Planner response failed schema validation: ${z.prettifyError(parsed.error)}`,
      toolRequests: [],
    };
  }
  return {
    ...parsed.data,
    toolRequests: parsed.data.toolRequests.slice(0, 6),
  };
}

export function parseUnifiedAgentResponse(input: unknown, fallback: UnifiedAgentResponse): UnifiedAgentResponse {
  const parsed = unifiedAgentResponseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ...fallback,
      reasoning: `${fallback.reasoning || "Planner response unavailable"} | Remote plan failed schema validation: ${z.prettifyError(parsed.error)}`,
      planSource: "fallback",
    };
  }
  return parsed.data as UnifiedAgentResponse;
}

export function validateUnifiedAction(action: UnifiedAgentAction): { ok: true; action: UnifiedAgentAction } | { ok: false; error: string } {
  const parsed = unifiedAgentActionSchema.safeParse(action);
  if (!parsed.success) {
    return { ok: false, error: z.prettifyError(parsed.error) };
  }
  return { ok: true, action: parsed.data as UnifiedAgentAction };
}
