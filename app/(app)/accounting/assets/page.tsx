"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { accountingEngine, AccountingState } from "@/lib/accounting/transactionBridge";
import { buildFixedAssetRegister } from "@/lib/accounting/fixedAssets";

const formatCurrency = (value: number): string =>
  `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

const formatDate = (value: string | null): string => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
};

export default function AccountingAssetsPage() {
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

  const register = useMemo(() => buildFixedAssetRegister(state), [state]);
  const rows = register.rows;
  const totals = register.totals;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fixed Assets Register</h1>
            <p className="mt-1 text-sm text-gray-500">
              Track fixed assets automatically from your accounting ledger.
            </p>
          </div>
          <Link
            href="/accounting/depreciation"
            className="inline-flex items-center justify-center rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
          >
            Open Depreciation Page
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-gray-500">Gross Asset Cost</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(totals.grossCost)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-gray-500">Accum. Depreciation</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(totals.accumulatedDepreciation)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-gray-500">Net Book Value</p>
          <p className="mt-2 text-2xl font-bold text-[#1e3a8a]">{formatCurrency(totals.netBookValue)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-gray-500">Auto Annual Depreciation</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(totals.annualDepreciation)}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Assets</h2>
          <p className="text-sm text-gray-500">Live balances sourced from fixed-asset ledger accounts.</p>
        </div>

        {rows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">
            No fixed assets tracked yet. Post an asset purchase in Accounting Chat to populate this register.
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
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Additions (YTD)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Disposals (YTD)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Rate</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Method</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Auto Monthly</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.accountCode} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900">{row.accountName}</p>
                      <p className="text-xs text-gray-500">{row.accountCode}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-gray-900">{formatCurrency(row.grossCost)}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-gray-700">{formatCurrency(row.accumulatedDepreciation)}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono font-semibold text-[#1e3a8a]">{formatCurrency(row.netBookValue)}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-emerald-700">{formatCurrency(row.additionsYtd)}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-rose-700">{formatCurrency(row.disposalsYtd)}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{row.rate > 0 ? `${row.rate}%` : "—"}</td>
                    <td className="px-4 py-3 text-center text-sm capitalize text-gray-700">{row.method === "none" ? "—" : row.method.replace("-", " ")}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-gray-900">{formatCurrency(row.monthlyDepreciation)}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{formatDate(row.lastActivityDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
