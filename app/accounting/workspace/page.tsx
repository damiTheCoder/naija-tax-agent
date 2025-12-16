"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AutomationStatus,
  BANK_PROVIDERS,
  deriveTrialBalancePreview,
  deriveWorkspaceFiles,
  mockAutomationClient,
} from "@/lib/accounting/automationAgent";
import { RawTransaction } from "@/lib/accounting/types";

export default function WorkspacePage() {
  const [transactions, setTransactions] = useState<RawTransaction[]>([]);
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus>("idle");
  const [automationConfidence, setAutomationConfidence] = useState(0.82);
  const [isSyncing, setIsSyncing] = useState(false);
  const workspaceFiles = useMemo(() => deriveWorkspaceFiles(transactions), [transactions]);
  const trialBalancePreview = useMemo(() => deriveTrialBalancePreview(transactions), [transactions]);
  const trialBalanceTotals = useMemo(
    () =>
      trialBalancePreview.reduce(
        (acc, row) => {
          acc.debit += row.debit;
          acc.credit += row.credit;
          return acc;
        },
        { debit: 0, credit: 0 },
      ),
    [trialBalancePreview],
  );
  const automationConfidencePercent = Math.round(automationConfidence * 100);
  const coverageLabel = transactions.length ? `${transactions.length.toLocaleString()} journals live` : "Waiting for sync";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cachedTransactions = window.localStorage.getItem("taxy::accounting-transactions");
    if (cachedTransactions) {
      try {
        const parsed = JSON.parse(cachedTransactions);
        if (Array.isArray(parsed)) {
          setTransactions(parsed);
        }
      } catch {
        // ignore malformed cache
      }
    }
    const storedConfidence = window.localStorage.getItem("taxy::automation-confidence");
    if (storedConfidence) {
      const numeric = parseFloat(storedConfidence);
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

  const handleRefresh = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setAutomationStatus("syncing");
    try {
      const update = await mockAutomationClient.runSync(transactions, BANK_PROVIDERS[0]);
      if (update.generatedTransactions?.length) {
        setTransactions((prev) => [...prev, ...update.generatedTransactions!]);
      }
      setAutomationConfidence((prev) => Math.min(0.99, prev + 0.02));
      setAutomationStatus(update.status);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-10">
      <header className="rounded-[32px] border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Files workspace</p>
            <h1 className="text-3xl font-black text-gray-900">All your journals, ledgers, and statements in one room.</h1>
            <p className="text-sm text-gray-600">
              This view mirrors what the AI streams from your bank feeds. Tweak entries back in the Accounting Studio chat — updates land here instantly.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm text-gray-600">
            <span className="rounded-full border border-gray-200 px-4 py-1 text-xs font-semibold text-gray-700">
              Status: {automationStatus}
            </span>
            <span className="text-xs uppercase tracking-[0.3em] text-gray-400">Confidence {automationConfidencePercent}%</span>
            <span className="text-xs text-gray-500">{coverageLabel}</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
          <button
            className="rounded-full bg-gray-900 px-5 py-2 text-white disabled:opacity-60"
            onClick={handleRefresh}
            disabled={isSyncing}
          >
            {isSyncing ? "Refreshing..." : "Refresh from automation"}
          </button>
          <Link href="/accounting" className="rounded-full border border-gray-300 px-5 py-2 text-gray-800 hover:bg-slate-50">
            Back to Accounting Studio
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {workspaceFiles.map((file) => (
          <div
            key={file.slug}
            id={file.slug}
            className="rounded-3xl bg-[#f3f4f6] p-5 shadow-sm"
            data-intent="workspace-file-card"
          >
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-gray-400">
              <span className="rounded-full border border-gray-200 px-3 py-1 text-[10px] font-semibold">{file.badge}</span>
              <span className="text-[11px] text-gray-500">{file.meta}</span>
            </div>
            <p className="mt-2 text-xl font-semibold text-gray-900">{file.title}</p>
            <p className="text-sm text-gray-600">{file.subtitle}</p>
            <p className="mt-3 text-xs text-gray-500">
              Hook up the backend to stream the actual doc into this slot. For now, it mirrors the AI-prepared preview.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <Link href="/accounting#manual-journal" className="rounded-full bg-[#faff00] px-3 py-1 text-black shadow-sm hover:opacity-90">
                Edit via chat
              </Link>
              <button className="rounded-full bg-[#faff00] px-3 py-1 text-black shadow-sm" type="button">
                Download (coming soon)
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.6fr_0.4fr]">
        <div className="rounded-3xl border border-gray-100 bg-slate-50/80 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Trial balance preview</p>
              <p className="text-sm text-gray-600">Debits and credits from the latest sync.</p>
            </div>
            <button
              className="rounded-full border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-white disabled:opacity-50"
              onClick={handleRefresh}
              disabled={isSyncing}
            >
              Refresh
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm text-gray-700">
              <thead className="text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="text-left py-2">Account</th>
                  <th className="text-right py-2">Debit</th>
                  <th className="text-right py-2">Credit</th>
                </tr>
              </thead>
              <tbody>
                {trialBalancePreview.map((row) => (
                  <tr key={row.account} className="border-t border-gray-100">
                    <td className="py-2 capitalize">{row.account.replace(/_/g, " ")}</td>
                    <td className="py-2 text-right text-emerald-600">₦{row.debit.toLocaleString()}</td>
                    <td className="py-2 text-right text-rose-500">₦{row.credit.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200 text-xs font-semibold text-gray-600">
                <tr>
                  <td className="py-2">Totals</td>
                  <td className="py-2 text-right">₦{trialBalanceTotals.debit.toLocaleString()}</td>
                  <td className="py-2 text-right">₦{trialBalanceTotals.credit.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white/80 p-5">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Next steps</p>
          <p className="mt-2 text-lg font-semibold text-gray-900">Keep humans in the loop</p>
          <p className="text-sm text-gray-600">
            Every automated journal stays editable. Use the chat to annotate context, upload supporting docs, or trigger exports to the tax engine.
          </p>
          <div className="mt-4 space-y-2">
            <Link href="/accounting#manual-journal" className="block rounded-full bg-gray-900 px-4 py-2 text-center text-sm font-semibold text-white">
              Post a manual adjustment
            </Link>
            <button className="w-full rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800" type="button">
              Export workspace (coming soon)
            </button>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            When you plug in the backend automation, swap the mock client in <code>automationAgent.ts</code> with your API calls and this room becomes live.
          </p>
        </div>
      </section>
    </div>
  );
}
