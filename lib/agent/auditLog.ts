import type { UnifiedAgentAction, UnifiedActionExecutionResult } from "@/lib/agent/unifiedTypes";

export type AIAuditEventType =
  | "plan.generated"
  | "plan.validated"
  | "approval.requested"
  | "approval.confirmed"
  | "approval.cancelled"
  | "execution.started"
  | "execution.finished"
  | "execution.blocked";

export interface AIAuditEvent {
  id: string;
  timestamp: string;
  eventType: AIAuditEventType;
  module?: string;
  route?: string;
  message?: string;
  planSource?: string;
  confidence?: number;
  actions?: UnifiedAgentAction[];
  results?: UnifiedActionExecutionResult[];
  reasons?: string[];
  metadata?: Record<string, string | number | boolean>;
}

const AUDIT_STORAGE_KEY = "ql::ai-audit-log::v1";
const MAX_CLIENT_EVENTS = 200;

function createAuditId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `audit_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeEvent(event: Omit<AIAuditEvent, "id" | "timestamp">): AIAuditEvent {
  return {
    ...event,
    id: createAuditId(),
    timestamp: new Date().toISOString(),
  };
}

export function appendAIAuditEvent(event: Omit<AIAuditEvent, "id" | "timestamp">): AIAuditEvent {
  const next = safeEvent(event);

  if (typeof window === "undefined") {
    console.info("[AI Audit]", JSON.stringify(next));
    return next;
  }

  try {
    const raw = window.localStorage.getItem(AUDIT_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const existing = Array.isArray(parsed) ? parsed.filter((item): item is AIAuditEvent => Boolean(item && typeof item === "object")) : [];
    window.localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify([...existing, next].slice(-MAX_CLIENT_EVENTS)));
  } catch {
    // Audit logging must not block user workflows.
  }

  return next;
}

export function readAIAuditEvents(): AIAuditEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(AUDIT_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is AIAuditEvent => Boolean(item && typeof item === "object")) : [];
  } catch {
    return [];
  }
}
