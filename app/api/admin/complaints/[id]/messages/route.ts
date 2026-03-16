import { NextRequest, NextResponse } from "next/server";
import { forbiddenResponse, requireAdminSession, unauthorizedResponse } from "@/lib/pocketbase/auth";
import { createPocketBaseAdminClient } from "@/lib/pocketbase/adminClient";
import { POCKETBASE_COMPLAINT_MESSAGES_COLLECTION } from "@/lib/pocketbase/config";
import { logAdminAuditFromSession } from "@/lib/pocketbase/audit";
import { hydrateUserExpansions } from "@/lib/pocketbase/userExpansions";

const MESSAGE_EDIT_ROLES = new Set(["super_admin", "support_admin", "support_agent"]);

function canWriteMessages(role: string): boolean {
  return MESSAGE_EDIT_ROLES.has(role);
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
    const result = await pb.collection(POCKETBASE_COMPLAINT_MESSAGES_COLLECTION).getList(1, 100, {
      filter: `complaint = "${id}"`,
      sort: "created",
      requestKey: null,
    });
    const items = await hydrateUserExpansions(pb, result.items, ["sender"]);
    return NextResponse.json({ success: true, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load complaint messages";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();
  if (!canWriteMessages(session.role)) return forbiddenResponse("You cannot add complaint messages.");

  try {
    const { id } = await params;
    const body = (await request.json()) as { message?: string; internalNote?: boolean };
    const message = body.message?.trim() || "";
    if (!message) {
      return NextResponse.json({ success: false, error: "Message is required." }, { status: 400 });
    }

    const pb = await createPocketBaseAdminClient();
    const item = await pb.collection(POCKETBASE_COMPLAINT_MESSAGES_COLLECTION).create({
      complaint: id,
      sender: session.userId,
      message,
      internalNote: body.internalNote === true,
    });

    await logAdminAuditFromSession(session, "complaint.message.create", "complaint", id, {
      internalNote: body.internalNote === true,
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add complaint message";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
