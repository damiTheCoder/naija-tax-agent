"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { accountingEngine } from "@/lib/accounting/transactionBridge";
import type { JournalEntry } from "@/lib/accounting/doubleEntry";
import { parseCSVStatement, processTransactionsWithAI } from "@/lib/banking/transactionPipeline";
import type { InboundBankTransaction } from "@/lib/banking/types";

// =============================================================================
// TYPES
// =============================================================================

export type BankConnectionStatus = "connected" | "pending" | "error" | "disconnected" | "expired";
export type BankAccountType = "current" | "savings" | "domiciliary" | "corporate" | "merchant";

export interface BankAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  accountType: BankAccountType;
  currency: "NGN" | "USD" | "GBP" | "EUR";
  balance?: number;
  lastSynced?: string;
  isDefault: boolean;
}

export interface BankConnection {
  id: string;
  bankCode: string;
  bankName: string;
  status: BankConnectionStatus;
  accounts: BankAccount[];
  connectedAt: string;
  lastSyncAt?: string;
  syncFrequency: "realtime" | "hourly" | "daily" | "manual";
  transactionCount: number;
}

export interface BankProvider {
  code: string;
  name: string;
  shortName: string;
  logoPath: string;
  color: string;
  supported: boolean;
  connectionType: "open_banking" | "statement_upload" | "coming_soon";
  features: string[];
}

type BankFeedTransaction = {
  id: string;
  date: string;
  description: string;
  balance?: number;
  amount: number;
  type: "credit" | "debit";
  narration?: string;
  reference?: string;
  currency?: string;
  channel?: InboundBankTransaction["channel"];
};

// =============================================================================
// BANK DATA
// =============================================================================

const SUPPORTED_BANKS: BankProvider[] = [
  { code: "zenith", name: "Zenith Bank Plc", shortName: "Zenith", logoPath: "/bank-logos/zenith.svg", color: "#E21A2D", supported: true, connectionType: "open_banking", features: ["Real-time sync", "Multi-account"] },
  { code: "gtbank", name: "Guaranty Trust Bank", shortName: "GTBank", logoPath: "/bank-logos/gtbank.svg", color: "#F7941D", supported: true, connectionType: "open_banking", features: ["Real-time sync", "Multi-account"] },
  { code: "access", name: "Access Bank Plc", shortName: "Access", logoPath: "/bank-logos/access.svg", color: "#F36F21", supported: true, connectionType: "open_banking", features: ["Real-time sync", "Multi-account"] },
  { code: "firstbank", name: "First Bank of Nigeria", shortName: "FirstBank", logoPath: "/bank-logos/firstbank.svg", color: "#003B71", supported: true, connectionType: "open_banking", features: ["Daily sync"] },
  { code: "uba", name: "United Bank for Africa", shortName: "UBA", logoPath: "/bank-logos/uba.svg", color: "#E31937", supported: true, connectionType: "open_banking", features: ["Daily sync"] },
  { code: "stanbic", name: "Stanbic IBTC Bank", shortName: "Stanbic", logoPath: "/bank-logos/stanbic.svg", color: "#0033A0", supported: true, connectionType: "statement_upload", features: ["Statement upload"] },
  { code: "fcmb", name: "First City Monument Bank", shortName: "FCMB", logoPath: "/bank-logos/fcmb.svg", color: "#5C2D91", supported: true, connectionType: "statement_upload", features: ["Statement upload"] },
  { code: "fidelity", name: "Fidelity Bank Plc", shortName: "Fidelity", logoPath: "/bank-logos/fidelity.svg", color: "#00A859", supported: true, connectionType: "statement_upload", features: ["Statement upload"] },
  { code: "ecobank", name: "Ecobank Nigeria", shortName: "Ecobank", logoPath: "/bank-logos/ecobank.svg", color: "#0066B3", supported: false, connectionType: "coming_soon", features: ["Coming Q1 2025"] },
  { code: "sterling", name: "Sterling Bank Plc", shortName: "Sterling", logoPath: "/bank-logos/sterling.svg", color: "#CE1126", supported: false, connectionType: "coming_soon", features: ["Coming Q1 2025"] },
];

// =============================================================================
// ICONS
// =============================================================================

const icons = {
  bank: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
    </svg>
  ),
  refresh: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  plus: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  trash: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  close: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  link: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  card: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  document: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  chart: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  shield: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  upload: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  download: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  file: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
};

