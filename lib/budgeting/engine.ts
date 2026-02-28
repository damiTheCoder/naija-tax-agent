import type { LedgerAccount, JournalEntry, JournalLine } from "@/lib/accounting/doubleEntry";
import type {
  Budget,
  BudgetAlert,
  BudgetCategoryAllocation,
  BudgetDashboardTotals,
  BudgetForecastPoint,
  BudgetHealthStatus,
  BudgetImpact,
  BudgetPerformance,
  BudgetRunway,
  MonthlyBudgetPoint,
  ScenarioResult,
} from "@/lib/budgeting/types";
import type { BudgetScenario } from "@/lib/budgeting/types";

const monthFormatter = new Intl.DateTimeFormat("en-NG", { month: "short", year: "numeric" });

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "").trim();

const toDate = (value: string): Date => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date("1970-01-01");
  return parsed;
};

const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

const endOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const monthKey = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (date: Date): string => monthFormatter.format(date);

const codeToNumber = (code: string): number => {
  const parsed = Number(code.trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const isExpenseCode = (code: string): boolean => {
  const value = codeToNumber(code);
  return value >= 5000 && value <= 7999;
};

const isRevenueCode = (code: string): boolean => code.trim().startsWith("4");

const amountFromLine = (line: JournalLine, type: "expense" | "revenue"): number => {
  const debit = line.debit || 0;
  const credit = line.credit || 0;
  if (type === "expense") return Math.max(0, debit - credit);
  return Math.max(0, credit - debit);
};

const inferCategoryFromLine = (line: JournalLine): string => {
  const code = line.accountCode.trim();
  const name = line.accountName.toLowerCase();

  if (code.startsWith("50")) return "Inventory / COGS";
  if (code === "5500" || name.includes("salary") || name.includes("wages")) return "Payroll";
  if (code === "5600" || name.includes("rent")) return "Rent";
  if (code === "5610" || name.includes("utilit")) return "Utilities";
  if (code === "5620" || name.includes("internet") || name.includes("telephone")) return "Technology";
  if (code === "5820" || name.includes("supplies")) return "Office Supplies";
  if (code === "6000" || name.includes("marketing") || name.includes("advert")) return "Marketing";
  if (code === "6010" || name.includes("travel") || name.includes("entertain")) return "Travel";
  if (code === "6030" || name.includes("bank charge")) return "Bank Charges";
  if (code.startsWith("7") || name.includes("tax")) return "Tax";
  if (isRevenueCode(code)) return "Revenue";

  const cleaned = line.accountName.trim();
  return cleaned.length ? cleaned : "Other";
};

const inferDepartment = (line: JournalLine, narration: string): string => {
  const name = line.accountName.toLowerCase();
  const combined = `${name} ${narration.toLowerCase()}`;

  if (combined.includes("market") || line.accountCode === "6000") return "Marketing";
  if (combined.includes("engineer") || combined.includes("software") || line.accountCode === "5620") return "Engineering";
  if (combined.includes("salary") || combined.includes("hr") || line.accountCode === "5500") return "People";
  if (combined.includes("operation") || combined.includes("inventory") || line.accountCode.startsWith("50")) return "Operations";
  if (combined.includes("finance") || combined.includes("bank") || line.accountCode === "6030") return "Finance";
  if (combined.includes("sales") || combined.includes("customer") || line.accountCode.startsWith("4")) return "Sales";

  return "General";
};

const rangesOverlap = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean => {
  return aStart <= bEnd && bStart <= aEnd;
};

const dateInRange = (date: Date, start: Date, end: Date): boolean => {
  return date >= start && date <= end;
};

const monthsInRangeInclusive = (start: Date, end: Date): number => {
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
  return Math.max(1, months);
};

const classifyStatus = (utilizationPercent: number): BudgetHealthStatus => {
  if (utilizationPercent > 100) return "over";
  if (utilizationPercent >= 85) return "warning";
  return "healthy";
};

const matchCategoryAllocation = (allocation: BudgetCategoryAllocation, impact: BudgetImpact): boolean => {
  if (allocation.accountCodes && allocation.accountCodes.length > 0) {
    if (!allocation.accountCodes.includes(impact.accountCode)) return false;
  }

  if (allocation.department && normalize(allocation.department) !== normalize(impact.department)) {
    return false;
  }

  if (!allocation.category.trim()) return true;

  const allocationNormalized = normalize(allocation.category);
  const impactNormalized = normalize(impact.category);

  return (
    allocationNormalized === impactNormalized ||
    allocationNormalized.includes(impactNormalized) ||
    impactNormalized.includes(allocationNormalized)
  );
};

export const formatNaira = (amount: number): string => currencyFormatter.format(Math.round(amount || 0));

export const formatNairaCompact = (amount: number): string => {
  const value = Math.round(amount || 0);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  const compact = (divisor: number, suffix: "K" | "M" | "B") => {
    const scaled = abs / divisor;
    const formatted = scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, "");
    return `${sign}₦${formatted}${suffix}`;
  };

  if (abs >= 1_000_000_000) return compact(1_000_000_000, "B");
  if (abs >= 1_000_000) return compact(1_000_000, "M");
  if (abs >= 1_000) return compact(1_000, "K");
  return `${sign}₦${abs.toLocaleString("en-NG")}`;
};

export const formatPercent = (value: number): string => `${Math.round(value)}%`;

export const getPeriodLabel = (budget: Budget): string => {
  const start = toDate(budget.startDate);
  const end = toDate(budget.endDate);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString("en-NG", { month: "short", year: "numeric" });
  const endLabel = end.toLocaleDateString("en-NG", { month: "short", year: "numeric" });

  if (budget.period === "monthly") return `${startLabel}`;
  if (budget.period === "quarterly" && sameYear) return `${start.getFullYear()} (Quarterly)`;
  if (budget.period === "yearly" && sameYear) return `${start.getFullYear()} (Annual)`;
  return `${startLabel} - ${endLabel}`;
};

export const extractBudgetImpacts = (entries: JournalEntry[]): BudgetImpact[] => {
  const impacts: BudgetImpact[] = [];
  const seen = new Set<string>();

  entries
    .filter((entry) => entry.status === "posted")
    .forEach((entry) => {
      entry.lines.forEach((line, index) => {
        const code = (line.accountCode || "").trim();
        if (!code) return;

        const type = isExpenseCode(code) ? "expense" : isRevenueCode(code) ? "revenue" : null;
        if (!type) return;

        const amount = amountFromLine(line, type);
        if (amount <= 0) return;

        const key = `${entry.id}:${code}:${index}:${amount}:${type}`;
        if (seen.has(key)) return;
        seen.add(key);

        impacts.push({
          journalId: entry.id,
          date: entry.date || entry.createdAt,
          description: entry.narration,
          amount,
          type,
          accountCode: code,
          accountName: line.accountName,
          category: inferCategoryFromLine(line),
          department: inferDepartment(line, entry.narration || ""),
        });
      });
    });

  return impacts.sort((a, b) => toDate(b.date).getTime() - toDate(a.date).getTime());
};

export const computeBudgetPerformance = (budget: Budget, impacts: BudgetImpact[]): BudgetPerformance => {
  const periodStart = toDate(budget.startDate);
  const periodEnd = toDate(budget.endDate);

  const periodImpacts = impacts.filter((impact) => {
    const date = toDate(impact.date);
    return impact.type === "expense" && dateInRange(date, periodStart, periodEnd);
  });

  const totalActual = periodImpacts.reduce((sum, impact) => sum + impact.amount, 0);
  const totalBudgeted = Math.max(0, budget.totalAmount || 0);
  const totalRemaining = totalBudgeted - totalActual;
  const utilizationPercent = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0;

  const categoryRows = budget.categories.map((allocation) => {
    const actual = periodImpacts
      .filter((impact) => matchCategoryAllocation(allocation, impact))
      .reduce((sum, impact) => sum + impact.amount, 0);

    const remaining = allocation.amount - actual;
    const variance = actual - allocation.amount;
    const rowUtilization = allocation.amount > 0 ? (actual / allocation.amount) * 100 : 0;

    return {
      category: allocation.category,
      budgeted: allocation.amount,
      actual,
      remaining,
      variance,
      utilizationPercent: rowUtilization,
    };
  });

  const departmentRows = budget.departments.map((allocation) => {
    const actual = periodImpacts
      .filter((impact) => normalize(impact.department) === normalize(allocation.department))
      .reduce((sum, impact) => sum + impact.amount, 0);

    const remaining = allocation.amount - actual;
    const variance = actual - allocation.amount;
    const rowUtilization = allocation.amount > 0 ? (actual / allocation.amount) * 100 : 0;

    return {
      department: allocation.department,
      budgeted: allocation.amount,
      actual,
      remaining,
      variance,
      utilizationPercent: rowUtilization,
    };
  });

  return {
    budgetId: budget.id,
    budgetName: budget.name,
    periodLabel: getPeriodLabel(budget),
    totalBudgeted,
    totalActual,
    totalRemaining,
    utilizationPercent,
    status: classifyStatus(utilizationPercent),
    categoryRows,
    departmentRows,
    matchedTransactionCount: periodImpacts.length,
  };
};

export const computeAllBudgetPerformance = (budgets: Budget[], impacts: BudgetImpact[]): BudgetPerformance[] => {
  return budgets.map((budget) => computeBudgetPerformance(budget, impacts));
};

export const computeDashboardTotals = (performanceRows: BudgetPerformance[]): BudgetDashboardTotals => {
  const totalBudgeted = performanceRows.reduce((sum, row) => sum + row.totalBudgeted, 0);
  const totalSpent = performanceRows.reduce((sum, row) => sum + row.totalActual, 0);
  const totalRemaining = totalBudgeted - totalSpent;
  const utilizationPercent = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  return {
    totalBudgeted,
    totalSpent,
    totalRemaining,
    utilizationPercent,
    overBudgetCount: performanceRows.filter((row) => row.status === "over").length,
    warningCount: performanceRows.filter((row) => row.status === "warning").length,
  };
};

export const buildMonthlyBudgetSeries = (
  budgets: Budget[],
  impacts: BudgetImpact[],
  months = 12,
  anchor = new Date()
): MonthlyBudgetPoint[] => {
  const points: MonthlyBudgetPoint[] = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(anchor.getFullYear(), anchor.getMonth() - offset, 1);
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);

    const budgeted = budgets.reduce((sum, budget) => {
      const budgetStart = toDate(budget.startDate);
      const budgetEnd = toDate(budget.endDate);
      if (!rangesOverlap(monthStart, monthEnd, budgetStart, budgetEnd)) return sum;

      const monthCount = monthsInRangeInclusive(startOfMonth(budgetStart), endOfMonth(budgetEnd));
      return sum + budget.totalAmount / monthCount;
    }, 0);

    const monthImpacts = impacts.filter((impact) => {
      const impactDate = toDate(impact.date);
      return dateInRange(impactDate, monthStart, monthEnd);
    });

    const actual = monthImpacts
      .filter((impact) => impact.type === "expense")
      .reduce((sum, impact) => sum + impact.amount, 0);

    const revenue = monthImpacts
      .filter((impact) => impact.type === "revenue")
      .reduce((sum, impact) => sum + impact.amount, 0);

    points.push({
      monthKey: monthKey(date),
      monthLabel: monthLabel(date),
      budgeted,
      actual,
      revenue,
      net: revenue - actual,
    });
  }

  return points;
};

