"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatNairaCompact, formatPercent, getPeriodLabel } from "@/lib/budgeting/engine";
import { useBudgetingData } from "@/lib/budgeting/useBudgetingData";

const statusClass: Record<string, string> = {
  healthy: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  over: "bg-red-50 text-red-700",
};

export default function BudgetsPage() {
  const { isReady, performanceRows, removeBudget } = useBudgetingData();

  const sortedRows = useMemo(() => {
    return [...performanceRows].sort((a, b) => b.utilizationPercent - a.utilizationPercent);
  }, [performanceRows]);

  if (!isReady) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading budgets...</div>;
  }

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
          <p className="text-sm text-gray-500">All budgets with period, spend, remaining, and status.</p>
        </div>
        <Link href="/budgeting/budgets/new" className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Create New Budget
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Budget Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Period</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Total Amount</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Spent</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Remaining</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>
                    No budgets yet. Create your first budget.
                  </td>
                </tr>
              ) : null}
              {sortedRows.map((row) => (
                <tr key={row.budgetId}>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.budgetName}</td>
                  <td className="px-4 py-3 text-gray-600">{row.periodLabel}</td>
                  <td className="px-4 py-3 text-right text-gray-900" title={row.totalBudgeted.toLocaleString("en-NG")}>{formatNairaCompact(row.totalBudgeted)}</td>
                  <td className="px-4 py-3 text-right text-gray-900" title={row.totalActual.toLocaleString("en-NG")}>{formatNairaCompact(row.totalActual)}</td>
                  <td className="px-4 py-3 text-right text-gray-900" title={row.totalRemaining.toLocaleString("en-NG")}>{formatNairaCompact(row.totalRemaining)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass[row.status] || statusClass.healthy}`}>
                      {row.status === "over" ? "Over budget" : row.status === "warning" ? "Warning" : "Healthy"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/budgeting/budgets/${row.budgetId}`} className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                        View
                      </Link>
                      <Link href={`/budgeting/budgets/new?id=${encodeURIComponent(row.budgetId)}`} className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("Delete this budget?")) {
                            removeBudget(row.budgetId);
                          }
                        }}
                        className="rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">Quick Summary</h2>
        <p className="mt-2 text-sm text-gray-600">
          {sortedRows.length} budget(s) loaded. Average utilization: {formatPercent(sortedRows.length ? sortedRows.reduce((sum, row) => sum + row.utilizationPercent, 0) / sortedRows.length : 0)}.
        </p>
      </div>
    </div>
  );
}
