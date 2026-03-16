import { NextResponse } from "next/server";
import { requireSession } from "@/lib/pocketbase/auth";
import { clearSessionCookie } from "@/lib/pocketbase/session";

export async function GET(): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) {
    const response = NextResponse.json({ success: false, authenticated: false }, { status: 401 });
    return clearSessionCookie(response);
  }
  return NextResponse.json({ success: true, authenticated: true, session });
}
