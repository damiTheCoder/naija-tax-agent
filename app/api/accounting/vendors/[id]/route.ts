import { NextRequest, NextResponse } from "next/server";
import { vendorRepo } from "@/lib/accounting/server";
import { badRequest, ensureMinimumRole, errorResponse, getEntityId, notFound } from "../../_utils";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const entityId = getEntityId(request);
    const vendor = await vendorRepo.get(entityId, id);
    return NextResponse.json({ success: true, vendor });
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) {
      return notFound(error.message);
    }
    return errorResponse(error, "Failed to fetch vendor");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const auth = ensureMinimumRole(request, body, "manager");
    if (auth.forbiddenResponse) return auth.forbiddenResponse;

    const entityId = getEntityId(request, body.entityId);

    const payload: Record<string, string> = {};
    if (typeof body.name === "string") payload.name = body.name;
    if (typeof body.type === "string") payload.type = body.type;
    if (typeof body.taxId === "string") payload.taxId = body.taxId;
    if (typeof body.email === "string") payload.email = body.email;
    if (typeof body.phone === "string") payload.phone = body.phone;
    if (typeof body.address === "string") payload.address = body.address;

    if (Object.keys(payload).length === 0) {
      return badRequest("No vendor fields provided for update");
    }

    const vendor = await vendorRepo.update(entityId, id, payload);
    return NextResponse.json({ success: true, vendor });
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) {
      return notFound(error.message);
    }
    return errorResponse(error, "Failed to update vendor");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const auth = ensureMinimumRole(request, undefined, "manager");
    if (auth.forbiddenResponse) return auth.forbiddenResponse;

    const { id } = await params;
    const entityId = getEntityId(request);
    const result = await vendorRepo.remove(entityId, id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) {
      return notFound(error.message);
    }
    return errorResponse(error, "Failed to delete vendor");
  }
}
