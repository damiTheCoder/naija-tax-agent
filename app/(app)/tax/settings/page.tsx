"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getDefaultTaxSettings,
  resetTaxSettings,
  saveTaxSettings,
  saveTaxSettingsToApi,
  loadTaxSettingsFromApi,
  type TaxEnvironmentSettings,
  type TaxJurisdiction,
} from "@/lib/tax/settings";

const ENTITY_ID = "entity-default";

const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const toPercent = (decimal: number) => Number((decimal * 100).toFixed(3));
const parsePercent = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed) / 100;
};

const formatUpdatedAt = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

type RateField = keyof TaxEnvironmentSettings["taxRates"];

const rateFields: Array<{ key: RateField; label: string }> = [
  { key: "vatRate", label: "VAT Rate" },
  { key: "citSmallRate", label: "CIT (Small Company)" },
  { key: "citMediumRate", label: "CIT (Medium Company)" },
  { key: "citLargeRate", label: "CIT (Large Company)" },
  { key: "minimumTaxRate", label: "Minimum Tax Rate" },
  { key: "whtProfessionalServices", label: "WHT - Professional Services" },
  { key: "whtRent", label: "WHT - Rent" },
  { key: "whtContract", label: "WHT - Contract" },
  { key: "whtDividend", label: "WHT - Dividend" },
  { key: "whtInterest", label: "WHT - Interest" },
  { key: "whtRoyalty", label: "WHT - Royalty" },
  { key: "cgtRate", label: "CGT Rate" },
];

