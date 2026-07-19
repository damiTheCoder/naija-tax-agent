"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { accountingEngine } from "@/lib/accounting/transactionBridge";
import type { JournalEntry } from "@/lib/accounting/doubleEntry";
import { mapJournalEntriesToCompliance } from "@/lib/tax/compliance/adapters";
import { runTaxComputation, type TaxSchedule } from "@/lib/tax/compliance";
import { loadComplianceStatuses, loadPayments, loadSchedules } from "@/lib/tax/compliance/store";
import { recordPayment, setComplianceStatus } from "@/lib/tax/compliance/workflow";
import { generateTaxRemittancePdf, type TaxRemittancePdfPayload } from "@/lib/taxRemittancePdf";
import { withTaxAdjustments } from "@/lib/tax/adjustments";
import { getTaxpayerProfile } from "@/lib/tax/settings";

type PaymentTaxType = "VAT" | "CIT" | "PAYE" | "WHT";

type TaxPaymentRow = {
  id: string;
  taxType: PaymentTaxType;
  period: string;
  dueDate: string;
  totalDue: number;
  amountPaid: number;
  outstanding: number;
  status: "Outstanding" | "Partial" | "Paid";
  scheduleId?: string;
};

type PaymentHistoryItem = {
  id: string;
  taxType: string;
  period: string;
  amount: number;
  paidAt: string;
  method: string;
  reference?: string;
  status: "pending" | "paid" | "failed";
};

type PaymentProof = {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  taxType: PaymentTaxType | "OTHER";
  period: string;
};

const PAYMENT_PROOFS_KEY = "ql::tax::payment-proofs";
const PAYE_ESTIMATE_RATE = 0.15;
const TAX_ORDER: PaymentTaxType[] = ["VAT", "CIT", "PAYE", "WHT"];

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatCurrency = (value: number) => currencyFormatter.format(Math.round(value || 0));

const formatDate = (value?: string | null) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
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

const readNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const periodRank = (period: string) => {
  const quarterMatch = period.match(/^(\d{4})-Q(\d)$/i);
  if (quarterMatch) {
    return Number(quarterMatch[1]) * 100 + Number(quarterMatch[2]) * 3;
  }
  const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    return Number(monthMatch[1]) * 100 + Number(monthMatch[2]);
  }
  const yearMatch = period.match(/^(\d{4})/);
  if (yearMatch) {
    return Number(yearMatch[1]) * 100 + 12;
  }
  return 0;
};

const getStatusClass = (status: TaxPaymentRow["status"] | PaymentHistoryItem["status"]) => {
  if (status === "Paid" || status === "paid") return "bg-emerald-50 text-emerald-700";
  if (status === "Partial" || status === "pending") return "bg-amber-50 text-amber-700";
  if (status === "failed") return "bg-red-50 text-red-700";
  return "bg-gray-100 text-gray-700";
};

const getTaxLabel = (taxType: string) => {
  const upper = String(taxType).toUpperCase();
  if (upper === "VAT") return "VAT";
  if (upper === "CIT") return "CIT";
  if (upper === "PAYE") return "PAYE";
  if (upper === "WHT") return "WHT";
  return upper || "OTHER";
};

