"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatNaira, formatNairaCompact, formatPercent } from "@/lib/budgeting/engine";
import { useBudgetingData } from "@/lib/budgeting/useBudgetingData";

function StatCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-gray-900">{value}</p>
      <p className="mt-2 text-sm text-gray-500">{helper}</p>
    </div>
  );
}

function Bars({ points }: { points: { label: string; budget: number; actual: number }[] }) {
  const max = Math.max(1, ...points.map((point) => Math.max(point.budget, point.actual)));

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-gray-900">Budget vs Actual (Monthly)</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {points.map((point) => (
          <div key={point.label} className="space-y-1">
            <div className="flex h-24 items-end gap-1 rounded-xl bg-gray-50 p-2">
              <div
                className="w-1/2 rounded bg-blue-300"
                style={{ height: `${Math.max(4, (point.budget / max) * 100)}%` }}
                title={`Budgeted: ${formatNaira(point.budget)}`}
              />
              <div
                className="w-1/2 rounded bg-blue-600"
                style={{ height: `${Math.max(4, (point.actual / max) * 100)}%` }}
                title={`Actual: ${formatNaira(point.actual)}`}
              />
            </div>
            <p className="text-xs text-gray-600">{point.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-300" />Budgeted</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-600" />Actual</span>
      </div>
    </div>
  );
}

function SpendingByCategory({ rows }: { rows: { category: string; actual: number }[] }) {
  const top = rows.slice(0, 6);
  const total = Math.max(1, top.reduce((sum, row) => sum + row.actual, 0));

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-gray-900">Spending by Category</h2>
      <div className="mt-4 space-y-3">
        {top.length === 0 ? <p className="text-sm text-gray-500">No category data yet.</p> : null}
        {top.map((row) => (
          <div key={row.category} className="space-y-1">
            <div className="flex items-center justify-between text-sm text-gray-700">
              <span>{row.category}</span>
              <span className="font-medium text-gray-900" title={formatNaira(row.actual)}>{formatNairaCompact(row.actual)}</span>
            </div>
            <div className="h-2 rounded bg-gray-100">
              <div className="h-2 rounded bg-blue-500" style={{ width: `${(row.actual / total) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const alertClassBySeverity: Record<string, string> = {
  critical: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
};

export default function BudgetDashboardPage() {
  const { isReady, performanceRows, totals, monthlySeries, alerts, forecast } = useBudgetingData();

  const latestMonths = useMemo(
    () => monthlySeries.slice(-6).map((point) => ({ label: point.monthLabel, budget: point.budgeted, actual: point.actual })),
    [monthlySeries]
  );

  const categorySummary = useMemo(() => {
    const map = new Map<string, number>();
    performanceRows.forEach((row) => {
      row.categoryRows.forEach((categoryRow) => {
        map.set(categoryRow.category, (map.get(categoryRow.category) || 0) + categoryRow.actual);
      });
    });

    return Array.from(map.entries())
      .map(([category, actual]) => ({ category, actual }))
      .sort((a, b) => b.actual - a.actual);
  }, [performanceRows]);

  const overBudget = performanceRows.filter((row) => row.status === "over");

  if (!isReady) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading budgeting workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget Dashboard</h1>
          <p className="text-sm text-gray-500">Overview of plans, spending, and risks across all budgets.</p>
        </div>
        <Link href="/budgeting/budgets/new" className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Create Budget
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Budgeted" value={formatNairaCompact(totals.totalBudgeted)} helper={formatNaira(totals.totalBudgeted)} />
        <StatCard label="Total Spent" value={formatNairaCompact(totals.totalSpent)} helper={formatNaira(totals.totalSpent)} />
        <StatCard label="Remaining Budget" value={formatNairaCompact(totals.totalRemaining)} helper={formatNaira(totals.totalRemaining)} />
        <StatCard
          label="Budget Utilization"
          value={formatPercent(totals.utilizationPercent)}
          helper={`${totals.overBudgetCount} over budget • ${totals.warningCount} warning`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bars points={latestMonths} />
        <SpendingByCategory rows={categorySummary} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900">Budget Alerts</h2>
          <div className="mt-4 space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className={`rounded-xl border p-3 text-sm ${alertClassBySeverity[alert.severity] || alertClassBySeverity.info}`}>
                <p className="font-semibold">{alert.title}</p>
                <p className="mt-1">{alert.message}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">Upcoming Budget Risks</h2>
          <div className="mt-4 space-y-3 text-sm text-gray-700">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Runway</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">{forecast.runway.runwayMonths.toFixed(1)} months</p>
              <p className="text-xs text-gray-500">at current burn ({formatNairaCompact(forecast.runway.monthlyBurn)}/mo)</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Over-budget Budgets</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">{overBudget.length}</p>
              <p className="text-xs text-gray-500">Review variance and rebalance allocations</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
