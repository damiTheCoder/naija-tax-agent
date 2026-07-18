import { NextRequest, NextResponse } from "next/server";
import { POCKETBASE_SESSION_COOKIE } from "@/lib/pocketbase/config";

function hasSessionCookie(request: NextRequest): boolean {
  return Boolean(request.cookies.get(POCKETBASE_SESSION_COOKIE)?.value);
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const isApiAdmin = pathname.startsWith("/api/admin");
  const isAdminPage = pathname.startsWith("/admin");
  const hasSession = hasSessionCookie(request);

  if (isApiAdmin && !hasSession) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (isAdminPage && !hasSession) {
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
