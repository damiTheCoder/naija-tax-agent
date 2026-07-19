"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { accountingEngine } from "@/lib/accounting/transactionBridge";
import type { JournalEntry } from "@/lib/accounting/doubleEntry";
import { mapJournalEntriesToCompliance } from "@/lib/tax/compliance/adapters";
import { runTaxComputation, type TaxComputationResult, type TaxSchedule } from "@/lib/tax/compliance";
import { withTaxAdjustments } from "@/lib/tax/adjustments";
import { generateTaxComputationPdf } from "@/lib/taxComputationPdf";

type CITMetadata = {
  disallowable?: number;
  nonTaxable?: number;
  capitalAllowance?: number;
  lossCarryForward?: number;
  taxableProfit?: number;
  rate?: number;
  minimumTax?: number;
  taxPayable?: number;
};

type VATMetadata = {
  outputVat?: number;
  inputVat?: number;
};

type MonthlyPayeRow = {
  period: string;
  payrollBase: number;
  payeRecorded: number;
  payeForDisplay: number;
  status: "Recorded" | "Estimated";
};

const PAYE_ESTIMATE_RATE = 0.15;

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatCurrencyFull = (amount: number) => currencyFormatter.format(Math.round(amount || 0));

const formatCurrencyCompact = (amount: number) => {
  const value = Math.round(amount || 0);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs < 1_000) return `${sign}${formatCurrencyFull(abs)}`;

  const compactTo = (divisor: number, suffix: string) => {
    const scaled = abs / divisor;
    const rounded = scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, "");
    return `${sign}₦${rounded}${suffix}`;
  };

  if (abs < 1_000_000) return compactTo(1_000, "K");
  if (abs < 1_000_000_000) return compactTo(1_000_000, "M");
  return compactTo(1_000_000_000, "b");
};

const readNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const codeNumber = (accountCode?: string) => {
  const parsed = Number((accountCode || "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const isRevenueCode = (code: string) => code.startsWith("4");
const isCogsCode = (code: string) => {
  const value = codeNumber(code);
  return value >= 5000 && value <= 5499;
};
const isOperatingExpenseCode = (code: string) => {
  const value = codeNumber(code);
  return value >= 5500 && value <= 6999;
};

const formatPeriodLabel = (period: string | undefined) => {
  if (!period) return "Current period";
  return period;
};

const formatMonthLabel = (period: string) => {
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (!match) return period;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const date = new Date(year, month, 1);
  return date.toLocaleDateString("en-NG", { month: "short", year: "numeric" });
};

function AmountValue({ amount, className = "" }: { amount: number; className?: string }) {
  return (
    <span
      title={formatCurrencyFull(amount)}
      className={`inline-flex items-center font-semibold text-gray-900 ${className}`.trim()}
    >
      {formatCurrencyCompact(amount)}
    </span>
  );
}

function AmountLine({ label, amount, emphasis = false }: { label: string; amount: number; emphasis?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-[1fr_auto] md:items-center">
      <p className={`text-sm ${emphasis ? "font-semibold text-gray-900" : "text-gray-700"}`}>{label}</p>
      <div className="border-y border-gray-300 py-1 md:justify-self-end">
        <AmountValue amount={amount} className={emphasis ? "text-base" : "text-sm"} />
      </div>
    </div>
  );
}

export default function TaxComputationPage() {
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [computation, setComputation] = useState<TaxComputationResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const runComputation = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsRefreshing(true);
    setError(null);

    try {
      accountingEngine.load();
      const postedEntries = accountingEngine
        .getState()
        .journalEntries.filter((entry) => entry.status === "posted");

      if (!isMountedRef.current) return;
      setJournalEntries(postedEntries);

      const mappedTransactions = mapJournalEntriesToCompliance("entity-default", postedEntries);
      const computationTransactions = withTaxAdjustments("entity-default", mappedTransactions);
      if (!computationTransactions.length) {
        if (!isMountedRef.current) return;
        setComputation(null);
        setStatusMessage("No posted accounting transactions or tax adjustments found yet.");
        return;
      }

      const result = runTaxComputation({
        entityId: "entity-default",
        period: "current",
        transactions: computationTransactions,
      });

      if (!isMountedRef.current) return;
      setComputation(result);
      setStatusMessage(`Computed ${result.schedules.length} schedules for ${result.period}.`);
    } catch (computeError) {
      console.error("Tax computation failed", computeError);
      if (!isMountedRef.current) return;
      setError("Unable to compute taxes from accounting records right now.");
    } finally {
      if (!isMountedRef.current) return;
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    runComputation();
    const unsubscribe = accountingEngine.subscribe(() => {
      runComputation();
    });
    return () => unsubscribe();
  }, [runComputation]);

  const schedules = computation?.schedules || [];

  const citSchedule = useMemo<TaxSchedule | undefined>(() => {
    return schedules.find((schedule) => schedule.taxType === "CIT");
  }, [schedules]);

  const vatSchedule = useMemo<TaxSchedule | undefined>(() => {
    return schedules.find((schedule) => schedule.taxType === "VAT");
  }, [schedules]);

  const whtSchedule = useMemo<TaxSchedule | undefined>(() => {
    return schedules.find((schedule) => schedule.taxType === "WHT");
  }, [schedules]);

  const incomeComputation = useMemo(() => {
    let revenue = 0;
    let cogs = 0;
    let operatingExpenses = 0;

    journalEntries.forEach((entry) => {
      entry.lines.forEach((line) => {
        const code = (line.accountCode || "").trim();
        if (!code) return;

        const debit = line.debit || 0;
        const credit = line.credit || 0;

        if (isRevenueCode(code)) {
          revenue += Math.max(0, credit - debit);
        }
        if (isCogsCode(code)) {
          cogs += Math.max(0, debit - credit);
        }
        if (isOperatingExpenseCode(code)) {
          operatingExpenses += Math.max(0, debit - credit);
        }
      });
    });

    const grossProfit = revenue - cogs;
    const taxableProfitBeforeAdjustments = grossProfit - operatingExpenses;

    const citMeta = (citSchedule?.metadata || {}) as CITMetadata;
    const addBacks = readNumber(citMeta.disallowable);
    const deductions =
      readNumber(citMeta.nonTaxable) +
      readNumber(citMeta.capitalAllowance) +
      readNumber(citMeta.lossCarryForward);

    const adjustedTaxableProfit =
      readNumber(citMeta.taxableProfit) > 0
        ? readNumber(citMeta.taxableProfit)
        : Math.max(0, taxableProfitBeforeAdjustments + addBacks - deductions);

    const taxRate = readNumber(citMeta.rate);
    const computedIncomeTax = adjustedTaxableProfit * taxRate;
    const minimumTax = readNumber(citMeta.minimumTax);
    const taxPayable = Math.max(
      0,
      typeof citSchedule?.totalTax === "number" ? citSchedule.totalTax : computedIncomeTax
    );

    return {
      revenue,
      cogs,
      grossProfit,
      operatingExpenses,
      taxableProfitBeforeAdjustments,
      addBacks,
      deductions,
      adjustedTaxableProfit,
      taxRate,
      computedIncomeTax,
      minimumTax,
      taxPayable,
    };
  }, [journalEntries, citSchedule]);

  const vatComputation = useMemo(() => {
    const vatMeta = (vatSchedule?.metadata || {}) as VATMetadata;
    const vatEntries = (computation?.ledgerEntries || []).filter((entry) => entry.taxType === "VAT");

    const outputVatFromLedger = vatEntries
      .filter((entry) => entry.taxAmount > 0)
      .reduce((sum, entry) => sum + entry.taxAmount, 0);
    const inputVatFromLedger = vatEntries
      .filter((entry) => entry.taxAmount < 0)
      .reduce((sum, entry) => sum + Math.abs(entry.taxAmount), 0);

    const outputVat = readNumber(vatMeta.outputVat) > 0 ? readNumber(vatMeta.outputVat) : outputVatFromLedger;
    const inputVat = readNumber(vatMeta.inputVat) > 0 ? readNumber(vatMeta.inputVat) : inputVatFromLedger;
    const netVat = outputVat - inputVat;

    return {
      outputVat,
      inputVat,
      vatPayable: Math.max(0, typeof vatSchedule?.totalTax === "number" ? vatSchedule.totalTax : netVat),
      vatCredit: Math.max(0, -netVat),
    };
  }, [computation?.ledgerEntries, vatSchedule]);

  const whtComputation = useMemo(() => {
    const entries = (computation?.ledgerEntries || []).filter((entry) => entry.taxType === "WHT");

    const totalDeducted = entries
      .filter((entry) => entry.taxAmount > 0)
      .reduce((sum, entry) => sum + entry.taxAmount, 0);

    const totalSuffered = entries
      .filter((entry) => entry.taxAmount < 0)
      .reduce((sum, entry) => sum + Math.abs(entry.taxAmount), 0);

    const netPosition = totalDeducted - totalSuffered;

    return {
      totalDeducted,
      totalSuffered,
      netPosition,
      payable: Math.max(0, typeof whtSchedule?.totalTax === "number" ? whtSchedule.totalTax : netPosition),
      receivable: Math.max(0, -netPosition),
    };
  }, [computation?.ledgerEntries, whtSchedule]);

  const payeComputation = useMemo(() => {
    const monthly = new Map<string, { payrollBase: number; payeRecorded: number }>();

    journalEntries.forEach((entry) => {
      const date = new Date(entry.date || entry.createdAt);
      if (Number.isNaN(date.getTime())) return;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const bucket = monthly.get(key) || { payrollBase: 0, payeRecorded: 0 };

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
        monthly.set(key, bucket);
      }
    });

    const rows: MonthlyPayeRow[] = Array.from(monthly.entries())
      .map(([period, bucket]) => {
        const estimated = bucket.payrollBase * PAYE_ESTIMATE_RATE;
        const payeForDisplay = bucket.payeRecorded > 0 ? bucket.payeRecorded : estimated;
        const status: MonthlyPayeRow["status"] = bucket.payeRecorded > 0 ? "Recorded" : "Estimated";
        return {
          period,
          payrollBase: bucket.payrollBase,
          payeRecorded: bucket.payeRecorded,
          payeForDisplay,
          status,
        };
      })
      .sort((a, b) => b.period.localeCompare(a.period));

    const totalPayrollBase = rows.reduce((sum, row) => sum + row.payrollBase, 0);
    const totalPayeRecorded = rows.reduce((sum, row) => sum + row.payeRecorded, 0);
    const totalPayeForDisplay = rows.reduce((sum, row) => sum + row.payeForDisplay, 0);

    return {
      rows,
      totalPayrollBase,
      totalPayeRecorded,
      totalPayeForDisplay,
    };
  }, [journalEntries]);

  const handleDownloadPdf = useCallback(async () => {
    if (!computation) {
      setStatusMessage("No computation available yet. Run computation first.");
      return;
    }

    setIsExportingPdf(true);
    setError(null);
    try {
      await generateTaxComputationPdf({
        period: formatPeriodLabel(computation.period),
        generatedAt: new Date().toISOString(),
        incomeTax: {
          revenue: incomeComputation.revenue,
          cogs: incomeComputation.cogs,
          grossProfit: incomeComputation.grossProfit,
          operatingExpenses: incomeComputation.operatingExpenses,
          taxableProfitBeforeAdjustments: incomeComputation.taxableProfitBeforeAdjustments,
          addBacks: incomeComputation.addBacks,
          deductions: incomeComputation.deductions,
          adjustedTaxableProfit: incomeComputation.adjustedTaxableProfit,
          taxRate: incomeComputation.taxRate,
          computedIncomeTax: incomeComputation.computedIncomeTax,
          minimumTax: incomeComputation.minimumTax,
          taxPayable: incomeComputation.taxPayable,
        },
        vat: {
          outputVat: vatComputation.outputVat,
          inputVat: vatComputation.inputVat,
          vatPayable: vatComputation.vatPayable,
          vatCredit: vatComputation.vatCredit,
        },
        wht: {
          totalDeducted: whtComputation.totalDeducted,
          totalSuffered: whtComputation.totalSuffered,
          netPosition: whtComputation.netPosition,
          payable: whtComputation.payable,
          receivable: whtComputation.receivable,
        },
        paye: {
          totalPayrollBase: payeComputation.totalPayrollBase,
          totalPayeRecorded: payeComputation.totalPayeRecorded,
          totalPayeForDisplay: payeComputation.totalPayeForDisplay,
          rows: payeComputation.rows.map((row) => ({
            period: formatMonthLabel(row.period),
            payrollBase: row.payrollBase,
            payeForDisplay: row.payeForDisplay,
            status: row.status,
          })),
        },
      });
      setStatusMessage("Tax computation PDF downloaded.");
    } catch (downloadError) {
      console.error("Failed to generate computation PDF", downloadError);
      setError("Could not generate PDF output right now.");
    } finally {
      setIsExportingPdf(false);
    }
  }, [computation, incomeComputation, payeComputation, vatComputation, whtComputation]);

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tax Computation</h1>
          <p className="mt-1 text-sm text-gray-500">
            Core engine page showing transparent tax calculations from your accounting records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf || !computation}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
          >
            <svg className={`h-4 w-4 ${isExportingPdf ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" />
            </svg>
            Download PDF Output
          </button>
          <button
            type="button"
            onClick={runComputation}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0a0a0a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1a1a] disabled:opacity-60"
          >
            <svg className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Recompute
          </button>
        </div>
      </div>

      {(statusMessage || error) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-gray-200 bg-white text-gray-600"}`}>
          {error || statusMessage}
        </div>
      )}

      <section className="rounded-3xl bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">A. Income Tax Computation</h2>
          <p className="text-xs uppercase tracking-wide text-gray-500">Period: {formatPeriodLabel(computation?.period)}</p>
        </div>

        <div className="mt-4 divide-y divide-gray-200 rounded-2xl border border-gray-200">
          <AmountLine label="Revenue" amount={incomeComputation.revenue} />
          <AmountLine label="Less: Cost of goods sold" amount={incomeComputation.cogs} />
          <AmountLine label="= Gross profit" amount={incomeComputation.grossProfit} emphasis />
          <AmountLine label="Less: Expenses" amount={incomeComputation.operatingExpenses} />
          <AmountLine label="= Taxable profit" amount={incomeComputation.taxableProfitBeforeAdjustments} emphasis />
          <AmountLine label="Add: Disallowable expenses (tax add-backs)" amount={incomeComputation.addBacks} />
          <AmountLine label="Less: Deductions" amount={incomeComputation.deductions} />
          <AmountLine label="= Adjusted taxable profit" amount={incomeComputation.adjustedTaxableProfit} emphasis />
          <AmountLine
            label={`Tax rate (${(incomeComputation.taxRate * 100).toFixed(1)}%) × adjusted taxable profit`}
            amount={incomeComputation.computedIncomeTax}
          />
          <AmountLine label="Minimum tax check" amount={incomeComputation.minimumTax} />
          <AmountLine label="= Tax payable" amount={incomeComputation.taxPayable} emphasis />
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">B. VAT Computation</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Output VAT</p>
            <div className="mt-2 border-y border-gray-300 py-2">
              <AmountValue amount={vatComputation.outputVat} className="text-lg" />
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Input VAT</p>
            <div className="mt-2 border-y border-gray-300 py-2">
              <AmountValue amount={vatComputation.inputVat} className="text-lg" />
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">VAT payable</p>
            <div className="mt-2 border-y border-gray-300 py-2">
              <AmountValue amount={vatComputation.vatPayable} className="text-lg" />
            </div>
            {vatComputation.vatCredit > 0 && (
              <p className="mt-2 text-xs text-emerald-700">
                VAT credit: <AmountValue amount={vatComputation.vatCredit} />
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">C. Withholding Tax (WHT)</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total WHT deducted</p>
            <div className="mt-2 border-y border-gray-300 py-2">
              <AmountValue amount={whtComputation.totalDeducted} className="text-lg" />
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total WHT suffered</p>
            <div className="mt-2 border-y border-gray-300 py-2">
              <AmountValue amount={whtComputation.totalSuffered} className="text-lg" />
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Net WHT position</p>
            <div className="mt-2 border-y border-gray-300 py-2">
              <AmountValue amount={whtComputation.netPosition} className="text-lg" />
            </div>
            <p className="mt-2 text-xs text-gray-600">
              Payable: <AmountValue amount={whtComputation.payable} />
              {" · "}
              Receivable: <AmountValue amount={whtComputation.receivable} />
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">D. Payroll Tax (PAYE)</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payroll base</p>
            <div className="mt-2 border-y border-gray-300 py-2">
              <AmountValue amount={payeComputation.totalPayrollBase} className="text-lg" />
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">PAYE recorded</p>
            <div className="mt-2 border-y border-gray-300 py-2">
              <AmountValue amount={payeComputation.totalPayeRecorded} className="text-lg" />
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Employee tax total</p>
            <div className="mt-2 border-y border-gray-300 py-2">
              <AmountValue amount={payeComputation.totalPayeForDisplay} className="text-lg" />
            </div>
            <p className="mt-2 text-xs text-gray-600">Uses recorded values, or estimates at 15% when PAYE lines are missing.</p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Period</th>
                <th className="px-4 py-3 text-right font-semibold">Payroll base</th>
                <th className="px-4 py-3 text-right font-semibold">PAYE</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {payeComputation.rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-5 text-center text-gray-500">
                    No payroll transactions detected yet.
                  </td>
                </tr>
              )}
              {payeComputation.rows.map((row) => (
                <tr key={row.period}>
                  <td className="px-4 py-3 text-gray-800">{formatMonthLabel(row.period)}</td>
                  <td className="px-4 py-3 text-right text-gray-800">
                    <AmountValue amount={row.payrollBase} className="text-sm" />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    <AmountValue amount={row.payeForDisplay} className="text-sm" />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        row.status === "Recorded"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
