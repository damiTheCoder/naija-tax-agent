import { NextRequest, NextResponse } from "next/server";
import { billRepo } from "@/lib/accounting/server";
import { badRequest, ensureMinimumRole, errorResponse, getActorContext, getEntityId, notFound } from "../../_utils";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const entityId = getEntityId(request);
    const bill = await billRepo.get(entityId, id);
    return NextResponse.json({ success: true, bill });
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) {
      return notFound(error.message);
    }
    return errorResponse(error, "Failed to fetch bill");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const entityId = getEntityId(request, body.entityId);

    const patch: Record<string, unknown> = {};
    if (typeof body.billNo === "string") patch.billNo = body.billNo;
    if (typeof body.vendorId === "string") patch.vendorId = body.vendorId;
    if (typeof body.date === "string") patch.date = body.date;
    if (typeof body.dueDate === "string") patch.dueDate = body.dueDate;
    if (typeof body.currency === "string") patch.currency = body.currency;
    if (typeof body.notes === "string") patch.notes = body.notes;
    if (Array.isArray(body.lines)) patch.lines = body.lines;
    if (typeof body.trackingClassId === "string") patch.trackingClassId = body.trackingClassId;
    if (typeof body.trackingLocationId === "string") patch.trackingLocationId = body.trackingLocationId;

    if (Object.keys(patch).length === 0) {
      return badRequest("No bill fields provided for update");
    }

    const bill = await billRepo.updateDraft(entityId, id, patch);
    return NextResponse.json({ success: true, bill });
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) {
      return notFound(error.message);
    }
    return errorResponse(error, "Failed to update bill");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const auth = ensureMinimumRole(
      request,
      {
        actorRole: searchParams.get("actorRole") || undefined,
        actor: searchParams.get("actor") || undefined,
      },
      "manager"
    );
    if (auth.forbiddenResponse) return auth.forbiddenResponse;

    const { id } = await params;
    const entityId = getEntityId(request);
    const actor = searchParams.get("actor") || getActorContext(request).actor;
    const reason = searchParams.get("reason") || undefined;
    const result = await billRepo.void(entityId, id, actor || undefined, reason || undefined);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) {
      return notFound(error.message);
    }
    return errorResponse(error, "Failed to delete bill");
  }
}
