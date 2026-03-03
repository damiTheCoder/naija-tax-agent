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

    const result = await accountingWorkflowService.executeBillPay({
      entityId,
      billId: id,
      date: typeof body.date === "string" ? body.date : undefined,
      amount: Number.isFinite(Number(body.amount)) ? Number(body.amount) : undefined,
      method: typeof body.method === "string" ? body.method : undefined,
      reference: typeof body.reference === "string" ? body.reference : undefined,
      bankAccountCode: typeof body.bankAccountCode === "string" ? body.bankAccountCode : undefined,
      bankAccountName: typeof body.bankAccountName === "string" ? body.bankAccountName : undefined,
      actor: auth.actor,
      actorRole: auth.actorRole,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error, "Failed to pay bill");
  }
}
