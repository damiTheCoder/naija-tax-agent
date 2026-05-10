"use client";

import { useRef, useState } from "react";

type ProjectionKind = "actual" | "projected";

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

type ProjectionPoint = {
  key: string;
  label: string;
  revenue: number;
  cogs: number;
  fixedCosts: number;
  variableCosts: number;
  marketingCosts: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  ebitda: number;
  grossMarginPct: number;
  netMarginPct: number;
  cashInflow: number;
  cashOutflow: number;
  netCashflow: number;
  cashBalance: number;
  kind: ProjectionKind;
};

type RevenueChartPoint = {
  label: string;
  revenue: number;
  kind: ProjectionKind;
};

type ProfitabilityChartPoint = {
  label: string;
  grossProfit: number;
  netProfit: number;
  ebitda: number;
  kind: ProjectionKind;
};

type CashBalanceChartPoint = {
  label: string;
  cashBalance: number;
  kind: ProjectionKind;
};

type ScenarioComparisonPoint = {
  label: string;
  conservative: number;
  expected: number;
  aggressive: number;
};

type BreakEvenChartPoint = {
  label: string;
  revenue: number;
  expenses: number;
};

type ProjectionAssumptionKey =
  | "revenueGrowthRate"
  | "operatingExpenseGrowthRate"
  | "fixedCostInflationRate"
  | "cogsRatio"
  | "variableCostRatio"
  | "marketingSpendRatio"
  | "cashCollectionRatio"
  | "cashDisbursementRatio"
  | "fixedCostBaseline";

type ProjectionAssumptions = {
  revenueGrowthRate: number;
  operatingExpenseGrowthRate: number;
  fixedCostInflationRate: number;
  cogsRatio: number;
  variableCostRatio: number;
  marketingSpendRatio: number;
  cashCollectionRatio: number;
  cashDisbursementRatio: number;
  fixedCostBaseline: number;
  customerGrowthProxy: number;
  pricingPerRevenueEntry: number;
  salesConversionRateProxy: number;
};

