"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createTaxAdjustment,
  currentQuarterPeriod,
  deleteTaxAdjustment,
  loadTaxAdjustments,
  type TaxAdjustmentCategory,
  type TaxAdjustmentRecord,
  type TaxAdjustmentType,
} from "@/lib/tax/adjustments";

const ENTITY_ID = "entity-default";

const TYPE_LABELS: Record<TaxAdjustmentType, string> = {
  deduction: "Deduction",
  allowance: "Allowance",
  tax_credit: "Tax Credit",
  adjustment: "Adjustment",
};

const CATEGORY_LABELS: Record<TaxAdjustmentCategory, string> = {
  general_deduction: "General deduction",
  capital_allowance: "Capital allowance",
  loss_carryforward: "Loss carryforward",
  tax_credit: "Tax credit",
  general_adjustment: "General adjustment",
};

const CATEGORY_OPTIONS_BY_TYPE: Record<TaxAdjustmentType, TaxAdjustmentCategory[]> = {
  deduction: ["general_deduction", "loss_carryforward"],
  allowance: ["capital_allowance"],
  tax_credit: ["tax_credit"],
  adjustment: ["general_adjustment"],
};

const EXAMPLE_PRESETS: Array<{
  label: string;
  type: TaxAdjustmentType;
  category: TaxAdjustmentCategory;
  description: string;
}> = [
  {
    label: "Capital allowance",
    type: "allowance",
    category: "capital_allowance",
    description: "Capital allowance claim",
  },
  {
    label: "Loss carryforward",
    type: "deduction",
    category: "loss_carryforward",
    description: "Utilize prior year loss carryforward",
  },
  {
    label: "Tax credits",
    type: "tax_credit",
    category: "tax_credit",
    description: "Available tax credit for period",
  },
];

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatCurrencyFull = (amount: number) => currencyFormatter.format(Math.round(amount || 0));

const formatCurrencyCompact = (amount: number) => {
  const value = Math.round(amount || 0);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs < 1_000) return `${sign}${formatCurrencyFull(abs)}`;

  const compactTo = (divisor: number, suffix: string) => {
    const scaled = abs / divisor;
    const rounded = scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, "");
    return `${sign}₦${rounded}${suffix}`;
  };

  if (abs < 1_000_000) return compactTo(1_000, "K");
  if (abs < 1_000_000_000) return compactTo(1_000_000, "M");
  return compactTo(1_000_000_000, "b");
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
};

const getTypePillClass = (type: TaxAdjustmentType) => {
  if (type === "deduction") return "bg-blue-50 text-blue-700";
  if (type === "allowance") return "bg-emerald-50 text-emerald-700";
  if (type === "tax_credit") return "bg-purple-50 text-purple-700";
  return "bg-amber-50 text-amber-700";
};

