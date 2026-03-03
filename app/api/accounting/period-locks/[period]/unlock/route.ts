import { NextRequest, NextResponse } from "next/server";
import { accountingWorkflowService } from "@/lib/accounting/server";
import { ensureMinimumRole, errorResponse, getEntityId } from "../../../_utils";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ period: string }> }
): Promise<NextResponse> {
  try {
    const { period } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const auth = ensureMinimumRole(request, body, "owner");
    if (auth.forbiddenResponse) return auth.forbiddenResponse;

    const entityId = getEntityId(request, body.entityId);

    const result = await accountingWorkflowService.executePeriodUnlock({
      entityId,
      period,
      actor: auth.actor,
      actorRole: auth.actorRole,
      reason: typeof body.reason === "string" ? body.reason : undefined,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error, "Failed to unlock period");
  }
}
