import { NextRequest, NextResponse } from "next/server";
import { migrationRepo } from "@/lib/accounting/server";
import { badRequest, ensureMinimumRole, errorResponse, getEntityId } from "../_utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const auth = ensureMinimumRole(request, body, "owner");
    if (auth.forbiddenResponse) return auth.forbiddenResponse;

    const entityId = getEntityId(request, body.entityId);
    const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
    if (!clientId) {
      return badRequest("clientId is required");
    }

    const snapshot = body.snapshot && typeof body.snapshot === "object" ? (body.snapshot as Record<string, unknown>) : {};
    const result = await migrationRepo.importLocal(entityId, clientId, snapshot);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return errorResponse(error, "Failed to run local migration import");
  }
}
