"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatCurrency,
  formatCurrencyFull,
  formatDate,
  type ComplianceStatusEntry,
  type DashboardTaxType,
  type DeadlineItem,
  type FilingIndicator,
  type MonthlyTrendPoint,
  type RemittanceAuditRecord,
  type TaxSummary,
  type TaxTypeImpact,
  type TaxWorkspaceInsights,
  type TaxWorkspacePayment,
  type WorkspaceDocument,
} from "@/components/tax/workspace/shared";
import { buildTransactionsFromFiles } from "@/lib/accounting/statementEngine";
import { accountingEngine } from "@/lib/accounting/transactionBridge";
import type { JournalEntry } from "@/lib/accounting/doubleEntry";
import { generateTaxSchedule } from "@/lib/accounting/transactionTaxAnalyzer";
import { mapJournalEntriesToCompliance } from "@/lib/tax/compliance/adapters";
import {
  runTaxComputation,
  type TaxComputationResult,
  type TaxSchedule,
  type TaxIssue,
  type FilingPackResult,
  type AuditLogEntry,
  type ComplianceTransaction,
  type ComplianceStatusStage,
} from "@/lib/tax/compliance";
import { withTaxAdjustments } from "@/lib/tax/adjustments";
import { generateFilingPack } from "@/lib/tax/compliance/filingPack";
import { loadAuditLogs, loadFilingPacks, loadComplianceStatuses, loadPayments } from "@/lib/tax/compliance/store";
import {
  seedComplianceStatuses,
  setComplianceStatus,
  recordPayment,
} from "@/lib/tax/compliance/workflow";
import { generateTaxRemittancePdf, type TaxRemittancePdfPayload } from "@/lib/taxRemittancePdf";
import { getTaxpayerProfile } from "@/lib/tax/settings";

type ActiveTab = "timeline" | "schedules" | "flows" | "documents";

type TaxDashboardV2 = {
  entityId: string;
  period?: string;
  vatPayable: number;
  vatReceivable: number;
  netVatPosition: number;
  whtPayable: number;
  nextFilingDate: string | null;
};

type TaxLedgerRowV2 = {
  id: string;
  taxType: "VAT" | "WHT" | "CIT" | "CGT" | "STAMP";
  ledger: string;
  direction: string;
  baseAmount: number;
  taxAmount: number;
  period: string | null;
  transactionId: string | null;
  transactionDate: string | null;
  transactionDescription: string | null;
  accountCode?: string;
  runningBalance: number;
  createdAt: string;
};

type TimelineLedgerRow = {
  id: string;
  transactionId?: string | null;
  taxType: string;
  ledger: string;
  baseAmount: number;
  taxAmount: number;
  description: string;
  date: string;
};

type TimelineTransactionGroup = {
  id: string;
  transactionId?: string | null;
  description: string;
  date: string;
  baseAmount: number;
  netTaxAmount: number;
  lines: Array<{
    id: string;
    taxType: string;
    ledger: string;
    taxAmount: number;
  }>;
};

const WorkspaceTabLoading = () => (
  <div className="p-6 text-sm text-gray-500">Loading workspace panel...</div>
);

const TaxTimelineTab = dynamic(
  () => import("@/components/tax/workspace/TaxTimelineTab"),
  { loading: WorkspaceTabLoading }
);
const TaxSchedulesTab = dynamic(
  () => import("@/components/tax/workspace/TaxSchedulesTab"),
  { loading: WorkspaceTabLoading }
);
const TaxFlowsTab = dynamic(
  () => import("@/components/tax/workspace/TaxFlowsTab"),
  { loading: WorkspaceTabLoading }
);
const TaxDocumentsTab = dynamic(
  () => import("@/components/tax/workspace/TaxDocumentsTab"),
  { loading: WorkspaceTabLoading }
);

const getYearPrefix = (value: unknown): number | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized.length < 4) return null;
  const yearPart = normalized.slice(0, 4);
  const year = Number(yearPart);
  if (!Number.isInteger(year) || yearPart.length !== 4) return null;
  return year;
};

