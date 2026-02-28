"use client";

import { useMemo } from "react";
import { formatNaira, formatNairaCompact } from "@/lib/budgeting/engine";
import { useBudgetingData } from "@/lib/budgeting/useBudgetingData";

function ForecastSpark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const min = Math.min(...values);
  const spread = Math.max(1, max - min);

  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 100;
      const y = 100 - ((value - min) / spread) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" className="h-40 w-full rounded-xl bg-gray-50 p-2">
      <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={points} />
    </svg>
  );
}

export default function ForecastingPage() {
  const { isReady, forecast } = useBudgetingData();

  const insights = useMemo(() => {
    const runway = forecast.runway.runwayMonths;
    if (runway <= 0) return "Cash is currently negative; stabilize expenses immediately.";
    if (runway < 6) return `At current spending, cash runway is ${runway.toFixed(1)} months. Immediate adjustment is needed.`;
    if (runway < 12) return `At current spending, cash runway is ${runway.toFixed(1)} months. Monitor spending monthly.`;
    return `Current runway is ${runway.toFixed(1)} months. You have room to invest with controls.`;
  }, [forecast.runway.runwayMonths]);

  if (!isReady) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading forecasting...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Forecasting</h1>
        <p className="text-sm text-gray-500">Predict cash balance, expenses, and revenue based on current budget behavior.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-gray-500">Starting Cash</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{formatNairaCompact(forecast.runway.startingCash)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-gray-500">Avg Monthly Revenue</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{formatNairaCompact(forecast.runway.monthlyRevenue)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-gray-500">Avg Monthly Burn</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{formatNairaCompact(forecast.runway.monthlyBurn)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-gray-500">Runway</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{forecast.runway.runwayMonths.toFixed(1)} mo</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900">Cash Projection</h2>
          <p className="mt-1 text-sm text-gray-500">Projected cash position over the next 12 months.</p>
          <div className="mt-4">
            <ForecastSpark values={forecast.points.map((point) => point.projectedCash)} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500 sm:grid-cols-4">
            {forecast.points.slice(0, 4).map((point) => (
              <div key={point.monthKey} className="rounded-lg border border-gray-200 p-2">
                <p>{point.monthLabel}</p>
                <p className="font-semibold text-gray-900" title={formatNaira(point.projectedCash)}>{formatNairaCompact(point.projectedCash)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">Insight</h2>
          <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{insights}</p>
          <p className="mt-4 text-xs text-gray-500">Example: "You will run out of cash in 8 months at current spending".</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">Forecast Table</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Month</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Projected Revenue</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Projected Expenses</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Projected Cash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {forecast.points.map((point) => (
                <tr key={point.monthKey}>
                  <td className="px-3 py-2 text-gray-700">{point.monthLabel}</td>
                  <td className="px-3 py-2 text-right text-gray-700" title={formatNaira(point.projectedRevenue)}>{formatNairaCompact(point.projectedRevenue)}</td>
                  <td className="px-3 py-2 text-right text-gray-700" title={formatNaira(point.projectedExpenses)}>{formatNairaCompact(point.projectedExpenses)}</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900" title={formatNaira(point.projectedCash)}>{formatNairaCompact(point.projectedCash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
