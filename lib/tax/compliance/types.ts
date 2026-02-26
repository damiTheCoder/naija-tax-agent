export type TaxType = "VAT" | "WHT" | "CIT" | "CGT" | "STAMP";
export type ComplianceStatusStage = "draft" | "review" | "ready" | "filed" | "paid" | "reconciled";

export interface ComplianceTransaction {
  id: string;
  entityId: string;
  date: string; // ISO date
  description: string;
  amount: number; // positive gross amount
  currency: string;
  type: string; // sale | purchase | expense | asset_disposal | payroll | etc.
  source?: string;
  vendorType?: "corporate" | "individual";
  documentType?: string;
  metadata?: Record<string, unknown>;
}

export interface TaxRuleSet {
  id: string;
  version: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: "draft" | "active" | "retired";
  vatRate: number;
  whtRates: Record<string, number>;
  citConfig: {
    smallCompanyThreshold: number;
    mediumCompanyThreshold: number;
    smallRate: number;
    mediumRate: number;
    largeRate: number;
    minimumTaxRate: number;
  };
  cgtRate: number;
  stampDutyRules: Array<{
    documentType: string;
    rateType: "fixed" | "percentage";
    rate: number;
  }>;
}

export interface TaxRuleMatch {
  ruleId: string;
  taxType: TaxType;
  category: string;
  rate: number;
  rateType: "fixed" | "percentage";
  reason: string;
}

export interface TaxClassification {
  id: string;
  entityId: string;
  transactionId: string;
  taxType: TaxType;
  category: string;
  ruleId?: string;
  confidence: number;
  status: "auto" | "manual";
  reason?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface TaxLedgerEntry {
  id: string;
  entityId: string;
  transactionId?: string;
  taxType: TaxType;
  ruleSetId: string;
  ruleId?: string;
  category?: string;
  period: string;
  baseAmount: number;
  taxAmount: number;
  direction: "payable" | "credit";
  ledger: "output" | "input" | "adjustment";
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface TaxSchedule {
  id: string;
  entityId: string;
  period: string;
  taxType: TaxType;
  dueDate: string;
  status: ComplianceStatusStage;
  totalBase: number;
  totalTax: number;
  carryForward: number;
  ruleSetId: string;
  ledgerEntryIds: string[];
  metadata?: Record<string, unknown>;
}

export interface TaxComputationResult {
  ruleSetId: string;
  period: string;
  ledgerEntries: TaxLedgerEntry[];
  schedules: TaxSchedule[];
  classifications: TaxClassification[];
  reconciliation: TaxReconciliationReport[];
  issues: TaxIssue[];
}

export interface TaxIssue {
  id: string;
  entityId: string;
  period: string;
  type:
    | "UNCLASSIFIED"
    | "MISSING_METADATA"
    | "RULE_MISMATCH"
    | "RECONCILIATION_MISMATCH"
    | "OUT_OF_PERIOD";
  severity: "low" | "medium" | "high";
  message: string;
  transactionId?: string;
  taxType?: TaxType;
  metadata?: Record<string, unknown>;
}

export interface CITReconciliation {
  accountingProfit: number;
  disallowable: number;
  nonTaxable: number;
  capitalAllowance: number;
  lossCarryForward: number;
  taxableProfit: number;
  turnover: number;
  rate: number;
  minimumTax: number;
  grossTaxBeforeCredits?: number;
  taxCredits?: number;
  manualDeductions?: number;
  manualAllowances?: number;
  manualAdjustments?: number;
  taxPayable: number;
}

export interface TaxReconciliationReport {
  taxType: TaxType;
  period: string;
  status: "matched" | "mismatch";
  summary: Record<string, number>;
  details?: Record<string, unknown>;
}

export interface FilingPackResult {
  id: string;
  entityId: string;
  period: string;
  taxType: TaxType;
  format: "pdf" | "csv" | "xlsx";
  fileName: string;
  generatedAt: string;
  metadata?: Record<string, unknown>;
  blob?: Blob;
}

export interface TaxPaymentRecord {
  id: string;
  entityId: string;
  period: string;
  taxType: TaxType;
  amount: number;
  paidAt: string;
  method: string;
  reference?: string;
  status: "pending" | "paid" | "failed";
  metadata?: Record<string, unknown>;
}

export interface ComplianceStatus {
  entityId: string;
  period: string;
  taxType: TaxType;
  stage: ComplianceStatusStage;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  entityId: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
