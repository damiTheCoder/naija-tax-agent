"use client";

import { useMemo, useState } from "react";
import { formatNairaCompact, formatPercent, simulateScenario } from "@/lib/budgeting/engine";
import { useBudgetingData } from "@/lib/budgeting/useBudgetingData";
import type { BudgetScenario, BudgetScenarioAdjustment, ScenarioAdjustmentType } from "@/lib/budgeting/types";

const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

export default function ScenarioPlanningPage() {
  const { isReady, scenarios, saveScenario, removeScenario, forecast } = useBudgetingData();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [adjustments, setAdjustments] = useState<BudgetScenarioAdjustment[]>([
    { id: makeId("adj"), label: "Increase marketing spend", type: "increase-expense", valuePercent: 20, target: "Marketing" },
  ]);

  const results = useMemo(() => {
    return scenarios.map((scenario) => simulateScenario(scenario, forecast.runway));
  }, [scenarios, forecast.runway]);

  const updateAdjustment = (id: string, patch: Partial<BudgetScenarioAdjustment>) => {
    setAdjustments((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addAdjustment = () => {
    setAdjustments((prev) => [...prev, { id: makeId("adj"), label: "", type: "reduce-expense", valuePercent: 10 }]);
  };

  if (!isReady) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading scenarios...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scenario Planning</h1>
        <p className="text-sm text-gray-500">Simulate what-if scenarios and see impact on runway and profitability.</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">Create Scenario</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-xl border border-gray-300 px-3 py-2"
            placeholder="Scenario name"
          />
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="rounded-xl border border-gray-300 px-3 py-2"
            placeholder="Description"
          />
        </div>

        <div className="mt-4 space-y-3">
          {adjustments.map((adjustment) => (
            <div key={adjustment.id} className="grid gap-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-4">
              <input
                value={adjustment.label}
                onChange={(event) => updateAdjustment(adjustment.id, { label: event.target.value })}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="Adjustment label"
              />
              <select
                value={adjustment.type}
                onChange={(event) => updateAdjustment(adjustment.id, { type: event.target.value as ScenarioAdjustmentType })}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="increase-expense">Increase expense</option>
                <option value="reduce-expense">Reduce expense</option>
                <option value="increase-revenue">Increase revenue</option>
                <option value="reduce-revenue">Reduce revenue</option>
              </select>
              <input
                type="number"
                min={0}
                value={adjustment.valuePercent}
                onChange={(event) => updateAdjustment(adjustment.id, { valuePercent: Number(event.target.value || 0) })}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="Percent"
              />
              <input
                value={adjustment.target || ""}
                onChange={(event) => updateAdjustment(adjustment.id, { target: event.target.value })}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="Target (optional)"
              />
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={addAdjustment} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
            Add Adjustment
          </button>
          <button
            type="button"
            onClick={() => {
              if (!name.trim()) return;
              const now = new Date().toISOString();
              const scenario: BudgetScenario = {
                id: makeId("scenario"),
                name,
                description,
                adjustments: adjustments.filter((adjustment) => adjustment.label.trim().length > 0),
                createdAt: now,
                updatedAt: now,
              };
              saveScenario(scenario);
              setName("");
              setDescription("");
            }}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Save Scenario
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {results.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-500">No scenarios yet. Add one above.</div>
        ) : null}
        {results.map((result) => (
          <div key={result.scenario.id} className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{result.scenario.name}</h3>
                <p className="text-sm text-gray-500">{result.scenario.description || "No description"}</p>
              </div>
              <button
                type="button"
                onClick={() => removeScenario(result.scenario.id)}
                className="rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                Delete
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Runway change</p>
                <p className={`mt-1 text-lg font-semibold ${result.deltaRunwayMonths >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {result.deltaRunwayMonths >= 0 ? "+" : ""}{result.deltaRunwayMonths.toFixed(1)} mo
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Profit delta / month</p>
                <p className={`mt-1 text-lg font-semibold ${result.projectedProfitDelta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {result.projectedProfitDelta >= 0 ? "+" : ""}{formatNairaCompact(result.projectedProfitDelta)}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 col-span-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">Scenario runway</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{result.scenarioRunwayMonths.toFixed(1)} months</p>
              </div>
            </div>

            <div className="mt-4 space-y-2 border-t border-gray-200 pt-3 text-sm text-gray-700">
              {result.scenario.adjustments.map((adjustment) => (
                <div key={adjustment.id} className="flex items-center justify-between">
                  <span>{adjustment.label}</span>
                  <span className="font-medium">{formatPercent(adjustment.valuePercent)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
