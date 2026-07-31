"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { accountingEngine } from "@/lib/accounting/transactionBridge";
import { mapJournalEntriesToCompliance } from "@/lib/tax/compliance/adapters";
import {
  classifyTransactions,
  getRuleSet,
  type ComplianceTransaction,
  type TaxType,
} from "@/lib/tax/compliance";

type ExtendedTaxType = TaxType | "PAYE" | "EDT" | "NONE";
type RowStatus = "auto" | "manual" | "unclassified" | "reviewed" | "excluded";
type TaxTypeFilter = "all" | ExtendedTaxType;
type StatusFilter = "all" | RowStatus;

type TxOverride = {
  taxType?: "AUTO" | ExtendedTaxType;
  vatApplicable?: boolean;
  whtApplicable?: boolean;
  taxMode?: "inclusive" | "exclusive" | "category_default";
  taxCategory?: string;
  status?: RowStatus;
};

type BulkSwitch = "keep" | "yes" | "no";

type TaxTransactionRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  taxMode: "inclusive" | "exclusive" | "category_default";
  taxCategory: string;
  taxType: ExtendedTaxType;
  vatApplicable: boolean;
  whtApplicable: boolean;
  status: RowStatus;
  autoTaxTypes: TaxType[];
};

const OVERRIDES_KEY = "ql::tax::tx-overrides";
const TAX_TYPE_PRIORITY: TaxType[] = ["VAT", "WHT", "CIT", "CGT", "STAMP"];
const EXTENDED_TAX_TYPE_OPTIONS: Array<"AUTO" | ExtendedTaxType> = [
  "AUTO",
  "VAT",
  "WHT",
  "CIT",
  "CGT",
  "STAMP",
  "PAYE",
  "EDT",
  "NONE",
];
const STATUS_OPTIONS: RowStatus[] = ["auto", "manual", "reviewed", "unclassified", "excluded"];

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

const readNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const safeDate = (dateLike: string) => {
  const date = new Date(dateLike);
  return Number.isNaN(date.getTime()) ? null : date;
};

function loadOverrides(): Record<string, TxOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, TxOverride>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides: Record<string, TxOverride>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
}

const formatDate = (dateLike: string) => {
  const date = safeDate(dateLike);
  if (!date) return "Unknown date";
  return date.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
};

