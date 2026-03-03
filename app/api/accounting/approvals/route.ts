import { NextRequest, NextResponse } from "next/server";
import { approvalRequestRepo } from "@/lib/accounting/server";
import { errorResponse, getEntityId, parseLimit } from "../_utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = getEntityId(request);
    const status = searchParams.get("status") || undefined;
    const role = searchParams.get("role") || undefined;
    const assignee = searchParams.get("assignee") || undefined;
    const limit = parseLimit(searchParams.get("limit"), 100, 1, 500);

    const approvals = await approvalRequestRepo.list({
      entityId,
      status: status || undefined,
      requiredRole: role || undefined,
      assignee: assignee || undefined,
      limit,
    });

    return NextResponse.json({ success: true, approvals, count: approvals.length });
  } catch (error) {
    return errorResponse(error, "Failed to fetch approval queue");
  }
}
