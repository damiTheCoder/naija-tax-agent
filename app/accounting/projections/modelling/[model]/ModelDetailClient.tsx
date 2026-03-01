"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FINANCIAL_MODELS, FINANCIAL_MODELS_BY_ID, type FinancialModelDefinition, type FinancialModelId } from "@/lib/financial/modellingCatalog";

const PROJECTIONS_CONTEXT_STORAGE_KEY = "ql::projections-context";

type InputKind = "currency" | "number" | "percent" | "integer";

type ModelInputDefinition = {
  key: string;
  label: string;
  helper: string;
  kind: InputKind;
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
};

type ModelMetric = {
  label: string;
  value: number | string;
  format?: InputKind | "months" | "text";
  hint?: string;
  tone?: "positive" | "negative" | "neutral";
};

type ModelTableSection = {
  title: string;
  rows: Array<{ label: string; value: string }>;
};

type BarItem = {
  label: string;
  value: number;
  color: string;
};

type ModelComputation = {
  metrics: ModelMetric[];
  bars?: {
    title: string;
    subtitle?: string;
    items: BarItem[];
  };
  tables: ModelTableSection[];
  summary: string;
};

type ModelTemplate = {
  inputs: ModelInputDefinition[];
  compute: (inputs: Record<string, number>) => ModelComputation;
};

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function pct(value: number): number {
  return value / 100;
}

function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

function clamp(value: number, min?: number, max?: number): number {
  let next = value;
  if (typeof min === "number") next = Math.max(min, next);
  if (typeof max === "number") next = Math.min(max, next);
  return next;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(Math.round(value || 0));
}

function formatCurrencyCompact(value: number): string {
  const absolute = Math.abs(value || 0);
  const sign = value < 0 ? "-" : "";

  if (absolute >= 1_000_000_000_000_000) {
    return `${sign}₦${numberFormatter.format(absolute / 1_000_000_000_000_000)}Q`;
  }
  if (absolute >= 1_000_000_000_000) {
    return `${sign}₦${numberFormatter.format(absolute / 1_000_000_000_000)}T`;
  }
  if (absolute >= 1_000_000_000) {
    return `${sign}₦${numberFormatter.format(absolute / 1_000_000_000)}B`;
  }
  if (absolute >= 1_000_000) {
    return `${sign}₦${numberFormatter.format(absolute / 1_000_000)}M`;
  }
  if (absolute >= 1_000) {
    return `${sign}₦${numberFormatter.format(absolute / 1_000)}K`;
  }
  return formatCurrency(value);
}

function formatPercent(value: number): string {
  return percentFormatter.format(value || 0);
}

function formatMetric(metric: ModelMetric): string {
  if (typeof metric.value === "string") return metric.value;
  switch (metric.format) {
    case "currency":
      return formatCurrencyCompact(metric.value);
    case "percent":
      return formatPercent(metric.value);
    case "months":
      return `${Math.max(0, Math.round(metric.value))} months`;
    case "integer":
      return Math.round(metric.value).toLocaleString("en-US");
    case "number":
      return numberFormatter.format(metric.value);
    default:
      return numberFormatter.format(metric.value);
  }
}

function formatInputValue(definition: ModelInputDefinition, value: number): string {
  switch (definition.kind) {
    case "currency":
      return formatCurrency(value);
    case "percent":
      return `${numberFormatter.format(value)}%`;
    case "integer":
      return Math.round(value).toLocaleString("en-US");
    case "number":
    default:
      return numberFormatter.format(value);
  }
}

function createInitialInputs(definitions: ModelInputDefinition[]): Record<string, number> {
  return definitions.reduce<Record<string, number>>((acc, item) => {
    acc[item.key] = item.defaultValue;
    return acc;
  }, {});
}

function toMonthLabels(count: number): string[] {
  const labels: string[] = [];
  let year = 2026;
  let month = 1;
  for (let i = 0; i < count; i += 1) {
    labels.push(new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-NG", { month: "short", year: "2-digit", timeZone: "UTC" }));
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return labels;
}

function buildModelIcon(icon: FinancialModelDefinition["icon"]) {
  const className = "w-4 h-4";
  switch (icon) {
    case "statements":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );
    case "forecast":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M4 18h16M6 15l4-4 3 3 5-6" />
        </svg>
      );
    case "dcf":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="8" />
          <path d="M9.2 14.8c.7.8 1.8 1.2 2.8 1.2 1.3 0 2.5-.8 2.5-2 0-2.7-5.2-1.6-5.2-4.3 0-1.2 1.1-2 2.4-2 1 0 1.9.3 2.6 1" />
        </svg>
      );
    case "budget":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M4 20h16M7 16V9M12 16V5M17 16v-3" />
        </svg>
      );
    case "startup":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M12 3l3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6z" />
        </svg>
      );
    case "cashflow":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M3 12h14M13 7l4 5-4 5" />
          <path d="M21 6v12" />
        </svg>
      );
    case "breakeven":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M4 18l6-6 3 3 7-8" />
          <path d="M4 20h16" />
        </svg>
      );
    case "scenario":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M4 6h16M4 12h10M4 18h16" />
          <circle cx="17" cy="12" r="2" />
        </svg>
      );
    case "valuation":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M12 3v18M7 8h7a2 2 0 110 4H10a2 2 0 100 4h7" />
        </svg>
      );
    case "unit":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="8" cy="8" r="3" />
          <circle cx="16" cy="16" r="3" />
          <path d="M10.5 10.5l3 3" />
        </svg>
      );
    default:
      return null;
  }
}

