import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/pocketbase/auth";
import { createPocketBaseAdminClient } from "@/lib/pocketbase/adminClient";
import {
  isAdminRole,
  POCKETBASE_COMPLAINT_MESSAGES_COLLECTION,
  POCKETBASE_COMPLAINTS_COLLECTION,
} from "@/lib/pocketbase/config";
import { hydrateUserExpansions } from "@/lib/pocketbase/userExpansions";

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
    const complaint = (await pb.collection(POCKETBASE_COMPLAINTS_COLLECTION).getOne(id)) as ComplaintRecord;
    if (!isAdminRole(session.role) && complaint.user !== session.userId) {
      return NextResponse.json({ success: false, error: "Not allowed." }, { status: 403 });
    }

    const messages = await pb.collection(POCKETBASE_COMPLAINT_MESSAGES_COLLECTION).getList(1, 200, {
      filter: `complaint = "${id}"`,
      sort: "created",
      requestKey: null,
    });

    const hydrated = await hydrateUserExpansions(pb, messages.items, ["sender"]);
    const normalized = hydrated.filter((item) =>
      isAdminRole(session.role) ? true : item.internalNote !== true,
    );

    return NextResponse.json({ success: true, items: normalized });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load complaint messages";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Please sign in first." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { message } = (await request.json()) as { message?: string };
    const text = message?.trim() || "";
    if (!text) {
      return NextResponse.json({ success: false, error: "Message is required." }, { status: 400 });
    }

    const pb = await createPocketBaseAdminClient();
    const complaint = (await pb.collection(POCKETBASE_COMPLAINTS_COLLECTION).getOne(id)) as ComplaintRecord;
    if (!isAdminRole(session.role) && complaint.user !== session.userId) {
      return NextResponse.json({ success: false, error: "Not allowed." }, { status: 403 });
    }

    const created = await pb.collection(POCKETBASE_COMPLAINT_MESSAGES_COLLECTION).create({
      complaint: id,
      sender: session.userId,
      message: text,
      internalNote: false,
    });

    if (!isAdminRole(session.role) && (complaint.status === "resolved" || complaint.status === "closed")) {
      await pb.collection(POCKETBASE_COMPLAINTS_COLLECTION).update(id, {
        status: "triaged",
        resolvedAt: null,
      });
    }

    return NextResponse.json({ success: true, item: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create complaint message";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
