import { NextResponse } from "next/server";
import { TEMPORARY_ACCESS_COOKIE, TEMPORARY_ACCESS_TTL_SECONDS } from "@/lib/auth/temporaryAccess";

function setTemporaryAccessCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: TEMPORARY_ACCESS_COOKIE,
    value: "true",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TEMPORARY_ACCESS_TTL_SECONDS,
  });
  return response;
}

function clearTemporaryAccessCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: TEMPORARY_ACCESS_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function POST(): Promise<NextResponse> {
  return setTemporaryAccessCookie(NextResponse.json({ success: true }));
}

export async function DELETE(): Promise<NextResponse> {
  return clearTemporaryAccessCookie(NextResponse.json({ success: true }));
}
