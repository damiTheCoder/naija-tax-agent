"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import { configureJsPdfTypography } from "@/lib/pdf/jspdfTypography";
import { accountingEngine } from "@/lib/accounting/transactionBridge";
import type { JournalEntry } from "@/lib/accounting/doubleEntry";
import { CHART_OF_ACCOUNTS, type AccountClass } from "@/lib/accounting/standards";
import { mapJournalEntriesToCompliance } from "@/lib/tax/compliance/adapters";
import { runTaxComputation, type ComplianceStatusStage, type FilingPackResult, type TaxSchedule } from "@/lib/tax/compliance";
import { generateFilingPack } from "@/lib/tax/compliance/filingPack";
import { loadComplianceStatuses, loadFilingPacks, loadSchedules } from "@/lib/tax/compliance/store";
import { withTaxAdjustments } from "@/lib/tax/adjustments";

type ReturnTaxType = "VAT" | "CIT" | "PAYE" | "WHT";
type ReturnStatus = "Draft" | "Ready" | "Filed";

type FilingReturnRow = {
  id: string;
  taxType: ReturnTaxType;
  period: string;
  status: ReturnStatus;
  taxAmount: number;
  filingDate: string | null;
  source: "schedule" | "derived";
  scheduleId?: string;
};

type ManualFilingRecord = {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  taxType: ReturnTaxType | "OTHER";
  period: string;
};

type SubmissionHistoryItem = {
  id: string;
  action: "generated_document" | "downloaded_pdf" | "manual_upload";
  fileName: string;
  taxType?: string;
  period?: string;
  createdAt: string;
};

const MANUAL_FILINGS_KEY = "ql::tax::manual-filings";
const SUBMISSION_HISTORY_KEY = "ql::tax::submission-history";
const PAYE_ESTIMATE_RATE = 0.15;
const TAX_ORDER: ReturnTaxType[] = ["VAT", "CIT", "PAYE", "WHT"];

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatCurrency = (amount: number) => currencyFormatter.format(Math.round(amount || 0));

const formatDate = (value?: string | null) => {
  if (!value) return "Not filed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not filed";
  return date.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const parsePeriodRank = (period: string): number => {
  const quarterMatch = period.match(/^(\d{4})-Q(\d)$/i);
  if (quarterMatch) {
    const year = Number(quarterMatch[1]);
    const quarter = Number(quarterMatch[2]);
    return year * 100 + quarter * 3;
  }

  const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    return year * 100 + month;
  }

  const yearMatch = period.match(/^(\d{4})/);
  if (yearMatch) {
    return Number(yearMatch[1]) * 100 + 12;
  }

  return 0;
};

const stageToStatus = (stage: string): ReturnStatus => {
  if (stage === "filed" || stage === "paid" || stage === "reconciled") return "Filed";
  if (stage === "ready" || stage === "review") return "Ready";
  return "Draft";
};

const getStatusPillClass = (status: ReturnStatus) => {
  if (status === "Filed") return "bg-emerald-50 text-emerald-700";
  if (status === "Ready") return "bg-blue-50 text-blue-700";
  return "bg-gray-100 text-gray-700";
};

const getTaxLabel = (taxType: ReturnTaxType | "OTHER") => {
  if (taxType === "VAT") return "VAT";
  if (taxType === "CIT") return "CIT";
  if (taxType === "PAYE") return "PAYE";
  if (taxType === "WHT") return "WHT";
  return "Other";
};

const readFromLocalStorage = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeToLocalStorage = <T,>(key: string, value: T) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const loadManualFilings = () => readFromLocalStorage<ManualFilingRecord[]>(MANUAL_FILINGS_KEY, []);
const saveManualFilings = (records: ManualFilingRecord[]) => writeToLocalStorage(MANUAL_FILINGS_KEY, records);

const loadSubmissionHistory = () =>
  readFromLocalStorage<SubmissionHistoryItem[]>(SUBMISSION_HISTORY_KEY, []);
const saveSubmissionHistory = (records: SubmissionHistoryItem[]) =>
  writeToLocalStorage(SUBMISSION_HISTORY_KEY, records);

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

type TaxPackageBasis = "cash" | "accrual";
type AccountSnapshot = {
  code: string;
  name: string;
  accountClass: AccountClass;
};

const inferAccountClass = (accountCode: string): AccountClass => {
  const first = (accountCode || "").trim()[0];
  if (first === "1") return "asset";
  if (first === "2") return "liability";
  if (first === "3") return "equity";
  if (first === "4") return "revenue";
  return "expense";
};

