import type { UnifiedAgentAction, UnifiedAgentActionType } from "@/lib/agent/unifiedTypes";
import { validateUnifiedAction } from "@/lib/agent/schemas";

export type ActionRiskLevel = "read" | "navigation" | "low" | "medium" | "high" | "critical";

export interface ActionPolicy {
  risk: ActionRiskLevel;
  approvalRequired: boolean;
  minConfidence: number;
  description: string;
}

export interface PolicyDecision {
  allowed: boolean;
  approvalRequired: boolean;
  reasons: string[];
}

const DEFAULT_POLICY: ActionPolicy = {
  risk: "medium",
  approvalRequired: true,
  minConfidence: 0.65,
  description: "Unclassified action",
};

const ACTION_POLICIES: Record<UnifiedAgentActionType, ActionPolicy> = {
  "accounting.postTransaction": {
    risk: "high",
    approvalRequired: true,
    minConfidence: 0.7,
    description: "Posts accounting data",
  },
  "accounting.createBill": {
    risk: "medium",
    approvalRequired: true,
    minConfidence: 0.68,
    description: "Creates AP draft data",
  },
  "accounting.submitBill": {
    risk: "high",
    approvalRequired: true,
    minConfidence: 0.7,
    description: "Submits bill into approval workflow",
  },
  "accounting.approveBill": {
    risk: "critical",
    approvalRequired: true,
    minConfidence: 0.85,
    description: "Approves liability posting",
  },
  "accounting.payBill": {
    risk: "critical",
    approvalRequired: true,
    minConfidence: 0.85,
    description: "Posts bill payment",
  },
  "accounting.lockPeriod": {
    risk: "critical",
    approvalRequired: true,
    minConfidence: 0.8,
    description: "Locks accounting period",
  },
  "accounting.unlockPeriod": {
    risk: "critical",
    approvalRequired: true,
    minConfidence: 0.85,
    description: "Unlocks accounting period",
  },
  "accounting.createRecurringTemplate": {
    risk: "high",
    approvalRequired: true,
    minConfidence: 0.72,
    description: "Creates recurring accounting automation",
  },
  "report.downloadPdf": {
    risk: "medium",
    approvalRequired: true,
    minConfidence: 0.65,
    description: "Exports report artifact",
  },
  "tax.recordTransaction": {
    risk: "high",
    approvalRequired: true,
    minConfidence: 0.7,
    description: "Creates tax-relevant record",
  },
  "tax.runComputation": {
    risk: "low",
    approvalRequired: false,
    minConfidence: 0.6,
    description: "Runs deterministic tax computation",
  },
  "tax.generateSchedule": {
    risk: "low",
    approvalRequired: false,
    minConfidence: 0.6,
    description: "Generates deterministic schedule",
  },
  "tax.listIssues": {
    risk: "read",
    approvalRequired: false,
    minConfidence: 0.45,
    description: "Reads tax issues",
  },
  "tax.applyClassificationRules": {
    risk: "high",
    approvalRequired: true,
    minConfidence: 0.74,
    description: "Applies tax classification changes",
  },
  "tax.generateFilingPack": {
    risk: "high",
    approvalRequired: true,
    minConfidence: 0.75,
    description: "Creates filing package",
  },
  "tax.reconcile": {
    risk: "medium",
    approvalRequired: true,
    minConfidence: 0.68,
    description: "Runs tax reconciliation workflow",
  },
  "wallet.sendMoney": {
    risk: "critical",
    approvalRequired: true,
    minConfidence: 0.9,
    description: "Moves money",
  },
  "wallet.fund": {
    risk: "critical",
    approvalRequired: true,
    minConfidence: 0.85,
    description: "Funds wallet",
  },
  "cashflow.analyze": {
    risk: "read",
    approvalRequired: false,
    minConfidence: 0.45,
    description: "Analyzes context data",
  },
  navigate: {
    risk: "navigation",
    approvalRequired: false,
    minConfidence: 0.5,
    description: "Navigates inside app",
  },
  "ui.operate": {
    risk: "high",
    approvalRequired: true,
    minConfidence: 0.72,
    description: "Operates UI controls",
  },
  "projections.updateAssumption": {
    risk: "medium",
    approvalRequired: true,
    minConfidence: 0.68,
    description: "Changes forecast assumptions",
  },
  "projections.resetAssumptions": {
    risk: "medium",
    approvalRequired: true,
    minConfidence: 0.68,
    description: "Resets forecast assumptions",
  },
};

