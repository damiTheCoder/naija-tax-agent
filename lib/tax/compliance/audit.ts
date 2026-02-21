import type { AuditLogEntry } from "./types";
import { loadAuditLogs, saveAuditLogs } from "./store";

const makeId = () => `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function recordAuditLog(entry: Omit<AuditLogEntry, "id" | "createdAt">): AuditLogEntry {
  const next: AuditLogEntry = {
    id: makeId(),
    createdAt: new Date().toISOString(),
    ...entry,
  };
  const existing = loadAuditLogs();
  saveAuditLogs([next, ...existing].slice(0, 300));
  return next;
}
