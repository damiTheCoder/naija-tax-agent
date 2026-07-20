"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { RawTransaction, StatementDraft } from "@/lib/accounting/types";
import { accountingEngine } from "@/lib/accounting/transactionBridge";

// Types
type KpiMetric = {
  label: string;
  value: string;
  hint: string;
  accent: string;
};

type ChartData = {
  label: string;
  value: number;
  color: string;
};

const icons = {
  arrowRight: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" />
    </svg>
  ),
};

// Color palette for charts
const CHART_COLORS = ["#8fff00", "#818cf8", "#34d399", "#f472b6", "#fbbf24", "#94a3b8"];
const MOBILE_PROJECTIONS_ENTRY_STORAGE_KEY = "ql::mobile-projections-entry";
const MOBILE_PROJECTIONS_ENTRY_EVENT = "ql:mobile-projections-entry-change";

function formatCompactNaira(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(safe);
  const sign = safe < 0 ? "-" : "";

  const formatWithSuffix = (divisor: number, suffix: "K" | "M" | "B") => {
    const compact = (abs / divisor).toFixed(abs / divisor >= 100 ? 0 : 1).replace(/\.0$/, "");
    return `${sign}₦${compact}${suffix}`;
  };

  if (abs >= 1_000_000_000) return formatWithSuffix(1_000_000_000, "B");
  if (abs >= 1_000_000) return formatWithSuffix(1_000_000, "M");
  if (abs >= 1_000) return formatWithSuffix(1_000, "K");
  return `${sign}₦${abs.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

// Pie Chart Component
function PieChart({ data, size }: { data: ChartData[]; size?: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dynamicSize, setDynamicSize] = useState(size || 200);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const baseSize = size || 200;
        if (clientWidth > 0 && clientHeight > 0) {
          setDynamicSize(Math.max(baseSize, Math.min(clientWidth, clientHeight) - 20));
        } else {
          setDynamicSize(baseSize);
        }
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [size]);

  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    return (
      <div ref={containerRef} className="flex items-center justify-center w-full h-full">
        <div className="text-center text-gray-400">
          <p className="text-sm">No data</p>
        </div>
      </div>
    );
  }

  const radius = dynamicSize / 2;
  const innerRadius = dynamicSize / 3.5;
  const createArcPath = (startAngle: number, endAngle: number) => {
    const start = {
      x: radius + radius * Math.cos((startAngle * Math.PI) / 180),
      y: radius + radius * Math.sin((startAngle * Math.PI) / 180),
    };
    const end = {
      x: radius + radius * Math.cos((endAngle * Math.PI) / 180),
      y: radius + radius * Math.sin((endAngle * Math.PI) / 180),
    };
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${radius} ${radius} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
  };

  const segments = data.reduce(
    (acc, item, index) => {
      const angle = (item.value / total) * 360;
      const startAngle = acc.currentAngle;
      const endAngle = startAngle + angle;
      return {
        currentAngle: endAngle,
        segments: [
          ...acc.segments,
          {
            key: index,
            path: createArcPath(startAngle - 90, endAngle - 90),
            color: item.color,
          },
        ],
      };
    },
    { currentAngle: 0, segments: [] as Array<{ key: number; path: string; color: string }> }
  ).segments;

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center">
      <svg width={dynamicSize} height={dynamicSize} viewBox={`0 0 ${dynamicSize} ${dynamicSize}`} className="max-w-full max-h-full" style={{ border: '1px solid #000', borderRadius: '50%' }}>
        {segments.map((segment) => (
          <path
            key={segment.key}
            d={segment.path}
            fill={segment.color}
            stroke="#000"
            strokeWidth="1"
            className="transition-all duration-300 hover:opacity-80"
          />
        ))}
        <circle cx={radius} cy={radius} r={innerRadius} fill="white" />
      </svg>
    </div>
  );
}

// Bar Chart Component
function BarChart({ data }: { data: { month: string; value: number }[] }) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [chartHeight, setChartHeight] = useState(220);

  useEffect(() => {
    const measure = () => {
      if (chartRef.current) {
        setChartHeight(chartRef.current.clientHeight || 220);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  if (data.every(d => d.value === 0)) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="text-center text-gray-400">
          <p className="text-sm">No transaction data yet</p>
          <p className="text-xs mt-1">Add transactions in the Accounting Studio</p>
        </div>
      </div>
    );
  }

  const barColors = ["#8fff00", "#1f7a1f", "#2563eb", "#4b5563", "#8fff00", "#1f7a1f"];

  return (
    <div ref={chartRef} className="w-full h-full">
      <div className="flex items-end gap-0 w-full h-full">
        {data.map((item, index) => {
          const barHeight = maxValue > 0 ? (item.value / maxValue) * (chartHeight - 50) : 0;
          const isSelected = selectedIndex === index;
          const barColor = barColors[index % barColors.length];
          return (
            <div
              key={index}
              className="flex flex-col items-center flex-1 cursor-pointer"
              onClick={() => setSelectedIndex(isSelected ? null : index)}
            >
              {isSelected && (
                <div className="mb-1 rounded-lg bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white whitespace-nowrap shadow-lg">
                  {formatCompactNaira(item.value)}
                </div>
              )}
              <div
                className="w-full rounded-t-md transition-all duration-300"
                style={{
                  height: Math.max(barHeight, 8),
                  backgroundColor: barColor,
                  border: '1px solid #000',
                  minWidth: "24px",
                }}
              ></div>
              <span className="text-[11px] text-gray-500 font-medium whitespace-nowrap">{item.month}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiCard({ metric }: { metric: KpiMetric }) {
  const accentMap: Record<string, { text: string; border: string; pill: string }> = {
    "text-blue-600": { text: "text-blue-600", border: "border-blue-100", pill: "bg-blue-100" },
    "text-rose-600": { text: "text-rose-600", border: "border-rose-100", pill: "bg-rose-100" },
    "text-emerald-600": { text: "text-emerald-600", border: "border-emerald-100", pill: "bg-emerald-100" },
    "text-indigo-600": { text: "text-indigo-600", border: "border-indigo-100", pill: "bg-indigo-100" },
  };

  const colors = accentMap[metric.accent] || accentMap["text-blue-600"];

  return (
    <div className={`min-w-0 rounded-2xl border ${colors.border} p-3.5 sm:p-5 transition-shadow hover:shadow-sm`}>
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-2 w-2 rounded-full ${colors.pill} ${colors.text}`}></span>
        <p className={`text-[10px] font-semibold uppercase tracking-wide sm:text-xs ${colors.text}`}>{metric.label}</p>
      </div>
      <p className={`mt-2 text-base font-semibold leading-tight break-words sm:mt-3 sm:text-xl ${colors.text}`}>{metric.value}</p>
      <p className="mt-1.5 text-[11px] leading-snug text-gray-500 sm:mt-2 sm:text-xs">{metric.hint}</p>
    </div>
  );
}