export default function TaxAdjustmentsPage() {
  const [records, setRecords] = useState<TaxAdjustmentRecord[]>([]);

  const [type, setType] = useState<TaxAdjustmentType>("deduction");
  const [category, setCategory] = useState<TaxAdjustmentCategory>("general_deduction");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState(currentQuarterPeriod());
  const [notes, setNotes] = useState("");

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshRecords = useCallback(() => {
    setRecords(loadTaxAdjustments(ENTITY_ID));
  }, []);

  useEffect(() => {
    refreshRecords();
    const onUpdated = () => refreshRecords();
    window.addEventListener("tax-adjustments:updated", onUpdated);
    return () => {
      window.removeEventListener("tax-adjustments:updated", onUpdated);
    };
  }, [refreshRecords]);

  useEffect(() => {
    const options = CATEGORY_OPTIONS_BY_TYPE[type];
    if (!options.includes(category)) {
      setCategory(options[0]);
    }
  }, [category, type]);

  const totals = useMemo(() => {
    return {
      total: records.reduce((sum, item) => sum + item.amount, 0),
      deductions: records
        .filter((item) => item.type === "deduction")
        .reduce((sum, item) => sum + Math.abs(item.amount), 0),
      allowances: records
        .filter((item) => item.type === "allowance")
        .reduce((sum, item) => sum + Math.abs(item.amount), 0),
      taxCredits: records
        .filter((item) => item.type === "tax_credit")
        .reduce((sum, item) => sum + Math.abs(item.amount), 0),
      adjustments: records
        .filter((item) => item.type === "adjustment")
        .reduce((sum, item) => sum + item.amount, 0),
    };
  }, [records]);

  const submitAdjustment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount === 0) {
      setError("Enter a valid amount (non-zero).");
      return;
    }

    const resolvedDescription = description.trim() || CATEGORY_LABELS[category];
    createTaxAdjustment({
      entityId: ENTITY_ID,
      type,
      category,
      description: resolvedDescription,
      amount: parsedAmount,
      period,
      notes,
    });

    setAmount("");
    setDescription("");
    setNotes("");
    setStatusMessage("Tax adjustment saved. Refresh computation pages to apply immediately.");
    refreshRecords();
  };

  const removeAdjustment = (id: string) => {
    deleteTaxAdjustment(id, ENTITY_ID);
    setStatusMessage("Tax adjustment removed.");
    refreshRecords();
  };

  const applyPreset = (preset: (typeof EXAMPLE_PRESETS)[number]) => {
    setType(preset.type);
    setCategory(preset.category);
    setDescription(preset.description);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tax Adjustments</h1>
        <p className="mt-1 text-sm text-gray-500">
          Accountant-level deductions, allowances, tax credits, and manual adjustments used in tax computations.
        </p>
      </div>

      {(statusMessage || error) && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            error ? "border-red-200 bg-red-50 text-red-700" : "border-gray-200 bg-white text-gray-600"
          }`}
        >
          {error || statusMessage}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total adjustments</p>
          <p className="mt-2 text-2xl font-bold text-gray-900" title={formatCurrencyFull(totals.total)}>
            {formatCurrencyCompact(totals.total)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Deductions</p>
          <p className="mt-2 text-2xl font-bold text-blue-700" title={formatCurrencyFull(totals.deductions)}>
            {formatCurrencyCompact(totals.deductions)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Allowances</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700" title={formatCurrencyFull(totals.allowances)}>
            {formatCurrencyCompact(totals.allowances)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tax credits</p>
          <p className="mt-2 text-2xl font-bold text-purple-700" title={formatCurrencyFull(totals.taxCredits)}>
            {formatCurrencyCompact(totals.taxCredits)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Entries</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{records.length}</p>
        </div>
      </div>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Add Adjustment</h2>
          <p className="text-xs text-gray-500">Examples: Capital allowance, loss carryforward, tax credits.</p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset)}
              className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <form className="mt-4 grid gap-3 lg:grid-cols-6" onSubmit={submitAdjustment}>
          <div>
            <label className="text-xs text-gray-500">Type</label>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as TaxAdjustmentType)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            >
              <option value="deduction">Deduction</option>
              <option value="allowance">Allowance</option>
              <option value="tax_credit">Tax credit</option>
              <option value="adjustment">Adjustment</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">Category</label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as TaxAdjustmentCategory)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            >
              {CATEGORY_OPTIONS_BY_TYPE[type].map((option) => (
                <option key={option} value={option}>
                  {CATEGORY_LABELS[option]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500">Period</label>
            <input
              type="text"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              placeholder="2026-Q1"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-xs text-gray-500">Description</label>
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe this tax adjustment"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            />
          </div>

          <div className="lg:col-span-5">
            <label className="text-xs text-gray-500">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Support memo or working note"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-lg bg-[#0a0a0a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1a1a]"
            >
              Add Entry
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Adjustment Register</h2>
        <p className="mt-1 text-sm text-gray-500">These records feed the tax engine when you recompute tax pages.</p>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Period</th>
                <th className="px-4 py-3 text-left font-semibold">Type</th>
                <th className="px-4 py-3 text-left font-semibold">Category</th>
                <th className="px-4 py-3 text-left font-semibold">Description</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {records.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No tax adjustments recorded yet.
                  </td>
                </tr>
              )}
              {records.map((record) => (
                <tr key={record.id}>
                  <td className="px-4 py-3 text-gray-700">{formatDate(record.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-700">{record.period}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getTypePillClass(record.type)}`}>
                      {TYPE_LABELS[record.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{CATEGORY_LABELS[record.category]}</td>
                  <td className="px-4 py-3 text-gray-900">
                    <p className="font-medium">{record.description}</p>
                    {record.notes && <p className="mt-1 text-xs text-gray-500">{record.notes}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900" title={formatCurrencyFull(record.amount)}>
                    {formatCurrencyCompact(record.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeAdjustment(record.id)}
                      className="inline-flex rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
