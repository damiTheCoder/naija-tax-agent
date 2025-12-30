/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { taxEngine, detectTaxType } from "@/lib/tax/taxEngine";
import { getClientTaxRuleMetadata, refreshClientTaxRules } from "@/lib/taxRules/liveRatesClient";
import type { TaxRuleMetadata } from "@/lib/types";
import type { TaxDraftPayload } from "@/lib/accounting/types";
import { Plus, RefreshCw, ShieldCheck, CalendarDays, FileDown, Trash2, SendHorizontal } from "lucide-react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatCurrency = (value: number) => currency.format(Math.round(value || 0));

export default function TaxChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composerInput, setComposerInput] = useState("");
  const [engineState, setEngineState] = useState(() => {
    const initial = taxEngine.getState();
    return {
      ...initial,
      transactions: [...initial.transactions],
      computations: [...initial.computations],
      schedules: [...initial.schedules],
    };
  });
  const [ruleMetadata, setRuleMetadata] = useState<TaxRuleMetadata>(() => getClientTaxRuleMetadata());
  const [draftPayload, setDraftPayload] = useState<TaxDraftPayload | null>(null);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [status, setStatus] = useState("Workspace ready for entries.");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const hydratedRef = useRef(false);

  const syncState = useCallback(() => {
    const latest = taxEngine.getState();
    setEngineState({
      ...latest,
      transactions: [...latest.transactions],
      computations: [...latest.computations],
      schedules: [...latest.schedules],
    });
  }, []);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    // Defer heavy localStorage load to allow page to render first
    const loadEngine = () => {
      taxEngine.load();
      syncState();
    };

    // Use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(loadEngine);
    } else {
      setTimeout(loadEngine, 0);
    }

    const unsubscribe = taxEngine.subscribe(() => {
      syncState();
    });
    return () => unsubscribe();
  }, [syncState]);

  useEffect(() => {
    refreshClientTaxRules()
      .then(() => setRuleMetadata(getClientTaxRuleMetadata()))
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("insight::accounting-draft");
    if (saved) {
      try {
        const parsed: TaxDraftPayload = JSON.parse(saved);
        setDraftPayload(parsed);
        setStatus("Accounting export detected. Ask me when to push it through tax.");
      } catch {
        // Ignore malformed drafts
      }
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "intro",
          role: "assistant",
          content: "Studio link online. Describe a Nigerian payment, sale, or disposal and I'll journal it into the tax engine.",
          timestamp: Date.now(),
        },
      ]);
    }
  }, [messages.length]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    const nextHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 24), 150);
    textareaRef.current.style.height = `${nextHeight}px`;
  }, [composerInput]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const appendMessage = useCallback((role: ChatMessage["role"], content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role,
        content,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const handleSendMessage = useCallback(() => {
    const trimmed = composerInput.trim();
    if (!trimmed) return;
    appendMessage("user", trimmed);
    setComposerInput("");
    setIsActionMenuOpen(false);

    const parsed = taxEngine.parseTransactionFromChat(trimmed);
    if (parsed && parsed.amount && parsed.amount !== 0) {
      try {
        const detection = parsed.type
          ? { transactionType: parsed.type }
          : detectTaxType(parsed.description || trimmed, parsed.amount, parsed.category);
        const result = taxEngine.processTransaction({
          date: parsed.date || new Date().toISOString().split("T")[0],
          description: parsed.description || trimmed.slice(0, 100),
          amount: parsed.amount,
          category: parsed.category || "chat-entry",
          type: detection.transactionType,
          isResident: parsed.isResident ?? true,
        });

        appendMessage("assistant", result.chatResponse);
        setStatus(`Logged ${result.transaction.type.toUpperCase()} for ${formatCurrency(result.transaction.amount)}.`);
        syncState();
        return;
      } catch {
        appendMessage("assistant", "I couldn't journal that entry automatically.");
        setStatus("Tax engine hit an error. Try again.");
      }
    } else {
      appendMessage("assistant", "No taxable transaction detected.");
      setStatus("Need an amount and taxable context to act.");
    }
  }, [appendMessage, composerInput, syncState]);

  const handleRefreshRules = useCallback(async () => {
    try {
      await refreshClientTaxRules();
      const latestMeta = getClientTaxRuleMetadata();
      setRuleMetadata(latestMeta);
      appendMessage("assistant", `📡 Live rulebook synced to ${latestMeta.version || "base"} version.`);
      setStatus("Live rates refreshed.");
    } catch {
      appendMessage("assistant", "Couldn't refresh live rules. Network issue?");
      setStatus("Failed to refresh rules. Try again.");
    }
  }, [appendMessage]);

  const handleImportAccountingDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("insight::accounting-draft");
    if (!stored) {
      appendMessage("assistant", "No accounting export queued yet. Send from the studio when it's ready.");
      setStatus("Waiting on accounting export.");
      return;
    }
    try {
      const parsed: TaxDraftPayload = JSON.parse(stored);
      setDraftPayload(parsed);
      appendMessage("assistant", "📁 Audited figures pulled in. Ask me to compute liabilities whenever you're ready.");
      setStatus("Draft figures staged.");
    } catch {
      appendMessage("assistant", "The queued draft looked corrupted. Please regenerate from accounting.");
      setStatus("Unable to parse accounting draft.");
    }
  }, [appendMessage]);

  const handleResetWorkspace = useCallback(() => {
    if (typeof window !== "undefined" && !window.confirm("This clears logged tax transactions. Continue?")) {
      return;
    }
    taxEngine.reset();
    syncState();
    appendMessage("assistant", "Workspace reset. Stream in the next batch when you like.");
    setStatus("Workspace cleared.");
  }, [appendMessage, syncState]);

  const openSchedules = engineState.schedules.filter((schedule) => schedule.status !== "paid").slice(0, 3);
  const recentComputations = engineState.computations.slice(-3).reverse();
  const recentTransactions = engineState.transactions.slice(-4).reverse();
  const canSend = composerInput.trim().length > 0;

  return (
    <>
      <div className="space-y-6 pb-32">
        <section className="relative min-h-[70vh]">
          <div className="flex flex-col gap-2 md:gap-3 px-2 md:px-6 py-3 md:py-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Tax agent studio</p>
                <p className="text-sm text-gray-500">One stream for accounting handoffs, liabilities, and filings.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-3 py-1 rounded-md bg-blue-50 text-blue-600">Rules {ruleMetadata.version || "base"}</span>
                <span className="px-3 py-1 rounded-md bg-emerald-50 text-emerald-600">{engineState.transactions.length} txns</span>
                <span className="px-3 py-1 rounded-md bg-amber-50 text-amber-600">{openSchedules.length} filings open</span>
              </div>
            </div>
          </div>

          <div className="chat-feed flex flex-col min-h-[60vh]">
            <div className="flex-1 overflow-y-auto px-2 md:px-6 pt-4 md:pt-6 pb-36 space-y-5">
              {status && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
                  {status}
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Accounting handoff</h3>
                      <p className="text-xs text-gray-500">{draftPayload ? "Audited pack queued" : "Waiting on accounting export"}</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-3 text-sm text-gray-600">
                    {draftPayload ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-gray-400">Tax year</p>
                            <p className="text-base font-semibold text-gray-900">{draftPayload.profile.taxYear}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-gray-400">Gross revenue</p>
                            <p className="text-base font-semibold text-gray-900">{formatCurrency(draftPayload.inputs.grossRevenue || 0)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-gray-400">Allowable expenses</p>
                            <p className="text-base font-semibold text-gray-900">{formatCurrency(draftPayload.inputs.allowableExpenses || 0)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-gray-400">Cost of sales</p>
                            <p className="text-base font-semibold text-gray-900">{formatCurrency(draftPayload.inputs.costOfSales || 0)}</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">
                          Period {draftPayload.statement.period?.start || "N/A"} → {draftPayload.statement.period?.end || "N/A"}
                        </p>
                      </>
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-4 text-sm text-gray-500">
                        No audited statement queued. Use the + actions to pull the export from accounting.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <CalendarDays className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Quarterly filings</h3>
                      <p className="text-xs text-gray-500">{openSchedules.length ? `${openSchedules.length} schedule${openSchedules.length > 1 ? "s" : ""} open` : "No pending filings"}</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {openSchedules.length ? (
                      openSchedules.map((schedule) => (
                        <div key={schedule.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/40 px-3 py-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{schedule.taxType}</p>
                            <p className="text-xs text-gray-500">
                              {schedule.period} • due {schedule.dueDate}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-mono text-gray-900">{formatCurrency(schedule.taxAmount)}</p>
                            <p className={`text-xs font-semibold ${schedule.status === "pending" ? "text-amber-600" : "text-emerald-600"}`}>
                              {schedule.status}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No schedules yet. Journal entries will build VAT, WHT, and CGT filings.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Recent activity</p>
                </div>
                <div className="p-4 space-y-4">
                  {recentComputations.length ? (
                    recentComputations.map((comp) => (
                      <div key={comp.transactionId} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                        <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
                          <span>{comp.transactionDescription}</span>
                          <span className="font-mono text-indigo-600">{formatCurrency(comp.totalTax)}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-gray-500">
                          {comp.taxesApplied.map((tax) => (
                            <span key={`${comp.transactionId}-${tax.taxType}-${tax.note}`} className="inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                              {tax.taxType} {(tax.rate * 100).toFixed(1)}%
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No computations yet. Describe a transaction to kick things off.</p>
                  )}

                  {recentTransactions.length > 0 && (
                    <div className="border-t border-dashed border-gray-200 pt-3 space-y-2">
                      {recentTransactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between text-sm">
                          <div>
                            <p className="font-medium text-gray-900">{tx.description}</p>
                            <p className="text-[11px] uppercase tracking-wide text-gray-400">{tx.type}</p>
                          </div>
                          <div className={`text-sm font-mono font-semibold ${tx.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {tx.amount >= 0 ? "+" : "-"}
                            {formatCurrency(Math.abs(tx.amount))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {messages.map((msg, index) => (
                  <div key={`msg-${msg.timestamp}-${index}`} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed border ${msg.role === "user"
                        ? "bg-indigo-50 border-indigo-100 text-indigo-900"
                        : "bg-slate-50 border-slate-200 text-slate-800"
                        }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </div>

          </div>
        </section>
      </div>

      <div className="fixed bottom-4 left-0 right-0 lg:left-[252px] z-40 px-4 sm:px-6 pointer-events-none !bg-transparent">
        <div className="mx-auto w-full max-w-3xl !bg-transparent">
          {isActionMenuOpen && (
            <div className="pointer-events-auto mb-3 w-full max-w-sm rounded-2xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm">
              <button className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3" onClick={() => { setIsActionMenuOpen(false); handleImportAccountingDraft(); }}>
                <FileDown className="w-4 h-4 text-slate-500" />
                <span>Pull accounting export</span>
              </button>
              <button className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3" onClick={() => { setIsActionMenuOpen(false); handleRefreshRules(); }}>
                <RefreshCw className="w-4 h-4 text-slate-500" />
                <span>Refresh live rules</span>
              </button>
              <button className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3" onClick={() => { setIsActionMenuOpen(false); handleResetWorkspace(); }}>
                <Trash2 className="w-4 h-4 text-slate-500" />
                <span>Reset workspace</span>
              </button>
            </div>
          )}

          <div className="pointer-events-auto flex items-end gap-2 rounded-[32px] bg-[#e5e5e5] dark:bg-[#2a2a2a] px-3 py-1.5 shadow-lg transition-all">
            <button
              className="w-9 h-9 rounded-full bg-white dark:bg-[#3a3a3a] flex items-center justify-center text-slate-600 dark:text-white mb-0.5"
              onClick={() => setIsActionMenuOpen((prev) => !prev)}
            >
              <Plus className="w-4 h-4" />
            </button>
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Describe a payment, sale, or disposal..."
              className="flex-1 bg-transparent border-none text-sm text-gray-700 dark:text-white placeholder:text-gray-400 focus:outline-none resize-none py-2.5 min-h-[44px] ml-1"
              value={composerInput}
              onChange={(e) => setComposerInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <button
              className={`w-9 h-9 rounded-full flex items-center justify-center mb-0.5 transition-colors ${canSend ? "bg-gray-900 dark:bg-[#64B5F6] text-white" : "bg-white dark:bg-[#3a3a3a] text-gray-400 cursor-not-allowed"
                }`}
              onClick={handleSendMessage}
              disabled={!canSend}
            >
              <SendHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
