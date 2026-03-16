import { NextRequest, NextResponse } from "next/server";
import { POCKETBASE_COMPLAINTS_COLLECTION } from "@/lib/pocketbase/config";
import { requireAdminSession, unauthorizedResponse } from "@/lib/pocketbase/auth";
import { createPocketBaseAdminClient } from "@/lib/pocketbase/adminClient";
import { escapeFilterValue, toPositiveInt } from "@/lib/pocketbase/filters";
import { hydrateUserExpansions } from "@/lib/pocketbase/userExpansions";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const page = toPositiveInt(searchParams.get("page"), 1, 500);
    const perPage = toPositiveInt(searchParams.get("perPage"), 20, 200);
    const query = searchParams.get("query")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
    const priority = searchParams.get("priority")?.trim() || "";

    const filters: string[] = [];
    if (query) {
      const q = escapeFilterValue(query);
      filters.push(`(subject ~ "${q}" || description ~ "${q}")`);
    }
    if (status) filters.push(`status = "${escapeFilterValue(status)}"`);
    if (priority) filters.push(`priority = "${escapeFilterValue(priority)}"`);

    const pb = await createPocketBaseAdminClient();
    const result = await pb.collection(POCKETBASE_COMPLAINTS_COLLECTION).getList(page, perPage, {
      filter: filters.join(" && "),
      sort: "-created",
      skipTotal: false,
      requestKey: null,
    });
    const items = await hydrateUserExpansions(pb, result.items, ["user", "assignee"]);

    return NextResponse.json({
      success: true,
      page: result.page,
      perPage: result.perPage,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list complaints";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
