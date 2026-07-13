import { NextRequest, NextResponse } from "next/server";
import PocketBase from "pocketbase";
import { getPocketBaseUrl, POCKETBASE_USER_COLLECTION } from "@/lib/pocketbase/config";
import { createPocketBaseAdminClient } from "@/lib/pocketbase/adminClient";
import { createSession, writeSessionCookie } from "@/lib/pocketbase/session";
import { normalizePocketBaseUser, type PocketBaseUserRecord } from "@/lib/pocketbase/users";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { token } = (await request.json()) as { token?: string };
    if (!token) {
      return NextResponse.json({ success: false, error: "Token is required." }, { status: 400 });
    }

    const pb = new PocketBase(getPocketBaseUrl());
    pb.authStore.save(token);
    const refreshed = await pb.collection(POCKETBASE_USER_COLLECTION).authRefresh();
    let record = refreshed.record as PocketBaseUserRecord;

    if (!record.role || !record.status || !record.sessionVersion) {
      const adminPb = await createPocketBaseAdminClient();
      record = (await adminPb.collection(POCKETBASE_USER_COLLECTION).update(
        record.id,
        {
          role: record.role || "user",
          status: record.status || "active",
          sessionVersion: record.sessionVersion || 1,
        },
        { requestKey: null },
      )) as PocketBaseUserRecord;
    }

    const user = normalizePocketBaseUser(record);

    const response = NextResponse.json({ success: true, user });
    const session = createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      sessionVersion: user.sessionVersion,
    });
    return writeSessionCookie(response, session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth login failed";
    return NextResponse.json({ success: false, error: message }, { status: 401 });
  }
}
