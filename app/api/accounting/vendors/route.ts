import { NextRequest, NextResponse } from "next/server";
import { vendorRepo } from "@/lib/accounting/server";
import { badRequest, ensureMinimumRole, errorResponse, getEntityId } from "../_utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = getEntityId(request);
    const search = searchParams.get("search") || undefined;
    const vendors = await vendorRepo.list(entityId, search || undefined);
    return NextResponse.json({ success: true, vendors, count: vendors.length });
  } catch (error) {
    return errorResponse(error, "Failed to fetch vendors");
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const auth = ensureMinimumRole(request, body, "manager");
    if (auth.forbiddenResponse) return auth.forbiddenResponse;

    const entityId = getEntityId(request, body.entityId);
    const name = String(body.name || "").trim();
    if (!name) {
      return badRequest("Vendor name is required");
    }

    const vendor = await vendorRepo.create(entityId, {
      name,
      type: typeof body.type === "string" ? body.type : undefined,
      taxId: typeof body.taxId === "string" ? body.taxId : undefined,
      email: typeof body.email === "string" ? body.email : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      address: typeof body.address === "string" ? body.address : undefined,
    });

    return NextResponse.json({ success: true, vendor }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Failed to create vendor");
  }
}