const csvCell = (value: unknown): string => {
  const stringValue = String(value ?? "");
  if (!/[",\n]/.test(stringValue)) return stringValue;
  return `"${stringValue.replace(/"/g, "\"\"")}"`;
};

const toCsv = (rows: Array<Array<unknown>>): string =>
  rows.map((row) => row.map((cell) => csvCell(cell)).join(",")).join("\n");

const asDate = (entry: JournalEntry): Date => {
  const parsed = new Date(entry.date || entry.createdAt || new Date().toISOString());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const hasCashMovement = (entry: JournalEntry): boolean =>
  entry.lines.some((line) => (line.accountCode || "").trim().startsWith("10"));

const inBasis = (entry: JournalEntry, basis: TaxPackageBasis): boolean =>
  basis === "accrual" ? true : hasCashMovement(entry);

const toAmount = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const readMetadataField = (entry: JournalEntry, keys: string[]): string => {
  const metadata =
    entry.metadata && typeof entry.metadata === "object"
      ? (entry.metadata as Record<string, unknown>)
      : {};
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const toAccountSnapshots = (entries: JournalEntry[]): AccountSnapshot[] => {
  const map = new Map<string, AccountSnapshot>();
  CHART_OF_ACCOUNTS.forEach((account) => {
    map.set(account.code, {
      code: account.code,
      name: account.name,
      accountClass: account.class,
    });
  });
  entries.forEach((entry) => {
    entry.lines.forEach((line) => {
      const code = (line.accountCode || "").trim();
      if (!code || map.has(code)) return;
      map.set(code, {
        code,
        name: line.accountName || `Account ${code}`,
        accountClass: inferAccountClass(code),
      });
    });
  });
  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
};

const toPackageCsvFiles = (params: {
  entries: JournalEntry[];
  year: number;
  basis: TaxPackageBasis;
}) => {
  const yearStart = new Date(Date.UTC(params.year, 0, 1, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(params.year, 11, 31, 23, 59, 59, 999));
  const toDateEntries = params.entries.filter((entry) => {
    const date = asDate(entry);
    return date <= yearEnd && inBasis(entry, params.basis);
  });
  const inYearEntries = params.entries.filter((entry) => {
    const date = asDate(entry);
    return date >= yearStart && date <= yearEnd && inBasis(entry, params.basis);
  });
  const beforeYearEntries = params.entries.filter((entry) => {
    const date = asDate(entry);
    return date < yearStart && inBasis(entry, params.basis);
  });

  const accounts = toAccountSnapshots(params.entries);
  const ledgerMap = new Map<
    string,
    {
      account: AccountSnapshot;
      openingDebit: number;
      openingCredit: number;
      yearDebit: number;
      yearCredit: number;
      toDateDebit: number;
      toDateCredit: number;
    }
  >();
  const ensure = (code: string, name?: string) => {
    if (!ledgerMap.has(code)) {
      const found = accounts.find((item) => item.code === code);
      const snapshot: AccountSnapshot =
        found ||
        ({
          code,
          name: name || `Account ${code}`,
          accountClass: inferAccountClass(code),
        } satisfies AccountSnapshot);
      ledgerMap.set(code, {
        account: snapshot,
        openingDebit: 0,
        openingCredit: 0,
        yearDebit: 0,
        yearCredit: 0,
        toDateDebit: 0,
        toDateCredit: 0,
      });
    }
    return ledgerMap.get(code)!;
  };

  beforeYearEntries.forEach((entry) => {
    entry.lines.forEach((line) => {
      const code = (line.accountCode || "").trim();
      if (!code) return;
      const row = ensure(code, line.accountName);
      row.openingDebit += toAmount(line.debit);
      row.openingCredit += toAmount(line.credit);
      row.toDateDebit += toAmount(line.debit);
      row.toDateCredit += toAmount(line.credit);
    });
  });
  inYearEntries.forEach((entry) => {
    entry.lines.forEach((line) => {
      const code = (line.accountCode || "").trim();
      if (!code) return;
      const row = ensure(code, line.accountName);
      row.yearDebit += toAmount(line.debit);
      row.yearCredit += toAmount(line.credit);
      row.toDateDebit += toAmount(line.debit);
      row.toDateCredit += toAmount(line.credit);
    });
  });

  const ledgerRows = Array.from(ledgerMap.values()).sort((a, b) =>
    a.account.code.localeCompare(b.account.code)
  );

  const toNaturalBalance = (row: (typeof ledgerRows)[number], scope: "opening" | "year" | "toDate"): number => {
    const debit =
      scope === "opening"
        ? row.openingDebit
        : scope === "year"
        ? row.yearDebit
        : row.toDateDebit;
    const credit =
      scope === "opening"
        ? row.openingCredit
        : scope === "year"
        ? row.yearCredit
        : row.toDateCredit;
    if (row.account.accountClass === "asset" || row.account.accountClass === "expense") {
      return debit - credit;
    }
    return credit - debit;
  };

  const rollforwardRows: Array<Array<unknown>> = [
    [
      "account_code",
      "account_name",
      "account_class",
      "opening_balance",
      "year_debits",
      "year_credits",
      "movement",
      "closing_balance",
      "basis",
      "year",
    ],
  ];
  ledgerRows.forEach((row) => {
    const opening = toNaturalBalance(row, "opening");
    const movement = toNaturalBalance(row, "year");
    const closing = toNaturalBalance(row, "toDate");
    if (
      Math.abs(opening) < 0.005 &&
      Math.abs(row.yearDebit) < 0.005 &&
      Math.abs(row.yearCredit) < 0.005 &&
      Math.abs(closing) < 0.005
    ) {
      return;
    }
    rollforwardRows.push([
      row.account.code,
      row.account.name,
      row.account.accountClass,
      opening.toFixed(2),
      row.yearDebit.toFixed(2),
      row.yearCredit.toFixed(2),
      movement.toFixed(2),
      closing.toFixed(2),
      params.basis,
      params.year,
    ]);
  });

  const incomeRows = ledgerRows.filter((row) => row.account.accountClass === "revenue" || row.account.accountClass === "expense");
  const incomeStatementRows: Array<Array<unknown>> = [
    ["section", "account_code", "account_name", "amount", "basis", "year"],
  ];
  let totalRevenue = 0;
  let totalExpense = 0;
  incomeRows.forEach((row) => {
    if (row.account.accountClass === "revenue") {
      const amount = row.yearCredit - row.yearDebit;
      if (Math.abs(amount) < 0.005) return;
      totalRevenue += amount;
      incomeStatementRows.push(["Revenue", row.account.code, row.account.name, amount.toFixed(2), params.basis, params.year]);
      return;
    }
    const amount = row.yearDebit - row.yearCredit;
    if (Math.abs(amount) < 0.005) return;
    totalExpense += amount;
    incomeStatementRows.push(["Expense", row.account.code, row.account.name, amount.toFixed(2), params.basis, params.year]);
  });
  incomeStatementRows.push(["Total Revenue", "", "", totalRevenue.toFixed(2), params.basis, params.year]);
  incomeStatementRows.push(["Total Expense", "", "", totalExpense.toFixed(2), params.basis, params.year]);
  incomeStatementRows.push(["Net Income", "", "", (totalRevenue - totalExpense).toFixed(2), params.basis, params.year]);

  const balanceSheetRows: Array<Array<unknown>> = [
    ["section", "account_code", "account_name", "amount", "basis", "as_of_year"],
  ];
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  let revenueToDate = 0;
  let expenseToDate = 0;

  ledgerRows.forEach((row) => {
    const closing = toNaturalBalance(row, "toDate");
    if (row.account.accountClass === "revenue") {
      revenueToDate += Math.max(0, row.toDateCredit - row.toDateDebit);
    }
    if (row.account.accountClass === "expense") {
      expenseToDate += Math.max(0, row.toDateDebit - row.toDateCredit);
    }
    if (
      row.account.accountClass !== "asset" &&
      row.account.accountClass !== "liability" &&
      row.account.accountClass !== "equity"
    ) {
      return;
    }
    if (Math.abs(closing) < 0.005) return;
    if (row.account.accountClass === "asset") {
      totalAssets += closing;
      balanceSheetRows.push(["Assets", row.account.code, row.account.name, closing.toFixed(2), params.basis, params.year]);
    } else if (row.account.accountClass === "liability") {
      totalLiabilities += closing;
      balanceSheetRows.push(["Liabilities", row.account.code, row.account.name, closing.toFixed(2), params.basis, params.year]);
    } else {
      totalEquity += closing;
      balanceSheetRows.push(["Equity", row.account.code, row.account.name, closing.toFixed(2), params.basis, params.year]);
    }
  });
  const currentEarnings = revenueToDate - expenseToDate;
  if (Math.abs(currentEarnings) >= 0.005) {
    totalEquity += currentEarnings;
    balanceSheetRows.push(["Equity", "CURRENT_EARNINGS", "Current Earnings", currentEarnings.toFixed(2), params.basis, params.year]);
  }
  balanceSheetRows.push(["Total Assets", "", "", totalAssets.toFixed(2), params.basis, params.year]);
  balanceSheetRows.push(["Total Liabilities", "", "", totalLiabilities.toFixed(2), params.basis, params.year]);
  balanceSheetRows.push(["Total Equity", "", "", totalEquity.toFixed(2), params.basis, params.year]);
  balanceSheetRows.push(["Liability + Equity", "", "", (totalLiabilities + totalEquity).toFixed(2), params.basis, params.year]);

  const trialBalanceRows: Array<Array<unknown>> = [
    ["account_code", "account_name", "debit", "credit", "basis", "as_of_year"],
  ];
  let totalDebit = 0;
  let totalCredit = 0;
  ledgerRows.forEach((row) => {
    const debit = Math.max(0, row.toDateDebit - row.toDateCredit);
    const credit = Math.max(0, row.toDateCredit - row.toDateDebit);
    if (Math.abs(debit) < 0.005 && Math.abs(credit) < 0.005) return;
    totalDebit += debit;
    totalCredit += credit;
    trialBalanceRows.push([row.account.code, row.account.name, debit.toFixed(2), credit.toFixed(2), params.basis, params.year]);
  });
  trialBalanceRows.push(["TOTAL", "", totalDebit.toFixed(2), totalCredit.toFixed(2), params.basis, params.year]);

  const vendorMap = new Map<string, { total: number; count: number }>();
  inYearEntries.forEach((entry) => {
    const expenseAmount = entry.lines.reduce((sum, line) => {
      const code = (line.accountCode || "").trim();
      if (!code) return sum;
      const meta = ledgerMap.get(code)?.account;
      if (!meta) return sum;
      if (meta.accountClass !== "expense") return sum;
      return sum + Math.max(0, toAmount(line.debit) - toAmount(line.credit));
    }, 0);
    if (expenseAmount <= 0) return;

    const explicitVendor = readMetadataField(entry, [
      "vendorName",
      "vendor",
      "payee",
      "counterparty",
      "beneficiary",
    ]);
    const inferred =
      explicitVendor ||
      (entry.narration.match(/(?:paid|payment to|to)\s+([A-Za-z0-9&.,' -]{3,60})/i)?.[1] || "").trim() ||
      "Unspecified Vendor";

    const existing = vendorMap.get(inferred) || { total: 0, count: 0 };
    existing.total += expenseAmount;
    existing.count += 1;
    vendorMap.set(inferred, existing);
  });
  const vendorRows: Array<Array<unknown>> = [
    ["vendor_name", "total_spend", "transaction_count", "basis", "year"],
  ];
  Array.from(vendorMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([vendor, value]) => {
      vendorRows.push([vendor, value.total.toFixed(2), value.count, params.basis, params.year]);
    });
  if (vendorRows.length === 1) {
    vendorRows.push(["Unspecified Vendor", "0.00", 0, params.basis, params.year]);
  }

  return [
    { fileName: "balance_sheet.csv", csv: toCsv(balanceSheetRows) },
    { fileName: "general_ledger_rollforward.csv", csv: toCsv(rollforwardRows) },
    { fileName: "income_statement.csv", csv: toCsv(incomeStatementRows) },
    { fileName: "trial_balance.csv", csv: toCsv(trialBalanceRows) },
    { fileName: "vendor_spending.csv", csv: toCsv(vendorRows) },
  ];
};

export default function FileTaxesPage() {
  const [returns, setReturns] = useState<FilingReturnRow[]>([]);
  const [schedules, setSchedules] = useState<TaxSchedule[]>([]);
  const [postedEntries, setPostedEntries] = useState<JournalEntry[]>([]);
  const [filingPacks, setFilingPacks] = useState<FilingPackResult[]>([]);
  const [manualFilings, setManualFilings] = useState<ManualFilingRecord[]>([]);
  const [history, setHistory] = useState<SubmissionHistoryItem[]>([]);

  const [uploadTaxType, setUploadTaxType] = useState<ReturnTaxType | "OTHER">("OTHER");
  const [uploadPeriod, setUploadPeriod] = useState("");

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingId, setIsGeneratingId] = useState<string | null>(null);
  const [isGeneratingPackage, setIsGeneratingPackage] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [packageBasis, setPackageBasis] = useState<TaxPackageBasis>("accrual");
  const [packageYear, setPackageYear] = useState<string>(String(new Date().getFullYear()));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const appendHistory = useCallback((entry: Omit<SubmissionHistoryItem, "id" | "createdAt">) => {
    const next: SubmissionHistoryItem = {
      id: makeId("history"),
      createdAt: new Date().toISOString(),
      ...entry,
    };
    const merged = [next, ...loadSubmissionHistory()].slice(0, 200);
    saveSubmissionHistory(merged);
    if (isMountedRef.current) {
      setHistory(merged);
    }
  }, []);

  const refreshData = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsRefreshing(true);
    setError(null);

    try {
      accountingEngine.load();
      const postedEntries: JournalEntry[] = accountingEngine
        .getState()
        .journalEntries.filter((entry) => entry.status === "posted");

      const mappedTransactions = mapJournalEntriesToCompliance("entity-default", postedEntries);
      const computationTransactions = withTaxAdjustments("entity-default", mappedTransactions);
      if (computationTransactions.length > 0) {
        runTaxComputation({
          entityId: "entity-default",
          period: "current",
          transactions: computationTransactions,
        });
      }

      const scheduleRows = loadSchedules().filter(
        (schedule) =>
          schedule.entityId === "entity-default" &&
          (schedule.taxType === "VAT" || schedule.taxType === "CIT" || schedule.taxType === "WHT")
      );

      const statusMap = new Map<string, { stage: ComplianceStatusStage; updatedAt: string }>();
      loadComplianceStatuses()
        .filter((status) => status.entityId === "entity-default")
        .forEach((status) => {
          const key = `${status.taxType}::${status.period}`;
          if (!statusMap.has(key)) {
            statusMap.set(key, { stage: status.stage, updatedAt: status.updatedAt });
          }
        });

      const filingRows: FilingReturnRow[] = scheduleRows.map((schedule) => {
        const key = `${schedule.taxType}::${schedule.period}`;
        const tracked = statusMap.get(key);
        const status = stageToStatus(tracked?.stage || schedule.status);
        return {
          id: `file-${schedule.taxType}-${schedule.period}`,
          taxType: schedule.taxType as ReturnTaxType,
          period: schedule.period,
          status,
          taxAmount: Math.max(0, schedule.totalTax || 0),
          filingDate: status === "Filed" ? tracked?.updatedAt || null : null,
          source: "schedule",
          scheduleId: schedule.id,
        };
      });

      const payeByMonth = new Map<string, { payrollBase: number; payeRecorded: number }>();
      postedEntries.forEach((entry) => {
        const date = new Date(entry.date || entry.createdAt);
        if (Number.isNaN(date.getTime())) return;

        const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const bucket = payeByMonth.get(period) || { payrollBase: 0, payeRecorded: 0 };

        entry.lines.forEach((line) => {
          const code = (line.accountCode || "").trim();
          if (code === "5500") {
            bucket.payrollBase += Math.max(0, (line.debit || 0) - (line.credit || 0));
          }
          if (code === "2210") {
            bucket.payeRecorded += Math.max(0, (line.credit || 0) - (line.debit || 0));
          }
        });

        if (bucket.payrollBase > 0 || bucket.payeRecorded > 0) {
          payeByMonth.set(period, bucket);
        }
      });

      const payeRows: FilingReturnRow[] = Array.from(payeByMonth.entries()).map(([period, value]) => {
        const estimatedPaye = value.payrollBase * PAYE_ESTIMATE_RATE;
        const taxAmount = value.payeRecorded > 0 ? value.payeRecorded : estimatedPaye;
        return {
          id: `file-PAYE-${period}`,
          taxType: "PAYE",
          period,
          status: taxAmount > 0 ? "Ready" : "Draft",
          taxAmount,
          filingDate: null,
          source: "derived",
        };
      });

      const combined = [...filingRows, ...payeRows].sort((a, b) => {
        const periodDiff = parsePeriodRank(b.period) - parsePeriodRank(a.period);
        if (periodDiff !== 0) return periodDiff;
        return TAX_ORDER.indexOf(a.taxType) - TAX_ORDER.indexOf(b.taxType);
      });

      if (!isMountedRef.current) return;
      setPostedEntries(postedEntries);
      setSchedules(scheduleRows);
      setReturns(combined);
      setFilingPacks(loadFilingPacks().filter((pack) => pack.entityId === "entity-default"));
      setManualFilings(loadManualFilings());
      setHistory(loadSubmissionHistory());
      setStatusMessage(`Loaded ${combined.length} returns ready for filing.`);
    } catch (refreshError) {
      console.error("Unable to load filing data", refreshError);
      if (!isMountedRef.current) return;
      setError("Unable to load filing center right now.");
    } finally {
      if (!isMountedRef.current) return;
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    const unsubscribe = accountingEngine.subscribe(() => {
      refreshData();
    });
    return () => unsubscribe();
  }, [refreshData]);

  const generatePayePdf = useCallback(async (row: FilingReturnRow): Promise<{ blob: Blob; fileName: string }> => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    await configureJsPdfTypography(doc, "helvetica");
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    const dark: [number, number, number] = [50, 55, 60];
    const border: [number, number, number] = [190, 190, 190];
    const muted: [number, number, number] = [130, 130, 130];
    const formatMoney = (amount: number) =>
      `NGN ${Number.isFinite(amount) ? amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}`;

    let y = 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(0, 0, 0);
    doc.text("PAYE RETURN FILING DOCUMENT", margin, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...muted);
    doc.text("Entity: entity-default", margin, y);
    y += 6;

    doc.setDrawColor(...border);
    doc.setLineWidth(0.35);
    doc.line(margin, y, margin + contentWidth, y);
    y += 4;

    const infoY = y;
    const infoHeight = 24;
    const half = contentWidth / 2;
    const rowHeight = infoHeight / 3;
    doc.setLineWidth(0.3);
    doc.rect(margin, infoY, contentWidth, infoHeight);
    doc.line(margin + half, infoY, margin + half, infoY + infoHeight);
    doc.line(margin, infoY + rowHeight, margin + contentWidth, infoY + rowHeight);
    doc.line(margin, infoY + rowHeight * 2, margin + contentWidth, infoY + rowHeight * 2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(40, 40, 40);
    doc.text("Tax Type: PAYE", margin + 2, infoY + 5.5);
    doc.text(`Period: ${row.period}`, margin + half + 2, infoY + 5.5);
    doc.text(`Status: ${row.status.toUpperCase()}`, margin + 2, infoY + rowHeight + 5.5);
    doc.text("Due Date: Statutory monthly filing", margin + half + 2, infoY + rowHeight + 5.5);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}`, margin + 2, infoY + rowHeight * 2 + 5.5);
    doc.text(`Return ID: ${row.id.slice(-10)}`, margin + half + 2, infoY + rowHeight * 2 + 5.5);
    y = infoY + infoHeight + 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("RETURN SUMMARY", margin, y);
    y += 5;

    const labelWidth = contentWidth * 0.62;
    const tableHeaderHeight = 8;
    const bodyRowHeight = 8;
    const totalRowHeight = 9;
    const bodyRows: Array<[string, string]> = [
      ["Tax Regime", "PAYE"],
      ["Filing Period", row.period],
    ];
    const tableHeight = tableHeaderHeight + bodyRows.length * bodyRowHeight + totalRowHeight;

    doc.setDrawColor(...border);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, tableHeight);
    doc.line(margin + labelWidth, y, margin + labelWidth, y + tableHeight);

    doc.setFillColor(...dark);
    doc.rect(margin, y, contentWidth, tableHeaderHeight, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text("Description", margin + 2, y + 5.5);
    doc.text("Value", margin + labelWidth + 2, y + 5.5);

    let rowY = y + tableHeaderHeight;
    doc.setTextColor(35, 35, 35);
    doc.setFont("helvetica", "normal");
    bodyRows.forEach(([label, value]) => {
      doc.line(margin, rowY + bodyRowHeight, margin + contentWidth, rowY + bodyRowHeight);
      doc.text(label, margin + 2, rowY + 5.5);
      doc.text(value, margin + labelWidth + 2, rowY + 5.5);
      rowY += bodyRowHeight;
    });

    doc.setFillColor(...dark);
    doc.rect(margin, rowY, contentWidth, totalRowHeight, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("Total PAYE Payable", margin + 2, rowY + 6);
    doc.text(formatMoney(Math.max(0, row.taxAmount)), margin + labelWidth + 2, rowY + 6);

    const footerY = pageHeight - 12;
    doc.setDrawColor(...border);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 3.5, margin + contentWidth, footerY - 3.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(
      `Generated by Bace • ${new Date().toLocaleDateString("en-NG", { dateStyle: "long" })}`,
      margin,
      footerY
    );

    const fileName = `tax-PAYE-${row.period}.pdf`;
    return { blob: doc.output("blob"), fileName };
  }, []);

  const generateAndDownload = useCallback(
    async (row: FilingReturnRow) => {
      setIsGeneratingId(row.id);
      setError(null);
      try {
        if (row.taxType === "PAYE") {
          const payeDoc = await generatePayePdf(row);
          downloadBlob(payeDoc.blob, payeDoc.fileName);
          appendHistory({
            action: "generated_document",
            fileName: payeDoc.fileName,
            taxType: row.taxType,
            period: row.period,
          });
          setStatusMessage(`Generated and downloaded ${payeDoc.fileName}.`);
          return;
        }

        const schedule =
          schedules.find((item) => item.id === row.scheduleId) ||
          schedules.find((item) => item.taxType === row.taxType && item.period === row.period);

        if (!schedule) {
          throw new Error("No schedule found for this return.");
        }

        const pack = await generateFilingPack({
          entityId: "entity-default",
          schedule,
          format: "pdf",
        });

        if (pack.blob) {
          downloadBlob(pack.blob, pack.fileName);
        }

        appendHistory({
          action: "generated_document",
          fileName: pack.fileName,
          taxType: row.taxType,
          period: row.period,
        });

        if (!isMountedRef.current) return;
        setFilingPacks(loadFilingPacks().filter((item) => item.entityId === "entity-default"));
        setStatusMessage(`Generated and downloaded ${pack.fileName}.`);
      } catch (generationError) {
        console.error("Unable to generate filing document", generationError);
        if (!isMountedRef.current) return;
        setError("Could not generate filing document.");
      } finally {
        if (!isMountedRef.current) return;
        setIsGeneratingId(null);
      }
    },
    [appendHistory, generatePayePdf, schedules]
  );

  const downloadPackAgain = useCallback(
    async (pack: FilingPackResult) => {
      const related = returns.find((row) => row.taxType === pack.taxType && row.period === pack.period);
      if (related) {
        await generateAndDownload(related);
        appendHistory({
          action: "downloaded_pdf",
          fileName: pack.fileName,
          taxType: String(pack.taxType),
          period: pack.period,
        });
      }
    },
    [appendHistory, generateAndDownload, returns]
  );

  const handleManualUpload = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const now = new Date().toISOString();
      const existing = loadManualFilings();
      const created: ManualFilingRecord[] = Array.from(fileList).map((file) => ({
        id: makeId("manual"),
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: now,
        taxType: uploadTaxType,
        period: uploadPeriod || "N/A",
      }));

      const merged = [...created, ...existing].slice(0, 150);
      saveManualFilings(merged);
      created.forEach((record) => {
        appendHistory({
          action: "manual_upload",
          fileName: record.fileName,
          taxType: record.taxType,
          period: record.period,
        });
      });

      setManualFilings(merged);
      setStatusMessage(`Uploaded ${created.length} manual filing${created.length > 1 ? "s" : ""}.`);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [appendHistory, uploadPeriod, uploadTaxType]
  );

  const filingPackPdfs = useMemo(() => {
    return filingPacks
      .filter((pack) => pack.format === "pdf")
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }, [filingPacks]);

  const packageYearOptions = useMemo(() => {
    const years = new Set<number>();
    postedEntries.forEach((entry) => {
      const date = asDate(entry);
      years.add(date.getFullYear());
    });
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [postedEntries]);

  useEffect(() => {
    if (packageYearOptions.length === 0) return;
    if (!packageYearOptions.includes(Number(packageYear))) {
      setPackageYear(String(packageYearOptions[0]));
    }
  }, [packageYear, packageYearOptions]);

  const handleGenerateTaxPackage = useCallback(async () => {
    const selectedYear = Number(packageYear);
    if (!Number.isInteger(selectedYear)) {
      setError("Select a valid year for tax package generation.");
      return;
    }

    setIsGeneratingPackage(true);
    setError(null);
    try {
      accountingEngine.load();
      const state = accountingEngine.getState();
      const allPosted = state.journalEntries.filter((entry) => entry.status === "posted");
      const csvFiles = toPackageCsvFiles({
        entries: allPosted,
        year: selectedYear,
        basis: packageBasis,
      });

      const zip = new JSZip();
      csvFiles.forEach((file) => {
        zip.file(file.fileName, file.csv);
      });
      const generatedAt = new Date();
      zip.file(
        "README.txt",
        [
          "Bace Tax Package",
          `Year: ${selectedYear}`,
          `Basis: ${packageBasis}`,
          `Generated At: ${generatedAt.toISOString()}`,
          "",
          "Included files:",
          ...csvFiles.map((file) => `- ${file.fileName}`),
        ].join("\n")
      );

      const blob = await zip.generateAsync({ type: "blob" });
      const fileName = `tax-package-${selectedYear}-${packageBasis}.zip`;
      downloadBlob(blob, fileName);
      appendHistory({
        action: "generated_document",
        fileName,
        taxType: "PACKAGE",
        period: String(selectedYear),
      });
      setStatusMessage(
        `Generated tax package for ${selectedYear} (${packageBasis} basis) with ${csvFiles.length} CSV files.`
      );
      setShowPackageModal(false);
    } catch (generationError) {
      console.error("Unable to generate tax package", generationError);
      setError("Could not generate tax package right now.");
    } finally {
      setIsGeneratingPackage(false);
    }
  }, [appendHistory, packageBasis, packageYear]);

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">File Taxes</h1>
          <p className="mt-1 text-sm text-gray-500">Generate documents, download returns, upload manual filings, and track submissions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPackageModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16m-7 5h7" />
            </svg>
            Generate Tax Package
          </button>
          <button
            type="button"
            onClick={refreshData}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0a0a0a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1a1a] disabled:opacity-60"
          >
            <svg className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Filing Data
          </button>
        </div>
      </div>

      {(statusMessage || error) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-gray-200 bg-white text-gray-600"}`}>
          {error || statusMessage}
        </div>
      )}

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Generate Tax Return Documents</h2>
        <p className="mt-1 text-sm text-gray-500">Generate filing documents and download returns as PDF.</p>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Return Type</th>
                <th className="px-4 py-3 text-left font-semibold">Period</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Tax Amount</th>
                <th className="px-4 py-3 text-left font-semibold">Filing Date</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {returns.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No returns available for filing yet.</td>
                </tr>
              )}
              {returns.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-gray-900">{getTaxLabel(row.taxType)}</td>
                  <td className="px-4 py-3 text-gray-700">{row.period}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusPillClass(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(row.taxAmount)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatDate(row.filingDate)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => generateAndDownload(row)}
                      disabled={isGeneratingId === row.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      <svg className={`h-3.5 w-3.5 ${isGeneratingId === row.id ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" />
                      </svg>
                      Generate PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Download Returns (PDF)</h2>
        <p className="mt-1 text-sm text-gray-500">Previously generated return documents.</p>

        <div className="mt-4 space-y-3">
          {filingPackPdfs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
              No generated PDF returns yet.
            </div>
          )}
          {filingPackPdfs.map((pack) => (
            <div key={pack.id} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{pack.fileName}</p>
                <p className="text-xs text-gray-500">
                  {pack.taxType} • {pack.period} • Generated {formatDateTime(pack.generatedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => downloadPackAgain(pack)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" />
                </svg>
                Download
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Upload Manual Filings</h2>
        <p className="mt-1 text-sm text-gray-500">Upload filing evidence already submitted outside the platform.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <select
            value={uploadTaxType}
            onChange={(event) => setUploadTaxType(event.target.value as ReturnTaxType | "OTHER")}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
          >
            <option value="OTHER">Return type (Other)</option>
            <option value="VAT">VAT</option>
            <option value="CIT">CIT</option>
            <option value="PAYE">PAYE</option>
            <option value="WHT">WHT</option>
          </select>
          <input
            type="text"
            value={uploadPeriod}
            onChange={(event) => setUploadPeriod(event.target.value)}
            placeholder="Period (e.g. 2026-Q1)"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
          />
          <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv,.xlsx,.xls,.doc,.docx,.png,.jpg,.jpeg"
              multiple
              className="hidden"
              onChange={(event) => handleManualUpload(event.target.files)}
            />
            Upload Filing Files
          </label>
        </div>

        <div className="mt-4 space-y-2">
          {manualFilings.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500">
              No manual filings uploaded yet.
            </div>
          )}
          {manualFilings.slice(0, 8).map((record) => (
            <div key={record.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-gray-900">{record.fileName}</p>
              <p className="text-xs text-gray-500">
                {getTaxLabel(record.taxType)} • {record.period} • {formatFileSize(record.fileSize)} • Uploaded {formatDateTime(record.uploadedAt)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Submission History</h2>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Action</th>
                <th className="px-4 py-3 text-left font-semibold">Return</th>
                <th className="px-4 py-3 text-left font-semibold">Period</th>
                <th className="px-4 py-3 text-left font-semibold">File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No submission history yet.</td>
                </tr>
              )}
              {history.slice(0, 40).map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-gray-700">{formatDateTime(item.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-900">
                    {item.action === "generated_document"
                      ? "Generated Document"
                      : item.action === "downloaded_pdf"
                      ? "Downloaded PDF"
                      : "Manual Upload"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{item.taxType || "-"}</td>
                  <td className="px-4 py-3 text-gray-700">{item.period || "-"}</td>
                  <td className="px-4 py-3 text-gray-700">{item.fileName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showPackageModal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-[#2b2f44] bg-[#111427] text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2b2f44] px-5 py-4">
              <h3 className="text-xl font-semibold">Generate tax package</h3>
              <button
                type="button"
                onClick={() => setShowPackageModal(false)}
                className="rounded-md p-1 text-gray-300 hover:bg-white/10 hover:text-white"
                aria-label="Close package modal"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-[1fr_260px]">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-6">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="package-basis"
                      value="cash"
                      checked={packageBasis === "cash"}
                      onChange={() => setPackageBasis("cash")}
                      className="h-4 w-4 accent-white"
                    />
                    Cash
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="package-basis"
                      value="accrual"
                      checked={packageBasis === "accrual"}
                      onChange={() => setPackageBasis("accrual")}
                      className="h-4 w-4 accent-white"
                    />
                    Accrual
                  </label>
                </div>

                <div>
                  <label htmlFor="package-year" className="mb-2 block text-xs uppercase tracking-wide text-gray-300">
                    Filing year
                  </label>
                  <select
                    id="package-year"
                    value={packageYear}
                    onChange={(event) => setPackageYear(event.target.value)}
                    className="w-40 rounded-lg border border-[#3a3f5f] bg-[#0f1324] px-3 py-2 text-sm text-white"
                  >
                    {packageYearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-[#2b2f44] bg-gradient-to-b from-[#1b1f39] to-[#181c33] p-4">
                <p className="text-lg font-medium">Tax package</p>
                <ul className="mt-4 space-y-1 text-sm text-gray-300">
                  <li>balance_sheet.csv</li>
                  <li>general_ledger_rollforward.csv</li>
                  <li>income_statement.csv</li>
                  <li>trial_balance.csv</li>
                  <li>vendor_spending.csv</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#2b2f44] px-5 py-4">
              <button
                type="button"
                onClick={() => setShowPackageModal(false)}
                className="rounded-lg border border-[#3a3f5f] px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleGenerateTaxPackage()}
                disabled={isGeneratingPackage}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#111427] hover:bg-gray-100 disabled:opacity-70"
              >
                <svg
                  className={`h-4 w-4 ${isGeneratingPackage ? "animate-spin" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" />
                </svg>
                {isGeneratingPackage ? "Generating..." : "Download"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
