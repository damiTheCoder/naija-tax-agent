"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getDefaultTaxSettings,
  loadTaxSettings,
  resetTaxSettings,
  saveTaxSettings,
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
    setDraft(loadTaxSettings(ENTITY_ID));
  }, []);

  const rateInputs = useMemo(() => {
    return rateFields.reduce((acc, field) => {
      acc[field.key] = String(toPercent(draft.taxRates[field.key]));
      return acc;
    }, {} as Record<RateField, string>);
  }, [draft.taxRates]);

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

  const save = () => {
    const saved = saveTaxSettings({
      ...draft,
      entityId: ENTITY_ID,
    });
    setDraft(saved);
    setStatusMessage("Tax environment settings saved. New computations will use these values.");
  };

  const reset = () => {
    const defaults = resetTaxSettings(ENTITY_ID);
    setDraft(defaults);
    setStatusMessage("Tax settings reset to defaults.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tax Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure tax jurisdiction, rates, company profile, and fiscal year behavior.
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
