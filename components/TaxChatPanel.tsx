"use client";

import { useEffect, useRef, useState } from "react";
import { addChatHistoryEntry } from "@/lib/personalChatHistory";
import { formatPlanSourceLabel, runUnifiedAgentMessage, type AgentPlanSource } from "@/lib/agent/unifiedClient";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
}

export default function TaxChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "intro",
      role: "assistant",
      content:
        "Connected to the NaijaTaxAgent logic. Drop a payment, sale, or disposal and I'll tag VAT, WHT, CGT, or stamp duties instantly.",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [planSource, setPlanSource] = useState<AgentPlanSource>("fallback");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const appendMessage = (role: ChatRole, content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role,
        content,
        timestamp: Date.now(),
      },
    ]);
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const outgoing = [
      ...messages,
      {
        id: `user-${Date.now()}`,
        role: "user" as const,
        content: trimmed,
        timestamp: Date.now(),
      },
    ];
    setMessages(outgoing);
    setInput("");
    setIsSending(true);
    setError(null);

    try {
      addChatHistoryEntry({
        module: "tax",
        route: "/tax-tools",
        prompt: trimmed,
      });
      const result = await runUnifiedAgentMessage({
        message: trimmed,
        module: "tax",
        route: "/tax-tools",
        conversation: outgoing.map(({ role, content }) => ({ role, content })),
      });
      setPlanSource(result.planSource);
      const answer = result.finalReply || "I could not generate a useful response. Please try again.";
      appendMessage("assistant", answer);
      addChatHistoryEntry({
        module: "tax",
        route: "/tax-tools",
        prompt: trimmed,
        response: answer,
      });
    } catch (err) {
      setPlanSource("fallback");
      const fallback = err instanceof Error ? err.message : "Unable to reach the tax assistant.";
      setError(fallback);
      appendMessage("assistant", fallback);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="tax-chat-card rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Tax agent chat</p>
          <h3 className="mt-1 text-lg font-semibold text-gray-900">Dialogue linked to computations</h3>
          <p className="text-sm text-gray-500">
            Journals go straight into the VAT, WHT, CGT, and stamp-duty schedules.
          </p>
          <p className="mt-1 text-[11px] text-gray-500">{formatPlanSourceLabel(planSource)}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          Live
        </span>
      </div>

      <div className="mt-4 flex h-80 flex-col rounded-2xl border border-gray-100 bg-gray-50/60">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                  msg.role === "user" ? "bg-gray-900 text-white" : "bg-white text-gray-900 shadow-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-gray-100 p-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Paid ₦750,000 rent for Abuja office yesterday"
            rows={3}
            className="w-full resize-none rounded-2xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-gray-400"
          />
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>Enter to submit · Shift+Enter for newline</span>
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending}
              className="rounded-full bg-gray-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {isSending ? "Sending..." : "Push to tax engine"}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
