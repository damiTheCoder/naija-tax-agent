"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { accountingEngine, type AccountingState } from "@/lib/accounting/transactionBridge";
import type { JournalEntry, JournalLine } from "@/lib/accounting/doubleEntry";

const CASH_ACCOUNT_CODES = new Set(["1000", "1010", "1020", "1021"]);

type Scenario = "conservative" | "expected" | "aggressive";

type ProjectionPoint = {
  key: string;
  label: string;
  date: Date;
  revenue: number;
  cogs: number;
  fixedCosts: number;
  variableCosts: number;
  marketingCosts: number;
  operatingExpenses: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  ebitda: number;
  grossMarginPct: number;
  netMarginPct: number;
  cashInflow: number;
  cashOutflow: number;
  netCashflow: number;
  burnRate: number;
  cashBalance: number;
  kind: "actual" | "projected";
};

type RevenueBreakdown = {
  stream: string;
  amount: number;
};

type ExpenseBreakdown = {
  category: string;
  amount: number;
  nature: "fixed" | "variable";
  isCogs: boolean;
};

type ProjectionAssumptions = {
  revenueGrowthRate: number;
  operatingExpenseGrowthRate: number;
  cogsRatio: number;
  variableCostRatio: number;
  fixedCostBaseline: number;
  fixedCostInflationRate: number;
  cashCollectionRatio: number;
  cashDisbursementRatio: number;
  marketingSpendRatio: number;
  customerGrowthProxy: number;
  pricingPerRevenueEntry: number;
  salesConversionRateProxy: number;
};

type ProjectionOutput = {
  monthly_revenue: number[];
  monthly_cogs: number[];
  monthly_opex: number[];
  monthly_net_profit: number[];
  monthly_cash_flow: number[];
  monthly_cash_balance: number[];
  total_revenue: number;
  total_profit: number;
  burn_rate: number;
  runway: number;
  break_even_month: number | null;
  break_even_revenue: number | null;
  projection_status: "VALID" | "INVALID";
  error_message: string | null;
};

type ProjectionComputationResult = {
  points: ProjectionPoint[];
  output: ProjectionOutput;
  validationIssues: string[];
  baseline: {
    baselineRevenueMonthly: number;
    startingCash: number;
  };
};

type EditableAssumptionKey =
  | "revenueGrowthRate"
  | "operatingExpenseGrowthRate"
  | "fixedCostInflationRate"
  | "cogsRatio"
  | "variableCostRatio"
  | "marketingSpendRatio"
  | "cashCollectionRatio"
  | "cashDisbursementRatio"
  | "fixedCostBaseline";

type ProjectionAssumptionConfig = {
  label: string;
  min: number;
  max: number;
  kind: "percent" | "ratio" | "currency";
  aliases: string[];
};

type ProjectionActionUpdate = {
  key: string;
  value: number;
  unit?: string;
};

const PROJECTIONS_CONTEXT_STORAGE_KEY = "ql::projections-context";
const PROJECTIONS_UPDATE_EVENT = "ql:projections-assumptions-update";
const PROJECTIONS_RESET_EVENT = "ql:projections-assumptions-reset";

const PROJECTION_ASSUMPTION_CONFIG: Record<EditableAssumptionKey, ProjectionAssumptionConfig> = {
  revenueGrowthRate: {
    label: "Revenue Growth Rate",
    min: -0.2,
    max: 0.6,
    kind: "percent",
    aliases: ["revenue growth", "rev growth", "sales growth", "growth rate"],
  },
  operatingExpenseGrowthRate: {
    label: "Operating Expense Growth",
    min: -0.1,
    max: 0.35,
    kind: "percent",
    aliases: ["operating expense growth", "opex growth", "expense growth"],
  },
  fixedCostInflationRate: {
    label: "Fixed Cost Inflation",
    min: 0,
    max: 0.15,
    kind: "percent",
    aliases: ["fixed cost inflation", "fixed inflation"],
  },
  cogsRatio: {
    label: "COGS Ratio",
    min: 0.01,
    max: 0.9,
    kind: "percent",
    aliases: ["cogs ratio", "cost of sales ratio", "cogs"],
  },
  variableCostRatio: {
    label: "Variable Cost Ratio",
    min: 0.01,
    max: 0.9,
    kind: "percent",
    aliases: ["variable cost ratio", "variable costs"],
  },
  marketingSpendRatio: {
    label: "Marketing Spend",
    min: 0,
    max: 0.5,
    kind: "percent",
    aliases: ["marketing spend", "marketing ratio", "marketing"],
  },
  cashCollectionRatio: {
    label: "Cash Collection Ratio",
    min: 0.4,
    max: 1.6,
    kind: "ratio",
    aliases: ["cash collection ratio", "collection ratio", "collection"],
  },
  cashDisbursementRatio: {
    label: "Cash Disbursement Ratio",
    min: 0.4,
    max: 1.7,
    kind: "ratio",
    aliases: ["cash disbursement ratio", "disbursement ratio", "disbursement"],
  },
  fixedCostBaseline: {
    label: "Fixed Cost Baseline",
    min: 0,
    max: 100000000000,
    kind: "currency",
    aliases: ["fixed cost baseline", "fixed baseline", "fixed cost"],
  },
};

const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const nairaCompactFormatter = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formatNaira = (value: number): string => {
  const safeValue = Number.isFinite(value) ? value : 0;
  const absolute = Math.abs(safeValue);
  const sign = safeValue < 0 ? "-" : "";

  if (absolute >= 1_000_000_000_000) {
    return `${sign}₦${nairaCompactFormatter.format(absolute / 1_000_000_000_000)}t`;
  }
  if (absolute >= 1_000_000_000) {
    return `${sign}₦${nairaCompactFormatter.format(absolute / 1_000_000_000)}b`;
  }
  if (absolute >= 1_000_000) {
    return `${sign}₦${nairaCompactFormatter.format(absolute / 1_000_000)}m`;
  }

  return nairaFormatter.format(Math.round(safeValue || 0));
};
const formatPercent = (value: number): string => percentFormatter.format(value);

function normalizeAssumptionToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveEditableAssumptionKey(raw: string): EditableAssumptionKey | null {
  const normalized = normalizeAssumptionToken(raw);
  const direct = (Object.keys(PROJECTION_ASSUMPTION_CONFIG) as EditableAssumptionKey[]).find(
    (key) => {
      const normalizedKey = normalizeAssumptionToken(key);
      return normalizedKey === normalized || normalizedKey.includes(normalized) || normalized.includes(normalizedKey);
    }
  );
  if (direct) return direct;

  for (const key of Object.keys(PROJECTION_ASSUMPTION_CONFIG) as EditableAssumptionKey[]) {
    const config = PROJECTION_ASSUMPTION_CONFIG[key];
    if (
      config.aliases.some((alias) => {
        const normalizedAlias = normalizeAssumptionToken(alias);
        return (
          normalizedAlias === normalized ||
          normalizedAlias.includes(normalized) ||
          normalized.includes(normalizedAlias)
        );
      })
    ) {
      return key;
    }
  }

  return null;
}

function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return numerator / denominator;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeAssumptionValue(
  key: EditableAssumptionKey,
  rawValue: number,
  rawUnit?: unknown
): number {
  const config = PROJECTION_ASSUMPTION_CONFIG[key];
  const unit = typeof rawUnit === "string" ? rawUnit.toLowerCase() : "";
  let value = rawValue;

  if (config.kind === "percent") {
    const looksPercent = unit === "percent" || unit === "%" || Math.abs(value) > 1;
    if (looksPercent) value = value / 100;
  } else if (config.kind === "ratio") {
    const looksPercent = unit === "percent" || unit === "%" || unit === "pct";
    if (looksPercent) value = value / 100;
  }

  return clamp(value, config.min, config.max);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageGrowthRate(values: number[]): number {
  if (values.length < 2) return 0;
  const growthRates: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    const previous = values[i - 1];
    const current = values[i];
    if (previous > 0) {
      growthRates.push((current - previous) / previous);
    }
  }
  return growthRates.length ? average(growthRates) : 0;
}

function toMonthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthKeyToDate(key: string): Date {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, 1));
}

function shiftMonthKey(key: string, offset: number): string {
  const date = monthKeyToDate(key);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return toMonthKey(date);
}

function monthLabel(key: string): string {
  return monthKeyToDate(key).toLocaleDateString("en-NG", { month: "short" });
}

function inferRevenueStream(line: JournalLine): string {
  const code = line.accountCode;
  if (code === "4000") return "Product Sales";
  if (code === "4010") return "Service Revenue";
  if (code === "4020") return "Contract Revenue";
  if (["4200", "4210", "4220", "4300", "4400", "4500"].includes(code)) return "Other Income";
  return line.accountName || "Other Income";
}

