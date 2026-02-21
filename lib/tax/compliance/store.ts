import type {
  AuditLogEntry,
  ComplianceStatus,
  FilingPackResult,
  TaxClassification,
  TaxLedgerEntry,
  TaxSchedule,
  TaxIssue,
  TaxPaymentRecord,
} from "./types";

const storeKeys = {
  classifications: "ql::tax::classifications",
  ledgerEntries: "ql::tax::ledgerEntries",
  schedules: "ql::tax::schedules",
  issues: "ql::tax::issues",
  compliance: "ql::tax::compliance",
  filingPacks: "ql::tax::filingPacks",
  payments: "ql::tax::payments",
  auditLogs: "ql::tax::auditLogs",
};

const inMemory: Record<string, unknown> = {};

function readStore<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return (inMemory[key] as T) ?? fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStore<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    inMemory[key] = value;
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadClassifications(): TaxClassification[] {
  return readStore(storeKeys.classifications, [] as TaxClassification[]);
}

export function saveClassifications(next: TaxClassification[]): void {
  writeStore(storeKeys.classifications, next);
}

export function loadLedgerEntries(): TaxLedgerEntry[] {
  return readStore(storeKeys.ledgerEntries, [] as TaxLedgerEntry[]);
}

export function saveLedgerEntries(next: TaxLedgerEntry[]): void {
  writeStore(storeKeys.ledgerEntries, next);
}

export function loadSchedules(): TaxSchedule[] {
  return readStore(storeKeys.schedules, [] as TaxSchedule[]);
}

export function saveSchedules(next: TaxSchedule[]): void {
  writeStore(storeKeys.schedules, next);
}

export function loadIssues(): TaxIssue[] {
  return readStore(storeKeys.issues, [] as TaxIssue[]);
}

export function saveIssues(next: TaxIssue[]): void {
  writeStore(storeKeys.issues, next);
}

export function loadComplianceStatuses(): ComplianceStatus[] {
  return readStore(storeKeys.compliance, [] as ComplianceStatus[]);
}

export function saveComplianceStatuses(next: ComplianceStatus[]): void {
  writeStore(storeKeys.compliance, next);
}

export function loadFilingPacks(): FilingPackResult[] {
  return readStore(storeKeys.filingPacks, [] as FilingPackResult[]);
}

export function saveFilingPacks(next: FilingPackResult[]): void {
  writeStore(storeKeys.filingPacks, next);
}

export function loadAuditLogs(): AuditLogEntry[] {
  return readStore(storeKeys.auditLogs, [] as AuditLogEntry[]);
}

export function saveAuditLogs(next: AuditLogEntry[]): void {
  writeStore(storeKeys.auditLogs, next);
}

export function loadPayments(): TaxPaymentRecord[] {
  return readStore(storeKeys.payments, [] as TaxPaymentRecord[]);
}

export function savePayments(next: TaxPaymentRecord[]): void {
  writeStore(storeKeys.payments, next);
}

export function resetComplianceStore(): void {
  if (typeof window === "undefined") {
    Object.keys(storeKeys).forEach((key) => {
      delete inMemory[(storeKeys as Record<string, string>)[key]];
    });
    return;
  }
  Object.values(storeKeys).forEach((key) => {
    window.localStorage.removeItem(key);
  });
}
