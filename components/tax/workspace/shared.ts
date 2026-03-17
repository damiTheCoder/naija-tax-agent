import type { ComplianceStatusStage } from "@/lib/tax/compliance";

export type WorkspaceDocument = {
  id: string;
  name: string;
  size: number;
  extracted: number;
  uploadedAt: string;
};

export type RemittanceAuditRecord = {
  id: string;
  paymentReference: string;
  taxpayerName: string;
  businessName?: string;
  taxType: string;
  period: string;
  dueDate: string;
  taxAmount: number;
  scheduleId: string;
  source: string;
  createdAt: string;
};

export type DashboardTaxType = "CIT" | "VAT" | "PAYE" | "WHT" | "EDT";
export type FilingIndicator = "Filed" | "Pending" | "Overdue";

export type DeadlineItem = {
  id: string;
  taxType: string;
  period: string;
  dueDate: string;
  amount: number;
  filingState: FilingIndicator;
  stage: string;
  source: "schedule" | "derived";
};

export type MonthlyTrendPoint = {
  monthKey: string;
  monthLabel: string;
  vat: number;
  wht: number;
  cit: number;
  paye: number;
  edt: number;
  total: number;
};

export type TaxTypeImpact = {
  payable: number;
  credit: number;
  net: number;
};

export type TimelineTransactionGroup = {
  id: string;
  transactionId?: string | null;
  description: string;
  date: string;
  baseAmount: number;
  netTaxAmount: number;
  lines: Array<{
    id: string;
    taxType: string;
    ledger: string;
    taxAmount: number;
  }>;
};

export type ComplianceStatusEntry = {
  period: string;
  taxType: string;
  stage: ComplianceStatusStage | string;
};

export type TaxWorkspacePayment = {
  id: string;
  taxType: string;
  period: string;
  amount: number;
  status: string;
  paidAt?: string;
};

export type TaxSummary = {
  netVAT: number;
  outputVAT: number;
  inputVAT: number;
  totalWHT: number;
  totalCGT: number;
  totalStampDuty: number;
  estimatedCIT: number;
  turnover: number;
  profit: number;
  taxableProfit: number;
};

export type TaxWorkspaceInsights = {
  breakdown: Record<DashboardTaxType, number>;
  paidByType: Record<DashboardTaxType, number>;
  totalTaxPayable: number;
  totalActualPaid: number;
  variance: number;
  completionRate: number;
  deadlineItems: DeadlineItem[];
  upcomingDeadlines: DeadlineItem[];
  overdueDeadlines: DeadlineItem[];
  overdueAmount: number;
  statusIndicators: Record<FilingIndicator, number>;
  taxImpactByType: Record<DashboardTaxType, TaxTypeImpact>;
  complianceScore: number;
  monthlyTrend: MonthlyTrendPoint[];
  maxMonthlyTrend: number;
  trendTotals: {
    vat: number;
    wht: number;
    cit: number;
    paye: number;
    edt: number;
    total: number;
  };
};

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const formatCurrencyFull = (amount: number) =>
  currencyFormatter.format(Math.round(amount || 0));

export const formatCurrency = (amount: number) => {
  const value = Math.round(amount || 0);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs < 1_000) return `${sign}${formatCurrencyFull(abs)}`;

  const compactTo = (divisor: number, suffix: string) => {
    const scaled = abs / divisor;
    const rounded =
      scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, "");
    return `${sign}₦${rounded}${suffix}`;
  };

  if (abs < 1_000_000) return compactTo(1_000, "K");
  if (abs < 1_000_000_000) return compactTo(1_000_000, "M");
  return compactTo(1_000_000_000, "b");
};

export const formatFileSize = (size: number) => {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`;
};

export const formatDate = (dateStr?: string) => {
  if (!dateStr) return "Pending date";
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
