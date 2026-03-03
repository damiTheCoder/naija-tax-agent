import { NextRequest, NextResponse } from "next/server";
import { accountingWorkflowService, periodLockRepo } from "@/lib/accounting/server";
import { badRequest, ensureMinimumRole, errorResponse, getEntityId } from "../_utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const entityId = getEntityId(request);
    const locks = await periodLockRepo.list(entityId);
    return NextResponse.json({ success: true, locks, count: locks.length });
  } catch (error) {
    return errorResponse(error, "Failed to fetch period locks");
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const auth = ensureMinimumRole(request, body, "manager");
    if (auth.forbiddenResponse) return auth.forbiddenResponse;

    const entityId = getEntityId(request, body.entityId);
    const period = typeof body.period === "string" ? body.period.trim() : "";
    if (!period) {
      return badRequest("period is required");
    }

    const reason = typeof body.reason === "string" ? body.reason : undefined;

    const result = await accountingWorkflowService.executePeriodLock({
      entityId,
      period,
      actor: auth.actor,
      actorRole: auth.actorRole,
      reason,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error, "Failed to lock period");
  }
}
