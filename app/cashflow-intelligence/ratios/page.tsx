"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { accountingEngine } from "@/lib/accounting/transactionBridge";
import type { StatementDraft } from "@/lib/accounting/types";
import { formatNaira } from "@/lib/cashflow/investmentCalculator";
import { generateFinancialRatiosPDF } from "@/lib/financialRatiosPdf";

function safeDivide(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

function formatPercentValue(value: number | null): string {
  if (value === null) return "n/a";
  return `${(value * 100).toFixed(2)}%`;
}

function formatMultiplier(value: number | null): string {
  if (value === null) return "n/a";
  return `${value.toFixed(2)}x`;
}

function KpiCard({ label, value, hint, accent }: { label: string; value: string; hint: string; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className={`text-xs font-semibold uppercase tracking-wide ${accent}`}>{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-3">{value}</p>
      <p className="text-xs text-gray-500 mt-2">{hint}</p>
    </div>
  );
}

function RatioRow({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-gray-50 px-3 py-2">
      <div>
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-1">{hint}</p>
      </div>
      <p className={`text-sm font-semibold ${tone || "text-gray-900"}`}>{value}</p>
    </div>
  );
}

export default function FinancialRatiosPage() {
  const [statements, setStatements] = useState<StatementDraft | null>(null);
  const [hasEntries, setHasEntries] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    accountingEngine.load();

    const sync = () => {
      const state = accountingEngine.getState();
      setHasEntries(state.journalEntries.length > 0);
      setStatements(accountingEngine.generateStatements());
    };

    sync();
    const unsubscribe = accountingEngine.subscribe(() => sync());

    const onAccountingUpdate = () => {
      accountingEngine.load();
      sync();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("accounting-update", onAccountingUpdate);
    }

    return () => {
      unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("accounting-update", onAccountingUpdate);
      }
    };
  }, []);

  const ratios = useMemo(() => {
    if (!statements) return null;

    const revenue = statements.revenue || 0;
    const grossProfit = statements.grossProfit || 0;
    const operatingIncome = statements.operatingIncome || 0;
    const netIncome = statements.netIncome || 0;
    const costOfSales = statements.costOfSales || 0;
    const operatingExpenses = statements.operatingExpenses || 0;
    const assets = statements.assets || 0;
    const liabilities = statements.liabilities || 0;
    const equity = statements.equity || 0;
    const cashFromOperations = statements.cashFromOperations || 0;

    return {
      revenue,
      grossProfit,
      operatingIncome,
      netIncome,
      costOfSales,
      operatingExpenses,
      assets,
      liabilities,
      equity,
      cashFromOperations,
      grossMargin: safeDivide(grossProfit, revenue),
      operatingMargin: safeDivide(operatingIncome, revenue),
      netMargin: safeDivide(netIncome, revenue),
      opexRatio: safeDivide(operatingExpenses, revenue),
      cogsRatio: safeDivide(costOfSales, revenue),
      cashflowMargin: safeDivide(cashFromOperations, revenue),
      assetTurnover: safeDivide(revenue, assets),
      debtToEquity: safeDivide(liabilities, equity),
      equityRatio: safeDivide(equity, assets),
      debtRatio: safeDivide(liabilities, assets),
    };
  }, [statements]);

  if (!statements) {
    return <div className="p-6 text-sm text-gray-500">Loading financial ratios...</div>;
  }

  if (!hasEntries) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Financial Ratios Dashboard</h1>
          <p className="text-gray-500 mt-2">Record transactions in Accounting first. Ratios will auto-populate from your ledgers.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/accounting" className="px-4 py-2 rounded-lg bg-[#2264ff] text-white text-sm font-semibold hover:bg-[#1a50cc]">
              Go to Accounting Chat
            </Link>
            <Link href="/accounting/workspace" className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Open Workspace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="projection-print-root space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Ratios Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Key profitability, efficiency, and solvency ratios derived from your live statements.</p>
          <Link href="/cashflow-intelligence" className="mt-2 inline-flex text-sm font-medium text-[#2264ff] hover:text-[#1a50cc]">
            Back to Financial Management
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              if (isDownloadingPdf || !statements) return;
              setIsDownloadingPdf(true);
              try {
                await generateFinancialRatiosPDF({
                  statements,
                  generatedAt: new Date().toISOString(),
                });
              } catch (error) {
                console.error("Ratios PDF export failed:", error);
                if (typeof window !== "undefined") {
                  window.alert("Could not generate the PDF right now. Please try again.");
                }
              } finally {
                setIsDownloadingPdf(false);
              }
            }}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V4h12v5M6 14H4a2 2 0 01-2-2v-1a3 3 0 013-3h14a3 3 0 013 3v1a2 2 0 01-2 2h-2M6 14v6h12v-6M9 18h6" />
            </svg>
            {isDownloadingPdf ? "Generating PDF..." : "Download PDF"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Gross Margin"
          value={formatPercentValue(ratios?.grossMargin ?? null)}
          hint="Gross profit as % of revenue"
          accent="text-indigo-600"
        />
        <KpiCard
          label="Operating Margin"
          value={formatPercentValue(ratios?.operatingMargin ?? null)}
          hint="Operating income as % of revenue"
          accent="text-emerald-600"
        />
        <KpiCard
          label="Net Margin"
          value={formatPercentValue(ratios?.netMargin ?? null)}
          hint="Net income as % of revenue"
          accent="text-blue-600"
        />
        <KpiCard
          label="Debt to Equity"
          value={formatMultiplier(ratios?.debtToEquity ?? null)}
          hint="Liabilities divided by equity"
          accent="text-rose-600"
        />
        <KpiCard
          label="Asset Turnover"
          value={formatMultiplier(ratios?.assetTurnover ?? null)}
          hint="Revenue per ₦1 of assets"
          accent="text-amber-600"
        />
        <KpiCard
          label="Equity Ratio"
          value={formatPercentValue(ratios?.equityRatio ?? null)}
          hint="Equity as % of assets"
          accent="text-fuchsia-600"
        />
        <KpiCard
          label="Cashflow Margin"
          value={formatPercentValue(ratios?.cashflowMargin ?? null)}
          hint="Operating cashflow as % of revenue"
          accent="text-cyan-600"
        />
        <KpiCard
          label="Debt Ratio"
          value={formatPercentValue(ratios?.debtRatio ?? null)}
          hint="Liabilities as % of assets"
          accent="text-slate-600"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 space-y-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Profitability Ratios</h2>
            <p className="text-xs text-gray-500 mt-1">Margins based on your income statement.</p>
          </div>
          <RatioRow label="Gross Margin" value={formatPercentValue(ratios?.grossMargin ?? null)} hint="(Revenue - COGS) / Revenue" />
          <RatioRow label="Operating Margin" value={formatPercentValue(ratios?.operatingMargin ?? null)} hint="Operating income / Revenue" />
          <RatioRow label="Net Margin" value={formatPercentValue(ratios?.netMargin ?? null)} hint="Net income / Revenue" />
          <RatioRow label="Operating Expense Ratio" value={formatPercentValue(ratios?.opexRatio ?? null)} hint="Operating expenses / Revenue" />
          <RatioRow label="COGS Ratio" value={formatPercentValue(ratios?.cogsRatio ?? null)} hint="Cost of sales / Revenue" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 space-y-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Efficiency Ratios</h2>
            <p className="text-xs text-gray-500 mt-1">How efficiently assets generate revenue.</p>
          </div>
          <RatioRow label="Asset Turnover" value={formatMultiplier(ratios?.assetTurnover ?? null)} hint="Revenue / Assets" />
          <RatioRow label="Cashflow Margin" value={formatPercentValue(ratios?.cashflowMargin ?? null)} hint="Operating cashflow / Revenue" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 space-y-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Leverage & Solvency</h2>
            <p className="text-xs text-gray-500 mt-1">Balance sheet structure and funding mix.</p>
          </div>
          <RatioRow label="Debt to Equity" value={formatMultiplier(ratios?.debtToEquity ?? null)} hint="Liabilities / Equity" />
          <RatioRow label="Debt Ratio" value={formatPercentValue(ratios?.debtRatio ?? null)} hint="Liabilities / Assets" />
          <RatioRow label="Equity Ratio" value={formatPercentValue(ratios?.equityRatio ?? null)} hint="Equity / Assets" />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 space-y-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Core Statement Figures</h2>
            <p className="text-xs text-gray-500 mt-1">Underlying numbers used in ratio calculations.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Revenue</p>
              <p className="font-semibold text-gray-900">{formatNaira(ratios?.revenue || 0)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Gross Profit</p>
              <p className="font-semibold text-gray-900">{formatNaira(ratios?.grossProfit || 0)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Operating Income</p>
              <p className="font-semibold text-gray-900">{formatNaira(ratios?.operatingIncome || 0)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Net Income</p>
              <p className="font-semibold text-gray-900">{formatNaira(ratios?.netIncome || 0)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Total Assets</p>
              <p className="font-semibold text-gray-900">{formatNaira(ratios?.assets || 0)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Total Liabilities</p>
              <p className="font-semibold text-gray-900">{formatNaira(ratios?.liabilities || 0)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Total Equity</p>
              <p className="font-semibold text-gray-900">{formatNaira(ratios?.equity || 0)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Cash From Ops</p>
              <p className="font-semibold text-gray-900">{formatNaira(ratios?.cashFromOperations || 0)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
