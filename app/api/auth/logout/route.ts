import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/pocketbase/session";

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ success: true });
  return clearSessionCookie(response);
}
