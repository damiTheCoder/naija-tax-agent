import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/pocketbase/auth";
import { createPocketBaseAdminClient } from "@/lib/pocketbase/adminClient";
import { POCKETBASE_COMPLAINTS_COLLECTION } from "@/lib/pocketbase/config";
import { escapeFilterValue, toPositiveInt } from "@/lib/pocketbase/filters";
import { hydrateUserExpansions } from "@/lib/pocketbase/userExpansions";

const ALLOWED_PRIORITY = new Set(["low", "medium", "high", "urgent"]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Please sign in before creating a complaint." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as {
      subject?: string;
      description?: string;
      category?: string;
      priority?: string;
    };

    const subject = body.subject?.trim() || "";
    const description = body.description?.trim() || "";
    if (!subject || !description) {
      return NextResponse.json(
        { success: false, error: "Subject and description are required." },
        { status: 400 },
      );
    }

    const priority = body.priority && ALLOWED_PRIORITY.has(body.priority) ? body.priority : "medium";
    const pb = await createPocketBaseAdminClient();
    const item = await pb.collection(POCKETBASE_COMPLAINTS_COLLECTION).create({
      user: session.userId,
      subject,
      description,
      category: body.category || "general",
      priority,
      status: "new",
      source: "in_app",
    });

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create complaint";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Please sign in first." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = toPositiveInt(searchParams.get("page"), 1, 500);
    const perPage = toPositiveInt(searchParams.get("perPage"), 20, 200);
    const status = searchParams.get("status")?.trim() || "";
    const query = searchParams.get("query")?.trim() || "";

    const filters: string[] = [`user = "${escapeFilterValue(session.userId)}"`];
    if (status) filters.push(`status = "${escapeFilterValue(status)}"`);
    if (query) {
      const q = escapeFilterValue(query);
      filters.push(`(subject ~ "${q}" || description ~ "${q}")`);
    }

    const pb = await createPocketBaseAdminClient();
    const result = await pb.collection(POCKETBASE_COMPLAINTS_COLLECTION).getList(page, perPage, {
      filter: filters.join(" && "),
      sort: "-created",
      skipTotal: false,
      requestKey: null,
    });
    const items = await hydrateUserExpansions(pb, result.items, ["assignee"]);

    return NextResponse.json({
      success: true,
      page: result.page,
      perPage: result.perPage,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load complaints";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
