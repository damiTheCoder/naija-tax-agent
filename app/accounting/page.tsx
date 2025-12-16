"use client";

import { useState, useRef, useMemo, useEffect } from "react";
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
  const fileUploadRef = useRef<HTMLInputElement | null>(null);
  const auditUploadRef = useRef<HTMLInputElement | null>(null);
  const manualFormRef = useRef<HTMLDivElement | null>(null);

  const workspaceFiles = useMemo(() => deriveWorkspaceFiles(transactions), [transactions]);
  const automationConfidencePercent = useMemo(() => Math.round(automationConfidence * 100), [automationConfidence]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTransactions = window.localStorage.getItem("taxy::accounting-transactions");
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
    const savedConfidence = window.localStorage.getItem("taxy::automation-confidence");
    if (savedConfidence) {
      const numeric = parseFloat(savedConfidence);
      if (!Number.isNaN(numeric)) {
        setAutomationConfidence(numeric);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("taxy::accounting-transactions", JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("taxy::automation-confidence", automationConfidence.toString());
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
    appendMessage(
      "assistant",
      "Noted. Use the + menu to upload evidence or trigger automations while I prepare the books.",
    );
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

    setTransactions((prev) => [...prev, newTransaction]);
    setManualTx(initialTransaction);
    setError(null);
    appendMessage(
      "assistant",
      `Journaled ${newTransaction.description} (${newTransaction.category}) for ₦${Math.abs(amount).toLocaleString()}.`,
    );
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
      localStorage.setItem("taxy::accounting-draft", JSON.stringify(payload));
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
        {/* Show/Hide Workspace Button - Always visible at top */}
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setIsWorkspaceCollapsed((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0a0a0a] via-[#1a1a1a] to-[#0a0a0a] px-6 py-2.5 text-sm font-semibold text-white shadow-lg border border-white/10"
            aria-expanded={!isWorkspaceCollapsed}
          >
            <span>{isWorkspaceCollapsed ? "Show workspace" : "Hide workspace"}</span>
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className={`transition-transform ${isWorkspaceCollapsed ? "" : "rotate-180"}`}
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {!isWorkspaceCollapsed && (
          <>
            <section className="rounded-[32px] bg-gradient-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#0a0a0a] text-white px-6 py-8 relative overflow-hidden">
              {/* Yellow glow effect like hero */}
              <div className="absolute -top-1/2 -right-1/4 w-3/4 h-full bg-gradient-to-l from-[#faff00]/15 to-transparent rounded-full blur-3xl pointer-events-none"></div>
              <div className="relative z-10 flex flex-col gap-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#faff00]">Accounting Studio</p>
                <h1 className="text-3xl md:text-4xl font-black leading-tight max-w-3xl">
                  Go from messy ledgers to audited statements, then straight into tax computations.
                </h1>
                <p className="text-white/75 max-w-3xl">
                  Upload raw evidence (bank exports, invoices, payroll sheets). Taxy autogenerates draft financial statements,
                  you upload the signed-off audit pack, and we queue the approved figures for the main tax engine.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {["Connect bank feed", "Upload evidence", "Generate drafts", "Push to tax"].map((step, index) => (
                    <div key={step} className="rounded-2xl bg-white/10 backdrop-blur px-4 py-3 flex items-center gap-3 border border-white/10">
                      <span className="w-8 h-8 rounded-full bg-[#faff00]/20 flex items-center justify-center text-lg font-semibold text-[#faff00]">
                        {index + 1}
                      </span>
                      <span className="tracking-wide">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[0.65fr_0.35fr]">
              <div className="rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-gray-400">AI agentic automation</p>
                    <h2 className="mt-2 text-2xl font-black leading-tight text-gray-900">
                      Bank-fed journals, still editable in chat.
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                      Connect your bank feed once and let the agent classify transactions, build ledgers, and refresh financials in the
                      background. You can override any entry directly from the conversation stream.
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${automationStatusThemes[automationStatus]}`}>
                    {automationStatus}
                  </span>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-gray-100 bg-slate-50 p-4 text-sm text-gray-700">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Selected bank</p>
                    <select
                      value={selectedBank}
                      onChange={(event) => setSelectedBank(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                      disabled={isAutomationBusy}
                    >
                      {BANK_PROVIDERS.map((bank) => (
                        <option key={bank} value={bank}>
                          {bank}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-slate-50 p-4 text-sm text-gray-700">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500">AI confidence</p>
                    <p className="mt-2 text-3xl font-black text-gray-900">{automationConfidencePercent}%</p>
                    <p className="text-xs text-gray-500">Adjusts as you review or edit entries.</p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-slate-50 p-4 text-sm text-gray-700">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Workspace coverage</p>
                    <p className="mt-2 text-3xl font-black text-gray-900">{transactions.length ? "Live" : "0%"}</p>
                    <p className="text-xs text-gray-500">Journals, ledgers, statements update together.</p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    className="rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    onClick={automationPrimaryAction}
                    disabled={isAutomationBusy}
                  >
                    {isAutomationBusy ? "Working..." : automationPrimaryLabel}
                  </button>
                  <Link
                    href="/accounting/workspace"
                    className="rounded-full border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-slate-50"
                  >
                    Open files workspace
                  </Link>
                </div>

                <div className="mt-6 space-y-3">
                  {automationActivity.map((entry) => (
                    <div key={`${entry.title}-${entry.timestamp}`} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-slate-50/70 px-4 py-3">
                      <div className="h-2 w-2 rounded-full bg-emerald-400" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{entry.title}</p>
                        <p className="text-xs text-gray-500">{entry.detail}</p>
                      </div>
                      <span className="text-xs text-gray-400">{entry.timestamp}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Agent quick prompts</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {automationPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        className="rounded-full border border-gray-200 px-4 py-1.5 text-sm text-gray-700 hover:bg-slate-50 disabled:opacity-60"
                        onClick={() => handleAutomationPrompt(prompt)}
                        disabled={isAutomationBusy}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Files snapshot</p>
                <h3 className="mt-2 text-xl font-semibold text-gray-900">Real-time workspace</h3>
                <p className="text-sm text-gray-500">Preview of what the file room will show once the agent syncs.</p>
                <div className="mt-6 space-y-4">
                  {workspaceFiles.slice(0, 2).map((file) => (
                    <div key={file.slug} className="rounded-2xl border border-gray-100 bg-slate-50/80 p-4">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{file.badge}</span>
                        <span>{file.meta}</span>
                      </div>
                      <p className="mt-1 text-lg font-semibold text-gray-900">{file.title}</p>
                      <p className="text-sm text-gray-600">{file.subtitle}</p>
                    </div>
                  ))}
                </div>
                <Link href="/accounting/workspace" className="mt-6 block w-full rounded-xl bg-[#faff00] px-4 py-2 text-sm font-semibold text-gray-900 text-center">
                  View all files
                </Link>
              </div>
        </section>
          </>
        )}

        <section className="relative min-h-[75vh]">
          <div className="flex flex-col gap-3 px-6 py-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Accounting chat</p>
                <p className="text-sm text-gray-500">One stream for uploads, journals, audit attachments, and final handoff.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className={`px-3 py-1 rounded-full border ${documents.length ? "border-emerald-200 text-emerald-600" : "border-gray-200"}`}>
                  Docs {documents.length}
                </span>
                <span className={`px-3 py-1 rounded-full border ${generatedStatements ? "border-emerald-200 text-emerald-600" : "border-gray-200"}`}>
                  Draft {generatedStatements ? "ready" : "pending"}
                </span>
                <span className={`px-3 py-1 rounded-full border ${auditedPacket ? "border-emerald-200 text-emerald-600" : "border-gray-200"}`}>
                  Audit {auditedPacket ? "attached" : "waiting"}
                </span>
              </div>
            </div>
          </div>

          <div className="chat-feed flex flex-col min-h-[60vh]">
            <div className="flex-1 overflow-y-auto px-6 pt-6 pb-36 space-y-5">
              {!isWorkspaceCollapsed && (
                <>
                  {documents.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-slate-50/70 p-4 text-sm text-gray-500">
                      Use the + button to attach spreadsheets, invoices, or PDFs. I’ll read them and extract transactions.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2">
                      <div className="text-xs uppercase tracking-[0.3em] text-gray-400">Uploaded evidence</div>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-700">
                        {documents.map((doc) => (
                          <span key={`${doc.name}-${doc.uploadedAt}`} className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                            {doc.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {transactions.length > 0 && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Transactions parsed</p>
                          <p className="text-sm text-gray-500">{transactions.length.toLocaleString()} entries in the workspace</p>
                        </div>
                        <button className="text-xs text-rose-500" onClick={() => setTransactions([])}>
                          Clear
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="text-gray-400 uppercase">
                            <tr>
                              <th className="text-left py-1">Date</th>
                              <th className="text-left py-1">Description</th>
                              <th className="text-left py-1">Category</th>
                              <th className="text-right py-1">Amount (₦)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactions.slice(-6).map((tx) => (
                              <tr key={tx.id} className="border-t border-gray-100">
                                <td className="py-1 text-gray-500">{tx.date}</td>
                                <td className="py-1 text-gray-700">{tx.description}</td>
                                <td className="py-1 text-gray-500 capitalize">{tx.category}</td>
                                <td className={`py-1 text-right font-semibold ${tx.amount >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                                  {tx.amount.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {statementCards && (
                    <div className="rounded-2xl border border-gray-200 bg-slate-900 text-white p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-white/50">Draft financials</p>
                          <p className="text-sm text-white/70">Income Statement • Balance Sheet • Cash Flow</p>
                        </div>
                        {!auditedPacket && <span className="text-xs font-semibold bg-yellow-300 text-slate-900 px-3 py-1 rounded-full">Awaiting audit</span>}
                      </div>
                      <div className="grid md:grid-cols-3 gap-3 text-sm">
                        <div className="bg-white/10 rounded-xl p-3">
                          <p className="text-white/70 text-xs">Revenue</p>
                          <p className="text-lg font-semibold">₦ {statementCards.revenue.toLocaleString()}</p>
                          <p className="text-white/60 text-xs">Net income ₦ {statementCards.netIncome.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/10 rounded-xl p-3">
                          <p className="text-white/70 text-xs">Operating expenses</p>
                          <p className="text-lg font-semibold">₦ {statementCards.operatingExpenses.toLocaleString()}</p>
                          <p className="text-white/60 text-xs">Cost of sales ₦ {statementCards.costOfSales.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/10 rounded-xl p-3">
                          <p className="text-white/70 text-xs">Balance sheet</p>
                          <p className="text-sm">Assets ₦ {statementCards.assets.toLocaleString()}</p>
                          <p className="text-sm">Liabilities ₦ {statementCards.liabilities.toLocaleString()}</p>
                          <p className="text-sm">Equity ₦ {statementCards.equity.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {auditedPacket && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                      <p className="font-semibold">Audited pack: {auditedPacket.fileName}</p>
                      <p>Uploaded {new Date(auditedPacket.uploadedAt).toLocaleString()} • {auditedPacket.auditorName}</p>
                      <p>{auditedPacket.notes}</p>
                    </div>
                  )}
                </>
              )}

              <div ref={manualFormRef} id="manual-journal" className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Manual journal entry</p>
                {error && <div className="rounded-xl border border-red-200 bg-red-50 text-xs text-red-600 px-3 py-2">{error}</div>}
                <div className="grid md:grid-cols-4 gap-2 text-sm">
                  <input type="date" value={manualTx.date} onChange={(e) => setManualTx((prev) => ({ ...prev, date: e.target.value }))} className="rounded-xl border border-gray-200 px-3 py-2" />
                  <input
                    type="text"
                    placeholder="Description"
                    value={manualTx.description}
                    onChange={(e) => setManualTx((prev) => ({ ...prev, description: e.target.value }))}
                    className="rounded-xl border border-gray-200 px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Category"
                    value={manualTx.category}
                    onChange={(e) => setManualTx((prev) => ({ ...prev, category: e.target.value, type: normaliseCategory(e.target.value) }))}
                    className="rounded-xl border border-gray-200 px-3 py-2"
                  />
                  <input
                    type="number"
                    placeholder="Amount"
                    value={manualTx.amount}
                    onChange={(e) => setManualTx((prev) => ({ ...prev, amount: e.target.value }))}
                    className="rounded-xl border border-gray-200 px-3 py-2"
                  />
                </div>
                <button className="w-full rounded-full bg-gray-900 text-white text-sm font-semibold py-2" onClick={handleManualTransactionAdd}>
                  Save entry
                </button>
              </div>

              {!isWorkspaceCollapsed && (
                <p className="text-xs text-gray-400 text-center">
                  Accounting outputs are auto-generated summaries. Always rely on audited statements for statutory filings.
                </p>
              )}

              <div className="space-y-4">
                {messages.map((msg, index) => (
                  <div key={`bottom-${msg.timestamp}-${index}`} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed border ${
                        msg.role === "user"
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

      <div className="fixed bottom-4 left-0 right-0 z-40 px-4 sm:px-6 pointer-events-none">
        <div className="mx-auto w-full max-w-4xl">
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

          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-[#e5e5e5] px-5 py-3 shadow-lg">
            <button
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-600"
              onClick={() => setIsActionMenuOpen((prev) => !prev)}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
            <textarea
              rows={1}
              placeholder="Ask the accounting agent..."
              className="flex-1 bg-transparent border-none text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none resize-none"
              value={composerInput}
              onChange={(e) => setComposerInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <div className="flex items-center gap-2">
              <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-500">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3a3 3 0 013 3v6a3 3 0 11-6 0V6a3 3 0 013-3z" />
                  <path d="M5 10v2a7 7 0 0014 0v-2" strokeLinecap="round" />
                  <path d="M12 19v4" strokeLinecap="round" />
                  <path d="M8 23h8" strokeLinecap="round" />
                </svg>
              </button>
              <button className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center" onClick={handleSendMessage}>
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
