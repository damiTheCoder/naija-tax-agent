"use client";

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  RawTransaction,
  StatementDraft,
  DraftDocumentMeta,
  AuditedStatementPacket,
  TransactionType,
} from "@/lib/accounting/types";
import { buildTransactionsFromFiles, generateStatementDraft } from "@/lib/accounting/statementEngine";
import { statementToTaxDraft } from "@/lib/accounting/taxBridge";
import { AutomationStatus, BANK_PROVIDERS, deriveWorkspaceFiles, mockAutomationClient } from "@/lib/accounting/automationAgent";
import { accountingEngine, parseTransactionFromChat, AccountingState, CustomAccount } from "@/lib/accounting/transactionBridge";
import { CHART_OF_ACCOUNTS } from "@/lib/accounting/standards";
import { clearAllData } from "@/lib/utils/system";
import { JournalEntry } from "@/lib/accounting/doubleEntry";
import { useTheme } from "@/lib/ThemeContext";
import { runUnifiedAgentMessage } from "@/lib/agent/unifiedClient";
import type { AgentConversationMessage } from "@/lib/agent/unifiedTypes";
import { EmptyChat, SkeletonList, EmptyTransactions } from "@/components/ui";

const PostJournalEntryModal = dynamic(() =>
  import("@/components/accounting/JournalEntryModals").then((module) => module.PostJournalEntryModal),
);

const EditJournalEntryModal = dynamic(() =>
  import("@/components/accounting/JournalEntryModals").then((module) => module.EditJournalEntryModal),
);

