import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";

type SummaryPayload = {
  projectedRevenueAnnual: number;
  projectedRevenueSixMonth: number;
  projectedNetProfitSixMonth: number;
  projectedGrossMargin: number;
  burnRate: number;
  projectedCashBalance: number;
  closingCashBalance: number;
  runwayMonths: number | null;
  breakEvenMonth: string | null;
  breakEvenRevenue: number;
};

type AssumptionsPayload = {
  revenueGrowthRate: number;
  operatingExpenseGrowthRate: number;
  fixedCostInflationRate: number;
  cogsRatio: number;
  variableCostRatio: number;
  marketingSpendRatio: number;
  cashCollectionRatio: number;
  cashDisbursementRatio: number;
  fixedCostBaseline: number;
};

type ScenarioLine = {
  endingCash: number;
  totalRevenue: number;
  totalNetProfit: number;
  runwayMonths: number | null;
};

type TimelineLine = {
  month: string;
  revenue: number;
  totalExpenses: number;
  netProfit: number;
  cashBalance: number;
};

type RevenueTrendPoint = { label: string; revenue: number; kind?: string };
type ProfitabilityPoint = { label: string; grossProfit: number; netProfit: number; ebitda: number; kind?: string };
type ExpenseBreakdownPoint = {
  label: string;
  cogs: number;
  fixedCosts: number;
  variableCosts: number;
  marketingCosts: number;
  totalExpenses: number;
  kind?: string;
};
type CashflowPoint = { label: string; cashInflow: number; cashOutflow: number; netCashflow: number; kind?: string };
type CashBalancePoint = { label: string; cashBalance: number; kind?: string };
type BreakEvenPoint = { label: string; revenue: number; expenses: number };
type ScenarioComparisonPoint = { label: string; conservative: number; expected: number; aggressive: number };

type ChartsPayload = {
  revenueTrend: RevenueTrendPoint[];
  profitability: ProfitabilityPoint[];
  expenseBreakdown: ExpenseBreakdownPoint[];
  cashflow: CashflowPoint[];
  cashBalance: CashBalancePoint[];
  breakEven: BreakEvenPoint[];
  scenarioComparison: ScenarioComparisonPoint[];
};

type DashboardPdfPayload = {
  generatedAt?: string;
  summary: SummaryPayload;
  assumptions: AssumptionsPayload;
  scenarioSummary: {
    conservative: ScenarioLine;
    expected: ScenarioLine;
    aggressive: ScenarioLine;
  };
  timeline: TimelineLine[];
  charts: ChartsPayload;
};

type PdfDoc = InstanceType<typeof PDFDocument>;

type ChartSeries = {
  label: string;
  color: string;
  values: number[];
};

