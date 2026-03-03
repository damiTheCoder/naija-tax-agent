import { NextRequest, NextResponse } from "next/server";
import { approvalPolicyRepo } from "@/lib/accounting/server";
import { ensureMinimumRole, errorResponse, getEntityId } from "../_utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const entityId = getEntityId(request);
    const policy = await approvalPolicyRepo.get(entityId);
    return NextResponse.json({ success: true, policy });
  } catch (error) {
    return errorResponse(error, "Failed to load approval policy");
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const auth = ensureMinimumRole(request, body, "owner");
    if (auth.forbiddenResponse) return auth.forbiddenResponse;

    const entityId = getEntityId(request, body.entityId);
    const policy = await approvalPolicyRepo.save(entityId, {
      managerThreshold: Number.isFinite(Number(body.managerThreshold)) ? Number(body.managerThreshold) : undefined,
      ownerThreshold: Number.isFinite(Number(body.ownerThreshold)) ? Number(body.ownerThreshold) : undefined,
      currency: typeof body.currency === "string" ? body.currency : undefined,
      metadata: body.metadata && typeof body.metadata === "object" ? (body.metadata as Record<string, unknown>) : undefined,
    });

    return NextResponse.json({ success: true, policy });
  } catch (error) {
    return errorResponse(error, "Failed to save approval policy");
  }
}