export const computeRunwayForecast = (
  impacts: BudgetImpact[],
  ledgerAccounts: Map<string, LedgerAccount>,
  horizonMonths = 12
): { points: BudgetForecastPoint[]; runway: BudgetRunway } => {
  const monthly = buildMonthlyBudgetSeries([], impacts, 6);

  const monthlyRevenue = monthly.length
    ? monthly.reduce((sum, month) => sum + month.revenue, 0) / monthly.length
    : 0;

  const monthlyExpenses = monthly.length
    ? monthly.reduce((sum, month) => sum + month.actual, 0) / monthly.length
    : 0;

  const monthlyBurn = Math.max(0, monthlyExpenses - monthlyRevenue);

  const cashCodes = ["1000", "1010", "1020", "1021"];
  const startingCash = cashCodes.reduce((sum, code) => sum + (ledgerAccounts.get(code)?.closingBalance || 0), 0);

  const runwayMonths = monthlyBurn <= 0 ? 99 : Math.max(0, startingCash / monthlyBurn);

  const points: BudgetForecastPoint[] = [];
  for (let step = 1; step <= horizonMonths; step += 1) {
    const date = new Date();
    date.setMonth(date.getMonth() + step);

    const projectedRevenue = monthlyRevenue;
    const projectedExpenses = monthlyExpenses;
    const projectedCash = startingCash + (projectedRevenue - projectedExpenses) * step;

    points.push({
      monthKey: monthKey(date),
      monthLabel: monthLabel(date),
      projectedRevenue,
      projectedExpenses,
      projectedCash,
    });
  }

  return {
    points,
    runway: {
      runwayMonths,
      monthlyBurn,
      monthlyRevenue,
      startingCash,
    },
  };
};