function safeNum(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatNaira(value: number): string {
  return `₦${Math.round(value || 0).toLocaleString("en-NG")}`;
}

function formatPercent(value: number): string {
  return `${(safeNum(value) * 100).toFixed(2)}%`;
}

function formatAxisValue(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}₦${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}b`;
  if (abs >= 1_000_000) return `${sign}₦${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (abs >= 1_000) return `${sign}₦${(abs / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${sign}₦${Math.round(abs)}`;
}

function ensureSpace(doc: PdfDoc, requiredHeight = 32): void {
  if (doc.y + requiredHeight > doc.page.height - 28) {
    doc.addPage();
  }
}

function sectionTitle(doc: PdfDoc, title: string, subtitle?: string): void {
  ensureSpace(doc, 30);
  doc
    .moveDown(0.25)
    .font("Helvetica-Bold")
    .fontSize(12.5)
    .fillColor("#111827")
    .text(title);
  if (subtitle) {
    doc
      .moveDown(0.1)
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#6b7280")
      .text(subtitle);
  }
  doc.moveDown(0.2);
}

function line(doc: PdfDoc, label: string, value: string): void {
  ensureSpace(doc, 15);
  doc
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .fillColor("#374151")
    .text(`${label}: `, { continued: true });
  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor("#111827")
    .text(value);
}

function scenarioRow(doc: PdfDoc, label: string, row: ScenarioLine): void {
  line(
    doc,
    label,
    `Revenue ${formatNaira(row.totalRevenue)} | Net ${formatNaira(row.totalNetProfit)} | Ending Cash ${formatNaira(
      row.endingCash
    )} | Runway ${row.runwayMonths === null ? "> horizon" : `${row.runwayMonths.toFixed(1)} months`}`
  );
}

function normalizeSeriesBounds(series: ChartSeries[], includeZero = true): { min: number; max: number } {
  const values = series.flatMap((item) => item.values).filter((value) => Number.isFinite(value));
  if (values.length === 0) return { min: 0, max: 1 };

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (min === max) {
    const delta = Math.max(1, Math.abs(min) * 0.1);
    min -= delta;
    max += delta;
  }
  return { min, max };
}

function drawLegend(doc: PdfDoc, x: number, y: number, series: ChartSeries[]): void {
  let cursorX = x;
  for (const item of series) {
    doc
      .rect(cursorX, y + 2, 9, 9)
      .fillColor(item.color)
      .fill();
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor("#374151")
      .text(item.label, cursorX + 12, y, { lineBreak: false });
    cursorX += 12 + doc.widthOfString(item.label) + 14;
  }
}

function drawLineChart(doc: PdfDoc, opts: {
  title: string;
  subtitle?: string;
  labels: string[];
  series: ChartSeries[];
  height?: number;
  includeZero?: boolean;
}): void {
  const { title, subtitle, labels, series, includeZero = true } = opts;
  const height = opts.height ?? 170;
  const titleHeight = subtitle ? 28 : 18;
  const requiredHeight = titleHeight + height + 42;
  ensureSpace(doc, requiredHeight);

  const left = 38;
  const width = doc.page.width - 76;
  const yStart = doc.y;
  const top = yStart + titleHeight;
  const axisLabelWidth = 60;
  const bottomLabelHeight = 18;
  const plotX = left + axisLabelWidth;
  const plotY = top + 4;
  const plotW = width - axisLabelWidth - 8;
  const plotH = height - bottomLabelHeight;
  const count = Math.max(2, labels.length);

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#111827")
    .text(title, left, yStart);
  if (subtitle) {
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor("#6b7280")
      .text(subtitle, left, yStart + 12);
  }
  drawLegend(doc, left + 340, yStart, series);

  const bounds = normalizeSeriesBounds(series, includeZero);
  const valueToY = (value: number): number => plotY + plotH - ((value - bounds.min) / (bounds.max - bounds.min)) * plotH;
  const indexToX = (index: number): number => plotX + (index / Math.max(1, count - 1)) * plotW;

  // Grid + Y axis labels
  const ticks = 4;
  for (let i = 0; i <= ticks; i += 1) {
    const ratio = i / ticks;
    const y = plotY + ratio * plotH;
    const value = bounds.max - (bounds.max - bounds.min) * ratio;
    doc
      .moveTo(plotX, y)
      .lineTo(plotX + plotW, y)
      .lineWidth(i === ticks ? 1 : 0.5)
      .strokeColor("#e5e7eb")
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor("#6b7280")
      .text(formatAxisValue(value), left, y - 4, {
        width: axisLabelWidth - 6,
        align: "right",
      });
  }

  // Zero line
  if (bounds.min < 0 && bounds.max > 0) {
    const zeroY = valueToY(0);
    doc
      .moveTo(plotX, zeroY)
      .lineTo(plotX + plotW, zeroY)
      .lineWidth(1)
      .strokeColor("#9ca3af")
      .stroke();
  }

  // X labels
  const labelStep = Math.max(1, Math.ceil(count / 8));
  for (let i = 0; i < labels.length; i += 1) {
    if (i % labelStep !== 0 && i !== labels.length - 1) continue;
    const x = indexToX(i);
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor("#6b7280")
      .text(labels[i], x - 16, plotY + plotH + 4, { width: 32, align: "center" });
  }

  // Series
  for (const item of series) {
    if (!item.values.length) continue;
    doc.lineWidth(1.6).strokeColor(item.color);
    item.values.forEach((value, index) => {
      const x = indexToX(index);
      const y = valueToY(value);
      if (index === 0) {
        doc.moveTo(x, y);
      } else {
        doc.lineTo(x, y);
      }
    });
    doc.stroke();

    item.values.forEach((value, index) => {
      const x = indexToX(index);
      const y = valueToY(value);
      doc.circle(x, y, 1.8).fillColor(item.color).fill();
    });
  }

  doc.y = plotY + plotH + 24;
}

function drawGroupedBarChart(doc: PdfDoc, opts: {
  title: string;
  subtitle?: string;
  labels: string[];
  series: ChartSeries[];
  height?: number;
  includeZero?: boolean;
}): void {
  const { title, subtitle, labels, series, includeZero = true } = opts;
  const height = opts.height ?? 170;
  const titleHeight = subtitle ? 28 : 18;
  const requiredHeight = titleHeight + height + 42;
  ensureSpace(doc, requiredHeight);

  const left = 38;
  const width = doc.page.width - 76;
  const yStart = doc.y;
  const top = yStart + titleHeight;
  const axisLabelWidth = 60;
  const bottomLabelHeight = 18;
  const plotX = left + axisLabelWidth;
  const plotY = top + 4;
  const plotW = width - axisLabelWidth - 8;
  const plotH = height - bottomLabelHeight;
  const count = Math.max(1, labels.length);

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#111827")
    .text(title, left, yStart);
  if (subtitle) {
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor("#6b7280")
      .text(subtitle, left, yStart + 12);
  }
  drawLegend(doc, left + 340, yStart, series);

  const bounds = normalizeSeriesBounds(series, includeZero);
  const valueToY = (value: number): number => plotY + plotH - ((value - bounds.min) / (bounds.max - bounds.min)) * plotH;
  const groupW = plotW / count;
  const innerGap = 1.5;
  const barArea = groupW * 0.76;
  const barW = Math.max(2, Math.min(16, (barArea - (series.length - 1) * innerGap) / Math.max(1, series.length)));

  // Grid + Y axis labels
  const ticks = 4;
  for (let i = 0; i <= ticks; i += 1) {
    const ratio = i / ticks;
    const y = plotY + ratio * plotH;
    const value = bounds.max - (bounds.max - bounds.min) * ratio;
    doc
      .moveTo(plotX, y)
      .lineTo(plotX + plotW, y)
      .lineWidth(i === ticks ? 1 : 0.5)
      .strokeColor("#e5e7eb")
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor("#6b7280")
      .text(formatAxisValue(value), left, y - 4, {
        width: axisLabelWidth - 6,
        align: "right",
      });
  }

  const zeroY = valueToY(0);
  doc
    .moveTo(plotX, zeroY)
    .lineTo(plotX + plotW, zeroY)
    .lineWidth(1)
    .strokeColor("#9ca3af")
    .stroke();

  const labelStep = Math.max(1, Math.ceil(count / 8));
  for (let i = 0; i < labels.length; i += 1) {
    const x = plotX + i * groupW;
    const groupStartX = x + (groupW - (barW * series.length + innerGap * (series.length - 1))) / 2;
    series.forEach((item, seriesIndex) => {
      const value = safeNum(item.values[i], 0);
      const y = valueToY(value);
      const barX = groupStartX + seriesIndex * (barW + innerGap);
      const barY = Math.min(y, zeroY);
      const barH = Math.max(1, Math.abs(zeroY - y));
      doc.rect(barX, barY, barW, barH).fillColor(item.color).fill();
    });

    if (i % labelStep === 0 || i === labels.length - 1) {
      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor("#6b7280")
        .text(labels[i], x + groupW / 2 - 16, plotY + plotH + 4, { width: 32, align: "center" });
    }
  }

  doc.y = plotY + plotH + 24;
}

function toRevenueTrend(points: unknown): RevenueTrendPoint[] {
  if (!Array.isArray(points)) return [];
  return points.slice(0, 24).map((point) => {
    const row = point as Partial<RevenueTrendPoint>;
    return {
      label: safeText(row.label),
      revenue: safeNum(row.revenue),
      kind: safeText(row.kind),
    };
  });
}

function toProfitability(points: unknown): ProfitabilityPoint[] {
  if (!Array.isArray(points)) return [];
  return points.slice(0, 24).map((point) => {
    const row = point as Partial<ProfitabilityPoint>;
    return {
      label: safeText(row.label),
      grossProfit: safeNum(row.grossProfit),
      netProfit: safeNum(row.netProfit),
      ebitda: safeNum(row.ebitda),
      kind: safeText(row.kind),
    };
  });
}

function toExpenseBreakdown(points: unknown): ExpenseBreakdownPoint[] {
  if (!Array.isArray(points)) return [];
  return points.slice(0, 20).map((point) => {
    const row = point as Partial<ExpenseBreakdownPoint>;
    return {
      label: safeText(row.label),
      cogs: safeNum(row.cogs),
      fixedCosts: safeNum(row.fixedCosts),
      variableCosts: safeNum(row.variableCosts),
      marketingCosts: safeNum(row.marketingCosts),
      totalExpenses: safeNum(row.totalExpenses),
      kind: safeText(row.kind),
    };
  });
}

function toCashflow(points: unknown): CashflowPoint[] {
  if (!Array.isArray(points)) return [];
  return points.slice(0, 20).map((point) => {
    const row = point as Partial<CashflowPoint>;
    return {
      label: safeText(row.label),
      cashInflow: safeNum(row.cashInflow),
      cashOutflow: safeNum(row.cashOutflow),
      netCashflow: safeNum(row.netCashflow),
      kind: safeText(row.kind),
    };
  });
}

function toCashBalance(points: unknown): CashBalancePoint[] {
  if (!Array.isArray(points)) return [];
  return points.slice(0, 24).map((point) => {
    const row = point as Partial<CashBalancePoint>;
    return {
      label: safeText(row.label),
      cashBalance: safeNum(row.cashBalance),
      kind: safeText(row.kind),
    };
  });
}

function toBreakEven(points: unknown): BreakEvenPoint[] {
  if (!Array.isArray(points)) return [];
  return points.slice(0, 24).map((point) => {
    const row = point as Partial<BreakEvenPoint>;
    return {
      label: safeText(row.label),
      revenue: safeNum(row.revenue),
      expenses: safeNum(row.expenses),
    };
  });
}

function toScenarioComparison(points: unknown): ScenarioComparisonPoint[] {
  if (!Array.isArray(points)) return [];
  return points.slice(0, 24).map((point) => {
    const row = point as Partial<ScenarioComparisonPoint>;
    return {
      label: safeText(row.label),
      conservative: safeNum(row.conservative),
      expected: safeNum(row.expected),
      aggressive: safeNum(row.aggressive),
    };
  });
}

function toTimeline(points: unknown): TimelineLine[] {
  if (!Array.isArray(points)) return [];
  return points.slice(0, 18).map((point) => {
    const row = point as Partial<TimelineLine>;
    return {
      month: safeText(row.month),
      revenue: safeNum(row.revenue),
      totalExpenses: safeNum(row.totalExpenses),
      netProfit: safeNum(row.netProfit),
      cashBalance: safeNum(row.cashBalance),
    };
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Partial<DashboardPdfPayload>;
    if (!body.summary || !body.assumptions || !body.scenarioSummary || !Array.isArray(body.timeline) || !body.charts) {
      return NextResponse.json(
        { error: "summary, assumptions, scenarioSummary, timeline and charts are required" },
        { status: 400 }
      );
    }

    const summary = body.summary;
    const assumptions = body.assumptions;
    const scenarios = body.scenarioSummary;
    const timeline = toTimeline(body.timeline);
    const charts = body.charts;
    const generatedAt = body.generatedAt ? new Date(body.generatedAt) : new Date();

    const revenueTrend = toRevenueTrend(charts.revenueTrend);
    const profitability = toProfitability(charts.profitability);
    const expenseBreakdown = toExpenseBreakdown(charts.expenseBreakdown);
    const cashflow = toCashflow(charts.cashflow);
    const cashBalance = toCashBalance(charts.cashBalance);
    const breakEven = toBreakEven(charts.breakEven);
    const scenarioComparison = toScenarioComparison(charts.scenarioComparison);

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 32,
      info: {
        Title: "Financial Projections Dashboard",
        Author: "Atom Ledger",
        Subject: "Financial Projections Export",
        Creator: "Atom Ledger",
      },
    });

    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));

    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#0f172a")
      .text("Financial Projections Dashboard");
    doc
      .moveDown(0.2)
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor("#64748b")
      .text(`Generated: ${generatedAt.toLocaleString("en-NG")} | Includes all chart datasets and projection assumptions`);

    sectionTitle(doc, "Executive Summary");
    line(doc, "Projected Revenue (12M)", formatNaira(summary.projectedRevenueAnnual));
    line(doc, "Projected Revenue (6M)", formatNaira(summary.projectedRevenueSixMonth));
    line(doc, "Projected Net Profit (6M)", formatNaira(summary.projectedNetProfitSixMonth));
    line(doc, "Projected Gross Margin", formatPercent(summary.projectedGrossMargin));
    line(doc, "Burn Rate", summary.burnRate > 0 ? formatNaira(summary.burnRate) : "No burn");
    line(doc, "Projected Cash Balance", formatNaira(summary.projectedCashBalance));
    line(doc, "Current Cash Balance", formatNaira(summary.closingCashBalance));
    line(
      doc,
      "Runway",
      summary.runwayMonths === null ? "> forecast horizon" : `${safeNum(summary.runwayMonths).toFixed(1)} months`
    );
    line(doc, "Break-even Month", summary.breakEvenMonth || "Not reached");
    line(doc, "Break-even Revenue", summary.breakEvenRevenue > 0 ? formatNaira(summary.breakEvenRevenue) : "N/A");

    sectionTitle(doc, "Model Assumptions");
    line(doc, "Revenue Growth Rate", formatPercent(assumptions.revenueGrowthRate));
    line(doc, "Operating Expense Growth", formatPercent(assumptions.operatingExpenseGrowthRate));
    line(doc, "Fixed Cost Inflation", formatPercent(assumptions.fixedCostInflationRate));
    line(doc, "COGS Ratio", formatPercent(assumptions.cogsRatio));
    line(doc, "Variable Cost Ratio", formatPercent(assumptions.variableCostRatio));
    line(doc, "Marketing Spend Ratio", formatPercent(assumptions.marketingSpendRatio));
    line(doc, "Cash Collection Ratio", safeNum(assumptions.cashCollectionRatio).toFixed(3));
    line(doc, "Cash Disbursement Ratio", safeNum(assumptions.cashDisbursementRatio).toFixed(3));
    line(doc, "Fixed Cost Baseline", formatNaira(assumptions.fixedCostBaseline));

    sectionTitle(doc, "Scenario Snapshot");
    scenarioRow(doc, "Conservative", scenarios.conservative);
    scenarioRow(doc, "Expected", scenarios.expected);
    scenarioRow(doc, "Aggressive", scenarios.aggressive);

    sectionTitle(doc, "Projection Data Table (Latest 12 Months)");
    for (const row of timeline.slice(0, 12)) {
      line(
        doc,
        row.month,
        `Revenue ${formatNaira(row.revenue)} | Expenses ${formatNaira(row.totalExpenses)} | Net ${formatNaira(
          row.netProfit
        )} | Cash ${formatNaira(row.cashBalance)}`
      );
    }

    // Charts pack
    doc.addPage();
    drawLineChart(doc, {
      title: "Revenue Projection (Actual + Projected)",
      subtitle: "Monthly revenue trend",
      labels: revenueTrend.map((point) => point.label),
      series: [{ label: "Revenue", color: "#2264ff", values: revenueTrend.map((point) => point.revenue) }],
    });

    drawLineChart(doc, {
      title: "Profitability",
      subtitle: "Gross Profit, Net Profit, and EBITDA",
      labels: profitability.map((point) => point.label),
      series: [
        { label: "Gross Profit", color: "#6366f1", values: profitability.map((point) => point.grossProfit) },
        { label: "Net Profit", color: "#10b981", values: profitability.map((point) => point.netProfit) },
        { label: "EBITDA", color: "#06b6d4", values: profitability.map((point) => point.ebitda) },
      ],
    });

    drawGroupedBarChart(doc, {
      title: "Expense Breakdown",
      subtitle: "COGS, Fixed, Variable, Marketing",
      labels: expenseBreakdown.map((point) => point.label),
      series: [
        { label: "COGS", color: "#f59e0b", values: expenseBreakdown.map((point) => point.cogs) },
        { label: "Fixed", color: "#64748b", values: expenseBreakdown.map((point) => point.fixedCosts) },
        { label: "Variable", color: "#ef4444", values: expenseBreakdown.map((point) => point.variableCosts) },
        { label: "Marketing", color: "#8b5cf6", values: expenseBreakdown.map((point) => point.marketingCosts) },
      ],
    });

    drawGroupedBarChart(doc, {
      title: "Cash Inflow vs Outflow",
      subtitle: "Monthly cash movement",
      labels: cashflow.map((point) => point.label),
      series: [
        { label: "Inflow", color: "#10b981", values: cashflow.map((point) => point.cashInflow) },
        { label: "Outflow", color: "#ef4444", values: cashflow.map((point) => point.cashOutflow) },
        { label: "Net", color: "#2264ff", values: cashflow.map((point) => point.netCashflow) },
      ],
    });

    doc.addPage();
    drawLineChart(doc, {
      title: "Cash Balance Projection",
      subtitle: "Projected cash balance trajectory",
      labels: cashBalance.map((point) => point.label),
      series: [{ label: "Cash Balance", color: "#0ea5e9", values: cashBalance.map((point) => point.cashBalance) }],
      includeZero: false,
    });

    drawLineChart(doc, {
      title: "Break-even Analysis",
      subtitle: "Revenue vs Total Expenses",
      labels: breakEven.map((point) => point.label),
      series: [
        { label: "Revenue", color: "#2264ff", values: breakEven.map((point) => point.revenue) },
        { label: "Expenses", color: "#ef4444", values: breakEven.map((point) => point.expenses) },
      ],
    });

    drawLineChart(doc, {
      title: "Scenario Comparison (Net Profit)",
      subtitle: "Conservative vs Expected vs Aggressive",
      labels: scenarioComparison.map((point) => point.label),
      series: [
        { label: "Conservative", color: "#f43f5e", values: scenarioComparison.map((point) => point.conservative) },
        { label: "Expected", color: "#2264ff", values: scenarioComparison.map((point) => point.expected) },
        { label: "Aggressive", color: "#10b981", values: scenarioComparison.map((point) => point.aggressive) },
      ],
    });

    doc.end();
    await new Promise<void>((resolve) => doc.on("end", resolve));

    const pdfBuffer = Buffer.concat(chunks);
    const filename = `financial-projections-full-${generatedAt.toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[Projection Dashboard PDF] Failed to generate PDF:", error);
    return NextResponse.json({ error: "Unable to generate projections PDF" }, { status: 500 });
  }
}
