import { NextRequest, NextResponse } from "next/server";
import { POCKETBASE_USAGE_EVENTS_COLLECTION } from "@/lib/pocketbase/config";
import { requireAdminSession, unauthorizedResponse } from "@/lib/pocketbase/auth";
import { createPocketBaseAdminClient } from "@/lib/pocketbase/adminClient";
import { escapeFilterValue, toPositiveInt } from "@/lib/pocketbase/filters";
import { hydrateUserExpansions } from "@/lib/pocketbase/userExpansions";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const page = toPositiveInt(searchParams.get("page"), 1, 1000);
    const perPage = toPositiveInt(searchParams.get("perPage"), 50, 200);
    const eventType = searchParams.get("eventType")?.trim() || "";
    const moduleName = searchParams.get("module")?.trim() || "";
    const query = searchParams.get("query")?.trim() || "";

    const filters: string[] = [];
    if (eventType) filters.push(`eventType = "${escapeFilterValue(eventType)}"`);
    if (moduleName) filters.push(`module = "${escapeFilterValue(moduleName)}"`);
    if (query) {
      const q = escapeFilterValue(query);
      filters.push(`(path ~ "${q}" || ipAddress ~ "${q}" || userAgent ~ "${q}")`);
    }

    const pb = await createPocketBaseAdminClient();
    const result = await pb.collection(POCKETBASE_USAGE_EVENTS_COLLECTION).getList(page, perPage, {
      filter: filters.join(" && "),
      sort: "-created",
      skipTotal: false,
      requestKey: null,
    });
    const items = await hydrateUserExpansions(pb, result.items, ["user"]);

    return NextResponse.json({
      success: true,
      page: result.page,
      perPage: result.perPage,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list usage events";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