const MODEL_TEMPLATES: Record<FinancialModelId, ModelTemplate> = {
  "three-statement": {
    inputs: [
      { key: "revenue", label: "Revenue", helper: "Annual revenue assumption", kind: "currency", defaultValue: 240000000, min: 0, step: 1000 },
      { key: "cogsRate", label: "COGS %", helper: "Cost of goods sold as % of revenue", kind: "percent", defaultValue: 35, min: 0, max: 95, step: 0.1 },
      { key: "opex", label: "Operating Expenses", helper: "Annual operating expense base", kind: "currency", defaultValue: 85000000, min: 0, step: 1000 },
      { key: "depreciation", label: "Depreciation", helper: "Non-cash depreciation charge", kind: "currency", defaultValue: 6000000, min: 0, step: 1000 },
      { key: "interest", label: "Interest Expense", helper: "Annual finance cost", kind: "currency", defaultValue: 4500000, min: 0, step: 1000 },
      { key: "taxRate", label: "Tax Rate %", helper: "Effective tax rate on pre-tax income", kind: "percent", defaultValue: 20, min: 0, max: 60, step: 0.1 },
      { key: "capex", label: "Capex", helper: "Annual investment in assets", kind: "currency", defaultValue: 12000000, min: 0, step: 1000 },
      { key: "workingCapitalChange", label: "Delta Working Capital", helper: "Increase in receivables/inventory less payables", kind: "currency", defaultValue: 2500000, step: 1000 },
      { key: "debtDrawdown", label: "Debt Drawdown", helper: "New debt raised during period", kind: "currency", defaultValue: 5000000, min: 0, step: 1000 },
      { key: "debtRepayment", label: "Debt Repayment", helper: "Principal repaid during period", kind: "currency", defaultValue: 3000000, min: 0, step: 1000 },
      { key: "openingCash", label: "Opening Cash", helper: "Cash at start of period", kind: "currency", defaultValue: 22000000, min: 0, step: 1000 },
      { key: "openingDebt", label: "Opening Debt", helper: "Debt outstanding at start", kind: "currency", defaultValue: 18000000, min: 0, step: 1000 },
      { key: "openingEquity", label: "Opening Equity", helper: "Equity at start", kind: "currency", defaultValue: 26000000, min: 0, step: 1000 },
    ],
    compute: (inputs) => {
      const revenue = inputs.revenue;
      const cogs = revenue * pct(inputs.cogsRate);
      const grossProfit = revenue - cogs;
      const ebitda = grossProfit - inputs.opex;
      const ebit = ebitda - inputs.depreciation;
      const ebt = ebit - inputs.interest;
      const tax = Math.max(0, ebt * pct(inputs.taxRate));
      const netIncome = ebt - tax;

      const cfo = netIncome + inputs.depreciation - inputs.workingCapitalChange;
      const cfi = -inputs.capex;
      const cff = inputs.debtDrawdown - inputs.debtRepayment;
      const netCashChange = cfo + cfi + cff;
      const endingCash = inputs.openingCash + netCashChange;

      // Derive closing non-cash operating assets so A = L + E reconciles under the same assumptions.
      const openingNetOperatingAssets = inputs.openingDebt + inputs.openingEquity - inputs.openingCash;
      const closingNetOperatingAssets =
        openingNetOperatingAssets + inputs.capex - inputs.depreciation + inputs.workingCapitalChange;
      const totalAssets = endingCash + closingNetOperatingAssets;
      const endingDebt = inputs.openingDebt + inputs.debtDrawdown - inputs.debtRepayment;
      const endingEquity = inputs.openingEquity + netIncome;
      const liabilitiesAndEquity = endingDebt + endingEquity;
      const balanceGap = totalAssets - liabilitiesAndEquity;

      return {
        metrics: [
          { label: "Net Income", value: netIncome, format: "currency", tone: netIncome >= 0 ? "positive" : "negative" },
          { label: "Ending Cash", value: endingCash, format: "currency", tone: endingCash >= 0 ? "positive" : "negative" },
          { label: "EBITDA Margin", value: safeDivide(ebitda, revenue), format: "percent" },
          { label: "Balance Check Gap", value: balanceGap, format: "currency", tone: Math.abs(balanceGap) < 5000 ? "positive" : "negative", hint: "Close to 0 means statements reconcile." },
        ],
        bars: {
          title: "Cash Flow Components",
          subtitle: "Operating, investing, financing and total change",
          items: [
            { label: "CFO", value: cfo, color: "#2264ff" },
            { label: "CFI", value: cfi, color: "#8b5cf6" },
            { label: "CFF", value: cff, color: "#f59e0b" },
            { label: "Net", value: netCashChange, color: netCashChange >= 0 ? "#10b981" : "#ef4444" },
          ],
        },
        tables: [
          {
            title: "Income Statement",
            rows: [
              { label: "Revenue", value: formatCurrency(revenue) },
              { label: "COGS", value: formatCurrency(cogs) },
              { label: "Gross Profit", value: formatCurrency(grossProfit) },
              { label: "Operating Expenses", value: formatCurrency(inputs.opex) },
              { label: "EBITDA", value: formatCurrency(ebitda) },
              { label: "Depreciation", value: formatCurrency(inputs.depreciation) },
              { label: "EBIT", value: formatCurrency(ebit) },
              { label: "Interest", value: formatCurrency(inputs.interest) },
              { label: "Tax", value: formatCurrency(tax) },
              { label: "Net Income", value: formatCurrency(netIncome) },
            ],
          },
          {
            title: "Cash Flow",
            rows: [
              { label: "Cash Flow from Operations", value: formatCurrency(cfo) },
              { label: "Cash Flow from Investing", value: formatCurrency(cfi) },
              { label: "Cash Flow from Financing", value: formatCurrency(cff) },
              { label: "Net Change in Cash", value: formatCurrency(netCashChange) },
              { label: "Ending Cash", value: formatCurrency(endingCash) },
            ],
          },
          {
            title: "Balance Sheet (Simplified)",
            rows: [
              { label: "Net Operating Assets (ex-cash)", value: formatCurrency(closingNetOperatingAssets) },
              { label: "Total Assets", value: formatCurrency(totalAssets) },
              { label: "Debt", value: formatCurrency(endingDebt) },
              { label: "Equity", value: formatCurrency(endingEquity) },
              { label: "Liabilities + Equity", value: formatCurrency(liabilitiesAndEquity) },
            ],
          },
        ],
        summary: `Three-statement model computed: revenue ${formatCurrency(revenue)}, net income ${formatCurrency(netIncome)}, ending cash ${formatCurrency(endingCash)}.`,
      };
    },
  },
  "forecast-model": {
    inputs: [
      { key: "currentRevenue", label: "Current Monthly Revenue", helper: "Baseline monthly revenue", kind: "currency", defaultValue: 18000000, min: 0, step: 1000 },
      { key: "growthRate", label: "Monthly Growth %", helper: "Compounded monthly growth", kind: "percent", defaultValue: 6.5, min: -10, max: 40, step: 0.1 },
      { key: "grossMargin", label: "Gross Margin %", helper: "Revenue retained after direct costs", kind: "percent", defaultValue: 58, min: 0, max: 95, step: 0.1 },
      { key: "opex", label: "Monthly Opex", helper: "Current monthly operating expense", kind: "currency", defaultValue: 6200000, min: 0, step: 1000 },
      { key: "opexGrowth", label: "Monthly Opex Growth %", helper: "Cost inflation/growth", kind: "percent", defaultValue: 2.4, min: -10, max: 35, step: 0.1 },
      { key: "months", label: "Forecast Months", helper: "Forecast horizon", kind: "integer", defaultValue: 18, min: 6, max: 36, step: 1 },
    ],
    compute: (inputs) => {
      const months = Math.round(clamp(inputs.months, 6, 36));
      const labels = toMonthLabels(months);
      const revenues: number[] = [];
      const nets: number[] = [];
      const expenses: number[] = [];

      let revenue = inputs.currentRevenue;
      let opex = inputs.opex;

      for (let i = 0; i < months; i += 1) {
        if (i > 0) {
          revenue *= 1 + pct(inputs.growthRate);
          opex *= 1 + pct(inputs.opexGrowth);
        }
        const grossProfit = revenue * pct(inputs.grossMargin);
        const net = grossProfit - opex;

        revenues.push(revenue);
        expenses.push(opex);
        nets.push(net);
      }

      const annualizedRevenue = sum(revenues.slice(0, Math.min(12, months)));
      const annualizedNet = sum(nets.slice(0, Math.min(12, months)));
      const growthTotal = safeDivide(revenues[revenues.length - 1] - revenues[0], revenues[0]);

      return {
        metrics: [
          { label: "Projected Revenue (12M)", value: annualizedRevenue, format: "currency" },
          { label: "Projected Net (12M)", value: annualizedNet, format: "currency", tone: annualizedNet >= 0 ? "positive" : "negative" },
          { label: "Revenue Growth", value: growthTotal, format: "percent" },
          { label: "Average Monthly Net", value: average(nets), format: "currency", tone: average(nets) >= 0 ? "positive" : "negative" },
        ],
        bars: {
          title: "Forecast Net by Month",
          subtitle: "Positive bars are profitable months",
          items: labels.map((label, index) => ({ label, value: nets[index], color: nets[index] >= 0 ? "#10b981" : "#ef4444" })),
        },
        tables: [
          {
            title: "Forecast Snapshot",
            rows: labels.slice(0, 12).map((label, index) => ({
              label,
              value: `Revenue ${formatCurrency(revenues[index])} | Opex ${formatCurrency(expenses[index])} | Net ${formatCurrency(nets[index])}`,
            })),
          },
        ],
        summary: `Forecast model run for ${months} months. Ending monthly revenue ${formatCurrency(revenues[revenues.length - 1])}, average monthly net ${formatCurrency(average(nets))}.`,
      };
    },
  },
  "dcf-model": {
    inputs: [
      { key: "year1Revenue", label: "Year 1 Revenue", helper: "Starting annual revenue", kind: "currency", defaultValue: 420000000, min: 0, step: 1000 },
      { key: "revenueGrowth", label: "Revenue Growth %", helper: "Annual revenue growth", kind: "percent", defaultValue: 14, min: -20, max: 80, step: 0.1 },
      { key: "ebitMargin", label: "EBIT Margin %", helper: "Operating margin before tax", kind: "percent", defaultValue: 24, min: -10, max: 70, step: 0.1 },
      { key: "taxRate", label: "Tax Rate %", helper: "Effective tax rate", kind: "percent", defaultValue: 20, min: 0, max: 60, step: 0.1 },
      { key: "capexRate", label: "Capex % of Revenue", helper: "Annual capex as share of revenue", kind: "percent", defaultValue: 6, min: 0, max: 40, step: 0.1 },
      { key: "wcRate", label: "Working Capital %", helper: "Incremental working capital intensity", kind: "percent", defaultValue: 3, min: 0, max: 40, step: 0.1 },
      { key: "discountRate", label: "Discount Rate (WACC) %", helper: "Discount rate for cash flows", kind: "percent", defaultValue: 18, min: 1, max: 50, step: 0.1 },
      { key: "terminalGrowth", label: "Terminal Growth %", helper: "Perpetual growth after explicit forecast", kind: "percent", defaultValue: 4, min: 0, max: 10, step: 0.1 },
      { key: "years", label: "Forecast Years", helper: "Explicit projection horizon", kind: "integer", defaultValue: 5, min: 3, max: 10, step: 1 },
      { key: "netDebt", label: "Net Debt", helper: "Debt minus cash", kind: "currency", defaultValue: 68000000, min: 0, step: 1000 },
    ],
    compute: (inputs) => {
      const years = Math.round(clamp(inputs.years, 3, 10));
      const discountRate = pct(inputs.discountRate);
      const terminalGrowth = pct(inputs.terminalGrowth);
      const adjustedDiscountRate = Math.max(discountRate, 0.01);
      const adjustedTerminalGrowth = Math.max(0, Math.min(terminalGrowth, adjustedDiscountRate - 0.005));

      let revenue = inputs.year1Revenue;
      let previousRevenue = 0;
      const pvCashFlows: number[] = [];
      const fcfSeries: number[] = [];

      for (let year = 1; year <= years; year += 1) {
        if (year > 1) {
          revenue *= 1 + pct(inputs.revenueGrowth);
        }

        const ebit = revenue * pct(inputs.ebitMargin);
        const nopat = ebit * (1 - pct(inputs.taxRate));
        const capex = revenue * pct(inputs.capexRate);
        const depreciation = capex * 0.6;
        const wcDelta = (revenue - previousRevenue) * pct(inputs.wcRate);
        const freeCashFlow = nopat + depreciation - capex - wcDelta;
        const pv = freeCashFlow / Math.pow(1 + adjustedDiscountRate, year);

        fcfSeries.push(freeCashFlow);
        pvCashFlows.push(pv);

        previousRevenue = revenue;
      }

      const lastFcf = fcfSeries[fcfSeries.length - 1] || 0;
      const terminalSpread = Math.max(0.005, adjustedDiscountRate - adjustedTerminalGrowth);
      const terminalValue = (lastFcf * (1 + adjustedTerminalGrowth)) / terminalSpread;
      const pvTerminal = terminalValue / Math.pow(1 + adjustedDiscountRate, years);

      const enterpriseValue = sum(pvCashFlows) + pvTerminal;
      const equityValue = enterpriseValue - inputs.netDebt;

      return {
        metrics: [
          { label: "Enterprise Value", value: enterpriseValue, format: "currency" },
          { label: "Equity Value", value: equityValue, format: "currency", tone: equityValue >= 0 ? "positive" : "negative" },
          { label: "PV of FCF", value: sum(pvCashFlows), format: "currency" },
          { label: "PV of Terminal", value: pvTerminal, format: "currency" },
        ],
        bars: {
          title: "Discounted Free Cash Flow by Year",
          subtitle: "PV of each projected cash flow",
          items: pvCashFlows.map((value, index) => ({ label: `Y${index + 1}`, value, color: "#2264ff" })),
        },
        tables: [
          {
            title: "DCF Components",
            rows: [
              { label: "Sum PV(FCF)", value: formatCurrency(sum(pvCashFlows)) },
              {
                label: "Terminal Growth Used",
                value: `${numberFormatter.format(adjustedTerminalGrowth * 100)}%`,
              },
              { label: "Terminal Value", value: formatCurrency(terminalValue) },
              { label: "PV(Terminal Value)", value: formatCurrency(pvTerminal) },
              { label: "Enterprise Value", value: formatCurrency(enterpriseValue) },
              { label: "Net Debt", value: formatCurrency(inputs.netDebt) },
              { label: "Equity Value", value: formatCurrency(equityValue) },
            ],
          },
        ],
        summary: `DCF model completed for ${years} years. Enterprise value ${formatCurrency(enterpriseValue)}, equity value ${formatCurrency(equityValue)}.`,
      };
    },
  },
  "budget-model": {
    inputs: [
      { key: "budgetRevenue", label: "Budget Revenue", helper: "Planned revenue for period", kind: "currency", defaultValue: 260000000, min: 0, step: 1000 },
      { key: "actualRevenue", label: "Actual Revenue", helper: "Realized revenue for period", kind: "currency", defaultValue: 242000000, min: 0, step: 1000 },
      { key: "budgetPayroll", label: "Budget Payroll", helper: "Planned payroll", kind: "currency", defaultValue: 68000000, min: 0, step: 1000 },
      { key: "actualPayroll", label: "Actual Payroll", helper: "Actual payroll", kind: "currency", defaultValue: 71000000, min: 0, step: 1000 },
      { key: "budgetMarketing", label: "Budget Marketing", helper: "Planned marketing spend", kind: "currency", defaultValue: 28000000, min: 0, step: 1000 },
      { key: "actualMarketing", label: "Actual Marketing", helper: "Actual marketing spend", kind: "currency", defaultValue: 33500000, min: 0, step: 1000 },
      { key: "budgetOps", label: "Budget Operations", helper: "Planned operations spend", kind: "currency", defaultValue: 42000000, min: 0, step: 1000 },
      { key: "actualOps", label: "Actual Operations", helper: "Actual operations spend", kind: "currency", defaultValue: 39800000, min: 0, step: 1000 },
    ],
    compute: (inputs) => {
      const budgetExpense = inputs.budgetPayroll + inputs.budgetMarketing + inputs.budgetOps;
      const actualExpense = inputs.actualPayroll + inputs.actualMarketing + inputs.actualOps;
      const budgetNet = inputs.budgetRevenue - budgetExpense;
      const actualNet = inputs.actualRevenue - actualExpense;
      const netVariance = actualNet - budgetNet;
      const revenueVariance = inputs.actualRevenue - inputs.budgetRevenue;
      const expenseVariance = actualExpense - budgetExpense;

      return {
        metrics: [
          { label: "Budget Net", value: budgetNet, format: "currency" },
          { label: "Actual Net", value: actualNet, format: "currency", tone: actualNet >= budgetNet ? "positive" : "negative" },
          { label: "Net Variance", value: netVariance, format: "currency", tone: netVariance >= 0 ? "positive" : "negative" },
          { label: "Expense Overrun", value: safeDivide(expenseVariance, budgetExpense), format: "percent", tone: expenseVariance <= 0 ? "positive" : "negative" },
        ],
        bars: {
          title: "Budget vs Actual Variance",
          subtitle: "Positive is favorable, negative is unfavorable",
          items: [
            { label: "Revenue", value: revenueVariance, color: revenueVariance >= 0 ? "#10b981" : "#ef4444" },
            { label: "Payroll", value: inputs.budgetPayroll - inputs.actualPayroll, color: inputs.actualPayroll <= inputs.budgetPayroll ? "#10b981" : "#ef4444" },
            { label: "Marketing", value: inputs.budgetMarketing - inputs.actualMarketing, color: inputs.actualMarketing <= inputs.budgetMarketing ? "#10b981" : "#ef4444" },
            { label: "Operations", value: inputs.budgetOps - inputs.actualOps, color: inputs.actualOps <= inputs.budgetOps ? "#10b981" : "#ef4444" },
          ],
        },
        tables: [
          {
            title: "Budget Performance",
            rows: [
              { label: "Revenue (Budget vs Actual)", value: `${formatCurrency(inputs.budgetRevenue)} vs ${formatCurrency(inputs.actualRevenue)}` },
              { label: "Payroll (Budget vs Actual)", value: `${formatCurrency(inputs.budgetPayroll)} vs ${formatCurrency(inputs.actualPayroll)}` },
              { label: "Marketing (Budget vs Actual)", value: `${formatCurrency(inputs.budgetMarketing)} vs ${formatCurrency(inputs.actualMarketing)}` },
              { label: "Operations (Budget vs Actual)", value: `${formatCurrency(inputs.budgetOps)} vs ${formatCurrency(inputs.actualOps)}` },
              { label: "Total Expense (Budget vs Actual)", value: `${formatCurrency(budgetExpense)} vs ${formatCurrency(actualExpense)}` },
            ],
          },
        ],
        summary: `Budget model variance: budget net ${formatCurrency(budgetNet)}, actual net ${formatCurrency(actualNet)}, variance ${formatCurrency(netVariance)}.`,
      };
    },
  },
  "startup-model": {
    inputs: [
      { key: "startingCustomers", label: "Starting Customers", helper: "Active customers at month 0", kind: "integer", defaultValue: 450, min: 0, step: 1 },
      { key: "newCustomers", label: "New Customers / Month", helper: "Baseline acquisition per month", kind: "integer", defaultValue: 120, min: 0, step: 1 },
      { key: "acquisitionGrowth", label: "Acquisition Growth %", helper: "Growth in monthly new customers", kind: "percent", defaultValue: 4.2, min: -20, max: 50, step: 0.1 },
      { key: "churnRate", label: "Monthly Churn %", helper: "Churn on active customer base", kind: "percent", defaultValue: 5.5, min: 0, max: 90, step: 0.1 },
      { key: "arpu", label: "ARPU", helper: "Average revenue per user per month", kind: "currency", defaultValue: 14000, min: 0, step: 100 },
      { key: "variableCostPerCustomer", label: "Variable Cost / Customer", helper: "Monthly variable servicing cost", kind: "currency", defaultValue: 4200, min: 0, step: 100 },
      { key: "fixedBurn", label: "Fixed Burn / Month", helper: "Monthly fixed burn excluding variable costs", kind: "currency", defaultValue: 5000000, min: 0, step: 1000 },
      { key: "cashOnHand", label: "Cash on Hand", helper: "Available cash at model start", kind: "currency", defaultValue: 58000000, min: 0, step: 1000 },
      { key: "months", label: "Projection Months", helper: "Simulation horizon", kind: "integer", defaultValue: 18, min: 6, max: 36, step: 1 },
    ],
    compute: (inputs) => {
      const months = Math.round(clamp(inputs.months, 6, 36));
      const labels = toMonthLabels(months);

      let customers = inputs.startingCustomers;
      let newCustomers = inputs.newCustomers;
      let cash = inputs.cashOnHand;

      const monthlyNet: number[] = [];
      const monthlyCash: number[] = [];

      for (let i = 0; i < months; i += 1) {
        if (i > 0) {
          newCustomers *= 1 + pct(inputs.acquisitionGrowth);
        }
        const churned = customers * pct(inputs.churnRate);
        customers = Math.max(0, customers + newCustomers - churned);

        const revenue = customers * inputs.arpu;
        const variableCost = customers * inputs.variableCostPerCustomer;
        const net = revenue - variableCost - inputs.fixedBurn;

        cash += net;
        monthlyNet.push(net);
        monthlyCash.push(cash);
      }

      let runwayMonths: number | null = null;
      for (let i = 0; i < monthlyCash.length; i += 1) {
        if (monthlyCash[i] <= 0) {
          runwayMonths = i + 1;
          break;
        }
      }

      return {
        metrics: [
          { label: "Ending Customers", value: Math.round(customers), format: "integer" },
          { label: "Ending Cash", value: cash, format: "currency", tone: cash >= 0 ? "positive" : "negative" },
          { label: "Average Monthly Net", value: average(monthlyNet), format: "currency", tone: average(monthlyNet) >= 0 ? "positive" : "negative" },
          {
            label: "Runway",
            value: runwayMonths === null ? `>${months}` : runwayMonths,
            format: runwayMonths === null ? "text" : "months",
            hint: runwayMonths ? "Months before cash turns negative" : `No cash-out within ${months} months`,
            tone: runwayMonths ? "negative" : "positive",
          },
        ],
        bars: {
          title: "Monthly Net Cashflow",
          subtitle: "Startup burn versus growth contribution",
          items: labels.map((label, index) => ({ label, value: monthlyNet[index], color: monthlyNet[index] >= 0 ? "#10b981" : "#ef4444" })),
        },
        tables: [
          {
            title: "Cash Trajectory",
            rows: labels.slice(0, 12).map((label, index) => ({
              label,
              value: `Net ${formatCurrency(monthlyNet[index])} | Cash ${formatCurrency(monthlyCash[index])}`,
            })),
          },
        ],
        summary: `Startup model projected ${months} months. Ending customers ${Math.round(customers).toLocaleString("en-US")}, ending cash ${formatCurrency(cash)}.`,
      };
    },
  },
  "cash-flow-model": {
    inputs: [
      { key: "openingCash", label: "Opening Cash", helper: "Cash at start of period", kind: "currency", defaultValue: 34000000, min: 0, step: 1000 },
      { key: "operatingInflow", label: "Operating Inflow", helper: "Cash collected from customers", kind: "currency", defaultValue: 58000000, min: 0, step: 1000 },
      { key: "operatingOutflow", label: "Operating Outflow", helper: "Cash paid to suppliers, payroll, opex", kind: "currency", defaultValue: 46000000, min: 0, step: 1000 },
      { key: "investingInflow", label: "Investing Inflow", helper: "Asset sales or investment returns", kind: "currency", defaultValue: 1800000, min: 0, step: 1000 },
      { key: "investingOutflow", label: "Investing Outflow", helper: "Capex and long-term investments", kind: "currency", defaultValue: 6400000, min: 0, step: 1000 },
      { key: "financingInflow", label: "Financing Inflow", helper: "Debt/equity raised", kind: "currency", defaultValue: 10000000, min: 0, step: 1000 },
      { key: "financingOutflow", label: "Financing Outflow", helper: "Loan repayments/dividends", kind: "currency", defaultValue: 5200000, min: 0, step: 1000 },
    ],
    compute: (inputs) => {
      const operatingNet = inputs.operatingInflow - inputs.operatingOutflow;
      const investingNet = inputs.investingInflow - inputs.investingOutflow;
      const financingNet = inputs.financingInflow - inputs.financingOutflow;
      const netCashMovement = operatingNet + investingNet + financingNet;
      const endingCash = inputs.openingCash + netCashMovement;

      return {
        metrics: [
          { label: "Net Operating Cash", value: operatingNet, format: "currency", tone: operatingNet >= 0 ? "positive" : "negative" },
          { label: "Net Investing Cash", value: investingNet, format: "currency", tone: investingNet >= 0 ? "positive" : "negative" },
          { label: "Net Financing Cash", value: financingNet, format: "currency", tone: financingNet >= 0 ? "positive" : "negative" },
          { label: "Ending Cash", value: endingCash, format: "currency", tone: endingCash >= 0 ? "positive" : "negative" },
        ],
        bars: {
          title: "Cash Flow Waterfall",
          subtitle: "Positive bars add cash; negative bars reduce cash",
          items: [
            { label: "Operating", value: operatingNet, color: operatingNet >= 0 ? "#10b981" : "#ef4444" },
            { label: "Investing", value: investingNet, color: investingNet >= 0 ? "#10b981" : "#ef4444" },
            { label: "Financing", value: financingNet, color: financingNet >= 0 ? "#10b981" : "#ef4444" },
            { label: "Total", value: netCashMovement, color: netCashMovement >= 0 ? "#2264ff" : "#ef4444" },
          ],
        },
        tables: [
          {
            title: "Cash Movement Summary",
            rows: [
              { label: "Opening Cash", value: formatCurrency(inputs.openingCash) },
              { label: "Net Cash from Operations", value: formatCurrency(operatingNet) },
              { label: "Net Cash from Investing", value: formatCurrency(investingNet) },
              { label: "Net Cash from Financing", value: formatCurrency(financingNet) },
              { label: "Net Change in Cash", value: formatCurrency(netCashMovement) },
              { label: "Ending Cash", value: formatCurrency(endingCash) },
            ],
          },
        ],
        summary: `Cash flow model: net movement ${formatCurrency(netCashMovement)}, ending cash ${formatCurrency(endingCash)}.`,
      };
    },
  },
  "break-even-model": {
    inputs: [
      { key: "pricePerUnit", label: "Price per Unit", helper: "Selling price per unit", kind: "currency", defaultValue: 42000, min: 0, step: 100 },
      { key: "variableCostPerUnit", label: "Variable Cost per Unit", helper: "Direct cost per unit", kind: "currency", defaultValue: 17000, min: 0, step: 100 },
      { key: "fixedCosts", label: "Fixed Costs", helper: "Total fixed costs per period", kind: "currency", defaultValue: 28000000, min: 0, step: 1000 },
      { key: "expectedUnits", label: "Expected Units", helper: "Expected sales volume", kind: "integer", defaultValue: 1450, min: 0, step: 1 },
    ],
    compute: (inputs) => {
      const contributionPerUnit = inputs.pricePerUnit - inputs.variableCostPerUnit;
      const contributionMarginRatio = safeDivide(contributionPerUnit, inputs.pricePerUnit);
      const hasPositiveContribution = contributionPerUnit > 0;
      const breakEvenUnits = hasPositiveContribution ? inputs.fixedCosts / contributionPerUnit : Number.POSITIVE_INFINITY;
      const breakEvenRevenue = hasPositiveContribution ? breakEvenUnits * inputs.pricePerUnit : Number.POSITIVE_INFINITY;
      const marginOfSafety = hasPositiveContribution
        ? safeDivide(inputs.expectedUnits - breakEvenUnits, inputs.expectedUnits)
        : -1;
      const expectedProfit = (inputs.expectedUnits * contributionPerUnit) - inputs.fixedCosts;

      return {
        metrics: [
          { label: "Break-even Units", value: hasPositiveContribution ? breakEvenUnits : "Not reachable", format: hasPositiveContribution ? "integer" : "text" },
          { label: "Break-even Revenue", value: hasPositiveContribution ? breakEvenRevenue : "Not reachable", format: hasPositiveContribution ? "currency" : "text" },
          { label: "Contribution Margin", value: contributionMarginRatio, format: "percent" },
          { label: "Expected Profit", value: expectedProfit, format: "currency", tone: expectedProfit >= 0 ? "positive" : "negative" },
        ],
        bars: {
          title: "Unit Economics to Break-even",
          subtitle: "Price, variable cost, and contribution per unit",
          items: [
            { label: "Price", value: inputs.pricePerUnit, color: "#2264ff" },
            { label: "Variable Cost", value: inputs.variableCostPerUnit, color: "#ef4444" },
            { label: "Contribution", value: contributionPerUnit, color: contributionPerUnit >= 0 ? "#10b981" : "#ef4444" },
          ],
        },
        tables: [
          {
            title: "Break-even Equations",
            rows: [
              { label: "Contribution per Unit", value: `${formatCurrency(inputs.pricePerUnit)} - ${formatCurrency(inputs.variableCostPerUnit)} = ${formatCurrency(contributionPerUnit)}` },
              {
                label: "Break-even Units",
                value: hasPositiveContribution
                  ? `${formatCurrency(inputs.fixedCosts)} / ${formatCurrency(contributionPerUnit)} = ${Math.round(breakEvenUnits).toLocaleString("en-US")}`
                  : "Not reachable while contribution per unit is zero or negative",
              },
              { label: "Break-even Revenue", value: hasPositiveContribution ? formatCurrency(breakEvenRevenue) : "Not reachable" },
              { label: "Margin of Safety", value: formatPercent(marginOfSafety) },
            ],
          },
        ],
        summary: hasPositiveContribution
          ? `Break-even reached at ${Math.round(breakEvenUnits).toLocaleString("en-US")} units (${formatCurrency(breakEvenRevenue)}).`
          : "Break-even is not reachable under the current price and variable-cost assumptions.",
      };
    },
  },
  "scenario-model": {
    inputs: [
      { key: "baseRevenue", label: "Base Revenue", helper: "Revenue in base case", kind: "currency", defaultValue: 320000000, min: 0, step: 1000 },
      { key: "baseCosts", label: "Base Costs", helper: "Costs in base case", kind: "currency", defaultValue: 256000000, min: 0, step: 1000 },
      { key: "revenueUpside", label: "Upside Revenue %", helper: "Revenue uplift in best case", kind: "percent", defaultValue: 18, min: 0, max: 100, step: 0.1 },
      { key: "revenueDownside", label: "Downside Revenue %", helper: "Revenue decline in worst case", kind: "percent", defaultValue: 15, min: 0, max: 100, step: 0.1 },
      { key: "costEfficiency", label: "Best-case Cost Savings %", helper: "Cost reduction in best case", kind: "percent", defaultValue: 8, min: 0, max: 50, step: 0.1 },
      { key: "costShock", label: "Worst-case Cost Shock %", helper: "Cost increase in worst case", kind: "percent", defaultValue: 12, min: 0, max: 60, step: 0.1 },
    ],
    compute: (inputs) => {
      const baseProfit = inputs.baseRevenue - inputs.baseCosts;

      const bestRevenue = inputs.baseRevenue * (1 + pct(inputs.revenueUpside));
      const bestCosts = inputs.baseCosts * (1 - pct(inputs.costEfficiency));
      const bestProfit = bestRevenue - bestCosts;

      const worstRevenue = inputs.baseRevenue * (1 - pct(inputs.revenueDownside));
      const worstCosts = inputs.baseCosts * (1 + pct(inputs.costShock));
      const worstProfit = worstRevenue - worstCosts;

      const downsideVsBase = worstProfit - baseProfit;
      const upsideVsBase = bestProfit - baseProfit;

      return {
        metrics: [
          { label: "Best-case Profit", value: bestProfit, format: "currency", tone: "positive" },
          { label: "Base-case Profit", value: baseProfit, format: "currency", tone: baseProfit >= 0 ? "positive" : "negative" },
          { label: "Worst-case Profit", value: worstProfit, format: "currency", tone: worstProfit >= 0 ? "positive" : "negative" },
          { label: "Downside Impact vs Base", value: downsideVsBase, format: "currency", tone: downsideVsBase >= 0 ? "positive" : "negative" },
        ],
        bars: {
          title: "Scenario Profit Comparison",
          subtitle: "Risk planning view across scenarios",
          items: [
            { label: "Best", value: bestProfit, color: "#10b981" },
            { label: "Base", value: baseProfit, color: "#2264ff" },
            { label: "Worst", value: worstProfit, color: "#ef4444" },
            { label: "Upside vs Base", value: upsideVsBase, color: "#22c55e" },
          ],
        },
        tables: [
          {
            title: "Scenario Details",
            rows: [
              { label: "Best Case", value: `Revenue ${formatCurrency(bestRevenue)} | Costs ${formatCurrency(bestCosts)} | Profit ${formatCurrency(bestProfit)}` },
              { label: "Base Case", value: `Revenue ${formatCurrency(inputs.baseRevenue)} | Costs ${formatCurrency(inputs.baseCosts)} | Profit ${formatCurrency(baseProfit)}` },
              { label: "Worst Case", value: `Revenue ${formatCurrency(worstRevenue)} | Costs ${formatCurrency(worstCosts)} | Profit ${formatCurrency(worstProfit)}` },
            ],
          },
        ],
        summary: `Scenario model comparison completed. Base ${formatCurrency(baseProfit)}, best ${formatCurrency(bestProfit)}, worst ${formatCurrency(worstProfit)}.`,
      };
    },
  },
  "valuation-model": {
    inputs: [
      { key: "annualRevenue", label: "Annual Revenue", helper: "Latest annual revenue", kind: "currency", defaultValue: 520000000, min: 0, step: 1000 },
      { key: "revenueMultiple", label: "Revenue Multiple", helper: "Comparable revenue multiple", kind: "number", defaultValue: 2.4, min: 0.1, max: 20, step: 0.1 },
      { key: "ebitda", label: "EBITDA", helper: "Latest annual EBITDA", kind: "currency", defaultValue: 128000000, min: 0, step: 1000 },
      { key: "ebitdaMultiple", label: "EBITDA Multiple", helper: "Comparable EBITDA multiple", kind: "number", defaultValue: 7.2, min: 0.1, max: 30, step: 0.1 },
      { key: "netIncome", label: "Net Income", helper: "Latest annual net income", kind: "currency", defaultValue: 82000000, min: 0, step: 1000 },
      { key: "peMultiple", label: "P/E Multiple", helper: "Market earnings multiple", kind: "number", defaultValue: 11.5, min: 1, max: 50, step: 0.1 },
      { key: "netDebt", label: "Net Debt", helper: "Debt minus cash", kind: "currency", defaultValue: 70000000, min: 0, step: 1000 },
    ],
    compute: (inputs) => {
      const revenueBasedEV = inputs.annualRevenue * inputs.revenueMultiple;
      const ebitdaBasedEV = inputs.ebitda * inputs.ebitdaMultiple;
      const earningsBasedEquity = inputs.netIncome * inputs.peMultiple;
      const earningsBasedEV = earningsBasedEquity + inputs.netDebt;

      const enterpriseBlend = average([revenueBasedEV, ebitdaBasedEV, earningsBasedEV]);
      const equityBlend = enterpriseBlend - inputs.netDebt;

      const lowEquity = Math.min(revenueBasedEV, ebitdaBasedEV, earningsBasedEV) - inputs.netDebt;
      const highEquity = Math.max(revenueBasedEV, ebitdaBasedEV, earningsBasedEV) - inputs.netDebt;

      return {
        metrics: [
          { label: "Blended Enterprise Value", value: enterpriseBlend, format: "currency" },
          { label: "Blended Equity Value", value: equityBlend, format: "currency", tone: "positive" },
          { label: "Valuation Range (Low)", value: lowEquity, format: "currency" },
          { label: "Valuation Range (High)", value: highEquity, format: "currency" },
        ],
        bars: {
          title: "Valuation by Method",
          subtitle: "Enterprise value before net debt adjustment",
          items: [
            { label: "Revenue", value: revenueBasedEV, color: "#2264ff" },
            { label: "EBITDA", value: ebitdaBasedEV, color: "#8b5cf6" },
            { label: "Earnings", value: earningsBasedEV, color: "#10b981" },
          ],
        },
        tables: [
          {
            title: "Valuation Methods",
            rows: [
              { label: `Revenue (${inputs.revenueMultiple}x)`, value: formatCurrency(revenueBasedEV) },
              { label: `EBITDA (${inputs.ebitdaMultiple}x)`, value: formatCurrency(ebitdaBasedEV) },
              { label: `Earnings (${inputs.peMultiple}x P/E)`, value: formatCurrency(earningsBasedEV) },
              { label: "Net Debt", value: formatCurrency(inputs.netDebt) },
              { label: "Blended Equity Value", value: formatCurrency(equityBlend) },
            ],
          },
        ],
        summary: `Valuation model generated blended equity value of ${formatCurrency(equityBlend)} with range ${formatCurrency(lowEquity)} to ${formatCurrency(highEquity)}.`,
      };
    },
  },
  "unit-economics-model": {
    inputs: [
      { key: "arpu", label: "ARPU", helper: "Average monthly revenue per customer", kind: "currency", defaultValue: 14500, min: 0, step: 100 },
      { key: "grossMargin", label: "Gross Margin %", helper: "Gross margin per customer", kind: "percent", defaultValue: 68, min: 0, max: 95, step: 0.1 },
      { key: "supportCost", label: "Support Cost / Customer", helper: "Monthly support/service cost per customer", kind: "currency", defaultValue: 2100, min: 0, step: 100 },
      { key: "churnRate", label: "Monthly Churn %", helper: "Customer churn for lifetime calculation", kind: "percent", defaultValue: 4.8, min: 0.1, max: 90, step: 0.1 },
      { key: "cac", label: "CAC", helper: "Customer acquisition cost", kind: "currency", defaultValue: 42000, min: 0, step: 100 },
      { key: "newCustomers", label: "New Customers / Month", helper: "Expected monthly acquired customers", kind: "integer", defaultValue: 320, min: 0, step: 1 },
    ],
    compute: (inputs) => {
      const grossProfitPerCustomer = inputs.arpu * pct(inputs.grossMargin);
      const contributionPerCustomer = grossProfitPerCustomer - inputs.supportCost;
      const churn = pct(inputs.churnRate);
      const ltv = churn > 0 ? safeDivide(contributionPerCustomer, churn) : contributionPerCustomer * 48;
      const ltvCac = safeDivide(ltv, inputs.cac);
      const paybackMonths = contributionPerCustomer > 0 ? safeDivide(inputs.cac, contributionPerCustomer) : null;
      const cohortProfit = (ltv - inputs.cac) * inputs.newCustomers;

      return {
        metrics: [
          { label: "LTV", value: ltv, format: "currency" },
          { label: "CAC", value: inputs.cac, format: "currency" },
          { label: "LTV / CAC", value: ltvCac, format: "number", tone: ltvCac >= 3 ? "positive" : "negative" },
          {
            label: "Payback",
            value: paybackMonths === null ? "No payback" : paybackMonths,
            format: paybackMonths === null ? "text" : "months",
            tone: paybackMonths !== null && paybackMonths <= 12 ? "positive" : "negative",
          },
        ],
        bars: {
          title: "Unit Economics Components",
          subtitle: "Monthly customer-level economics",
          items: [
            { label: "ARPU", value: inputs.arpu, color: "#2264ff" },
            { label: "Gross Profit", value: grossProfitPerCustomer, color: "#10b981" },
            { label: "Contribution", value: contributionPerCustomer, color: contributionPerCustomer >= 0 ? "#10b981" : "#ef4444" },
            { label: "CAC", value: inputs.cac, color: "#f59e0b" },
          ],
        },
        tables: [
          {
            title: "Customer Profitability",
            rows: [
              { label: "Gross Profit / Customer", value: formatCurrency(grossProfitPerCustomer) },
              { label: "Contribution / Customer", value: formatCurrency(contributionPerCustomer) },
              { label: "LTV", value: formatCurrency(ltv) },
              { label: "CAC", value: formatCurrency(inputs.cac) },
              { label: "Monthly New-Customer Cohort Value", value: formatCurrency(cohortProfit) },
            ],
          },
        ],
        summary: `Unit economics model: LTV ${formatCurrency(ltv)}, CAC ${formatCurrency(inputs.cac)}, LTV/CAC ${numberFormatter.format(ltvCac)}${paybackMonths === null ? ", no payback under current contribution." : `, payback ${numberFormatter.format(paybackMonths)} months.`}`,
      };
    },
  },
};

