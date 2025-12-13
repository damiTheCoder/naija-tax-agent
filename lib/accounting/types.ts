export type TransactionType = "income" | "expense" | "asset" | "liability" | "equity" | "other";

export interface RawTransaction {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: TransactionType;
  sourceDocument?: string;
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
