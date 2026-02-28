export type BudgetPeriod = "monthly" | "quarterly" | "yearly" | "custom";

export type BudgetHealthStatus = "healthy" | "warning" | "over";

export type BudgetTransactionType = "expense" | "revenue";

export interface BudgetCategoryAllocation {
  id: string;
  category: string;
  amount: number;
  accountCodes?: string[];
  department?: string;
}

export interface BudgetDepartmentAllocation {
  id: string;
  department: string;
  amount: number;
}

export interface Budget {
  id: string;
  name: string;
  period: BudgetPeriod;
  startDate: string;
  endDate: string;
  totalAmount: number;
  categories: BudgetCategoryAllocation[];
  departments: BudgetDepartmentAllocation[];
  linkedAccountCodes: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetTemplateCategory {
  category: string;
  share: number;
  accountCodes?: string[];
  department?: string;
}

export interface BudgetTemplate {
  id: string;
  name: string;
  description: string;
  period: BudgetPeriod;
  defaultAmount: number;
  categories: BudgetTemplateCategory[];
}

export type ScenarioAdjustmentType =
  | "increase-expense"
  | "reduce-expense"
  | "increase-revenue"
  | "reduce-revenue";

export interface BudgetScenarioAdjustment {
  id: string;
  label: string;
  type: ScenarioAdjustmentType;
  valuePercent: number;
  target?: string;
}

export interface BudgetScenario {
  id: string;
  name: string;
  description: string;
  adjustments: BudgetScenarioAdjustment[];
  createdAt: string;
  updatedAt: string;
}

export interface BudgetingSettings {
  currency: "NGN";
  taxJurisdiction: string;
  fiscalYearStartMonth: number;
  defaultDepartments: string[];
  alertThresholdPercent: number;
}

export interface BudgetingState {
  version: number;
  budgets: Budget[];
  templates: BudgetTemplate[];
  scenarios: BudgetScenario[];
  settings: BudgetingSettings;
  lastUpdated: string;
}

export interface BudgetImpact {
  journalId: string;
  date: string;
  description: string;
  amount: number;
  type: BudgetTransactionType;
  accountCode: string;
  accountName: string;
  category: string;
  department: string;
}

export interface BudgetCategoryPerformance {
  category: string;
  budgeted: number;
  actual: number;
  remaining: number;
  variance: number;
  utilizationPercent: number;
}

export interface BudgetDepartmentPerformance {
  department: string;
  budgeted: number;
  actual: number;
  remaining: number;
  variance: number;
  utilizationPercent: number;
}

export interface BudgetPerformance {
  budgetId: string;
  budgetName: string;
  periodLabel: string;
  totalBudgeted: number;
  totalActual: number;
  totalRemaining: number;
  utilizationPercent: number;
  status: BudgetHealthStatus;
  categoryRows: BudgetCategoryPerformance[];
  departmentRows: BudgetDepartmentPerformance[];
  matchedTransactionCount: number;
}

export interface BudgetDashboardTotals {
  totalBudgeted: number;
  totalSpent: number;
  totalRemaining: number;
  utilizationPercent: number;
  overBudgetCount: number;
  warningCount: number;
}

export interface MonthlyBudgetPoint {
  monthKey: string;
  monthLabel: string;
  budgeted: number;
  actual: number;
  revenue: number;
  net: number;
}

export interface BudgetForecastPoint {
  monthKey: string;
  monthLabel: string;
  projectedRevenue: number;
  projectedExpenses: number;
  projectedCash: number;
}

export interface BudgetAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
}

export interface BudgetRunway {
  runwayMonths: number;
  monthlyBurn: number;
  monthlyRevenue: number;
  startingCash: number;
}

export interface ScenarioResult {
  scenario: BudgetScenario;
  baselineRunwayMonths: number;
  scenarioRunwayMonths: number;
  deltaRunwayMonths: number;
  projectedProfitDelta: number;
}
