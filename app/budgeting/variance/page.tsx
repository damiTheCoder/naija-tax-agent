"use client";

import { useMemo } from "react";
import { formatNaira, formatNairaCompact, formatPercent } from "@/lib/budgeting/engine";
import { useBudgetingData } from "@/lib/budgeting/useBudgetingData";

export default function VarianceAnalysisPage() {
  const { isReady, performanceRows } = useBudgetingData();

  const rows = useMemo(() => {
    const map = new Map<string, { budget: number; actual: number }>();

    performanceRows.forEach((performance) => {
      performance.categoryRows.forEach((categoryRow) => {
        const current = map.get(categoryRow.category) || { budget: 0, actual: 0 };
        map.set(categoryRow.category, {
          budget: current.budget + categoryRow.budgeted,
          actual: current.actual + categoryRow.actual,
        });
      });
    });

    return Array.from(map.entries())
      .map(([category, values]) => {
        const variance = values.actual - values.budget;
        const variancePercent = values.budget > 0 ? (variance / values.budget) * 100 : 0;
        return { category, budget: values.budget, actual: values.actual, variance, variancePercent };
      })
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
  }, [performanceRows]);

  if (!isReady) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading variance analysis...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Variance Analysis</h1>
        <p className="text-sm text-gray-500">Compare planned versus actual spending and identify overspending quickly.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Category</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Budget</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Actual</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Variance</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Variance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={5}>
                    No variance data yet.
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr key={row.category}>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.category}</td>
                  <td className="px-4 py-3 text-right text-gray-700" title={formatNaira(row.budget)}>{formatNairaCompact(row.budget)}</td>
                  <td className="px-4 py-3 text-right text-gray-700" title={formatNaira(row.actual)}>{formatNairaCompact(row.actual)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${row.variance > 0 ? "text-red-700" : "text-emerald-700"}`} title={formatNaira(row.variance)}>
                    {row.variance > 0 ? "+" : ""}{formatNairaCompact(row.variance)}
                  </td>
                  <td className={`px-4 py-3 text-right ${row.variancePercent > 0 ? "text-red-700" : "text-emerald-700"}`}>
                    {row.variancePercent > 0 ? "+" : ""}{formatPercent(row.variancePercent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
        <p>
          Positive variance means overspending. Negative variance means spending below plan.
        </p>
      </div>
    </div>
  );
}
