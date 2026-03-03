import crypto from "node:crypto";
import { prisma } from "@/lib/server/prisma";
import type { WorkflowRole } from "./types";

export const round2 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

export const safeJsonStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return "{}";
  }
};

export const safeJsonParse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const normalizeEntityId = (entityId?: string): string => {
  const raw = (entityId || "entity-default").trim();
  return raw || "entity-default";
};

export const toDate = (value?: string): Date => {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
};

export const toIsoDate = (value?: string): string => {
  return toDate(value).toISOString().slice(0, 10);
};

export const toMonthlyPeriod = (value: Date): string => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

export const toQuarterlyPeriod = (value: Date): string => {
  const year = value.getUTCFullYear();
  const quarter = Math.floor(value.getUTCMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
};

export const addCadence = (date: Date, cadence: "monthly" | "quarterly"): Date => {
  const next = new Date(date);
  if (cadence === "quarterly") {
    next.setUTCMonth(next.getUTCMonth() + 3);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
};

const ROLE_RANK: Record<WorkflowRole, number> = {
  staff: 1,
  manager: 2,
  owner: 3,
};

export const normalizeRole = (value?: string): WorkflowRole => {
  const lower = (value || "staff").trim().toLowerCase();
  if (lower === "owner") return "owner";
  if (lower === "manager") return "manager";
  return "staff";
};

export const hasRoleAtLeast = (actualRole: WorkflowRole, requiredRole: WorkflowRole): boolean => {
  return ROLE_RANK[actualRole] >= ROLE_RANK[requiredRole];
};

export const generateDeterministicId = (prefix: string, parts: Array<string | number>): string => {
  const hash = crypto
    .createHash("sha256")
    .update(parts.map((part) => String(part)).join("::"))
    .digest("hex")
    .slice(0, 16);
  return `${prefix}-${hash}`;
};

export const fingerprintObject = (value: unknown): string => {
  const normalized = safeJsonStringify(value);
  return crypto.createHash("sha256").update(normalized).digest("hex");
};

export const ensureEntity = async (entityId: string) => {
  const normalized = normalizeEntityId(entityId);
  const now = new Date();
  await prisma.entity.upsert({
    where: { id: normalized },
    update: { updatedAt: now },
    create: {
      id: normalized,
      name: normalized === "entity-default" ? "Default Entity" : normalized,
      currency: "NGN",
      type: "BUSINESS",
      updatedAt: now,
    },
  });
  return normalized;
};

export const normalizeCurrency = (currency?: string): string => {
  const raw = (currency || "NGN").trim().toUpperCase();
  if (!raw) return "NGN";
  return raw;
};
