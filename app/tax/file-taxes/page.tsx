"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { configureJsPdfTypography } from "@/lib/pdf/jspdfTypography";
import { accountingEngine } from "@/lib/accounting/transactionBridge";
import type { JournalEntry } from "@/lib/accounting/doubleEntry";
import { mapJournalEntriesToCompliance } from "@/lib/tax/compliance/adapters";
import { runTaxComputation, type ComplianceStatusStage, type FilingPackResult, type TaxSchedule } from "@/lib/tax/compliance";
import { generateFilingPack } from "@/lib/tax/compliance/filingPack";
import { loadComplianceStatuses, loadFilingPacks, loadSchedules } from "@/lib/tax/compliance/store";
import { withTaxAdjustments } from "@/lib/tax/adjustments";

type ReturnTaxType = "VAT" | "CIT" | "PAYE" | "WHT";
type ReturnStatus = "Draft" | "Ready" | "Filed";

type FilingReturnRow = {
  id: string;
  taxType: ReturnTaxType;
  period: string;
  status: ReturnStatus;
  taxAmount: number;
  filingDate: string | null;
  source: "schedule" | "derived";
  scheduleId?: string;
};

type ManualFilingRecord = {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  taxType: ReturnTaxType | "OTHER";
  period: string;
};

type SubmissionHistoryItem = {
  id: string;
  action: "generated_document" | "downloaded_pdf" | "manual_upload";
  fileName: string;
  taxType?: string;
  period?: string;
  createdAt: string;
};

const MANUAL_FILINGS_KEY = "ql::tax::manual-filings";
const SUBMISSION_HISTORY_KEY = "ql::tax::submission-history";
const PAYE_ESTIMATE_RATE = 0.15;
const TAX_ORDER: ReturnTaxType[] = ["VAT", "CIT", "PAYE", "WHT"];

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatCurrency = (amount: number) => currencyFormatter.format(Math.round(amount || 0));

const formatDate = (value?: string | null) => {
  if (!value) return "Not filed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not filed";
  return date.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const parsePeriodRank = (period: string): number => {
  const quarterMatch = period.match(/^(\d{4})-Q(\d)$/i);
  if (quarterMatch) {
    const year = Number(quarterMatch[1]);
    const quarter = Number(quarterMatch[2]);
    return year * 100 + quarter * 3;
  }

  const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    return year * 100 + month;
  }

  const yearMatch = period.match(/^(\d{4})/);
  if (yearMatch) {
    return Number(yearMatch[1]) * 100 + 12;
  }

  return 0;
};

const stageToStatus = (stage: string): ReturnStatus => {
  if (stage === "filed" || stage === "paid" || stage === "reconciled") return "Filed";
  if (stage === "ready" || stage === "review") return "Ready";
  return "Draft";
};

const getStatusPillClass = (status: ReturnStatus) => {
  if (status === "Filed") return "bg-emerald-50 text-emerald-700";
  if (status === "Ready") return "bg-blue-50 text-blue-700";
  return "bg-gray-100 text-gray-700";
};

const getTaxLabel = (taxType: ReturnTaxType | "OTHER") => {
  if (taxType === "VAT") return "VAT";
  if (taxType === "CIT") return "CIT";
  if (taxType === "PAYE") return "PAYE";
  if (taxType === "WHT") return "WHT";
  return "Other";
};

const readFromLocalStorage = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeToLocalStorage = <T,>(key: string, value: T) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const loadManualFilings = () => readFromLocalStorage<ManualFilingRecord[]>(MANUAL_FILINGS_KEY, []);
const saveManualFilings = (records: ManualFilingRecord[]) => writeToLocalStorage(MANUAL_FILINGS_KEY, records);

const loadSubmissionHistory = () =>
  readFromLocalStorage<SubmissionHistoryItem[]>(SUBMISSION_HISTORY_KEY, []);
