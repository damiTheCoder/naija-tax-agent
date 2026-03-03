import { NextRequest, NextResponse } from "next/server";
import { accountingWorkflowService } from "@/lib/accounting/server";
import { getActorContext, errorResponse, getEntityId } from "../../../_utils";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const actor = getActorContext(request, body);
    const entityId = getEntityId(request, body.entityId);

    const result = await accountingWorkflowService.executeBillSubmit({
      entityId,
      billId: id,
      actor: actor.actor,
      actorRole: actor.actorRole,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error, "Failed to submit bill");
  }
}
