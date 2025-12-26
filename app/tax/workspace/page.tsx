"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TaxRuleMetadata, UserProfile } from "@/lib/types";
import { DEFAULT_TAX_YEAR, CIT_CONFIG } from "@/lib/taxRules/config";
import { clearAllData } from "@/lib/utils/system";
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

type ActiveTab = "timeline" | "schedules" | "flows" | "documents";

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

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "Pending date";
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hydratedRef = useRef(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>("timeline");

  // Filtering Logic
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    snapshot.transactions.forEach((tx) => {
      if (tx.date) {
        years.add(new Date(tx.date).getFullYear());
      }
    });
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [snapshot.transactions]);


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

  const ingestFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const filesArray = Array.from(fileList);
      if (filesArray.length === 0) return;
      setIsUploading(true);
      setError(null);
      try {
        const extracted = buildTransactionsFromFiles(filesArray as File[]);
        const docEntries: WorkspaceDocument[] = filesArray.map((file) => ({
          id: `${file.name} -${Date.now()} `,
          name: file.name,
          size: file.size,
          extracted: extracted.filter((tx) => tx.sourceDocument === file.name).length,
          uploadedAt: new Date().toISOString(),
        }));
        setDocuments((prev) => [...docEntries, ...prev].slice(0, 6));

        const snippets: string[] = [];
        extracted.forEach((tx) => {
          const detection = detectTaxType(tx.description, tx.amount, tx.category);
          taxEngine.processTransaction({
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            category: tx.category,
            type: detection.transactionType,
            isResident: true,
          });
          snippets.push(tx.description);
        });

        // Force a re-sync after processing
        syncSnapshot();

        setStatusMessage(
          `Processed ${extracted.length} transaction${extracted.length === 1 ? "" : "s"} from ${filesArray.length} file(s).`
        );
      } catch (err) {
        console.error("Upload ingest failed", err);
        setError("Unable to process those statements. Please drop a CSV or JSON bank export.");
      } finally {
        setIsUploading(false);
      }
    },
    [syncSnapshot]
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

  // Apply filters to computations
  const filteredComputations = useMemo(() => {
    return snapshot.computations.filter(comp => {
      const tx = snapshot.transactions.find(t => t.id === comp.transactionId);
      if (!tx || !tx.date) return false;

      const txDate = new Date(tx.date);
      if (txDate.getFullYear() !== selectedYear) return false;
      if (dateFrom && txDate < new Date(dateFrom)) return false;
      if (dateTo && txDate > new Date(dateTo)) return false;

      return true;
    }).reverse();
  }, [snapshot.computations, snapshot.transactions, selectedYear, dateFrom, dateTo]);


  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "timeline",
      label: "Tax Timeline",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: "schedules",
      label: "Tax Schedules",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      id: "flows",
      label: "Tax Flows",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      ),
    },
    {
      id: "documents",
      label: "Documents",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      )
    }
  ];

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Tax Workspace</h1>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-xs font-medium text-slate-600 border border-slate-200">{ruleMetadata.version}</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Manage tax liabilities, view schedules, and track compliance status.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-xs">
            <span className={`w-2 h-2 rounded-full ${isRefreshingRules ? "bg-amber-500 animate-pulse" : "bg-green-500"}`}></span>
            <span className="text-gray-600">Engine Online</span>
          </div>
          <button
            onClick={handleRefreshRules}
            disabled={isRefreshingRules}
            className="flex items-center gap-2 px-4 py-2 bg-[#0a0a0a] text-white text-sm font-medium rounded-lg hover:bg-[#1a1a1a] disabled:opacity-50 transition-colors"
          >
            <svg className={`w-4 h-4 ${isRefreshingRules ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isRefreshingRules ? "Syncing..." : "Sync Rules"}
          </button>
          <button
            onClick={() => {
              if (confirm("This will permanently clear all your transactions and tax history. Proceed?")) {
                clearAllData();
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white text-rose-600 border border-rose-200 text-sm font-medium rounded-lg hover:bg-rose-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear Data
          </button>
        </div>
      </div>

      {/* Stats Summary Deck */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Net VAT", value: summary.netVATPayable, color: "indigo" },
          { label: "WHT", value: summary.totalWHT, color: "emerald" },
          { label: "CGT & Stamp", value: summary.totalCGT + summary.totalStampDuty, color: "amber" },
          { label: "Est. CIT", value: derivedStats.estimatedCIT, color: "slate" },
        ].map((stat, idx) => (
          <div key={idx} className={`p-4 rounded-xl border bg-white border-gray-200/60 shadow-sm`}>
            <p className={`text-xs font-semibold uppercase tracking-wide text-${stat.color}-600`}>{stat.label}</p>
            <p className="mt-2 text-xl font-bold text-gray-900">{formatCurrency(stat.value)}</p>
          </div>
        ))}
      </div>


      {/* Filtering */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Filter by:</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#64B5F6] focus:border-transparent"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">From:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#64B5F6] focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">To:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#64B5F6] focus:border-transparent"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Clear filters
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500">{snapshot.transactions.length} total entries</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items - center gap - 2 px - 4 py - 3 text - sm font - medium border - b - 2 transition - colors whitespace - nowrap ${activeTab === tab.id
                ? "border-[#64B5F6] text-[#64B5F6]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[400px]">

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div>
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Tax Computation Timeline</h2>
                <p className="text-xs text-gray-500 mt-0.5">{filteredComputations.length} processed entries for {selectedYear}</p>
              </div>
            </div>
            {filteredComputations.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400">
                <p>No tax computations found for this period</p>
                <button onClick={() => setActiveTab("documents")} className="text-xs mt-2 text-[#64B5F6] hover:underline">Upload documents to start</button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredComputations.map((comp) => {
                  const tx = snapshot.transactions.find((t) => t.id === comp.transactionId);
                  return (
                    <div key={comp.transactionId} className="p-4 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{comp.transactionId.slice(-6)}</span>
                            {comp.taxesApplied.length > 0 ? (
                              comp.taxesApplied?.map(t => (
                                <span key={`${comp.transactionId} -${t.taxType} `} className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                                  {t.taxType}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">Exempt / No Tax</span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-900 mt-1">{tx?.description}</p>
                        </div>
                        <span className="text-xs text-gray-400">{formatDate(tx?.date)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                        <span className="text-xs text-gray-500">Gross Amount: <span className="text-gray-900 font-medium">{formatCurrency(comp.amount)}</span></span>
                        <div className="text-right">
                          <span className="text-xs text-gray-500 block">Tax Impact</span>
                          <span className="text-sm font-mono font-bold text-gray-900">{formatCurrency(comp.totalTax)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Schedules Tab */}
        {activeTab === 'schedules' && (
          <div>
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-900">Statutory Schedules</h2>
              <p className="text-xs text-gray-500 mt-0.5">Upcoming tax filing obligations</p>
            </div>
            {snapshot.schedules.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400">
                <p>No active schedules generated</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {snapshot.schedules.slice().reverse().map((schedule) => (
                  <div key={schedule.id} className="p-4 flex items-center justify-between hover:bg-gray-50/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">{schedule.taxType} Schedule</h3>
                        <span className="px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 text-xs uppercase tracking-wide font-medium">{schedule.status}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Period: {schedule.period} • Due: {schedule.dueDate}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(schedule.taxAmount)}</p>
                      <button className="text-xs text-[#64B5F6] hover:underline font-medium mt-1">Generate Remittance</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Flows Tab */}
        {activeTab === 'flows' && (
          <div>
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-900">Tax Heads Overview</h2>
              <p className="text-xs text-gray-500 mt-0.5">Breakdown by tax type</p>
            </div>
            <div className="p-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-indigo-900">Value Added Tax</h3>
                  <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                    </svg>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Output VAT collected</span>
                    <span className="font-mono text-gray-900">{formatCurrency(summary.totalVAT)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Input VAT credit</span>
                    <span className="font-mono text-gray-900">({formatCurrency(summary.inputVATCredit)})</span>
                  </div>
                  <div className="pt-2 border-t border-indigo-200/50 flex justify-between font-bold text-indigo-900">
                    <span>Net Payable</span>
                    <span>{formatCurrency(summary.netVATPayable)}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900">CIT / PIT Projection</h3>
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Turnover</span>
                    <span className="font-mono text-gray-900">{formatCurrency(derivedStats.turnover)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Est. Profit</span>
                    <span className="font-mono text-gray-900">{formatCurrency(derivedStats.profit)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                    <span>Estimated Liability</span>
                    <span>{formatCurrency(derivedStats.estimatedCIT)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Documents Tab - Repurposed drag & drop area */}
        {activeTab === 'documents' && (
          <div
            className={`flex flex - col items - center justify - center p - 12 transition - colors ${dragActive ? 'bg-blue-50' : 'bg-white'} `}
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
            onDrop={handleDrop}
          >
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Upload Financial Documents</h3>
            <p className="text-sm text-gray-500 max-w-sm text-center mt-2">
              Drop bank statements (PDF/CSV), audited accounts, or payroll spreadsheets here to auto-extract transactions.
            </p>

            <input
              type="file"
              multiple
              ref={fileInputRef}
              className="hidden"
              onChange={handleFilesSelected}
              accept=".csv,.pdf,.xlsx,.xls,.json"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="mt-6 px-6 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {isUploading ? "Processing..." : "Select Files"}
            </button>

            {statusMessage && (
              <div className="mt-6 p-4 rounded-lg bg-green-50 border border-green-100 text-green-700 text-sm max-w-md text-center">
                {statusMessage}
              </div>
            )}
            {error && (
              <div className="mt-6 p-4 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm max-w-md text-center">
                {error}
              </div>
            )}

            {documents.length > 0 && (
              <div className="mt-12 w-full max-w-2xl">
                <h4 className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-3">Recently Uploaded</h4>
                <div className="grid gap-2">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg bg-gray-50/50">
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(doc.size)} • {new Date(doc.uploadedAt).toLocaleTimeString()}</p>
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">Parsed</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
