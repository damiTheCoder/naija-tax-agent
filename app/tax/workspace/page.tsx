"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TaxRuleMetadata, UserProfile } from "@/lib/types";
import { CIT_CONFIG } from "@/lib/taxRules/config";
import { buildTransactionsFromFiles } from "@/lib/accounting/statementEngine";
import {
  taxEngine,
  detectTaxType,
  type TaxComputationResult,
  type TaxScheduleEntry,
  type TaxTransaction,
} from "@/lib/tax/taxEngine";
import { getClientTaxRuleMetadata, refreshClientTaxRules } from "@/lib/taxRules/liveRatesClient";

type WorkspaceDocument = {
  id: string;
  name: string;
  size: number;
  extracted: number;
  uploadedAt: string;
};

type WorkspaceSnapshot = {
  profile: UserProfile;
  transactions: TaxTransaction[];
  computations: TaxComputationResult[];
  schedules: TaxScheduleEntry[];
  lastUpdated: string;
};

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatCurrency = (amount: number) => currencyFormatter.format(Math.round(amount || 0));
const formatNumber = (value: number) => numberFormatter.format(Math.round(value || 0));
const formatFileSize = (size: number) => {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`;
};

export default function TaxWorkspacePage() {
  const baseState = taxEngine.getState();
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>({
    profile: baseState.profile,
    transactions: [...baseState.transactions],
    computations: [...baseState.computations],
    schedules: [...baseState.schedules],
    lastUpdated: baseState.lastUpdated,
  });
  const [summary, setSummary] = useState(() => taxEngine.getTaxSummary());
  const [ruleMetadata, setRuleMetadata] = useState<TaxRuleMetadata>(() => getClientTaxRuleMetadata());
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshingRules, setIsRefreshingRules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(
    "Drop ledgers or bank exports to auto-classify VAT/WHT and update the schedules.",
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hydratedRef = useRef(false);

  const syncSnapshot = useCallback(() => {
    const state = taxEngine.getState();
    setSnapshot({
      profile: { ...state.profile },
      transactions: [...state.transactions],
      computations: [...state.computations],
      schedules: [...state.schedules],
      lastUpdated: state.lastUpdated,
    });
    setSummary(taxEngine.getTaxSummary());
  }, []);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    taxEngine.load();
    syncSnapshot();
    const unsubscribe = taxEngine.subscribe(() => {
      syncSnapshot();
    });
    return () => unsubscribe();
  }, [syncSnapshot]);

  useEffect(() => {
    const hydrateRules = async () => {
      await refreshClientTaxRules();
      setRuleMetadata(getClientTaxRuleMetadata());
    };
    hydrateRules();
  }, []);

  const derivedStats = useMemo(() => {
    let revenue = 0;
    let deductible = 0;
    snapshot.transactions.forEach((tx) => {
      const amount = Math.abs(tx.amount);
      if (["sale", "income", "property-sale", "share-transfer"].includes(tx.type)) {
        revenue += amount;
      } else if (["expense", "purchase", "service-payment", "rent-payment", "contract-payment"].includes(tx.type)) {
        deductible += amount;
      }
    });
    const profit = revenue - deductible;
    const turnover = revenue;
    let citRate = CIT_CONFIG.largeCompanyRate;
    if (turnover <= CIT_CONFIG.smallCompanyThreshold) {
      citRate = CIT_CONFIG.smallCompanyRate;
    } else if (turnover <= CIT_CONFIG.mediumCompanyThreshold) {
      citRate = CIT_CONFIG.mediumCompanyRate;
    }
    const estimatedCIT = Math.max(0, profit) * citRate;
    return {
      revenue,
      deductible,
      profit,
      turnover,
      citRate,
      estimatedCIT,
    };
  }, [snapshot.transactions]);

  const computationFeed = useMemo(() => {
    return snapshot.computations
      .slice(-6)
      .reverse()
      .map((comp) => {
        const tx = snapshot.transactions.find((t) => t.id === comp.transactionId);
        return {
          id: comp.transactionId,
          description: tx?.description || `Transaction ${comp.transactionId.slice(-6)}`,
          date: tx?.date,
          taxes: comp.taxesApplied,
          amount: comp.amount,
        };
      });
  }, [snapshot.computations, snapshot.transactions]);

  const scheduleRows = useMemo(() => {
    return snapshot.schedules.slice(-5).reverse();
  }, [snapshot.schedules]);

  const summaryCards = [
    {
      label: "Net VAT position",
      value: summary.netVATPayable,
      hint: `Output ${formatCurrency(summary.totalVAT)} · Input credit ${formatCurrency(summary.inputVATCredit)}`,
    },
    {
      label: "Withholding tax captured",
      value: summary.totalWHT,
      hint: "Submit schedule by 21st next month",
    },
    {
      label: "Capital gains exposure",
      value: summary.totalCGT,
      hint: "Property, shares, asset disposals",
    },
    {
      label: "Stamp duty tally",
      value: summary.totalStampDuty,
      hint: "Transfers ≥ ₦10,000 & legal docs",
    },
    {
      label: "Estimated CIT/PIT",
      value: derivedStats.estimatedCIT,
      hint:
        derivedStats.citRate === 0
          ? "Small company threshold → exempt"
          : `${(derivedStats.citRate * 100).toFixed(0)}% on ₦${formatNumber(Math.max(0, derivedStats.profit))}`,
    },
  ];

  const ingestFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const filesArray = Array.from(fileList);
      if (filesArray.length === 0) return;
      setIsUploading(true);
      setError(null);
      try {
        const extracted = buildTransactionsFromFiles(filesArray as File[]);
        const docEntries: WorkspaceDocument[] = filesArray.map((file) => ({
          id: `${file.name}-${Date.now()}`,
          name: file.name,
          size: file.size,
          extracted: extracted.filter((tx) => tx.sourceDocument === file.name).length,
          uploadedAt: new Date().toISOString(),
        }));
        setDocuments((prev) => [...docEntries, ...prev].slice(0, 6));

        const snippets: string[] = [];
        extracted.forEach((tx) => {
          const detection = detectTaxType(tx.description, tx.amount, tx.category);
          const result = taxEngine.processTransaction({
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            category: tx.category,
            type: detection.transactionType,
            isResident: true,
          });
          const preview =
            result.taxesApplied.length > 0
              ? result.taxesApplied
                  .map((tax) => `${tax.taxType}: ${formatCurrency(tax.taxAmount)}`)
                  .join(", ")
              : "No immediate tax";
          snippets.push(`${tx.description} → ${preview}`);
        });

        const refreshedSummary = taxEngine.getTaxSummary();
        setSummary(refreshedSummary);
        setStatusMessage(
          `Processed ${extracted.length} transaction${extracted.length === 1 ? "" : "s"} from ${
            filesArray.length
          } file${filesArray.length > 1 ? "s" : ""}. ${snippets
            .slice(0, 3)
            .map((line) => line)
            .join(" | ")}${snippets.length > 3 ? " | ..." : ""} Net VAT now ${formatCurrency(
            refreshedSummary.netVATPayable,
          )} • ${ruleMetadata.version}`,
        );
      } catch (err) {
        console.error("Upload ingest failed", err);
        setError("Unable to process those statements. Please drop a CSV/PDF bank export or try again.");
      } finally {
        setIsUploading(false);
      }
    },
    [ruleMetadata.version],
  );

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      ingestFiles(files);
      event.target.value = "";
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      ingestFiles(event.dataTransfer.files);
      event.dataTransfer.clearData();
    }
  };

  const handleRefreshRules = async () => {
    setIsRefreshingRules(true);
    try {
      await refreshClientTaxRules(true);
      setRuleMetadata(getClientTaxRuleMetadata());
    } finally {
      setIsRefreshingRules(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-gray-500">Logi-based tax studio</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">Workspace hub for Nigerian tax flows</h1>
            <p className="mt-3 text-gray-600">
              Send ledgers, bank exports or manual entries. Every transaction is classified, matched to VAT/WHT/CGT rules,
              and streamed into the tax schedules without leaving this view.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <span className="inline-flex items-center rounded-full bg-amber-100/80 px-3 py-1 text-amber-800">
                Live rules: {ruleMetadata.version}
              </span>
              {ruleMetadata.source && <span>Source · {ruleMetadata.source}</span>}
              {ruleMetadata.lastUpdated && (
                <span>Updated {new Date(ruleMetadata.lastUpdated).toLocaleDateString("en-NG")}</span>
              )}
              <button
                onClick={handleRefreshRules}
                className="text-indigo-600 hover:text-indigo-800"
                disabled={isRefreshingRules}
              >
                {isRefreshingRules ? "Refreshing…" : "Refresh rules"}
              </button>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-2xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-gray-900/20 hover:bg-gray-800"
            >
              Upload statements
            </button>
            <button
              type="button"
              className="rounded-2xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-800 hover:border-gray-400"
              onClick={() => setStatusMessage("Need help? Mention the tax type and amount you are reviewing.")}
            >
              Quick tip
            </button>
          </div>
        </div>
        <input
          type="file"
          multiple
          ref={fileInputRef}
          className="hidden"
          onChange={handleFilesSelected}
          accept=".csv,.pdf,.xlsx,.xls,.json"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div
          className={`rounded-3xl border-2 border-dashed p-6 transition ${
            dragActive ? "border-indigo-400 bg-indigo-50/40" : "border-gray-200 bg-white"
          }`}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDrop={handleDrop}
        >
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-gray-900/90 p-3 text-white">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M4 7h16M4 12h10M4 17h7" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="4" y="4" width="16" height="16" rx="3" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">Drop financial statements</h3>
              <p className="text-sm text-gray-600">
                I will extract transactions, classify VAT/WHT automatically, and pipe them into the tax flows.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span className="rounded-full bg-gray-100 px-3 py-1">Bank exports</span>
                <span className="rounded-full bg-gray-100 px-3 py-1">Audited packs</span>
                <span className="rounded-full bg-gray-100 px-3 py-1">Payroll summaries</span>
              </div>
              {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
              {statusMessage && !error && <p className="mt-4 text-sm text-gray-600">{statusMessage}</p>}
              <div className="mt-6 space-y-3">
                {documents.length === 0 && <p className="text-sm text-gray-500">No documents uploaded yet.</p>}
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-2xl border border-gray-200 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{doc.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(doc.size)} • {doc.extracted} entries
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Parsed
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="mt-6 inline-flex items-center rounded-2xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300 disabled:opacity-60"
          >
            {isUploading ? "Processing…" : "Select files"}
          </button>
        </div>

        <div className="lg:col-span-2 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Tax snapshot</p>
              <h3 className="text-lg font-semibold text-gray-900">
                {snapshot.transactions.length} transactions · ₦{formatNumber(derivedStats.revenue)} gross
              </h3>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>Schedule ready</p>
              <p>{new Date(snapshot.lastUpdated).toLocaleString("en-NG")}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{formatCurrency(card.value)}</p>
                <p className="mt-1 text-xs text-gray-600">{card.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Tax timeline</p>
                <h3 className="text-lg font-semibold text-gray-900">Latest classified transactions</h3>
              </div>
              <span className="text-xs text-gray-500">Output VAT rate {ruleMetadata.version}</span>
            </div>
            <div className="mt-4 space-y-4">
              {computationFeed.length === 0 && (
                <p className="text-sm text-gray-500">No transactions classified yet. Upload data to start.</p>
              )}
              {computationFeed.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{entry.date ? new Date(entry.date).toLocaleDateString("en-NG") : "Pending date"}</span>
                    <span>₦{formatNumber(entry.amount)}</span>
                  </div>
                  <p className="mt-1 text-base font-medium text-gray-900">{entry.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                    {entry.taxes.map((tax) => (
                      <span key={`${entry.id}-${tax.taxType}`} className="rounded-full bg-gray-100 px-3 py-1 font-medium">
                        {tax.taxType}: {formatCurrency(tax.taxAmount)}
                      </span>
                    ))}
                    {entry.taxes.length === 0 && (
                      <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-600">
                        No tax impact detected
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Tax flows</p>
            <h3 className="mt-2 text-lg font-semibold text-gray-900">What the engine is tracking</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">VAT</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(summary.netVATPayable)}</p>
                <p className="text-xs text-indigo-900">
                  Output VAT {formatCurrency(summary.totalVAT)} minus input credit {formatCurrency(summary.inputVATCredit)}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">WHT Certificates</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(summary.totalWHT)}</p>
                <p className="text-xs text-emerald-900">Professional fees, rent, dividends & contracts</p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Capital Gains & Stamp</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {formatCurrency(summary.totalCGT + summary.totalStampDuty)}
                </p>
                <p className="text-xs text-amber-900">Asset disposals, property deeds, share transfers</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">CIT / PIT runway</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(derivedStats.estimatedCIT)}</p>
                <p className="text-xs text-slate-900">
                  Turnover ₦{formatNumber(derivedStats.turnover)} · Profit ₦{formatNumber(derivedStats.profit)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Schedules</p>
                <h3 className="text-lg font-semibold text-gray-900">Upcoming statutory filings</h3>
              </div>
              <span className="text-xs text-gray-500">{scheduleRows.length} open</span>
            </div>
            <div className="mt-4 space-y-3">
              {scheduleRows.length === 0 && <p className="text-sm text-gray-500">No schedules have been generated yet.</p>}
              {scheduleRows.map((schedule) => (
                <div key={schedule.id} className="flex items-center justify-between rounded-2xl border border-gray-100 p-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {schedule.taxType} · {schedule.period}
                    </p>
                    <p className="text-xs text-gray-500">Due {schedule.dueDate}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(schedule.taxAmount)}</p>
                    <p className="text-xs uppercase tracking-wide text-gray-500">{schedule.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </section>
    </div>
  );
}
