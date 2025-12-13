"use client";

import { useState, useRef } from "react";
import {
  RawTransaction,
  StatementDraft,
  DraftDocumentMeta,
  AuditedStatementPacket,
  TransactionType,
} from "@/lib/accounting/types";
import { buildTransactionsFromFiles, generateStatementDraft, normaliseCategory } from "@/lib/accounting/statementEngine";
import { statementToTaxDraft } from "@/lib/accounting/taxBridge";

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
  const fileUploadRef = useRef<HTMLInputElement | null>(null);
  const auditUploadRef = useRef<HTMLInputElement | null>(null);
  const manualFormRef = useRef<HTMLDivElement | null>(null);

  const appendMessage = (role: "user" | "assistant", content: string) => {
    setMessages((prev) => [...prev, { role, content, timestamp: Date.now() }]);
  };

  const handleSendMessage = () => {
    const trimmed = composerInput.trim();
    if (!trimmed) return;
    appendMessage("user", trimmed);
    setComposerInput("");
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

  const scrollToJournal = () => {
    manualFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setIsActionMenuOpen(false);
  };

  return (
    <>
      <div className="space-y-6">
        <section className="rounded-[32px] bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-6 py-8">
          <div className="flex flex-col gap-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/70">Accounting Studio</p>
            <h1 className="text-3xl md:text-4xl font-black leading-tight max-w-3xl">
              Go from messy ledgers to audited statements, then straight into tax computations.
            </h1>
            <p className="text-white/80 max-w-3xl">
              Upload raw evidence (bank exports, invoices, payroll sheets). Taxy autogenerates draft financial statements,
              you upload the signed-off audit pack, and we queue the approved figures for the main tax engine.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {["Upload evidence", "Generate drafts", "Attach audit", "Push to tax"].map((step, index) => (
                <div key={step} className="rounded-2xl bg-white/10 backdrop-blur px-4 py-3 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-lg font-semibold">
                    {index + 1}
                  </span>
                  <span className="tracking-wide">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative min-h-[75vh] rounded-[32px] bg-white">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Accounting chat</p>
              <p className="text-sm text-gray-500">One stream for uploads, journals, audit attachments, and final handoff.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
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

          <div className="chat-feed flex flex-col min-h-[60vh]">
            <div className="flex-1 overflow-y-auto px-6 pt-6 pb-36 space-y-5">
              {messages.map((msg) => (
                <div key={msg.timestamp} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
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

              <div ref={manualFormRef} className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
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

              <p className="text-xs text-gray-400 text-center">
                Accounting outputs are auto-generated summaries. Always rely on audited statements for statutory filings.
              </p>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />
          </div>

          <div className="sticky bottom-0 mx-auto w-full max-w-4xl px-4 pb-6">
            {isActionMenuOpen && (
              <div className="mb-3 w-full max-w-sm rounded-2xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm">
                <button className="w-full text-left px-4 py-3 hover:bg-slate-50" onClick={() => fileUploadRef.current?.click()}>
                  📎 Add documents
                </button>
                <button className="w-full text-left px-4 py-3 hover:bg-slate-50" onClick={scrollToJournal}>
                  ✍️ Manual entry
                </button>
                <button className="w-full text-left px-4 py-3 hover:bg-slate-50" onClick={handleGenerateStatements}>
                  📊 Generate drafts
                </button>
                <button className="w-full text-left px-4 py-3 hover:bg-slate-50" onClick={() => auditUploadRef.current?.click()}>
                  🧾 Upload audited pack
                </button>
                <button className="w-full text-left px-4 py-3 hover:bg-slate-50" onClick={handleSendToTaxCalculator}>
                  ↗️ Queue for tax
                </button>
              </div>
            )}

            <div className="flex items-end gap-3 bg-slate-100 rounded-full px-4 py-3 border border-slate-200">
              <button className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-2xl" onClick={() => setIsActionMenuOpen((prev) => !prev)}>
                +
              </button>
              <textarea
                rows={1}
                placeholder="Ask the accounting agent..."
                className="flex-1 bg-transparent border-none text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none resize-none"
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
                <button className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-gray-500">🎤</button>
                <button className="w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center" onClick={handleSendMessage}>
                  ↑
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <input ref={fileUploadRef} type="file" multiple className="hidden" onChange={handleDocumentUpload} />
      <input ref={auditUploadRef} type="file" className="hidden" onChange={handleAuditedUpload} />
    </>
  );
}
