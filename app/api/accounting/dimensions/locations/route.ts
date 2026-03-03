import { NextRequest, NextResponse } from "next/server";
import { dimensionRepo } from "@/lib/accounting/server";
import { badRequest, ensureMinimumRole, errorResponse, getEntityId } from "../../_utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const entityId = getEntityId(request);
    const locations = await dimensionRepo.listLocations(entityId);
    return NextResponse.json({ success: true, locations, count: locations.length });
  } catch (error) {
    return errorResponse(error, "Failed to fetch locations");
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const auth = ensureMinimumRole(request, body, "manager");
    if (auth.forbiddenResponse) return auth.forbiddenResponse;

    const entityId = getEntityId(request, body.entityId);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return badRequest("Location name is required");

    const location = await dimensionRepo.createLocation(entityId, {
      name,
      code: typeof body.code === "string" ? body.code : undefined,
    });

    return NextResponse.json({ success: true, location }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Failed to create location");
  }
}
