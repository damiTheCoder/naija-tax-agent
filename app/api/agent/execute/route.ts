import { NextRequest, NextResponse } from "next/server";
import type { UnifiedAgentRequest } from "@/lib/agent/unifiedTypes";
import { AgentRuntime } from "@/lib/agent/runtime";

const runtime = new AgentRuntime();

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as UnifiedAgentRequest;
    const message = (body?.message || "").trim();

    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const response = await runtime.run({
      ...body,
      message,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Agent Execute] Orchestration error:", error);
    return NextResponse.json(
      {
        reply: "AI orchestration failed for this request. Please retry.",
        actions: [],
        confidence: 0,
        reasoning: error instanceof Error ? error.message : "Unknown orchestration error",
        planSource: "fallback",
      },
      { status: 200 }
    );
  }
}
