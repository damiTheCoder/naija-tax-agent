import type { JournalEntry } from "@/lib/accounting/doubleEntry";

export type VatMode = "inclusive" | "exclusive" | "category_default";
export type VatCategory = "input" | "output" | "exempt" | "zero";
export type FilingCadence = "monthly" | "quarterly";

export interface TaxCategoryMatrixRule {
  vatApplicable?: boolean;
  vatCategory?: VatCategory;
  whtApplicable?: boolean;
  whtRate?: number;
  defaultVatMode?: Exclude<VatMode, "category_default">;
}

export interface TaxEngineSettingsV2 {
  entityId: string;
  filingCadence: {
    vat: FilingCadence;
    wht: FilingCadence;
  };
  filingDueDay: number;
  categoryTaxMatrix: Record<string, TaxCategoryMatrixRule>;
  defaultVatModeByCategory: Record<string, Exclude<VatMode, "category_default">>;
  updatedAt: string;
}

export type JournalSyncInput = Pick<
  JournalEntry,
  | "id"
  | "date"
  | "narration"
  | "reference"
  | "lines"
  | "transactionType"
  | "source"
  | "createdAt"
  | "updatedAt"
  | "status"
> & {
  metadata?: Record<string, unknown>;
};

export interface SyncJournalsRequest {
  entityId: string;
  journals: JournalSyncInput[];
  source?: "live_posting" | "backfill";
  fullSync?: boolean;
  mode?: "apply" | "report";
}

export interface SyncJournalsResult {
  syncRunId: string;
  upsertedTransactions: number;
  prunedTransactions: number;
  duplicatesPruned: number;
  staleRowsRemoved: number;
  impactedPeriods: string[];
  reportOnly: boolean;
  report?: {
    journalsReceived: number;
    wouldUpsertTransactions: number;
    wouldPruneTransactions: number;
    wouldPruneDuplicates: number;
    wouldRemoveStaleRows: number;
    impactedPeriods: string[];
  };
}

export interface TaxDashboardResponseV2 {
  entityId: string;
  period?: string;
  vatPayable: number;
  vatReceivable: number;
  netVatPosition: number;
  whtPayable: number;
  nextFilingDate: string | null;
  schedules: Array<{
    taxType: "VAT" | "WHT";
    period: string;
    dueDate: string;
    totalTax: number;
    carryForward: number;
  }>;
}
