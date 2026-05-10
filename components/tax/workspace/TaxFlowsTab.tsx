"use client";

import type { TaxIssue } from "@/lib/tax/compliance";
import {
  formatCurrency,
  formatCurrencyFull,
  type TaxSummary,
  type TaxWorkspaceInsights,
} from "@/components/tax/workspace/shared";

type TaxFlowsTabProps = {
  taxSummary: TaxSummary;
  issues: TaxIssue[];
  workspaceInsights: TaxWorkspaceInsights;
};

export default function TaxFlowsTab({
  taxSummary,
  issues,
  workspaceInsights,
}: TaxFlowsTabProps) {
  return (
    <div>
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="font-semibold text-gray-900">Tax Heads Overview</h2>
        <p className="text-xs text-gray-500 mt-0.5">Breakdown by tax type</p>
      </div>
      <div className="p-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-indigo-900">Value Added Tax</h3>
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
              </svg>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Output VAT collected</span>
              <span className="font-mono text-gray-900" title={formatCurrencyFull(taxSummary.outputVAT)}>
                {formatCurrency(taxSummary.outputVAT)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Input VAT credit</span>
              <span className="font-mono text-gray-900" title={formatCurrencyFull(taxSummary.inputVAT)}>
                ({formatCurrency(taxSummary.inputVAT)})
              </span>
            </div>
            <div className="pt-2 border-t border-indigo-200/50 flex justify-between font-bold text-indigo-900">
              <span>Net Payable</span>
              <span title={formatCurrencyFull(taxSummary.netVAT)}>{formatCurrency(taxSummary.netVAT)}</span>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">CIT / PIT Projection</h3>
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Turnover</span>
              <span className="font-mono text-gray-900" title={formatCurrencyFull(taxSummary.turnover)}>
                {formatCurrency(taxSummary.turnover)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Est. Profit</span>
              <span className="font-mono text-gray-900" title={formatCurrencyFull(taxSummary.profit)}>
                {formatCurrency(taxSummary.profit)}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
              <span>Estimated Liability</span>
              <span title={formatCurrencyFull(taxSummary.estimatedCIT)}>{formatCurrency(taxSummary.estimatedCIT)}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="px-6 pb-6">
        <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-rose-900">Compliance Issues</h3>
            <span className="text-xs text-rose-600">{issues.length} open item(s)</span>
          </div>
          {issues.length === 0 ? (
            <p className="text-sm text-rose-700">No issues flagged. Your schedules reconcile with ledger entries.</p>
          ) : (
            <div className="space-y-2">
              {issues.slice(0, 4).map((issue) => (
                <div key={issue.id} className="rounded-lg bg-white border border-rose-100 px-3 py-2 text-sm text-rose-700">
                  {issue.message}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Monthly Tax Trend Chart</h3>
              <p className="text-xs text-gray-500">Combined monthly liabilities across CIT, VAT, PAYE, WHT, and Education Tax</p>
            </div>
            <div className="text-xs text-gray-500">
              Peak month:{" "}
              <span title={formatCurrencyFull(workspaceInsights.maxMonthlyTrend)}>
                {formatCurrency(workspaceInsights.maxMonthlyTrend)}
              </span>{" "}
              • Year total:{" "}
              <span title={formatCurrencyFull(workspaceInsights.trendTotals.total)}>
                {formatCurrency(workspaceInsights.trendTotals.total)}
              </span>
            </div>
          </div>

          <div className="h-44 border border-gray-100 rounded-lg px-2 py-3 bg-gray-50/40">
            <div className="h-full grid grid-cols-12 gap-1 items-end">
              {workspaceInsights.monthlyTrend.map((point) => (
                <div key={point.monthKey} className="h-full flex flex-col items-center justify-end gap-1">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-t-md bg-[#8fff00]"
                      style={{ height: `${Math.max(4, Math.round((point.total / workspaceInsights.maxMonthlyTrend) * 100))}%` }}
                      title={`${point.monthLabel}: ${formatCurrencyFull(point.total)}`}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500">{point.monthLabel}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-indigo-700 font-semibold">VAT</p>
              <p className="text-sm font-semibold text-indigo-900 mt-1" title={formatCurrencyFull(workspaceInsights.trendTotals.vat)}>
                {formatCurrency(workspaceInsights.trendTotals.vat)}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-emerald-700 font-semibold">WHT</p>
              <p className="text-sm font-semibold text-emerald-900 mt-1" title={formatCurrencyFull(workspaceInsights.trendTotals.wht)}>
                {formatCurrency(workspaceInsights.trendTotals.wht)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-700 font-semibold">CIT</p>
              <p className="text-sm font-semibold text-slate-900 mt-1" title={formatCurrencyFull(workspaceInsights.trendTotals.cit)}>
                {formatCurrency(workspaceInsights.trendTotals.cit)}
              </p>
            </div>
            <div className="rounded-lg border border-cyan-100 bg-cyan-50/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-cyan-700 font-semibold">PAYE</p>
              <p className="text-sm font-semibold text-cyan-900 mt-1" title={formatCurrencyFull(workspaceInsights.trendTotals.paye)}>
                {formatCurrency(workspaceInsights.trendTotals.paye)}
              </p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-amber-700 font-semibold">Education Tax</p>
              <p className="text-sm font-semibold text-amber-900 mt-1" title={formatCurrencyFull(workspaceInsights.trendTotals.edt)}>
                {formatCurrency(workspaceInsights.trendTotals.edt)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
