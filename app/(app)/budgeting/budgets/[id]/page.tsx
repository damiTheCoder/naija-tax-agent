"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { formatNaira, formatNairaCompact, formatPercent, getPeriodLabel } from "@/lib/budgeting/engine";
import { useBudgetingData } from "@/lib/budgeting/useBudgetingData";

export default function BudgetDetailsPage() {
  const params = useParams<{ id: string }>();
  const budgetId = params?.id;
  const { isReady, budgets, performanceRows, impacts } = useBudgetingData();

  const budget = useMemo(() => budgets.find((item) => item.id === budgetId), [budgets, budgetId]);
  const performance = useMemo(() => performanceRows.find((item) => item.budgetId === budgetId), [performanceRows, budgetId]);

  const recentTransactions = useMemo(() => {
    if (!budget) return [];
    const start = new Date(budget.startDate);
    const end = new Date(budget.endDate);

    return impacts
      .filter((impact) => {
        if (impact.type !== "expense") return false;
        const date = new Date(impact.date);
        if (date < start || date > end) return false;

        if (budget.linkedAccountCodes.length > 0) {
          return budget.linkedAccountCodes.includes(impact.accountCode);
        }

        return true;
      })
      .slice(0, 20);
  }, [budget, impacts]);

  if (!isReady) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading budget details...</div>;
  }

  if (!budget || !performance) {
    return (
      <div className="space-y-4 px-4 py-6 sm:px-6">
        <p className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Budget not found.</p>
        <Link href="/budgeting/budgets" className="inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Back to Budgets
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{budget.name}</h1>
          <p className="text-sm text-gray-500">{getPeriodLabel(budget)}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/budgeting/budgets/new?id=${encodeURIComponent(budget.id)}`} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Edit Budget
          </Link>
          <Link href="/budgeting/budgets" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            All Budgets
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total Budget</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{formatNairaCompact(performance.totalBudgeted)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Spent</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{formatNairaCompact(performance.totalActual)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Remaining</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{formatNairaCompact(performance.totalRemaining)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Utilization</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{formatPercent(performance.utilizationPercent)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">Category Breakdown</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Category</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Budget</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Spent</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {performance.categoryRows.map((row) => (
                  <tr key={row.category}>
                    <td className="px-3 py-2 text-gray-800">{row.category}</td>
                    <td className="px-3 py-2 text-right text-gray-700" title={formatNaira(row.budgeted)}>{formatNairaCompact(row.budgeted)}</td>
                    <td className="px-3 py-2 text-right text-gray-700" title={formatNaira(row.actual)}>{formatNairaCompact(row.actual)}</td>
                    <td className="px-3 py-2 text-right text-gray-700" title={formatNaira(row.remaining)}>{formatNairaCompact(row.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">Department Breakdown</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Department</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Budget</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Spent</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {performance.departmentRows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-center text-gray-500" colSpan={4}>No department allocation configured for this budget.</td>
                  </tr>
                ) : null}
                {performance.departmentRows.map((row) => (
                  <tr key={row.department}>
                    <td className="px-3 py-2 text-gray-800">{row.department}</td>
                    <td className="px-3 py-2 text-right text-gray-700" title={formatNaira(row.budgeted)}>{formatNairaCompact(row.budgeted)}</td>
                    <td className="px-3 py-2 text-right text-gray-700" title={formatNaira(row.actual)}>{formatNairaCompact(row.actual)}</td>
                    <td className="px-3 py-2 text-right text-gray-700" title={formatNaira(row.remaining)}>{formatNairaCompact(row.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">Transactions Affecting This Budget</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Date</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Description</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Category</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Department</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentTransactions.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={5}>No transactions matched this budget period yet.</td>
                </tr>
              ) : null}
              {recentTransactions.map((impact) => (
                <tr key={`${impact.journalId}-${impact.accountCode}-${impact.date}`}>
                  <td className="px-3 py-2 text-gray-700">{new Date(impact.date).toLocaleDateString("en-NG")}</td>
                  <td className="px-3 py-2 text-gray-800">{impact.description}</td>
                  <td className="px-3 py-2 text-gray-700">{impact.category}</td>
                  <td className="px-3 py-2 text-gray-700">{impact.department}</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900" title={formatNaira(impact.amount)}>{formatNairaCompact(impact.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