export default function TaxTransactionsPage() {
  const [transactions, setTransactions] = useState<ComplianceTransaction[]>([]);
  const [classificationMap, setClassificationMap] = useState<Record<string, TaxType[]>>({});
  const [overrides, setOverrides] = useState<Record<string, TxOverride>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncingOverrides, setIsSyncingOverrides] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [taxTypeFilter, setTaxTypeFilter] = useState<TaxTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [bulkTaxType, setBulkTaxType] = useState<"keep" | "AUTO" | ExtendedTaxType>("keep");
  const [bulkStatus, setBulkStatus] = useState<"keep" | RowStatus>("keep");
  const [bulkVatApplicable, setBulkVatApplicable] = useState<BulkSwitch>("keep");
  const [bulkWhtApplicable, setBulkWhtApplicable] = useState<BulkSwitch>("keep");

  useEffect(() => {
    setOverrides(loadOverrides());
  }, []);

  useEffect(() => {
    saveOverrides(overrides);
  }, [overrides]);

  const refreshClassification = useCallback(() => {
    setIsRefreshing(true);
    try {
      accountingEngine.load();
      const entries = accountingEngine.getState().journalEntries;
      const mapped = mapJournalEntriesToCompliance("entity-default", entries);
      const ruleSet = getRuleSet();
      const classifications = classifyTransactions(mapped, ruleSet);
      const byTransaction: Record<string, TaxType[]> = {};

      classifications.forEach((item) => {
        const existing = byTransaction[item.transactionId] || [];
        if (!existing.includes(item.taxType)) {
          existing.push(item.taxType);
          byTransaction[item.transactionId] = existing;
        }
      });

      Object.keys(byTransaction).forEach((txId) => {
        byTransaction[txId] = [...byTransaction[txId]].sort(
          (a, b) => TAX_TYPE_PRIORITY.indexOf(a) - TAX_TYPE_PRIORITY.indexOf(b)
        );
      });

      setTransactions(mapped);
      setClassificationMap(byTransaction);
      setStatusMessage(`Classified ${mapped.length} tax transactions from accounting records.`);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshClassification();
    const unsubscribe = accountingEngine.subscribe(() => {
      refreshClassification();
    });
    return () => unsubscribe();
  }, [refreshClassification]);

  const rows = useMemo<TaxTransactionRow[]>(() => {
    return transactions.map((tx) => {
      const autoTaxTypes = classificationMap[tx.id] || [];
      const autoPrimaryTaxType: ExtendedTaxType =
        autoTaxTypes.length > 0 ? autoTaxTypes[0] : "NONE";
      const override = overrides[tx.id];

      const autoVatApplicable =
        autoTaxTypes.includes("VAT") ||
        readNumber(tx.metadata?.vatOutputAmount) > 0 ||
        readNumber(tx.metadata?.vatInputAmount) > 0;
      const autoWhtApplicable =
        autoTaxTypes.includes("WHT") ||
        readNumber(tx.metadata?.whtPayableAmount) > 0 ||
        readNumber(tx.metadata?.whtReceivableAmount) > 0;

      const taxType =
        override?.taxType && override.taxType !== "AUTO"
          ? override.taxType
          : autoPrimaryTaxType;
      const metadata = (tx.metadata || {}) as Record<string, unknown>;
      const taxMode =
        override?.taxMode ||
        (metadata.taxMode === "inclusive" || metadata.taxMode === "exclusive"
          ? metadata.taxMode
          : "category_default");
      const taxCategory =
        override?.taxCategory ||
        (typeof metadata.taxCategory === "string" && metadata.taxCategory.trim()
          ? metadata.taxCategory
          : tx.type || "general");
      const status: RowStatus =
        override?.status || (autoTaxTypes.length > 0 ? "auto" : "unclassified");

      return {
        id: tx.id,
        date: tx.date,
        description: tx.description || "Transaction",
        amount: tx.amount,
        category: tx.type || "general",
        taxMode,
        taxCategory,
        taxType,
        vatApplicable:
          typeof override?.vatApplicable === "boolean"
            ? override.vatApplicable
            : autoVatApplicable,
        whtApplicable:
          typeof override?.whtApplicable === "boolean"
            ? override.whtApplicable
            : autoWhtApplicable,
        status,
        autoTaxTypes,
      };
    });
  }, [transactions, classificationMap, overrides]);

  const syncTransactionOverrides = useCallback(
    async (transactionIds: string[], patches?: Record<string, TxOverride>) => {
      if (transactionIds.length === 0) return;
      const journalEntries = accountingEngine.getState().journalEntries;
      const selected = journalEntries.filter((entry) => transactionIds.includes(entry.id));
      if (selected.length === 0) return;

      setIsSyncingOverrides(true);
      try {
        const journals = selected.map((entry) => {
          const override = {
            ...(overrides[entry.id] || {}),
            ...(patches?.[entry.id] || {}),
          };
          return {
            ...entry,
            metadata: {
              ...((entry.metadata || {}) as Record<string, unknown>),
              ...(typeof override.vatApplicable === "boolean" ? { vatApplicable: override.vatApplicable } : {}),
              ...(typeof override.vatApplicable === "boolean" ? { vatApplicableManual: true } : {}),
              ...(typeof override.whtApplicable === "boolean" ? { whtApplicable: override.whtApplicable } : {}),
              ...(typeof override.whtApplicable === "boolean" ? { whtApplicableManual: true } : {}),
              ...(override.taxMode ? { taxMode: override.taxMode } : {}),
              ...(override.taxCategory ? { taxCategory: override.taxCategory } : {}),
            },
          };
        });

        const response = await fetch("/api/tax/sync-journals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityId: "entity-default",
            source: "live_posting",
            journals,
          }),
        });
        if (!response.ok) {
          throw new Error(`Sync failed (${response.status})`);
        }
        setStatusMessage(`Synced ${journals.length} override(s) to tax engine.`);
      } catch (syncError) {
        console.error("Failed to sync tax overrides", syncError);
        setStatusMessage("Could not sync overrides to tax engine right now.");
      } finally {
        setIsSyncingOverrides(false);
      }
    },
    [overrides]
  );

  const categoryOptions = useMemo(() => {
    const categories = new Set<string>();
    rows.forEach((row) => categories.add(row.category));
    return Array.from(categories).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows
      .filter((row) => {
        if (dateFrom) {
          const from = safeDate(`${dateFrom}T00:00:00`);
          const rowDate = safeDate(row.date);
          if (from && rowDate && rowDate < from) return false;
        }
        if (dateTo) {
          const to = safeDate(`${dateTo}T23:59:59.999`);
          const rowDate = safeDate(row.date);
          if (to && rowDate && rowDate > to) return false;
        }
        if (taxTypeFilter !== "all" && row.taxType !== taxTypeFilter) return false;
        if (statusFilter !== "all" && row.status !== statusFilter) return false;
        if (categoryFilter !== "all" && row.category !== categoryFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const da = safeDate(a.date)?.getTime() || 0;
        const db = safeDate(b.date)?.getTime() || 0;
        return db - da;
      });
  }, [rows, dateFrom, dateTo, taxTypeFilter, statusFilter, categoryFilter]);

  const sections = useMemo(() => {
    const revenue = filteredRows.filter((row) => row.category.includes("sale") || row.category.includes("income")).length;
    const expense = filteredRows.filter((row) => row.category.includes("expense") || row.category.includes("purchase")).length;
    const vatEligible = filteredRows.filter((row) => row.vatApplicable).length;
    const whtEligible = filteredRows.filter((row) => row.whtApplicable).length;
    return { revenue, expense, vatEligible, whtEligible };
  }, [filteredRows]);

  const selectedCount = selectedIds.length;
  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedIds.includes(row.id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredRows.some((row) => row.id === id)));
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredRows.forEach((row) => next.add(row.id));
      return Array.from(next);
    });
  };

  const toggleRowSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const applyBulkEdit = () => {
    if (selectedIds.length === 0) return;
    setOverrides((prev) => {
      const next = { ...prev };
      selectedIds.forEach((id) => {
        const current = next[id] || {};
        const updated: TxOverride = { ...current };

        if (bulkTaxType !== "keep") {
          updated.taxType = bulkTaxType;
          updated.status = "manual";
        }
        if (bulkStatus !== "keep") {
          updated.status = bulkStatus;
        }
        if (bulkVatApplicable !== "keep") {
          updated.vatApplicable = bulkVatApplicable === "yes";
          updated.status = "manual";
        }
        if (bulkWhtApplicable !== "keep") {
          updated.whtApplicable = bulkWhtApplicable === "yes";
          updated.status = "manual";
        }

        next[id] = updated;
      });
      return next;
    });

    const selectedToSync = [...selectedIds];
    setSelectedIds([]);
    setBulkTaxType("keep");
    setBulkStatus("keep");
    setBulkVatApplicable("keep");
    setBulkWhtApplicable("keep");
    setStatusMessage("Bulk edit applied to selected transactions.");
    void syncTransactionOverrides(selectedToSync);
  };

  const setRowOverride = (id: string, patch: Partial<TxOverride>) => {
    setOverrides((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        ...patch,
      },
    }));
  };

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tax Transactions</h1>
          <p className="text-sm text-gray-500 mt-1">Source of truth for tax computation across all taxable transactions.</p>
        </div>
        <button
          type="button"
          onClick={refreshClassification}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0a0a0a] text-white text-sm font-medium hover:bg-[#1a1a1a] disabled:opacity-60"
        >
          <svg className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isRefreshing ? "Classifying..." : "Auto Classify"}
        </button>
      </div>

      {statusMessage && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <p className="text-xs uppercase tracking-wide text-gray-500">Revenue transactions</p>
          <p className="mt-2 text-xl font-bold text-gray-900">{sections.revenue}</p>
        </div>
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <p className="text-xs uppercase tracking-wide text-gray-500">Expense transactions</p>
          <p className="mt-2 text-xl font-bold text-gray-900">{sections.expense}</p>
        </div>
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <p className="text-xs uppercase tracking-wide text-gray-500">VAT-eligible transactions</p>
          <p className="mt-2 text-xl font-bold text-gray-900">{sections.vatEligible}</p>
        </div>
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <p className="text-xs uppercase tracking-wide text-gray-500">Withholding tax transactions</p>
          <p className="mt-2 text-xl font-bold text-gray-900">{sections.whtEligible}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div>
            <label className="text-xs text-gray-500">Date from</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Date to</label>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Tax type</label>
            <select
              value={taxTypeFilter}
              onChange={(event) => setTaxTypeFilter(event.target.value as TaxTypeFilter)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="VAT">VAT</option>
              <option value="WHT">WHT</option>
              <option value="CIT">CIT</option>
              <option value="CGT">CGT</option>
              <option value="STAMP">STAMP</option>
              <option value="PAYE">PAYE</option>
              <option value="EDT">EDT</option>
              <option value="NONE">None</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Status</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Category</label>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              setTaxTypeFilter("all");
              setStatusFilter("all");
              setCategoryFilter("all");
            }}
            className="h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
          >
            Reset filters
          </button>
          <div className="lg:ml-auto text-xs text-gray-500">
            {filteredRows.length} transactions
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="text-sm font-semibold text-gray-900">
            Bulk edit ({selectedCount} selected)
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
            <select
              value={bulkTaxType}
              onChange={(event) => setBulkTaxType(event.target.value as "keep" | "AUTO" | ExtendedTaxType)}
              className="rounded-lg border border-gray-200 px-2 py-2 text-xs"
            >
              <option value="keep">Tax type: keep</option>
              {EXTENDED_TAX_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <select
              value={bulkStatus}
              onChange={(event) => setBulkStatus(event.target.value as "keep" | RowStatus)}
              className="rounded-lg border border-gray-200 px-2 py-2 text-xs"
            >
              <option value="keep">Status: keep</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select
              value={bulkVatApplicable}
              onChange={(event) => setBulkVatApplicable(event.target.value as BulkSwitch)}
              className="rounded-lg border border-gray-200 px-2 py-2 text-xs"
            >
              <option value="keep">VAT: keep</option>
              <option value="yes">VAT: yes</option>
              <option value="no">VAT: no</option>
            </select>
            <select
              value={bulkWhtApplicable}
              onChange={(event) => setBulkWhtApplicable(event.target.value as BulkSwitch)}
              className="rounded-lg border border-gray-200 px-2 py-2 text-xs"
            >
              <option value="keep">WHT: keep</option>
              <option value="yes">WHT: yes</option>
              <option value="no">WHT: no</option>
            </select>
          </div>
          <button
            type="button"
            onClick={applyBulkEdit}
            disabled={selectedCount === 0}
            className="h-10 px-4 rounded-lg bg-[#2563eb] text-white text-sm font-medium disabled:opacity-50"
          >
            Apply to selected
          </button>
          <button
            type="button"
            onClick={() => void syncTransactionOverrides(selectedIds)}
            disabled={selectedCount === 0 || isSyncingOverrides}
            className="h-10 px-4 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 disabled:opacity-50"
          >
            {isSyncingOverrides ? "Syncing..." : "Sync overrides"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    aria-label="Select all visible rows"
                  />
                </th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Description</th>
                <th className="px-3 py-3">Amount</th>
                <th className="px-3 py-3">Tax type</th>
                <th className="px-3 py-3">VAT mode</th>
                <th className="px-3 py-3">Tax category</th>
                <th className="px-3 py-3">VAT applicable</th>
                <th className="px-3 py-3">Withholding tax applicable</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/60 align-top">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={() => toggleRowSelection(row.id)}
                      aria-label={`Select transaction ${row.id}`}
                    />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-gray-700">{formatDate(row.date)}</td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-gray-900">{row.description}</p>
                    <p className="text-xs text-gray-500 mt-1">Category: {row.category}</p>
                  </td>
                  <td className="px-3 py-3 font-semibold text-gray-900" title={formatCurrencyFull(row.amount)}>
                    {formatCurrencyCompact(row.amount)}
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={overrides[row.id]?.taxType || "AUTO"}
                      onChange={(event) => {
                        const value = event.target.value as "AUTO" | ExtendedTaxType;
                        const patch = {
                          taxType: value,
                          status: value === "AUTO" ? undefined : "manual",
                        } as TxOverride;
                        setRowOverride(row.id, patch);
                        void syncTransactionOverrides([row.id], { [row.id]: patch });
                      }}
                      className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"
                    >
                      {EXTENDED_TAX_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option === "AUTO" ? `AUTO (${row.autoTaxTypes[0] || "NONE"})` : option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={row.taxMode}
                      onChange={(event) => {
                        const mode = event.target.value as "inclusive" | "exclusive" | "category_default";
                        setRowOverride(row.id, { taxMode: mode, status: "manual" });
                        void syncTransactionOverrides([row.id], { [row.id]: { taxMode: mode, status: "manual" } });
                      }}
                      className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"
                    >
                      <option value="category_default">Category Default</option>
                      <option value="exclusive">Exclusive</option>
                      <option value="inclusive">Inclusive</option>
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="text"
                      value={row.taxCategory}
                      onChange={(event) => {
                        const nextCategory = event.target.value;
                        setRowOverride(row.id, { taxCategory: nextCategory, status: "manual" });
                      }}
                      onBlur={(event) =>
                        void syncTransactionOverrides([row.id], {
                          [row.id]: { taxCategory: event.target.value, status: "manual" },
                        })
                      }
                      className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={
                        typeof overrides[row.id]?.vatApplicable === "boolean"
                          ? overrides[row.id]?.vatApplicable
                            ? "yes"
                            : "no"
                          : "auto"
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === "auto") {
                          setRowOverride(row.id, { vatApplicable: undefined });
                          void syncTransactionOverrides([row.id], { [row.id]: { vatApplicable: undefined } });
                        } else {
                          setRowOverride(row.id, { vatApplicable: value === "yes", status: "manual" });
                          void syncTransactionOverrides([row.id], {
                            [row.id]: { vatApplicable: value === "yes", status: "manual" },
                          });
                        }
                      }}
                      className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"
                    >
                      <option value="auto">Auto ({row.vatApplicable ? "Yes" : "No"})</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={
                        typeof overrides[row.id]?.whtApplicable === "boolean"
                          ? overrides[row.id]?.whtApplicable
                            ? "yes"
                            : "no"
                          : "auto"
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === "auto") {
                          setRowOverride(row.id, { whtApplicable: undefined });
                          void syncTransactionOverrides([row.id], { [row.id]: { whtApplicable: undefined } });
                        } else {
                          setRowOverride(row.id, { whtApplicable: value === "yes", status: "manual" });
                          void syncTransactionOverrides([row.id], {
                            [row.id]: { whtApplicable: value === "yes", status: "manual" },
                          });
                        }
                      }}
                      className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"
                    >
                      <option value="auto">Auto ({row.whtApplicable ? "Yes" : "No"})</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={row.status}
                      onChange={(event) => {
                        const nextStatus = event.target.value as RowStatus;
                        setRowOverride(row.id, { status: nextStatus });
                        void syncTransactionOverrides([row.id], { [row.id]: { status: nextStatus } });
                      }}
                      className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
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
