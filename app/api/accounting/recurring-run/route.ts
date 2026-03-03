import { NextRequest, NextResponse } from "next/server";
import { recurringRepo } from "@/lib/accounting/server";
import { ensureMinimumRole, errorResponse, getEntityId } from "../_utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const auth = ensureMinimumRole(request, body, "manager");
    if (auth.forbiddenResponse) return auth.forbiddenResponse;

    const entityId = getEntityId(request, body.entityId);
    const runAt = typeof body.runAt === "string" ? body.runAt : undefined;
    const result = await recurringRepo.runDue(entityId, runAt);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return errorResponse(error, "Failed to run recurring generator");
  }
}