export const buildBudgetAlerts = (
  performanceRows: BudgetPerformance[],
  runway: BudgetRunway,
  thresholdPercent = 85
): BudgetAlert[] => {
  const alerts: BudgetAlert[] = [];

  performanceRows.forEach((row) => {
    if (row.utilizationPercent > 100) {
      alerts.push({
        id: `${row.budgetId}-over`,
        severity: "critical",
        title: `${row.budgetName} is over budget`,
        message: `Spent ${formatPercent(row.utilizationPercent)} of allocated budget.`,
      });
      return;
    }

    if (row.utilizationPercent >= thresholdPercent) {
      alerts.push({
        id: `${row.budgetId}-warning`,
        severity: "warning",
        title: `${row.budgetName} nearing limit`,
        message: `Budget utilization reached ${formatPercent(row.utilizationPercent)}.`,
      });
    }
  });

  if (runway.runwayMonths > 0 && runway.runwayMonths < 6) {
    alerts.push({
      id: "runway-risk",
      severity: "critical",
      title: "Cash runway risk",
      message: `Projected runway is ${runway.runwayMonths.toFixed(1)} months at current burn.`,
    });
  } else if (runway.runwayMonths >= 6 && runway.runwayMonths < 12) {
    alerts.push({
      id: "runway-warning",
      severity: "warning",
      title: "Runway needs monitoring",
      message: `Projected runway is ${runway.runwayMonths.toFixed(1)} months.`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "healthy",
      severity: "info",
      title: "Budgets are on track",
      message: "No immediate budget or runway risks detected.",
    });
  }

  return alerts;
};

