import { NextRequest, NextResponse } from "next/server";
import { TEMPORARY_ACCESS_COOKIE } from "@/lib/auth/temporaryAccess";
import { POCKETBASE_SESSION_COOKIE } from "@/lib/pocketbase/config";

function hasSessionCookie(request: NextRequest): boolean {
  return Boolean(request.cookies.get(POCKETBASE_SESSION_COOKIE)?.value);
}

function hasTemporaryAccessCookie(request: NextRequest): boolean {
  return request.cookies.get(TEMPORARY_ACCESS_COOKIE)?.value === "true";
}

const PROTECTED_APP_PREFIXES = [
  "/accounting",
  "/tax",
  "/budgeting",
  "/dashboard",
  "/profile",
  "/markets/profile",
];

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const isApiAdmin = pathname.startsWith("/api/admin");
  const isAdminPage = pathname.startsWith("/admin");
  const isProtectedAppPage = PROTECTED_APP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const hasSession = hasSessionCookie(request);
  const hasTemporaryAccess = hasTemporaryAccessCookie(request);

  if (isApiAdmin && !hasSession) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (isAdminPage && !hasSession) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/login";
    redirectUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(redirectUrl);
  }

  if (isProtectedAppPage && !hasSession && !hasTemporaryAccess) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/login";
    redirectUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/auth/login",
    "/accounting/:path*",
    "/tax/:path*",
    "/budgeting/:path*",
    "/dashboard",
    "/profile",
    "/markets/profile",
  ],
};