type ProjectionsDashboardProps = {
  projectedRevenueAnnual: number;
  projectedRevenueSixMonth: number;
  projectedNetProfitSixMonth: number;
  projectedGrossMargin: number;
  burnRate: number;
  hasCashDeficit: boolean;
  projectedCashBalance: number;
  closingCashBalance: number;
  runwayMonths: number | null;
  breakEvenMonthLabel: string | null;
  breakEvenRevenue: number | null;
  projectionValidationIssues: string[];
  projectionStatus: string;
  actualSeriesLength: number;
  revenueData: RevenueChartPoint[];
  revenueStreams: RevenueBreakdown[];
  expenseStackData: ProjectionPoint[];
  fixedExpenseTotal: number;
  variableExpenseTotal: number;
  expenseCategories: ExpenseBreakdown[];
  profitabilityData: ProfitabilityChartPoint[];
  projectedEbitdaSixMonth: number;
  cashflowWindow: ProjectionPoint[];
  cashBalanceData: CashBalanceChartPoint[];
  breakEvenChartData: BreakEvenChartPoint[];
  scenarioComparisonData: ScenarioComparisonPoint[];
  assumptions: ProjectionAssumptions;
  onResetAssumptions: () => void;
  onUpdateAssumptionPercent: (
    key: ProjectionAssumptionKey,
    percentValue: number,
    min: number,
    max: number,
  ) => void;
  onUpdateAssumptionNumber: (
    key: ProjectionAssumptionKey,
    rawValue: number,
    min: number,
    max: number,
  ) => void;
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

const average = (values: number[]): number => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
  data: Array<{ label: string; [key: string]: string | number }>;
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
    }),
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

  const polylinePoints = (key: string, start = 0, end = data.length - 1): string =>
    data
      .slice(start, end + 1)
      .map((point, index) => {
        const absolute = start + index;
        const raw = point[key];
        const value = typeof raw === "number" ? raw : 0;
        return `${xForIndex(absolute)},${yForValue(value)}`;
      })
      .join(" ");

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const relativeX = event.clientX - rect.left;
    const ratio = clamp(relativeX / rect.width, 0, 1);
    const index = Math.round(ratio * (data.length - 1));
    setHoveredIndex(index);
    setHoverPosition({ x: relativeX, y: event.clientY - rect.top });
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
        onMouseLeave={() => {
          setHoveredIndex(null);
          setHoverPosition(null);
        }}
      >
        {gridSteps.map((step) => {
          const y = paddingY + innerHeight * step;
          return <line key={step} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#e5e7eb" strokeWidth="1" />;
        })}

        {allowNegative ? (
          <line x1={paddingX} y1={yForValue(0)} x2={width - paddingX} y2={yForValue(0)} stroke="#cbd5e1" strokeWidth="1.5" />
        ) : null}

        {projectedStartX !== null ? (
          <>
            <rect x={projectedStartX} y={paddingY} width={width - paddingX - projectedStartX} height={innerHeight} fill="#f8fafc" />
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
        ) : null}

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

        {hoveredIndex !== null ? (
          <line
            x1={xForIndex(hoveredIndex)}
            y1={paddingY}
            x2={xForIndex(hoveredIndex)}
            y2={paddingY + innerHeight}
            stroke="#94a3b8"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ) : null}

        {hoveredIndex !== null
          ? series.map((item) => {
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
            })
          : null}

        {data.map((point, index) => (
          <text key={`${point.label}-${index}`} x={xForIndex(index)} y={height - 7} textAnchor="middle" fontSize="11" className="fill-gray-500">
            {point.label}
          </text>
        ))}
      </svg>

      {hoveredIndex !== null && hoverPosition ? (
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
      ) : null}
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
              <div className="h-full bg-gradient-to-r from-[#8fff00] to-[#6fcc00] rounded-full" style={{ width: `${width}%` }} />
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

  return (
    <div className="w-full overflow-x-auto relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[500px]"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (rect.width <= 0) return;
          const relativeX = event.clientX - rect.left;
          const ratio = clamp(relativeX / rect.width, 0, 1);
          const index = Math.round(ratio * (data.length - 1));
          setHoveredIndex(index);
          setHoverPosition({ x: relativeX, y: event.clientY - rect.top });
        }}
        onMouseLeave={() => {
          setHoveredIndex(null);
          setHoverPosition(null);
        }}
      >
        {data.map((point, index) => {
          const x = paddingX + (index + 0.5) * (innerWidth / data.length) - barWidth / 2;
          const totalHeight = (point.totalExpenses / maxValue) * innerHeight;
          const cogsHeight = point.totalExpenses === 0 ? 0 : (point.cogs / point.totalExpenses) * totalHeight;
          const fixedHeight = point.totalExpenses === 0 ? 0 : (point.fixedCosts / point.totalExpenses) * totalHeight;
          const variableHeight = point.totalExpenses === 0 ? 0 : (point.variableCosts / point.totalExpenses) * totalHeight;
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

      {hoveredIndex !== null && hoverPosition ? (
        <div
          className="pointer-events-none absolute z-20 max-w-[220px] rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-xs text-gray-700 shadow-sm"
          style={{ left: Math.max(8, hoverPosition.x + 12), top: Math.max(8, hoverPosition.y - 14) }}
        >
          <p className="font-semibold text-gray-900 mb-1">{data[hoveredIndex].label}</p>
          <p>COGS: {formatNaira(data[hoveredIndex].cogs)}</p>
          <p>Fixed: {formatNaira(data[hoveredIndex].fixedCosts)}</p>
          <p>Variable: {formatNaira(data[hoveredIndex].variableCosts)}</p>
        </div>
      ) : null}
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

  return (
    <div className="w-full overflow-x-auto relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[520px]"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (rect.width <= 0) return;
          const relativeX = event.clientX - rect.left;
          const ratio = clamp(relativeX / rect.width, 0, 1);
          const index = Math.round(ratio * (points.length - 1));
          setHoveredIndex(index);
          setHoverPosition({ x: relativeX, y: event.clientY - rect.top });
        }}
        onMouseLeave={() => {
          setHoveredIndex(null);
          setHoverPosition(null);
        }}
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

      {hoveredIndex !== null && hoverPosition ? (
        <div
          className="pointer-events-none absolute z-20 max-w-[220px] rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-xs text-gray-700 shadow-sm"
          style={{ left: Math.max(8, hoverPosition.x + 12), top: Math.max(8, hoverPosition.y - 14) }}
        >
          <p className="font-semibold text-gray-900 mb-1">{points[hoveredIndex].label}</p>
          <p>Inflow: {formatNaira(points[hoveredIndex].cashInflow)}</p>
          <p>Outflow: {formatNaira(points[hoveredIndex].cashOutflow)}</p>
          <p>Net: {formatNaira(points[hoveredIndex].netCashflow)}</p>
        </div>
      ) : null}
    </div>
  );
}