export const simulateScenario = (scenario: BudgetScenario, runway: BudgetRunway): ScenarioResult => {
  const baselineRevenue = runway.monthlyRevenue;
  const baselineExpense = runway.monthlyRevenue + runway.monthlyBurn;

  let scenarioRevenue = baselineRevenue;
  let scenarioExpense = baselineExpense;

  scenario.adjustments.forEach((adjustment) => {
    const factor = adjustment.valuePercent / 100;
    if (adjustment.type === "increase-expense") scenarioExpense *= 1 + factor;
    if (adjustment.type === "reduce-expense") scenarioExpense *= Math.max(0, 1 - factor);
    if (adjustment.type === "increase-revenue") scenarioRevenue *= 1 + factor;
    if (adjustment.type === "reduce-revenue") scenarioRevenue *= Math.max(0, 1 - factor);
  });

  const baselineProfit = baselineRevenue - baselineExpense;
  const scenarioProfit = scenarioRevenue - scenarioExpense;

  const scenarioBurn = Math.max(0, scenarioExpense - scenarioRevenue);
  const scenarioRunwayMonths = scenarioBurn <= 0 ? 99 : runway.startingCash / scenarioBurn;

  return {
    scenario,
    baselineRunwayMonths: runway.runwayMonths,
    scenarioRunwayMonths,
    deltaRunwayMonths: scenarioRunwayMonths - runway.runwayMonths,
    projectedProfitDelta: scenarioProfit - baselineProfit,
  };
};
