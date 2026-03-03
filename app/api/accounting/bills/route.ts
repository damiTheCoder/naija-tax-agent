import { NextRequest, NextResponse } from "next/server";
import { accountingWorkflowService, billRepo } from "@/lib/accounting/server";
import { badRequest, errorResponse, getEntityId } from "../_utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = getEntityId(request);
    const status = searchParams.get("status") || undefined;
    const bills = await billRepo.list(entityId, status || undefined);
    return NextResponse.json({ success: true, bills, count: bills.length });
  } catch (error) {
    return errorResponse(error, "Failed to fetch bills");
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const entityId = getEntityId(request, body.entityId);

    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      return badRequest("Bill lines are required");
    }

    const { bill, receipt } = await accountingWorkflowService.executeBillDraft({
      entityId,
      billNo: typeof body.billNo === "string" ? body.billNo : undefined,
      vendorId: typeof body.vendorId === "string" ? body.vendorId : undefined,
      vendorName: typeof body.vendorName === "string" ? body.vendorName : undefined,
      date: typeof body.date === "string" ? body.date : new Date().toISOString().slice(0, 10),
      dueDate: typeof body.dueDate === "string" ? body.dueDate : undefined,
      currency: typeof body.currency === "string" ? body.currency : "NGN",
      lines: body.lines.map((line) => {
        const row = (line || {}) as Record<string, unknown>;
        return {
          description: typeof row.description === "string" ? row.description : "Bill line",
          quantity: Number(row.quantity) || 1,
          unitPrice: Number(row.unitPrice) || 0,
          taxRate: Number.isFinite(Number(row.taxRate)) ? Number(row.taxRate) : undefined,
          taxAmount: Number.isFinite(Number(row.taxAmount)) ? Number(row.taxAmount) : undefined,
          total: Number.isFinite(Number(row.total)) ? Number(row.total) : undefined,
          metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : undefined,
          trackingClassId: typeof row.trackingClassId === "string" ? row.trackingClassId : undefined,
          trackingLocationId: typeof row.trackingLocationId === "string" ? row.trackingLocationId : undefined,
        };
      }),
      notes: typeof body.notes === "string" ? body.notes : undefined,
      trackingClassId: typeof body.trackingClassId === "string" ? body.trackingClassId : undefined,
      trackingLocationId: typeof body.trackingLocationId === "string" ? body.trackingLocationId : undefined,
    });

    return NextResponse.json({ success: true, bill, receipt }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Failed to create bill draft");
  }
}