export default function ProjectionsDashboard({
  projectedRevenueAnnual,
  projectedRevenueSixMonth,
  projectedNetProfitSixMonth,
  projectedGrossMargin,
  burnRate,
  hasCashDeficit,
  projectedCashBalance,
  closingCashBalance,
  runwayMonths,
  breakEvenMonthLabel,
  breakEvenRevenue,
  projectionValidationIssues,
  projectionStatus,
  actualSeriesLength,
  revenueData,
  revenueStreams,
  expenseStackData,
  fixedExpenseTotal,
  variableExpenseTotal,
  expenseCategories,
  profitabilityData,
  projectedEbitdaSixMonth,
  cashflowWindow,
  cashBalanceData,
  breakEvenChartData,
  scenarioComparisonData,
  assumptions,
  onResetAssumptions,
  onUpdateAssumptionPercent,
  onUpdateAssumptionNumber,
}: ProjectionsDashboardProps) {
  const projectedStartIndex = Math.max(0, actualSeriesLength - 1);

  return (
    <>
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
          value={burnRate > 0 ? formatNaira(burnRate) : hasCashDeficit ? "Deficit" : "No Burn"}
          hint={hasCashDeficit ? "Cash is below zero. Restore liquidity while monitoring burn." : "Average monthly net cash burn"}
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
          value={breakEvenMonthLabel || "Not in 18M"}
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
          <p className="mt-1 text-xs text-amber-800">These flags indicate mathematically inconsistent or high-risk outputs based on current assumptions.</p>
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
            series={[{ key: "revenue", color: "#8fff00", label: "Revenue" }]}
            projectedStartIndex={projectedStartIndex}
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Revenue by Stream</h2>
          <RevenueStreamBars streams={revenueStreams} />
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
              <p className="font-semibold text-gray-900">{formatNaira(fixedExpenseTotal)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Variable</p>
              <p className="font-semibold text-gray-900">{formatNaira(variableExpenseTotal)}</p>
            </div>
          </div>
          <ExpenseCategoryList categories={expenseCategories} />
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
          projectedStartIndex={projectedStartIndex}
          allowNegative
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-sm">
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">Avg Gross Margin</p>
            <p className="font-semibold text-gray-900">{formatPercent(average(expenseStackData.slice(-6).map((point) => point.grossMarginPct)))}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">Avg Net Margin</p>
            <p className="font-semibold text-gray-900">{formatPercent(average(expenseStackData.slice(-6).map((point) => point.netMarginPct)))}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">Projected EBITDA (6M)</p>
            <p className="font-semibold text-gray-900">{formatNaira(projectedEbitdaSixMonth)}</p>
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
            projectedStartIndex={projectedStartIndex}
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
              { key: "revenue", color: "#8fff00", label: "Revenue" },
              { key: "expenses", color: "#ef4444", label: "Expenses" },
            ]}
            allowNegative={false}
            minWidth={560}
          />
          <div className="mt-4 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-600">
            {breakEvenMonthLabel
              ? `Net profit is projected to turn non-negative by ${breakEvenMonthLabel} (${formatNaira(breakEvenRevenue || 0)} revenue).`
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
              { key: "expected", color: "#8fff00", label: "Expected" },
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
          <button type="button" onClick={onResetAssumptions} className="print-hidden text-xs font-medium text-[#446b00] hover:underline">
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
              onChange={(event) => onUpdateAssumptionPercent("revenueGrowthRate", Number(event.target.value), -0.2, 0.6)}
              className="w-full bg-transparent text-gray-900 font-semibold outline-none"
            />
          </label>
          <label className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500 mb-1">Operating Expense Growth (%)</p>
            <input
              type="number"
              value={(assumptions.operatingExpenseGrowthRate * 100).toFixed(2)}
              onChange={(event) => onUpdateAssumptionPercent("operatingExpenseGrowthRate", Number(event.target.value), -0.1, 0.35)}
              className="w-full bg-transparent text-gray-900 font-semibold outline-none"
            />
          </label>
          <label className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500 mb-1">Fixed Cost Inflation (%)</p>
            <input
              type="number"
              value={(assumptions.fixedCostInflationRate * 100).toFixed(2)}
              onChange={(event) => onUpdateAssumptionPercent("fixedCostInflationRate", Number(event.target.value), 0, 0.15)}
              className="w-full bg-transparent text-gray-900 font-semibold outline-none"
            />
          </label>
          <label className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500 mb-1">COGS Ratio (%)</p>
            <input
              type="number"
              value={(assumptions.cogsRatio * 100).toFixed(2)}
              onChange={(event) => onUpdateAssumptionPercent("cogsRatio", Number(event.target.value), 0.01, 0.9)}
              className="w-full bg-transparent text-gray-900 font-semibold outline-none"
            />
          </label>
          <label className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500 mb-1">Variable Cost Ratio (%)</p>
            <input
              type="number"
              value={(assumptions.variableCostRatio * 100).toFixed(2)}
              onChange={(event) => onUpdateAssumptionPercent("variableCostRatio", Number(event.target.value), 0.01, 0.9)}
              className="w-full bg-transparent text-gray-900 font-semibold outline-none"
            />
          </label>
          <label className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500 mb-1">Marketing Spend (%)</p>
            <input
              type="number"
              value={(assumptions.marketingSpendRatio * 100).toFixed(2)}
              onChange={(event) => onUpdateAssumptionPercent("marketingSpendRatio", Number(event.target.value), 0, 0.5)}
              className="w-full bg-transparent text-gray-900 font-semibold outline-none"
            />
          </label>
          <label className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500 mb-1">Cash Collection Ratio</p>
            <input
              type="number"
              value={assumptions.cashCollectionRatio.toFixed(3)}
              onChange={(event) => onUpdateAssumptionNumber("cashCollectionRatio", Number(event.target.value), 0.4, 1.6)}
              className="w-full bg-transparent text-gray-900 font-semibold outline-none"
            />
          </label>
          <label className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500 mb-1">Cash Disbursement Ratio</p>
            <input
              type="number"
              value={assumptions.cashDisbursementRatio.toFixed(3)}
              onChange={(event) => onUpdateAssumptionNumber("cashDisbursementRatio", Number(event.target.value), 0.4, 1.7)}
              className="w-full bg-transparent text-gray-900 font-semibold outline-none"
            />
          </label>
          <label className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500 mb-1">Fixed Cost Baseline (NGN)</p>
            <input
              type="number"
              value={Math.round(assumptions.fixedCostBaseline)}
              onChange={(event) => onUpdateAssumptionNumber("fixedCostBaseline", Number(event.target.value), 0, 100000000000)}
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
    </>
  );
}
