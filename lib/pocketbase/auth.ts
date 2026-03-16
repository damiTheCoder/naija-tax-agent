import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/pocketbase/config";
import { AppSession, getServerSession } from "@/lib/pocketbase/session";
import { createPocketBaseAdminClient } from "@/lib/pocketbase/adminClient";
import { POCKETBASE_USER_COLLECTION } from "@/lib/pocketbase/config";
import { normalizePocketBaseUser, type PocketBaseUserRecord } from "@/lib/pocketbase/users";

export async function requireSession(): Promise<AppSession | null> {
  const session = await getServerSession();
  if (!session) return null;

  try {
    const pb = await createPocketBaseAdminClient();
    const record = (await pb.collection(POCKETBASE_USER_COLLECTION).getOne(session.userId, {
      requestKey: null,
    })) as PocketBaseUserRecord;
    const user = normalizePocketBaseUser(record);

    if (user.status.toLowerCase() !== "active") {
      return null;
    }

    if (user.sessionVersion !== session.sessionVersion) {
      return null;
    }

    return {
      ...session,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      sessionVersion: user.sessionVersion,
    };
  } catch {
    return null;
  }
}

export async function requireAdminSession(): Promise<AppSession | null> {
  const session = await requireSession();
  if (!session) return null;
  if (!isAdminRole(session.role)) return null;
  if (session.status.toLowerCase() === "suspended") return null;
  return session;
}

export function unauthorizedResponse(message = "Unauthorized"): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 401 });
}

export function forbiddenResponse(message = "Forbidden"): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 403 });
}
