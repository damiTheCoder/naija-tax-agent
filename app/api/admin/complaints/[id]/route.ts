import { NextRequest, NextResponse } from "next/server";
import {
  POCKETBASE_COMPLAINTS_COLLECTION,
  POCKETBASE_COMPLAINT_MESSAGES_COLLECTION,
} from "@/lib/pocketbase/config";
import { forbiddenResponse, requireAdminSession, unauthorizedResponse } from "@/lib/pocketbase/auth";
import { createPocketBaseAdminClient } from "@/lib/pocketbase/adminClient";
import { logAdminAuditFromSession } from "@/lib/pocketbase/audit";
import { hydrateUserExpansion, hydrateUserExpansions } from "@/lib/pocketbase/userExpansions";

const EDIT_ROLES = new Set(["super_admin", "support_admin", "support_agent"]);
const ALLOWED_STATUS = new Set([
  "new",
  "triaged",
  "investigating",
  "waiting_user",
  "resolved",
  "closed",
]);
const ALLOWED_PRIORITY = new Set(["low", "medium", "high", "urgent"]);

function canEdit(role: string): boolean {
  return EDIT_ROLES.has(role);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  try {
    const { id } = await params;
    const pb = await createPocketBaseAdminClient();
    const [complaintRecord, messagesResult] = await Promise.all([
      pb.collection(POCKETBASE_COMPLAINTS_COLLECTION).getOne(id, { requestKey: null }),
      pb.collection(POCKETBASE_COMPLAINT_MESSAGES_COLLECTION).getList(1, 100, {
        filter: `complaint = "${id}"`,
        sort: "created",
        requestKey: null,
      }),
    ]);
    const [complaint, messages] = await Promise.all([
      hydrateUserExpansion(pb, complaintRecord, ["user", "assignee"]),
      hydrateUserExpansions(pb, messagesResult.items, ["sender"]),
    ]);

    return NextResponse.json({
      success: true,
      item: complaint,
      messages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch complaint";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();
  if (!canEdit(session.role)) return forbiddenResponse("You cannot update complaints.");

  try {
    const { id } = await params;
    const body = (await request.json()) as {
      status?: string;
      priority?: string;
      assigneeId?: string;
      resolution?: string;
      internalNote?: string;
    };

    const patch: Record<string, unknown> = {
      updatedBy: session.userId,
    };

    if (body.status) {
      if (!ALLOWED_STATUS.has(body.status)) {
        return NextResponse.json({ success: false, error: "Invalid complaint status." }, { status: 400 });
      }
      patch.status = body.status;
      if (body.status === "resolved" || body.status === "closed") {
        patch.resolvedAt = new Date().toISOString();
      }
    }

    if (body.priority) {
      if (!ALLOWED_PRIORITY.has(body.priority)) {
        return NextResponse.json({ success: false, error: "Invalid complaint priority." }, { status: 400 });
      }
      patch.priority = body.priority;
    }

    if (body.assigneeId) patch.assignee = body.assigneeId;
    if (body.resolution) patch.resolution = body.resolution;

    const pb = await createPocketBaseAdminClient();
    const updated = await pb.collection(POCKETBASE_COMPLAINTS_COLLECTION).update(id, patch);

    if (body.internalNote && body.internalNote.trim()) {
      await pb.collection(POCKETBASE_COMPLAINT_MESSAGES_COLLECTION).create({
        complaint: id,
        sender: session.userId,
        message: body.internalNote,
        internalNote: true,
      });
    }

    await logAdminAuditFromSession(session, "complaint.update", "complaint", id, patch);

    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update complaint";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
