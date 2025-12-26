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
import { Menu, Plus, ArrowRight, BarChart3, SendHorizontal } from "lucide-react";

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
  const [input, setInput] = useState("");
  const [summary, setSummary] = useState(() => taxEngine.getTaxSummary());
  const [ruleMetadata, setRuleMetadata] = useState<TaxRuleMetadata>(() => getClientTaxRuleMetadata());
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const hydratedRef = useRef(false);

  const syncState = useCallback(() => {
    const latestSummary = taxEngine.getTaxSummary();
    setSummary(latestSummary);
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
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "intro",
          role: "assistant",
          content: "I'm wired directly into the Nigerian tax engine. Tell me about a payment or disposal (e.g. “Paid ₦420,000 rent to Abuja landlord”).",
          timestamp: Date.now(),
        },
      ]);
    }
  }, [messages.length]);

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
        appendMessage("assistant", "I couldn't journal that entry automatically.");
      }
    }
    appendMessage("assistant", "No taxable transaction detected.");
  };

  return (
    <div className="max-w-2xl mx-auto min-h-screen flex flex-col p-6 bg-[#f8f9fa]">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#0070f3] rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <SendHorizontal className="w-6 h-6 text-white rotate-[-45deg] ml-1" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Insight</h1>
        </div>
        <button className="p-2.5 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
          <Menu className="w-5 h-5 text-gray-700" />
        </button>
      </header>

      {/* Subtitles */}
      <div className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#9ca3af] mb-1">
          Tax Agent Chat
        </p>
        <p className="text-[#6b7280] font-medium text-sm">
          Real-time Nigerian tax computation engine.
        </p>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 mb-8">
        <span className="px-3 py-1 bg-[#f3f4f6] text-[#6b7280] text-[11px] font-medium rounded-lg border border-gray-100 shadow-sm">
          Ruleset: {ruleMetadata.version || "base"}
        </span>
        <span className="px-3 py-1 bg-[#f3f4f6] text-[#6b7280] text-[11px] font-medium rounded-lg border border-gray-100 shadow-sm">
          config.ts
        </span>
      </div>

      {/* Current Tax Position Card */}
      <div className="bg-white rounded-[2rem] border border-[#f1f5f9] shadow-sm overflow-hidden mb-24">
        <div className="p-6 border-b border-[#f1f5f9] flex items-center gap-4">
          <div className="w-10 h-10 bg-[#eff6ff] rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-[#3b82f6]" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 leading-none mb-1">Current Tax Position</h3>
            <p className="text-xs text-[#94a3b8]">Live summary of accrued liabilities</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* NET VAT PAYABLE */}
          <div className="p-6 rounded-[1.5rem] bg-white border border-[#e0e7ff] relative overflow-hidden group hover:border-[#818cf8] transition-colors">
            <div className="relative z-10">
              <p className="text-[11px] font-bold text-[#6366f1] tracking-wider uppercase mb-2">Net VAT Payable</p>
              <p className="text-3xl font-black text-gray-900 mb-1 leading-tight">{formatCurrency(summary.netVATPayable)}</p>
              <p className="text-[11px] font-medium text-[#94a3b8]">Output - Input</p>
            </div>
          </div>

          {/* WITHHOLDING TAX */}
          <div className="p-6 rounded-[1.5rem] bg-[#fff1f2]/30 border border-[#fee2e2] relative overflow-hidden group hover:border-[#f43f5e] transition-colors">
            <div className="relative z-10">
              <p className="text-[11px] font-bold text-[#f43f5e] tracking-wider uppercase mb-2">Withholding Tax</p>
              <p className="text-3xl font-black text-gray-900 mb-1 leading-tight">{formatCurrency(summary.totalWHT)}</p>
              <p className="text-[11px] font-medium text-[#94a3b8]">WHT deducted</p>
            </div>
          </div>

          {/* CAPITAL GAINS */}
          <div className="p-6 rounded-[1.5rem] bg-[#f0fdf4]/50 border border-[#dcfce7] relative overflow-hidden group hover:border-[#22c55e] transition-colors">
            <div className="relative z-10">
              <p className="text-[11px] font-bold text-[#22c55e] tracking-wider uppercase mb-2">Capital Gains</p>
              <p className="text-3xl font-black text-gray-900 mb-1 leading-tight">{formatCurrency(summary.totalCGT)}</p>
              <p className="text-[11px] font-medium text-[#94a3b8]">Asset disposals</p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Chat Input */}
      <footer className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-4">
        <div className="bg-[#e9e9e9] rounded-full p-2.5 flex items-center gap-2 shadow-2xl shadow-black/5 ring-1 ring-white/20">
          <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm shrink-0">
            <Plus className="w-6 h-6 text-gray-900" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask the tax agent or record a transaction..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-gray-600 placeholder:text-gray-400 text-sm py-2 px-1"
          />
          <button
            onClick={handleSend}
            className="w-12 h-12 bg-gray-200/50 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors shadow-sm shrink-0"
          >
            <ArrowRight className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </footer>
    </div>
  );
}
