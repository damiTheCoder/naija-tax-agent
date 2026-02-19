export type FinancialModelId =
  | "three-statement"
  | "forecast-model"
  | "dcf-model"
  | "budget-model"
  | "startup-model"
  | "cash-flow-model"
  | "break-even-model"
  | "scenario-model"
  | "valuation-model"
  | "unit-economics-model";

export type FinancialModelDefinition = {
  id: FinancialModelId;
  name: string;
  purpose: string;
  description: string;
  icon: "statements" | "forecast" | "dcf" | "budget" | "startup" | "cashflow" | "breakeven" | "scenario" | "valuation" | "unit";
};

export const FINANCIAL_MODELS: FinancialModelDefinition[] = [
  {
    id: "three-statement",
    name: "Three-statement",
    purpose: "Full business financial view",
    description: "Integrated income statement, cash flow, and balance sheet outputs from one assumption set.",
    icon: "statements",
  },
  {
    id: "forecast-model",
    name: "Forecast model",
    purpose: "Predict future performance",
    description: "Projects revenue, cost, and profit trend over time using growth and margin drivers.",
    icon: "forecast",
  },
  {
    id: "dcf-model",
    name: "DCF model",
    purpose: "Calculate company value",
    description: "Discounts projected free cash flows and terminal value to estimate enterprise value.",
    icon: "dcf",
  },
  {
    id: "budget-model",
    name: "Budget model",
    purpose: "Plan spending",
    description: "Compares planned versus actual spend across core categories and shows variance.",
    icon: "budget",
  },
  {
    id: "startup-model",
    name: "Startup model",
    purpose: "Startup growth planning",
    description: "Tracks customer growth, burn, runway, and unit growth assumptions for startup planning.",
    icon: "startup",
  },
  {
    id: "cash-flow-model",
    name: "Cash flow model",
    purpose: "Track cash movement",
    description: "Monitors operating, investing, and financing inflow/outflow and ending cash trajectory.",
    icon: "cashflow",
  },
  {
    id: "break-even-model",
    name: "Break-even model",
    purpose: "Find profitability point",
    description: "Calculates break-even units, break-even revenue, and margin of safety.",
    icon: "breakeven",
  },
  {
    id: "scenario-model",
    name: "Scenario model",
    purpose: "Risk planning",
    description: "Compares best/base/worst case assumptions and quantifies downside/upside impact.",
    icon: "scenario",
  },
  {
    id: "valuation-model",
    name: "Valuation model",
    purpose: "Investor valuation",
    description: "Blends revenue, EBITDA, and earnings multiple approaches for investor-ready valuation ranges.",
    icon: "valuation",
  },
  {
    id: "unit-economics-model",
    name: "Unit economics model",
    purpose: "Measure customer profitability",
    description: "Computes LTV, CAC, contribution margin, and payback period to test growth efficiency.",
    icon: "unit",
  },
];

export const FINANCIAL_MODELS_BY_ID: Record<FinancialModelId, FinancialModelDefinition> = FINANCIAL_MODELS.reduce(
  (acc, model) => {
    acc[model.id] = model;
    return acc;
  },
  {} as Record<FinancialModelId, FinancialModelDefinition>
);

export function isFinancialModelId(value: string): value is FinancialModelId {
  return value in FINANCIAL_MODELS_BY_ID;
}
