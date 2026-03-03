import { NextRequest, NextResponse } from "next/server";
import { accountingWorkflowService } from "@/lib/accounting/server";
import { ensureMinimumRole, errorResponse, getEntityId } from "../../../_utils";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const auth = ensureMinimumRole(request, body, "manager");
    if (auth.forbiddenResponse) return auth.forbiddenResponse;

    const entityId = getEntityId(request, body.entityId);

    const result = await accountingWorkflowService.executeBillApprove({
      entityId,
      billId: id,
      actor: auth.actor,
      actorRole: auth.actorRole,
      decisionNote: typeof body.decisionNote === "string" ? body.decisionNote : undefined,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error, "Failed to approve bill");
  }
}