function textPayload(action: UnifiedAgentAction, key: string): string {
  const value = action.payload?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function numberPayload(action: UnifiedAgentAction, key: string): number | null {
  const value = action.payload?.[key];
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/,/g, "")) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function validateRequiredPayload(action: UnifiedAgentAction): string[] {
  const errors: string[] = [];
  const amount = numberPayload(action, "amount");

  if (["accounting.postTransaction", "tax.recordTransaction"].includes(action.type)) {
    if (!textPayload(action, "description")) errors.push(`${action.type} requires description.`);
    if (amount === null || amount <= 0) errors.push(`${action.type} requires amount > 0.`);
  }

  if (["wallet.sendMoney", "wallet.fund"].includes(action.type)) {
    if (amount === null || amount <= 0) errors.push(`${action.type} requires amount > 0.`);
    if (action.type === "wallet.sendMoney" && !textPayload(action, "recipient")) {
      errors.push("wallet.sendMoney requires recipient.");
    }
  }

  if (
    [
      "accounting.submitBill",
      "accounting.approveBill",
      "accounting.payBill",
    ].includes(action.type) &&
    !textPayload(action, "billId")
  ) {
    errors.push(`${action.type} requires billId.`);
  }

  if (["accounting.lockPeriod", "accounting.unlockPeriod"].includes(action.type)) {
    const period = textPayload(action, "period");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      errors.push(`${action.type} requires period in YYYY-MM format.`);
    }
  }

  if (action.type === "navigate") {
    const route = textPayload(action, "route");
    if (!route.startsWith("/")) errors.push("navigate requires route starting with /.");
  }

  if (action.type === "ui.operate") {
    const steps = action.payload?.steps;
    if (!Array.isArray(steps) || steps.length === 0) errors.push("ui.operate requires non-empty steps.");
  }

  if (action.type === "projections.updateAssumption") {
    const updates = action.payload?.updates;
    if (!Array.isArray(updates) || updates.length === 0) errors.push("projections.updateAssumption requires updates.");
  }

  return errors;
}

export function getActionPolicy(actionType: UnifiedAgentActionType): ActionPolicy {
  return ACTION_POLICIES[actionType] || DEFAULT_POLICY;
}

export function evaluateActionPolicy(action: UnifiedAgentAction, options?: { approvalGranted?: boolean }): PolicyDecision {
  const schemaResult = validateUnifiedAction(action);
  if (!schemaResult.ok) {
    return {
      allowed: false,
      approvalRequired: false,
      reasons: [`Action schema rejected ${action.type}: ${schemaResult.error}`],
    };
  }

  const policy = getActionPolicy(action.type);
  const reasons = validateRequiredPayload(schemaResult.action);
  const confidence = typeof action.confidence === "number" && Number.isFinite(action.confidence) ? action.confidence : 0;

  if (confidence < policy.minConfidence) {
    reasons.push(`${action.type} confidence ${confidence.toFixed(2)} is below ${policy.minConfidence.toFixed(2)} threshold.`);
  }

  const approvalRequired = policy.approvalRequired && options?.approvalGranted !== true;
  if (approvalRequired) {
    reasons.push(`${action.type} requires human approval because it is ${policy.risk} risk: ${policy.description}.`);
  }

  return {
    allowed: reasons.length === 0,
    approvalRequired,
    reasons,
  };
}

export function evaluatePlanPolicies(
  actions: UnifiedAgentAction[],
  options?: { approvalGranted?: boolean }
): { executableActions: UnifiedAgentAction[]; approvalActions: UnifiedAgentAction[]; blockedActions: UnifiedAgentAction[]; reasons: string[] } {
  const executableActions: UnifiedAgentAction[] = [];
  const approvalActions: UnifiedAgentAction[] = [];
  const blockedActions: UnifiedAgentAction[] = [];
  const reasons: string[] = [];

  for (const action of actions) {
    const decision = evaluateActionPolicy(action, options);
    if (decision.reasons.length > 0) reasons.push(...decision.reasons);
    if (decision.allowed) {
      executableActions.push(action);
    } else if (
      decision.approvalRequired &&
      decision.reasons.every(
        (reason) => reason.includes("requires human approval") || reason.includes("confidence")
      )
    ) {
      approvalActions.push(action);
    } else {
      blockedActions.push(action);
    }
  }

  return { executableActions, approvalActions, blockedActions, reasons };
}
