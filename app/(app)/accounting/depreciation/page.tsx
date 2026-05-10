"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { accountingEngine, AccountingState } from "@/lib/accounting/transactionBridge";
import { buildDepreciationSummary } from "@/lib/accounting/fixedAssets";

const formatCurrency = (value: number): string =>
  `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

export default function AccountingDepreciationPage() {
  const [state, setState] = useState<AccountingState | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    accountingEngine.load();
    const sync = (next: AccountingState) => {
      setState({
        ...next,
        journalEntries: [...next.journalEntries],
        customAccounts: [...next.customAccounts],
        ledgerAccounts: new Map(next.ledgerAccounts),
      });
    };

    sync(accountingEngine.getState());
    const unsubscribe = accountingEngine.subscribe(sync);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== "insight::accounting-engine") return;
      accountingEngine.load();
      sync(accountingEngine.getState());
    };
    window.addEventListener("storage", onStorage);

    return () => {
      unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const summary = useMemo(() => buildDepreciationSummary(state), [state]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Depreciation Engine</h1>
            <p className="mt-1 text-sm text-gray-500">
              Automatic depreciation calculation from fixed-asset balances using FIRS standard rates.
            </p>
          </div>
          <Link
            href="/accounting/assets"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Back to Assets Page
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-gray-500">Auto Annual Charge</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(summary.totals.annualDepreciation)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-gray-500">Auto Monthly Charge</p>
          <p className="mt-2 text-2xl font-bold text-[#446b00]">{formatCurrency(summary.totals.monthlyDepreciation)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-gray-500">Posted Depreciation (YTD)</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(summary.postedDepreciationExpenseYtd)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-gray-500">Annual Variance</p>
          <p className={`mt-2 text-2xl font-bold ${summary.annualVariance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {formatCurrency(summary.annualVariance)}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Auto Depreciation Schedule</h2>
          <p className="text-sm text-gray-500">Each line is calculated directly from tracked fixed assets.</p>
        </div>

        {summary.rows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">
            No depreciable fixed assets found yet. Post fixed asset entries to start automatic depreciation.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Asset</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Accum. Dep</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">NBV</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Rate</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Method</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Annual</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Monthly</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Posted (YTD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.rows.map((row) => (
                  <tr key={row.accountCode} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900">{row.accountName}</p>
                      <p className="text-xs text-gray-500">{row.accountCode}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-gray-900">{formatCurrency(row.grossCost)}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-gray-700">{formatCurrency(row.accumulatedDepreciation)}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-[#446b00]">{formatCurrency(row.netBookValue)}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{row.rate > 0 ? `${row.rate}%` : "—"}</td>
                    <td className="px-4 py-3 text-center text-sm capitalize text-gray-700">{row.method === "none" ? "—" : row.method.replace("-", " ")}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono font-semibold text-gray-900">{formatCurrency(row.annualDepreciation)}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-gray-900">{formatCurrency(row.monthlyDepreciation)}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-gray-700">{formatCurrency(row.postedDepreciationYtd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Recommended Monthly Journal</h2>
          <p className="text-sm text-gray-500">Auto-generated entry for monthly depreciation recognition.</p>
        </div>

        <div className="space-y-3 px-6 py-5 text-sm">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <span className="font-medium text-gray-700">DR 5700 - Depreciation Expense</span>
            <span className="font-mono font-semibold text-gray-900">{formatCurrency(summary.recommendedMonthlyJournal.totalDebit)}</span>
          </div>

          {summary.recommendedMonthlyJournal.creditLines.length > 0 ? (
            summary.recommendedMonthlyJournal.creditLines.map((line) => (
              <div key={line.accountCode} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                <span className="text-gray-700">
                  CR {line.accountCode} - {line.accountName}
                </span>
                <span className="font-mono font-semibold text-gray-900">{formatCurrency(line.amount)}</span>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No monthly credit lines generated yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