const mapTaxLabelToPdfTaxType = (taxLabel: string): TaxRemittancePdfPayload["taxType"] => {
  if (taxLabel === "PAYE") return "PIT";
  if (
    taxLabel === "VAT" ||
    taxLabel === "WHT" ||
    taxLabel === "CIT" ||
    taxLabel === "PIT" ||
    taxLabel === "CGT" ||
    taxLabel === "TET" ||
    taxLabel === "POLICE_LEVY" ||
    taxLabel === "NASENI" ||
    taxLabel === "DEV_LEVY" ||
    taxLabel === "OTHER"
  ) {
    return taxLabel;
  }
  if (taxLabel === "STAMP" || taxLabel === "STAMP_DUTY") return "STAMP_DUTY";
  return "OTHER";
};

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const readProofs = (): PaymentProof[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PAYMENT_PROOFS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PaymentProof[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveProofs = (proofs: PaymentProof[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PAYMENT_PROOFS_KEY, JSON.stringify(proofs));
};

const getPayeDueDate = (period: string) => {
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (!match) return `${new Date().getFullYear()}-12-10`;
  let year = Number(match[1]);
  let month = Number(match[2]) + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, "0")}-10`;
};

export default function TaxPaymentsPage() {
  const [rows, setRows] = useState<TaxPaymentRow[]>([]);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [schedules, setSchedules] = useState<TaxSchedule[]>([]);

  const [uploadTaxType, setUploadTaxType] = useState<PaymentTaxType | "OTHER">("OTHER");
  const [uploadPeriod, setUploadPeriod] = useState("");

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPayingId, setIsPayingId] = useState<string | null>(null);
  const [isDownloadingReceiptId, setIsDownloadingReceiptId] = useState<string | null>(null);
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

      const relevantSchedules = loadSchedules().filter(
        (schedule) =>
          schedule.entityId === "entity-default" &&
          (schedule.taxType === "VAT" || schedule.taxType === "CIT" || schedule.taxType === "WHT")
      );

      const payments = loadPayments() as unknown as PaymentHistoryItem[];
      const relevantPayments = payments.filter((payment) => {
        const type = String(payment.taxType || "").toUpperCase();
        return type === "VAT" || type === "CIT" || type === "WHT" || type === "PAYE";
      });

      const amountPaidByKey = new Map<string, number>();
      relevantPayments
        .filter((payment) => payment.status === "paid")
        .forEach((payment) => {
          const taxType = String(payment.taxType || "").toUpperCase();
          const key = `${taxType}::${payment.period}`;
          const next = (amountPaidByKey.get(key) || 0) + readNumber(payment.amount);
          amountPaidByKey.set(key, next);
        });

      const statusMap = new Map<string, string>();
      loadComplianceStatuses()
        .filter((status) => status.entityId === "entity-default")
        .forEach((status) => {
          const key = `${status.taxType}::${status.period}`;
          if (!statusMap.has(key)) {
            statusMap.set(key, status.stage);
          }
        });

      const scheduleRows: TaxPaymentRow[] = relevantSchedules.map((schedule) => {
        const taxType = schedule.taxType as PaymentTaxType;
        const key = `${taxType}::${schedule.period}`;
        const paid = amountPaidByKey.get(key) || 0;
        const due = Math.max(0, schedule.totalTax || 0);
        const outstanding = Math.max(0, due - paid);

        let status: TaxPaymentRow["status"] = "Outstanding";
        if (outstanding <= 0 && due > 0) status = "Paid";
        else if (paid > 0 && outstanding > 0) status = "Partial";

        const stage = statusMap.get(key);
        if ((stage === "paid" || stage === "reconciled") && due > 0) {
          status = "Paid";
        }

        return {
          id: `payment-${taxType}-${schedule.period}`,
          taxType,
          period: schedule.period,
          dueDate: schedule.dueDate,
          totalDue: due,
          amountPaid: paid,
          outstanding,
          status,
          scheduleId: schedule.id,
        };
      });

      const payeBuckets = new Map<string, { payrollBase: number; payeRecorded: number }>();
      postedEntries.forEach((entry) => {
        const date = new Date(entry.date || entry.createdAt);
        if (Number.isNaN(date.getTime())) return;

        const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const bucket = payeBuckets.get(period) || { payrollBase: 0, payeRecorded: 0 };

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
          payeBuckets.set(period, bucket);
        }
      });

      const payeRows: TaxPaymentRow[] = Array.from(payeBuckets.entries()).map(([period, bucket]) => {
        const due = bucket.payeRecorded > 0 ? bucket.payeRecorded : bucket.payrollBase * PAYE_ESTIMATE_RATE;
        const key = `PAYE::${period}`;
        const paid = amountPaidByKey.get(key) || 0;
        const outstanding = Math.max(0, due - paid);

        let status: TaxPaymentRow["status"] = "Outstanding";
        if (outstanding <= 0 && due > 0) status = "Paid";
        else if (paid > 0 && outstanding > 0) status = "Partial";

        return {
          id: `payment-PAYE-${period}`,
          taxType: "PAYE",
          period,
          dueDate: getPayeDueDate(period),
          totalDue: Math.max(0, due),
          amountPaid: paid,
          outstanding,
          status,
        };
      });

      const combinedRows = [...scheduleRows, ...payeRows]
        .filter((row) => row.totalDue > 0)
        .sort((a, b) => {
          const periodDiff = periodRank(b.period) - periodRank(a.period);
          if (periodDiff !== 0) return periodDiff;
          return TAX_ORDER.indexOf(a.taxType) - TAX_ORDER.indexOf(b.taxType);
        });

      const sortedHistory = [...relevantPayments].sort(
        (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
      );

      if (!isMountedRef.current) return;
      setRows(combinedRows);
      setHistory(sortedHistory);
      setSchedules(relevantSchedules);
      setProofs(readProofs());
      setStatusMessage(`Loaded ${combinedRows.length} tax payment obligations.`);
    } catch (refreshError) {
      console.error("Unable to load tax payments", refreshError);
      if (!isMountedRef.current) return;
      setError("Unable to load tax payments right now.");
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

  const downloadReceipt = useCallback(async (payment: PaymentHistoryItem, scheduleId?: string) => {
    const actionId = `receipt-${payment.id}`;
    setIsDownloadingReceiptId(actionId);
    setError(null);

    try {
      const taxTypeForPdf = mapTaxLabelToPdfTaxType(getTaxLabel(payment.taxType));
      const taxpayerProfile = getTaxpayerProfile("entity-default");
      const ref =
        payment.reference ||
        `PAY-${getTaxLabel(payment.taxType)}-${payment.period}-${Date.now().toString().slice(-6)}`;

      const generatedRef = await generateTaxRemittancePdf({
        taxpayerName: taxpayerProfile.taxpayerName,
        businessName: taxpayerProfile.businessName,
        taxType: taxTypeForPdf,
        period: payment.period,
        dueDate: payment.paidAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        taxAmount: payment.amount,
        scheduleId: scheduleId || `receipt-${payment.id}`,
        paymentReference: ref,
      });

      if (!isMountedRef.current) return;
      setStatusMessage(`Payment receipt downloaded. Reference: ${generatedRef}`);
    } catch (receiptError) {
      console.error("Unable to download payment receipt", receiptError);
      if (!isMountedRef.current) return;
      setError("Could not download payment receipt.");
    } finally {
      if (!isMountedRef.current) return;
      setIsDownloadingReceiptId(null);
    }
  }, []);

  const payTaxDirectly = useCallback(
    async (row: TaxPaymentRow) => {
      if (row.outstanding <= 0) return;
      setIsPayingId(row.id);
      setError(null);

      try {
        const reference = `PAY-${row.taxType}-${row.period}-${Date.now().toString().slice(-6)}`;

        const payment = recordPayment({
          entityId: "entity-default",
          period: row.period,
          taxType: row.taxType,
          amount: row.outstanding,
          method: "direct_pay",
          reference,
          status: "paid",
          actor: "user",
        });

        setComplianceStatus({
          entityId: "entity-default",
          period: row.period,
          taxType: row.taxType,
          stage: "paid",
          actor: "user",
        });

        await downloadReceipt(payment as unknown as PaymentHistoryItem, row.scheduleId);
        if (!isMountedRef.current) return;
        refreshData();
      } catch (paymentError) {
        console.error("Unable to process direct payment", paymentError);
        if (!isMountedRef.current) return;
        setError("Could not process direct payment.");
      } finally {
        if (!isMountedRef.current) return;
        setIsPayingId(null);
      }
    },
    [downloadReceipt, refreshData]
  );

  const handleProofUpload = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const createdAt = new Date().toISOString();
      const created: PaymentProof[] = Array.from(files).map((file) => ({
        id: makeId("proof"),
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: createdAt,
        taxType: uploadTaxType,
        period: uploadPeriod || "N/A",
      }));

      const merged = [...created, ...readProofs()].slice(0, 150);
      saveProofs(merged);
      setProofs(merged);
      setStatusMessage(`Uploaded ${created.length} payment proof${created.length > 1 ? "s" : ""}.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [uploadPeriod, uploadTaxType]
  );

  const outstandingRows = useMemo(() => rows.filter((row) => row.outstanding > 0), [rows]);
  const paidRows = useMemo(() => rows.filter((row) => row.status === "Paid"), [rows]);

  const totals = useMemo(() => {
    const outstanding = rows.reduce((sum, row) => sum + row.outstanding, 0);
    const paid = history
      .filter((item) => item.status === "paid")
      .reduce((sum, item) => sum + readNumber(item.amount), 0);
    return {
      outstanding,
      paid,
      paymentCount: history.length,
      outstandingCount: outstandingRows.length,
      paidCount: paidRows.length,
    };
  }, [history, outstandingRows.length, paidRows.length, rows]);

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tax Payments</h1>
          <p className="mt-1 text-sm text-gray-500">Track outstanding taxes, paid taxes, receipts, and payment status in one place.</p>
        </div>
        <button
          type="button"
          onClick={refreshData}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0a0a0a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1a1a] disabled:opacity-60"
        >
          <svg className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Payments
        </button>
      </div>

      {(statusMessage || error) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-gray-200 bg-white text-gray-600"}`}>
          {error || statusMessage}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Outstanding Taxes</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(totals.outstanding)}</p>
          <p className="mt-1 text-xs text-gray-500">{totals.outstandingCount} obligations</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Paid Taxes</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{formatCurrency(totals.paid)}</p>
          <p className="mt-1 text-xs text-gray-500">{totals.paidCount} fully paid</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payment History</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{totals.paymentCount}</p>
          <p className="mt-1 text-xs text-gray-500">All payment records</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payment Proofs</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{proofs.length}</p>
          <p className="mt-1 text-xs text-gray-500">Uploaded proof documents</p>
        </div>
      </div>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Outstanding Taxes</h2>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Tax</th>
                <th className="px-4 py-3 text-left font-semibold">Period</th>
                <th className="px-4 py-3 text-left font-semibold">Due Date</th>
                <th className="px-4 py-3 text-right font-semibold">Outstanding</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {outstandingRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No outstanding taxes at the moment.</td>
                </tr>
              )}
              {outstandingRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-gray-900">{getTaxLabel(row.taxType)}</td>
                  <td className="px-4 py-3 text-gray-700">{row.period}</td>
                  <td className="px-4 py-3 text-gray-700">{formatDate(row.dueDate)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(row.outstanding)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void payTaxDirectly(row)}
                      disabled={isPayingId === row.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                    >
                      <svg className={`h-3.5 w-3.5 ${isPayingId === row.id ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-3.3 0-6 1.8-6 4s2.7 4 6 4 6-1.8 6-4-2.7-4-6-4zm0 0V4m0 12v4" />
                      </svg>
                      Pay Now
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Payment History</h2>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Tax</th>
                <th className="px-4 py-3 text-left font-semibold">Period</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                <th className="px-4 py-3 text-left font-semibold">Method</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {history.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No tax payments recorded yet.</td>
                </tr>
              )}
              {history.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-4 py-3 text-gray-700">{formatDateTime(payment.paidAt)}</td>
                  <td className="px-4 py-3 text-gray-900">{getTaxLabel(payment.taxType)}</td>
                  <td className="px-4 py-3 text-gray-700">{payment.period}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(payment.amount)}</td>
                  <td className="px-4 py-3 text-gray-700">{payment.method || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(payment.status)}`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{payment.reference || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Payment Receipts</h2>
        <p className="mt-1 text-sm text-gray-500">Download payment receipts for completed tax payments.</p>

        <div className="mt-4 space-y-3">
          {history.filter((payment) => payment.status === "paid").length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
              No paid tax receipts available yet.
            </div>
          )}
          {history
            .filter((payment) => payment.status === "paid")
            .slice(0, 20)
            .map((payment) => (
              <div key={`receipt-${payment.id}`} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {getTaxLabel(payment.taxType)} • {payment.period} • {formatCurrency(payment.amount)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Paid {formatDateTime(payment.paidAt)}
                    {payment.reference ? ` • Ref: ${payment.reference}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void downloadReceipt(payment)}
                  disabled={isDownloadingReceiptId === `receipt-${payment.id}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  <svg className={`h-3.5 w-3.5 ${isDownloadingReceiptId === `receipt-${payment.id}` ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" />
                  </svg>
                  Download Receipt
                </button>
              </div>
            ))}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Upload Payment Proof</h2>
        <p className="mt-1 text-sm text-gray-500">Attach bank transfer slips or tax portal confirmations.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <select
            value={uploadTaxType}
            onChange={(event) => setUploadTaxType(event.target.value as PaymentTaxType | "OTHER")}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
          >
            <option value="OTHER">Tax Type (Other)</option>
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
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.csv"
              className="hidden"
              onChange={(event) => handleProofUpload(event.target.files)}
            />
            Upload Proof Files
          </label>
        </div>

        <div className="mt-4 space-y-2">
          {proofs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500">
              No payment proof uploaded yet.
            </div>
          )}
          {proofs.slice(0, 10).map((proof) => (
            <div key={proof.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-gray-900">{proof.fileName}</p>
              <p className="text-xs text-gray-500">
                {getTaxLabel(proof.taxType)} • {proof.period} • {formatFileSize(proof.fileSize)} • Uploaded {formatDateTime(proof.uploadedAt)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
