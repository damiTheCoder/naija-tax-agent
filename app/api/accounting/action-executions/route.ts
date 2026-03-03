import { NextRequest, NextResponse } from "next/server";
import { actionExecutionRepo } from "@/lib/accounting/server";
import { errorResponse, getEntityId, parseLimit } from "../_utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = getEntityId(request);
    const limit = parseLimit(searchParams.get("limit"), 50, 1, 200);
    const actions = await actionExecutionRepo.list(entityId, limit);
    return NextResponse.json({ success: true, actions, count: actions.length });
  } catch (error) {
    return errorResponse(error, "Failed to fetch action execution logs");
  }
}
