import { NextResponse } from "next/server";
import {
  POCKETBASE_COMPLAINTS_COLLECTION,
  POCKETBASE_USAGE_EVENTS_COLLECTION,
  POCKETBASE_USER_COLLECTION,
} from "@/lib/pocketbase/config";
import { requireAdminSession, unauthorizedResponse } from "@/lib/pocketbase/auth";
import { createPocketBaseAdminClient } from "@/lib/pocketbase/adminClient";
import { hydrateUserExpansions } from "@/lib/pocketbase/userExpansions";

async function countByFilter(
  pb: Awaited<ReturnType<typeof createPocketBaseAdminClient>>,
  collection: string,
  filter?: string,
): Promise<number> {
  const list = await pb.collection(collection).getList(1, 1, {
    filter,
    skipTotal: false,
    requestKey: null,
  });
  return list.totalItems;
}

export async function GET(): Promise<NextResponse> {
  const session = await requireAdminSession();
  if (!session) return unauthorizedResponse();

  try {
    const pb = await createPocketBaseAdminClient();

    const [
      usersTotal,
      activeUsers,
      complaintsTotal,
      openComplaints,
      resolvedComplaints,
      eventsToday,
      recentComplaintList,
    ] = await Promise.all([
      countByFilter(pb, POCKETBASE_USER_COLLECTION),
      countByFilter(pb, POCKETBASE_USER_COLLECTION, 'status = "active"'),
      countByFilter(pb, POCKETBASE_COMPLAINTS_COLLECTION),
      countByFilter(
        pb,
        POCKETBASE_COMPLAINTS_COLLECTION,
        'status != "resolved" && status != "closed"',
      ),
      countByFilter(pb, POCKETBASE_COMPLAINTS_COLLECTION, 'status = "resolved" || status = "closed"'),
      countByFilter(
        pb,
        POCKETBASE_USAGE_EVENTS_COLLECTION,
        `created >= "${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}"`,
      ),
      pb.collection(POCKETBASE_COMPLAINTS_COLLECTION).getList(1, 8, {
        sort: "-created",
        requestKey: null,
      }),
    ]);
    const recentComplaints = await hydrateUserExpansions(pb, recentComplaintList.items, ["user", "assignee"]);

    return NextResponse.json({
      success: true,
      metrics: {
        usersTotal,
        activeUsers,
        complaintsTotal,
        openComplaints,
        resolvedComplaints,
        eventsToday,
      },
      recentComplaints,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load admin overview";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