const dedupeJournalEntries = (entries: JournalEntry[]): JournalEntry[] => {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = entry.id || `${entry.date || ""}::${entry.narration || ""}::${entry.createdAt || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const PAYE_RATE_ESTIMATE = 0.15;
const EDUCATION_TAX_RATE = 0.03;
const FILED_STAGES = new Set<ComplianceStatusStage | string>(["filed", "paid", "reconciled"]);

const mapScheduleTaxTypeToRemittanceType = (
  taxType: string
): TaxRemittancePdfPayload["taxType"] => {
  switch (taxType) {
    case "VAT":
    case "WHT":
    case "CIT":
    case "PIT":
    case "CGT":
    case "TET":
    case "POLICE_LEVY":
    case "NASENI":
    case "DEV_LEVY":
    case "OTHER":
      return taxType;
    case "STAMP":
      return "STAMP_DUTY";
    case "PAYE":
      return "PIT";
    case "EDT":
      return "DEV_LEVY";
    default:
      return "OTHER";
  }
};

const taxBreakdownLabels: Array<{ key: DashboardTaxType; label: string; accent: string }> = [
  { key: "CIT", label: "Company Income Tax (CIT)", accent: "text-slate-700" },
  { key: "VAT", label: "Value Added Tax (VAT)", accent: "text-indigo-700" },
  { key: "PAYE", label: "PAYE", accent: "text-cyan-700" },
  { key: "WHT", label: "Withholding Tax (WHT)", accent: "text-emerald-700" },
  { key: "EDT", label: "Education Tax (Nigeria)", accent: "text-amber-700" },
];


export default function TaxWorkspacePage() {
  const [transactions, setTransactions] = useState<ComplianceTransaction[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [computation, setComputation] = useState<TaxComputationResult | null>(null);
  const [issues, setIssues] = useState<TaxIssue[]>([]);
  const [schedules, setSchedules] = useState<TaxSchedule[]>([]);
  const [filingPacks, setFilingPacks] = useState<FilingPackResult[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  // Keep first server/client render deterministic; hydrate persisted values after mount.
  const [complianceStatuses, setComplianceStatuses] = useState<ComplianceStatusEntry[]>([]);
  const [payments, setPayments] = useState<TaxWorkspacePayment[]>([]);
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshingRules, setIsRefreshingRules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [remittanceHistory, setRemittanceHistory] = useState<RemittanceAuditRecord[]>([]);
  const [isLoadingRemittanceHistory, setIsLoadingRemittanceHistory] = useState(false);
  const [taxDashboardV2, setTaxDashboardV2] = useState<TaxDashboardV2 | null>(null);
  const [taxLedgerRowsV2, setTaxLedgerRowsV2] = useState<TaxLedgerRowV2[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isMountedRef = useRef(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>("timeline");

  // Filtering Logic
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    transactions.forEach((tx) => {
      if (tx.date) {
        years.add(new Date(tx.date).getFullYear());
      }
    });
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  const refreshAudit = useCallback(() => {
    setAuditLogs(loadAuditLogs());
    setFilingPacks(loadFilingPacks());
    setComplianceStatuses(loadComplianceStatuses());
    setPayments(loadPayments());
  }, []);

  const runComputation = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsRefreshingRules(true);
    try {
      const entries = dedupeJournalEntries(accountingEngine.getState().journalEntries);
      if (!isMountedRef.current) return;
      setJournalEntries(entries.filter((entry) => entry.status === "posted"));
      const mappedTransactions = mapJournalEntriesToCompliance("entity-default", entries);
      if (!isMountedRef.current) return;
      setTransactions(mappedTransactions);
      const computationTransactions = withTaxAdjustments("entity-default", mappedTransactions);

      if (computationTransactions.length === 0) {
        if (!isMountedRef.current) return;
        setComputation(null);
        setIssues([]);
        setSchedules([]);
        setStatusMessage("No accounting transactions or tax adjustments found yet.");
        return;
      }

      const result = runTaxComputation({
        entityId: "entity-default",
        period: "current",
        transactions: computationTransactions,
      });
      if (!isMountedRef.current) return;
      setComputation(result);
      setIssues(result.issues);
      setSchedules(result.schedules);
      seedComplianceStatuses("entity-default", result.schedules);
      refreshAudit();
      setStatusMessage(`Computed ${result.schedules.length} schedules for ${result.period}.`);
    } catch (computeError) {
      console.error("Tax computation failed", computeError);
      if (!isMountedRef.current) return;
      setError("Could not compute tax schedules. Please retry.");
    } finally {
      if (!isMountedRef.current) return;
      setIsRefreshingRules(false);
    }
  }, [refreshAudit]);

  const refreshTaxDashboardV2 = useCallback(async () => {
    try {
      const response = await fetch("/api/tax/dashboard?entityId=entity-default", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        success?: boolean;
        dashboard?: TaxDashboardV2;
      };
      if (payload.success && payload.dashboard) {
        setTaxDashboardV2(payload.dashboard);
      }
    } catch (dashboardError) {
      console.error("Tax dashboard v2 load failed", dashboardError);
    }
  }, []);

  const refreshTaxLedgerV2 = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/tax/ledger?entityId=entity-default&taxType=ALL&page=1&pageSize=1000",
        { cache: "no-store" }
      );
      if (!response.ok) return;
      const payload = (await response.json()) as {
        success?: boolean;
        rows?: TaxLedgerRowV2[];
      };
      if (!payload.success || !Array.isArray(payload.rows)) return;
      const deduped = Array.from(
        new Map(payload.rows.map((row) => [row.id, row] as const)).values()
      );
      setTaxLedgerRowsV2(deduped);
    } catch (ledgerError) {
      console.error("Tax ledger v2 load failed", ledgerError);
    }
  }, []);

  const syncTaxLedgerFromAccounting = useCallback(async () => {
    const journals = dedupeJournalEntries(accountingEngine.getState().journalEntries).filter(
      (entry) => entry.status === "posted" || entry.status === "voided"
    );

    const response = await fetch("/api/tax/sync-journals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityId: "entity-default",
        source: "live_posting",
        fullSync: true,
        journals,
      }),
    });
    if (!response.ok) {
      throw new Error(`Tax sync failed (${response.status})`);
    }
  }, []);

  const refreshTaxV2 = useCallback(async () => {
    try {
      await syncTaxLedgerFromAccounting();
    } catch (syncError) {
      console.error("Tax sync from accounting failed", syncError);
    }
    await Promise.all([refreshTaxDashboardV2(), refreshTaxLedgerV2()]);
  }, [refreshTaxDashboardV2, refreshTaxLedgerV2, syncTaxLedgerFromAccounting]);

  const runBackfillToV2 = useCallback(async () => {
    setIsBackfilling(true);
    try {
      const entries = dedupeJournalEntries(accountingEngine.getState().journalEntries).filter(
        (entry) => entry.status === "posted" || entry.status === "voided"
      );
      if (entries.length === 0) {
        setStatusMessage("No posted/voided journals available for backfill.");
        return;
      }
      const reportResponse = await fetch("/api/tax/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: "entity-default",
          journals: entries,
          mode: "report",
        }),
      });
      if (!reportResponse.ok) {
        throw new Error(`Backfill preview failed (${reportResponse.status})`);
      }

      const reportPayload = (await reportResponse.json()) as {
        success?: boolean;
        backfill?: {
          report?: {
            wouldUpsertTransactions?: number;
            wouldPruneTransactions?: number;
            wouldPruneDuplicates?: number;
            wouldRemoveStaleRows?: number;
          };
        };
      };

      const applyResponse = await fetch("/api/tax/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: "entity-default",
          journals: entries,
          mode: "apply",
        }),
      });
      if (!applyResponse.ok) {
        throw new Error(`Backfill apply failed (${applyResponse.status})`);
      }

      const preview = reportPayload.backfill?.report;
      setStatusMessage(
        `Backfill completed for ${entries.length} journal states. Preview: upsert ${preview?.wouldUpsertTransactions || 0}, prune missing ${preview?.wouldPruneTransactions || 0}, duplicate cleanup ${preview?.wouldPruneDuplicates || 0}, stale cleanup ${preview?.wouldRemoveStaleRows || 0}.`
      );
      await refreshTaxDashboardV2();
      await refreshTaxLedgerV2();
    } catch (backfillError) {
      console.error("Tax backfill failed", backfillError);
      setError("Tax v2 backfill failed. Please retry.");
    } finally {
      setIsBackfilling(false);
    }
  }, [refreshTaxDashboardV2, refreshTaxLedgerV2]);

  useEffect(() => {
    accountingEngine.load();
    runComputation();
    void refreshTaxV2();
    const unsubscribe = accountingEngine.subscribe(() => {
      runComputation();
      void refreshTaxV2();
    });
    return () => unsubscribe();
  }, [runComputation, refreshTaxV2]);

  const loadRemittanceHistory = useCallback(async (signal?: AbortSignal) => {
    if (!isMountedRef.current) return;
    setIsLoadingRemittanceHistory(true);
    try {
      const response = await fetch("/api/tax/remittance?limit=30", { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok || !data?.success || !Array.isArray(data.records)) {
        throw new Error(data?.error || "Could not load remittance history");
      }
      if (signal?.aborted || !isMountedRef.current) return;
      setRemittanceHistory(data.records as RemittanceAuditRecord[]);
    } catch (fetchError) {
      if (signal?.aborted) return;
      console.error("Unable to load remittance history", fetchError);
    } finally {
      if (signal?.aborted || !isMountedRef.current) return;
      setIsLoadingRemittanceHistory(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadRemittanceHistory(controller.signal);
    return () => controller.abort();
  }, [loadRemittanceHistory]);

  const ingestFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const filesArray = Array.from(fileList);
      if (filesArray.length === 0) return;
      if (!isMountedRef.current) return;
      setIsUploading(true);
      setError(null);
      try {
        const extracted = buildTransactionsFromFiles(filesArray as File[]);
        if (!isMountedRef.current) return;
        const docEntries: WorkspaceDocument[] = filesArray.map((file) => ({
          id: `${file.name} -${Date.now()} `,
          name: file.name,
          size: file.size,
          extracted: extracted.filter((tx) => tx.sourceDocument === file.name).length,
          uploadedAt: new Date().toISOString(),
        }));
        setDocuments((prev) => [...docEntries, ...prev].slice(0, 6));

        setStatusMessage(
          `Uploaded ${filesArray.length} file(s). ${extracted.length} rows detected for review.`
        );
      } catch (err) {
        console.error("Upload ingest failed", err);
        if (!isMountedRef.current) return;
        setError("Unable to process those statements. Please drop a CSV or JSON bank export.");
      } finally {
        if (!isMountedRef.current) return;
        setIsUploading(false);
      }
    },
    []
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

  const handleGenerateRemittance = useCallback(async (schedule: TaxSchedule) => {
    const taxpayerProfile = getTaxpayerProfile("entity-default");
    const paymentReference = await generateTaxRemittancePdf({
      taxpayerName: taxpayerProfile.taxpayerName,
      businessName: taxpayerProfile.businessName,
      taxType: mapScheduleTaxTypeToRemittanceType(schedule.taxType),
      period: schedule.period,
      dueDate: schedule.dueDate,
      taxAmount: schedule.totalTax,
      scheduleId: schedule.id,
    });

    try {
      const response = await fetch("/api/tax/remittance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentReference,
          taxpayerName: taxpayerProfile.taxpayerName,
          businessName: taxpayerProfile.businessName,
          taxType: schedule.taxType,
          period: schedule.period,
          dueDate: schedule.dueDate,
          taxAmount: schedule.totalTax,
          scheduleId: schedule.id,
          source: "tax-workspace",
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success || !data.record) {
        throw new Error(data?.error || "Failed to save remittance audit record");
      }

      if (!isMountedRef.current) return;
      setRemittanceHistory((prev) => [data.record as RemittanceAuditRecord, ...prev].slice(0, 30));
      setStatusMessage(
        `${schedule.taxType} remittance generated and logged. FIRS reference: ${paymentReference}`
      );
    } catch (persistError) {
      console.error("Failed to persist remittance record", persistError);
      if (!isMountedRef.current) return;
      setStatusMessage(
        `${schedule.taxType} remittance generated (PDF downloaded), but audit log save failed. Reference: ${paymentReference}`
      );
    }
  }, []);

  const handleGenerateFilingPack = useCallback(async (schedule: TaxSchedule, format: "pdf" | "csv") => {
    const pack = await generateFilingPack({
      entityId: "entity-default",
      schedule,
      format,
    });
    if (!isMountedRef.current) return;
    setFilingPacks((prev) => [pack, ...prev]);
    refreshAudit();
    if (pack.blob) {
      const url = URL.createObjectURL(pack.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = pack.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
  }, [refreshAudit]);

  const handleScheduleStatusChange = useCallback(
    (schedule: TaxSchedule, stage: ComplianceStatusStage) => {
      setComplianceStatus({
        entityId: "entity-default",
        period: schedule.period,
        taxType: schedule.taxType,
        stage,
        actor: "user",
      });
      setComplianceStatuses(loadComplianceStatuses());
    },
    []
  );

  const handleMarkSchedulePaid = useCallback((schedule: TaxSchedule) => {
    recordPayment({
      entityId: "entity-default",
      period: schedule.period,
      taxType: schedule.taxType,
      amount: schedule.totalTax,
      actor: "user",
    });
    setComplianceStatus({
      entityId: "entity-default",
      period: schedule.period,
      taxType: schedule.taxType,
      stage: "paid",
      actor: "user",
    });
    setComplianceStatuses(loadComplianceStatuses());
    setPayments(loadPayments());
  }, []);

  const handleRefreshRemittanceHistory = useCallback(() => {
    void loadRemittanceHistory();
  }, [loadRemittanceHistory]);

  const handleOpenDocumentsTab = useCallback(() => {
    setActiveTab("documents");
  }, []);

  const handleDocumentDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(true);
  }, []);

  const handleDocumentDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleDocumentDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
  }, []);

  const handleBrowseDocuments = useCallback(() => {
    fileInputRef.current?.click();
  }, []);


  const taxSummary = useMemo<TaxSummary>(() => {
    const vatSchedule = schedules.find((schedule) => schedule.taxType === "VAT");
    const whtSchedule = schedules.find((schedule) => schedule.taxType === "WHT");
    const cgtSchedule = schedules.find((schedule) => schedule.taxType === "CGT");
    const stampSchedule = schedules.find((schedule) => schedule.taxType === "STAMP");
    const citSchedule = schedules.find((schedule) => schedule.taxType === "CIT");
    const vatMeta = (vatSchedule?.metadata || {}) as { outputVat?: number; inputVat?: number };
    const citMeta = (citSchedule?.metadata || {}) as { turnover?: number; accountingProfit?: number; taxableProfit?: number };

    return {
      netVAT: vatSchedule?.totalTax || 0,
      outputVAT: vatMeta.outputVat || 0,
      inputVAT: vatMeta.inputVat || 0,
      totalWHT: whtSchedule?.totalTax || 0,
      totalCGT: cgtSchedule?.totalTax || 0,
      totalStampDuty: stampSchedule?.totalTax || 0,
      estimatedCIT: citSchedule?.totalTax || 0,
      turnover: citMeta.turnover || 0,
      profit: citMeta.accountingProfit || 0,
      taxableProfit: citMeta.taxableProfit || 0,
    };
  }, [schedules]);

  const transactionMap = useMemo(() => {
    return new Map(transactions.map((tx) => [tx.id, tx]));
  }, [transactions]);

  const filteredLedgerEntries = useMemo(() => {
    const fromBoundary = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const toBoundary = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;

    const inScope = (dateValue?: string | null) => {
      if (!dateValue) return false;
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return false;
      if (date.getFullYear() !== selectedYear) return false;
      if (fromBoundary && date < fromBoundary) return false;
      if (toBoundary && date > toBoundary) return false;
      return true;
    };

    return taxLedgerRowsV2
      .filter((row) => inScope(row.transactionDate || row.createdAt))
      .sort((a, b) => {
        return (
          new Date(b.transactionDate || b.createdAt).getTime() -
          new Date(a.transactionDate || a.createdAt).getTime()
        );
      })
      .map((row) => {
        return {
          id: row.id,
          transactionId: row.transactionId,
          taxType: row.taxType,
          ledger: row.ledger,
          baseAmount: row.baseAmount,
          taxAmount: row.taxAmount,
          description: row.transactionDescription || "Ledger adjustment",
          date: row.transactionDate || row.createdAt,
        };
      }) satisfies TimelineLedgerRow[];
  }, [taxLedgerRowsV2, selectedYear, dateFrom, dateTo]);

  const timelineGroups = useMemo<TimelineTransactionGroup[]>(() => {
    const groups = new Map<string, TimelineTransactionGroup>();

    filteredLedgerEntries.forEach((entry) => {
      const key = entry.transactionId || `${entry.description}::${entry.date}`;
      const existing = groups.get(key);
      if (existing) {
        existing.netTaxAmount += entry.taxAmount;
        existing.baseAmount = Math.max(existing.baseAmount, entry.baseAmount);
        existing.lines.push({
          id: entry.id,
          taxType: entry.taxType,
          ledger: entry.ledger,
          taxAmount: entry.taxAmount,
        });
        return;
      }

      groups.set(key, {
        id: key,
        transactionId: entry.transactionId,
        description: entry.description,
        date: entry.date,
        baseAmount: entry.baseAmount,
        netTaxAmount: entry.taxAmount,
        lines: [
          {
            id: entry.id,
            taxType: entry.taxType,
            ledger: entry.ledger,
            taxAmount: entry.taxAmount,
          },
        ],
      });
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        netTaxAmount: Math.round(group.netTaxAmount * 100) / 100,
        lines: group.lines.sort((a, b) => Math.abs(b.taxAmount) - Math.abs(a.taxAmount)),
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredLedgerEntries]);

  const workspaceInsights = useMemo<TaxWorkspaceInsights>(() => {
    const fromBoundary = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const toBoundary = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
    const now = new Date();

    const inScope = (dateLike?: string) => {
      if (!dateLike) return false;
      const date = new Date(dateLike);
      if (Number.isNaN(date.getTime())) return false;
      if (date.getFullYear() !== selectedYear) return false;
      if (fromBoundary && date < fromBoundary) return false;
      if (toBoundary && date > toBoundary) return false;
      return true;
    };

    const periodMatchesScope = (period: string) => {
      const year = getYearPrefix(period);
      if (year === null) return false;
      return year === selectedYear;
    };

    const stageBySchedule = new Map<string, ComplianceStatusStage>(
      complianceStatuses.map(
        (status) => [`${status.period}::${status.taxType}`, status.stage] as [string, ComplianceStatusStage]
      )
    );

    const trend: MonthlyTrendPoint[] = Array.from({ length: 12 }, (_, monthIndex) => {
      const monthDate = new Date(selectedYear, monthIndex, 1);
      return {
        monthKey: `${selectedYear}-${String(monthIndex + 1).padStart(2, "0")}`,
        monthLabel: monthDate.toLocaleDateString("en-NG", { month: "short" }),
        vat: 0,
        wht: 0,
        cit: 0,
        paye: 0,
        edt: 0,
        total: 0,
      };
    });

    const breakdown: Record<DashboardTaxType, number> = {
      CIT: 0,
      VAT: 0,
      PAYE: 0,
      WHT: 0,
      EDT: 0,
    };
    const taxImpactByType: Record<DashboardTaxType, TaxTypeImpact> = {
      CIT: { payable: 0, credit: 0, net: 0 },
      VAT: { payable: 0, credit: 0, net: 0 },
      PAYE: { payable: 0, credit: 0, net: 0 },
      WHT: { payable: 0, credit: 0, net: 0 },
      EDT: { payable: 0, credit: 0, net: 0 },
    };
    const hasLedgerImpactByType = {
      CIT: false,
      VAT: false,
      WHT: false,
    };

    const deadlineItems: DeadlineItem[] = [];

    (computation?.ledgerEntries || []).forEach((entry) => {
      const txDate =
        (entry.transactionId ? transactionMap.get(entry.transactionId)?.date : undefined) || entry.createdAt;
      if (!inScope(txDate)) return;
      const date = new Date(txDate);
      const monthIndex = date.getMonth();
      if (monthIndex < 0 || monthIndex > 11) return;

      if (entry.taxType === "VAT") trend[monthIndex].vat += entry.taxAmount;
      if (entry.taxType === "WHT") trend[monthIndex].wht += entry.taxAmount;
      if (entry.taxType === "CIT") trend[monthIndex].cit += entry.taxAmount;

      if (entry.taxType === "VAT" || entry.taxType === "WHT" || entry.taxType === "CIT") {
        const target = taxImpactByType[entry.taxType];
        if (Math.abs(entry.taxAmount) > 0.005) {
          hasLedgerImpactByType[entry.taxType] = true;
        }
        target.net += entry.taxAmount;
        if (entry.taxAmount >= 0) target.payable += entry.taxAmount;
        else target.credit += Math.abs(entry.taxAmount);
      }
    });

    schedules.forEach((schedule) => {
      if (!inScope(schedule.dueDate) && !periodMatchesScope(schedule.period)) return;
      const amount = Math.max(0, schedule.totalTax || 0);
      const key = `${schedule.period}::${schedule.taxType}`;
      const stage = stageBySchedule.get(key) || schedule.status;
      const filed = FILED_STAGES.has(stage);
      const overdue = !filed && new Date(schedule.dueDate) < now && amount > 0;

      deadlineItems.push({
        id: schedule.id,
        taxType: schedule.taxType,
        period: schedule.period,
        dueDate: schedule.dueDate,
        amount,
        filingState: filed ? "Filed" : overdue ? "Overdue" : "Pending",
        stage,
        source: "schedule",
      });
    });

    // Keep breakdown aligned with net liabilities (payable less credits).
    breakdown.CIT = Math.max(0, taxImpactByType.CIT.net);
    breakdown.VAT = Math.max(0, taxImpactByType.VAT.net);
    breakdown.WHT = Math.max(0, taxImpactByType.WHT.net);

    let payeFromLedger = 0;
    let payrollExpense = 0;
    let educationTaxFromLedger = 0;
    const payrollByMonth = new Array(12).fill(0) as number[];
    const payeLiabilityByMonth = new Array(12).fill(0) as number[];
    const educationTaxByMonth = new Array(12).fill(0) as number[];

    journalEntries.forEach((entry) => {
      if (entry.status !== "posted") return;
      if (!inScope(entry.date || entry.createdAt)) return;
      const monthIndex = new Date(entry.date || entry.createdAt).getMonth();
      if (monthIndex < 0 || monthIndex > 11) return;

      entry.lines.forEach((line) => {
        if (line.accountCode === "2210") {
          const netPaye = Math.max(0, (line.credit || 0) - (line.debit || 0));
          payeFromLedger += netPaye;
          payeLiabilityByMonth[monthIndex] += netPaye;
        }
        if (line.accountCode === "5500") {
          const payrollValue = Math.max(0, (line.debit || 0) - (line.credit || 0));
          payrollExpense += payrollValue;
          payrollByMonth[monthIndex] += payrollValue;
        }
        if (line.accountCode === "7010") {
          const eduTaxValue = Math.max(0, (line.debit || 0) - (line.credit || 0));
          educationTaxFromLedger += eduTaxValue;
          educationTaxByMonth[monthIndex] += eduTaxValue;
        }
      });
    });

    const estimatedPaye = Math.max(0, payrollExpense * PAYE_RATE_ESTIMATE);
    const payePayable = payeFromLedger > 0 ? payeFromLedger : estimatedPaye;
    breakdown.PAYE = payePayable;
    taxImpactByType.PAYE = { payable: payePayable, credit: 0, net: payePayable };

    const estimatedEducationTax = Math.max(0, taxSummary.taxableProfit * EDUCATION_TAX_RATE);
    const educationTaxPayable = educationTaxFromLedger > 0 ? educationTaxFromLedger : estimatedEducationTax;
    breakdown.EDT = educationTaxPayable;
    taxImpactByType.EDT = { payable: educationTaxPayable, credit: 0, net: educationTaxPayable };

    trend.forEach((point, monthIndex) => {
      point.vat = Math.max(0, point.vat);
      point.wht = Math.max(0, point.wht);
      point.cit = Math.max(0, point.cit);

      if (payeFromLedger > 0) {
        point.paye = Math.max(0, payeLiabilityByMonth[monthIndex]);
      } else {
        point.paye = Math.max(0, payrollByMonth[monthIndex] * PAYE_RATE_ESTIMATE);
      }

      if (educationTaxFromLedger > 0) {
        point.edt = Math.max(0, educationTaxByMonth[monthIndex]);
      }

      point.total = point.vat + point.wht + point.cit + point.paye + point.edt;
    });

    if (educationTaxFromLedger === 0 && educationTaxPayable > 0) {
      const citSchedule = schedules.find((schedule) => schedule.taxType === "CIT");
      const educationMonth = citSchedule ? new Date(citSchedule.dueDate).getMonth() : 5;
      if (trend[educationMonth]) {
        trend[educationMonth].edt += educationTaxPayable;
        trend[educationMonth].total += educationTaxPayable;
      }
    }

    const paidByType: Record<DashboardTaxType, number> = {
      CIT: 0,
      VAT: 0,
      PAYE: 0,
      WHT: 0,
      EDT: 0,
    };

    payments.forEach((payment) => {
      if (payment.status !== "paid") return;
      if (!inScope(payment.paidAt)) return;
      const rawType = String(payment.taxType || "").toUpperCase();
      const taxType = rawType === "TET" ? "EDT" : rawType;
      if (taxType === "CIT" || taxType === "VAT" || taxType === "PAYE" || taxType === "WHT" || taxType === "EDT") {
        paidByType[taxType] += Math.max(0, payment.amount || 0);
      }
    });

    // Align with Financial Reporting summary, but do not erase in-scope tax timeline impact.
    const reportingTaxSummary = generateTaxSchedule(
      journalEntries.filter((entry) => entry.status === "posted" && inScope(entry.date || entry.createdAt)),
      { isVatRegistered: true }
    ).summary;
    const vatNetPayable = Number.isFinite(reportingTaxSummary.vatPayable) ? reportingTaxSummary.vatPayable : 0;
    const citPayable = Math.max(0, reportingTaxSummary.citPayable || 0);
    const whtPayable = Math.max(0, reportingTaxSummary.whtPayable || 0);
    const payePayableFromReporting = Math.max(0, reportingTaxSummary.payePayable || 0);
    const educationTaxPayableFromReporting = Math.max(0, reportingTaxSummary.developmentLevy || 0);
    const hasImpact = (impact: TaxTypeImpact) =>
      Math.abs(impact.net) > 0.005 || impact.payable > 0.005 || impact.credit > 0.005;
    const reportingImpactByType: Record<DashboardTaxType, TaxTypeImpact> = {
      CIT: { payable: citPayable, credit: 0, net: citPayable },
      VAT: {
        payable: Math.max(0, vatNetPayable),
        credit: vatNetPayable < 0 ? Math.abs(vatNetPayable) : 0,
        net: vatNetPayable,
      },
      WHT: { payable: whtPayable, credit: 0, net: whtPayable },
      PAYE: { payable: payePayableFromReporting, credit: 0, net: payePayableFromReporting },
      EDT: { payable: educationTaxPayableFromReporting, credit: 0, net: educationTaxPayableFromReporting },
    };

    if (!hasLedgerImpactByType.CIT && hasImpact(reportingImpactByType.CIT)) {
      taxImpactByType.CIT = reportingImpactByType.CIT;
    }
    if (!hasLedgerImpactByType.VAT && hasImpact(reportingImpactByType.VAT)) {
      taxImpactByType.VAT = reportingImpactByType.VAT;
    }
    if (!hasLedgerImpactByType.WHT && hasImpact(reportingImpactByType.WHT)) {
      taxImpactByType.WHT = reportingImpactByType.WHT;
    }
    if (hasImpact(reportingImpactByType.PAYE)) {
      taxImpactByType.PAYE = reportingImpactByType.PAYE;
    }
    if (hasImpact(reportingImpactByType.EDT)) {
      taxImpactByType.EDT = reportingImpactByType.EDT;
    }
    breakdown.CIT = Math.max(0, taxImpactByType.CIT.net);
    breakdown.VAT = Math.max(0, taxImpactByType.VAT.net);
    breakdown.WHT = Math.max(0, taxImpactByType.WHT.net);
    breakdown.PAYE = Math.max(0, taxImpactByType.PAYE.net);
    breakdown.EDT = Math.max(0, taxImpactByType.EDT.net);

    trend.forEach((point, monthIndex) => {
      if (point.paye > 0) {
        const due = new Date(selectedYear, monthIndex + 1, 10);
        const dueDate = due.toISOString().slice(0, 10);
        const paidForPaye = payeFromLedger > 0 ? paidByType.PAYE : 0;
        const filed = paidForPaye >= breakdown.PAYE && breakdown.PAYE > 0;
        const overdue = !filed && due < now;
        deadlineItems.push({
          id: `derived-paye-${point.monthKey}`,
          taxType: "PAYE",
          period: point.monthKey,
          dueDate,
          amount: point.paye,
          filingState: filed ? "Filed" : overdue ? "Overdue" : "Pending",
          stage: filed ? "paid" : "pending",
          source: "derived",
        });
      }
    });

    const educationTaxDueForDeadline = Math.max(educationTaxPayable, breakdown.EDT);
    if (educationTaxDueForDeadline > 0) {
      const citSchedule = schedules.find((schedule) => schedule.taxType === "CIT");
      const dueDate = citSchedule?.dueDate || `${selectedYear + 1}-06-30`;
      const filed = paidByType.EDT >= educationTaxDueForDeadline;
      const overdue = !filed && new Date(dueDate) < now;
      deadlineItems.push({
        id: `derived-edt-${selectedYear}`,
        taxType: "EDT",
        period: `${selectedYear}-FY`,
        dueDate,
        amount: educationTaxDueForDeadline,
        filingState: filed ? "Filed" : overdue ? "Overdue" : "Pending",
        stage: filed ? "paid" : "pending",
        source: "derived",
      });
    }

    const totalTaxPayable = Object.values(breakdown).reduce((sum, amount) => sum + Math.max(0, amount), 0);
    const totalActualPaid = Object.values(paidByType).reduce((sum, amount) => sum + Math.max(0, amount), 0);
    const variance = totalTaxPayable - totalActualPaid;

    const filedCount = deadlineItems.filter((item) => item.filingState === "Filed").length;
    const pendingCount = deadlineItems.filter((item) => item.filingState === "Pending").length;
    const overdueCount = deadlineItems.filter((item) => item.filingState === "Overdue").length;
    const overdueAmount = deadlineItems
      .filter((item) => item.filingState === "Overdue")
      .reduce((sum, item) => sum + item.amount, 0);

    const scoredItems = filedCount + pendingCount + overdueCount;
    const statusScore =
      scoredItems === 0
        ? 100
        : ((filedCount * 1 + pendingCount * 0.6 + overdueCount * 0.1) / scoredItems) * 100;
    const issuePenalty =
      issues.filter((item) => item.severity === "high").length * 8 +
      issues.filter((item) => item.severity === "medium").length * 4 +
      issues.filter((item) => item.severity === "low").length * 1;
    const complianceScore = Math.max(0, Math.min(100, Math.round(statusScore - issuePenalty)));

    const upcomingDeadlines = deadlineItems
      .filter((item) => item.filingState === "Pending")
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const overdueDeadlines = deadlineItems
      .filter((item) => item.filingState === "Overdue")
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const maxMonthlyTrend = Math.max(1, ...trend.map((point) => point.total));
    const trendTotals = trend.reduce(
      (acc, point) => {
        acc.vat += point.vat;
        acc.wht += point.wht;
        acc.cit += point.cit;
        acc.paye += point.paye;
        acc.edt += point.edt;
        acc.total += point.total;
        return acc;
      },
      { vat: 0, wht: 0, cit: 0, paye: 0, edt: 0, total: 0 }
    );

    return {
      breakdown,
      paidByType,
      totalTaxPayable,
      totalActualPaid,
      variance,
      completionRate: totalTaxPayable > 0 ? Math.min(100, Math.round((totalActualPaid / totalTaxPayable) * 100)) : 100,
      deadlineItems,
      upcomingDeadlines,
      overdueDeadlines,
      overdueAmount,
      statusIndicators: {
        Filed: filedCount,
        Pending: pendingCount,
        Overdue: overdueCount,
      } as Record<FilingIndicator, number>,
      taxImpactByType,
      complianceScore,
      monthlyTrend: trend,
      maxMonthlyTrend,
      trendTotals,
    };
  }, [
    dateFrom,
    dateTo,
    selectedYear,
    complianceStatuses,
    computation?.ledgerEntries,
    schedules,
    journalEntries,
    taxSummary.taxableProfit,
    payments,
    issues,
    transactionMap,
  ]);


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

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Tax Workspace</h1>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-xs font-medium text-slate-600 border border-slate-200">
              {computation?.ruleSetId ?? "2026.1"}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Manage tax liabilities, view schedules, and track compliance status.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void runBackfillToV2()}
            disabled={isBackfilling}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {isBackfilling ? "Backfilling..." : "Backfill VAT/WHT v2"}
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-xs">
            <span className={`w-2 h-2 rounded-full ${isRefreshingRules ? "bg-amber-500 animate-pulse" : "bg-blue-500"}`}></span>
            <span className="text-gray-600">Engine Online</span>
          </div>
        </div>
      </div>

      {/* Stats Summary Deck */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl border bg-white border-gray-200/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#4a3880]">VAT Payable</p>
          <p className="mt-2 text-xl font-bold text-gray-900" title={formatCurrencyFull(taxDashboardV2?.vatPayable ?? 0)}>
            {formatCurrency(taxDashboardV2?.vatPayable ?? 0)}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">Output VAT liability</p>
        </div>
        <div className="p-4 rounded-xl border bg-white border-gray-200/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">VAT Receivable</p>
          <p className="mt-2 text-xl font-bold text-gray-900" title={formatCurrencyFull(taxDashboardV2?.vatReceivable ?? 0)}>
            {formatCurrency(taxDashboardV2?.vatReceivable ?? 0)}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">Input VAT credit</p>
        </div>
        <div className="p-4 rounded-xl border bg-white border-gray-200/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Net VAT Position</p>
          <p className="mt-2 text-xl font-bold text-gray-900" title={formatCurrencyFull(taxDashboardV2?.netVatPosition ?? 0)}>
            {formatCurrency(taxDashboardV2?.netVatPosition ?? 0)}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            {((taxDashboardV2?.netVatPosition ?? 0) < 0) ? "Credit / refund" : "Payable"}
          </p>
        </div>
        <div className="p-4 rounded-xl border bg-white border-gray-200/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">WHT Payable</p>
          <p className="mt-2 text-xl font-bold text-gray-900" title={formatCurrencyFull(taxDashboardV2?.whtPayable ?? 0)}>
            {formatCurrency(taxDashboardV2?.whtPayable ?? 0)}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">Withholding owed to authority</p>
        </div>
        <div className="p-4 rounded-xl border bg-white border-gray-200/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Next Filing Date</p>
          <p className="mt-2 text-xl font-bold text-gray-900">
            {taxDashboardV2?.nextFilingDate ? formatDate(taxDashboardV2.nextFilingDate) : "n/a"}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            {taxDashboardV2 ? "From ledger schedules" : "Fetching..."}
          </p>
        </div>
      </div>

      {/* Breakdown + Filing Indicators */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Tax Breakdown by Type</h3>
            <span className="text-xs text-gray-500 sm:text-right">Estimated vs recorded payments</span>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {taxBreakdownLabels.map((item) => {
              const impact = workspaceInsights.taxImpactByType[item.key];
              const actual = workspaceInsights.paidByType[item.key];
              const netImpact = impact.net;
              return (
                <div key={item.key} className="h-full min-h-[150px] rounded-lg border border-gray-100 bg-gray-50/40 px-3 py-3 flex flex-col">
                  <p className={`text-[11px] font-semibold uppercase tracking-wide leading-tight break-words min-h-[56px] ${item.accent}`}>
                    {item.label}
                  </p>
                  <div className="mt-2 border-y border-gray-200 py-2">
                    <p
                      className={`text-sm font-bold ${netImpact < 0 ? "text-rose-700" : "text-gray-900"}`}
                      title={formatCurrencyFull(netImpact)}
                    >
                      {formatCurrency(netImpact)}
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-2 text-[11px] text-gray-500">
                    <span className="whitespace-nowrap">Payable:</span>
                    <span className="text-right font-medium text-gray-700" title={formatCurrencyFull(impact.payable)}>
                      {formatCurrency(impact.payable)}
                    </span>
                  </div>
                  {impact.credit > 0 && (
                    <div className="mt-1 grid grid-cols-[auto_1fr] items-center gap-2 text-[11px] text-gray-500">
                      <span className="whitespace-nowrap">Credit:</span>
                      <span className="text-right font-medium text-amber-700" title={formatCurrencyFull(impact.credit)}>
                        {formatCurrency(impact.credit)}
                      </span>
                    </div>
                  )}
                  <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-2 text-[11px] text-gray-500">
                    <span className="whitespace-nowrap">Actual paid:</span>
                    <span className="text-right font-medium text-gray-700" title={formatCurrencyFull(actual)}>
                      {formatCurrency(actual)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Filing Status Indicators</h3>
          <div className="mt-4 space-y-2">
            {([
              { label: "Filed", color: "text-emerald-700 bg-emerald-50 border-emerald-100" },
              { label: "Pending", color: "text-amber-700 bg-amber-50 border-amber-100" },
              { label: "Overdue", color: "text-rose-700 bg-rose-50 border-rose-100" },
            ] as Array<{ label: FilingIndicator; color: string }>).map((item) => (
              <div key={item.label} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${item.color}`}>
                <span className="text-xs font-semibold uppercase tracking-wide">{item.label}</span>
                <span className="text-base font-bold">{workspaceInsights.statusIndicators[item.label]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Estimated vs Actual + Deadline Lists */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Estimated vs Actual Tax</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Estimated liabilities</span>
              <span className="font-semibold text-gray-900" title={formatCurrencyFull(workspaceInsights.totalTaxPayable)}>
                {formatCurrency(workspaceInsights.totalTaxPayable)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Actual paid</span>
              <span className="font-semibold text-gray-900" title={formatCurrencyFull(workspaceInsights.totalActualPaid)}>
                {formatCurrency(workspaceInsights.totalActualPaid)}
              </span>
            </div>
            <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between">
              <span className="text-gray-500">Variance</span>
              <span
                className={`font-semibold ${workspaceInsights.variance > 0 ? "text-rose-700" : "text-emerald-700"}`}
                title={formatCurrencyFull(Math.abs(workspaceInsights.variance))}
              >
                {formatCurrency(Math.abs(workspaceInsights.variance))}
              </span>
            </div>
          </div>
          <div className="mt-4">
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-[#9080ee] rounded-full"
                style={{ width: `${workspaceInsights.completionRate}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-2">{workspaceInsights.completionRate}% coverage against estimated liabilities</p>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Deadlines Tracker</h3>
            <span className="text-xs text-gray-500">
              {workspaceInsights.upcomingDeadlines.length} upcoming • {workspaceInsights.overdueDeadlines.length} overdue
            </span>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Upcoming Deadlines</p>
              {workspaceInsights.upcomingDeadlines.length === 0 ? (
                <p className="text-xs text-gray-500 mt-2">No pending deadlines in this period.</p>
              ) : (
                <div className="mt-2 border-y border-gray-200 divide-y divide-gray-200">
                  {workspaceInsights.upcomingDeadlines.slice(0, 4).map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-xs py-2">
                      <div>
                        <p className="font-semibold text-gray-800">{item.taxType} • {item.period}</p>
                        <p className="text-gray-500">Due {formatDate(item.dueDate)}</p>
                      </div>
                      <span className="font-semibold text-gray-900" title={formatCurrencyFull(item.amount)}>{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-rose-100 bg-rose-50/40 p-3">
              <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Overdue Taxes</p>
              {workspaceInsights.overdueDeadlines.length === 0 ? (
                <p className="text-xs text-rose-700 mt-2">No overdue tax obligations detected.</p>
              ) : (
                <div className="mt-2 border-y border-gray-200 divide-y divide-gray-200">
                  {workspaceInsights.overdueDeadlines.slice(0, 4).map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-xs py-2">
                      <div>
                        <p className="font-semibold text-rose-800">{item.taxType} • {item.period}</p>
                        <p className="text-rose-600">Due {formatDate(item.dueDate)}</p>
                      </div>
                      <span className="font-semibold text-rose-900" title={formatCurrencyFull(item.amount)}>{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
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
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#9080ee] focus:border-transparent"
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
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#9080ee] focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">To:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#9080ee] focus:border-transparent"
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
            <span className="text-xs text-gray-500">{transactions.length} total entries</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-1 -mb-px overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap rounded-t-md ${activeTab === tab.id
                  ? "border-[#9080ee] text-[#4a3880] bg-[#E8F4FF]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
            >
              <span className="text-gray-400 shrink-0">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[400px]">
        {activeTab === "timeline" ? (
          <TaxTimelineTab
            timelineGroups={timelineGroups}
            ledgerEntryCount={filteredLedgerEntries.length}
            selectedYear={selectedYear}
            onOpenDocuments={handleOpenDocumentsTab}
          />
        ) : null}

        {activeTab === "schedules" ? (
          <TaxSchedulesTab
            schedules={schedules}
            complianceStatuses={complianceStatuses}
            isLoadingRemittanceHistory={isLoadingRemittanceHistory}
            remittanceHistory={remittanceHistory}
            onGenerateRemittance={handleGenerateRemittance}
            onGenerateFilingPack={handleGenerateFilingPack}
            onStatusChange={handleScheduleStatusChange}
            onMarkPaid={handleMarkSchedulePaid}
            onRefreshRemittanceHistory={handleRefreshRemittanceHistory}
          />
        ) : null}

        {activeTab === "flows" ? (
          <TaxFlowsTab
            taxSummary={taxSummary}
            issues={issues}
            workspaceInsights={workspaceInsights}
          />
        ) : null}

        {activeTab === "documents" ? (
          <TaxDocumentsTab
            dragActive={dragActive}
            isUploading={isUploading}
            statusMessage={statusMessage}
            error={error}
            documents={documents}
            filingPacks={filingPacks}
            auditLogs={auditLogs}
            payments={payments}
            fileInputRef={fileInputRef}
            onFilesSelected={handleFilesSelected}
            onDrop={handleDrop}
            onDragEnter={handleDocumentDragEnter}
            onDragOver={handleDocumentDragOver}
            onDragLeave={handleDocumentDragLeave}
            onBrowse={handleBrowseDocuments}
          />
        ) : null}
      </div>
    </div>
  );
}