type ManualTransactionDraft = {
  date: string;
  description: string;
  category: string;
  amount: string;
  type: TransactionType;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

type CashHeadlineSection =
  | "cashBook"
  | "incomeStatement"
  | "balanceSheet"
  | "cashFlowStatement"
  | "trialBalance";

type CashHeadlineMetric =
  | "inflow"
  | "outflow"
  | "balance"
  | "revenue"
  | "costOfSales"
  | "netProfit"
  | "totalAssets"
  | "totalLiabilities"
  | "operatingCashflow"
  | "investingCashflow"
  | "financingCashflow"
  | "trialDebit"
  | "trialCredit"
  | "trialNetBalance";

type CashHeadlineSectionConfig = {
  key: CashHeadlineSection;
  label: string;
  metrics: Array<{ key: CashHeadlineMetric; label: string }>;
};

const CASH_HEADLINE_SECTION_CONFIGS: CashHeadlineSectionConfig[] = [
  {
    key: "cashBook",
    label: "Cash Book",
    metrics: [
      { key: "inflow", label: "Inflow" },
      { key: "outflow", label: "Outflow" },
      { key: "balance", label: "Balance" },
    ],
  },
  {
    key: "incomeStatement",
    label: "Income Statement",
    metrics: [
      { key: "revenue", label: "Revenue" },
      { key: "costOfSales", label: "Cost of Sales" },
      { key: "netProfit", label: "Net Profit" },
    ],
  },
  {
    key: "balanceSheet",
    label: "Balance Sheet",
    metrics: [
      { key: "totalAssets", label: "Total Assets" },
      { key: "totalLiabilities", label: "Total Liabilities" },
    ],
  },
  {
    key: "cashFlowStatement",
    label: "Cash Flow Statement",
    metrics: [
      { key: "operatingCashflow", label: "Operating CF" },
      { key: "investingCashflow", label: "Investing CF" },
      { key: "financingCashflow", label: "Financing CF" },
    ],
  },
  {
    key: "trialBalance",
    label: "Trial Balance",
    metrics: [
      { key: "trialDebit", label: "Total Debits" },
      { key: "trialCredit", label: "Total Credits" },
      { key: "trialNetBalance", label: "Net Balance" },
    ],
  },
];

const INITIAL_CASH_HEADLINE_METRIC_INDEX: Record<CashHeadlineSection, number> = {
  cashBook: 0,
  incomeStatement: 0,
  balanceSheet: 0,
  cashFlowStatement: 0,
  trialBalance: 0,
};

type AutomationLogEntry = {
  title: string;
  detail: string;
  timestamp: string;
};

const automationPrompts = [
  "Explain payroll variance",
  "Reclassify this rent payment",
  "Spot duplicate POS entries",
  "Summarise audit-ready figures",
];

const initialTransaction: ManualTransactionDraft = {
  date: "",
  description: "",
  category: "sales",
  amount: "",
  type: "income" as const,
};

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

function formatCompactNaira(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  const asCompact = (divisor: number, suffix: "K" | "M" | "B") =>
    `${sign}${(abs / divisor).toFixed(abs / divisor >= 100 ? 0 : 1).replace(/\.0$/, "")}${suffix}`;

  if (abs >= 1_000_000_000) return asCompact(1_000_000_000, "B");
  if (abs >= 1_000_000) return asCompact(1_000_000, "M");
  if (abs >= 1_000) return asCompact(1_000, "K");
  return `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
}

function formatFullNaira(value: number): string {
  return `₦${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function toMonthKey(value?: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatHeadlineMonthLabel(monthKey: string): string {
  if (!monthKey) return "Selected month";
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return monthKey;
  const parsed = new Date(`${match[1]}-${match[2]}-01T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return monthKey;
  return parsed.toLocaleDateString("en-NG", { month: "short", year: "numeric" });
}

type EntrySignatureLineInput = {
  accountCode?: string;
  debit?: number | string;
  credit?: number | string;
};

type AgentPreviewDetail = {
  entryId?: string;
  date?: string;
  narration?: string;
  lines?: Array<{ accountCode: string; debit: number; credit: number }>;
};

const normalizeSignatureAmount = (value: number | string | undefined): number => {
  const numeric = typeof value === "string" ? parseFloat(value) : Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(Math.abs(numeric) * 100) / 100;
};

const normalizeEntrySignatureLines = (lines: EntrySignatureLineInput[]) =>
  lines
    .map((line) => ({
      accountCode: String(line.accountCode || "").trim(),
      debit: normalizeSignatureAmount(line.debit),
      credit: normalizeSignatureAmount(line.credit),
    }))
    .filter((line) => line.accountCode && (line.debit > 0 || line.credit > 0))
    .sort((a, b) => {
      if (a.accountCode !== b.accountCode) return a.accountCode.localeCompare(b.accountCode);
      if (a.debit !== b.debit) return a.debit - b.debit;
      return a.credit - b.credit;
    });

const buildEntrySignature = (
  date: string | undefined,
  narration: string | undefined,
  lines: EntrySignatureLineInput[]
): string | null => {
  const normalizedDate = String(date || "").trim();
  const normalizedNarration = String(narration || "").trim().toLowerCase();
  const normalizedLines = normalizeEntrySignatureLines(lines);
  if (!normalizedDate || !normalizedNarration || normalizedLines.length === 0) return null;
  return `${normalizedDate}|${normalizedNarration}|${JSON.stringify(normalizedLines)}`;
};

export default function AccountingPage() {
  const { theme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  // -- State for Documents & Automation --
  const [documents, setDocuments] = useState<DraftDocumentMeta[]>([]);
  const [transactions, setTransactions] = useState<RawTransaction[]>([]);
  const [manualTx, setManualTx] = useState<ManualTransactionDraft>(initialTransaction);
  const [generatedStatements, setGeneratedStatements] = useState<StatementDraft | null>(null);
  const [auditedPacket, setAuditedPacket] = useState<AuditedStatementPacket | null>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Drop ledgers, invoices or bank exports and I'll start preparing draft statements.",
      timestamp: Date.now(),
    },
  ]);
  const [composerInput, setComposerInput] = useState("");
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false);
  const workspaceScrollRestore = useRef<number | null>(null);
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus>("idle");
  const [selectedBank, setSelectedBank] = useState(BANK_PROVIDERS[0]);
  const [automationConfidence, setAutomationConfidence] = useState(0.82);
  const [automationActivity, setAutomationActivity] = useState<AutomationLogEntry[]>([
    {
      title: "Workspace ready",
      detail: "Connect a bank feed to start streaming journals automatically.",
      timestamp: "Awaiting action",
    },
  ]);
  const [isAutomationBusy, setIsAutomationBusy] = useState(false);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [accountingState, setAccountingState] = useState<AccountingState | null>(null);
  const fileUploadRef = useRef<HTMLInputElement | null>(null);
  const auditUploadRef = useRef<HTMLInputElement | null>(null);
  const manualFormRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const autoEditHandledRef = useRef<string | null>(null);
  const autoNewEntryHandledRef = useRef(false);

  // Post Entry Section State
  type PostEntryLine = { id: string; accountCode: string; accountName: string; debit: string; credit: string };
  const [showPostEntry, setShowPostEntry] = useState(false);
  const [postEntryNarration, setPostEntryNarration] = useState("");
  const [postEntryDate, setPostEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [postEntryLines, setPostEntryLines] = useState<PostEntryLine[]>([
    { id: "1", accountCode: "", accountName: "", debit: "", credit: "" },
    { id: "2", accountCode: "", accountName: "", debit: "", credit: "" },
  ]);
  const [postEntryError, setPostEntryError] = useState("");
  const [agentMirroredEntryId, setAgentMirroredEntryId] = useState<string | null>(null);
  const [agentMirroredSignature, setAgentMirroredSignature] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<{ isValid?: boolean; fixed?: boolean; reasoning?: string; suggestedCorrections?: { lines: Array<{ accountCode: string; accountName: string; debit: number; credit: number }> } } | null>(null);


  // Edit Entry Section State
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [showEditEntry, setShowEditEntry] = useState(false);
  const [editEntryNarration, setEditEntryNarration] = useState("");
  const [editEntryDate, setEditEntryDate] = useState("");
  type EditEntryLine = { id: string; accountCode: string; accountName: string; debit: string; credit: string };
  const [editEntryLines, setEditEntryLines] = useState<EditEntryLine[]>([]);
  const [editEntryError, setEditEntryError] = useState("");
  const [cashHeadlineSection, setCashHeadlineSection] = useState<CashHeadlineSection>("cashBook");
  const [cashHeadlineMetricIndexBySection, setCashHeadlineMetricIndexBySection] =
    useState<Record<CashHeadlineSection, number>>(INITIAL_CASH_HEADLINE_METRIC_INDEX);
  const [cashHeadlineMonth, setCashHeadlineMonth] = useState(getCurrentMonthKey);
  const [isCashDatePickerOpen, setIsCashDatePickerOpen] = useState(false);
  const cashDatePickerRef = useRef<HTMLDivElement | null>(null);

  const cloneAccountingState = useCallback((next: AccountingState): AccountingState => ({
    ...next,
    journalEntries: [...next.journalEntries],
    customAccounts: [...next.customAccounts],
    ledgerAccounts: new Map(next.ledgerAccounts),
  }), []);

  const syncAccountingState = useCallback((next: AccountingState) => {
    const cloned = cloneAccountingState(next);
    setAccountingState(cloned);
    setJournalEntries(cloned.journalEntries);
  }, [cloneAccountingState]);







  const customAccounts = accountingState?.customAccounts || [];

  // Combine all accounts for selection
  const allAccountsForSelect = useMemo(() => {
    const standard = CHART_OF_ACCOUNTS.map((acc) => ({
      code: acc.code,
      name: acc.name,
      class: acc.class,
    }));
    const custom = customAccounts.map((acc: CustomAccount) => ({
      code: acc.code,
      name: acc.name,
      class: acc.class,
    }));
    return [...standard, ...custom].sort((a, b) => a.code.localeCompare(b.code));
  }, [customAccounts]);

  // Calculate post entry totals
  const postEntryTotals = useMemo(() => {
    const totalDebit = postEntryLines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
    const totalCredit = postEntryLines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
    return { totalDebit, totalCredit, isBalanced };
  }, [postEntryLines]);

  const currentPostEntrySignature = useMemo(
    () => buildEntrySignature(postEntryDate, postEntryNarration, postEntryLines),
    [postEntryDate, postEntryNarration, postEntryLines]
  );

  const postedEntryIds = useMemo(
    () => new Set(journalEntries.filter((entry) => entry.status === "posted").map((entry) => entry.id)),
    [journalEntries]
  );

  const isAgentMirroredAlreadyPosted = useMemo(() => {
    if (!agentMirroredEntryId || !agentMirroredSignature || !currentPostEntrySignature) return false;
    if (agentMirroredSignature !== currentPostEntrySignature) return false;
    if (postEntryNarration.trim().length === 0) return false;
    if (postedEntryIds.has(agentMirroredEntryId)) return true;
    return accountingEngine
      .getState()
      .journalEntries.some((entry) => entry.id === agentMirroredEntryId && entry.status === "posted");
  }, [
    agentMirroredEntryId,
    agentMirroredSignature,
    currentPostEntrySignature,
    postEntryNarration,
    postedEntryIds,
  ]);

  // Calculate edit entry totals
  const editEntryTotals = useMemo(() => {
    const totalDebit = editEntryLines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
    const totalCredit = editEntryLines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
    return { totalDebit, totalCredit, isBalanced };
  }, [editEntryLines]);

  const handleAIAudit = async () => {
    if (!postEntryNarration) {
      setPostEntryError("Please enter a narration first.");
      return;
    }

    setIsAuditing(true);
    setAuditResult(null);
    setPostEntryError("");

    try {
      const entryDraft = {
        date: postEntryDate,
        dateCreated: new Date().toISOString(),
        narration: postEntryNarration,
        // Map UI lines to JournalEntry lines
        lines: postEntryLines
          .filter(l => l.accountCode)
          .map(l => ({
            accountCode: l.accountCode,
            accountName: allAccountsForSelect.find(a => a.code === l.accountCode)?.name || "",
            debit: parseFloat(l.debit) || 0,
            credit: parseFloat(l.credit) || 0,
          }))
      };

      const res = await fetch("/api/ai/audit-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry: entryDraft,
          description: postEntryNarration
        })
      });

      const result = await res.json();
      setAuditResult(result);

      if (!result.isValid) {
        // Auto-expand checks if invalid
      }

    } catch (err) {
      console.error(err);
      setPostEntryError("AI Audit failed. Please try again.");
    } finally {
      setIsAuditing(false);
    }
  };

  const applyAISuggestion = () => {
    if (auditResult && auditResult.suggestedCorrections) {
      // Map back to UI lines
      const newLines = auditResult.suggestedCorrections.lines.map((l: { accountCode: string; accountName: string; debit: number; credit: number }, idx: number) => ({
        id: Date.now().toString() + idx,
        accountCode: l.accountCode,
        accountName: l.accountName,
        debit: l.debit > 0 ? l.debit.toString() : "",
        credit: l.credit > 0 ? l.credit.toString() : ""
      }));
      setPostEntryLines(newLines);
      setAuditResult({ ...auditResult, isValid: true, fixed: true }); // Mark as fixed
    }
  };


  // Auto-expand textarea as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 24), 150);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [composerInput]);

  const workspaceFiles = useMemo(() => deriveWorkspaceFiles(transactions), [transactions]);
  const automationConfidencePercent = useMemo(() => Math.round(automationConfidence * 100), [automationConfidence]);

  // Subscribe to accounting engine and load persisted state
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Defer heavy localStorage load to allow page to render first
    const loadEngine = () => {
      accountingEngine.load();
      syncAccountingState(accountingEngine.getState());
    };

    // Use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(loadEngine);
    } else {
      setTimeout(loadEngine, 0);
    }

    // Subscribe to updates from the engine
    const unsubscribe = accountingEngine.subscribe((state) => {
      syncAccountingState(state);
    });

    // Listen for custom accounting-update events (from chat transactions)
    const handleAccountingUpdate = () => {
      console.log("[Accounting Page] Received accounting-update event, refreshing state...");
      accountingEngine.load(); // Reload from localStorage to get latest data
      const state = accountingEngine.getState();
      syncAccountingState(state);

      // Also regenerate financial statements
      const statements = accountingEngine.generateStatements();
      setGeneratedStatements(statements);
      console.log("[Accounting Page] Statements regenerated:", statements);
    };
    window.addEventListener("accounting-update", handleAccountingUpdate);

    const handleAgentPreview = (event: Event) => {
      const customEvent = event as CustomEvent<AgentPreviewDetail>;
      const detail = customEvent.detail;
      if (!detail || !Array.isArray(detail.lines) || detail.lines.length === 0) return;

      const nextDate = detail.date || new Date().toISOString().split("T")[0];
      const nextNarration = String(detail.narration || "").trim();
      const nextLines: PostEntryLine[] = detail.lines.map((line, index) => ({
        id: String(index + 1),
        accountCode: line.accountCode || "",
        accountName: allAccountsForSelect.find((account) => account.code === line.accountCode)?.name || "",
        debit: line.debit > 0 ? String(line.debit) : "",
        credit: line.credit > 0 ? String(line.credit) : "",
      }));

      while (nextLines.length < 2) {
        nextLines.push({
          id: String(nextLines.length + 1),
          accountCode: "",
          accountName: "",
          debit: "",
          credit: "",
        });
      }

      setShowPostEntry(true);
      setPostEntryError("");
      setPostEntryDate(nextDate);
      setPostEntryNarration(nextNarration);
      setPostEntryLines(nextLines);
      const signature = buildEntrySignature(nextDate, nextNarration, nextLines);
      setAgentMirroredEntryId(detail.entryId || null);
      setAgentMirroredSignature(signature);
    };
    window.addEventListener("accounting-agent-preview", handleAgentPreview as EventListener);

    // Also listen for storage events for cross-tab sync
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === "insight::accounting-engine") {
        console.log("[Accounting Page] Storage event detected, reloading engine...");
        accountingEngine.load();
        handleAccountingUpdate();
      }
    };
    window.addEventListener("storage", handleStorageEvent);

    return () => {
      unsubscribe();
      window.removeEventListener("accounting-update", handleAccountingUpdate);
      window.removeEventListener("storage", handleStorageEvent);
      window.removeEventListener("accounting-agent-preview", handleAgentPreview as EventListener);
    };
  }, [allAccountsForSelect, syncAccountingState]);

  useEffect(() => {
    if (!agentMirroredSignature || !currentPostEntrySignature) return;
    if (agentMirroredSignature !== currentPostEntrySignature) {
      setAgentMirroredEntryId(null);
      setAgentMirroredSignature(null);
    }
  }, [agentMirroredSignature, currentPostEntrySignature]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTransactions = window.localStorage.getItem("insight::accounting-transactions");
    if (savedTransactions) {
      try {
        const parsed = JSON.parse(savedTransactions);
        if (Array.isArray(parsed)) {
          setTransactions(parsed);
        }
      } catch {
        // ignore malformed cache
      }
    }
    const savedConfidence = window.localStorage.getItem("insight::automation-confidence");
    if (savedConfidence) {
      const numeric = parseFloat(savedConfidence);
      if (!Number.isNaN(numeric)) {
        setAutomationConfidence(numeric);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("insight::accounting-transactions", JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("insight::automation-confidence", automationConfidence.toString());
  }, [automationConfidence]);

  useEffect(() => {
    if (transactions.length > 0 && automationStatus === "idle") {
      setAutomationStatus("live");
    }
  }, [transactions.length, automationStatus]);

  useEffect(() => {
    if (workspaceScrollRestore.current !== null && typeof window !== "undefined") {
      window.scrollTo({ top: workspaceScrollRestore.current });
      workspaceScrollRestore.current = null;
    }
  }, [isWorkspaceCollapsed]);

  const pushAutomationActivity = (title: string, detail: string) => {
    const timestamp = new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
    setAutomationActivity((prev) => [{ title, detail, timestamp }, ...prev].slice(0, 4));
  };

  const handleAutomationPrompt = (prompt: string) => {
    appendMessage("user", prompt);
    appendMessage(
      "assistant",
      `Working on "${prompt}". I'll tag the journal entries and update the workspace cards for you.`,
    );
    pushAutomationActivity("Prompt queued", `Agent is handling: ${prompt}`);
  };

  const connectBankFeed = async () => {
    setIsAutomationBusy(true);
    setAutomationStatus("connecting");
    pushAutomationActivity("Connecting feed", `Authorising ${selectedBank}...`);
    appendMessage("assistant", `🔌 Connecting securely to ${selectedBank}...`);
    try {
      const update = await mockAutomationClient.connectBank(selectedBank);
      setAutomationStatus(update.status);
      pushAutomationActivity("Bank linked", update.message);
      appendMessage("assistant", `🤝 ${update.message}`);
    } finally {
      setIsAutomationBusy(false);
    }
  };

  const triggerAutomationSync = async () => {
    setIsAutomationBusy(true);
    setAutomationStatus("syncing");
    pushAutomationActivity("Syncing entries", "Streaming latest 24h from your bank feed.");
    appendMessage("assistant", `📡 Streaming the latest data from ${selectedBank}...`);
    try {
      const update = await mockAutomationClient.runSync(transactions, selectedBank);
      if (update.generatedTransactions?.length) {
        setTransactions((prev) => [...prev, ...update.generatedTransactions!]);
      }
      setAutomationStatus(update.status);
      setAutomationConfidence((prev) => Math.min(0.99, prev + 0.03));
      pushAutomationActivity("New journals", update.message);
      appendMessage("assistant", `✅ ${update.message} Feel free to edit or reclassify any of them right here.`);
    } finally {
      setIsAutomationBusy(false);
    }
  };

  const appendMessage = (role: "user" | "assistant", content: string) => {
    setMessages((prev) => [...prev, { role, content, timestamp: Date.now() }]);
  };

  const handleSendMessage = async () => {
    const trimmed = composerInput.trim();
    if (!trimmed) return;
    appendMessage("user", trimmed);
    setComposerInput("");
    setIsWorkspaceCollapsed(true);

    try {
      const conversation: AgentConversationMessage[] = [...messages, { role: "user" as const, content: trimmed }]
        .slice(-12)
        .map((item) => ({
          role: item.role === "assistant" ? "assistant" : "user",
          content: item.content,
        }));
      const result = await runUnifiedAgentMessage({
        message: trimmed,
        module: "accounting",
        route: "/accounting",
        conversation,
      });
      appendMessage("assistant", result.finalReply);
      const successfulActions = result.execution.filter((item) => item.success);
      const failedActions = result.execution.filter((item) => !item.success);
      const hasEffectfulAccountingChange = successfulActions.some(
        (item) =>
          item.type === "accounting.postTransaction" ||
          item.type === "tax.recordTransaction" ||
          item.type === "tax.runComputation" ||
          item.type === "tax.generateSchedule" ||
          item.type === "tax.applyClassificationRules"
      );

      if (hasEffectfulAccountingChange) {
        accountingEngine.load();
        syncAccountingState(accountingEngine.getState());
      }

      const engineStatements = accountingEngine.generateStatements();
      setGeneratedStatements(engineStatements);

      if (successfulActions.length > 0) {
        pushAutomationActivity(
          "Agent execution",
          `${successfulActions.length} action(s) applied${failedActions.length > 0 ? `, ${failedActions.length} failed` : ""}.`
        );
      } else {
        pushAutomationActivity(
          "Agent execution",
          failedActions.length > 0
            ? `No data changes applied (${failedActions.length} action failure${failedActions.length > 1 ? "s" : ""}).`
            : "No data changes applied."
        );
      }

      if (failedActions.length > 0) {
        const failurePreview = failedActions
          .slice(0, 2)
          .map((item) => `${item.type}: ${item.message}`)
          .join("\n");
        appendMessage(
          "assistant",
          `Execution report:\n${failurePreview}`
        );
      }

      if (result.navigateTo && result.navigateTo !== "/accounting") {
        router.push(result.navigateTo);
      }
      return;
    } catch {
      // Fallback to the existing local + AI validation flow below.
    }

    // First, try local parsing for immediate feedback
    const localParsed = parseTransactionFromChat(trimmed);

    // If we have an amount, try AI validation
    if (localParsed && localParsed.amount && localParsed.amount > 0) {
      try {
        // Call AI validation API with 90-second timeout (Gemini AI takes 30-60 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);

        const response = await fetch('/api/accounting/validate-transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionText: trimmed,
            amount: localParsed.amount
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.result) {
          const aiResult = data.result;

          // Map parsedType to transaction type
          const typeMap: Record<string, "income" | "expense" | "asset" | "liability" | "equity"> = {
            'sale': 'income',
            'receipt': 'income',
            'purchase': 'expense',
            'expense': 'expense',
            'payment': 'liability',
            'transfer': 'asset',
            'asset': 'asset',
            'equity': 'equity',
            'loan': 'liability',
            'refund_from_supplier': 'liability',
            'other': 'expense',
          };

          const transactionType = typeMap[aiResult.parsedType] || 'expense';

          const newTransaction: RawTransaction = {
            id: `chat-ai-${Date.now()}`,
            date: new Date().toISOString().split("T")[0],
            description: aiResult.description || trimmed.substring(0, 150),
            category: aiResult.category || "other",
            amount: aiResult.amount,
            type: transactionType,
          };

          // Show AI validation info
          const aiStatusIcon = aiResult.aiCorrected ? "🤖✓" : "✓";
          const confidenceText = aiResult.confidence >= 0.9 ? `${aiStatusIcon} AI High confidence` :
            aiResult.confidence >= 0.7 ? `${aiStatusIcon} AI Medium confidence` : `⚠️ Low confidence`;

          // Show account info - USE AI-CORRECTED ACCOUNTS
          const debitAccount = aiResult.debitAccount;
          const creditAccount = aiResult.creditAccount;
          const accountInfo = debitAccount && creditAccount ?
            `\n📘 **DR ${debitAccount.code}** ${debitAccount.name}\n📕 **CR ${creditAccount.code}** ${creditAccount.name}` : '';

          if (!debitAccount || !creditAccount) {
            appendMessage(
              "assistant",
              `I could not safely determine both accounts for this transaction. ${confidenceText}. Please use manual posting for this one.`,
            );
            return;
          }

          // Show AI corrections if any
          const correctionInfo = aiResult.aiCorrected ?
            `\n\n🤖 _AI Correction Applied: ${aiResult.aiReasoning}_` : '';

          // Show tax implications if any
          const taxInfo = [];
          if (aiResult.taxImplications?.outputVAT > 0) taxInfo.push(`VAT: ₦${aiResult.taxImplications.outputVAT.toLocaleString()}`);
          if (aiResult.taxImplications?.wht > 0) taxInfo.push(`WHT: ₦${aiResult.taxImplications.wht.toLocaleString()}`);
          if (aiResult.taxImplications?.paye > 0) taxInfo.push(`PAYE: ₦${aiResult.taxImplications.paye.toLocaleString()}`);
          if (aiResult.taxImplications?.cgt > 0) taxInfo.push(`CGT: ₦${aiResult.taxImplications.cgt.toLocaleString()}`);
          const taxLine = taxInfo.length > 0 ? `\n💰 Tax: ${taxInfo.join(' | ')}` : '';

          const requiresManualReview =
            debitAccount.code === creditAccount.code ||
            ((aiResult.confidence || 0) < 0.7 && aiResult.aiValidated !== true);

          if (requiresManualReview) {
            appendMessage(
              "assistant",
              `⚠️ I parsed this transaction but it needs review before posting.${accountInfo}${taxLine}\n\nReason: low confidence or conflicting accounts.`,
            );
            return;
          }

          try {
            // USE AI-VALIDATED ACCOUNTS - not local backtesting
            const result = accountingEngine.processTransactionWithAIAccounts(
              newTransaction,
              {
                debitCode: debitAccount.code,
                debitName: debitAccount.name,
                creditCode: creditAccount.code,
                creditName: creditAccount.name,
                confidence: aiResult.confidence,
                reasoning: aiResult.aiReasoning,
                parsedType: aiResult.parsedType,
                taxImplications: aiResult.taxImplications,
              }
            );
            setTransactions((prev) => [...prev, newTransaction]);

            // Enhanced response with AI-CORRECTED account info
            const enhancedResponse = `${result.chatResponse}${taxLine}${correctionInfo}\n\n_${confidenceText} (${aiResult.processingTimeMs}ms)_`;
            appendMessage("assistant", enhancedResponse);
            pushAutomationActivity("AI-Validated Journal", `Parsed and posted: ${result.journalEntry.id}`);

            // Auto-update statements
            const engineStatements = accountingEngine.generateStatements();
            setGeneratedStatements(engineStatements);
          } catch (postError) {
            console.error('[AI Processing] Error posting journal:', postError);
            appendMessage(
              "assistant",
              `I detected a ${aiResult.parsedType} transaction (₦${aiResult.amount.toLocaleString()}).${accountInfo}${taxLine}\n\n${confidenceText}.\n\nUse the manual form above for full control, or I can journal it with assumptions.`,
            );
          }
        } else {
          // AI validation didn't return a result, fall back to local parsing
          throw new Error('No AI result');
        }
      } catch (aiError) {
        console.log('[AI Validation] Falling back to local parsing:', aiError);

        // Fall back to original local parsing logic
        const typeMap: Record<string, "income" | "expense" | "asset" | "liability" | "equity"> = {
          'sale': 'income',
          'receipt': 'income',
          'purchase': 'expense',
          'expense': 'expense',
          'payment': 'liability',
          'transfer': 'asset',
          'asset': 'asset',
          'equity': 'equity',
          'loan': 'liability',
          'other': 'expense',
        };

        const categoryToType: Record<string, "income" | "expense" | "asset" | "liability" | "equity"> = {
          'sales': 'income',
          'service': 'income',
          'receipt': 'income',
          'purchases': 'expense',
          'rent': 'expense',
          'salary': 'expense',
          'utilities': 'expense',
          'transport': 'expense',
          'expense': 'expense',
          'asset': 'asset',
          'capital': 'equity',
          'drawing': 'equity',
          'loan-received': 'liability',
          'loan-repayment': 'liability',
          'supplier-payment': 'liability',
          'payment': 'liability',
          'transfer': 'asset',
        };

        const transactionType = categoryToType[localParsed.category || ''] || typeMap[localParsed.parsedType] || 'expense';

        const newTransaction: RawTransaction = {
          id: `chat-${Date.now()}`,
          date: new Date().toISOString().split("T")[0],
          description: localParsed.description || trimmed.substring(0, 150),
          category: localParsed.category || "other",
          amount: localParsed.amount,
          type: transactionType,
        };

        const confidenceText = localParsed.confidence >= 0.9 ? "✓ High confidence" :
          localParsed.confidence >= 0.7 ? "⚡ Medium confidence" : "⚠️ Low confidence";

        try {
          const result = accountingEngine.processTransaction(newTransaction);
          setTransactions((prev) => [...prev, newTransaction]);

          const enhancedResponse = `${result.chatResponse}\n\n_${confidenceText} (${localParsed.parsedType} detected - local only)_`;
          appendMessage("assistant", enhancedResponse);
          pushAutomationActivity("Chat journal", `Parsed and posted: ${result.journalEntry.id}`);

          const engineStatements = accountingEngine.generateStatements();
          setGeneratedStatements(engineStatements);
        } catch {
          appendMessage(
            "assistant",
            `I detected a ${localParsed.parsedType} transaction (₦${localParsed.amount.toLocaleString()}). ${confidenceText}.\n\nUse the manual form above for full control, or I can journal it with assumptions.`,
          );
        }
      }
    } else {
      // General chat message
      appendMessage(
        "assistant",
        "Noted. Use the + menu to upload evidence or trigger automations while I prepare the books.",
      );
    }
  };

  const handleDocumentUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const list = Array.from(files).map((file) => ({
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      status: "processed" as const,
    }));
    setDocuments((prev) => [...prev, ...list]);

    const newTransactions = buildTransactionsFromFiles(Array.from(files));
    setTransactions((prev) => [...prev, ...newTransactions]);
    setStatus(`Extracted ${newTransactions.length} transactions from uploads.`);
    appendMessage(
      "assistant",
      `📎 Processed ${files.length} document(s) and extracted ${newTransactions.length} transactions. Ready for draft generation.`,
    );
    setIsActionMenuOpen(false);
  };

  const handleManualTransactionAdd = () => {
    if (!manualTx.date || !manualTx.description || !manualTx.amount) {
      setError("Please provide date, description, and amount for the transaction.");
      return;
    }
    const amount = parseFloat(manualTx.amount);
    if (isNaN(amount)) {
      setError("Invalid amount");
      return;
    }

    const newTransaction: RawTransaction = {
      id: `manual-${Date.now()}`,
      date: manualTx.date,
      description: manualTx.description,
      category: manualTx.category,
      amount,
      type: manualTx.type,
    };

    // Process through the accounting engine for proper double-entry
    try {
      const result = accountingEngine.processTransaction(newTransaction);
      setTransactions((prev) => [...prev, newTransaction]);
      setManualTx(initialTransaction);
      setError(null);

      // Show the journal entry in chat
      appendMessage("assistant", result.chatResponse);

      // Update automation activity
      pushAutomationActivity(
        "Journal posted",
        `${result.journalEntry.id}: ${newTransaction.description}`
      );

      // Auto-update statements from engine
      const engineStatements = accountingEngine.generateStatements();
      setGeneratedStatements(engineStatements);
    } catch (err) {
      // Fallback to simple recording if engine fails
      setTransactions((prev) => [...prev, newTransaction]);
      setManualTx(initialTransaction);
      setError(null);
      appendMessage(
        "assistant",
        `Journaled ${newTransaction.description} (${newTransaction.category}) for ₦${Math.abs(amount).toLocaleString()}.`,
      );
    }
  };

  const handleGenerateStatements = () => {
    if (transactions.length === 0) {
      setError("Upload or add at least one transaction before generating statements.");
      return;
    }
    const draft = generateStatementDraft(transactions);
    setGeneratedStatements(draft);
    setStatus("Draft statements generated. Awaiting audit upload.");
    setError(null);
    appendMessage(
      "assistant",
      `📊 Draft ready — Net income ₦${draft.netIncome.toLocaleString()}, Assets ₦${draft.assets.toLocaleString()}, Liabilities ₦${draft.liabilities.toLocaleString()}. Upload the audit pack when it lands.`,
    );
  };

  const handleAuditedUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const fallback = generatedStatements || generateStatementDraft(transactions);
    setAuditedPacket({
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
      auditorName: "External Auditor",
      notes: "Auto-tagged demo upload",
      figures: fallback,
    });
    setStatus(`Audited statement ${file.name} ready for tax handoff.`);
    appendMessage("assistant", `🧾 Audited pack "${file.name}" attached. Queue it for the tax computation when ready.`);
    setIsActionMenuOpen(false);
  };

  const handleSendToTaxCalculator = () => {
    if (!auditedPacket) {
      setError("Upload audited statements before exporting to tax.");
      return;
    }
    const payload = statementToTaxDraft(auditedPacket.figures);
    if (typeof window !== "undefined") {
      localStorage.setItem("insight::accounting-draft", JSON.stringify(payload));
    }
    setStatus("Audited figures queued. Open the main calculator to import draft values.");
    setError(null);
    appendMessage(
      "assistant",
      "✅ Audited figures queued for the tax engine. Accept the import prompt on the main calculator dashboard.",
    );
    setIsActionMenuOpen(false);
  };

  const statementCards = generatedStatements || auditedPacket?.figures;

  const automationPrimaryAction = automationStatus === "idle" ? connectBankFeed : triggerAutomationSync;
  const automationPrimaryLabel = automationStatus === "idle" ? "Connect bank feed" : "Sync latest data";
  const automationStatusThemes: Record<AutomationStatus, string> = {
    idle: "bg-slate-100 text-slate-700",
    connecting: "bg-amber-100 text-amber-700",
    syncing: "bg-blue-100 text-blue-700",
    live: "bg-emerald-100 text-emerald-700",
  };

  const scrollToJournal = () => {
    manualFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setIsActionMenuOpen(false);
  };

  // Post Entry handlers
  const handlePostEntry = () => {
    setPostEntryError("");
    if (!postEntryNarration.trim()) {
      setPostEntryError("Please enter a narration");
      return;
    }
    if (!postEntryTotals.isBalanced) {
      setPostEntryError("Entry must be balanced (Total DR = Total CR)");
      return;
    }
    const signature = buildEntrySignature(postEntryDate, postEntryNarration, postEntryLines);
    const alreadyPostedByAgent =
      Boolean(agentMirroredEntryId) &&
      Boolean(agentMirroredSignature) &&
      Boolean(signature) &&
      signature === agentMirroredSignature &&
      accountingEngine
        .getState()
        .journalEntries.some((entry) => entry.id === agentMirroredEntryId && entry.status === "posted");

    if (isAgentMirroredAlreadyPosted || alreadyPostedByAgent) {
      setPostEntryError("This entry is already posted by the agent. Edit any field to post a new one.");
      return;
    }

    try {
      const entry = accountingEngine.postManualJournalEntry({
        narration: postEntryNarration,
        date: postEntryDate,
        lines: postEntryLines
          .filter((l) => l.accountCode && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
          .map((l) => ({
            accountCode: l.accountCode,
            accountName:
              l.accountName ||
              allAccountsForSelect.find((account) => account.code === l.accountCode)?.name ||
              l.accountCode,
            debit: parseFloat(l.debit) || 0,
            credit: parseFloat(l.credit) || 0,
          })),
      });

      // Ensure UI refreshes from a cloned engine snapshot immediately after posting.
      syncAccountingState(accountingEngine.getState());

      appendMessage("assistant", `✅ Posted journal entry ${entry.id}: ${postEntryNarration}`);
      pushAutomationActivity("Manual entry", `Posted: ${entry.id}`);

      // Reset form
      setShowPostEntry(false);
      setPostEntryNarration("");
      setPostEntryDate(new Date().toISOString().split("T")[0]);
      setPostEntryLines([
        { id: "1", accountCode: "", accountName: "", debit: "", credit: "" },
        { id: "2", accountCode: "", accountName: "", debit: "", credit: "" },
      ]);
      setAgentMirroredEntryId(null);
      setAgentMirroredSignature(null);
    } catch (err: unknown) {
      setPostEntryError(err instanceof Error ? err.message : "Failed to post entry");
    }
  };

  const addPostEntryLine = () => {
    setPostEntryLines((previous) => [
      ...previous,
      { id: Date.now().toString(), accountCode: "", accountName: "", debit: "", credit: "" },
    ]);
  };

  const updatePostEntryLine = (id: string, field: string, value: string) => {
    setPostEntryLines((previous) =>
      previous.map((l) => {
        if (l.id !== id) return l;
        if (field === "accountCode") {
          const account = allAccountsForSelect.find((a) => a.code === value);
          return { ...l, accountCode: value, accountName: account?.name || "" };
        }
        return { ...l, [field]: value };
      })
    );
  };

  const removePostEntryLine = (id: string) => {
    if (postEntryLines.length > 2) {
      setPostEntryLines((previous) => previous.filter((l) => l.id !== id));
    }
  };

  // Edit Entry handlers
  const openEditEntry = useCallback((entry: JournalEntry) => {
    setEditingEntryId(entry.id);
    setEditEntryNarration(entry.narration);
    setEditEntryDate(entry.date);
    setEditEntryLines(
      entry.lines.map((line, idx) => ({
        id: idx.toString(),
        accountCode: line.accountCode,
        accountName: line.accountName,
        debit: line.debit > 0 ? line.debit.toString() : "",
        credit: line.credit > 0 ? line.credit.toString() : "",
      }))
    );
    setEditEntryError("");
    setShowEditEntry(true);
  }, []);

  const beginEntryEdit = useCallback((entry: JournalEntry, resetToDraft = true) => {
    if (entry.status === "voided") {
      appendMessage("assistant", `⚠️ Entry ${entry.id} is voided and cannot be edited.`);
      return;
    }

    let targetEntry = entry;
    if (resetToDraft && entry.status === "posted") {
      try {
        const draftEntry = accountingEngine.resetJournalEntryToDraft(entry.id);
        const updatedState = accountingEngine.getState();
        syncAccountingState(updatedState);
        targetEntry = updatedState.journalEntries.find((j) => j.id === entry.id) || draftEntry;
        appendMessage("assistant", `📝 Entry ${entry.id} reset to draft. Update and save to repost.`);
        pushAutomationActivity("Entry reset to draft", `Draft: ${entry.id}`);
      } catch (err) {
        appendMessage("assistant", `❌ Failed to open ${entry.id} for edit: ${err instanceof Error ? err.message : "Unknown error"}`);
        return;
      }
    }

    openEditEntry(targetEntry);
  }, [appendMessage, openEditEntry, pushAutomationActivity, syncAccountingState]);

  const editEntryIdParam = searchParams.get("editEntry");
  const shouldResetDraftParam = searchParams.get("resetDraft") === "1";
  const shouldOpenNewEntryParam = searchParams.get("newEntry") === "1";

  useEffect(() => {
    if (!editEntryIdParam) {
      autoEditHandledRef.current = null;
      return;
    }

    const dedupeKey = `${editEntryIdParam}:${shouldResetDraftParam ? "1" : "0"}`;
    if (autoEditHandledRef.current === dedupeKey) {
      return;
    }

    const entry = journalEntries.find((j) => j.id === editEntryIdParam);
    if (!entry) {
      return;
    }

    autoEditHandledRef.current = dedupeKey;
    beginEntryEdit(entry, shouldResetDraftParam);
    router.replace("/accounting");
  }, [beginEntryEdit, editEntryIdParam, journalEntries, router, shouldResetDraftParam]);

  useEffect(() => {
    if (!shouldOpenNewEntryParam) {
      autoNewEntryHandledRef.current = false;
      return;
    }

    if (autoNewEntryHandledRef.current) {
      return;
    }

    autoNewEntryHandledRef.current = true;
    setAgentMirroredEntryId(null);
    setAgentMirroredSignature(null);
    setPostEntryError("");
    setShowPostEntry(true);
    router.replace("/accounting");
  }, [router, shouldOpenNewEntryParam]);

  const handleSaveEditEntry = () => {
    setEditEntryError("");
    if (!editEntryNarration.trim()) {
      setEditEntryError("Please enter a narration");
      return;
    }
    if (!editEntryTotals.isBalanced) {
      setEditEntryError("Entry must be balanced (Total DR = Total CR)");
      return;
    }
    if (!editingEntryId) {
      setEditEntryError("No entry selected for editing");
      return;
    }

    try {
      const updatedEntry = accountingEngine.updateJournalEntry(editingEntryId, {
        narration: editEntryNarration,
        date: editEntryDate,
        lines: editEntryLines
          .filter((l) => l.accountCode && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
          .map((l) => ({
            accountCode: l.accountCode,
            accountName: l.accountName,
            debit: parseFloat(l.debit) || 0,
            credit: parseFloat(l.credit) || 0,
          })),
      });

      appendMessage("assistant", `✅ Updated journal entry ${updatedEntry.id}: ${editEntryNarration}`);
      pushAutomationActivity("Entry updated", `Updated: ${updatedEntry.id}`);

      // Reset form and close modal
      setShowEditEntry(false);
      setEditingEntryId(null);
      setEditEntryNarration("");
      setEditEntryDate("");
      setEditEntryLines([]);
    } catch (err: unknown) {
      // If entry not found, refresh state and close modal
      if (err instanceof Error && err.message.includes("not found")) {
        const updatedState = accountingEngine.getState();
        syncAccountingState(updatedState);
        setShowEditEntry(false);
        setEditingEntryId(null);
        appendMessage("assistant", `ℹ️ Entry ${editingEntryId} no longer exists. View has been refreshed.`);
      } else {
        setEditEntryError(err instanceof Error ? err.message : "Failed to update entry");
      }
    }
  };

  const handleDeleteEntry = (entryId: string) => {
    console.log("[Delete] Attempting to delete entry:", entryId);

    if (!confirm("Are you sure you want to void this journal entry? This will reverse all related ledger entries and keep an audit trail.")) {
      console.log("[Delete] User cancelled");
      return;
    }

    try {
      console.log("[Delete] Calling deleteJournalEntry...");
      accountingEngine.deleteJournalEntry(entryId);
      console.log("[Delete] Entry deleted successfully, refreshing state...");

      // Force refresh state from engine after delete
      const updatedState = accountingEngine.getState();
      syncAccountingState(updatedState);

      appendMessage("assistant", `🧾 Voided journal entry ${entryId}`);
      pushAutomationActivity("Entry voided", `Voided: ${entryId}`);
      console.log("[Delete] State refreshed, entries count:", updatedState.journalEntries.length);
    } catch (err: unknown) {
      console.error("[Delete] Error:", err);

      // If entry not found, just refresh state to clean up stale entries
      if (err instanceof Error && err.message.includes("not found")) {
        console.log("[Delete] Entry not found - refreshing state to remove stale data");
        const updatedState = accountingEngine.getState();
        syncAccountingState(updatedState);
        appendMessage("assistant", `ℹ️ Entry ${entryId} was already removed or doesn't exist. Refreshed the view.`);
      } else {
        appendMessage("assistant", `❌ Failed to delete entry: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }
  };

  const addEditEntryLine = () => {
    setEditEntryLines((previous) => [
      ...previous,
      { id: Date.now().toString(), accountCode: "", accountName: "", debit: "", credit: "" },
    ]);
  };

  const updateEditEntryLine = (id: string, field: string, value: string) => {
    setEditEntryLines((previous) =>
      previous.map((l) => {
        if (l.id !== id) return l;
        if (field === "accountCode") {
          const account = allAccountsForSelect.find((a) => a.code === value);
          return { ...l, accountCode: value, accountName: account?.name || "" };
        }
        return { ...l, [field]: value };
      })
    );
  };

  const removeEditEntryLine = (id: string) => {
    if (editEntryLines.length > 2) {
      setEditEntryLines((previous) => previous.filter((l) => l.id !== id));
    }
  };

  const cashHeadlineTotals = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    let revenue = 0;
    let costOfSales = 0;
    let operatingExpenses = 0;
    let totalAssets = 0;
    let totalLiabilities = 0;
    let operatingCashflow = 0;
    let investingCashflow = 0;
    let financingCashflow = 0;
    let trialDebit = 0;
    let trialCredit = 0;

    const isCashAccount = (accountCode: string, accountName: string) =>
      accountCode.startsWith("10") || /cash|bank/i.test(accountName);

    accountingState?.journalEntries.forEach((entry) => {
      if (entry.status !== "posted") return;
      if (toMonthKey(entry.date) !== cashHeadlineMonth) return;

      const hasInvestingCounterpart = entry.lines.some(
        (line) => !isCashAccount(line.accountCode, line.accountName) && line.accountCode.startsWith("1")
      );
      const hasFinancingCounterpart = entry.lines.some(
        (line) =>
          !isCashAccount(line.accountCode, line.accountName) &&
          (line.accountCode.startsWith("2") || line.accountCode.startsWith("3"))
      );

      entry.lines.forEach((line) => {
        const debit = line.debit || 0;
        const credit = line.credit || 0;
        const accountCode = line.accountCode || "";
        const accountPrefix = accountCode.charAt(0);

        trialDebit += debit;
        trialCredit += credit;

        if (accountPrefix === "4") {
          revenue += credit - debit;
        } else if (accountCode.startsWith("50")) {
          costOfSales += debit - credit;
        } else if (accountPrefix === "5" || accountPrefix === "6" || accountPrefix === "7") {
          operatingExpenses += debit - credit;
        } else if (accountPrefix === "1") {
          totalAssets += debit - credit;
        } else if (accountPrefix === "2") {
          totalLiabilities += credit - debit;
        }

        if (!isCashAccount(accountCode, line.accountName)) return;

        inflow += debit;
        outflow += credit;

        const netCashMovement = debit - credit;
        if (hasInvestingCounterpart) {
          investingCashflow += netCashMovement;
        } else if (hasFinancingCounterpart) {
          financingCashflow += netCashMovement;
        } else {
          operatingCashflow += netCashMovement;
        }
      });
    });

    const netProfit = revenue - costOfSales - operatingExpenses;

    return {
      inflow,
      outflow,
      balance: inflow - outflow,
      revenue,
      costOfSales,
      netProfit,
      totalAssets,
      totalLiabilities,
      operatingCashflow,
      investingCashflow,
      financingCashflow,
      trialDebit,
      trialCredit,
      trialNetBalance: trialDebit - trialCredit,
    };
  }, [accountingState, cashHeadlineMonth]);

  const cashHeadlineMonthLabel = useMemo(
    () => formatHeadlineMonthLabel(cashHeadlineMonth),
    [cashHeadlineMonth]
  );

  const activeCashHeadlineSection = useMemo(
    () => CASH_HEADLINE_SECTION_CONFIGS.find((config) => config.key === cashHeadlineSection) || CASH_HEADLINE_SECTION_CONFIGS[0],
    [cashHeadlineSection]
  );

  const activeCashHeadlineMetric = useMemo(() => {
    const activeIndex = cashHeadlineMetricIndexBySection[cashHeadlineSection] ?? 0;
    return activeCashHeadlineSection.metrics[activeIndex] || activeCashHeadlineSection.metrics[0];
  }, [activeCashHeadlineSection, cashHeadlineMetricIndexBySection, cashHeadlineSection]);

  const cashHeadlineValueMap: Record<CashHeadlineMetric, number> = {
    inflow: cashHeadlineTotals.inflow,
    outflow: cashHeadlineTotals.outflow,
    balance: cashHeadlineTotals.balance,
    revenue: cashHeadlineTotals.revenue,
    costOfSales: cashHeadlineTotals.costOfSales,
    netProfit: cashHeadlineTotals.netProfit,
    totalAssets: cashHeadlineTotals.totalAssets,
    totalLiabilities: cashHeadlineTotals.totalLiabilities,
    operatingCashflow: cashHeadlineTotals.operatingCashflow,
    investingCashflow: cashHeadlineTotals.investingCashflow,
    financingCashflow: cashHeadlineTotals.financingCashflow,
    trialDebit: cashHeadlineTotals.trialDebit,
    trialCredit: cashHeadlineTotals.trialCredit,
    trialNetBalance: cashHeadlineTotals.trialNetBalance,
  };

  const cashHeadlineValue = cashHeadlineValueMap[activeCashHeadlineMetric.key];

  const cycleCashHeadlineMetric = useCallback(() => {
    setCashHeadlineMetricIndexBySection((previous) => {
      const activeConfig = CASH_HEADLINE_SECTION_CONFIGS.find((config) => config.key === cashHeadlineSection);
      if (!activeConfig) return previous;
      const currentIndex = previous[cashHeadlineSection] ?? 0;
      return {
        ...previous,
        [cashHeadlineSection]: (currentIndex + 1) % activeConfig.metrics.length,
      };
    });
  }, [cashHeadlineSection]);

  useEffect(() => {
    if (!isCashDatePickerOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!cashDatePickerRef.current) return;
      if (!cashDatePickerRef.current.contains(event.target as Node)) {
        setIsCashDatePickerOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsCashDatePickerOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isCashDatePickerOpen]);

  return (
    <>

      <div className="space-y-6 pb-20 md:pb-32">
        <section className="relative min-h-[75vh]">
          <div className="chat-feed flex flex-col min-h-[60vh]">
            <div className="flex-1 overflow-y-auto px-2 md:px-6 pt-4 md:pt-6 pb-24 md:pb-36 space-y-3 md:space-y-5">
              <div className="space-y-4">
                {/* Inflow Section */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={`text-xs font-medium mb-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      {activeCashHeadlineMetric.label}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold" style={{ color: "#2264ff" }} title={formatFullNaira(cashHeadlineValue)}>
                        ₦{formatCompactNaira(cashHeadlineValue)}
                      </p>
                      <div className="relative" ref={cashDatePickerRef}>
                        <button
                          type="button"
                          onClick={() => setIsCashDatePickerOpen((open) => !open)}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-sm font-normal ${theme === "dark" ? "border-gray-600 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-500 hover:bg-gray-50"}`}
                          aria-haspopup="dialog"
                          aria-expanded={isCashDatePickerOpen}
                          title={`Select month (currently ${cashHeadlineMonthLabel})`}
                        >
                          /mo
                          <svg viewBox="0 0 20 20" className={`h-3 w-3 transition-transform ${isCashDatePickerOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="m5 7 5 6 5-6" />
                          </svg>
                        </button>
                        {isCashDatePickerOpen ? (
                          <div className={`absolute left-0 z-20 mt-2 w-60 rounded-xl border p-3 shadow-lg ${theme === "dark" ? "border-gray-700 bg-gray-900" : "border-gray-200 bg-white"}`}>
                            <p className={`text-xs font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Select month</p>
                            <div className="-mx-0.5 mb-2 overflow-x-auto hide-scrollbar">
                              <div className="flex min-w-max gap-1.5 px-0.5">
                                {CASH_HEADLINE_SECTION_CONFIGS.map((section) => {
                                  const isActive = section.key === cashHeadlineSection;
                                  return (
                                    <button
                                      key={section.key}
                                      type="button"
                                      onClick={() => setCashHeadlineSection(section.key)}
                                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
                                        isActive
                                          ? "border-[#2264ff] bg-[#2264ff] text-white"
                                          : theme === "dark"
                                            ? "border-gray-700 text-gray-300 hover:bg-gray-800"
                                            : "border-gray-300 text-gray-600 hover:bg-gray-100"
                                      }`}
                                    >
                                      {section.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <input
                              type="month"
                              value={cashHeadlineMonth}
                              onChange={(event) => setCashHeadlineMonth(event.target.value || getCurrentMonthKey())}
                              className={`w-full rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#2264ff]/30 ${theme === "dark" ? "border-gray-700 bg-gray-800 text-gray-100" : "border-gray-300 bg-white text-gray-900"}`}
                            />
                            <div className="mt-3 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => setCashHeadlineMonth(getCurrentMonthKey())}
                                className={`text-xs font-medium ${theme === "dark" ? "text-blue-300 hover:text-blue-200" : "text-blue-600 hover:text-blue-700"}`}
                              >
                                This month
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsCashDatePickerOpen(false)}
                                className={`text-xs ${theme === "dark" ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700"}`}
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <p className={`mt-1 text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
                      For {cashHeadlineMonthLabel}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={cycleCashHeadlineMetric}
                    className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#2264ff] text-white shadow-sm transition hover:bg-[#1a50cc] focus:outline-none focus:ring-2 focus:ring-[#2264ff]/40"
                    aria-label={`Toggle ${activeCashHeadlineSection.label} metric`}
                    title={`Switch ${activeCashHeadlineSection.label} metrics`}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14" />
                      <path d="m13 6 6 6-6 6" />
                    </svg>
                  </button>
                </div>

                {/* Embedded Finance Products - Horizontal Scroll */}
                <div className="rounded-2xl overflow-hidden">
                  <div className="py-2">
                    <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Embedded Finance</h3>
                    <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Explore investment products</p>
                  </div>
                  <div className="-mx-2 overflow-x-auto hide-scrollbar snap-x snap-mandatory md:mx-0">
                    <div className="flex min-w-max gap-1 py-2 pr-2 md:px-2">
                      {/* Piggyvest */}
                      <a href="https://piggyvest.com" target="_blank" rel="noopener noreferrer" className="snap-start flex-shrink-0 flex flex-col items-center gap-2 p-3 group">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden">
                            <img src="/Piggyvest.png" alt="Piggyvest" className="w-16 h-16 object-cover rounded-full" />
                          </div>
                          {/* Verified badge */}
                          <div className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                        <div className="text-center">
                          <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Piggyvest</p>
                          <p className={`text-[10px] ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Save & Invest</p>
                          <p className="text-[10px] font-medium text-emerald-600">13.00% p.a.</p>
                        </div>
                      </a>

                      {/* Cowrywise */}
                      <a href="https://cowrywise.com" target="_blank" rel="noopener noreferrer" className="snap-start flex-shrink-0 flex flex-col items-center gap-2 p-3 group">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden">
                          <img src="/Cowrywise.png" alt="Cowrywise" className="w-16 h-16 object-cover rounded-full" />
                        </div>
                        <div className="text-center">
                          <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Cowrywise</p>
                          <p className={`text-[10px] ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Wealth Management</p>
                          <p className="text-[10px] font-medium text-emerald-600">15.00% p.a.</p>
                        </div>
                      </a>

                      {/* Risevest */}
                      <a href="https://risevest.com" target="_blank" rel="noopener noreferrer" className="snap-start flex-shrink-0 flex flex-col items-center gap-2 p-3 group">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden">
                          <img src="/Rise.png" alt="Risevest" className="w-16 h-16 object-cover rounded-full" />
                        </div>
                        <div className="text-center">
                          <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Risevest</p>
                          <p className={`text-[10px] ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Dollar Investments</p>
                          <p className="text-[10px] font-medium text-emerald-600">12.00% p.a.</p>
                        </div>
                      </a>

                      {/* Bamboo */}
                      <a href="https://investbamboo.com" target="_blank" rel="noopener noreferrer" className="snap-start flex-shrink-0 flex flex-col items-center gap-2 p-3 group">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden">
                          <img src="/Bamboo.png" alt="Bamboo" className="w-16 h-16 object-cover rounded-full" />
                        </div>
                        <div className="text-center">
                          <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Bamboo</p>
                          <p className={`text-[10px] ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>US Stocks</p>
                        </div>
                      </a>

                      {/* Kuda */}
                      <a href="https://kuda.com" target="_blank" rel="noopener noreferrer" className="snap-start flex-shrink-0 flex flex-col items-center gap-2 p-3 group">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden">
                          <img src="/Kuda.png" alt="Kuda" className="w-16 h-16 object-cover rounded-full" />
                        </div>
                        <div className="text-center">
                          <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Kuda</p>
                          <p className={`text-[10px] ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Digital Banking</p>
                          <p className="text-[10px] font-medium text-emerald-600">4.00% p.a.</p>
                        </div>
                      </a>

                      {/* FairMoney */}
                      <a href="https://fairmoney.io" target="_blank" rel="noopener noreferrer" className="snap-start flex-shrink-0 flex flex-col items-center gap-2 p-3 group">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden">
                          <img src="/fairmoney.png" alt="FairMoney" className="w-16 h-16 object-cover rounded-full" />
                        </div>
                        <div className="text-center">
                          <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>FairMoney</p>
                          <p className={`text-[10px] ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Quick Loans</p>
                        </div>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Action Buttons Grid - 2 columns on desktop */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Post Journal Entry Button */}
                  <button
                    onClick={() => {
                      setAgentMirroredEntryId(null);
                      setAgentMirroredSignature(null);
                      setPostEntryError("");
                      setShowPostEntry(true);
                    }}
                    data-agent-target="open-post-journal-entry"
                    className={`
                      w-full rounded-2xl border transition-all p-5 group
                      ${theme === 'dark'
                        ? 'border-gray-600 bg-[#0a0a0a] hover:bg-[#1a1a1a] hover:border-gray-500'
                        : 'border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400'
                      } flex items-center justify-center gap-3
                    `}
                  >
                    <div className={`
                      w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0
                      ${theme === 'dark'
                        ? 'bg-gray-700 group-hover:bg-gray-600'
                        : 'bg-purple-100 group-hover:bg-purple-200'
                      }
                    `}>
                      <svg
                        className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-300' : 'text-purple-600'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        Post Journal Entry
                      </h3>
                      <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                        Manual double-entry with DR/CR columns
                      </p>
                    </div>
                  </button>

                  {/* Bank Reconciliation Button */}
                  <Link
                    href="/accounting/reconciliation"
                    className={`
                      w-full rounded-2xl border transition-all p-5 group
                      ${theme === 'dark'
                        ? 'border-gray-600 bg-[#0a0a0a] hover:bg-[#1a1a1a] hover:border-gray-500'
                        : 'border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400'
                      } flex items-center justify-center gap-3
                    `}
                  >
                    <div className={`
                      w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0
                      ${theme === 'dark'
                        ? 'bg-gray-700 group-hover:bg-gray-600'
                        : 'bg-blue-100 group-hover:bg-blue-200'
                      }
                    `}>
                      <svg
                        className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-300' : 'text-blue-600'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        Bank Reconciliation
                      </h3>
                      <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                        Match bank statements with ledger entries
                      </p>
                    </div>
                  </Link>
                </div>

                {/* Connect Sales POS Section */}


                {/* Transactions Section */}


                {/* Journal Entries Section - Double Entry View */}
                {journalEntries.length > 0 && (
                  <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                    <div className="px-3 md:px-5 py-2 md:py-4 border-b border-gray-100 bg-gray-50/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">Journal Entries</h3>
                            <p className="text-xs text-gray-500">{journalEntries.length} entries • Double-entry ledger</p>
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
                          {journalEntries.slice(-200).reverse().map((entry) => {
                            const total = entry.totalDebits || entry.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
                            const partner = entry.reference || "—";
                            const journalLabel = getContextJournalLabel(entry);
                            return (
                              <tr
                                key={entry.id}
                                onClick={() => beginEntryEdit(entry, true)}
                                className={`hover:bg-gray-50/70 transition-colors ${entry.status === "voided" ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                              >
                                <td className="px-2 py-3 text-sm text-gray-700 whitespace-nowrap">{entry.date}</td>
                                <td className="px-2 py-3 text-sm font-mono text-purple-700 whitespace-nowrap">{entry.id}</td>
                                <td className="px-2 py-3 text-sm text-gray-600 whitespace-nowrap">{partner}</td>
                                <td className="px-2 py-3 text-sm text-gray-700 max-w-[340px]">
                                  <p className="truncate" title={entry.narration}>{entry.narration}</p>
                                </td>
                                <td className="px-2 py-3 text-sm text-gray-700 whitespace-nowrap">{journalLabel}</td>
                                <td className="px-2 py-3 text-sm text-right font-mono text-gray-900 whitespace-nowrap">₦{total.toLocaleString()}</td>
                                <td className="px-2 py-3">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${entry.status === "voided"
                                      ? "bg-rose-100 text-rose-700"
                                      : entry.status === "draft"
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-emerald-100 text-emerald-700"
                                    }`}>
                                    {entry.status === "voided" ? "Voided" : entry.status === "draft" ? "Draft" : "Posted"}
                                  </span>
                                </td>
                                <td className="px-2 py-3">
                                  <div className="flex justify-end gap-1">
                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        beginEntryEdit(entry, true);
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                      title={entry.status === "voided" ? "Voided entries are read-only" : "Edit entry"}
                                      disabled={entry.status === "voided"}
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        if (entry.status !== "voided") {
                                          handleDeleteEntry(entry.id);
                                        }
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                      title={entry.status === "voided" ? "Entry already voided" : "Void entry"}
                                      disabled={entry.status === "voided"}
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
                    {journalEntries.length > 200 && (
                      <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 bg-gray-50/70">
                        Showing latest 200 entries. Open workspace for full historical view.
                      </div>
                    )}
                  </div>
                )}

                {/* Financial Statements Section removed as per user request */}

                {/* Audited Pack Section */}
                {auditedPacket && (
                  <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white overflow-hidden">
                    <div className="px-5 py-4 border-b border-emerald-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-emerald-900">Audited Statement Pack</h3>
                          <p className="text-xs text-emerald-600">Ready for tax computation handoff</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 space-y-2">
                          <p className="text-sm font-medium text-gray-900">{auditedPacket.fileName}</p>
                          <p className="text-xs text-gray-500">
                            Uploaded {new Date(auditedPacket.uploadedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-xs text-gray-500">Auditor: {auditedPacket.auditorName}</p>
                          {auditedPacket.notes && <p className="text-xs text-gray-400 italic">{auditedPacket.notes}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div >
        </section >
      </div >


      <input ref={fileUploadRef} type="file" multiple className="hidden" onChange={handleDocumentUpload} />
      <input ref={auditUploadRef} type="file" className="hidden" onChange={handleAuditedUpload} />

      {/* Post Journal Entry Modal */}
      {showPostEntry ? (
        <PostJournalEntryModal
          narration={postEntryNarration}
          date={postEntryDate}
          lines={postEntryLines}
          totals={postEntryTotals}
          error={postEntryError}
          isAuditing={isAuditing}
          auditResult={auditResult}
          allAccountsForSelect={allAccountsForSelect}
          isAgentMirroredAlreadyPosted={isAgentMirroredAlreadyPosted}
          agentMirroredEntryId={agentMirroredEntryId}
          onClose={() => setShowPostEntry(false)}
          onNarrationChange={setPostEntryNarration}
          onDateChange={setPostEntryDate}
          onAddLine={addPostEntryLine}
          onUpdateLine={updatePostEntryLine}
          onRemoveLine={removePostEntryLine}
          onAudit={handleAIAudit}
          onApplySuggestion={applyAISuggestion}
          onSubmit={handlePostEntry}
        />
      ) : null}

      {/* Edit Journal Entry Modal */}
      {showEditEntry ? (
        <EditJournalEntryModal
          entryId={editingEntryId}
          narration={editEntryNarration}
          date={editEntryDate}
          lines={editEntryLines}
          totals={editEntryTotals}
          error={editEntryError}
          allAccountsForSelect={allAccountsForSelect}
          onClose={() => setShowEditEntry(false)}
          onNarrationChange={setEditEntryNarration}
          onDateChange={setEditEntryDate}
          onAddLine={addEditEntryLine}
          onUpdateLine={updateEditEntryLine}
          onRemoveLine={removeEditEntryLine}
          onDelete={() => {
            if (editingEntryId) {
              handleDeleteEntry(editingEntryId);
            }
          }}
          onSave={handleSaveEditEntry}
        />
      ) : null}
    </>
  );
}
