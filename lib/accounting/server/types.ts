import type { JournalLine } from "@/lib/accounting/doubleEntry";

export type WorkflowRole = "staff" | "manager" | "owner";

export type ApprovalStatus = "draft" | "pending_approval" | "approved" | "rejected" | "paid" | "voided";

export type ActionReceiptStatus = "success" | "failure";

export interface ActionReceipt {
  actionId: string;
  entityId: string;
  resourceType: string;
  resourceId?: string;
  journalId?: string;
  status: ActionReceiptStatus;
  timestamp: string;
  deepLink?: string;
}

export interface JournalPostInput {
  entityId: string;
  journalId?: string;
  date: string;
  narration: string;
  reference?: string;
  sourceDocType?: string;
  sourceDocId?: string;
  sourceCurrency?: string;
  baseCurrency?: string;
  exchangeRate?: number;
  lines: JournalLine[];
  metadata?: Record<string, unknown>;
  approvalStatus?: "draft" | "pending_approval" | "approved" | "rejected";
  approvalRequestId?: string;
  trackingClassId?: string;
  trackingLocationId?: string;
  status?: "draft" | "posted" | "voided" | "reversed";
  syncTax?: boolean;
}

export interface BillDraftLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  taxAmount?: number;
  total?: number;
  metadata?: Record<string, unknown>;
  trackingClassId?: string;
  trackingLocationId?: string;
}

export interface BillDraftInput {
  entityId: string;
  billNo?: string;
  vendorId?: string;
  vendorName?: string;
  date: string;
  dueDate?: string;
  currency?: string;
  lines: BillDraftLineInput[];
  notes?: string;
  trackingClassId?: string;
  trackingLocationId?: string;
}

export interface BillSubmitInput {
  entityId: string;
  billId: string;
  actor?: string;
  actorRole?: WorkflowRole;
}

export interface BillApprovalInput {
  entityId: string;
  billId: string;
  actor?: string;
  actorRole?: WorkflowRole;
  decisionNote?: string;
}

export interface BillPaymentInput {
  entityId: string;
  billId: string;
  date?: string;
  amount?: number;
  method?: string;
  reference?: string;
  bankAccountCode?: string;
  bankAccountName?: string;
  actor?: string;
  actorRole?: WorkflowRole;
}

export interface RecurringTemplateInput {
  entityId: string;
  name: string;
  resourceType: "bill" | "journal";
  frequency: "monthly" | "quarterly";
  startDate: string;
  endDate?: string;
  nextRunAt?: string;
  payload: Record<string, unknown>;
  createdBy?: string;
}

export interface RecurringRunResult {
  entityId: string;
  runAt: string;
  generated: number;
  skipped: number;
  failed: number;
  details: Array<{
    templateId: string;
    status: "generated" | "skipped" | "failed";
    message: string;
    resourceType: string;
    resourceId?: string;
    journalId?: string;
  }>;
}

export interface PeriodLockState {
  entityId: string;
  period: string;
  locked: boolean;
  lockedBy?: string;
  lockedAt?: string;
  reason?: string;
}

export interface PeriodLockError {
  code: "PERIOD_LOCKED";
  message: string;
  period: string;
}

export interface AccountingMigrationSnapshot {
  vendors?: Array<Record<string, unknown>>;
  bills?: Array<Record<string, unknown>>;
  journals?: Array<Record<string, unknown>>;
  recurringTemplates?: Array<Record<string, unknown>>;
  exchangeRates?: Array<Record<string, unknown>>;
}

export interface AccountingMigrationResult {
  entityId: string;
  clientId: string;
  imported: number;
  skipped: number;
  conflicts: number;
  report: {
    importedItems: string[];
    skippedItems: string[];
    conflicts: string[];
  };
}