function classifyExpenseLine(line: JournalLine): {
  category: string;
  nature: "fixed" | "variable";
  isCogs: boolean;
} {
  const code = line.accountCode;
  if (code.startsWith("50")) {
    return { category: "Cost of Sales", nature: "variable", isCogs: true };
  }
  if (code.startsWith("55")) {
    return { category: "Payroll", nature: "fixed", isCogs: false };
  }
  if (code.startsWith("56")) {
    return { category: "Facilities", nature: "fixed", isCogs: false };
  }
  if (code.startsWith("57")) {
    return { category: "Depreciation & Amortization", nature: "fixed", isCogs: false };
  }
  if (code.startsWith("58") || code.startsWith("59")) {
    return { category: "Professional & Admin", nature: "fixed", isCogs: false };
  }
  if (code.startsWith("60")) {
    return { category: "Marketing & Admin", nature: "variable", isCogs: false };
  }
  if (code.startsWith("65")) {
    return { category: "Finance Costs", nature: "fixed", isCogs: false };
  }
  if (code.startsWith("70")) {
    return { category: "Taxes & Levies", nature: "fixed", isCogs: false };
  }
  return { category: "Other Operating", nature: "variable", isCogs: false };
}

function getCashBalanceSnapshot(state: AccountingState | null): number {
  if (!state) return 0;
  return Array.from(CASH_ACCOUNT_CODES).reduce((sum, code) => {
    const account = state.ledgerAccounts.get(code);
    return sum + (account?.closingBalance || 0);
  }, 0);
}

