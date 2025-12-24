export type TransactionType = "income" | "expense" | "asset" | "liability" | "equity" | "other";

export interface RawTransaction {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: TransactionType;
  sourceDocument?: string;
  // Extended fields for AI classification
  vendor?: string;
  reference?: string;
  currency?: string;
  accountCode?: string;
  accountName?: string;
  classificationSource?: "rule" | "ai" | "hybrid" | "manual";
  classificationConfidence?: number;
  whtApplicable?: boolean;
  whtAmount?: number;
  vatApplicable?: boolean;
  vatAmount?: number;
  verified?: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface StatementDraft {
  revenue: number;
  costOfSales: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingIncome: number;
  otherIncome: number;
  netIncome: number;
  assets: number;
  liabilities: number;
  equity: number;
  cashFromOperations: number;
  cashFromInvesting: number;
  cashFromFinancing: number;
  // Enhanced fields
  items: StatementLineItem[];
  period?: {
    start: string;
    end: string;
  };
  analysisSource?: "rule" | "ai" | "hybrid";
  analysisConfidence?: number;
  equityStatement?: EquityStatement;
}

export interface EquityStatement {
  openingBalance: number;
  additions: number; // Capital introduced
  drawings: number; // Owner withdrawals
  netIncome: number; // Profit/Loss for period
  closingBalance: number;
}

export interface StatementLineItem {
  id: string;
  label: string;
  amount: number;
  type: TransactionType;
  accountCode?: string;
  accountName?: string;
  category?: string;
  subCategory?: string;
  taxDeductible?: boolean;
  note?: string;
}

export interface DraftDocumentMeta {
  name: string;
  size: number;
  uploadedAt: string;
  status: "uploaded" | "processed" | "pending";
}

export interface AuditedStatementPacket {
  fileName: string;
  uploadedAt: string;
  auditorName: string;
  notes?: string;
  figures: StatementDraft;
}

export interface TaxDraftPayload {
  profile: {
    taxpayerType: "freelancer" | "company";
    businessName?: string;
    taxYear: number;
  };
  inputs: {
    grossRevenue: number;
    allowableExpenses: number;
    turnover?: number;
    costOfSales?: number;
    operatingExpenses?: number;
  };
  statement: StatementDraft;
}

// ============================================================================
// AI-ENHANCED TYPES
// ============================================================================

export interface AISettings {
  enabled: boolean;
  apiEndpoint?: string;
  apiKey?: string;
  model?: string;
  confidenceThreshold: number;
  autoClassify: boolean;
  autoGenerateJournals: boolean;
  complianceMode: "strict" | "advisory" | "off";
}

export interface JournalEntry {
  id: string;
  date: string;
  description: string;
  reference?: string;
  lines: JournalLine[];
  source: "manual" | "rule" | "ai" | "hybrid";
  confidence?: number;
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  posted: boolean;
  postedAt?: string;
}

export interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface ComplianceAlert {
  id: string;
  ruleId: string;
  severity: "error" | "warning" | "info";
  category: string;
  title: string;
  message: string;
  recommendation?: string;
  dueDate?: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface TaxLiability {
  taxType: "CIT" | "VAT" | "WHT" | "CGT" | "PAYE" | "TET" | "STAMP_DUTY";
  period: string;
  amount: number;
  rate: number;
  basis: number;
  dueDate: string;
  status: "estimated" | "assessed" | "paid" | "overdue";
  reference?: string;
}

export interface FiscalPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "open" | "closed" | "locked";
  closedAt?: string;
  closedBy?: string;
}

export interface AccountingConfig {
  companyName: string;
  taxIdNumber?: string;
  rcNumber?: string; // CAC registration number
  vatNumber?: string;
  fiscalYearEnd: string; // MM-DD format
  currency: string;
  industry?: string;
  companySize: "small" | "medium" | "large";
  aiSettings: AISettings;
  defaultAccounts: {
    cashAccount: string;
    revenueAccount: string;
    expenseAccount: string;
    receivablesAccount: string;
    payablesAccount: string;
    vatOutputAccount: string;
    vatInputAccount: string;
    whtPayableAccount: string;
    whtReceivableAccount: string;
  };
}

// Default AI settings
export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: true,
  confidenceThreshold: 0.75,
  autoClassify: true,
  autoGenerateJournals: false,
  complianceMode: "advisory",
};

// Default accounting config
export const DEFAULT_ACCOUNTING_CONFIG: AccountingConfig = {
  companyName: "",
  fiscalYearEnd: "12-31",
  currency: "NGN",
  companySize: "small",
  aiSettings: DEFAULT_AI_SETTINGS,
  defaultAccounts: {
    cashAccount: "1020",
    revenueAccount: "4000",
    expenseAccount: "5000",
    receivablesAccount: "1100",
    payablesAccount: "2000",
    vatOutputAccount: "2200",
    vatInputAccount: "1400",
    whtPayableAccount: "2220",
    whtReceivableAccount: "1410",
  },
};
