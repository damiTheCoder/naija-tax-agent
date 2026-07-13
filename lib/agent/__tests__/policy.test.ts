import { describe, expect, it } from "vitest";
import { evaluateActionPolicy, evaluatePlanPolicies } from "@/lib/agent/policy";
import type { UnifiedAgentAction } from "@/lib/agent/unifiedTypes";

describe("AI action policy", () => {
  it("allows normal accounting postings without approval when payload validation passes", () => {
    const action: UnifiedAgentAction = {
      type: "accounting.postTransaction",
      confidence: 0.67,
      reason: "User asked to post rent",
      payload: {
        description: "Post rent of NGN 500000",
        amount: 500000,
      },
    };

    const decision = evaluateActionPolicy(action);

    expect(decision.allowed).toBe(true);
    expect(decision.approvalRequired).toBe(false);
    expect(decision.reasons).toHaveLength(0);
  });

  it("blocks invalid accounting postings instead of letting them run freely", () => {
    const action: UnifiedAgentAction = {
      type: "accounting.postTransaction",
      confidence: 0.82,
      reason: "User asked to post rent",
      payload: {
        description: "Post rent of NGN 500000",
      },
    };

    const decision = evaluateActionPolicy(action);

    expect(decision.allowed).toBe(false);
    expect(decision.approvalRequired).toBe(false);
    expect(decision.reasons.join(" ")).toContain("amount");
  });

  it("blocks invalid payment payloads instead of putting them in approval", () => {
    const action: UnifiedAgentAction = {
      type: "wallet.sendMoney",
      confidence: 0.95,
      reason: "User requested payment",
      payload: {
        amount: 1000,
      },
    };

    const plan = evaluatePlanPolicies([action]);

    expect(plan.blockedActions).toHaveLength(1);
    expect(plan.approvalActions).toHaveLength(0);
    expect(plan.reasons.join(" ")).toContain("recipient");
  });

  it("allows read-only cashflow analysis without approval", () => {
    const action: UnifiedAgentAction = {
      type: "cashflow.analyze",
      confidence: 0.62,
      reason: "User asked for runway",
      payload: {
        focus: "runway",
      },
    };

    const plan = evaluatePlanPolicies([action]);

    expect(plan.executableActions).toHaveLength(1);
    expect(plan.approvalActions).toHaveLength(0);
    expect(plan.blockedActions).toHaveLength(0);
  });
});
