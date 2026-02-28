"use client";

import { useMemo } from "react";
import { formatNaira, formatNairaCompact } from "@/lib/budgeting/engine";
import { useBudgetingData } from "@/lib/budgeting/useBudgetingData";

function CategoryBars({ rows }: { rows: { category: string; budget: number; actual: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => Math.max(row.budget, row.actual)));

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.category} className="rounded-xl border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-800">{row.category}</span>
            <span className="text-gray-500">B {formatNairaCompact(row.budget)} / A {formatNairaCompact(row.actual)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-2 rounded bg-blue-200" style={{ width: `${(row.budget / max) * 100}%` }} title={`Budget: ${formatNaira(row.budget)}`} />
            <div className="h-2 rounded bg-blue-600" style={{ width: `${(row.actual / max) * 100}%` }} title={`Actual: ${formatNaira(row.actual)}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MonthlyTrend({ points }: { points: { month: string; budget: number; actual: number }[] }) {
  const allValues = points.flatMap((point) => [point.budget, point.actual]);
  const max = Math.max(1, ...allValues);

  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <div className="grid grid-cols-6 gap-2">
        {points.map((point) => (
          <div key={point.month} className="text-center">
            <div className="mx-auto flex h-24 w-10 items-end gap-1 rounded bg-gray-50 p-1">
              <div className="w-1/2 rounded bg-blue-300" style={{ height: `${(point.budget / max) * 100}%` }} title={`Budget: ${formatNaira(point.budget)}`} />
              <div className="w-1/2 rounded bg-blue-700" style={{ height: `${(point.actual / max) * 100}%` }} title={`Actual: ${formatNaira(point.actual)}`} />
            </div>
            <p className="mt-1 text-[11px] text-gray-500">{point.month}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BudgetVsActualPage() {
  const { isReady, monthlySeries, performanceRows } = useBudgetingData();

  const categoryRows = useMemo(() => {
    const map = new Map<string, { budget: number; actual: number }>();

    performanceRows.forEach((performance) => {
      performance.categoryRows.forEach((row) => {
        const current = map.get(row.category) || { budget: 0, actual: 0 };
        map.set(row.category, {
          budget: current.budget + row.budgeted,
          actual: current.actual + row.actual,
        });
      });
    });

    return Array.from(map.entries())
      .map(([category, values]) => ({ category, ...values }))
      .sort((a, b) => b.actual - a.actual)
      .slice(0, 8);
  }, [performanceRows]);

  const months = useMemo(
    () => monthlySeries.slice(-6).map((point) => ({ month: point.monthLabel, budget: point.budgeted, actual: point.actual })),
    [monthlySeries]
  );

  if (!isReady) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading budget vs actual...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Budget vs Actual</h1>
        <p className="text-sm text-gray-500">Visual comparison of budgeted versus actual performance by category and month.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">By Category</h2>
          <p className="text-sm text-gray-500">Top categories by actual spend.</p>
          <div className="mt-4">
            <CategoryBars rows={categoryRows} />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">Over Time</h2>
          <p className="text-sm text-gray-500">Last six months budgeted and actual trend.</p>
          <div className="mt-4">
            <MonthlyTrend points={months} />
          </div>
        </div>
      </div>
    </div>
  );
}
