import { NextRequest, NextResponse } from "next/server";
import PocketBase from "pocketbase";
import { getPocketBaseUrl, POCKETBASE_USER_COLLECTION } from "@/lib/pocketbase/config";
import { createSession, writeSessionCookie } from "@/lib/pocketbase/session";
import { normalizePocketBaseUser, type PocketBaseUserRecord } from "@/lib/pocketbase/users";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { email, password } = (await request.json()) as { email?: string; password?: string };
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 },
      );
    }

    const pb = new PocketBase(getPocketBaseUrl());
    const authResponse = await pb.collection(POCKETBASE_USER_COLLECTION).authWithPassword(email, password);
    const user = normalizePocketBaseUser(authResponse.record as PocketBaseUserRecord);

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
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ success: false, error: message }, { status: 401 });
  }
}
