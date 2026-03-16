import { jsPDF } from "jspdf";
import { configureJsPdfTypography } from "@/lib/pdf/jspdfTypography";
import type { StatementDraft } from "@/lib/accounting/types";

export type FinancialRatiosPdfPayload = {
  statements: StatementDraft;
  businessName?: string;
  generatedAt?: string;
};

const BODY_TEXT: [number, number, number] = [40, 40, 40];
const MUTED_TEXT: [number, number, number] = [120, 120, 120];

async function createDoc(): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await configureJsPdfTypography(doc, "helvetica");
  return doc;
}

function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return "N0";
  const absAmount = Math.abs(amount);
  const whole = Math.round(absAmount).toString();
  const digits = whole.split("").reverse();
  let formatted = "";
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && i % 3 === 0) formatted = "," + formatted;
    formatted = digits[i] + formatted;
  }
  return `N${formatted}`;
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(2)}%`;
}

function formatMultiplier(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(2)}x`;
}

function safeDivide(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

type RatioRow = {
  label: string;
  value: string;
  hint?: string;
};

function addSection(doc: jsPDF, title: string, rows: RatioRow[], y: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const maxWidth = pageWidth - margin * 2;

  const ensureSpace = (space: number) => {
    if (y + space > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  ensureSpace(8);
  doc.setFontSize(12);
  doc.setTextColor(...BODY_TEXT);
  doc.text(title, margin, y);
  y += 6;

  rows.forEach((row) => {
    const hintLines = row.hint ? doc.splitTextToSize(row.hint, maxWidth * 0.6) : [];
    const rowHeight = 5 + (hintLines.length > 0 ? hintLines.length * 4 : 0);
    ensureSpace(rowHeight + 2);

    doc.setFontSize(10);
    doc.setTextColor(...BODY_TEXT);
    doc.text(row.label, margin, y);
    doc.text(row.value, pageWidth - margin, y, { align: "right" });

    if (hintLines.length > 0) {
      doc.setFontSize(8);
      doc.setTextColor(...MUTED_TEXT);
      doc.text(hintLines, margin, y + 4);
      y += hintLines.length * 4;
    }

    y += 6;
  });

  return y + 2;
}

export async function generateFinancialRatiosPDF(payload: FinancialRatiosPdfPayload): Promise<void> {
  const statements = payload.statements;
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

  const ratios = {
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

  const doc = await createDoc();
  const margin = 14;
  let y = margin;

  const title = "Financial Ratios Report";
  const subtitle = payload.businessName ? payload.businessName : "Atom Ledger";
  const generatedAt = payload.generatedAt ? new Date(payload.generatedAt) : new Date();
  const generatedLabel = `Generated ${generatedAt.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}`;

  doc.setFontSize(16);
  doc.setTextColor(...BODY_TEXT);
  doc.text(title, margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.setTextColor(...MUTED_TEXT);
  doc.text(subtitle, margin, y);
  doc.text(generatedLabel, doc.internal.pageSize.getWidth() - margin, y, { align: "right" });
  y += 8;

  y = addSection(doc, "Profitability Ratios", [
    { label: "Gross Margin", value: formatPercent(ratios.grossMargin), hint: "(Revenue - COGS) / Revenue" },
    { label: "Operating Margin", value: formatPercent(ratios.operatingMargin), hint: "Operating income / Revenue" },
    { label: "Net Margin", value: formatPercent(ratios.netMargin), hint: "Net income / Revenue" },
    { label: "Operating Expense Ratio", value: formatPercent(ratios.opexRatio), hint: "Operating expenses / Revenue" },
    { label: "COGS Ratio", value: formatPercent(ratios.cogsRatio), hint: "Cost of sales / Revenue" },
  ], y);

  y = addSection(doc, "Efficiency Ratios", [
    { label: "Asset Turnover", value: formatMultiplier(ratios.assetTurnover), hint: "Revenue / Assets" },
    { label: "Cashflow Margin", value: formatPercent(ratios.cashflowMargin), hint: "Operating cashflow / Revenue" },
  ], y);

  y = addSection(doc, "Leverage & Solvency", [
    { label: "Debt to Equity", value: formatMultiplier(ratios.debtToEquity), hint: "Liabilities / Equity" },
    { label: "Debt Ratio", value: formatPercent(ratios.debtRatio), hint: "Liabilities / Assets" },
    { label: "Equity Ratio", value: formatPercent(ratios.equityRatio), hint: "Equity / Assets" },
  ], y);

  y = addSection(doc, "Core Statement Figures", [
    { label: "Revenue", value: formatCurrency(revenue) },
    { label: "Gross Profit", value: formatCurrency(grossProfit) },
    { label: "Operating Income", value: formatCurrency(operatingIncome) },
    { label: "Net Income", value: formatCurrency(netIncome) },
    { label: "Total Assets", value: formatCurrency(assets) },
    { label: "Total Liabilities", value: formatCurrency(liabilities) },
    { label: "Total Equity", value: formatCurrency(equity) },
    { label: "Cash From Operations", value: formatCurrency(cashFromOperations) },
  ], y);

  const filename = `financial-ratios-${generatedAt.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