function InputField({
  definition,
  value,
  onValueChange,
}: {
  definition: ModelInputDefinition;
  value: number;
  onValueChange: (next: number) => void;
}) {
  const displayValue = definition.kind === "percent" ? value : value;

  return (
    <label className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">{definition.label}</span>
      <div className="mt-2 flex w-full items-center gap-2">
        {definition.kind === "currency" ? <span className="shrink-0 text-sm text-gray-500">NGN</span> : null}
        <input
          type="number"
          value={Number.isFinite(displayValue) ? displayValue : 0}
          min={definition.min}
          max={definition.max}
          step={definition.step ?? (definition.kind === "integer" ? 1 : 0.1)}
          onChange={(event) => {
            const raw = Number(event.target.value);
            if (!Number.isFinite(raw)) return;
            const nextRaw = definition.kind === "integer" ? Math.round(raw) : raw;
            const next = clamp(nextRaw, definition.min, definition.max);
            onValueChange(next);
          }}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#2264ff] focus:outline-none focus:ring-2 focus:ring-[#2264ff]/20"
        />
        {definition.kind === "percent" ? <span className="shrink-0 text-sm text-gray-500">%</span> : null}
      </div>
      <span className="mt-1 block text-xs text-gray-500">{definition.helper}</span>
    </label>
  );
}

