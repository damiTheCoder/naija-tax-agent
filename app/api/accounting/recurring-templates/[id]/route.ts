import { NextRequest, NextResponse } from "next/server";
import { recurringRepo } from "@/lib/accounting/server";
import { badRequest, ensureMinimumRole, errorResponse, getEntityId, notFound } from "../../_utils";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const entityId = getEntityId(request);
    const template = await recurringRepo.getTemplate(entityId, id);
    return NextResponse.json({ success: true, template });
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) return notFound(error.message);
    return errorResponse(error, "Failed to fetch recurring template");
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

    const patch: Record<string, unknown> = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (body.resourceType === "bill" || body.resourceType === "journal") patch.resourceType = body.resourceType;
    if (body.frequency === "monthly" || body.frequency === "quarterly") patch.frequency = body.frequency;
    if (typeof body.startDate === "string") patch.startDate = body.startDate;
    if (typeof body.endDate === "string") patch.endDate = body.endDate;
    if (typeof body.nextRunAt === "string") patch.nextRunAt = body.nextRunAt;
    if (body.payload && typeof body.payload === "object") patch.payload = body.payload;
    if (typeof body.createdBy === "string") patch.createdBy = body.createdBy;

    if (Object.keys(patch).length === 0) return badRequest("No template fields provided for update");

    const template = await recurringRepo.updateTemplate(entityId, id, patch);
    return NextResponse.json({ success: true, template });
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) return notFound(error.message);
    return errorResponse(error, "Failed to update recurring template");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const auth = ensureMinimumRole(request, undefined, "manager");
    if (auth.forbiddenResponse) return auth.forbiddenResponse;

    const entityId = getEntityId(request);
    const result = await recurringRepo.deleteTemplate(entityId, id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) return notFound(error.message);
    return errorResponse(error, "Failed to delete recurring template");
  }
}