function KpiCard({ label, value, hint, accent }: { label: string; value: string; hint: string; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 min-w-0">
      <p className={`text-xs font-semibold uppercase tracking-wide ${accent}`}>{label}</p>
      <p className="mt-3 text-lg sm:text-xl font-semibold text-gray-900 leading-tight break-words">{value}</p>
      <p className="text-xs text-gray-500 mt-2">{hint}</p>
    </div>
  );
}

function BankLogoBadge({
  shortName,
  logoPath,
  alt,
  containerClassName,
  imageClassName,
  imageSizes,
}: {
  shortName: string;
  logoPath?: string;
  alt: string;
  containerClassName: string;
  imageClassName: string;
  imageSizes: string;
}) {
  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-gray-100 ${containerClassName}`}>
      <span className="text-gray-700 font-bold text-sm">{shortName.slice(0, 2)}</span>
      {logoPath ? (
        <div className="absolute inset-[14%] overflow-hidden rounded-full bg-white/95">
          <Image
            src={logoPath}
            alt={alt}
            fill
            sizes={imageSizes}
            className={`${imageClassName} bg-transparent`}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function getContextJournalLabel(entry: JournalEntry): string {
  const txType = entry.transactionType;
  const narration = entry.narration.toLowerCase();
  const hasCashLine = entry.lines.some(
    (line) => line.accountCode.startsWith("10") || /cash|bank/i.test(line.accountName)
  );
  const hasSalesLine = entry.lines.some((line) => line.accountCode.startsWith("4") && line.credit > 0);
  const hasPurchaseLine = entry.lines.some(
    (line) =>
      (line.accountCode.startsWith("50") || /purchase|inventory|stock|materials/i.test(line.accountName)) &&
      line.debit > 0
  );
  const hasExpenseLine = entry.lines.some(
    (line) =>
      (line.accountCode.startsWith("5") || line.accountCode.startsWith("6") || line.accountCode.startsWith("7")) &&
      line.debit > 0
  );

  if (txType === "sale" || txType === "sale-return" || hasSalesLine) return "Sales Journal";
  if (txType === "purchase" || txType === "purchase-return" || hasPurchaseLine) return "Purchase Journal";
  if (txType === "expense" || hasExpenseLine) return "Expense Journal";

  if (txType === "receipt" || txType === "payment" || txType === "transfer" || hasCashLine) {
    if (hasSalesLine || /received|receipt|cash sale/.test(narration)) return "Cash Receipt Journal";
    if (hasExpenseLine || /paid|payment|disburse|withdraw/.test(narration)) return "Cash Payment Journal";
    return "Cash Journal";
  }

  if (txType === "adjustment") return "Adjustment Journal";
  if (txType === "opening-balance") return "Opening Journal";
  if (txType === "closing") return "Closing Journal";
  return "General Journal";
}

function isBankOriginEntry(entry: JournalEntry): boolean {
  const reference = (entry.reference || "").toLowerCase();
  return reference.startsWith("bank-") || typeof entry.matchedBankTransactionId === "string";
}

function buildStableBankTransactionId(
  connectionId: string,
  tx: Pick<InboundBankTransaction, "date" | "amount" | "direction" | "description" | "reference">,
  sourceId?: string
): string {
  if (sourceId) return `feed-${connectionId}-${sourceId}`;

  const seed = [
    connectionId,
    tx.date.split("T")[0],
    tx.direction,
    tx.amount.toFixed(2),
    (tx.reference || tx.description).toLowerCase().trim(),
  ].join("|");

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return `feed-${Math.abs(hash)}`;
}

function formatJournalDate(value?: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";

  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toISOString().split("T")[0];
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function BankConnectionsPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedBank, setSelectedBank] = useState<BankProvider | null>(null);
  const [connectStep, setConnectStep] = useState<"select" | "connecting" | "success">("select");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    show: boolean;
    imported: number;
    income: number;
    expenses: number;
    message?: string;
  } | null>(null);
  const [processedJournalEntries, setProcessedJournalEntries] = useState<JournalEntry[]>([]);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBankCode, setUploadBankCode] = useState("");
  const [uploadAccountNumber, setUploadAccountNumber] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const saved = localStorage.getItem("insight::bank-connections");
        if (saved) {
          const parsed: BankConnection[] = JSON.parse(saved);
          // Deduplicate by id AND by bankCode (keep first occurrence of each)
          const seenIds = new Set<string>();
          const seenBanks = new Set<string>();
          const unique = parsed.filter((c) => {
            if (seenIds.has(c.id) || seenBanks.has(c.bankCode)) return false;
            seenIds.add(c.id);
            seenBanks.add(c.bankCode);
            return true;
          });
          setConnections(unique);
          // Persist cleaned list back immediately
          if (unique.length !== parsed.length) {
            localStorage.setItem("insight::bank-connections", JSON.stringify(unique));
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Save connections
  useEffect(() => {
    localStorage.setItem("insight::bank-connections", JSON.stringify(connections));
  }, [connections]);

  const refreshProcessedJournalEntries = useCallback(() => {
    try {
      accountingEngine.load();
      const entries = accountingEngine.getState().journalEntries || [];
      const bankEntries = entries
        .filter((entry) => isBankOriginEntry(entry))
        .sort((left, right) => {
          const leftTime = new Date(left.postedAt || left.createdAt || left.date).getTime();
          const rightTime = new Date(right.postedAt || right.createdAt || right.date).getTime();
          return rightTime - leftTime;
        });
      setProcessedJournalEntries(bankEntries);
    } catch (error) {
      console.error("Failed to load processed bank journals:", error);
    }
  }, []);

  useEffect(() => {
    refreshProcessedJournalEntries();

    const handleAccountingUpdate = () => {
      refreshProcessedJournalEntries();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "insight::accounting-engine") {
        refreshProcessedJournalEntries();
      }
    };

    window.addEventListener("accounting-update", handleAccountingUpdate);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("accounting-update", handleAccountingUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, [refreshProcessedJournalEntries]);

  // Stats
  const stats = useMemo(() => ({
    connectedBanks: connections.filter(c => c.status === "connected").length,
    totalAccounts: connections.reduce((acc, c) => acc + c.accounts.length, 0),
    totalTransactions: connections.reduce((acc, c) => acc + c.transactionCount, 0),
    totalBalance: connections.reduce((acc, c) =>
      acc + c.accounts.filter(a => a.currency === "NGN").reduce((s, a) => s + (a.balance || 0), 0), 0),
  }), [connections]);

  const broadcastAccountingUpdate = useCallback(() => {
    window.dispatchEvent(new CustomEvent("accounting-update", { detail: { source: "bank-connections" } }));
  }, []);

  const processTransactionsLocally = useCallback(async (
    transactions: InboundBankTransaction[],
    entityId: string,
    messageBuilder: (processedCount: number) => string
  ) => {
    accountingEngine.load();
    const pipeline = await processTransactionsWithAI(transactions, {
      entityId,
      autoPost: true,
      runTaxClassification: true,
      updateBudgets: true,
      updateCashflow: true,
      bankAccountCode: "1000",
    });

    const summary = pipeline.summary || {
      totalCredits: 0,
      totalDebits: 0,
    };

    setImportResult({
      show: true,
      imported: pipeline.processed || 0,
      income: summary.totalCredits || 0,
      expenses: summary.totalDebits || 0,
      message: messageBuilder(pipeline.processed || 0),
    });

    refreshProcessedJournalEntries();
    broadcastAccountingUpdate();
    setTimeout(() => setImportResult(null), 6000);

    return pipeline;
  }, [broadcastAccountingUpdate, refreshProcessedJournalEntries]);

  // Connect bank — for statement_upload banks, open upload modal instead
  const handleConnectBank = async (bank: BankProvider) => {
    if (!bank.supported) return;

    // Statement-upload banks: open upload modal directly
    if (bank.connectionType === "statement_upload") {
      setShowConnectModal(false);
      setUploadBankCode(bank.code);
      setShowUploadModal(true);
      return;
    }

    // Already connected? Skip
    if (connections.some(c => c.bankCode === bank.code)) return;

    setSelectedBank(bank);
    setConnectStep("connecting");

    try {
      // Call connect API to get a connection ID
      const res = await fetch("/api/bank-connections/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankCode: bank.code }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Connection failed");

      const connectionId = data.connectionId || `conn_${bank.code}_${Date.now()}`;

      // Create the connection
      const newConnection: BankConnection = {
        id: connectionId,
        bankCode: bank.code,
        bankName: bank.name,
        status: "connected",
        accounts: [{
          id: `acc_${Date.now()}`,
          accountNumber: "Pending sync...",
          accountName: "Business Account",
          accountType: "corporate",
          currency: "NGN",
          balance: 0,
          lastSynced: undefined,
          isDefault: true,
        }],
        connectedAt: new Date().toISOString(),
        lastSyncAt: undefined,
        syncFrequency: "hourly",
        transactionCount: 0,
      };

      setConnections(prev => {
        // Guard against duplicates (race condition / double-click)
        if (prev.some(c => c.id === newConnection.id || c.bankCode === bank.code)) return prev;
        return [...prev, newConnection];
      });
      setConnectStep("success");

      // Auto-trigger initial sync after connection
      setTimeout(async () => {
        setShowConnectModal(false);
        setConnectStep("select");
        setSelectedBank(null);
        // Trigger first sync
        await handleSync(connectionId);
      }, 1500);
    } catch (error) {
      console.error(error);
      setConnectStep("select");
    }
  };

  // Sync via client-side posting so journals persist to the local accounting engine
  const handleSync = useCallback(async (connectionId: string) => {
    setSyncingId(connectionId);
    try {
      const res = await fetch(`/api/bank-connections/transactions?connectionId=${encodeURIComponent(connectionId)}&limit=50`);
      const data = await res.json();

      if (data.success && Array.isArray(data.transactions)) {
        const transactions = data.transactions.map((tx: BankFeedTransaction, index: number): InboundBankTransaction => ({
          id: buildStableBankTransactionId(
            connectionId,
            {
              date: tx.date,
              amount: Math.abs(Number(tx.amount || 0)),
              direction: tx.type === "credit" ? "credit" : "debit",
              description: tx.description || tx.narration || "Transaction",
              reference: tx.reference,
            },
            tx.id || String(index)
          ),
          connectionId,
          accountId: `${connectionId}-primary`,
          date: tx.date,
          description: tx.description || tx.narration || "Transaction",
          narration: tx.narration || undefined,
          amount: Math.abs(Number(tx.amount || 0)),
          balance: typeof tx.balance === "number" ? tx.balance : undefined,
          direction: tx.type === "credit" ? "credit" : "debit",
          currency: tx.currency || "NGN",
          reference: tx.reference || undefined,
          channel: tx.channel || "transfer",
        }));

        const pipeline = await processTransactionsLocally(
          transactions,
          connectionId,
          (processedCount) => `${processedCount} transactions processed across Accounting, Tax & Cashflow`
        );

        setConnections(prev => prev.map(c =>
          c.id === connectionId
            ? {
              ...c,
              lastSyncAt: new Date().toISOString(),
              transactionCount: c.transactionCount + (pipeline.processed || 0),
              accounts: c.accounts.map(a => ({ ...a, lastSynced: new Date().toISOString() })),
            }
            : c
        ));
      }
    } catch (e) {
      console.error("Sync failed:", e);
    } finally {
      setSyncingId(null);
    }
  }, [processTransactionsLocally]);

  // Upload CSV statement
  const handleUpload = async () => {
    if (!uploadFile || !uploadBankCode) return;

    setIsUploading(true);
    setUploadError("");

    try {
      const csvText = await uploadFile.text();
      if (!csvText.trim()) {
        setUploadError("File is empty");
        return;
      }

      const existingConn = connections.find(c => c.bankCode === uploadBankCode);
      const bank = SUPPORTED_BANKS.find(b => b.code === uploadBankCode);
      const connectionId = existingConn?.id || `conn_${uploadBankCode}_upload_${Date.now()}`;
      const accountId = uploadAccountNumber ? `acc_${uploadAccountNumber}` : `acc_${connectionId}`;
      const parsedTransactions = parseCSVStatement(csvText, connectionId, accountId, {
        currency: "NGN",
        dateFormat: "DD/MM/YYYY",
      }).map((tx, index) => ({
        ...tx,
        id: buildStableBankTransactionId(connectionId, tx, tx.reference || `${uploadBankCode}-${index}`),
      }));

      if (parsedTransactions.length === 0) {
        setUploadError("No transactions could be extracted from the file. Please ensure it has Date, Description, Debit/Credit, and Balance columns.");
        return;
      }

      const pipeline = await processTransactionsLocally(
        parsedTransactions,
        connectionId,
        (processedCount) => `${processedCount} transactions from ${uploadFile.name} processed across all modules`
      );

      // Add or update connection
      if (existingConn) {
        setConnections(prev => prev.map(c =>
          c.bankCode === uploadBankCode
            ? {
              ...c,
              lastSyncAt: new Date().toISOString(),
              transactionCount: c.transactionCount + (pipeline.processed || 0),
              accounts: c.accounts.map(a => ({ ...a, lastSynced: new Date().toISOString() })),
            }
            : c
        ));
      } else {
        const newConn: BankConnection = {
          id: connectionId,
          bankCode: uploadBankCode,
          bankName: bank?.name || uploadBankCode,
          status: "connected",
          accounts: [{
            id: `acc_upload_${Date.now()}`,
            accountNumber: uploadAccountNumber || "Statement upload",
            accountName: "Uploaded Account",
            accountType: "corporate",
            currency: "NGN",
            balance: 0,
            lastSynced: new Date().toISOString(),
            isDefault: true,
          }],
          connectedAt: new Date().toISOString(),
          lastSyncAt: new Date().toISOString(),
          syncFrequency: "manual",
          transactionCount: pipeline.processed || 0,
        };
        setConnections(prev => [...prev, newConn]);
      }

      // Close modal and reset
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadBankCode("");
      setUploadAccountNumber("");
    } catch (e) {
      console.error("Upload failed:", e);
      setUploadError("Something went wrong. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // Disconnect
  const handleDisconnect = (connectionId: string) => {
    if (confirm("Disconnect this bank? Transaction sync will stop.")) {
      setConnections(prev => prev.filter(c => c.id !== connectionId));
    }
  };

  const formatCurrency = (amount: number) => `₦${amount.toLocaleString()}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
  });
  const openJournalEntry = useCallback((journalId: string) => {
    router.push(`/accounting?editEntry=${encodeURIComponent(journalId)}&resetDraft=1`);
  }, [router]);

  const handleVoidJournalEntry = useCallback((journalId: string) => {
    if (!confirm("Are you sure you want to void this journal entry? This will reverse all related ledger entries and keep an audit trail.")) {
      return;
    }

    try {
      accountingEngine.load();
      accountingEngine.deleteJournalEntry(journalId);
      refreshProcessedJournalEntries();
      broadcastAccountingUpdate();
    } catch (error) {
      console.error("Failed to void bank journal entry:", error);
    }
  }, [broadcastAccountingUpdate, refreshProcessedJournalEntries]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-[#2264ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bank Connections</h1>
          <p className="text-sm text-gray-500 mt-1">Connect bank accounts, sync transactions, and keep treasury records in one place.</p>
          <Link href="/accounting/workspace" className="mt-2 inline-flex text-sm font-medium text-[#2264ff] hover:text-[#1a50cc]">
            Open Accounting Workspace
          </Link>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            {icons.upload}
            Upload Statement
          </button>
          {connections.length > 0 && (
            <button
              onClick={async () => {
                for (const c of connections.filter(c => c.status === "connected")) {
                  await handleSync(c.id);
                }
              }}
              disabled={!!syncingId}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {icons.refresh}
              Sync All
            </button>
          )}
          <button
            onClick={() => setShowConnectModal(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-[#2264ff] text-white hover:bg-[#1a50cc]"
          >
            {icons.plus}
            Connect Bank
          </button>
        </div>
      </div>

      {/* Supported Banks (aligned to accounting explore-strip design) */}
      <div className="rounded-2xl overflow-hidden border-0 bg-transparent">
        <div className="py-2">
          <h2 className="text-base font-semibold text-gray-900">Supported Banks</h2>
          <p className="text-xs text-gray-500 mt-1">Tap a bank to connect instantly or see connection status.</p>
        </div>
        <div className="overflow-x-auto hide-scrollbar">
          <div className="flex gap-1 px-2 py-2 min-w-max">
            {SUPPORTED_BANKS.map((bank) => {
              const isConnected = connections.some((c) => c.bankCode === bank.code);
              const isDisabled = !bank.supported || isConnected;

              return (
                <button
                  key={bank.code}
                  onClick={() => !isDisabled && handleConnectBank(bank)}
                  disabled={isDisabled}
                  className={`relative flex-shrink-0 flex flex-col items-center gap-2 p-3 group transition-all ${isDisabled ? "opacity-80" : "hover:bg-gray-50"
                    }`}
                >
                  <div className="relative">
                    <BankLogoBadge
                      shortName={bank.shortName}
                      logoPath={bank.logoPath}
                      alt={`${bank.name} logo`}
                      containerClassName="w-16 h-16 rounded-full group-hover:scale-110 transition-transform"
                      imageClassName="absolute inset-0 w-full h-full object-contain"
                      imageSizes="64px"
                    />
                    {isConnected ? (
                      <div className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : null}
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-gray-900">{bank.shortName}</p>
                    <p className="text-[10px] text-gray-500">
                      {isConnected ? "Connected" : bank.supported ? bank.connectionType.replace("_", " ") : "Coming soon"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Connected Banks" value={stats.connectedBanks.toString()} hint="Active open-banking links" accent="text-blue-600" />
        <KpiCard label="Total Accounts" value={stats.totalAccounts.toString()} hint="Accounts linked to CashOS" accent="text-indigo-600" />
        <KpiCard label="Synced Transactions" value={stats.totalTransactions.toLocaleString()} hint="Imported transaction records" accent="text-emerald-600" />
        <KpiCard label="Total NGN Balance" value={formatCurrency(stats.totalBalance)} hint="Combined linked account balances" accent="text-amber-600" />
      </div>

      {/* Connected Banks */}
      <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Your Banks</h2>
        </div>

        {connections.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No banks connected</h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Connect your business accounts to automatically import transactions and create journal entries.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowConnectModal(true)}
                className="inline-flex items-center gap-2 bg-[#2264ff] text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#1a50cc] transition-colors"
              >
                {icons.plus}
                Connect Bank
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                {icons.upload}
                Upload Statement
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {connections.map((connection) => {
              const bank = SUPPORTED_BANKS.find(b => b.code === connection.bankCode);
              const isSyncing = syncingId === connection.id;

              return (
                <div key={connection.id} className="p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <BankLogoBadge
                        shortName={bank?.shortName || "BK"}
                        logoPath={bank?.logoPath}
                        alt={`${connection.bankName} logo`}
                        containerClassName="w-12 h-12 rounded-xl"
                        imageClassName="absolute inset-0 w-full h-full object-contain p-1.5"
                        imageSizes="48px"
                      />
                      <div>
                        <h3 className="font-semibold text-gray-900">{connection.bankName}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${connection.status === "connected"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-amber-50 text-amber-700"
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${connection.status === "connected" ? "bg-blue-500" : "bg-amber-500"
                              }`} />
                            {connection.status === "connected" ? "Connected" : "Pending"}
                          </span>
                          <span className="text-sm text-gray-500">
                            {connection.accounts.length} account{connection.accounts.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSync(connection.id)}
                        disabled={isSyncing}
                        className="p-2.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                        title="Sync transactions via pipeline"
                      >
                        <span className={isSyncing ? "animate-spin inline-block" : ""}>
                          {icons.refresh}
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          setUploadBankCode(connection.bankCode);
                          setShowUploadModal(true);
                        }}
                        className="p-2.5 rounded-lg hover:bg-gray-100 transition-colors"
                        title="Upload statement CSV"
                      >
                        {icons.upload}
                      </button>
                      <button
                        onClick={() => handleDisconnect(connection.id)}
                        className="p-2.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                        title="Disconnect"
                      >
                        {icons.trash}
                      </button>
                    </div>
                  </div>

                  {/* Accounts */}
                  {connection.accounts.length > 0 && (
                    <div className="mt-4 grid gap-3">
                      {connection.accounts.map((account) => (
                        <div key={account.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                          <div>
                            <p className="font-medium text-gray-900">{account.accountName}</p>
                            <p className="text-sm text-gray-500">{account.accountNumber} • {account.accountType}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">{formatCurrency(account.balance || 0)}</p>
                            <p className="text-xs text-gray-400">Synced: {account.lastSynced ? formatDate(account.lastSynced) : "Never"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
                    <span className="text-gray-500">{connection.transactionCount.toLocaleString()} transactions synced</span>
                    <span className="text-gray-400">Connected {new Date(connection.connectedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Processed Transactions */}
      {processedJournalEntries.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-3 md:px-5 py-2 md:py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Processed Transactions</h3>
                  <p className="text-xs text-gray-500">{processedJournalEntries.length} entries • Double-entry ledger</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Balanced
              </span>
            </div>
          </div>
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[1080px]">
              <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-2 py-3 font-semibold">Date</th>
                  <th className="px-2 py-3 font-semibold">Number</th>
                  <th className="px-2 py-3 font-semibold">Partner</th>
                  <th className="px-2 py-3 font-semibold">Reference</th>
                  <th className="px-2 py-3 font-semibold">Journal</th>
                  <th className="px-2 py-3 text-right font-semibold">Total</th>
                  <th className="px-2 py-3 font-semibold">Status</th>
                  <th className="px-2 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {processedJournalEntries.slice(0, 200).map((entry) => {
                  const total = entry.totalDebits || entry.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
                  const partner = entry.reference ? entry.reference.replace(/^bank-/, "").slice(0, 28) : "Bank Feed";
                  const journalLabel = getContextJournalLabel(entry);
                  const isVoided = entry.status === "voided";

                  return (
                    <tr
                      key={entry.id}
                      onClick={() => {
                        if (!isVoided) {
                          openJournalEntry(entry.id);
                        }
                      }}
                      className={`hover:bg-gray-50/70 transition-colors ${isVoided ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <td className="px-2 py-3 text-sm text-gray-700 whitespace-nowrap">{formatJournalDate(entry.date)}</td>
                      <td className="px-2 py-3 text-sm font-mono text-purple-700 whitespace-nowrap">{entry.id}</td>
                      <td className="px-2 py-3 text-sm text-gray-600 whitespace-nowrap">{partner || "—"}</td>
                      <td className="px-2 py-3 text-sm text-gray-700 max-w-[340px]">
                        <p className="truncate" title={entry.narration}>{entry.narration}</p>
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-700 whitespace-nowrap">{journalLabel}</td>
                      <td className="px-2 py-3 text-sm text-right font-mono text-gray-900 whitespace-nowrap">₦{total.toLocaleString()}</td>
                      <td className="px-2 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${isVoided
                          ? "bg-rose-100 text-rose-700"
                          : entry.status === "draft"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                          }`}>
                          {isVoided ? "Voided" : entry.status === "draft" ? "Draft" : "Posted"}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!isVoided) {
                                openJournalEntry(entry.id);
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isVoided ? "Voided entries are read-only" : "Edit entry"}
                            disabled={isVoided}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!isVoided) {
                                handleVoidJournalEntry(entry.id);
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isVoided ? "Entry already voided" : "Void entry"}
                            disabled={isVoided}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {processedJournalEntries.length > 200 && (
            <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 bg-gray-50/70">
              Showing latest 200 entries. Open workspace for full historical view.
            </div>
          )}
        </div>
      )}

      {/* Security Notice */}
      <div className="rounded-2xl bg-blue-50 border border-blue-100 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
            {icons.shield}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">Bank-grade Security</h3>
            <p className="text-sm text-gray-600">
              Your credentials are never stored. We use OAuth 2.0 and Open Banking APIs for secure, read-only access.
            </p>
          </div>
        </div>
      </div>

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {connectStep === "select" && "Connect a Bank"}
                {connectStep === "connecting" && "Connecting..."}
                {connectStep === "success" && "Connected!"}
              </h2>
              <button
                onClick={() => { setShowConnectModal(false); setConnectStep("select"); setSelectedBank(null); }}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                {icons.close}
              </button>
            </div>

            <div className="p-6">
              {connectStep === "select" && (
                <div className="grid grid-cols-2 gap-3">
                  {SUPPORTED_BANKS.filter(b => b.supported).map((bank) => {
                    const alreadyConnected = connections.some(c => c.bankCode === bank.code);
                    return (
                      <button
                        key={bank.code}
                        onClick={() => !alreadyConnected && handleConnectBank(bank)}
                        disabled={alreadyConnected}
                        className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${alreadyConnected
                            ? "border-blue-200 bg-blue-50/50 opacity-70 cursor-default"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                      >
                        <BankLogoBadge
                          shortName={bank.shortName}
                          logoPath={bank.logoPath}
                          alt={`${bank.name} logo`}
                          containerClassName="w-10 h-10 rounded-lg"
                          imageClassName="absolute inset-0 w-full h-full object-contain p-1"
                          imageSizes="40px"
                        />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{bank.shortName}</p>
                          <p className="text-xs text-gray-400">
                            {alreadyConnected ? "Already connected" : bank.connectionType.replace("_", " ")}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {connectStep === "connecting" && selectedBank && (
                <div className="text-center py-8">
                  <div className="mx-auto mb-6 w-fit animate-pulse">
                    <BankLogoBadge
                      shortName={selectedBank.shortName}
                      logoPath={selectedBank.logoPath}
                      alt={`${selectedBank.name} logo`}
                      containerClassName="w-16 h-16 rounded-2xl"
                      imageClassName="absolute inset-0 w-full h-full object-contain p-2"
                      imageSizes="64px"
                    />
                  </div>
                  <p className="text-gray-900 font-medium mb-2">Connecting to {selectedBank.name}...</p>
                  <p className="text-sm text-gray-500">Establishing secure connection</p>
                  <div className="mt-6 flex justify-center">
                    <div className="w-8 h-8 border-2 border-[#2264ff] border-t-transparent rounded-full animate-spin" />
                  </div>
                </div>
              )}

              {connectStep === "success" && selectedBank && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-gray-900 font-medium mb-2">Successfully Connected!</p>
                  <p className="text-sm text-gray-500">{selectedBank.name} is now linked.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Toast */}
      {importResult?.show && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-gray-900 text-white rounded-2xl shadow-2xl p-5 max-w-sm">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">Pipeline Complete</h4>
                <p className="text-sm text-gray-400 mb-2">
                  {importResult.message || `${importResult.imported} journal entries created`}
                </p>
                <div className="flex items-center gap-4 text-sm">
                  {importResult.income > 0 && <span className="text-blue-400">+₦{importResult.income.toLocaleString()}</span>}
                  {importResult.expenses > 0 && <span className="text-red-400">-₦{importResult.expenses.toLocaleString()}</span>}
                </div>
              </div>
              <button onClick={() => setImportResult(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Statement Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Upload Bank Statement</h2>
              <button
                onClick={() => { setShowUploadModal(false); setUploadFile(null); setUploadError(""); }}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                {icons.close}
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Bank Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank</label>
                <select
                  value={uploadBankCode}
                  onChange={(e) => setUploadBankCode(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2264ff] focus:border-[#2264ff] outline-none bg-white"
                >
                  <option value="">Select a bank...</option>
                  {SUPPORTED_BANKS.filter(b => b.supported).map((bank) => (
                    <option key={bank.code} value={bank.code}>{bank.name}</option>
                  ))}
                </select>
              </div>

              {/* Account Number (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Account Number <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 0123456789"
                  value={uploadAccountNumber}
                  onChange={(e) => setUploadAccountNumber(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2264ff] focus:border-[#2264ff] outline-none"
                />
              </div>

              {/* File Drop Zone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Statement File</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) setUploadFile(file);
                  }}
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${uploadFile ? "border-blue-300 bg-blue-50/50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.tsv,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setUploadFile(file);
                    }}
                  />
                  {uploadFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                        {icons.file}
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-gray-900 text-sm">{uploadFile.name}</p>
                        <p className="text-xs text-gray-500">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                        className="p-1 rounded hover:bg-gray-200 text-gray-400"
                      >
                        {icons.close}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3 text-gray-400">
                        {icons.upload}
                      </div>
                      <p className="text-sm text-gray-600 font-medium">Drop your CSV file here, or click to browse</p>
                      <p className="text-xs text-gray-400 mt-1">Supports CSV, TSV files up to 10MB</p>
                    </>
                  )}
                </div>
              </div>

              {/* Error */}
              {uploadError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                  <p className="text-sm text-red-700">{uploadError}</p>
                </div>
              )}

              {/* Info */}
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500">
                  Your CSV should have columns like: <span className="font-medium">Date, Description, Debit, Credit, Balance</span>.
                  Transactions will be automatically classified and posted to Accounting, Tax, and Cashflow modules.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => { setShowUploadModal(false); setUploadFile(null); setUploadError(""); }}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!uploadFile || !uploadBankCode || isUploading}
                  className="px-4 py-2.5 text-sm font-medium text-white bg-[#2264ff] rounded-lg hover:bg-[#1a50cc] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {icons.upload}
                      Upload & Process
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
