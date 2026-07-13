import { NextRequest, NextResponse } from "next/server";
import PocketBase from "pocketbase";
import { getPocketBaseUrl, POCKETBASE_USER_COLLECTION } from "@/lib/pocketbase/config";
import { createPocketBaseAdminClient } from "@/lib/pocketbase/adminClient";
import { createSession, writeSessionCookie } from "@/lib/pocketbase/session";
import { normalizePocketBaseUser, type PocketBaseUserRecord } from "@/lib/pocketbase/users";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
      passwordConfirm?: string;
    };

    const name = body.name?.trim() || "";
    const email = body.email?.trim() || "";
    const password = body.password || "";
    const passwordConfirm = body.passwordConfirm || "";

    if (!name || !email || !password || !passwordConfirm) {
      return NextResponse.json(
        { success: false, error: "Name, email, password, and password confirmation are required." },
        { status: 400 },
      );
    }

    if (password !== passwordConfirm) {
      return NextResponse.json(
        { success: false, error: "Password confirmation does not match." },
        { status: 400 },
      );
    }

    const adminPb = await createPocketBaseAdminClient();
    await adminPb.collection(POCKETBASE_USER_COLLECTION).create({
      name,
      full_name: name,
      email,
      password,
      passwordConfirm,
      role: "user",
      platform_role: "user",
      status: "active",
      onboarding_completed: false,
      sessionVersion: 1,
      verified: true,
    });

    const pb = new PocketBase(getPocketBaseUrl());
    const authData = await pb.collection(POCKETBASE_USER_COLLECTION).authWithPassword(email, password);
    const user = normalizePocketBaseUser(authData.record as PocketBaseUserRecord);

    const response = NextResponse.json({
      success: true,
      user,
    });
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
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