function MetricCard({ metric }: { metric: ModelMetric }) {
  const toneClass =
    metric.tone === "positive"
      ? "text-emerald-600"
      : metric.tone === "negative"
        ? "text-rose-600"
        : "text-gray-900";

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">{metric.label}</p>
      <p className={`mt-2 text-2xl font-semibold leading-tight break-words ${toneClass}`} title={typeof metric.value === "number" ? formatCurrency(metric.value) : metric.value}>
        {formatMetric(metric)}
      </p>
      {metric.hint ? <p className="mt-1 text-xs text-gray-500">{metric.hint}</p> : null}
    </article>
  );
}

function BarsPanel({ title, subtitle, items }: { title: string; subtitle?: string; items: BarItem[] }) {
  const maxAbs = Math.max(...items.map((item) => Math.abs(item.value)), 1);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const widthPct = Math.max(4, (Math.abs(item.value) / maxAbs) * 100);
          return (
            <div key={item.label}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs text-gray-600">
                <span className="truncate">{item.label}</span>
                <span className="max-w-[12rem] truncate text-right" title={formatCurrency(item.value)}>
                  {formatCurrencyCompact(item.value)}
                </span>
              </div>
              <div className="mt-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${widthPct}%`, background: item.color, opacity: item.value === 0 ? 0.2 : 1 }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OutputTable({ section }: { section: ModelTableSection }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="text-base font-semibold text-gray-900">{section.title}</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-2 pr-3 font-medium">Line Item</th>
              <th className="py-2 pr-3 font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row) => (
              <tr key={`${section.title}-${row.label}`} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-3 text-gray-700">{row.label}</td>
                <td className="py-2 pr-3 text-gray-900">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ModelSwitcher({ activeId }: { activeId: FinancialModelId }) {
  return (
    <div className="flex flex-wrap gap-2">
      {FINANCIAL_MODELS.map((model) => (
        <Link
          key={model.id}
          href={`/accounting/projections/modelling/${model.id}`}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${activeId === model.id
            ? "border-[#2264ff] bg-[#2264ff]/10 text-[#2264ff]"
            : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
        >
          {buildModelIcon(model.icon)}
          <span>{model.name}</span>
        </Link>
      ))}
    </div>
  );
}

export default function ModelDetailClient({ modelId }: { modelId: string }) {
  const fallbackModelId: FinancialModelId = "three-statement";
  const isKnownModel = modelId in FINANCIAL_MODELS_BY_ID && modelId in MODEL_TEMPLATES;
  const typedModelId = (isKnownModel ? modelId : fallbackModelId) as FinancialModelId;
  const modelMeta = FINANCIAL_MODELS_BY_ID[typedModelId];
  const template = MODEL_TEMPLATES[typedModelId];

  const [inputs, setInputs] = useState<Record<string, number>>(() => createInitialInputs(template.inputs));
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    setInputs(createInitialInputs(template.inputs));
  }, [typedModelId, template]);

  const computation = useMemo(() => template.compute(inputs), [template, inputs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const topMetrics = computation.metrics
      .slice(0, 3)
      .map((metric) => `${metric.label}: ${formatMetric(metric)}`)
      .join(" | ");
    const topInputs = template.inputs
      .slice(0, 4)
      .map((definition) => `${definition.label}: ${formatInputValue(definition, inputs[definition.key] ?? 0)}`)
      .join(" | ");

    const context = [
      "Context: model",
      `Updated at: ${new Date().toISOString()}`,
      `Financial Modelling: ${modelMeta.name}`,
      `Purpose: ${modelMeta.purpose}`,
      `Summary: ${computation.summary}`,
      `Top metrics: ${topMetrics}`,
      topInputs ? `Key inputs: ${topInputs}` : "",
    ].join("\n");

    try {
      window.localStorage.setItem(PROJECTIONS_CONTEXT_STORAGE_KEY, context);
    } catch {
      // no-op
    }
  }, [computation, inputs, modelMeta.name, modelMeta.purpose, template.inputs]);

  if (!isKnownModel) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-lg font-semibold text-gray-900">Model not found</p>
        <Link href="/accounting/projections/modelling" className="mt-4 inline-flex text-sm font-medium text-[#2264ff] hover:text-[#1a50cc]">
          Back to Model Hub
        </Link>
      </div>
    );
  }

  const handleDownloadPdf = async () => {
    if (isDownloadingPdf) return;

    setIsDownloadingPdf(true);
    try {
      const assumptions = template.inputs.map((definition) => ({
        key: definition.key,
        label: definition.label,
        helper: definition.helper,
        kind: definition.kind,
        value: inputs[definition.key] ?? 0,
        formattedValue: formatInputValue(definition, inputs[definition.key] ?? 0),
      }));

      const response = await fetch("/api/projections/model-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: typedModelId,
          modelName: modelMeta.name,
          purpose: modelMeta.purpose,
          description: modelMeta.description,
          summary: computation.summary,
          assumptions,
          metrics: computation.metrics.map((metric) => ({
            label: metric.label,
            value: formatMetric(metric),
            hint: metric.hint || "",
          })),
          tables: computation.tables,
        }),
      });

      if (!response.ok) {
        throw new Error(`PDF export failed (${response.status})`);
      }

      const blob = await response.blob();
      const filename = `${typedModelId}-model-report.pdf`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Model PDF export failed:", error);
      if (typeof window !== "undefined") {
        window.alert("Could not generate PDF right now. Please try again.");
      }
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{modelMeta.name}</h1>
          <p className="text-sm text-gray-500 mt-1">{modelMeta.purpose}. {modelMeta.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            title="Download this model as PDF"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M5 19h14" />
            </svg>
            {isDownloadingPdf ? "Generating PDF..." : "Download PDF"}
          </button>
        </div>
        <ModelSwitcher activeId={typedModelId} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <section className="xl:col-span-2 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">Assumptions</h2>
          <p className="mt-1 text-sm text-gray-500">Update inputs to recalculate this model instantly.</p>
          <div className="mt-4 space-y-3 max-h-[620px] overflow-y-auto pr-1">
            {template.inputs.map((definition) => (
              <InputField
                key={definition.key}
                definition={definition}
                value={inputs[definition.key] ?? 0}
                onValueChange={(next) =>
                  setInputs((prev) => ({
                    ...prev,
                    [definition.key]: next,
                  }))
                }
              />
            ))}
          </div>
        </section>

        <div className="xl:col-span-3 space-y-4">
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {computation.metrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </section>

          {computation.bars ? <BarsPanel title={computation.bars.title} subtitle={computation.bars.subtitle} items={computation.bars.items} /> : null}

          <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <h3 className="text-sm font-semibold text-blue-900">Model Summary</h3>
            <p className="mt-1 text-sm text-blue-800">{computation.summary}</p>
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {computation.tables.map((section) => (
          <OutputTable key={section.title} section={section} />
        ))}
      </div>
    </div >
  );
}