const saveSubmissionHistory = (records: SubmissionHistoryItem[]) =>
  writeToLocalStorage(SUBMISSION_HISTORY_KEY, records);

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function FileTaxesPage() {
  const [returns, setReturns] = useState<FilingReturnRow[]>([]);
  const [schedules, setSchedules] = useState<TaxSchedule[]>([]);
  const [filingPacks, setFilingPacks] = useState<FilingPackResult[]>([]);
  const [manualFilings, setManualFilings] = useState<ManualFilingRecord[]>([]);
  const [history, setHistory] = useState<SubmissionHistoryItem[]>([]);

  const [uploadTaxType, setUploadTaxType] = useState<ReturnTaxType | "OTHER">("OTHER");
  const [uploadPeriod, setUploadPeriod] = useState("");

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingId, setIsGeneratingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const appendHistory = useCallback((entry: Omit<SubmissionHistoryItem, "id" | "createdAt">) => {
    const next: SubmissionHistoryItem = {
      id: makeId("history"),
      createdAt: new Date().toISOString(),
      ...entry,
    };
    const merged = [next, ...loadSubmissionHistory()].slice(0, 200);
    saveSubmissionHistory(merged);
    if (isMountedRef.current) {
      setHistory(merged);
    }
  }, []);

  const refreshData = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsRefreshing(true);
    setError(null);

    try {
      accountingEngine.load();
      const postedEntries: JournalEntry[] = accountingEngine
        .getState()
        .journalEntries.filter((entry) => entry.status === "posted");

      const mappedTransactions = mapJournalEntriesToCompliance("entity-default", postedEntries);
      const computationTransactions = withTaxAdjustments("entity-default", mappedTransactions);
      if (computationTransactions.length > 0) {
        runTaxComputation({
          entityId: "entity-default",
          period: "current",
          transactions: computationTransactions,
        });
      }

      const scheduleRows = loadSchedules().filter(
        (schedule) =>
          schedule.entityId === "entity-default" &&
          (schedule.taxType === "VAT" || schedule.taxType === "CIT" || schedule.taxType === "WHT")
      );

      const statusMap = new Map<string, { stage: ComplianceStatusStage; updatedAt: string }>();
      loadComplianceStatuses()
        .filter((status) => status.entityId === "entity-default")
        .forEach((status) => {
          const key = `${status.taxType}::${status.period}`;
          if (!statusMap.has(key)) {
            statusMap.set(key, { stage: status.stage, updatedAt: status.updatedAt });
          }
        });

      const filingRows: FilingReturnRow[] = scheduleRows.map((schedule) => {
        const key = `${schedule.taxType}::${schedule.period}`;
        const tracked = statusMap.get(key);
        const status = stageToStatus(tracked?.stage || schedule.status);
        return {
          id: `file-${schedule.taxType}-${schedule.period}`,
          taxType: schedule.taxType as ReturnTaxType,
          period: schedule.period,
          status,
          taxAmount: Math.max(0, schedule.totalTax || 0),
          filingDate: status === "Filed" ? tracked?.updatedAt || null : null,
          source: "schedule",
          scheduleId: schedule.id,
        };
      });

      const payeByMonth = new Map<string, { payrollBase: number; payeRecorded: number }>();
      postedEntries.forEach((entry) => {
        const date = new Date(entry.date || entry.createdAt);
        if (Number.isNaN(date.getTime())) return;

        const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const bucket = payeByMonth.get(period) || { payrollBase: 0, payeRecorded: 0 };

        entry.lines.forEach((line) => {
          const code = (line.accountCode || "").trim();
          if (code === "5500") {
            bucket.payrollBase += Math.max(0, (line.debit || 0) - (line.credit || 0));
          }
          if (code === "2210") {
            bucket.payeRecorded += Math.max(0, (line.credit || 0) - (line.debit || 0));
          }
        });

        if (bucket.payrollBase > 0 || bucket.payeRecorded > 0) {
          payeByMonth.set(period, bucket);
        }
      });

      const payeRows: FilingReturnRow[] = Array.from(payeByMonth.entries()).map(([period, value]) => {
        const estimatedPaye = value.payrollBase * PAYE_ESTIMATE_RATE;
        const taxAmount = value.payeRecorded > 0 ? value.payeRecorded : estimatedPaye;
        return {
          id: `file-PAYE-${period}`,
          taxType: "PAYE",
          period,
          status: taxAmount > 0 ? "Ready" : "Draft",
          taxAmount,
          filingDate: null,
          source: "derived",
        };
      });

      const combined = [...filingRows, ...payeRows].sort((a, b) => {
        const periodDiff = parsePeriodRank(b.period) - parsePeriodRank(a.period);
        if (periodDiff !== 0) return periodDiff;
        return TAX_ORDER.indexOf(a.taxType) - TAX_ORDER.indexOf(b.taxType);
      });

      if (!isMountedRef.current) return;
      setSchedules(scheduleRows);
      setReturns(combined);
      setFilingPacks(loadFilingPacks().filter((pack) => pack.entityId === "entity-default"));
      setManualFilings(loadManualFilings());
      setHistory(loadSubmissionHistory());
      setStatusMessage(`Loaded ${combined.length} returns ready for filing.`);
    } catch (refreshError) {
      console.error("Unable to load filing data", refreshError);
      if (!isMountedRef.current) return;
      setError("Unable to load filing center right now.");
    } finally {
      if (!isMountedRef.current) return;
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    const unsubscribe = accountingEngine.subscribe(() => {
      refreshData();
    });
    return () => unsubscribe();
  }, [refreshData]);

  const generatePayePdf = useCallback(async (row: FilingReturnRow): Promise<{ blob: Blob; fileName: string }> => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    await configureJsPdfTypography(doc, "helvetica");

    doc.setFontSize(18);
    doc.text("PAYE Return Filing Document", 20, 22);
    doc.setFontSize(11.5);
    doc.text(`Tax Type: PAYE`, 20, 36);
    doc.text(`Period: ${row.period}`, 20, 44);
    doc.text(`Status: ${row.status}`, 20, 52);
    doc.text(`Tax Amount: NGN ${Math.round(row.taxAmount).toLocaleString("en-NG")}`, 20, 60);
    doc.text(`Generated: ${new Date().toLocaleString("en-NG")}`, 20, 68);

    const fileName = `tax-PAYE-${row.period}.pdf`;
    return { blob: doc.output("blob"), fileName };
  }, []);

  const generateAndDownload = useCallback(
    async (row: FilingReturnRow) => {
      setIsGeneratingId(row.id);
      setError(null);
      try {
        if (row.taxType === "PAYE") {
          const payeDoc = await generatePayePdf(row);
          downloadBlob(payeDoc.blob, payeDoc.fileName);
          appendHistory({
            action: "generated_document",
            fileName: payeDoc.fileName,
            taxType: row.taxType,
            period: row.period,
          });
          setStatusMessage(`Generated and downloaded ${payeDoc.fileName}.`);
          return;
        }

        const schedule =
          schedules.find((item) => item.id === row.scheduleId) ||
          schedules.find((item) => item.taxType === row.taxType && item.period === row.period);

        if (!schedule) {
          throw new Error("No schedule found for this return.");
        }

        const pack = await generateFilingPack({
          entityId: "entity-default",
          schedule,
          format: "pdf",
        });

        if (pack.blob) {
          downloadBlob(pack.blob, pack.fileName);
        }

        appendHistory({
          action: "generated_document",
          fileName: pack.fileName,
          taxType: row.taxType,
          period: row.period,
        });

        if (!isMountedRef.current) return;
        setFilingPacks(loadFilingPacks().filter((item) => item.entityId === "entity-default"));
        setStatusMessage(`Generated and downloaded ${pack.fileName}.`);
      } catch (generationError) {
        console.error("Unable to generate filing document", generationError);
        if (!isMountedRef.current) return;
        setError("Could not generate filing document.");
      } finally {
        if (!isMountedRef.current) return;
        setIsGeneratingId(null);
      }
    },
    [appendHistory, generatePayePdf, schedules]
  );

  const downloadPackAgain = useCallback(
    async (pack: FilingPackResult) => {
      const related = returns.find((row) => row.taxType === pack.taxType && row.period === pack.period);
      if (related) {
        await generateAndDownload(related);
        appendHistory({
          action: "downloaded_pdf",
          fileName: pack.fileName,
          taxType: String(pack.taxType),
          period: pack.period,
        });
      }
    },
    [appendHistory, generateAndDownload, returns]
  );

  const handleManualUpload = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const now = new Date().toISOString();
      const existing = loadManualFilings();
      const created: ManualFilingRecord[] = Array.from(fileList).map((file) => ({
        id: makeId("manual"),
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: now,
        taxType: uploadTaxType,
        period: uploadPeriod || "N/A",
      }));

      const merged = [...created, ...existing].slice(0, 150);
      saveManualFilings(merged);
      created.forEach((record) => {
        appendHistory({
          action: "manual_upload",
          fileName: record.fileName,
          taxType: record.taxType,
          period: record.period,
        });
      });

      setManualFilings(merged);
      setStatusMessage(`Uploaded ${created.length} manual filing${created.length > 1 ? "s" : ""}.`);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [appendHistory, uploadPeriod, uploadTaxType]
  );

  const filingPackPdfs = useMemo(() => {
    return filingPacks
      .filter((pack) => pack.format === "pdf")
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }, [filingPacks]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">File Taxes</h1>
          <p className="mt-1 text-sm text-gray-500">Generate documents, download returns, upload manual filings, and track submissions.</p>
        </div>
        <button
          type="button"
          onClick={refreshData}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0a0a0a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1a1a] disabled:opacity-60"
        >
          <svg className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Filing Data
        </button>
      </div>

      {(statusMessage || error) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-gray-200 bg-white text-gray-600"}`}>
          {error || statusMessage}
        </div>
      )}

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Generate Tax Return Documents</h2>
        <p className="mt-1 text-sm text-gray-500">Generate filing documents and download returns as PDF.</p>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Return Type</th>
                <th className="px-4 py-3 text-left font-semibold">Period</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Tax Amount</th>
                <th className="px-4 py-3 text-left font-semibold">Filing Date</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {returns.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No returns available for filing yet.</td>
                </tr>
              )}
              {returns.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-gray-900">{getTaxLabel(row.taxType)}</td>
                  <td className="px-4 py-3 text-gray-700">{row.period}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusPillClass(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(row.taxAmount)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatDate(row.filingDate)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => generateAndDownload(row)}
                      disabled={isGeneratingId === row.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      <svg className={`h-3.5 w-3.5 ${isGeneratingId === row.id ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" />
                      </svg>
                      Generate PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Download Returns (PDF)</h2>
        <p className="mt-1 text-sm text-gray-500">Previously generated return documents.</p>

        <div className="mt-4 space-y-3">
          {filingPackPdfs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
              No generated PDF returns yet.
            </div>
          )}
          {filingPackPdfs.map((pack) => (
            <div key={pack.id} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{pack.fileName}</p>
                <p className="text-xs text-gray-500">
                  {pack.taxType} • {pack.period} • Generated {formatDateTime(pack.generatedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => downloadPackAgain(pack)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" />
                </svg>
                Download
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Upload Manual Filings</h2>
        <p className="mt-1 text-sm text-gray-500">Upload filing evidence already submitted outside the platform.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <select
            value={uploadTaxType}
            onChange={(event) => setUploadTaxType(event.target.value as ReturnTaxType | "OTHER")}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
          >
            <option value="OTHER">Return type (Other)</option>
            <option value="VAT">VAT</option>
            <option value="CIT">CIT</option>
            <option value="PAYE">PAYE</option>
            <option value="WHT">WHT</option>
          </select>
          <input
            type="text"
            value={uploadPeriod}
            onChange={(event) => setUploadPeriod(event.target.value)}
            placeholder="Period (e.g. 2026-Q1)"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
          />
          <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv,.xlsx,.xls,.doc,.docx,.png,.jpg,.jpeg"
              multiple
              className="hidden"
              onChange={(event) => handleManualUpload(event.target.files)}
            />
            Upload Filing Files
          </label>
        </div>

        <div className="mt-4 space-y-2">
          {manualFilings.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500">
              No manual filings uploaded yet.
            </div>
          )}
          {manualFilings.slice(0, 8).map((record) => (
            <div key={record.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-gray-900">{record.fileName}</p>
              <p className="text-xs text-gray-500">
                {getTaxLabel(record.taxType)} • {record.period} • {formatFileSize(record.fileSize)} • Uploaded {formatDateTime(record.uploadedAt)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Submission History</h2>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Action</th>
                <th className="px-4 py-3 text-left font-semibold">Return</th>
                <th className="px-4 py-3 text-left font-semibold">Period</th>
                <th className="px-4 py-3 text-left font-semibold">File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No submission history yet.</td>
                </tr>
              )}
              {history.slice(0, 40).map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-gray-700">{formatDateTime(item.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-900">
                    {item.action === "generated_document"
                      ? "Generated Document"
                      : item.action === "downloaded_pdf"
                      ? "Downloaded PDF"
                      : "Manual Upload"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{item.taxType || "-"}</td>
                  <td className="px-4 py-3 text-gray-700">{item.period || "-"}</td>
                  <td className="px-4 py-3 text-gray-700">{item.fileName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
