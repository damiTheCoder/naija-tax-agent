"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { RawTransaction, StatementDraft } from "@/lib/accounting/types";
import { accountingEngine, AccountingState } from "@/lib/accounting/transactionBridge";

// Types
type MetricCard = {
  label: string;
  value: string;
  change: string;
  changeType: "positive" | "negative" | "neutral";
  icon: React.ReactNode;
};

type ChartData = {
  label: string;
  value: number;
  color: string;
};

// Icons
const icons = {
  revenue: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
    </svg>
  ),
  expenses: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 4.306 6.43l.776 2.898m0 0 3.182-5.511m-3.182 5.51-5.511-3.181" />
    </svg>
  ),
  profit: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  transactions: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  ),
  arrowRight: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" />
    </svg>
  ),
};

// Color palette for charts
const CHART_COLORS = ["#64B5F6", "#818cf8", "#34d399", "#f472b6", "#fbbf24", "#94a3b8"];

// Pie Chart Component
function PieChart({ data, size = 200 }: { data: ChartData[]; size?: number }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <div className="text-center text-gray-400">
          <p className="text-sm">No data</p>
        </div>
      </div>
    );
  }
  
  let currentAngle = 0;

  const createArcPath = (startAngle: number, endAngle: number, radius: number) => {
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

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((item, index) => {
          const angle = (item.value / total) * 360;
          const path = createArcPath(currentAngle - 90, currentAngle + angle - 90, size / 2);
          currentAngle += angle;
          return (
            <path
              key={index}
              d={path}
              fill={item.color}
              className="transition-all duration-300 hover:opacity-80"
            />
          );
        })}
        <circle cx={size / 2} cy={size / 2} r={size / 3.5} fill="white" />
      </svg>
    </div>
  );
}

// Bar Chart Component
function BarChart({ data, height = 250 }: { data: { month: string; value: number }[]; height?: number }) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  
  if (data.every(d => d.value === 0)) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="text-center text-gray-400">
          <p className="text-sm">No transaction data yet</p>
          <p className="text-xs mt-1">Add transactions in the Accounting Studio</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex items-end gap-2 h-full" style={{ height }}>
      {data.map((item, index) => {
        const barHeight = (item.value / maxValue) * (height - 40);
        return (
          <div key={index} className="flex flex-col items-center flex-1 gap-2">
            <div
              className="w-full rounded-t-lg transition-all duration-500 hover:opacity-80 relative group"
              style={{
                height: Math.max(barHeight, 4),
                background: item.value > 0 ? `linear-gradient(180deg, #64B5F6 0%, #4A9FD9 100%)` : '#e5e7eb',
                minWidth: "20px",
              }}
            >
              {item.value > 0 && (
                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  ₦{item.value >= 1000000 ? (item.value / 1000000).toFixed(1) + 'M' : item.value >= 1000 ? (item.value / 1000).toFixed(0) + 'K' : item.value.toLocaleString()}
                </div>
              )}
            </div>
            <span className="text-xs text-gray-500 font-medium">{item.month}</span>
          </div>
        );
      })}
    </div>
  );
}

