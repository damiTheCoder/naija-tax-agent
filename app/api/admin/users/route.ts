import { NextRequest, NextResponse } from "next/server";
import { POCKETBASE_USER_COLLECTION } from "@/lib/pocketbase/config";
import { requireAdminSession, unauthorizedResponse } from "@/lib/pocketbase/auth";
import { createPocketBaseAdminClient } from "@/lib/pocketbase/adminClient";
import { escapeFilterValue, toPositiveInt } from "@/lib/pocketbase/filters";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const page = toPositiveInt(searchParams.get("page"), 1, 500);
    const perPage = toPositiveInt(searchParams.get("perPage"), 20, 200);
    const query = searchParams.get("query")?.trim() || "";
    const role = searchParams.get("role")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";

    const filters: string[] = [];
    if (query) {
      const q = escapeFilterValue(query);
      filters.push(`(name ~ "${q}" || fullName ~ "${q}" || email ~ "${q}")`);
    }
    if (role) filters.push(`role = "${escapeFilterValue(role)}"`);
    if (status) filters.push(`status = "${escapeFilterValue(status)}"`);

    const pb = await createPocketBaseAdminClient();
    const result = await pb.collection(POCKETBASE_USER_COLLECTION).getList(page, perPage, {
      filter: filters.join(" && "),
      sort: "-created",
      skipTotal: false,
    });

    return NextResponse.json({
      success: true,
      page: result.page,
      perPage: result.perPage,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
      items: result.items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list users";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
