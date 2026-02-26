"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { accountingEngine } from "@/lib/accounting/transactionBridge";
import type { JournalEntry } from "@/lib/accounting/doubleEntry";
import { mapJournalEntriesToCompliance } from "@/lib/tax/compliance/adapters";
import { runTaxComputation, type ComplianceStatusStage, type TaxSchedule } from "@/lib/tax/compliance";
import { loadComplianceStatuses, loadPayments, loadSchedules } from "@/lib/tax/compliance/store";
import { withTaxAdjustments } from "@/lib/tax/adjustments";

type ReturnTaxType = "VAT" | "CIT" | "PAYE" | "WHT";
type ReturnStatus = "Draft" | "Ready" | "Filed";

type TaxReturnRow = {
  id: string;
  taxType: ReturnTaxType;
  period: string;
  status: ReturnStatus;
  taxAmount: number;
  filingDate: string | null;
  source: "schedule" | "derived";
};

type PaymentLike = {
  period: string;
  taxType: string;
  status: string;
  paidAt?: string;
};

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

const getTaxLabel = (taxType: ReturnTaxType) => {
  if (taxType === "VAT") return "VAT Return";
  if (taxType === "CIT") return "CIT Return";
  if (taxType === "PAYE") return "PAYE Return";
  return "WHT Return";
};

export default function TaxReturnsPage() {
  const [rows, setRows] = useState<TaxReturnRow[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const computeReturns = useCallback(() => {
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

      const schedules = loadSchedules().filter(
        (schedule) =>
          schedule.entityId === "entity-default" &&
          (schedule.taxType === "VAT" || schedule.taxType === "CIT" || schedule.taxType === "WHT")
      );

      const complianceStatuses = loadComplianceStatuses().filter((status) => status.entityId === "entity-default");
      const payments = (loadPayments() as unknown as PaymentLike[]).filter((payment) => payment.period);

      const statusByKey = new Map<string, { stage: ComplianceStatusStage; updatedAt: string }>();
      complianceStatuses.forEach((status) => {
        const key = `${status.taxType}::${status.period}`;
        if (!statusByKey.has(key)) {
          statusByKey.set(key, { stage: status.stage, updatedAt: status.updatedAt });
        }
      });

      const paidByKey = new Map<string, string>();
      payments
        .filter((payment) => String(payment.status).toLowerCase() === "paid")
        .forEach((payment) => {
          const key = `${String(payment.taxType).toUpperCase()}::${payment.period}`;
          if (!paidByKey.has(key) && payment.paidAt) {
            paidByKey.set(key, payment.paidAt);
          }
        });

      const scheduleRows: TaxReturnRow[] = schedules.map((schedule: TaxSchedule) => {
        const key = `${schedule.taxType}::${schedule.period}`;
        const tracked = statusByKey.get(key);
        const status = stageToStatus(tracked?.stage || schedule.status);
        const paymentDate = paidByKey.get(key) || null;
        const filingDate = status === "Filed" ? tracked?.updatedAt || paymentDate : null;

        return {
          id: `return-${schedule.taxType}-${schedule.period}`,
          taxType: schedule.taxType as ReturnTaxType,
          period: schedule.period,
          status,
          taxAmount: Math.max(0, schedule.totalTax || 0),
          filingDate,
          source: "schedule",
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

      const payeRows: TaxReturnRow[] = Array.from(payeByMonth.entries()).map(([period, value]) => {
        const estimatedPaye = value.payrollBase * PAYE_ESTIMATE_RATE;
        const taxAmount = value.payeRecorded > 0 ? value.payeRecorded : estimatedPaye;

        const key = `PAYE::${period}`;
        const paymentDate = paidByKey.get(key) || null;
        const status: ReturnStatus = paymentDate ? "Filed" : taxAmount > 0 ? "Ready" : "Draft";

        return {
          id: `return-PAYE-${period}`,
          taxType: "PAYE",
          period,
          status,
          taxAmount,
          filingDate: paymentDate,
          source: "derived",
        };
      });

      const combined = [...scheduleRows, ...payeRows].sort((a, b) => {
        const periodDiff = parsePeriodRank(b.period) - parsePeriodRank(a.period);
        if (periodDiff !== 0) return periodDiff;
        return TAX_ORDER.indexOf(a.taxType) - TAX_ORDER.indexOf(b.taxType);
      });

      if (!isMountedRef.current) return;
      setRows(combined);
      setStatusMessage(`Loaded ${combined.length} returns across VAT, CIT, PAYE, and WHT.`);
    } catch (computeError) {
      console.error("Unable to compute tax returns", computeError);
      if (!isMountedRef.current) return;
      setError("Unable to load tax returns right now.");
    } finally {
      if (!isMountedRef.current) return;
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    computeReturns();
    const unsubscribe = accountingEngine.subscribe(() => {
      computeReturns();
    });
    return () => unsubscribe();
  }, [computeReturns]);

  const totals = useMemo(() => {
    return {
      VAT: rows.filter((row) => row.taxType === "VAT").length,
      CIT: rows.filter((row) => row.taxType === "CIT").length,
      PAYE: rows.filter((row) => row.taxType === "PAYE").length,
      WHT: rows.filter((row) => row.taxType === "WHT").length,
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tax Returns</h1>
          <p className="mt-1 text-sm text-gray-500">Filing center for VAT, CIT, PAYE, and WHT returns.</p>
        </div>
        <button
          type="button"
          onClick={computeReturns}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0a0a0a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1a1a] disabled:opacity-60"
        >
          <svg className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Returns
        </button>
      </div>

      {(statusMessage || error) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-gray-200 bg-white text-gray-600"}`}>
          {error || statusMessage}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">VAT Returns</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{totals.VAT}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">CIT Returns</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{totals.CIT}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">PAYE Returns</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{totals.PAYE}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">WHT Returns</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{totals.WHT}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Return Type</th>
              <th className="px-4 py-3 text-left font-semibold">Period</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Tax Amount</th>
              <th className="px-4 py-3 text-left font-semibold">Filing Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No returns available yet.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 text-gray-900">
                  <div className="flex items-center gap-2">
                    <span>{getTaxLabel(row.taxType)}</span>
                    {row.source === "derived" && (
                      <span className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        Derived
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">{row.period}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusPillClass(row.status)}`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(row.taxAmount)}</td>
                <td className="px-4 py-3 text-gray-700">{formatDate(row.filingDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