// Empty State Component
function EmptyState() {
  return (
    <div className="p-12 text-center" style={{ backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid transparent' }}>
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">No transactions yet</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
        Start by adding transactions in the Accounting Studio. Your dashboard will automatically update with real data.
      </p>
      <Link
        href="/accounting"
        className="inline-flex items-center gap-2 bg-[#8fff00] text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#6fcc00] transition-colors"
      >
        Go to Accounting Studio
        {icons.arrowRight}
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const [isLoaded] = useState(true);
  const [transactions, setTransactions] = useState<RawTransaction[]>([]);
  const [engineStatements, setEngineStatements] = useState<StatementDraft | null>(null);
  const [journalCount, setJournalCount] = useState(0);
  const [showMobileProjectionToggle, setShowMobileProjectionToggle] = useState(false);

  // Helper to derive transactions from journal entries based on account codes
  const deriveTransactionsFromJournals = (journalEntries: {
    id: string;
    date: string;
    narration: string;
    lines: { accountCode: string; accountName: string; debit: number; credit: number }[]
  }[]): RawTransaction[] => {
    return journalEntries.map((entry) => {
      const narration = entry.narration.toLowerCase();

      // Find the main economic account (not cash/bank which are just the other side)
      const economicLine = entry.lines.find(line => {
        const code = line.accountCode;
        // Look for income (4xxx), expense (5xxx, 6xxx, 7xxx), or asset purchase (15xx)
        return code.startsWith("4") || code.startsWith("5") || code.startsWith("6") || code.startsWith("7") ||
          (code.startsWith("15") && !code.includes("1"));
      });

      // Also check for liability accounts being debited (indicates payment of expense)
      const liabilityPayment = entry.lines.find(line => {
        const code = line.accountCode;
        // Liability accounts (2xxx) being debited = paying off an expense liability
        return code.startsWith("2") && line.debit > 0;
      });

      const code = economicLine?.accountCode || liabilityPayment?.accountCode || "";
      let type: "income" | "expense" = "expense";
      let category = "other";
      let amount = 0;

      // Determine type and category based on account code
      if (code.startsWith("4")) {
        // 4xxx = Income/Revenue accounts
        type = "income";
        amount = economicLine!.credit || economicLine!.debit;
        if (code === "4000") category = "sales";
        else if (code === "4100") category = "sales-returns";
        else if (code === "4200" || code === "4010") category = "service-income";
        else if (code === "4300") category = "interest-income";
        else category = "revenue";
      } else if (code.startsWith("5") || code.startsWith("6") || code.startsWith("7")) {
        // 5xxx, 6xxx, 7xxx = All Expense accounts (COS, Operating, Admin, Finance, Tax)
        type = "expense";
        amount = economicLine!.debit || economicLine!.credit;

        // Categorize by account code range
        if (code.startsWith("50")) category = "cost-of-sales";
        else if (code.startsWith("51") || code.startsWith("52")) category = "purchases";
        else if (code.startsWith("55")) category = "salaries";
        else if (code.startsWith("56")) category = "rent";
        else if (code.startsWith("57")) category = "depreciation";
        else if (code.startsWith("58")) category = "office-expenses";
        else if (code.startsWith("59")) category = "professional-fees";
        else if (code.startsWith("60")) category = "marketing";
        else if (code.startsWith("65")) category = "interest-expense";
        else category = "operating-expenses";
      } else if (code.startsWith("15")) {
        // 15xx = Fixed Assets
        type = "expense";
        amount = economicLine!.debit || economicLine!.credit;
        category = "asset-purchase";
      } else if (code.startsWith("2") && liabilityPayment) {
        // 2xxx = Liability account being debited = paying off an expense
        type = "expense";
        amount = liabilityPayment.debit;
        // Try to categorize from narration
        if (narration.includes("rent")) category = "rent";
        else if (narration.includes("salary") || narration.includes("payroll")) category = "salaries";
        else if (narration.includes("utility") || narration.includes("utilities")) category = "utilities";
        else if (narration.includes("insurance")) category = "insurance";
        else category = "operating-expenses";
      } else {
        // Fallback: use narration to determine type and category
        if (narration.includes("sale") || narration.includes("revenue") || narration.includes("income") || narration.includes("sold") || narration.includes("received")) {
          type = "income";
          category = "sales";
        } else if (narration.includes("paid") || narration.includes("expense") || narration.includes("cost") || narration.includes("payment")) {
          type = "expense";
          if (narration.includes("rent")) category = "rent";
          else if (narration.includes("salary") || narration.includes("payroll")) category = "salaries";
          else if (narration.includes("purchase")) category = "purchases";
          else if (narration.includes("utility") || narration.includes("utilities")) category = "utilities";
          else category = "operating-expenses";
        } else if (narration.includes("purchase")) {
          type = "expense";
          category = "purchases";
        }
        // Get the largest amount from lines
        amount = Math.max(...entry.lines.map(l => Math.max(l.debit, l.credit)));
      }

      return {
        id: entry.id,
        date: entry.date,
        description: entry.narration,
        category,
        amount: type === "income" ? amount : -amount,
        type,
      };
    });
  };

  // Load transactions from localStorage and subscribe to accounting engine
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hydrateFromEngine = () => {
      accountingEngine.load();
      const state = accountingEngine.getState();
      setEngineStatements(accountingEngine.generateStatements());
      setJournalCount(state.journalEntries.length);

      if (state.journalEntries.length > 0) {
        const derived = deriveTransactionsFromJournals(state.journalEntries);
        setTransactions(derived);
        return;
      }

      const savedTransactions = window.localStorage.getItem("insight::accounting-transactions");
      if (!savedTransactions) return;
      try {
        const parsed = JSON.parse(savedTransactions) as unknown;
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTransactions(parsed as RawTransaction[]);
        }
      } catch {
        // ignore malformed cache
      }
    };

    const initFrame = window.requestAnimationFrame(hydrateFromEngine);

    const unsubscribe = accountingEngine.subscribe((newState) => {
      setEngineStatements(accountingEngine.generateStatements());
      setJournalCount(newState.journalEntries.length);
      const derived = deriveTransactionsFromJournals(newState.journalEntries);
      setTransactions(derived);
    });

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "insight::accounting-engine" && e.newValue) {
        hydrateFromEngine();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.cancelAnimationFrame(initFrame);
      unsubscribe();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncProjectionToggle = () => {
      try {
        setShowMobileProjectionToggle(window.localStorage.getItem(MOBILE_PROJECTIONS_ENTRY_STORAGE_KEY) === "1");
      } catch {
        setShowMobileProjectionToggle(false);
      }
    };

    const handleProjectionToggleEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ enabled?: boolean }>;
      if (typeof customEvent.detail?.enabled === "boolean") {
        setShowMobileProjectionToggle(customEvent.detail.enabled);
        return;
      }
      syncProjectionToggle();
    };

    syncProjectionToggle();
    window.addEventListener(MOBILE_PROJECTIONS_ENTRY_EVENT, handleProjectionToggleEvent as EventListener);
    window.addEventListener("storage", syncProjectionToggle);

    return () => {
      window.removeEventListener(MOBILE_PROJECTIONS_ENTRY_EVENT, handleProjectionToggleEvent as EventListener);
      window.removeEventListener("storage", syncProjectionToggle);
    };
  }, []);

  // Calculate metrics from transactions (prefer engine statements if available)
  const calculatedData = useMemo(() => {
    // Use engine statements for accurate double-entry figures
    let totalRevenue: number;
    let totalExpenses: number;
    let netProfit: number;

    if (engineStatements && journalCount > 0) {
      totalRevenue = engineStatements.revenue;
      totalExpenses = engineStatements.costOfSales + engineStatements.operatingExpenses;
      netProfit = engineStatements.netIncome;
    } else {
      // Fallback to simple transaction calculation
      totalRevenue = transactions
        .filter(tx => tx.type === "income" || tx.amount > 0)
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

      totalExpenses = transactions
        .filter(tx => tx.type === "expense" || tx.amount < 0)
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

      netProfit = totalRevenue - totalExpenses;
    }

    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const avgTransaction = transactions.length > 0 ? (totalRevenue + totalExpenses) / transactions.length : 0;

    // Group expenses by category
    const expensesByCategory: Record<string, number> = {};
    transactions
      .filter(tx => tx.type === "expense" || tx.amount < 0)
      .forEach(tx => {
        const category = tx.category || "Other";
        expensesByCategory[category] = (expensesByCategory[category] || 0) + Math.abs(tx.amount);
      });

    const expenseCategories: ChartData[] = Object.entries(expensesByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value], index) => ({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        value: totalExpenses > 0 ? Math.round((value / totalExpenses) * 100) : 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));

    // Group income by category
    const incomeByCategory: Record<string, number> = {};
    transactions
      .filter(tx => tx.type === "income" || tx.amount > 0)
      .forEach(tx => {
        const category = tx.category || "Other";
        incomeByCategory[category] = (incomeByCategory[category] || 0) + Math.abs(tx.amount);
      });

    const incomeStreams: ChartData[] = Object.entries(incomeByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, value], index) => ({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        value: totalRevenue > 0 ? Math.round((value / totalRevenue) * 100) : 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));

    // Monthly revenue data (last 12 months)
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyRevenue = months.map((month, index) => {
      const monthTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate.getMonth() === index && (tx.type === "income" || tx.amount > 0);
      });
      return {
        month,
        value: monthTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
      };
    });

    // Recent transactions (last 5)
    const recentTransactions = [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map(tx => ({
        id: tx.id,
        description: tx.description,
        amount: tx.amount,
        type: tx.type === "income" || tx.amount > 0 ? "income" : "expense",
        date: new Date(tx.date).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" }),
      }));

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      avgTransaction,
      transactionCount: transactions.length,
      journalEntryCount: journalCount,
      expenseCategories,
      incomeStreams,
      monthlyRevenue,
      recentTransactions,
      hasEngineData: journalCount > 0,
      assets: engineStatements?.assets || 0,
      liabilities: engineStatements?.liabilities || 0,
      equity: engineStatements?.equity || 0,
    };
  }, [transactions, engineStatements, journalCount]);

  // Format currency as compact K/M/B
  const formatCurrency = (amount: number): string => {
    return formatCompactNaira(amount);
  };

  const metrics: KpiMetric[] = useMemo(
    () => [
      {
        label: "Total Revenue",
        value: formatCurrency(calculatedData.totalRevenue),
        hint: transactions.length > 0 ? `${calculatedData.transactionCount} analyzed entries` : "No data yet",
        accent: "text-blue-600",
      },
      {
        label: "Total Expenses",
        value: formatCurrency(calculatedData.totalExpenses),
        hint: calculatedData.totalExpenses > 0 ? "Current operating + cost profile" : "No expense profile yet",
        accent: "text-rose-600",
      },
      {
        label: "Net Profit",
        value: formatCurrency(calculatedData.netProfit),
        hint: calculatedData.profitMargin > 0 ? `${calculatedData.profitMargin.toFixed(1)}% margin` : "Margin not positive yet",
        accent: calculatedData.netProfit >= 0 ? "text-emerald-600" : "text-rose-600",
      },
      {
        label: "Journal Activity",
        value: calculatedData.transactionCount.toLocaleString(),
        hint: calculatedData.avgTransaction > 0 ? `Average ${formatCurrency(calculatedData.avgTransaction)} per entry` : "No average yet",
        accent: "text-indigo-600",
      },
    ],
    [calculatedData, transactions.length]
  );

  if (!isLoaded) {
    return null;
  }

  return (
    <div className={`p-3 space-y-5 transition-opacity duration-500 ${isLoaded ? "opacity-100" : "opacity-0"}`}>
      {showMobileProjectionToggle ? (
        <div className="lg:hidden">
          <div className="inline-flex rounded-full border border-gray-200 bg-white p-1">
            <button
              type="button"
              className="rounded-full bg-[#8fff00] px-3 py-1.5 text-xs font-semibold text-white"
              aria-label="Accounting dashboard view"
            >
              Accounting Dashboard
            </button>
            <Link
              href="/accounting/projections"
              className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
              aria-label="Switch to financial projections"
            >
              Financial Projections
            </Link>
          </div>
        </div>
      ) : null}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Accounting Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Decision-focused performance view from your posted accounting records.</p>
      </div>

      {transactions.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {metrics.map((metric, index) => (
              <KpiCard key={index} metric={metric} />
            ))}
          </div>

           {/* Charts Row */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {/* Revenue Bar Chart */}
             <div className="p-5 sm:p-6 flex flex-col" style={{ backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid transparent' }}>
               <div className="flex items-center justify-between mb-6">
                 <div>
                   <h3 className="text-base font-semibold text-gray-900">Monthly Revenue</h3>
                   <p className="text-sm text-gray-500">Revenue trend by month</p>
                 </div>
               </div>
               <div className="flex-1 min-h-0">
                 <BarChart data={calculatedData.monthlyRevenue} />
               </div>
             </div>

             {/* Expense Pie Chart */}
             <div className="p-5 sm:p-6 flex flex-col" style={{ backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid transparent' }}>
               <div className="mb-6">
                 <h3 className="text-base font-semibold text-gray-900">Expense Breakdown</h3>
                 <p className="text-sm text-gray-500">Where your money goes</p>
               </div>
               <div className="flex flex-col items-center gap-4 flex-1 min-h-0">
                 <div className="flex-1 min-h-0 flex items-center justify-center w-full">
                   <PieChart data={calculatedData.expenseCategories} />
                 </div>
                 {calculatedData.expenseCategories.length > 0 && (
                   <div className="grid grid-cols-2 gap-3 w-full mt-2">
                     {calculatedData.expenseCategories.map((item, index) => (
                       <div key={index} className="flex items-center gap-2">
                         <span className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-offset-1" style={{ backgroundColor: item.color, boxShadow: `0 0 0 1px ${item.color}40` }}></span>
                         <span className="text-xs text-gray-600 truncate">{item.label}</span>
                         <span className="text-xs font-bold text-gray-900 ml-auto">{item.value}%</span>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             </div>
           </div>

          {/* Second Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Income Streams */}
            <div className="p-5 sm:p-6 flex flex-col" style={{ backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid transparent' }}>
              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-900">Income Streams</h3>
                <p className="text-sm text-gray-500">Revenue by category</p>
              </div>
              {calculatedData.incomeStreams.length > 0 ? (
                <div className="flex items-center gap-6 flex-1 min-h-0">
                  <div className="relative flex-shrink-0">
                    <PieChart data={calculatedData.incomeStreams} size={140} />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <p className="text-lg font-bold text-gray-900">{calculatedData.incomeStreams.length}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Streams</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 flex-1 min-w-0">
                    {calculatedData.incomeStreams.map((item, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <span className="w-4 h-4 rounded-lg flex-shrink-0 shadow-sm" style={{ backgroundColor: item.color }}></span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 truncate">{item.label}</span>
                            <span className="text-sm font-bold text-gray-900">{item.value}%</span>
                          </div>
                          <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${item.value}%`, backgroundColor: item.color }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">No income data yet</p>
                </div>
              )}
            </div>

            {/* Recent Transactions */}
            <div className="p-5 sm:p-6" style={{ backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid transparent' }}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Recent Transactions</h3>
                  <p className="text-sm text-gray-500">Latest financial activity</p>
                </div>
                <Link href="/accounting" className="text-xs font-semibold text-gray-600 hover:text-gray-900">
                  View All
                </Link>
              </div>
              <div className="space-y-3">
                {calculatedData.recentTransactions.length > 0 ? (
                  calculatedData.recentTransactions.map((tx) => {
                    const txColor = tx.type === "income" ? CHART_COLORS[0] : CHART_COLORS[1];
                    return (
                      <div key={tx.id} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${txColor}20` }}
                        >
                          {tx.type === "income" ? (
                            <svg className="w-5 h-5" style={{ color: txColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" style={{ color: txColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{tx.description}</p>
                          <p className="text-xs text-gray-500">{tx.date}</p>
                        </div>
                        <span
                          className="text-sm font-bold flex-shrink-0 whitespace-nowrap"
                          style={{ color: txColor }}
                        >
                          {tx.type === "income" ? "+" : "-"}{formatCurrency(Math.abs(tx.amount))}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm">No transactions yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              {
                label: "Profit Margin",
                value: calculatedData.profitMargin > 0 ? `${calculatedData.profitMargin.toFixed(1)}%` : "—",
                sublabel: calculatedData.netProfit > 0 ? "Profitable" : "No profit yet",
                color: "violet"
              },
              {
                label: "Avg. Transaction",
                value: formatCurrency(calculatedData.avgTransaction),
                sublabel: `${calculatedData.transactionCount} total`,
                color: "amber"
              },
              {
                label: "Income Entries",
                value: transactions.filter(tx => tx.type === "income" || tx.amount > 0).length.toString(),
                sublabel: "Revenue transactions",
                color: "emerald"
              },
              {
                label: "Expense Entries",
                value: transactions.filter(tx => tx.type === "expense" || tx.amount < 0).length.toString(),
                sublabel: "Cost transactions",
                color: "rose"
              },
            ].map((stat, index) => {
              const colorMap: Record<string, { bg: string; border: string; text: string; dot: string }> = {
                violet: { bg: "bg-violet-50", border: "border-violet-100", text: "text-violet-600", dot: "bg-violet-400" },
                amber: { bg: "bg-amber-50", border: "border-amber-100", text: "text-amber-600", dot: "bg-amber-400" },
                emerald: { bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-600", dot: "bg-emerald-400" },
                rose: { bg: "bg-rose-50", border: "border-rose-100", text: "text-rose-600", dot: "bg-rose-400" },
              };
              const c = colorMap[stat.color];
              return (
                <div key={index} className={`${c.bg} rounded-2xl border ${c.border} p-5 transition-shadow hover:shadow-sm`}>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex h-2 w-2 rounded-full ${c.dot}`}></span>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{stat.label}</p>
                  </div>
                  <p className={`mt-3 text-lg sm:text-xl font-semibold ${c.text}`}>{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-2">{stat.sublabel}</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
