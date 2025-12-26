"use client";

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  RawTransaction,
  StatementDraft,
  DraftDocumentMeta,
  AuditedStatementPacket,
  TransactionType,
} from "@/lib/accounting/types";
import { buildTransactionsFromFiles, generateStatementDraft, normaliseCategory } from "@/lib/accounting/statementEngine";
import { statementToTaxDraft } from "@/lib/accounting/taxBridge";
import { AutomationStatus, BANK_PROVIDERS, deriveWorkspaceFiles, mockAutomationClient } from "@/lib/accounting/automationAgent";
import { accountingEngine, parseTransactionFromChat, AccountingState } from "@/lib/accounting/transactionBridge";
import { clearAllData } from "@/lib/utils/system";
import { JournalEntry } from "@/lib/accounting/doubleEntry";

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

export default function AccountingPage() {
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
    // Load persisted engine state
    accountingEngine.load();
    setAccountingState(accountingEngine.getState());
    setJournalEntries(accountingEngine.getState().journalEntries);

    // Subscribe to updates
    const unsubscribe = accountingEngine.subscribe((state) => {
      setAccountingState(state);
      setJournalEntries(state.journalEntries);
    });

    return () => unsubscribe();
  }, []);

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

  const handleSendMessage = () => {
    const trimmed = composerInput.trim();
    if (!trimmed) return;
    appendMessage("user", trimmed);
    setComposerInput("");
    setIsWorkspaceCollapsed(true);

    // Try to parse transaction from natural language
    const parsedTx = parseTransactionFromChat(trimmed);

    if (parsedTx && parsedTx.amount && parsedTx.amount > 0) {
      // User entered a transaction-like message
      const newTransaction: RawTransaction = {
        id: `chat-${Date.now()}`,
        date: new Date().toISOString().split("T")[0],
        description: parsedTx.description || trimmed.substring(0, 100),
        category: parsedTx.category || "other",
        amount: parsedTx.amount,
        type: (parsedTx.category === "sales" || parsedTx.category === "revenue") ? "income" :
          (parsedTx.category === "equity" ? "equity" :
            (parsedTx.category === "asset" ? "asset" :
              (parsedTx.category === "liability" ? "liability" : "expense"))),
      };

      try {
        const result = accountingEngine.processTransaction(newTransaction);
        setTransactions((prev) => [...prev, newTransaction]);
        appendMessage("assistant", result.chatResponse);
        pushAutomationActivity("Chat journal", `Parsed and posted: ${result.journalEntry.id}`);

        // Auto-update statements
        const engineStatements = accountingEngine.generateStatements();
        setGeneratedStatements(engineStatements);
      } catch {
        appendMessage(
          "assistant",
          `I detected a transaction (₦${parsedTx.amount.toLocaleString()}). Use the manual form above for full control, or I can journal it with assumptions.`,
        );
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

  return (
    <>
      <div className="space-y-6 pb-32">
        <section className="relative min-h-[75vh]">
          <div className="flex flex-col gap-2 md:gap-3 px-2 md:px-6 py-3 md:py-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Accounting chat</p>
                <p className="text-sm text-gray-500">One stream for uploads, journals, audit attachments, and final handoff.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`px-3 py-1 rounded-md ${documents.length ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                  Docs {documents.length}
                </span>
                <span className={`px-3 py-1 rounded-md ${generatedStatements ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                  Draft {generatedStatements ? "ready" : "pending"}
                </span>
                <span className={`px-3 py-1 rounded-md ${auditedPacket ? "bg-purple-50 text-purple-600" : "bg-rose-50 text-rose-500"}`}>
                  Audit {auditedPacket ? "attached" : "waiting"}
                </span>
              </div>
            </div>
          </div>

          <div className="chat-feed flex flex-col min-h-[60vh]">
            <div className="flex-1 overflow-y-auto px-2 md:px-6 pt-4 md:pt-6 pb-36 space-y-3 md:space-y-5">
              <div className="space-y-4">
                {/* Documents Section */}
                <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                  <div className="px-3 md:px-5 py-2 md:py-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">Uploaded Documents</h3>
                          <p className="text-xs text-gray-500">{documents.length} file{documents.length !== 1 ? 's' : ''} attached</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 md:p-5">
                    {documents.length === 0 ? (
                      <div className="text-center py-6">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-500">No documents yet</p>
                        <p className="text-xs text-gray-400 mt-1">Use the + button to attach files</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {documents.map((doc) => (
                          <div key={`${doc.name}-${doc.uploadedAt}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs text-gray-700 truncate">{doc.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Transactions Section */}
                {transactions.length > 0 && (
                  <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                    <div className="px-3 md:px-5 py-2 md:py-4 border-b border-gray-100 bg-gray-50/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">Journal Entries</h3>
                            <p className="text-xs text-gray-500">{transactions.length.toLocaleString()} transaction{transactions.length !== 1 ? 's' : ''} recorded</p>
                          </div>
                        </div>
                        <button
                          className="text-xs text-rose-500 hover:text-rose-600 font-medium"
                          onClick={() => {
                            if (confirm("This will permanently clear all your transactions and tax history. Proceed?")) {
                              clearAllData();
                            }
                          }}
                        >
                          Clear all
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/30">
                            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Date</th>
                            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Description</th>
                            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Category</th>
                            <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Amount (₦)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {transactions.slice(-6).map((tx) => (
                            <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-5 py-3 text-sm text-gray-500 font-mono">{tx.date}</td>
                              <td className="px-5 py-3 text-sm text-gray-900">{tx.description}</td>
                              <td className="px-5 py-3">
                                <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 capitalize">{tx.category}</span>
                              </td>
                              <td className={`px-5 py-3 text-sm text-right font-mono font-semibold ${tx.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

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
                    <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                      {journalEntries.slice(-5).reverse().map((entry) => (
                        <div key={entry.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                              <span className="text-xs font-mono text-purple-600 bg-purple-50 px-2 py-0.5 rounded">{entry.id}</span>
                              <p className="text-sm font-medium text-gray-900 mt-1">{entry.narration}</p>
                            </div>
                            <span className="text-xs text-gray-400 font-mono">{entry.date}</span>
                          </div>
                          <table className="w-full text-xs mt-2">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                                <th className="py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Debit</th>
                                <th className="py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Credit</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {entry.lines.map((line, idx) => (
                                <tr key={idx}>
                                  <td className={`py-1.5 text-gray-700 ${line.credit > 0 ? "pl-4" : ""}`}>
                                    {line.accountName}
                                  </td>
                                  <td className="py-1.5 text-right font-mono text-gray-600 w-24">
                                    {line.debit > 0 ? `₦${line.debit.toLocaleString()}` : "-"}
                                  </td>
                                  <td className="py-1.5 text-right font-mono text-gray-600 w-24">
                                    {line.credit > 0 ? `₦${line.credit.toLocaleString()}` : "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
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

              <div ref={manualFormRef} id="manual-journal" className="rounded-lg border border-gray-200 bg-white p-4 md:p-5 space-y-3 md:space-y-4">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Manual journal entry</p>
                {error && <div className="rounded-md border border-red-200 bg-red-50 text-xs text-red-600 px-3 py-2">{error}</div>}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <input type="date" value={manualTx.date} onChange={(e) => setManualTx((prev) => ({ ...prev, date: e.target.value }))} className="rounded-md border border-gray-200 px-3 py-2" />
                  <input
                    type="text"
                    placeholder="Description"
                    value={manualTx.description}
                    onChange={(e) => setManualTx((prev) => ({ ...prev, description: e.target.value }))}
                    className="rounded-md border border-gray-200 px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Category"
                    value={manualTx.category}
                    onChange={(e) => setManualTx((prev) => ({ ...prev, category: e.target.value, type: normaliseCategory(e.target.value) }))}
                    className="rounded-md border border-gray-200 px-3 py-2"
                  />
                  <input
                    type="number"
                    placeholder="Amount"
                    value={manualTx.amount}
                    onChange={(e) => setManualTx((prev) => ({ ...prev, amount: e.target.value }))}
                    className="rounded-md border border-gray-200 px-3 py-2"
                  />
                </div>
                <button className="w-full rounded-md bg-gray-900 text-white text-sm font-semibold py-2.5" onClick={handleManualTransactionAdd}>
                  Save entry
                </button>
              </div>

              <p className="text-xs text-gray-400 text-center">
                Accounting outputs are auto-generated summaries. Always rely on audited statements for statutory filings.
              </p>

              <div className="space-y-4">
                {messages.map((msg, index) => (
                  <div key={`bottom-${msg.timestamp}-${index}`} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed border ${msg.role === "user"
                        ? "bg-blue-50 border-blue-100 text-blue-900"
                        : "bg-slate-50 border-slate-200 text-slate-800"
                        }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--background)] to-transparent" />
          </div>
        </section>
      </div>

      <div className="fixed bottom-4 left-0 right-0 lg:left-[252px] z-40 px-4 sm:px-6 pointer-events-none">
        <div className="mx-auto w-full max-w-3xl">
          {isActionMenuOpen && (
            <div className="pointer-events-auto mb-3 w-full max-w-sm rounded-2xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm">
              <button className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3" onClick={() => fileUploadRef.current?.click()}>
                <span className="text-slate-500">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828L18 9.828" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M16.95 5.05a2.5 2.5 0 113.536 3.536L10.95 18.122a4.5 4.5 0 01-6.364-6.364L12.121 4.223" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>Add documents</span>
              </button>
              <button className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3" onClick={scrollToJournal}>
                <span className="text-slate-500">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 20h9" strokeLinecap="round" />
                    <path d="M5 20h1a2 2 0 002-2V6a2 2 0 012-2h9" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 2l6 6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>Manual entry</span>
              </button>
              <button className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3" onClick={handleGenerateStatements}>
                <span className="text-slate-500">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 3h18v18H3z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7 14l2.5-3 2 2L14.5 9 17 13" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>Generate drafts</span>
              </button>
              <button className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3" onClick={() => auditUploadRef.current?.click()}>
                <span className="text-slate-500">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M6 2h9l5 5v13a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>Upload audited pack</span>
              </button>
              <button className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3" onClick={handleSendToTaxCalculator}>
                <span className="text-slate-500">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>Queue for tax</span>
              </button>
            </div>
          )}

          <div className="pointer-events-auto flex items-end gap-3 rounded-[24px] bg-[#e5e5e5] px-5 py-3 shadow-lg transition-all">
            <button
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-600 mb-0.5"
              onClick={() => setIsActionMenuOpen((prev) => !prev)}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Ask the accounting agent..."
              className="flex-1 bg-transparent border-none text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none resize-none py-2.5 min-h-[44px]"
              value={composerInput}
              onChange={(e) => setComposerInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <div className="flex items-center gap-2 mb-0.5">
              <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-500">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3a3 3 0 013 3v6a3 3 0 11-6 0V6a3 3 0 013-3z" />
                  <path d="M5 10v2a7 7 0 0014 0v-2" strokeLinecap="round" />
                  <path d="M12 19v4" strokeLinecap="round" />
                  <path d="M8 23h8" strokeLinecap="round" />
                </svg>
              </button>
              <button className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center transition-colors" onClick={handleSendMessage}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 12h14" strokeLinecap="round" />
                  <path d="M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <input ref={fileUploadRef} type="file" multiple className="hidden" onChange={handleDocumentUpload} />
      <input ref={auditUploadRef} type="file" className="hidden" onChange={handleAuditedUpload} />
    </>
  );
}
