"use client";

import { useMemo } from "react";
import { formatNaira, formatNairaCompact, formatPercent } from "@/lib/budgeting/engine";
import { useBudgetingData } from "@/lib/budgeting/useBudgetingData";

export default function CategoriesBudgetPage() {
  const { isReady, performanceRows } = useBudgetingData();

  const categoryRows = useMemo(() => {
    const map = new Map<string, { budgeted: number; actual: number }>();

    performanceRows.forEach((budget) => {
      budget.categoryRows.forEach((category) => {
        const current = map.get(category.category) || { budgeted: 0, actual: 0 };
        map.set(category.category, {
          budgeted: current.budgeted + category.budgeted,
          actual: current.actual + category.actual,
        });
      });
    });

    return Array.from(map.entries())
      .map(([category, values]) => {
        const remaining = values.budgeted - values.actual;
        const utilization = values.budgeted > 0 ? (values.actual / values.budgeted) * 100 : 0;
        return { category, ...values, remaining, utilization };
      })
      .sort((a, b) => b.actual - a.actual);
  }, [performanceRows]);

  if (!isReady) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading category budgets...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Categories Budget</h1>
        <p className="text-sm text-gray-500">Control and track budget utilization at category level.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Category</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Budget</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Spent</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Remaining</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categoryRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    No category budgets available yet.
                  </td>
                </tr>
              ) : null}
              {categoryRows.map((row) => (
                <tr key={row.category}>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.category}</td>
                  <td className="px-4 py-3 text-right text-gray-700" title={formatNaira(row.budgeted)}>{formatNairaCompact(row.budgeted)}</td>
                  <td className="px-4 py-3 text-right text-gray-700" title={formatNaira(row.actual)}>{formatNairaCompact(row.actual)}</td>
                  <td className="px-4 py-3 text-right text-gray-700" title={formatNaira(row.remaining)}>{formatNairaCompact(row.remaining)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.utilization > 100 ? "bg-red-50 text-red-700" : row.utilization >= 85 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {formatPercent(row.utilization)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
