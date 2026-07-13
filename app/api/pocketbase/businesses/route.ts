import { NextRequest, NextResponse } from "next/server";
import { createPocketBaseAdminClient } from "@/lib/pocketbase/adminClient";
import { requireSession, unauthorizedResponse } from "@/lib/pocketbase/auth";
import { escapeFilterValue } from "@/lib/pocketbase/filters";
import {
  createBusinessWithDefaults,
  type CreateBusinessInput,
} from "@/lib/pocketbase/businessProvisioning";

export const runtime = "nodejs";

type PocketBaseRecord = {
  id: string;
  [key: string]: unknown;
};

export async function GET(): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  try {
    const pb = await createPocketBaseAdminClient();
    const escapedUserId = escapeFilterValue(session.userId);
    const owned = (await pb.collection("businesses").getFullList({
      filter: `owner="${escapedUserId}"`,
      sort: "-created",
      requestKey: null,
    })) as PocketBaseRecord[];

    const memberships = (await pb.collection("business_members").getFullList({
      filter: `user="${escapedUserId}" && status="active"`,
      sort: "-created",
      requestKey: null,
    })) as PocketBaseRecord[];

    const ownedById = new Map(owned.map((business) => [business.id, business]));
    const memberBusinessIds = memberships
      .map((membership) => (typeof membership.business === "string" ? membership.business : ""))
      .filter((businessId) => businessId && !ownedById.has(businessId));

    const memberBusinesses = await Promise.all(
      memberBusinessIds.map(async (businessId) => {
        return (await pb.collection("businesses").getOne(businessId, {
          requestKey: null,
        })) as PocketBaseRecord;
      }),
    );

    return NextResponse.json({
      success: true,
      items: [...owned, ...memberBusinesses],
      memberships,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load businesses.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  try {
    const body = (await request.json()) as CreateBusinessInput;
    const pb = await createPocketBaseAdminClient();
    const result = await createBusinessWithDefaults(pb, session, body);

    return NextResponse.json({
      success: true,
      item: result.business,
      membership: result.membership,
      accounts: result.accounts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create business.";
    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes("required") ? 400 : 500 },
    );
  }
}
