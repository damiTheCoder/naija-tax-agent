import { NextRequest, NextResponse } from "next/server";
import { accountingWorkflowService, recurringRepo } from "@/lib/accounting/server";
import { badRequest, ensureMinimumRole, errorResponse, getEntityId } from "../_utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const entityId = getEntityId(request);
    const templates = await recurringRepo.listTemplates(entityId);
    return NextResponse.json({ success: true, templates, count: templates.length });
  } catch (error) {
    return errorResponse(error, "Failed to fetch recurring templates");
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const auth = ensureMinimumRole(request, body, "manager");
    if (auth.forbiddenResponse) return auth.forbiddenResponse;

    const entityId = getEntityId(request, body.entityId);

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return badRequest("Template name is required");

    const payload = body.payload && typeof body.payload === "object" ? (body.payload as Record<string, unknown>) : {};
    const resourceType = body.resourceType === "bill" ? "bill" : "journal";
    const frequency = body.frequency === "quarterly" ? "quarterly" : "monthly";
    const startDate = typeof body.startDate === "string" ? body.startDate : new Date().toISOString().slice(0, 10);

    const result = await accountingWorkflowService.executeCreateRecurringTemplate({
      entityId,
      name,
      resourceType,
      frequency,
      startDate,
      endDate: typeof body.endDate === "string" ? body.endDate : undefined,
      nextRunAt: typeof body.nextRunAt === "string" ? body.nextRunAt : undefined,
      payload,
      createdBy: typeof body.createdBy === "string" ? body.createdBy : auth.actor,
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Failed to create recurring template");
  }
}
