import { NextRequest, NextResponse } from "next/server";

export const DEFAULT_ENTITY_ID = "entity-default";
export type ApiActorRole = "staff" | "manager" | "owner";

const ROLE_RANK: Record<ApiActorRole, number> = {
  staff: 1,
  manager: 2,
  owner: 3,
};

export function getEntityId(request: NextRequest, bodyEntityId?: unknown): string {
  const { searchParams } = new URL(request.url);
  const queryValue = searchParams.get("entityId");
  if (typeof bodyEntityId === "string" && bodyEntityId.trim()) return bodyEntityId.trim();
  if (queryValue && queryValue.trim()) return queryValue.trim();
  return DEFAULT_ENTITY_ID;
}

export function parseLimit(value: string | null, fallback = 100, min = 1, max = 500): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export function readJsonObject<T extends Record<string, unknown>>(value: unknown): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as T;
  }
  return value as T;
}

export function errorResponse(error: unknown, fallback: string, status = 500): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: error instanceof Error ? error.message : fallback,
    },
    { status }
  );
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status: 400 }
  );
}

export function notFound(message: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status: 404 }
  );
}

export function forbidden(message: string, requiredRole?: ApiActorRole, actorRole?: ApiActorRole): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      requiredRole: requiredRole || undefined,
      actorRole: actorRole || undefined,
    },
    { status: 403 }
  );
}

export function normalizeActorRole(value: unknown): ApiActorRole {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "owner") return "owner";
  if (raw === "manager") return "manager";
  return "staff";
}

export function getActorContext(request: NextRequest, body?: Record<string, unknown>): {
  actor: string;
  actorRole: ApiActorRole;
} {
  const headerRole = request.headers.get("x-ql-role") || request.headers.get("x-user-role");
  const bodyRole = body?.actorRole;
  const actorRole = normalizeActorRole(typeof bodyRole === "string" && bodyRole ? bodyRole : headerRole || "");

  const headerActor = request.headers.get("x-ql-actor") || request.headers.get("x-user-id");
  const actor =
    (typeof body?.actor === "string" && body.actor.trim()) ||
    (headerActor && headerActor.trim()) ||
    "system";

  return { actor, actorRole };
}

export function hasRequiredRole(actualRole: ApiActorRole, requiredRole: ApiActorRole): boolean {
  return ROLE_RANK[actualRole] >= ROLE_RANK[requiredRole];
}

export function ensureMinimumRole(
  request: NextRequest,
  body: Record<string, unknown> | undefined,
  requiredRole: ApiActorRole
): { actor: string; actorRole: ApiActorRole; forbiddenResponse: null } | {
  actor: string;
  actorRole: ApiActorRole;
  forbiddenResponse: NextResponse;
} {
  const context = getActorContext(request, body);
  if (hasRequiredRole(context.actorRole, requiredRole)) {
    return {
      actor: context.actor,
      actorRole: context.actorRole,
      forbiddenResponse: null,
    };
  }
  return {
    actor: context.actor,
    actorRole: context.actorRole,
    forbiddenResponse: forbidden(`${requiredRole} role required for this operation`, requiredRole, context.actorRole),
  };
}