// Metric Card Component
function MetricCardComponent({ metric }: { metric: MetricCard }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-[#64B5F6]">
          {metric.icon}
        </div>
        <span
          className={`text-xs font-semibold px-2 py-1 rounded-full ${
            metric.changeType === "positive"
              ? "bg-emerald-100 text-emerald-600"
              : metric.changeType === "negative"
              ? "bg-red-100 text-red-600"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {metric.change}
        </span>
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
        <p className="text-sm text-gray-500 mt-1">{metric.label}</p>
      </div>
    </div>
  );
}

// Empty State Component
function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
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
        className="inline-flex items-center gap-2 bg-[#64B5F6] text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#4A9FD9] transition-colors"
      >
        Go to Accounting Studio
        {icons.arrowRight}
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [transactions, setTransactions] = useState<RawTransaction[]>([]);
  const [engineStatements, setEngineStatements] = useState<StatementDraft | null>(null);
  const [journalCount, setJournalCount] = useState(0);

  // Helper to derive transactions from journal entries based on account codes
  const deriveTransactionsFromJournals = (journalEntries: { 
    id: string; 
    date: string; 
    narration: string; 
    lines: { accountCode: string; accountName: string; debit: number; credit: number }[] 
  }[]): RawTransaction[] => {
    return journalEntries.map((entry) => {
      // Find the main economic account (not cash/bank which are just the other side)
      const economicLine = entry.lines.find(line => {
        const code = line.accountCode;
        // Look for income (4xxx), expense (5xxx, 6xxx), or asset purchase (15xx)
        return code.startsWith("4") || code.startsWith("5") || code.startsWith("6") || 
               (code.startsWith("15") && !code.includes("1"));
      }) || entry.lines[0];

      const code = economicLine?.accountCode || "";
      let type: "income" | "expense" = "expense";
      let category = "other";
      let amount = 0;

      // Determine type and category based on account code
      if (code.startsWith("4")) {
        // 4xxx = Income/Revenue accounts
        type = "income";
        amount = economicLine.credit || economicLine.debit;
        if (code === "4000") category = "sales";
        else if (code === "4100") category = "sales-returns";
        else if (code === "4200") category = "service-income";
        else if (code === "4300") category = "interest-income";
        else category = "revenue";
      } else if (code.startsWith("50")) {
        // 50xx = Cost of Sales
        type = "expense";
        amount = economicLine.debit || economicLine.credit;
        category = "cost-of-sales";
      } else if (code.startsWith("51") || code.startsWith("52")) {
        // 51xx, 52xx = Purchases
        type = "expense";
        amount = economicLine.debit || economicLine.credit;
        category = "purchases";
      } else if (code.startsWith("6")) {
        // 6xxx = Operating Expenses
        type = "expense";
        amount = economicLine.debit || economicLine.credit;
        if (code === "6000") category = "salaries";
        else if (code === "6100") category = "rent";
        else if (code === "6200") category = "utilities";
        else if (code === "6300") category = "professional-fees";
        else if (code === "6400") category = "transport";
        else if (code === "6500") category = "interest-expense";
        else category = "operating-expenses";
      } else if (code.startsWith("15")) {
        // 15xx = Fixed Assets
        type = "expense";
        amount = economicLine.debit || economicLine.credit;
        category = "asset-purchase";
      } else {
        // Fallback: use narration to determine
        const narration = entry.narration.toLowerCase();
        if (narration.includes("sale") || narration.includes("revenue") || narration.includes("income")) {
          type = "income";
          category = "sales";
        } else if (narration.includes("purchase")) {
          category = "purchases";
        } else if (narration.includes("rent")) {
          category = "rent";
        } else if (narration.includes("salary") || narration.includes("payroll")) {
          category = "salaries";
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
    setIsLoaded(true);
    if (typeof window !== "undefined") {
      // Load and subscribe to accounting engine first (source of truth for journal entries)
      accountingEngine.load();
      const state = accountingEngine.getState();
      setEngineStatements(accountingEngine.generateStatements());
      setJournalCount(state.journalEntries.length);

      // Try to load transactions from localStorage first
      const savedTransactions = window.localStorage.getItem("insight::accounting-transactions");
      let loadedFromStorage = false;
      
      if (savedTransactions) {
        try {
          const parsed = JSON.parse(savedTransactions);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTransactions(parsed);
            loadedFromStorage = true;
          }
        } catch {
          // ignore malformed cache
        }
      }
      
      // If no saved transactions but we have journal entries, derive from them
      if (!loadedFromStorage && state.journalEntries.length > 0) {
        const derived = deriveTransactionsFromJournals(state.journalEntries);
        setTransactions(derived);
        // Also save to localStorage for persistence
        window.localStorage.setItem("insight::accounting-transactions", JSON.stringify(derived));
      }
      
      const unsubscribe = accountingEngine.subscribe((newState) => {
        setEngineStatements(accountingEngine.generateStatements());
        setJournalCount(newState.journalEntries.length);
        
        // When engine updates, also update derived transactions
        if (newState.journalEntries.length > 0) {
          const derived = deriveTransactionsFromJournals(newState.journalEntries);
          setTransactions(derived);
          window.localStorage.setItem("insight::accounting-transactions", JSON.stringify(derived));
        }
      });
      
      // Also listen for localStorage changes from other tabs/pages
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === "insight::accounting-transactions" && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            if (Array.isArray(parsed)) {
              setTransactions(parsed);
            }
          } catch {
            // ignore
          }
        }
      };
      window.addEventListener("storage", handleStorageChange);
      
      return () => {
        unsubscribe();
        window.removeEventListener("storage", handleStorageChange);
      };
    }
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

  // Format currency
  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `₦${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `₦${(amount / 1000).toFixed(0)}K`;
    }
    return `₦${amount.toLocaleString()}`;
  };

  const metrics: MetricCard[] = useMemo(
    () => [
      {
        label: "Total Revenue",
        value: formatCurrency(calculatedData.totalRevenue),
        change: transactions.length > 0 ? `${calculatedData.transactionCount} entries` : "No data",
        changeType: calculatedData.totalRevenue > 0 ? "positive" : "neutral",
        icon: icons.revenue,
      },
      {
        label: "Total Expenses",
        value: formatCurrency(calculatedData.totalExpenses),
        change: calculatedData.totalExpenses > 0 ? "Active" : "No data",
        changeType: calculatedData.totalExpenses > 0 ? "negative" : "neutral",
        icon: icons.expenses,
      },
      {
        label: "Net Profit",
        value: formatCurrency(calculatedData.netProfit),
        change: calculatedData.profitMargin > 0 ? `${calculatedData.profitMargin.toFixed(1)}% margin` : "—",
        changeType: calculatedData.netProfit > 0 ? "positive" : calculatedData.netProfit < 0 ? "negative" : "neutral",
        icon: icons.profit,
      },
      {
        label: "Transactions",
        value: calculatedData.transactionCount.toLocaleString(),
        change: calculatedData.avgTransaction > 0 ? `Avg ${formatCurrency(calculatedData.avgTransaction)}` : "—",
        changeType: "neutral",
        icon: icons.transactions,
      },
    ],
    [calculatedData, transactions.length]
  );

  if (!isLoaded) {
    return null;
  }

  return (
    <div className={`space-y-6 transition-opacity duration-500 ${isLoaded ? "opacity-100" : "opacity-0"}`}>
      {/* Header */}
      <div className="rounded-2xl bg-white border border-gray-200 px-6 py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Financial Dashboard</h1>
                <p className="text-sm text-gray-500">Real-time insights from your accounting records</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/accounting"
              className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Transactions
            </Link>
          </div>
        </div>
      </div>

      {transactions.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((metric, index) => (
              <MetricCardComponent key={index} metric={metric} />
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Bar Chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Monthly Revenue</h3>
                  <p className="text-sm text-gray-500">Revenue trend by month</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-full bg-[#64B5F6]"></span>
                  <span className="text-gray-500">Revenue (₦)</span>
                </div>
              </div>
              <BarChart data={calculatedData.monthlyRevenue} height={220} />
            </div>

            {/* Expense Pie Chart */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Expense Breakdown</h3>
                <p className="text-sm text-gray-500">Where your money goes</p>
              </div>
              <div className="flex flex-col items-center gap-4">
                <PieChart data={calculatedData.expenseCategories} size={160} />
                {calculatedData.expenseCategories.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 w-full mt-2">
                    {calculatedData.expenseCategories.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                        <span className="text-xs text-gray-600 truncate">{item.label}</span>
                        <span className="text-xs font-semibold text-gray-900 ml-auto">{item.value}%</span>
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
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Income Streams</h3>
                <p className="text-sm text-gray-500">Revenue by category</p>
              </div>
              {calculatedData.incomeStreams.length > 0 ? (
                <div className="flex items-center gap-8">
                  <PieChart data={calculatedData.incomeStreams} size={140} />
                  <div className="flex flex-col gap-3 flex-1">
                    {calculatedData.incomeStreams.map((item, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <span className="w-4 h-4 rounded-lg flex-shrink-0" style={{ backgroundColor: item.color }}></span>
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
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
                  <p className="text-sm text-gray-500">Latest financial activity</p>
                </div>
                <Link href="/accounting" className="text-xs font-semibold text-gray-600 hover:text-gray-900">
                  View All
                </Link>
              </div>
              <div className="space-y-3">
                {calculatedData.recentTransactions.length > 0 ? (
                  calculatedData.recentTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            tx.type === "income" ? "bg-emerald-100" : "bg-red-100"
                          }`}
                        >
                          {tx.type === "income" ? (
                            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{tx.description}</p>
                          <p className="text-xs text-gray-500">{tx.date}</p>
                        </div>
                      </div>
                      <span
                        className={`text-sm font-bold flex-shrink-0 ${tx.type === "income" ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {tx.type === "income" ? "+" : "-"}₦{Math.abs(tx.amount).toLocaleString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm">No transactions yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { 
                label: "Profit Margin", 
                value: calculatedData.profitMargin > 0 ? `${calculatedData.profitMargin.toFixed(1)}%` : "—", 
                sublabel: calculatedData.netProfit > 0 ? "Profitable" : "No profit yet" 
              },
              { 
                label: "Avg. Transaction", 
                value: formatCurrency(calculatedData.avgTransaction), 
                sublabel: `${calculatedData.transactionCount} total` 
              },
              { 
                label: "Income Entries", 
                value: transactions.filter(tx => tx.type === "income" || tx.amount > 0).length.toString(), 
                sublabel: "Revenue transactions" 
              },
              { 
                label: "Expense Entries", 
                value: transactions.filter(tx => tx.type === "expense" || tx.amount < 0).length.toString(), 
                sublabel: "Cost transactions" 
              },
            ].map((stat, index) => (
              <div key={index} className="bg-white rounded-xl p-5 border border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                <p className="text-xs text-gray-400 mt-1">{stat.sublabel}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
