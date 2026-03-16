"use client";

import { FormEvent, useMemo, useState } from "react";
import { formatNairaCompact } from "@/lib/budgeting/engine";
import { useBudgetingData } from "@/lib/budgeting/useBudgetingData";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const makeId = () => Math.random().toString(36).slice(2, 10);

function buildResponse(input: string, context: {
  runwayMonths: number;
  totalRemaining: number;
  overBudgetCount: number;
  topOverBudgetName?: string;
}) {
  const query = input.toLowerCase();

  if (query.includes("hire") || query.includes("employee")) {
    if (context.runwayMonths < 6) {
      return `Current runway is ${context.runwayMonths.toFixed(1)} months, so hiring now is high-risk. Reduce non-critical spend first.`;
    }
    return `Runway is ${context.runwayMonths.toFixed(1)} months. You can consider hiring if monthly cost fits within remaining budget (${formatNairaCompact(context.totalRemaining)}).`;
  }

  if (query.includes("overspend") || query.includes("over budget")) {
    if (context.overBudgetCount === 0) {
      return "No budgets are currently over budget. Continue monitoring warning categories weekly.";
    }
    return `${context.overBudgetCount} budget(s) are over limit. Highest pressure is ${context.topOverBudgetName || "your leading budget"}. Reallocate or cut spend immediately.`;
  }

  if (query.includes("runway") || query.includes("cash")) {
    return `Projected runway is ${context.runwayMonths.toFixed(1)} months with ${formatNairaCompact(context.totalRemaining)} remaining budget capacity.`;
  }

  return "Recommendation: prioritize categories above 85% utilization, reduce low-ROI spend by 10%, and review weekly variance to prevent budget overruns.";
}

export default function AIBudgetAssistantPage() {
  const { isReady, totals, forecast, performanceRows } = useBudgetingData();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: makeId(),
      role: "assistant",
      text: "Ask me about budget risks, affordability, runway, or optimization actions.",
    },
  ]);

  const context = useMemo(() => {
    const topOver = [...performanceRows]
      .filter((row) => row.status === "over")
      .sort((a, b) => b.utilizationPercent - a.utilizationPercent)[0];

    return {
      runwayMonths: forecast.runway.runwayMonths,
      totalRemaining: totals.totalRemaining,
      overBudgetCount: totals.overBudgetCount,
      topOverBudgetName: topOver?.budgetName,
    };
  }, [forecast.runway.runwayMonths, totals.totalRemaining, totals.overBudgetCount, performanceRows]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    const assistantText = buildResponse(userText, context);

    setMessages((prev) => [
      ...prev,
      { id: makeId(), role: "user", text: userText },
      { id: makeId(), role: "assistant", text: assistantText },
    ]);

    setInput("");
  };

  if (!isReady) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading assistant...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Budget Assistant</h1>
        <p className="text-sm text-gray-500">Get optimization suggestions, affordability checks, and overspending prevention guidance.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-gray-500">Runway</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{forecast.runway.runwayMonths.toFixed(1)} months</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-gray-500">Remaining Budget</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{formatNairaCompact(totals.totalRemaining)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-gray-500">Over Budget</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{totals.overBudgetCount}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="max-h-[22rem] space-y-3 overflow-y-auto pr-1">
          {messages.map((message) => (
            <div key={message.id} className={`rounded-xl px-4 py-3 text-sm ${message.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}>
              {message.text}
            </div>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="flex-1 rounded-xl border border-gray-300 px-3 py-2"
            placeholder="Can I afford to hire a new employee?"
          />
          <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
