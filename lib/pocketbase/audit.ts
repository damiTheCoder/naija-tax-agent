import {
  POCKETBASE_ADMIN_AUDIT_COLLECTION,
} from "@/lib/pocketbase/config";
import { AppSession } from "@/lib/pocketbase/session";
import { createPocketBaseAdminClient } from "@/lib/pocketbase/adminClient";

type AuditPayload = {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export async function logAdminAudit(payload: AuditPayload): Promise<void> {
  try {
    const pb = await createPocketBaseAdminClient();
    await pb.collection(POCKETBASE_ADMIN_AUDIT_COLLECTION).create({
      actor: payload.actorId,
      action: payload.action,
      targetType: payload.targetType,
      targetId: payload.targetId,
      reason: payload.reason || "",
      metadata: payload.metadata || {},
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Audit should never block user-facing actions.
  }
}

export async function logAdminAuditFromSession(
  session: AppSession,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>,
  reason?: string,
): Promise<void> {
  await logAdminAudit({
    actorId: session.userId,
    action,
    targetType,
    targetId,
    reason,
    metadata,
  });
}
