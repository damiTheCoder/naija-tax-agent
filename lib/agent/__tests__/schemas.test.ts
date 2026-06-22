import { describe, expect, it } from "vitest";
import { parsePlannerResponse, parseUnifiedAgentResponse } from "@/lib/agent/schemas";
import type { UnifiedAgentResponse } from "@/lib/agent/unifiedTypes";

describe("AI schema validation", () => {
  it("normalizes valid planner JSON and limits tool requests", () => {
    const parsed = parsePlannerResponse({
      reply: "I will open reports.",
      confidence: 0.9,
      reasoning: "Navigation request",
      toolRequests: Array.from({ length: 8 }, (_, index) => ({
        name: "navigate",
        arguments: { route: `/route-${index}` },
        reason: "User asked to navigate",
        confidence: 0.7,
      })),
    });

    expect(parsed.confidence).toBe(0.9);
    expect(parsed.toolRequests).toHaveLength(6);
  });

  it("falls back safely when planner output is malformed", () => {
    const parsed = parsePlannerResponse({
      reply: 123,
      confidence: 5,
      toolRequests: [{ arguments: "bad" }],
    });

    expect(parsed.toolRequests).toHaveLength(0);
    expect(parsed.confidence).toBe(0.4);
    expect(parsed.reasoning).toContain("schema validation");
  });

  it("rejects malformed remote agent response and preserves fallback", () => {
    const fallback: UnifiedAgentResponse = {
      reply: "Fallback reply",
      actions: [],
      confidence: 0.4,
      reasoning: "Fallback",
      planSource: "fallback",
    };

    const parsed = parseUnifiedAgentResponse(
      {
        reply: "Bad response",
        actions: [{ type: "unknown.action", payload: {} }],
      },
      fallback
    );

    expect(parsed.reply).toBe("Fallback reply");
    expect(parsed.actions).toHaveLength(0);
    expect(parsed.reasoning).toContain("schema validation");
  });
});
