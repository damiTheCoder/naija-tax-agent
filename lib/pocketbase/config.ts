const DEFAULT_POCKETBASE_URL = "http://127.0.0.1:8090";

export const POCKETBASE_USER_COLLECTION = "users";
export const POCKETBASE_COMPLAINTS_COLLECTION = "complaints";
export const POCKETBASE_COMPLAINT_MESSAGES_COLLECTION = "complaint_messages";
export const POCKETBASE_USAGE_EVENTS_COLLECTION = "usage_events";
export const POCKETBASE_ADMIN_AUDIT_COLLECTION = "admin_audit_logs";
export const POCKETBASE_SESSION_COOKIE = "ql_admin_session";
export const ALLOWED_OAUTH_PROVIDERS = new Set(["google"]);

export const ADMIN_ROLES = new Set([
  "super_admin",
  "support_admin",
  "support_agent",
  "read_only",
]);

export function getPocketBaseUrl(): string {
  const url = process.env.POCKETBASE_URL || process.env.NEXT_PUBLIC_POCKETBASE_URL || DEFAULT_POCKETBASE_URL;
  return url.replace(/\/+$/, "");
}

export function getPocketBasePublicUrl(): string {
  const url = process.env.NEXT_PUBLIC_POCKETBASE_URL || process.env.POCKETBASE_URL || DEFAULT_POCKETBASE_URL;
  return url.replace(/\/+$/, "");
}

export function getPocketBaseSuperuserEmail(): string {
  const email = process.env.POCKETBASE_SUPERUSER_EMAIL;
  if (!email) {
    throw new Error("Missing POCKETBASE_SUPERUSER_EMAIL");
  }
  return email;
}

export function getPocketBaseSuperuserPassword(): string {
  const password = process.env.POCKETBASE_SUPERUSER_PASSWORD;
  if (!password) {
    throw new Error("Missing POCKETBASE_SUPERUSER_PASSWORD");
  }
  return password;
}

export function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing AUTH_SESSION_SECRET");
  }
  return secret;
}

export function isAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return ADMIN_ROLES.has(role);
}
