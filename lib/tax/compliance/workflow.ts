import type { ComplianceStatus, ComplianceStatusStage, TaxPaymentRecord, TaxSchedule } from "./types";
import { loadComplianceStatuses, saveComplianceStatuses, loadPayments, savePayments } from "./store";
import { recordAuditLog } from "./audit";

const makeId = () => `status-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function getComplianceStatus(entityId: string, period: string, taxType: string): ComplianceStatus | null {
  return (
    loadComplianceStatuses().find(
      (status) => status.entityId === entityId && status.period === period && status.taxType === taxType
    ) || null
  );
}

export function setComplianceStatus(params: {
  entityId: string;
  period: string;
  taxType: string;
  stage: ComplianceStatusStage;
  actor?: string;
}): ComplianceStatus {
  const existing = loadComplianceStatuses();
  const now = new Date().toISOString();
  const next: ComplianceStatus = {
    entityId: params.entityId,
    period: params.period,
    taxType: params.taxType as ComplianceStatus["taxType"],
    stage: params.stage,
    updatedAt: now,
  };
  const filtered = existing.filter(
    (status) =>
      status.entityId !== params.entityId || status.period !== params.period || status.taxType !== params.taxType
  );
  saveComplianceStatuses([next, ...filtered]);

  recordAuditLog({
    entityId: params.entityId,
    actor: params.actor || "system",
    action: "compliance.status.updated",
    resourceType: "compliance_status",
    metadata: {
      period: params.period,
      taxType: params.taxType,
      stage: params.stage,
    },
  });

  return next;
}

export function seedComplianceStatuses(entityId: string, schedules: TaxSchedule[]): ComplianceStatus[] {
  const existing = loadComplianceStatuses();
  const now = new Date().toISOString();
  const created = schedules.map((schedule) => ({
    entityId,
    period: schedule.period,
    taxType: schedule.taxType,
    stage: schedule.status,
    updatedAt: now,
  }));
  const filtered = existing.filter(
    (status) =>
      status.entityId !== entityId ||
      !schedules.some((schedule) => schedule.period === status.period && schedule.taxType === status.taxType)
  );
  saveComplianceStatuses([...created, ...filtered]);
  return created;
}

export function recordPayment(params: {
  entityId: string;
  period: string;
  taxType: string;
  amount: number;
  method?: string;
  reference?: string;
  status?: "pending" | "paid" | "failed";
  actor?: string;
}): TaxPaymentRecord {
  const now = new Date().toISOString();
  const payment: TaxPaymentRecord = {
    id: makeId(),
    entityId: params.entityId,
    period: params.period,
    taxType: params.taxType as TaxPaymentRecord["taxType"],
    amount: params.amount,
    paidAt: now,
    method: params.method || "bank_transfer",
    reference: params.reference,
    status: params.status || "paid",
  };
  const existing = loadPayments();
  savePayments([payment, ...existing].slice(0, 200));

  recordAuditLog({
    entityId: params.entityId,
    actor: params.actor || "system",
    action: "tax.payment.recorded",
    resourceType: "tax_payment",
    resourceId: payment.id,
    metadata: {
      period: params.period,
      taxType: params.taxType,
      amount: params.amount,
      status: payment.status,
    },
  });

  return payment;
}