function deriveBreakdowns(entries: JournalEntry[]): {
  revenueStreams: RevenueBreakdown[];
  expenseCategories: ExpenseBreakdown[];
  fixedExpenseTotal: number;
  variableExpenseTotal: number;
  cogsTotal: number;
  marketingSpendTotal: number;
  revenueEntryCount: number;
} {
  const posted = entries.filter((entry) => entry.status !== "voided");
  const revenueMap = new Map<string, number>();
  const expenseMap = new Map<string, { amount: number; nature: "fixed" | "variable"; isCogs: boolean }>();

  let fixedExpenseTotal = 0;
  let variableExpenseTotal = 0;
  let cogsTotal = 0;
  let marketingSpendTotal = 0;
  let revenueEntryCount = 0;

  for (const entry of posted) {
    for (const line of entry.lines) {
      if (line.accountCode.startsWith("4")) {
        const amount = Math.max(0, (line.credit || 0) - (line.debit || 0));
        if (amount <= 0) continue;
        const stream = inferRevenueStream(line);
        revenueMap.set(stream, (revenueMap.get(stream) || 0) + amount);
        revenueEntryCount += 1;
      }

      if (line.accountCode.startsWith("5") || line.accountCode.startsWith("6") || line.accountCode.startsWith("7")) {
        const amount = Math.max(0, (line.debit || 0) - (line.credit || 0));
        if (amount <= 0) continue;
        const classification = classifyExpenseLine(line);
        const current = expenseMap.get(classification.category) || {
          amount: 0,
          nature: classification.nature,
          isCogs: classification.isCogs,
        };
        current.amount += amount;
        expenseMap.set(classification.category, current);

        if (classification.isCogs) {
          cogsTotal += amount;
        } else if (classification.nature === "fixed") {
          fixedExpenseTotal += amount;
        } else {
          variableExpenseTotal += amount;
        }

        if (classification.category === "Marketing & Admin") {
          marketingSpendTotal += amount;
        }
      }
    }
  }

  return {
    revenueStreams: Array.from(revenueMap.entries())
      .map(([stream, amount]) => ({ stream, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6),
    expenseCategories: Array.from(expenseMap.entries())
      .map(([category, values]) => ({ category, ...values }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8),
    fixedExpenseTotal,
    variableExpenseTotal,
    cogsTotal,
    marketingSpendTotal,
    revenueEntryCount,
  };
}

function buildActualSeries(entries: JournalEntry[], statements: { revenue: number; costOfSales: number; operatingExpenses: number; cashFromOperations: number; cashFromInvesting: number; cashFromFinancing: number } | null, closingCashBalance: number): ProjectionPoint[] {
  const posted = entries.filter((entry) => entry.status !== "voided");
  const monthly = new Map<
    string,
    {
      revenue: number;
      cogs: number;
      fixedCosts: number;
      variableCosts: number;
      depreciation: number;
      amortization: number;
      interest: number;
      taxes: number;
      cashInflow: number;
      cashOutflow: number;
    }
  >();

  for (const entry of posted) {
    const key = toMonthKey(new Date(entry.date));
    const current = monthly.get(key) || {
      revenue: 0,
      cogs: 0,
      fixedCosts: 0,
      variableCosts: 0,
      depreciation: 0,
      amortization: 0,
      interest: 0,
      taxes: 0,
      cashInflow: 0,
      cashOutflow: 0,
    };

    for (const line of entry.lines) {
      const code = line.accountCode;
      const debit = line.debit || 0;
      const credit = line.credit || 0;

      if (code.startsWith("4")) {
        current.revenue += Math.max(0, credit - debit);
      }

      if (code.startsWith("5") || code.startsWith("6") || code.startsWith("7")) {
        const amount = Math.max(0, debit - credit);
        if (amount > 0) {
          const classification = classifyExpenseLine(line);
          if (classification.isCogs) {
            current.cogs += amount;
          } else if (classification.nature === "fixed") {
            current.fixedCosts += amount;
          } else {
            current.variableCosts += amount;
          }

          if (code === "5700") current.depreciation += amount;
          if (code === "5710") current.amortization += amount;
          if (code.startsWith("65")) current.interest += amount;
          if (code.startsWith("70")) current.taxes += amount;
        }
      }

      if (CASH_ACCOUNT_CODES.has(code)) {
        current.cashInflow += debit;
        current.cashOutflow += credit;
      }
    }

    monthly.set(key, current);
  }

  let points = Array.from(monthly.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      const totalExpenses = value.cogs + value.fixedCosts + value.variableCosts;
      const grossProfit = value.revenue - value.cogs;
      const netProfit = value.revenue - totalExpenses;
      const ebitda = netProfit + value.depreciation + value.amortization + value.interest + value.taxes;
      const netCashflow = value.cashInflow - value.cashOutflow;

      return {
        key,
        label: monthLabel(key),
        date: monthKeyToDate(key),
        revenue: value.revenue,
        cogs: value.cogs,
        fixedCosts: value.fixedCosts,
        variableCosts: value.variableCosts,
        marketingCosts: 0,
        operatingExpenses: value.fixedCosts,
        totalExpenses,
        grossProfit,
        netProfit,
        ebitda,
        grossMarginPct: safeDivide(grossProfit, value.revenue),
        netMarginPct: safeDivide(netProfit, value.revenue),
        cashInflow: value.cashInflow,
        cashOutflow: value.cashOutflow,
        netCashflow,
        burnRate: Math.max(0, -netCashflow),
        cashBalance: 0,
        kind: "actual" as const,
      };
    })
    .slice(-12);

  if (points.length === 0 && statements) {
    const currentMonth = toMonthKey(new Date());
    const keys = [shiftMonthKey(currentMonth, -2), shiftMonthKey(currentMonth, -1), currentMonth];
    const monthlyRevenue = Math.max(0, statements.revenue / 12);
    const monthlyCogs = Math.max(0, statements.costOfSales / 12);
    const monthlyOperating = Math.max(0, statements.operatingExpenses / 12);
    const monthlyCashNet = (statements.cashFromOperations + statements.cashFromInvesting + statements.cashFromFinancing) / 12;

    points = keys.map((key) => {
      const totalExpenses = monthlyCogs + monthlyOperating;
      const grossProfit = monthlyRevenue - monthlyCogs;
      const netProfit = monthlyRevenue - totalExpenses;
      const cashInflow = Math.max(0, monthlyRevenue * 0.9);
      const cashOutflow = Math.max(0, cashInflow - monthlyCashNet);
      return {
        key,
        label: monthLabel(key),
        date: monthKeyToDate(key),
        revenue: monthlyRevenue,
        cogs: monthlyCogs,
        fixedCosts: monthlyOperating * 0.7,
        variableCosts: monthlyOperating * 0.3,
        marketingCosts: 0,
        operatingExpenses: monthlyOperating * 0.7,
        totalExpenses,
        grossProfit,
        netProfit,
        ebitda: netProfit,
        grossMarginPct: safeDivide(grossProfit, monthlyRevenue),
        netMarginPct: safeDivide(netProfit, monthlyRevenue),
        cashInflow,
        cashOutflow,
        netCashflow: cashInflow - cashOutflow,
        burnRate: Math.max(0, -(cashInflow - cashOutflow)),
        cashBalance: 0,
        kind: "actual" as const,
      };
    });
  }

  const totalNetCash = points.reduce((sum, point) => sum + point.netCashflow, 0);
  let runningCash = closingCashBalance - totalNetCash;

  return points.map((point) => {
    runningCash += point.netCashflow;
    return {
      ...point,
      cashBalance: runningCash,
    };
  });
}

function deriveAssumptions(
  actuals: ProjectionPoint[],
  breakdowns: { marketingSpendTotal: number; revenueEntryCount: number }
): ProjectionAssumptions {
  const base = actuals.slice(-6);
  const revenueSeries = base.map((point) => point.revenue);
  const expenseSeries = base.map((point) => point.totalExpenses);

  const totalRevenue = base.reduce((sum, point) => sum + point.revenue, 0);
  const totalCogs = base.reduce((sum, point) => sum + point.cogs, 0);
  const totalVariable = base.reduce((sum, point) => sum + point.variableCosts, 0);
  const totalFixed = base.reduce((sum, point) => sum + point.fixedCosts, 0);
  const totalCashInflow = base.reduce((sum, point) => sum + point.cashInflow, 0);
  const totalCashOutflow = base.reduce((sum, point) => sum + point.cashOutflow, 0);

  const revenueGrowthRate = clamp(averageGrowthRate(revenueSeries), -0.15, 0.35);
  const operatingExpenseGrowthRate = clamp(averageGrowthRate(expenseSeries), -0.08, 0.2);
  const cogsRatio = clamp(safeDivide(totalCogs, totalRevenue), 0.05, 0.75);
  const variableCostRatio = clamp(safeDivide(totalVariable, totalRevenue), 0.05, 0.5);
  const fixedCostBaseline = Math.max(0, safeDivide(totalFixed, Math.max(1, base.length)));
  const fixedCostInflationRate = clamp(Math.max(0.005, operatingExpenseGrowthRate * 0.4), 0.005, 0.04);
  const cashCollectionRatio = clamp(safeDivide(totalCashInflow, totalRevenue), 0.6, 1.35);
  const cashDisbursementRatio = clamp(safeDivide(totalCashOutflow, totalCogs + totalVariable + totalFixed), 0.7, 1.35);
  const marketingSpendRatio = clamp(safeDivide(breakdowns.marketingSpendTotal, Math.max(totalRevenue, 1)), 0, 0.35);
  const customerGrowthProxy = clamp(revenueGrowthRate * 0.75 + marketingSpendRatio * 0.2, -0.1, 0.35);
  const pricingPerRevenueEntry = safeDivide(totalRevenue, Math.max(1, breakdowns.revenueEntryCount));
  const salesConversionRateProxy = clamp(
    customerGrowthProxy * 0.45 + cashCollectionRatio * 0.35 + (1 - marketingSpendRatio) * 0.2,
    0.1,
    0.95
  );

  return {
    revenueGrowthRate,
    operatingExpenseGrowthRate,
    cogsRatio,
    variableCostRatio,
    fixedCostBaseline,
    fixedCostInflationRate,
    cashCollectionRatio,
    cashDisbursementRatio,
    marketingSpendRatio,
    customerGrowthProxy,
    pricingPerRevenueEntry,
    salesConversionRateProxy,
  };
}

function buildEmptyProjectionOutput(): ProjectionOutput {
  return {
    monthly_revenue: [],
    monthly_cogs: [],
    monthly_opex: [],
    monthly_net_profit: [],
    monthly_cash_flow: [],
    monthly_cash_balance: [],
    total_revenue: 0,
    total_profit: 0,
    burn_rate: 0,
    runway: Number.POSITIVE_INFINITY,
    break_even_month: null,
    break_even_revenue: null,
    projection_status: "VALID",
    error_message: null,
  };
}

function extractBaselineMetrics(actuals: ProjectionPoint[]): {
  baselineRevenueAnnual: number;
  baselineRevenueMonthly: number;
  cogsRatio: number;
  opexRatio: number;
  variableCostRatio: number;
  fixedCostBaseline: number;
  netMargin: number;
  cashCollectionRatio: number;
  currentCashBalance: number;
} {
  const base = actuals.slice(-12);
  const fallbackCash = actuals.length ? actuals[actuals.length - 1].cashBalance : 0;

  if (base.length === 0) {
    return {
      baselineRevenueAnnual: 0,
      baselineRevenueMonthly: 0,
      cogsRatio: 0.35,
      opexRatio: 0.4,
      variableCostRatio: 0.22,
      fixedCostBaseline: 0,
      netMargin: 0,
      cashCollectionRatio: 1,
      currentCashBalance: fallbackCash,
    };
  }

  const totalRevenue = base.reduce((sum, point) => sum + point.revenue, 0);
  const totalCogs = base.reduce((sum, point) => sum + point.cogs, 0);
  const totalOpex = base.reduce((sum, point) => sum + Math.max(0, point.totalExpenses - point.cogs), 0);
  const totalVariableCosts = base.reduce((sum, point) => sum + point.variableCosts + point.marketingCosts, 0);
  const totalFixedCosts = base.reduce((sum, point) => sum + point.fixedCosts, 0);
  const totalNet = base.reduce((sum, point) => sum + point.netProfit, 0);
  const totalCashInflow = base.reduce((sum, point) => sum + point.cashInflow, 0);

  const baselineRevenueAnnual = totalRevenue;
  const baselineRevenueMonthly = safeDivide(baselineRevenueAnnual, 12);

  return {
    baselineRevenueAnnual,
    baselineRevenueMonthly,
    cogsRatio: clamp(safeDivide(totalCogs, Math.max(totalRevenue, 1)), 0.02, 0.9),
    opexRatio: clamp(safeDivide(totalOpex, Math.max(totalRevenue, 1)), 0.05, 0.95),
    variableCostRatio: clamp(safeDivide(totalVariableCosts, Math.max(totalRevenue, 1)), 0.01, 0.9),
    fixedCostBaseline: Math.max(0, safeDivide(totalFixedCosts, Math.max(1, base.length))),
    netMargin: clamp(safeDivide(totalNet, Math.max(totalRevenue, 1)), -0.95, 0.95),
    cashCollectionRatio: clamp(safeDivide(totalCashInflow, Math.max(totalRevenue, 1)), 0.4, 1.6),
    currentCashBalance: fallbackCash,
  };
}

function validateProjectionConsistency(
  series: ProjectionPoint[],
  startingCash: number,
  revenueGrowthRate: number,
  baselineRevenueMonthly: number
): string[] {
  if (!series.length) return [];
  const issues: string[] = [];

  for (let i = 0; i < series.length; i += 1) {
    const point = series[i];
    if (
      point.cogs < 0 ||
      point.operatingExpenses < 0 ||
      point.totalExpenses < 0 ||
      point.fixedCosts < 0 ||
      point.variableCosts < 0 ||
      point.marketingCosts < 0
    ) {
      issues.push(`Negative cost detected in ${point.label}.`);
    }
    if (point.revenue > 0 && point.operatingExpenses <= 0) {
      issues.push(`Operating expenses cannot be zero in ${point.label} while revenue is positive.`);
    }
    if (point.netProfit > point.grossProfit + 1) {
      issues.push(`Net profit exceeds gross profit in ${point.label}.`);
    }
    if (point.revenue > 0 && safeDivide(point.netProfit, point.revenue) > 0.95) {
      issues.push(`Net margin above 95% in ${point.label}.`);
    }

    if (i > 0) {
      const previous = series[i - 1];
      const expectedRevenue = previous.revenue * (1 + revenueGrowthRate);
      const tolerance = Math.max(1, Math.abs(expectedRevenue) * 0.002);
      if (Math.abs(point.revenue - expectedRevenue) > tolerance) {
        issues.push(`Projected revenue in ${point.label} is inconsistent with growth assumptions.`);
      }
      if (point.cashBalance > previous.cashBalance + 0.5 && point.netCashflow <= 0) {
        issues.push(`Cash increased without positive net cash flow in ${point.label}.`);
      }
    }
  }

  if (Math.abs(revenueGrowthRate) < 1e-9) {
    const actualTotalRevenue = series.reduce((sum, point) => sum + point.revenue, 0);
    const expectedTotalRevenue = baselineRevenueMonthly * series.length;
    const tolerance = Math.max(1, Math.abs(expectedTotalRevenue) * 0.001);
    if (Math.abs(actualTotalRevenue - expectedTotalRevenue) > tolerance) {
      issues.push("Projection invalid: revenue cannot grow when growth rate is 0.");
    }
  }

  const summedNetCash = series.reduce((sum, point) => sum + point.netCashflow, 0);
  const expectedEndingCash = startingCash + summedNetCash;
  const actualEndingCash = series[series.length - 1].cashBalance;
  if (Math.abs(expectedEndingCash - actualEndingCash) > 1) {
    issues.push("Cash flow reconciliation failed.");
  }

  const breakEvenIndex = series.findIndex((point) => point.netProfit >= 0);
  if (breakEvenIndex >= 0 && series[breakEvenIndex].netProfit < 0) {
    issues.push("Break-even month is inconsistent with projected losses.");
  }

  return Array.from(new Set(issues));
}

function buildProjectionEngineResult(
  actuals: ProjectionPoint[],
  assumptions: ProjectionAssumptions,
  months: number
): ProjectionComputationResult {
  const baseline = extractBaselineMetrics(actuals);
  const emptyOutput = buildEmptyProjectionOutput();

  if (actuals.length === 0 || months <= 0) {
    return {
      points: [],
      output: emptyOutput,
      validationIssues: [],
      baseline: {
        baselineRevenueMonthly: baseline.baselineRevenueMonthly,
        startingCash: baseline.currentCashBalance,
      },
    };
  }

  const last = actuals[actuals.length - 1];
  const projected: ProjectionPoint[] = [];

  let previousRevenue = Math.max(0, baseline.baselineRevenueMonthly || last.revenue);
  let cashBalance = baseline.currentCashBalance;

  const revenueGrowthRate = clamp(assumptions.revenueGrowthRate, -0.2, 0.6);
  const cogsRatio = clamp(assumptions.cogsRatio || baseline.cogsRatio, 0.01, 0.9);
  const variableCostRatio = clamp(
    assumptions.variableCostRatio > 0 ? assumptions.variableCostRatio : baseline.variableCostRatio,
    0.01,
    0.9
  );
  const marketingRatio = clamp(assumptions.marketingSpendRatio, 0, Math.min(0.5, variableCostRatio));
  const nonMarketingVariableCostRatio = Math.max(0, variableCostRatio - marketingRatio);
  const fixedCostGrowthRate = clamp(
    Math.max(assumptions.fixedCostInflationRate, assumptions.operatingExpenseGrowthRate),
    -0.1,
    0.35
  );
  const fixedCostBaseline = Math.max(
    0,
    assumptions.fixedCostBaseline > 0 ? assumptions.fixedCostBaseline : baseline.fixedCostBaseline
  );
  const cashCollectionRatio = clamp(
    assumptions.cashCollectionRatio > 0 ? assumptions.cashCollectionRatio : baseline.cashCollectionRatio,
    0.4,
    1.6
  );
  const taxRate = 0.15;

  for (let monthIndex = 1; monthIndex <= months; monthIndex += 1) {
    const revenue = previousRevenue * (1 + revenueGrowthRate);
    previousRevenue = revenue;

    const cogs = revenue * cogsRatio;
    const marketingCosts = revenue * marketingRatio;
    const variableCosts = revenue * nonMarketingVariableCostRatio;
    const fixedCosts = fixedCostBaseline * Math.pow(1 + fixedCostGrowthRate, monthIndex - 1);
    const operatingExpenses = fixedCosts + revenue * variableCostRatio;

    const grossProfit = revenue - cogs;
    const operatingProfit = grossProfit - operatingExpenses;
    const taxes = operatingProfit > 0 ? operatingProfit * taxRate : 0;
    const netProfit = operatingProfit - taxes;
    const totalExpenses = cogs + operatingExpenses + taxes;

    const cashInflow = revenue * cashCollectionRatio;
    const cashOutflow = cogs + operatingExpenses + taxes;
    const netCashflow = cashInflow - cashOutflow;
    cashBalance += netCashflow;

    const key = shiftMonthKey(last.key, monthIndex);
    projected.push({
      key,
      label: monthLabel(key),
      date: monthKeyToDate(key),
      revenue,
      cogs,
      fixedCosts,
      variableCosts,
      marketingCosts,
      operatingExpenses,
      totalExpenses,
      grossProfit,
      netProfit,
      ebitda: operatingProfit,
      grossMarginPct: safeDivide(grossProfit, revenue),
      netMarginPct: safeDivide(netProfit, revenue),
      cashInflow,
      cashOutflow,
      netCashflow,
      burnRate: Math.max(0, -netCashflow),
      cashBalance,
      kind: "projected",
    });
  }

  const validationIssues = validateProjectionConsistency(
    projected,
    baseline.currentCashBalance,
    revenueGrowthRate,
    baseline.baselineRevenueMonthly
  );
  const negativeNetCashflow = projected
    .map((point) => point.netCashflow)
    .filter((value) => value < 0)
    .map((value) => Math.abs(value));
  const burnRate = negativeNetCashflow.length ? average(negativeNetCashflow) : 0;
  const runway = burnRate > 0 ? Math.max(0, baseline.currentCashBalance / burnRate) : Number.POSITIVE_INFINITY;
  const breakEvenIndex = projected.findIndex((point) => point.netProfit >= 0);

  const output: ProjectionOutput = {
    monthly_revenue: projected.map((point) => point.revenue),
    monthly_cogs: projected.map((point) => point.cogs),
    monthly_opex: projected.map((point) => point.operatingExpenses),
    monthly_net_profit: projected.map((point) => point.netProfit),
    monthly_cash_flow: projected.map((point) => point.netCashflow),
    monthly_cash_balance: projected.map((point) => point.cashBalance),
    total_revenue: projected.reduce((sum, point) => sum + point.revenue, 0),
    total_profit: projected.reduce((sum, point) => sum + point.netProfit, 0),
    burn_rate: burnRate,
    runway,
    break_even_month: breakEvenIndex >= 0 ? breakEvenIndex + 1 : null,
    break_even_revenue: breakEvenIndex >= 0 ? projected[breakEvenIndex].revenue : null,
    projection_status: validationIssues.length ? "INVALID" : "VALID",
    error_message: validationIssues.length ? "Projection violates financial consistency rules" : null,
  };

  return {
    points: projected,
    output,
    validationIssues,
    baseline: {
      baselineRevenueMonthly: baseline.baselineRevenueMonthly,
      startingCash: baseline.currentCashBalance,
    },
  };
}

function scenarioMultipliers(scenario: Scenario): {
  revenue: number;
  cogs: number;
  variable: number;
  fixed: number;
  inflow: number;
  outflow: number;
} {
  if (scenario === "conservative") {
    return { revenue: 0.86, cogs: 1.02, variable: 1.06, fixed: 1.03, inflow: 0.9, outflow: 1.07 };
  }
  if (scenario === "aggressive") {
    return { revenue: 1.2, cogs: 0.99, variable: 0.97, fixed: 1.02, inflow: 1.1, outflow: 1.01 };
  }
  return { revenue: 1, cogs: 1, variable: 1, fixed: 1, inflow: 1, outflow: 1 };
}

function buildScenarioProjection(expected: ProjectionPoint[], baseCashBalance: number, scenario: Scenario): ProjectionPoint[] {
  const multipliers = scenarioMultipliers(scenario);
  let cashBalance = baseCashBalance;

  return expected.map((point) => {
    const revenue = point.revenue * multipliers.revenue;
    const cogs = point.cogs * multipliers.cogs;
    const fixedCosts = point.fixedCosts * multipliers.fixed;
    const variableCosts = point.variableCosts * multipliers.variable;
    const marketingCosts = point.marketingCosts || 0;
    const operatingExpenses = fixedCosts + variableCosts + marketingCosts;
    const totalExpenses = cogs + operatingExpenses;
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - operatingExpenses;
    const ebitda = netProfit + (point.ebitda - point.netProfit);
    const cashInflow = point.cashInflow * multipliers.inflow;
    const cashOutflow = point.cashOutflow * multipliers.outflow;
    const netCashflow = cashInflow - cashOutflow;
    cashBalance += netCashflow;

    return {
      ...point,
      revenue,
      cogs,
      fixedCosts,
      variableCosts,
      totalExpenses,
      grossProfit,
      netProfit,
      ebitda,
      grossMarginPct: safeDivide(grossProfit, revenue),
      netMarginPct: safeDivide(netProfit, revenue),
      cashInflow,
      cashOutflow,
      netCashflow,
      burnRate: Math.max(0, -netCashflow),
      cashBalance,
      kind: "projected" as const,
    };
  });
}

function findBreakEven(series: ProjectionPoint[]): { monthLabel: string | null; revenuePoint: number | null; index: number | null } {
  const index = series.findIndex((point) => point.netProfit >= 0);
  if (index < 0) return { monthLabel: null, revenuePoint: null, index: null };
  return {
    monthLabel: series[index].label,
    revenuePoint: series[index].revenue,
    index,
  };
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

function MultiLineChart({
  data,
  series,
  projectedStartIndex,
  allowNegative = false,
  minWidth = 680,
  valueType = "currency",
}: {
  data: Array<{ label: string;[key: string]: string | number }>;
  series: Array<{ key: string; color: string; dashed?: boolean; label?: string }>;
  projectedStartIndex?: number;
  allowNegative?: boolean;
  minWidth?: number;
  valueType?: "currency" | "percent" | "number";
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);

  if (data.length < 2) {
    return <p className="text-sm text-gray-500">Not enough data points to render chart.</p>;
  }

  const width = 860;
  const height = 270;
  const paddingX = 42;
  const paddingY = 24;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  const values = data.flatMap((point) =>
    series.map((item) => {
      const raw = point[item.key];
      return typeof raw === "number" ? raw : 0;
    })
  );

  const maxValue = Math.max(1, ...values);
  const minValue = allowNegative ? Math.min(0, ...values) : 0;
  const range = maxValue - minValue || 1;

  const xForIndex = (index: number) => paddingX + (index / (data.length - 1)) * innerWidth;
  const yForValue = (value: number) => paddingY + ((maxValue - value) / range) * innerHeight;

  const gridSteps = [0, 0.25, 0.5, 0.75, 1];

  const projectedStartX =
    projectedStartIndex !== undefined && projectedStartIndex >= 0 && projectedStartIndex < data.length
      ? xForIndex(projectedStartIndex)
      : null;

  const polylinePoints = (key: string, start = 0, end = data.length - 1): string => {
    return data
      .slice(start, end + 1)
      .map((point, index) => {
        const absolute = start + index;
        const raw = point[key];
        const value = typeof raw === "number" ? raw : 0;
        return `${xForIndex(absolute)},${yForValue(value)}`;
      })
      .join(" ");
  };

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const relativeX = event.clientX - rect.left;
    const ratio = clamp(relativeX / rect.width, 0, 1);
    const index = Math.round(ratio * (data.length - 1));
    setHoveredIndex(index);
    setHoverPosition({ x: relativeX, y: event.clientY - rect.top });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setHoverPosition(null);
  };

  const formatValue = (value: number): string => {
    if (valueType === "percent") return formatPercent(value);
    if (valueType === "number") return Math.round(value).toLocaleString("en-NG");
    return formatNaira(value);
  };

  return (
    <div className="w-full overflow-x-auto relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ minWidth }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {gridSteps.map((step) => {
          const y = paddingY + innerHeight * step;
          return <line key={step} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#e5e7eb" strokeWidth="1" />;
        })}

        {allowNegative && (
          <line x1={paddingX} y1={yForValue(0)} x2={width - paddingX} y2={yForValue(0)} stroke="#cbd5e1" strokeWidth="1.5" />
        )}

        {projectedStartX !== null && (
          <>
            <rect
              x={projectedStartX}
              y={paddingY}
              width={width - paddingX - projectedStartX}
              height={innerHeight}
              fill="#f8fafc"
            />
            <line
              x1={projectedStartX}
              y1={paddingY}
              x2={projectedStartX}
              y2={paddingY + innerHeight}
              stroke="#94a3b8"
              strokeDasharray="5 5"
              strokeWidth="1.2"
            />
          </>
        )}

        {series.map((item) => (
          <polyline
            key={item.key}
            points={polylinePoints(item.key)}
            fill="none"
            stroke={item.color}
            strokeWidth="2.7"
            strokeLinecap="round"
            strokeDasharray={item.dashed ? "8 6" : undefined}
          />
        ))}

        {hoveredIndex !== null && (
          <line
            x1={xForIndex(hoveredIndex)}
            y1={paddingY}
            x2={xForIndex(hoveredIndex)}
            y2={paddingY + innerHeight}
            stroke="#94a3b8"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        )}

        {hoveredIndex !== null &&
          series.map((item) => {
            const raw = data[hoveredIndex]?.[item.key];
            const value = typeof raw === "number" ? raw : 0;
            return (
              <circle
                key={`marker-${item.key}`}
                cx={xForIndex(hoveredIndex)}
                cy={yForValue(value)}
                r={4.5}
                fill={item.color}
                stroke="#fff"
                strokeWidth="1.6"
              />
            );
          })}

        {data.map((point, index) => (
          <text key={`${point.label}-${index}`} x={xForIndex(index)} y={height - 7} textAnchor="middle" fontSize="11" className="fill-gray-500">
            {point.label}
          </text>
        ))}
      </svg>

      {hoveredIndex !== null && hoverPosition && (
        <div
          className="pointer-events-none absolute z-20 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow-sm text-xs"
          style={{
            left: Math.max(8, Math.min(hoverPosition.x + 12, (svgRef.current?.getBoundingClientRect().width || 320) - 170)),
            top: Math.max(8, hoverPosition.y - 12),
          }}
        >
          <p className="font-semibold text-gray-800 mb-1">{data[hoveredIndex]?.label}</p>
          <div className="space-y-1">
            {series.map((item) => {
              const raw = data[hoveredIndex]?.[item.key];
              const value = typeof raw === "number" ? raw : 0;
              return (
                <div key={`tip-${item.key}`} className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-gray-600">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.label || item.key}
                  </span>
                  <span className="font-medium text-gray-900">{formatValue(value)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RevenueStreamBars({ streams }: { streams: RevenueBreakdown[] }) {
  if (streams.length === 0) {
    return <p className="text-sm text-gray-500">No revenue stream data yet.</p>;
  }

  const maxAmount = Math.max(...streams.map((item) => item.amount), 1);

  return (
    <div className="space-y-3">
      {streams.map((item) => {
        const width = (item.amount / maxAmount) * 100;
        return (
          <div key={item.stream}>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span className="font-medium text-gray-700">{item.stream}</span>
              <span>{formatNaira(item.amount)}</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#2264ff] to-[#1a50cc] rounded-full" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExpenseCompositionChart({ data }: { data: ProjectionPoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);

  if (data.length === 0) {
    return <p className="text-sm text-gray-500">No expense data to display.</p>;
  }

  const width = 520;
  const height = 240;
  const paddingX = 30;
  const paddingY = 20;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  const maxValue = Math.max(...data.map((point) => point.totalExpenses), 1);
  const barWidth = (innerWidth / data.length) * 0.58;
  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const relativeX = event.clientX - rect.left;
    const ratio = clamp(relativeX / rect.width, 0, 1);
    const index = Math.round(ratio * (data.length - 1));
    setHoveredIndex(index);
    setHoverPosition({ x: relativeX, y: event.clientY - rect.top });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setHoverPosition(null);
  };

  return (
    <div className="w-full overflow-x-auto relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[500px]"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {data.map((point, index) => {
          const x = paddingX + (index + 0.5) * (innerWidth / data.length) - barWidth / 2;
          const totalHeight = (point.totalExpenses / maxValue) * innerHeight;
          const cogsHeight = safeDivide(point.cogs, point.totalExpenses) * totalHeight;
          const fixedHeight = safeDivide(point.fixedCosts, point.totalExpenses) * totalHeight;
          const variableHeight = safeDivide(point.variableCosts, point.totalExpenses) * totalHeight;
          const yBottom = paddingY + innerHeight;

          return (
            <g key={point.key}>
              <rect x={x} y={yBottom - cogsHeight} width={barWidth} height={Math.max(0, cogsHeight)} fill="#f59e0b" rx="4" />
              <rect x={x} y={yBottom - cogsHeight - fixedHeight} width={barWidth} height={Math.max(0, fixedHeight)} fill="#64748b" rx="4" />
              <rect
                x={x}
                y={yBottom - cogsHeight - fixedHeight - variableHeight}
                width={barWidth}
                height={Math.max(0, variableHeight)}
                fill="#ef4444"
                rx="4"
              />
              <text x={x + barWidth / 2} y={height - 5} textAnchor="middle" fontSize="11" className="fill-gray-500">
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hoveredIndex !== null && hoverPosition && (
        <div
          className="pointer-events-none absolute z-20 max-w-[220px] rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-xs text-gray-700 shadow-sm"
          style={{
            left: Math.max(8, hoverPosition.x + 12),
            top: Math.max(8, hoverPosition.y - 14),
          }}
        >
          <p className="font-semibold text-gray-900 mb-1">{data[hoveredIndex].label}</p>
          <p>COGS: {formatNaira(data[hoveredIndex].cogs)}</p>
          <p>Fixed: {formatNaira(data[hoveredIndex].fixedCosts)}</p>
          <p>Variable: {formatNaira(data[hoveredIndex].variableCosts)}</p>
        </div>
      )}
    </div>
  );
}

function ExpenseCategoryList({ categories }: { categories: ExpenseBreakdown[] }) {
  if (categories.length === 0) {
    return <p className="text-sm text-gray-500">No expense categories available.</p>;
  }

  const maxAmount = Math.max(...categories.map((item) => item.amount), 1);

  return (
    <div className="space-y-3">
      {categories.map((item) => {
        const width = (item.amount / maxAmount) * 100;
        const color = item.isCogs ? "bg-amber-500" : item.nature === "fixed" ? "bg-slate-500" : "bg-rose-500";
        return (
          <div key={item.category}>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span className="font-medium text-gray-700">{item.category}</span>
              <span>{formatNaira(item.amount)}</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InflowOutflowBars({ points }: { points: ProjectionPoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);

  if (points.length === 0) {
    return <p className="text-sm text-gray-500">No cashflow activity yet.</p>;
  }

  const width = 560;
  const height = 240;
  const paddingX = 34;
  const paddingY = 20;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  const maxValue = Math.max(...points.flatMap((point) => [point.cashInflow, point.cashOutflow]), 1);
  const groupWidth = innerWidth / points.length;
  const barWidth = groupWidth * 0.32;
  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const relativeX = event.clientX - rect.left;
    const ratio = clamp(relativeX / rect.width, 0, 1);
    const index = Math.round(ratio * (points.length - 1));
    setHoveredIndex(index);
    setHoverPosition({ x: relativeX, y: event.clientY - rect.top });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setHoverPosition(null);
  };

  return (
    <div className="w-full overflow-x-auto relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[520px]"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {points.map((point, index) => {
          const xBase = paddingX + index * groupWidth + groupWidth * 0.2;
          const inflowHeight = (point.cashInflow / maxValue) * innerHeight;
          const outflowHeight = (point.cashOutflow / maxValue) * innerHeight;

          return (
            <g key={point.key}>
              <rect x={xBase} y={paddingY + innerHeight - inflowHeight} width={barWidth} height={Math.max(2, inflowHeight)} rx="4" fill="#10b981" />
              <rect
                x={xBase + barWidth + groupWidth * 0.08}
                y={paddingY + innerHeight - outflowHeight}
                width={barWidth}
                height={Math.max(2, outflowHeight)}
                rx="4"
                fill="#ef4444"
              />
              <text x={xBase + groupWidth * 0.24} y={height - 5} textAnchor="middle" fontSize="11" className="fill-gray-500">
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hoveredIndex !== null && hoverPosition && (
        <div
          className="pointer-events-none absolute z-20 max-w-[220px] rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-xs text-gray-700 shadow-sm"
          style={{
            left: Math.max(8, hoverPosition.x + 12),
            top: Math.max(8, hoverPosition.y - 14),
          }}
        >
          <p className="font-semibold text-gray-900 mb-1">{points[hoveredIndex].label}</p>
          <p>Inflow: {formatNaira(points[hoveredIndex].cashInflow)}</p>
          <p>Outflow: {formatNaira(points[hoveredIndex].cashOutflow)}</p>
          <p>Net: {formatNaira(points[hoveredIndex].netCashflow)}</p>
        </div>
      )}
    </div>
  );
}

export default function AccountingProjectionsPage() {
  const [state, setState] = useState<AccountingState | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [statementSnapshot, setStatementSnapshot] = useState<{
    revenue: number;
    costOfSales: number;
    operatingExpenses: number;
    cashFromOperations: number;
    cashFromInvesting: number;
    cashFromFinancing: number;
  } | null>(null);
  const [assumptionOverrides, setAssumptionOverrides] = useState<Partial<ProjectionAssumptions>>({});

  useEffect(() => {
    accountingEngine.load();

    const sync = () => {
      const currentState = accountingEngine.getState();
      const statements = accountingEngine.generateStatements();
      setState({
        ...currentState,
        journalEntries: [...currentState.journalEntries],
        ledgerAccounts: new Map(currentState.ledgerAccounts),
      });
      setStatementSnapshot({
        revenue: statements.revenue,
        costOfSales: statements.costOfSales,
        operatingExpenses: statements.operatingExpenses,
        cashFromOperations: statements.cashFromOperations,
        cashFromInvesting: statements.cashFromInvesting,
        cashFromFinancing: statements.cashFromFinancing,
      });
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

  const closingCashBalance = useMemo(() => getCashBalanceSnapshot(state), [state]);

  const actualSeries = useMemo(() => {
    if (!state) return [];
    return buildActualSeries(state.journalEntries, statementSnapshot, closingCashBalance);
  }, [state, statementSnapshot, closingCashBalance]);

  const breakdowns = useMemo(() => {
    if (!state) {
      return {
        revenueStreams: [] as RevenueBreakdown[],
        expenseCategories: [] as ExpenseBreakdown[],
        fixedExpenseTotal: 0,
        variableExpenseTotal: 0,
        cogsTotal: 0,
        marketingSpendTotal: 0,
        revenueEntryCount: 0,
      };
    }
    return deriveBreakdowns(state.journalEntries);
  }, [state]);

  const baseAssumptions = useMemo(() => deriveAssumptions(actualSeries, breakdowns), [actualSeries, breakdowns]);
  const assumptions = useMemo(() => {
    const merged = { ...baseAssumptions, ...assumptionOverrides };
    const customerGrowthProxy = clamp(merged.revenueGrowthRate * 0.75 + merged.marketingSpendRatio * 0.2, -0.1, 0.35);
    const salesConversionRateProxy = clamp(
      customerGrowthProxy * 0.45 + merged.cashCollectionRatio * 0.35 + (1 - merged.marketingSpendRatio) * 0.2,
      0.1,
      0.95
    );
    return {
      ...merged,
      customerGrowthProxy,
      salesConversionRateProxy,
    };
  }, [baseAssumptions, assumptionOverrides]);

  const updateAssumptionPercent = (key: keyof ProjectionAssumptions, percentValue: number, min: number, max: number) => {
    if (!Number.isFinite(percentValue)) return;
    const decimalValue = clamp(percentValue / 100, min, max);
    setAssumptionOverrides((prev) => ({ ...prev, [key]: decimalValue }));
  };

  const updateAssumptionNumber = (key: keyof ProjectionAssumptions, rawValue: number, min: number, max: number) => {
    if (!Number.isFinite(rawValue)) return;
    const value = clamp(rawValue, min, max);
    setAssumptionOverrides((prev) => ({ ...prev, [key]: value }));
  };

  const expectedSixMonthResult = useMemo(
    () => buildProjectionEngineResult(actualSeries, assumptions, 6),
    [actualSeries, assumptions]
  );
  const expectedEighteenMonthResult = useMemo(
    () => buildProjectionEngineResult(actualSeries, assumptions, 18),
    [actualSeries, assumptions]
  );
  const expectedSixMonth = expectedSixMonthResult.points;
  const expectedEighteenMonth = expectedEighteenMonthResult.points;

  const conservativeScenario = useMemo(() => {
    const baseCash = actualSeries.length ? actualSeries[actualSeries.length - 1].cashBalance : 0;
    return buildScenarioProjection(expectedSixMonth, baseCash, "conservative");
  }, [expectedSixMonth, actualSeries]);

  const aggressiveScenario = useMemo(() => {
    const baseCash = actualSeries.length ? actualSeries[actualSeries.length - 1].cashBalance : 0;
    return buildScenarioProjection(expectedSixMonth, baseCash, "aggressive");
  }, [expectedSixMonth, actualSeries]);

  const timeline = useMemo(() => [...actualSeries, ...expectedSixMonth], [actualSeries, expectedSixMonth]);

  const projectedRevenueSixMonth = useMemo(() => expectedSixMonthResult.output.total_revenue, [expectedSixMonthResult]);
  const projectedNetProfitSixMonth = useMemo(() => expectedSixMonthResult.output.total_profit, [expectedSixMonthResult]);
  const projectedRevenueAnnual = useMemo(() => {
    return projectedRevenueSixMonth * 2;
  }, [projectedRevenueSixMonth]);

  const projectedGrossMargin = useMemo(() => {
    if (!expectedSixMonth.length) return 0;
    return average(expectedSixMonth.map((point) => point.grossMarginPct));
  }, [expectedSixMonth]);

  const burnRate = useMemo(() => expectedSixMonthResult.output.burn_rate, [expectedSixMonthResult]);

  const projectionValidationIssues = useMemo(() => {
    const issues = [...expectedEighteenMonthResult.validationIssues];
    if (expectedEighteenMonthResult.output.projection_status === "INVALID" && expectedEighteenMonthResult.output.error_message) {
      issues.unshift(expectedEighteenMonthResult.output.error_message);
    }
    return Array.from(new Set(issues));
  }, [expectedEighteenMonthResult]);

  const projectionStatus = expectedEighteenMonthResult.output.projection_status;

  const projectedCashBalance = useMemo(() => {
    const balances = expectedSixMonthResult.output.monthly_cash_balance;
    if (!balances.length) return closingCashBalance;
    return balances[balances.length - 1];
  }, [closingCashBalance, expectedSixMonthResult]);

  const runwayMonths = useMemo(() => {
    const runway = expectedEighteenMonthResult.output.runway;
    if (!Number.isFinite(runway)) return null;
    return runway;
  }, [expectedEighteenMonthResult]);

  const breakEven = useMemo(() => findBreakEven(expectedEighteenMonth), [expectedEighteenMonth]);

  const breakEvenRevenue = useMemo(() => breakEven.revenuePoint, [breakEven.revenuePoint]);

  const revenueData = useMemo(
    () => timeline.map((point) => ({ label: point.label, revenue: point.revenue, kind: point.kind })),
    [timeline]
  );

  const profitabilityData = useMemo(
    () => timeline.map((point) => ({
      label: point.label,
      grossProfit: point.grossProfit,
      netProfit: point.netProfit,
      ebitda: point.ebitda,
      kind: point.kind,
    })),
    [timeline]
  );

  const cashBalanceData = useMemo(
    () => timeline.map((point) => ({ label: point.label, cashBalance: point.cashBalance, kind: point.kind })),
    [timeline]
  );

  const expenseStackData = useMemo(() => timeline.slice(-10), [timeline]);
  const cashflowWindow = useMemo(() => timeline.slice(-8), [timeline]);

  const scenarioComparisonData = useMemo(() => {
    return expectedSixMonth.map((point, index) => ({
      label: point.label,
      conservative: conservativeScenario[index]?.netProfit || 0,
      expected: point.netProfit,
      aggressive: aggressiveScenario[index]?.netProfit || 0,
    }));
  }, [expectedSixMonth, conservativeScenario, aggressiveScenario]);

  const breakEvenChartData = useMemo(
    () => expectedEighteenMonth.map((point) => ({ label: point.label, revenue: point.revenue, expenses: point.totalExpenses })),
    [expectedEighteenMonth]
  );

  const projectionContextSnapshot = useMemo(() => {
    const recent = timeline.slice(-6);
    const recentWindow = recent.length ? `${recent[0].label}–${recent[recent.length - 1].label}` : "n/a";
    const recentAvgRevenue = recent.length ? average(recent.map((point) => point.revenue)) : 0;
    const recentAvgNet = recent.length ? average(recent.map((point) => point.netProfit)) : 0;
    const recentSummary = recent
      .map(
        (point) =>
          `${point.label}: revenue=${Math.round(point.revenue)}, expenses=${Math.round(point.totalExpenses)}, net=${Math.round(point.netProfit)}, cash=${Math.round(
            point.cashBalance
          )}`
      )
      .join(" | ");

    return [
      "Context: projections",
      `Updated at: ${new Date().toISOString()}`,
      `Projection status: ${projectionStatus}`,
      `Projected annual revenue: ${Math.round(projectedRevenueAnnual)}`,
      `Projected net profit (6M): ${Math.round(projectedNetProfitSixMonth)}`,
      `Projected gross margin: ${(projectedGrossMargin * 100).toFixed(2)}%`,
      `Burn rate: ${Math.round(burnRate)}`,
      `Projected cash balance: ${Math.round(projectedCashBalance)}`,
      `Runway months: ${runwayMonths ?? "infinite"}`,
      `Break-even month: ${breakEven.monthLabel || "not reached"}`,
      `Break-even revenue: ${Math.round(breakEvenRevenue || 0)}`,
      `Recent window: ${recentWindow}`,
      `Recent avg revenue: ${Math.round(recentAvgRevenue)}`,
      `Recent avg net profit: ${Math.round(recentAvgNet)}`,
      `Assumptions: revenueGrowthRate=${(assumptions.revenueGrowthRate * 100).toFixed(2)}%; operatingExpenseGrowthRate=${(
        assumptions.operatingExpenseGrowthRate * 100
      ).toFixed(2)}%; fixedCostInflationRate=${(assumptions.fixedCostInflationRate * 100).toFixed(2)}%; cogsRatio=${(
        assumptions.cogsRatio * 100
      ).toFixed(2)}%; variableCostRatio=${(assumptions.variableCostRatio * 100).toFixed(2)}%; marketingSpendRatio=${(
        assumptions.marketingSpendRatio * 100
      ).toFixed(2)}%; cashCollectionRatio=${assumptions.cashCollectionRatio.toFixed(3)}; cashDisbursementRatio=${assumptions.cashDisbursementRatio.toFixed(
        3
      )}; fixedCostBaseline=${Math.round(assumptions.fixedCostBaseline)}`,
      `Validation issues: ${projectionValidationIssues.length ? projectionValidationIssues.join(" | ") : "none"}`,
      `Projection output (18M): ${JSON.stringify(expectedEighteenMonthResult.output)}`,
      `Recent trend: ${recentSummary || "No trend data available."}`,
    ].join("\n");
  }, [
    assumptions,
    breakEven.monthLabel,
    breakEvenRevenue,
    burnRate,
    expectedEighteenMonthResult.output,
    projectionStatus,
    projectionValidationIssues,
    projectedCashBalance,
    projectedGrossMargin,
    projectedNetProfitSixMonth,
    projectedRevenueAnnual,
    runwayMonths,
    timeline,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onReset = () => setAssumptionOverrides({});
    const onUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ updates?: ProjectionActionUpdate[] }>;
      const updates = Array.isArray(customEvent.detail?.updates) ? customEvent.detail.updates : [];
      if (!updates.length) return;

      const nextOverrides: Partial<ProjectionAssumptions> = {};
      for (const update of updates) {
        const key = resolveEditableAssumptionKey(typeof update?.key === "string" ? update.key : "");
        const value = typeof update?.value === "number" ? update.value : Number.NaN;
        if (!key || !Number.isFinite(value)) continue;
        nextOverrides[key] = normalizeAssumptionValue(key, value, update?.unit);
      }

      if (Object.keys(nextOverrides).length > 0) {
        setAssumptionOverrides((prev) => ({ ...prev, ...nextOverrides }));
      }
    };

    window.addEventListener(PROJECTIONS_RESET_EVENT, onReset as EventListener);
    window.addEventListener(PROJECTIONS_UPDATE_EVENT, onUpdate as EventListener);
    return () => {
      window.removeEventListener(PROJECTIONS_RESET_EVENT, onReset as EventListener);
      window.removeEventListener(PROJECTIONS_UPDATE_EVENT, onUpdate as EventListener);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(PROJECTIONS_CONTEXT_STORAGE_KEY, projectionContextSnapshot);
    } catch {
      // no-op
    }
  }, [projectionContextSnapshot]);

  const handleDownloadDashboardPdf = async () => {
    if (typeof window === "undefined" || isDownloadingPdf) return;

    setIsDownloadingPdf(true);
    try {
      window.requestAnimationFrame(() => {
        window.print();
      });
    } catch (error) {
      console.error("Failed to download projections PDF:", error);
      window.alert("Could not open print dialog right now. Please try again.");
    } finally {
      window.setTimeout(() => setIsDownloadingPdf(false), 600);
    }
  };

  if (!state) {
    return <div className="p-6 text-sm text-gray-500">Loading financial projection dashboard...</div>;
  }

  if (state.journalEntries.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Financial Projections Dashboard</h1>
          <p className="text-gray-500 mt-2">Record transactions in Accounting first. Projection charts will auto-populate from your ledgers.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/accounting/projections/modelling" className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Open Financial Modelling
            </Link>
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
          <h1 className="text-2xl font-bold text-gray-900">Financial Projections Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Decision-focused projection view from real accounting records, tuned for management and investors.</p>
          <Link href="/accounting/projections/modelling" className="mt-2 inline-flex text-sm font-medium text-[#2264ff] hover:text-[#1a50cc]">
            Open Financial Modelling
          </Link>
        </div>
        <div className="print-hidden flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadDashboardPdf}
            disabled={isDownloadingPdf}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Download projections dashboard PDF"
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
          label="Projected Revenue"
          value={formatNaira(projectedRevenueAnnual)}
          hint={`Annualized from next 6 months (${formatNaira(projectedRevenueSixMonth)} in 6M)`}
          accent="text-blue-600"
        />
        <KpiCard
          label="Projected Net Profit"
          value={formatNaira(projectedNetProfitSixMonth)}
          hint="Expected net profit over next 6 months"
          accent="text-emerald-600"
        />
        <KpiCard
          label="Gross Margin"
          value={formatPercent(projectedGrossMargin)}
          hint="Projected average gross margin"
          accent="text-indigo-600"
        />
        <KpiCard
          label="Burn Rate"
          value={burnRate > 0 ? formatNaira(burnRate) : "No Burn"}
          hint="Average monthly net cash burn"
          accent="text-rose-600"
        />
        <KpiCard
          label="Cash Balance"
          value={formatNaira(projectedCashBalance)}
          hint={`Current: ${formatNaira(closingCashBalance)}`}
          accent="text-slate-600"
        />
        <KpiCard
          label="Runway"
          value={runwayMonths !== null ? `${runwayMonths.toFixed(1)} months` : "> 18 months"}
          hint="Months before projected cash dips below zero (or infinite)"
          accent="text-amber-600"
        />
        <KpiCard
          label="Break-even Month"
          value={breakEven.monthLabel || "Not in 18M"}
          hint="First month where projected net profit is non-negative"
          accent="text-fuchsia-600"
        />
        <KpiCard
          label="Break-even Revenue"
          value={breakEvenRevenue ? formatNaira(breakEvenRevenue) : "N/A"}
          hint="Projected revenue in break-even month"
          accent="text-cyan-600"
        />
      </div>

      {projectionValidationIssues.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Projection Validation Alerts ({projectionStatus})</h2>
          <p className="mt-1 text-xs text-amber-800">
            These flags indicate mathematically inconsistent or high-risk outputs based on current assumptions.
          </p>
          <div className="mt-2 space-y-1">
            {projectionValidationIssues.map((issue, idx) => (
              <p key={`${issue}-${idx}`} className="text-xs text-amber-900">
                • {issue}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4 gap-4">
            <h2 className="text-base font-semibold text-gray-900">Revenue Projection</h2>
            <div className="text-xs text-gray-500">Actual + projected monthly revenue trend</div>
          </div>
          <MultiLineChart
            data={revenueData}
            series={[{ key: "revenue", color: "#2264ff", label: "Revenue" }]}
            projectedStartIndex={Math.max(0, actualSeries.length - 1)}
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Revenue by Stream</h2>
          <RevenueStreamBars streams={breakdowns.revenueStreams} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4 gap-4">
            <h2 className="text-base font-semibold text-gray-900">Expense Breakdown</h2>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> COGS</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-500" /> Fixed</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Variable</span>
            </div>
          </div>
          <ExpenseCompositionChart data={expenseStackData} />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Expense Categories</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Fixed</p>
              <p className="font-semibold text-gray-900">{formatNaira(breakdowns.fixedExpenseTotal)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Variable</p>
              <p className="font-semibold text-gray-900">{formatNaira(breakdowns.variableExpenseTotal)}</p>
            </div>
          </div>
          <ExpenseCategoryList categories={breakdowns.expenseCategories} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4 gap-4">
          <h2 className="text-base font-semibold text-gray-900">Profitability</h2>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Gross Profit</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Net Profit</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> EBITDA</span>
          </div>
        </div>
        <MultiLineChart
          data={profitabilityData}
          series={[
            { key: "grossProfit", color: "#6366f1", label: "Gross Profit" },
            { key: "netProfit", color: "#10b981", label: "Net Profit" },
            { key: "ebitda", color: "#06b6d4", dashed: true, label: "EBITDA" },
          ]}
          projectedStartIndex={Math.max(0, actualSeries.length - 1)}
          allowNegative
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-sm">
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">Avg Gross Margin</p>
            <p className="font-semibold text-gray-900">{formatPercent(average(expectedSixMonth.map((point) => point.grossMarginPct)))}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">Avg Net Margin</p>
            <p className="font-semibold text-gray-900">{formatPercent(average(expectedSixMonth.map((point) => point.netMarginPct)))}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">Projected EBITDA (6M)</p>
            <p className="font-semibold text-gray-900">{formatNaira(expectedSixMonth.reduce((sum, point) => sum + point.ebitda, 0))}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Cash Inflow vs Outflow</h2>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Inflow</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Outflow</span>
            </div>
          </div>
          <InflowOutflowBars points={cashflowWindow} />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Cash Balance Projection</h2>
          <MultiLineChart
            data={cashBalanceData}
            series={[{ key: "cashBalance", color: "#0ea5e9", label: "Cash Balance" }]}
            projectedStartIndex={Math.max(0, actualSeries.length - 1)}
            allowNegative
            minWidth={560}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Break-even Analysis</h2>
          <MultiLineChart
            data={breakEvenChartData}
            series={[
              { key: "revenue", color: "#2264ff", label: "Revenue" },
              { key: "expenses", color: "#ef4444", label: "Expenses" },
            ]}
            allowNegative={false}
            minWidth={560}
          />
          <div className="mt-4 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-600">
            {breakEven.monthLabel
              ? `Net profit is projected to turn non-negative by ${breakEven.monthLabel} (${formatNaira(breakEven.revenuePoint || 0)} revenue).`
              : "Break-even is not reached in the current 18-month forecast window."}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Scenario Comparison</h2>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Conservative</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Expected</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Aggressive</span>
            </div>
          </div>
          <MultiLineChart
            data={scenarioComparisonData}
            series={[
              { key: "conservative", color: "#f43f5e", label: "Conservative" },
              { key: "expected", color: "#2264ff", label: "Expected" },
              { key: "aggressive", color: "#10b981", dashed: true, label: "Aggressive" },
            ]}
            allowNegative
            minWidth={560}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 className="text-base font-semibold text-gray-900">Key Assumptions</h2>
          <button
            type="button"
            onClick={() => setAssumptionOverrides({})}
            className="print-hidden text-xs font-medium text-[#2264ff] hover:underline"
          >
            Reset to Auto
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">Edit inputs below. Charts and KPIs update instantly.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <label className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500 mb-1">Revenue Growth Rate (%)</p>
            <input
              type="number"
              value={(assumptions.revenueGrowthRate * 100).toFixed(2)}
              onChange={(event) => updateAssumptionPercent("revenueGrowthRate", Number(event.target.value), -0.2, 0.6)}
              className="w-full bg-transparent text-gray-900 font-semibold outline-none"
            />
          </label>
          <label className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500 mb-1">Operating Expense Growth (%)</p>
            <input
              type="number"
              value={(assumptions.operatingExpenseGrowthRate * 100).toFixed(2)}
              onChange={(event) => updateAssumptionPercent("operatingExpenseGrowthRate", Number(event.target.value), -0.1, 0.35)}
              className="w-full bg-transparent text-gray-900 font-semibold outline-none"
            />
          </label>
          <label className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500 mb-1">Fixed Cost Inflation (%)</p>
            <input
              type="number"
              value={(assumptions.fixedCostInflationRate * 100).toFixed(2)}
              onChange={(event) => updateAssumptionPercent("fixedCostInflationRate", Number(event.target.value), 0, 0.15)}
              className="w-full bg-transparent text-gray-900 font-semibold outline-none"
            />
          </label>
          <label className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500 mb-1">COGS Ratio (%)</p>
            <input
              type="number"
              value={(assumptions.cogsRatio * 100).toFixed(2)}
              onChange={(event) => updateAssumptionPercent("cogsRatio", Number(event.target.value), 0.01, 0.9)}
              className="w-full bg-transparent text-gray-900 font-semibold outline-none"
            />
          </label>
          <label className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500 mb-1">Variable Cost Ratio (%)</p>
            <input
              type="number"
              value={(assumptions.variableCostRatio * 100).toFixed(2)}
              onChange={(event) => updateAssumptionPercent("variableCostRatio", Number(event.target.value), 0.01, 0.9)}
              className="w-full bg-transparent text-gray-900 font-semibold outline-none"
            />
          </label>
          <label className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500 mb-1">Marketing Spend (%)</p>
            <input
              type="number"
              value={(assumptions.marketingSpendRatio * 100).toFixed(2)}
              onChange={(event) => updateAssumptionPercent("marketingSpendRatio", Number(event.target.value), 0, 0.5)}
              className="w-full bg-transparent text-gray-900 font-semibold outline-none"
            />
          </label>
          <label className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500 mb-1">Cash Collection Ratio</p>
            <input
              type="number"
              value={assumptions.cashCollectionRatio.toFixed(3)}
              onChange={(event) => updateAssumptionNumber("cashCollectionRatio", Number(event.target.value), 0.4, 1.6)}
              className="w-full bg-transparent text-gray-900 font-semibold outline-none"
            />
          </label>
          <label className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500 mb-1">Cash Disbursement Ratio</p>
            <input
              type="number"
              value={assumptions.cashDisbursementRatio.toFixed(3)}
              onChange={(event) => updateAssumptionNumber("cashDisbursementRatio", Number(event.target.value), 0.4, 1.7)}
              className="w-full bg-transparent text-gray-900 font-semibold outline-none"
            />
          </label>
          <label className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500 mb-1">Fixed Cost Baseline (NGN)</p>
            <input
              type="number"
              value={Math.round(assumptions.fixedCostBaseline)}
              onChange={(event) => updateAssumptionNumber("fixedCostBaseline", Number(event.target.value), 0, 100000000000)}
              className="w-full bg-transparent text-gray-900 font-semibold outline-none"
            />
          </label>
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">Customer Growth (proxy)</p>
            <p className="font-semibold text-gray-900">{formatPercent(assumptions.customerGrowthProxy)}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">Pricing (Avg Revenue per Sale)</p>
            <p className="font-semibold text-gray-900">{formatNaira(assumptions.pricingPerRevenueEntry)}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">Sales Conversion (proxy)</p>
            <p className="font-semibold text-gray-900">{formatPercent(assumptions.salesConversionRateProxy)}</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          html,
          body {
            background: #ffffff !important;
          }

          .projection-print-root {
            color: #111827 !important;
          }

          .projection-print-root .print-hidden {
            display: none !important;
          }

          .projection-print-root .rounded-2xl {
            break-inside: avoid;
            page-break-inside: avoid;
            border-color: #d1d5db !important;
            box-shadow: none !important;
          }

          .projection-print-root .overflow-x-auto {
            overflow: visible !important;
          }

          .projection-print-root svg {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            height: auto !important;
          }

          .projection-print-root .pointer-events-none {
            display: none !important;
          }

          .projection-print-root input {
            border: 0 !important;
            padding: 0 !important;
            background: transparent !important;
          }
        }
      `}</style>
    </div>
  );
}
