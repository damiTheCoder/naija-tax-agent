import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/pocketbase/auth";
import { createPocketBaseAdminClient } from "@/lib/pocketbase/adminClient";
import { isAdminRole, POCKETBASE_COMPLAINTS_COLLECTION } from "@/lib/pocketbase/config";
import { hydrateUserExpansion } from "@/lib/pocketbase/userExpansions";

type ComplaintRecord = {
  id: string;
  user?: string;
  status?: string;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Please sign in first." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const pb = await createPocketBaseAdminClient();
    const complaintRecord = (await pb.collection(POCKETBASE_COMPLAINTS_COLLECTION).getOne(id, {
      requestKey: null,
    })) as ComplaintRecord;
    const complaint = await hydrateUserExpansion(pb, complaintRecord, ["user", "assignee"]);

    if (!isAdminRole(session.role) && complaint.user !== session.userId) {
      return NextResponse.json({ success: false, error: "Not allowed." }, { status: 403 });
    }

    return NextResponse.json({ success: true, item: complaint });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load complaint";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Please sign in first." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as {
      status?: string;
      resolution?: string;
    };

    const pb = await createPocketBaseAdminClient();
    const complaint = (await pb.collection(POCKETBASE_COMPLAINTS_COLLECTION).getOne(id)) as ComplaintRecord;
    const isOwner = complaint.user === session.userId;
    if (!isOwner && !isAdminRole(session.role)) {
      return NextResponse.json({ success: false, error: "Not allowed." }, { status: 403 });
    }

    const patch: Record<string, unknown> = {};

    if (body.status) {
      const allowedStatuses = isOwner ? new Set(["closed"]) : new Set(["new", "triaged", "investigating", "waiting_user", "resolved", "closed"]);
      if (!allowedStatuses.has(body.status)) {
        return NextResponse.json({ success: false, error: "Invalid status update." }, { status: 400 });
      }
      patch.status = body.status;
      if (body.status === "closed") {
        patch.resolvedAt = new Date().toISOString();
      }
    }

    if (typeof body.resolution === "string" && body.resolution.trim()) {
      patch.resolution = body.resolution.trim();
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: false, error: "No updates supplied." }, { status: 400 });
    }

    const updated = await pb.collection(POCKETBASE_COMPLAINTS_COLLECTION).update(id, patch);
    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update complaint";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
