"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  taxEngine,
  detectTaxType,
  type TaxComputationResult,
  type TaxTransaction,
} from "@/lib/tax/taxEngine";
import { getClientTaxRuleMetadata, refreshClientTaxRules } from "@/lib/taxRules/liveRatesClient";
import type { TaxRuleMetadata } from "@/lib/types";

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

function summarizeComputation(
  computation: TaxComputationResult,
  transaction?: TaxTransaction,
): string {
  const txLabel = transaction?.description || `Transaction ${computation.transactionId.slice(-4)}`;
  const taxLines =
    computation.taxesApplied.length > 0
      ? computation.taxesApplied.map(
          (tax) => `• ${tax.taxType} (${(tax.rate * 100).toFixed(1)}%): ${formatCurrency(tax.taxAmount)}`,
        )
      : ["• No immediate tax found for this entry"];

  return [
    `Recorded **${txLabel}** for ${formatCurrency(computation.amount)}.`,
    "",
    ...taxLines,
    "",
    `Total tax impact: ${formatCurrency(computation.totalTax)} | Net: ${formatCurrency(computation.netAmount)}`,
  ].join("\n");
}

export default function TaxChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [summary, setSummary] = useState(() => taxEngine.getTaxSummary());
  const [ruleMetadata, setRuleMetadata] = useState<TaxRuleMetadata>(() => getClientTaxRuleMetadata());
  const [recentComputations, setRecentComputations] = useState<TaxComputationResult[]>([]);
  const [transactionsMap, setTransactionsMap] = useState<Record<string, TaxTransaction>>({});
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const hydratedRef = useRef(false);

  const syncState = useCallback(() => {
    const latestSummary = taxEngine.getTaxSummary();
    const state = taxEngine.getState();
    const recent = state.computations.slice(-6).reverse();
    const txIndex = state.transactions.reduce<Record<string, TaxTransaction>>((acc, tx) => {
      acc[tx.id] = tx;
      return acc;
    }, {});

    setSummary(latestSummary);
    setRecentComputations(recent);
    setTransactionsMap(txIndex);
  }, []);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    taxEngine.load();
    syncState();
    const unsubscribe = taxEngine.subscribe(() => {
      syncState();
    });
    return () => unsubscribe();
  }, [syncState]);

  useEffect(() => {
    refreshClientTaxRules()
      .then(() => setRuleMetadata(getClientTaxRuleMetadata()))
      .catch(() => {
        // ignore hydration failures
      });
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      const intro = [
        "I'm wired directly into the Nigerian tax engine.",
        `Current VAT net payable: ${formatCurrency(summary.netVATPayable)}.`,
        "Tell me about a payment or disposal (e.g. “Paid ₦420,000 rent to Abuja landlord this month”).",
      ].join(" ");
      setMessages([
        {
          id: "intro",
          role: "assistant",
          content: intro,
          timestamp: Date.now(),
        },
      ]);
    }
  }, [messages.length, summary.netVATPayable]);

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

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    appendMessage("user", trimmed);
    setInput("");

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
        syncState();
        return;
      } catch (error) {
        console.error("Tax chat processing failed", error);
        appendMessage("assistant", "I couldn't journal that entry automatically. Please double-check the format.");
        return;
      }
    }

    const { totalVAT, totalWHT, totalCGT, totalStampDuty, netVATPayable } = taxEngine.getTaxSummary();
    appendMessage(
      "assistant",
      `No taxable transaction detected. Current flows → VAT: ${formatCurrency(totalVAT)}, WHT: ${formatCurrency(
        totalWHT,
      )}, CGT: ${formatCurrency(totalCGT)}, Stamp duty: ${formatCurrency(totalStampDuty)}. Net VAT payable ${formatCurrency(
        netVATPayable,
      )}.`,
    );
  };

  const summaryCards = useMemo(
    () => [
      { label: "Net VAT payable", value: summary.netVATPayable, detail: "Output minus input credit" },
      { label: "Withholding tax", value: summary.totalWHT, detail: "Professional fees, rent, dividends" },
      { label: "Capital gains", value: summary.totalCGT, detail: "Assets, property, shares" },
      { label: "Stamp duty", value: summary.totalStampDuty, detail: "Transfers ≥ ₦10k & instruments" },
    ],
    [summary],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="lg:col-span-2 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <header className="flex flex-col gap-2 border-b border-gray-100 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Tax agent chat</p>
            <h1 className="text-2xl font-semibold text-gray-900">Conversations synced with the tax engine</h1>
            <p className="text-sm text-gray-600">Describe payments, disposals, or ask for the current VAT/WHT position.</p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p>Ruleset: {ruleMetadata.version}</p>
            {ruleMetadata.source && <p>Source · {ruleMetadata.source}</p>}
          </div>
        </header>

        <div className="mt-4 flex h-[520px] flex-col rounded-2xl border border-gray-100">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-gray-100 p-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder="e.g. Paid ₦420,000 professional fees last Friday"
              className="w-full resize-none rounded-2xl border border-gray-200 p-3 text-sm outline-none focus:border-gray-400"
              rows={3}
            />
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>Enter to submit · Shift+Enter for newline</span>
              <button
                type="button"
                className="rounded-full bg-gray-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-gray-800"
                onClick={handleSend}
              >
                Post to tax engine
              </button>
            </div>
          </div>
        </div>
      </section>

      <aside className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Live flows</p>
        <h2 className="mt-2 text-lg font-semibold text-gray-900">Nigerian tax position</h2>
        <div className="mt-4 space-y-3">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(card.value)}</p>
              <p className="text-xs text-gray-600">{card.detail}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs uppercase tracking-[0.3em] text-gray-500">Latest postings</p>
        <div className="mt-2 space-y-3">
          {recentComputations.length === 0 && <p className="text-sm text-gray-500">No entries yet.</p>}
          {recentComputations.map((comp) => (
            <div key={comp.transactionId} className="rounded-2xl border border-gray-100 p-3">
              <p className="text-sm font-semibold text-gray-900">
                {transactionsMap[comp.transactionId]?.description || `Entry ${comp.transactionId.slice(-4)}`}
              </p>
              <p className="text-xs text-gray-500">
                {transactionsMap[comp.transactionId]?.date
                  ? new Date(transactionsMap[comp.transactionId].date).toLocaleDateString("en-NG")
                  : "Undated"}
              </p>
              <p className="mt-1 text-xs text-gray-600 whitespace-pre-line">
                {summarizeComputation(comp, transactionsMap[comp.transactionId])}
              </p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