export default function TaxSettingsPage() {
  const [draft, setDraft] = useState<TaxEnvironmentSettings>(() => getDefaultTaxSettings(ENTITY_ID));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    loadTaxSettingsFromApi(ENTITY_ID)
      .then((settings) => {
        if (mounted) setDraft(settings);
      })
      .catch(() => {
        if (mounted) setDraft(getDefaultTaxSettings(ENTITY_ID));
      });
    return () => {
      mounted = false;
    };
  }, []);

  const rateInputs = useMemo(() => {
    return rateFields.reduce((acc, field) => {
      acc[field.key] = String(toPercent(draft.taxRates[field.key]));
      return acc;
    }, {} as Record<RateField, string>);
  }, [draft.taxRates]);

  const matrixCategories = useMemo(() => {
    const keys = new Set([
      "inventory",
      "revenue",
      "rent",
      "salary",
      ...Object.keys(draft.categoryTaxMatrix || {}),
      ...Object.keys(draft.defaultVatModeByCategory || {}),
    ]);
    return Array.from(keys).sort();
  }, [draft.categoryTaxMatrix, draft.defaultVatModeByCategory]);

  const updateJurisdiction = (value: TaxJurisdiction) => {
    setDraft((prev) => ({
      ...prev,
      jurisdiction: value,
    }));
  };

  const updateRate = (field: RateField, value: string) => {
    setDraft((prev) => ({
      ...prev,
      taxRates: {
        ...prev.taxRates,
        [field]: parsePercent(value),
      },
    }));
  };

  const updateCompanyField = (field: keyof TaxEnvironmentSettings["companyInfo"], value: string) => {
    setDraft((prev) => ({
      ...prev,
      companyInfo: {
        ...prev.companyInfo,
        [field]: value,
      },
    }));
  };

  const save = async () => {
    const saved = await saveTaxSettingsToApi({
      ...draft,
      entityId: ENTITY_ID,
    });
    setDraft(saved);
    setStatusMessage("Tax environment settings saved to server. New computations use the ledger-first config.");
  };

  const reset = async () => {
    const defaults = resetTaxSettings(ENTITY_ID);
    const saved = await saveTaxSettingsToApi(defaults);
    saveTaxSettings(saved);
    setDraft(saved);
    setStatusMessage("Tax settings reset to defaults.");
  };

  const updateMatrixRule = (
    category: string,
    patch: Partial<TaxEnvironmentSettings["categoryTaxMatrix"][string]>
  ) => {
    setDraft((prev) => ({
      ...prev,
      categoryTaxMatrix: {
        ...prev.categoryTaxMatrix,
        [category]: {
          ...(prev.categoryTaxMatrix[category] || {}),
          ...patch,
        },
      },
    }));
  };

  const updateDefaultVatMode = (category: string, mode: "inclusive" | "exclusive") => {
    setDraft((prev) => ({
      ...prev,
      defaultVatModeByCategory: {
        ...prev.defaultVatModeByCategory,
        [category]: mode,
      },
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tax Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure tax jurisdiction, rates, filing cadence, and category-level tax engine behavior.
          </p>
        </div>
        <p className="text-xs text-gray-500">Updated: {formatUpdatedAt(draft.updatedAt)}</p>
      </div>

      {statusMessage && (
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
          {statusMessage}
        </div>
      )}

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Tax Jurisdiction</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-gray-500">Jurisdiction</label>
            <select
              value={draft.jurisdiction}
              onChange={(event) => updateJurisdiction(event.target.value as TaxJurisdiction)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            >
              <option value="Nigeria">Nigeria</option>
              <option value="Ghana">Ghana</option>
              <option value="Kenya">Kenya</option>
              <option value="South Africa">South Africa</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Tax Rates</h2>
        <p className="mt-1 text-sm text-gray-500">All values are percentages.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rateFields.map((field) => (
            <div key={field.key}>
              <label className="text-xs text-gray-500">{field.label}</label>
              <div className="mt-1 relative">
                <input
                  type="number"
                  step="0.001"
                  min={0}
                  value={rateInputs[field.key]}
                  onChange={(event) => updateRate(field.key, event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-700"
                />
                <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-gray-500">%</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Filing Cadence</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs text-gray-500">VAT Filing</label>
            <select
              value={draft.filingCadence.vat}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  filingCadence: {
                    ...prev.filingCadence,
                    vat: event.target.value as "monthly" | "quarterly",
                  },
                }))
              }
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">WHT Filing</label>
            <select
              value={draft.filingCadence.wht}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  filingCadence: {
                    ...prev.filingCadence,
                    wht: event.target.value as "monthly" | "quarterly",
                  },
                }))
              }
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Due Day</label>
            <input
              type="number"
              min={1}
              max={28}
              value={draft.filingDueDay}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  filingDueDay: Math.min(28, Math.max(1, Number(event.target.value) || 21)),
                }))
              }
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Category Tax Matrix</h2>
        <p className="mt-1 text-sm text-gray-500">
          Configure VAT/WHT behavior by category, including default VAT inclusive/exclusive mode.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[920px] w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">VAT Applicable</th>
                <th className="px-3 py-2 text-left">VAT Category</th>
                <th className="px-3 py-2 text-left">VAT Mode Default</th>
                <th className="px-3 py-2 text-left">WHT Applicable</th>
                <th className="px-3 py-2 text-left">WHT Rate %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {matrixCategories.map((category) => {
                const rule = draft.categoryTaxMatrix[category] || {};
                const defaultMode = draft.defaultVatModeByCategory[category] || "exclusive";
                return (
                  <tr key={category}>
                    <td className="px-3 py-2 font-medium text-gray-900 capitalize">{category}</td>
                    <td className="px-3 py-2">
                      <select
                        value={rule.vatApplicable === false ? "no" : "yes"}
                        onChange={(event) => updateMatrixRule(category, { vatApplicable: event.target.value === "yes" })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5"
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={rule.vatCategory || "input"}
                        onChange={(event) =>
                          updateMatrixRule(category, {
                            vatCategory: event.target.value as "input" | "output" | "exempt" | "zero",
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5"
                      >
                        <option value="input">Input</option>
                        <option value="output">Output</option>
                        <option value="exempt">Exempt</option>
                        <option value="zero">Zero-rated</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={defaultMode}
                        onChange={(event) => updateDefaultVatMode(category, event.target.value as "inclusive" | "exclusive")}
                        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5"
                      >
                        <option value="exclusive">Exclusive</option>
                        <option value="inclusive">Inclusive</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={rule.whtApplicable ? "yes" : "no"}
                        onChange={(event) => updateMatrixRule(category, { whtApplicable: event.target.value === "yes" })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5"
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.001"
                        value={toPercent(rule.whtRate ?? 0)}
                        onChange={(event) => updateMatrixRule(category, { whtRate: parsePercent(event.target.value) })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Company Info</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-gray-500">Legal Name</label>
            <input
              type="text"
              value={draft.companyInfo.legalName}
              onChange={(event) => updateCompanyField("legalName", event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Trading Name</label>
            <input
              type="text"
              value={draft.companyInfo.tradingName}
              onChange={(event) => updateCompanyField("tradingName", event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">TIN</label>
            <input
              type="text"
              value={draft.companyInfo.tin}
              onChange={(event) => updateCompanyField("tin", event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">RC Number</label>
            <input
              type="text"
              value={draft.companyInfo.rcNumber}
              onChange={(event) => updateCompanyField("rcNumber", event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Email</label>
            <input
              type="email"
              value={draft.companyInfo.email}
              onChange={(event) => updateCompanyField("email", event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Phone</label>
            <input
              type="text"
              value={draft.companyInfo.phone}
              onChange={(event) => updateCompanyField("phone", event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-500">Address</label>
            <input
              type="text"
              value={draft.companyInfo.address}
              onChange={(event) => updateCompanyField("address", event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Fiscal Year Settings</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-gray-500">Fiscal Year Start Month</label>
            <select
              value={draft.fiscalYear.startMonth}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  fiscalYear: {
                    ...prev.fiscalYear,
                    startMonth: Number(event.target.value),
                  },
                }))
              }
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            >
              {MONTH_OPTIONS.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          className="inline-flex items-center rounded-lg bg-[#0a0a0a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1a1a]"
        >
          Save Settings
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Reset Defaults
        </button>
      </div>
    </div>
  );
}
