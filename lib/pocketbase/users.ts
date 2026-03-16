export type PocketBaseUserRecord = {
  id: string;
  email?: string;
  name?: string;
  fullName?: string;
  role?: string;
  status?: string;
  sessionVersion?: number | string | null;
  created?: string;
  updated?: string;
  [key: string]: unknown;
};

export type NormalizedPocketBaseUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  sessionVersion: number;
};

export function normalizeSessionVersion(value: unknown): number {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(numeric) || numeric < 1) {
    return 1;
  }

  return Math.trunc(numeric);
}

export function normalizePocketBaseUser(record: PocketBaseUserRecord): NormalizedPocketBaseUser {
  return {
    id: record.id,
    email: record.email || "",
    name: record.name || record.fullName || "",
    role: record.role || "user",
    status: record.status || "active",
    sessionVersion: normalizeSessionVersion(record.sessionVersion),
  };
}
