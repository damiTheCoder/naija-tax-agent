import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { POCKETBASE_SESSION_COOKIE, getSessionSecret } from "@/lib/pocketbase/config";

export type AppSession = {
  userId: string;
  email: string;
  name: string;
  role: string;
  status: string;
  sessionVersion: number;
  iat: number;
  exp: number;
};

type SessionUser = {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  status?: string;
  sessionVersion?: number;
};

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function createSession(user: SessionUser): AppSession {
  const now = nowInSeconds();
  return {
    userId: user.id,
    email: user.email || "",
    name: user.name || "",
    role: user.role || "user",
    status: user.status || "active",
    sessionVersion: typeof user.sessionVersion === "number" && user.sessionVersion > 0 ? Math.trunc(user.sessionVersion) : 1,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
}

export function encodeSessionToken(session: AppSession): string {
  const secret = getSessionSecret();
  const payload = JSON.stringify(session);
  const encodedPayload = toBase64Url(payload);
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function decodeSessionToken(token: string): AppSession | null {
  if (!token || !token.includes(".")) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const secret = getSessionSecret();
  const expectedSignature = signPayload(encodedPayload, secret);
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== actualBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  try {
    const decoded = JSON.parse(fromBase64Url(encodedPayload)) as AppSession;
    if (typeof decoded.exp !== "number" || decoded.exp <= nowInSeconds()) return null;
    if (!decoded.userId) return null;
    return {
      ...decoded,
      sessionVersion:
        typeof decoded.sessionVersion === "number" && decoded.sessionVersion > 0
          ? Math.trunc(decoded.sessionVersion)
          : 1,
    };
  } catch {
    return null;
  }
}

export function writeSessionCookie(response: NextResponse, session: AppSession): NextResponse {
  const token = encodeSessionToken(session);
  response.cookies.set({
    name: POCKETBASE_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: POCKETBASE_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function getServerSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(POCKETBASE_SESSION_COOKIE)?.value;
  if (!raw) return null;
  return decodeSessionToken(raw);
}
