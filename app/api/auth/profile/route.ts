import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/pocketbase/auth";
import { createPocketBaseAdminClient } from "@/lib/pocketbase/adminClient";
import { POCKETBASE_USER_COLLECTION } from "@/lib/pocketbase/config";
import { createSession, writeSessionCookie } from "@/lib/pocketbase/session";
import { normalizePocketBaseUser, type PocketBaseUserRecord } from "@/lib/pocketbase/users";
import { createBusinessWithDefaults } from "@/lib/pocketbase/businessProvisioning";
import { escapeFilterValue } from "@/lib/pocketbase/filters";

type ProfilePayload = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
};

function toProfile(record: PocketBaseUserRecord) {
  return {
    id: record.id,
    name: String(record.name || record.full_name || record.fullName || ""),
    email: String(record.email || ""),
    phone: String(record.phone || ""),
    company: String(record.organization || record.company || ""),
    role: String(record.role || "user"),
    status: String(record.status || "active"),
  };
}

export async function GET(): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const pb = await createPocketBaseAdminClient();
  const record = (await pb.collection(POCKETBASE_USER_COLLECTION).getOne(session.userId, {
    requestKey: null,
  })) as PocketBaseUserRecord;

  return NextResponse.json({ success: true, profile: toProfile(record) });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as ProfilePayload;
  const name = body.name?.trim() || "";
  const phone = body.phone?.trim() || "";
  const company = body.company?.trim() || "";

  if (!name) {
    return NextResponse.json({ success: false, error: "Name is required." }, { status: 400 });
  }

  const pb = await createPocketBaseAdminClient();
  const updated = (await pb.collection(POCKETBASE_USER_COLLECTION).update(
    session.userId,
    {
      name,
      full_name: name,
      phone,
      organization: company,
      onboarding_completed: true,
    },
    { requestKey: null },
  )) as PocketBaseUserRecord;

  if (company) {
    const ownedBusinesses = (await pb.collection("businesses").getFullList({
      filter: `owner="${escapeFilterValue(session.userId)}"`,
      sort: "created",
      requestKey: null,
    })) as Array<{ id: string; [key: string]: unknown }>;

    const existingBusiness = ownedBusinesses[0];
    if (existingBusiness) {
      await pb.collection("businesses").update(
        existingBusiness.id,
        {
          legal_name: company,
          trading_name: company,
          onboarding_status: "in_progress",
        },
        { requestKey: null },
      );
    } else {
      await createBusinessWithDefaults(pb, session, {
        legalName: company,
        tradingName: company,
      });
    }
  }

  const user = normalizePocketBaseUser(updated);
  const response = NextResponse.json({ success: true, profile: toProfile(updated), user });
  return writeSessionCookie(
    response,
    createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      sessionVersion: user.sessionVersion,
    }),
  );
}
