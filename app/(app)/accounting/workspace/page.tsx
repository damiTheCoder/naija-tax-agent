"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
// Removed automation imports
import { RawTransaction, StatementDraft } from "@/lib/accounting/types";
import { accountingEngine } from "@/lib/accounting/transactionBridge";
import { JournalEntry, LedgerAccount } from "@/lib/accounting/doubleEntry";
import { generateFinancialStatementsPDF, generateJournalsPDF, generateTrialBalancePDF, generateIncomeStatementPDF, generateBalanceSheetPDF, generateCashFlowStatementPDF, generateEquityStatementPDF, generateTaxPayablesPDF, CashFlowData, EquityStatementData, TaxPayablesData } from "@/lib/accountingPdfGenerator";
import { generateTaxSchedule, TransactionTaxAnalysis, TaxPayablesSchedule } from "@/lib/accounting/transactionTaxAnalyzer";

type ActiveTab = "journal" | "ledger" | "trial-balance" | "statements" | "tax-payables" | "cashbook";
type JournalClass = "all" | "cash" | "purchase" | "sales" | "expense" | "other";

function formatAsAtDate(value: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(value);
}

function classifyJournalEntry(entry: JournalEntry): Exclude<JournalClass, "all"> {
  const txType = entry.transactionType;
  if (txType === "sale" || txType === "sale-return") return "sales";
  if (txType === "purchase" || txType === "purchase-return") return "purchase";
  if (txType === "expense") return "expense";

  // Prioritize account coding analysis over generic "hasCash" check
  const hasSalesLine = entry.lines.some((line) => line.accountCode.startsWith("4"));
  if (hasSalesLine) return "sales";

  const hasPurchaseLine = entry.lines.some(
    (line) =>
      (line.accountCode.startsWith("50") || /purchase|inventory|stock|materials/i.test(line.accountName)) &&
      line.debit > 0
  );
  if (hasPurchaseLine) return "purchase";

  const hasExpenseLine = entry.lines.some(
    (line) =>
      (line.accountCode.startsWith("5") && !line.accountCode.startsWith("50")) ||
      line.accountCode.startsWith("6") ||
      line.accountCode.startsWith("7")
  );
  if (hasExpenseLine) return "expense";

  const hasCashLine = entry.lines.some(
    (line) => line.accountCode.startsWith("10") || /cash|bank/i.test(line.accountName)
  );
  if (hasCashLine) return "cash";

  if (txType === "receipt" || txType === "payment" || txType === "transfer") return "cash";

  return "other";
}

function formatJournalClassLabel(journalClass: Exclude<JournalClass, "all">): string {
  if (journalClass === "sales") return "Sales";
  if (journalClass === "purchase") return "Purchase";
  if (journalClass === "expense") return "Expense";
  if (journalClass === "cash") return "Cash";
  return "Other";
}

function getJournalBookLabel(entry: JournalEntry): string {
  const classified = classifyJournalEntry(entry);
  const narration = entry.narration.toLowerCase();

  // Detect cash/bank movement details
  const cashLines = entry.lines.filter(
    (line) => line.accountCode.startsWith("10") || /cash|bank/i.test(line.accountName)
  );
  const totalCashDebit = cashLines.reduce((sum, l) => sum + l.debit, 0);
  const totalCashCredit = cashLines.reduce((sum, l) => sum + l.credit, 0);

  const hasCashInflow = totalCashDebit > totalCashCredit;
  const hasCashOutflow = totalCashCredit > totalCashDebit;

  if (classified === "sales") return "Sales Journal";
  if (classified === "purchase") return "Purchase Journal";
  if (classified === "expense") return "Expense Journal";

  if (classified === "cash" || cashLines.length > 0) {
    if (hasCashInflow || /received|receipt|cash sale/.test(narration)) {
      return "Cash Receipt Journal";
    }
    if (hasCashOutflow || /paid|payment|disburse|withdraw/.test(narration)) {
      return "Cash Payment Journal";
    }
    return "Cash Journal";
  }

  if (entry.transactionType === "adjustment") return "Adjustment Journal";
  if (entry.transactionType === "opening-balance") return "Opening Journal";
  if (entry.transactionType === "closing") return "Closing Journal";
  return "General Journal";
}

export default function WorkspacePage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<RawTransaction[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<Map<string, LedgerAccount>>(new Map());
  const [financialStatements, setFinancialStatements] = useState<StatementDraft | null>(null);
  // Removed automation state
  const [activeTab, setActiveTab] = useState<ActiveTab>("journal");

  // Date filtering state
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [journalClass, setJournalClass] = useState<JournalClass>("all");
  const asAtDateLabel = formatAsAtDate();

  // Get available years from journal entries
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    journalEntries.forEach((entry) => {
      const year = new Date(entry.date).getFullYear();
      years.add(year);
    });
    // Always include current year
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [journalEntries]);

  // Filter entries by selected year and date range
  const filteredJournalEntries = useMemo(() => {
    return journalEntries.filter((entry) => {
      const entryDate = new Date(entry.date);
      const entryYear = entryDate.getFullYear();

      // Filter by year
      if (entryYear !== selectedYear) return false;

      // Filter by date range if set
      if (dateFrom && entryDate < new Date(dateFrom)) return false;
      if (dateTo && entryDate > new Date(dateTo)) return false;

      return true;
    });
  }, [journalEntries, selectedYear, dateFrom, dateTo]);

  // Group entries by year for yearly statements
  const entriesByYear = useMemo(() => {
    const grouped: Record<number, JournalEntry[]> = {};
    journalEntries.forEach((entry) => {
      const year = new Date(entry.date).getFullYear();
      if (!grouped[year]) grouped[year] = [];
      grouped[year].push(entry);
    });
    return grouped;
  }, [journalEntries]);

  // Calculate yearly statements
  const yearlyStatements = useMemo(() => {
    const statements: Record<number, { revenue: number; costOfSales: number; operatingExpenses: number; grossProfit: number; netIncome: number; assets: number; liabilities: number; equity: number }> = {};

    Object.entries(entriesByYear).forEach(([yearStr, entries]) => {
      const year = parseInt(yearStr);
      let revenue = 0, costOfSales = 0, operatingExpenses = 0, assets = 0, liabilities = 0, equity = 0;

      entries.forEach((entry) => {
        entry.lines.forEach((line) => {
          const code = line.accountCode;
          const amount = line.credit - line.debit;

          if (code.startsWith("4")) {
            revenue += line.credit;
          } else if (code.startsWith("50")) {
            costOfSales += line.debit;
          } else if (code.startsWith("5") || code.startsWith("6")) {
            operatingExpenses += line.debit;
          } else if (code.startsWith("1")) {
            assets += line.debit - line.credit;
          } else if (code.startsWith("2")) {
            liabilities += line.credit - line.debit;
          } else if (code.startsWith("3")) {
            equity += line.credit - line.debit;
          }
        });
      });

      const grossProfit = revenue - costOfSales;
      const netIncome = grossProfit - operatingExpenses;

      statements[year] = { revenue, costOfSales, operatingExpenses, grossProfit, netIncome, assets, liabilities, equity };
    });

    return statements;
  }, [entriesByYear]);

  // Get trial balance from accounting engine
  const trialBalance = useMemo(() => {
    return accountingEngine.generateTrialBalance();
  }, [journalEntries]);

  // Filter ledger accounts with activity
  const activeLedgerAccounts = useMemo(() => {
    return Array.from(ledgerAccounts.entries())
      .filter(([_, account]) => account.entries.length > 0 || account.closingBalance !== 0)
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [ledgerAccounts]);

  const journalClassCounts = useMemo(() => {
    const counts: Record<JournalClass, number> = {
      all: filteredJournalEntries.length,
      cash: 0,
      purchase: 0,
      sales: 0,
      expense: 0,
      other: 0,
    };

    filteredJournalEntries.forEach((entry) => {
      const classified = classifyJournalEntry(entry);
      counts[classified] += 1;
    });

    return counts;
  }, [filteredJournalEntries]);

  const classifiedJournalEntries = useMemo(() => {
    if (journalClass === "all") {
      return filteredJournalEntries;
    }
    return filteredJournalEntries.filter((entry) => classifyJournalEntry(entry) === journalClass);
  }, [filteredJournalEntries, journalClass]);

  const ledgerEntryRows = useMemo(() => {
    return filteredJournalEntries
      .slice()
      .reverse()
      .map((entry) => {
        const debitLines = entry.lines.filter((line) => line.debit > 0);
        const creditLines = entry.lines.filter((line) => line.credit > 0);
        return {
          id: entry.id,
          date: entry.date,
          journalId: entry.id,
          narration: entry.narration,
          reference: entry.reference || "—",
          debitLines,
          creditLines,
          total: entry.totalDebits || entry.lines.reduce((sum, line) => sum + (line.debit || 0), 0),
          status: entry.status,
        };
      });
  }, [filteredJournalEntries]);

  const openEntryInEditor = (entryId: string) => {
    router.push(`/accounting?editEntry=${encodeURIComponent(entryId)}&resetDraft=1`);
  };



  // Download yearly statement as PDF (includes all 4 statements)
  const handleDownloadYearlyStatement = async (year: number) => {
    const statement = yearlyStatements[year];
    if (!statement) return;

    // Get cash flow and equity data from accounting engine
    const statementsData = accountingEngine.generateStatements();

    const cashFlow: CashFlowData = {
      year,
      cashFromOperations: statementsData.cashFromOperations,
      cashFromInvesting: statementsData.cashFromInvesting,
      cashFromFinancing: statementsData.cashFromFinancing,
    };

    const equityStatement: EquityStatementData = {
      year,
      openingBalance: statementsData.equityStatement?.openingBalance || 0,
      additions: statementsData.equityStatement?.additions || 0,
      netIncome: statementsData.equityStatement?.netIncome || 0,
      drawings: statementsData.equityStatement?.drawings || 0,
      closingBalance: statementsData.equityStatement?.closingBalance || 0,
    };

    await generateFinancialStatementsPDF(
      {
        year,
        revenue: statement.revenue,
        costOfSales: statement.costOfSales,
        grossProfit: statement.grossProfit,
        operatingExpenses: statement.operatingExpenses,
        netIncome: statement.netIncome,
        assets: statement.assets,
        liabilities: statement.liabilities,
        equity: statement.equity,
        cashFlow,
        equityStatement,
      },
      "CashOS Business"
    );
  };

  // Download journal entries for a year as PDF
  const handleDownloadJournals = async (year: number) => {
    const entries = entriesByYear[year];
    if (!entries || entries.length === 0) return;

    await generateJournalsPDF(entries, year, "CashOS Business");
  };

  // Load data from accounting engine
  useEffect(() => {
    if (typeof window === "undefined") return;

    const applyAccountingState = () => {
      const state = accountingEngine.getState();
      setJournalEntries(state.journalEntries);
      setLedgerAccounts(state.ledgerAccounts);
      setFinancialStatements(accountingEngine.generateStatements());
    };

    // Subscribe to updates
    const unsubscribe = accountingEngine.subscribe((newState) => {
      setJournalEntries(newState.journalEntries);
      setLedgerAccounts(newState.ledgerAccounts);
      setFinancialStatements(accountingEngine.generateStatements());
    });

    // Listen for custom accounting-update events (from chat transactions)
    const handleAccountingUpdate = () => applyAccountingState();
    window.addEventListener("accounting-update", handleAccountingUpdate);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "insight::accounting-engine") {
        accountingEngine.load();
        handleAccountingUpdate();
      }
    };
    window.addEventListener("storage", handleStorage);

    // Also load raw transactions for display
    const initialFrame = window.requestAnimationFrame(() => {
      accountingEngine.load();
      applyAccountingState();

      const cachedTransactions = window.localStorage.getItem("insight::accounting-transactions");
      if (!cachedTransactions) return;
      try {
        const parsed = JSON.parse(cachedTransactions);
        if (Array.isArray(parsed)) {
          setTransactions(parsed);
        }
      } catch {
        // ignore malformed cache
      }
    });

    // Removed automation effects and handlers

    return () => {
      window.cancelAnimationFrame(initialFrame);
      unsubscribe();
      window.removeEventListener("accounting-update", handleAccountingUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    return `₦${absValue.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-NG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "journal",
      label: "General Journal",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      ),
    },
    {
      id: "ledger",
      label: "General Ledger",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125" />
        </svg>
      ),
    },
    {
      id: "trial-balance",
      label: "Trial Balance",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
        </svg>
      ),
    },
    {
      id: "statements",
      label: "Financial Statements",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
    {
      id: "tax-payables",
      label: "Tax Payables",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
        </svg>
      ),
    },
    {
      id: "cashbook",
      label: "Cashbook",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
  ];
  const selectedYearEntries = entriesByYear[selectedYear] || [];
  const selectedYearStatement = yearlyStatements[selectedYear];

  return (
    <div className="reporting-workspace-page space-y-6 bg-white px-2 md:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Reporting</h1>
          <p className="text-sm text-gray-500 mt-1">
            {journalEntries.length > 0
              ? `${journalEntries.length} journal entries • ${availableYears.length} year(s) of records`
              : "Start adding transactions to build your accounting records"
            }
          </p>
        </div>
      </div>

      {/* Date Search & Year Filter */}
      <div className="reporting-period-panel overflow-hidden rounded-[22px] border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#101010] text-white shadow-sm">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5m4 14v-7m4 7V8m4 11v-4m4 4V3" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-400">Activity / Financial Reporting</p>
              <h2 className="truncate text-base font-semibold text-gray-950">Reporting period {selectedYear}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#8fff00] px-2.5 py-1 text-[11px] font-semibold text-[#101010]">
                Active
            </span>
            <span className="hidden text-sm text-gray-400 sm:inline">
              {selectedYearEntries.length} entries
            </span>
          </div>
        </div>

        <div className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[1.05fr_1fr]">
          <div className="reporting-period-card rounded-[18px] border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">Reporting period</p>
            <div className="mt-3 flex flex-wrap items-end gap-2.5">
              <p className="text-4xl font-semibold leading-none tracking-tight text-gray-950">{selectedYear}</p>
              <p className="pb-1 text-sm text-gray-500">
                {availableYears.length} year{availableYears.length === 1 ? "" : "s"} of records
              </p>
            </div>
            <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-white">
              <span className="w-2/3 rounded-full bg-[#8fff00]" />
              <span className="w-1/6 bg-[#101010]" />
            </div>
            <p className="mt-3 text-xs text-gray-500">
              {selectedYearEntries.length} entries for this period
            </p>
          </div>

          <div className="reporting-period-card rounded-[18px] border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500">Yearly result</p>
                <p className={`mt-3 text-3xl font-semibold tracking-tight ${selectedYearStatement && selectedYearStatement.netIncome < 0 ? "text-[#4f8f00]" : "text-gray-950"}`}>
                  {selectedYearStatement ? `₦${Math.abs(selectedYearStatement.netIncome).toLocaleString("en-NG")}` : "₦0"}
                </p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700">
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </span>
            </div>
            <div className="mt-4 h-8 rounded-lg bg-[repeating-linear-gradient(90deg,#8fff00_0_3px,transparent_3px_8px)] opacity-80" />
            <p className="mt-3 text-xs text-gray-500">
              Net income from posted accounting records
            </p>
          </div>
        </div>

        <div className="reporting-period-filters grid gap-2.5 border-t border-gray-100 bg-white px-4 py-4 sm:px-5 md:grid-cols-4">
          <label className="reporting-period-control block rounded-xl border border-gray-200 bg-white px-3.5 py-2.5">
            <span className="block text-xs font-medium text-gray-500">Year</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="mt-1.5 w-full bg-transparent text-lg font-semibold text-gray-950 outline-none focus:ring-0"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>

          <label className="reporting-period-control block rounded-xl border border-gray-200 bg-white px-3.5 py-2.5">
            <span className="block text-xs font-medium text-gray-500">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1.5 w-full bg-transparent text-sm font-semibold text-gray-950 outline-none focus:ring-0"
            />
          </label>

          <label className="reporting-period-control block rounded-xl border border-gray-200 bg-white px-3.5 py-2.5">
            <span className="block text-xs font-medium text-gray-500">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1.5 w-full bg-transparent text-sm font-semibold text-gray-950 outline-none focus:ring-0"
            />
          </label>

          <div className="reporting-period-control flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5">
            <div>
              <p className="text-xs font-medium text-gray-500">Records</p>
              <p className="mt-1.5 text-lg font-semibold text-gray-950">{selectedYearEntries.length}</p>
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      < div className="" >
        <nav className="flex gap-1 overflow-x-auto pb-0 hide-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${activeTab === tab.id
                ? "bg-gray-100 text-[#0a0a0a]"
                : "text-gray-500 hover:text-gray-700"
                }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div >

      {/* Tab Content */}
      < div className="bg-white rounded-xl border border-gray-200 overflow-hidden" >
        {/* General Journal - Now showing real double-entry journal entries */}
        {
          activeTab === "journal" && (
            <div>
              <div className="px-6 py-4 bg-white flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">General Journal - {selectedYear}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{classifiedJournalEntries.length} entries {dateFrom || dateTo ? '(filtered)' : ''} • Classified journal view</p>
                </div>
                {filteredJournalEntries.length > 0 && (
                  <button
                    onClick={() => {
                      void handleDownloadJournals(selectedYear);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download {selectedYear}
                  </button>
                )}
              </div>
              <div className="px-6 py-3 border-b border-gray-100 bg-white">
                <div className="flex flex-wrap gap-2">
                  {([
                    ["all", "All"],
                    ["cash", "Cash"],
                    ["purchase", "Purchase"],
                    ["sales", "Sales"],
                    ["expense", "Expense"],
                    ["other", "Other"],
                  ] as const).map(([key, label]) => {
                    const itemKey = key as JournalClass;
                    const active = journalClass === itemKey;
                    return (
                      <button
                        key={itemKey}
                        onClick={() => setJournalClass(itemKey)}
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${active ? "bg-[#8fff00] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                      >
                        <span>{label}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/20" : "bg-white"}`}>
                          {journalClassCounts[itemKey]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {classifiedJournalEntries.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p>No journal entries for {selectedYear}</p>
                    <p className="text-xs">Add transactions in the Accounting Studio to create journal entries</p>
                    <Link href="/accounting" className="mt-2 text-[#446b00] text-sm font-medium hover:underline">
                      Go to Accounting Studio →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="max-h-[560px] overflow-auto">
                  <table className="w-full min-w-[1040px]">
                    <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                      <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                        <th className="px-2 py-3 font-semibold">Date</th>
                        <th className="px-2 py-3 font-semibold">Number</th>
                        <th className="px-2 py-3 font-semibold">Class</th>
                        <th className="px-2 py-3 font-semibold">Reference</th>
                        <th className="px-2 py-3 font-semibold">Journal</th>
                        <th className="px-2 py-3 text-right font-semibold">Total</th>
                        <th className="px-2 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {classifiedJournalEntries
                        .slice()
                        .reverse()
                        .map((entry) => {
                          const journalLabel = getJournalBookLabel(entry);
                          const total = entry.totalDebits || entry.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
                          const className = formatJournalClassLabel(classifyJournalEntry(entry));
                          return (
                            <tr
                              key={entry.id}
                              onClick={() => entry.status !== "voided" && openEntryInEditor(entry.id)}
                              className={`hover:bg-gray-50/70 transition-colors ${entry.status === "voided" ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                              <td className="px-2 py-3 text-sm text-gray-700 whitespace-nowrap">{formatDate(entry.date)}</td>
                              <td className="px-2 py-3 text-sm font-mono text-purple-700 whitespace-nowrap">{entry.id}</td>
                              <td className="px-2 py-3">
                                <span className="inline-flex rounded-full bg-blue-50 text-blue-700 px-2.5 py-1 text-xs font-medium">
                                  {className}
                                </span>
                              </td>
                              <td className="px-2 py-3 text-sm text-gray-700 max-w-[340px]">
                                <p className="truncate" title={entry.narration}>{entry.narration}</p>
                              </td>
                              <td className="px-2 py-3 text-sm text-gray-700 whitespace-nowrap">{journalLabel}</td>
                              <td className="px-2 py-3 text-sm text-right font-mono text-gray-900 whitespace-nowrap">{formatCurrency(total)}</td>
                              <td className="px-2 py-3">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${entry.status === "voided"
                                    ? "bg-red-100 text-red-700"
                                    : entry.status === "draft"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-emerald-100 text-emerald-700"
                                  }`}>
                                  {entry.status === "voided" ? "Voided" : entry.status === "draft" ? "Draft" : "Posted"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        }

        {/* General Ledger - Now showing real ledger accounts */}
        {
          activeTab === "ledger" && (
            <div>
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-900">General Ledger</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{activeLedgerAccounts.length} accounts • {ledgerEntryRows.length} entries with debit/credit sides</p>
                </div>
                <button
                  onClick={() => router.push("/accounting?newEntry=1")}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap"
                  title="Post a new journal entry"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  New Entry
                </button>
              </div>
              {ledgerEntryRows.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-400">
                  <p>No ledger accounts with activity</p>
                  <p className="text-xs mt-1">Post journal entries to see ledger activity</p>
                </div>
              ) : (
                <div className="max-h-[560px] overflow-auto">
                  <table className="w-full min-w-[1220px]">
                    <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                      <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                        <th className="px-2 py-3 font-semibold">Date</th>
                        <th className="px-2 py-3 font-semibold">Number</th>
                        <th className="px-2 py-3 font-semibold">Reference</th>
                        <th className="px-2 py-3 font-semibold">Debit Account(s)</th>
                        <th className="px-2 py-3 font-semibold">Credit Account(s)</th>
                        <th className="px-2 py-3 text-right font-semibold">Total</th>
                        <th className="px-2 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {ledgerEntryRows.map((row) => (
                        <tr
                          key={row.id}
                          onClick={() => row.status !== "voided" && openEntryInEditor(row.journalId)}
                          className={`hover:bg-gray-50/70 transition-colors ${row.status === "voided" ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          <td className="px-2 py-3 text-sm text-gray-700 whitespace-nowrap">{formatDate(row.date)}</td>
                          <td className="px-2 py-3 text-sm font-mono text-purple-700 whitespace-nowrap">{row.journalId}</td>
                          <td className="px-2 py-3 text-sm text-gray-700 max-w-[280px]">
                            <p className="truncate" title={row.narration}>{row.narration}</p>
                          </td>
                          <td className="px-2 py-3 text-sm text-gray-700 max-w-[320px]">
                            <div className="space-y-1">
                              {row.debitLines.length === 0 ? (
                                <p className="text-gray-400">—</p>
                              ) : row.debitLines.map((line, idx) => (
                                <p key={`${row.id}-dr-${line.accountCode}-${idx}`} className="truncate text-gray-700">
                                  <span className="font-mono text-gray-500 mr-1">{line.accountCode}</span>
                                  {line.accountName}
                                  <span className="ml-2 font-mono text-gray-900">{formatCurrency(line.debit)}</span>
                                </p>
                              ))}
                            </div>
                          </td>
                          <td className="px-2 py-3 text-sm text-gray-700 max-w-[320px]">
                            <div className="space-y-1">
                              {row.creditLines.length === 0 ? (
                                <p className="text-gray-400">—</p>
                              ) : row.creditLines.map((line, idx) => (
                                <p key={`${row.id}-cr-${line.accountCode}-${idx}`} className="truncate text-gray-700">
                                  <span className="font-mono text-gray-500 mr-1">{line.accountCode}</span>
                                  {line.accountName}
                                  <span className="ml-2 font-mono text-gray-900">{formatCurrency(line.credit)}</span>
                                </p>
                              ))}
                            </div>
                          </td>
                          <td className="px-2 py-3 text-sm text-right font-mono text-gray-900 whitespace-nowrap">{formatCurrency(row.total)}</td>
                          <td className="px-2 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === "voided"
                                ? "bg-red-100 text-red-700"
                                : row.status === "draft"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}>
                              {row.status === "voided" ? "Voided" : row.status === "draft" ? "Draft" : "Posted"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        }

        {/* Trial Balance - Using real accounting engine data */}
        {
          activeTab === "trial-balance" && (
            <div>
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Trial Balance</h2>
                  <p className="text-xs text-gray-500 mt-0.5">As at <span suppressHydrationWarning>{asAtDateLabel || "—"}</span></p>
                </div>
                <div className="flex items-center gap-3">
                  {trialBalance.accounts.length > 0 && (
                    <button
                      onClick={() => {
                        void generateTrialBalancePDF(
                          trialBalance,
                          asAtDateLabel || formatAsAtDate(),
                          "CashOS Business"
                        );
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Download PDF
                    </button>
                  )}
                  <div className={`text-xs font-medium px-2 py-1 rounded ${Math.abs(trialBalance.totals.debit - trialBalance.totals.credit) < 0.01 ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                    {Math.abs(trialBalance.totals.debit - trialBalance.totals.credit) < 0.01 ? "✓ Balanced" : "⚠ Unbalanced"}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                {trialBalance.accounts.length === 0 ? (
                  <div className="px-6 py-12 text-center text-gray-400">
                    <p>No trial balance data</p>
                    <p className="text-xs mt-1">Post journal entries to generate trial balance</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                        <th className="px-6 py-3 text-left font-medium">Account Code</th>
                        <th className="px-6 py-3 text-left font-medium">Account Name</th>
                        <th className="px-6 py-3 text-right font-medium">Debit (₦)</th>
                        <th className="px-6 py-3 text-right font-medium">Credit (₦)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {trialBalance.accounts.map((row) => (
                        <tr key={row.code} className="hover:bg-gray-50">
                          <td className="px-6 py-3 text-sm text-gray-400 font-mono">{row.code}</td>
                          <td className="px-6 py-3 text-sm text-gray-900">{row.name}</td>
                          <td className="px-6 py-3 text-sm text-right font-mono text-gray-900">
                            {row.debit > 0 ? formatCurrency(row.debit) : "—"}
                          </td>
                          <td className="px-6 py-3 text-sm text-right font-mono text-gray-900">
                            {row.credit > 0 ? formatCurrency(row.credit) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-900 text-white">
                        <td colSpan={2} className="px-6 py-3 text-sm font-semibold">Total</td>
                        <td className="px-6 py-3 text-sm text-right font-mono font-semibold">{formatCurrency(trialBalance.totals.debit)}</td>
                        <td className="px-6 py-3 text-sm text-right font-mono font-semibold">{formatCurrency(trialBalance.totals.credit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          )
        }

        {/* Financial Statements - Yearly statements with download */}
        {
          activeTab === "statements" && (
            <div className="divide-y divide-gray-200">
              {/* Year selector header */}
              <div className="px-6 py-4 bg-gray-50 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Financial Statements - {selectedYear}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {entriesByYear[selectedYear]?.length || 0} journal entries for this year
                  </p>
                </div>
                {yearlyStatements[selectedYear] && (
                  <button
                    onClick={() => {
                      void handleDownloadYearlyStatement(selectedYear);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#8fff00] rounded-lg hover:bg-[#6fcc00] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download {selectedYear} Statements
                  </button>
                )}
              </div>

              {yearlyStatements[selectedYear] ? (
                <>
                  {/* Income Statement */}
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">Income Statement</h3>
                        <p className="text-xs text-gray-500">For the year ended 31 December {selectedYear}</p>
                      </div>
                      <button
                        onClick={() => {
                          void generateIncomeStatementPDF({
                            year: selectedYear,
                            revenue: yearlyStatements[selectedYear].revenue,
                            costOfSales: yearlyStatements[selectedYear].costOfSales,
                            grossProfit: yearlyStatements[selectedYear].grossProfit,
                            operatingExpenses: yearlyStatements[selectedYear].operatingExpenses,
                            netIncome: yearlyStatements[selectedYear].netIncome,
                            assets: yearlyStatements[selectedYear].assets,
                            liabilities: yearlyStatements[selectedYear].liabilities,
                            equity: yearlyStatements[selectedYear].equity,
                          }, "CashOS Business");
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Download
                      </button>
                    </div>
                    <div className="space-y-3 max-w-md">
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-600">Revenue</span>
                        <span className="text-sm font-mono text-gray-900">{formatCurrency(yearlyStatements[selectedYear].revenue)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 pl-4">
                        <span className="text-sm text-gray-500">Less: Cost of Sales</span>
                        <span className="text-sm font-mono text-gray-700">({formatCurrency(yearlyStatements[selectedYear].costOfSales)})</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-700">Gross Profit</span>
                        <span className="text-sm font-mono font-medium text-gray-900">{formatCurrency(yearlyStatements[selectedYear].grossProfit)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 pl-4">
                        <span className="text-sm text-gray-500">Less: Operating Expenses</span>
                        <span className="text-sm font-mono text-gray-700">({formatCurrency(yearlyStatements[selectedYear].operatingExpenses)})</span>
                      </div>
                      <div className="flex justify-between py-3 bg-gray-50 px-3 rounded-lg">
                        <span className="text-sm font-semibold text-gray-900">Net Income</span>
                        <span className={`text-sm font-mono font-bold ${yearlyStatements[selectedYear].netIncome >= 0 ? "text-blue-600" : "text-red-600"}`}>
                          {formatCurrency(yearlyStatements[selectedYear].netIncome)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Balance Sheet */}
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">Balance Sheet</h3>
                        <p className="text-xs text-gray-500">As at 31 December {selectedYear}</p>
                      </div>
                      <button
                        onClick={() => {
                          void generateBalanceSheetPDF({
                            year: selectedYear,
                            revenue: yearlyStatements[selectedYear].revenue,
                            costOfSales: yearlyStatements[selectedYear].costOfSales,
                            grossProfit: yearlyStatements[selectedYear].grossProfit,
                            operatingExpenses: yearlyStatements[selectedYear].operatingExpenses,
                            netIncome: yearlyStatements[selectedYear].netIncome,
                            assets: yearlyStatements[selectedYear].assets,
                            liabilities: yearlyStatements[selectedYear].liabilities,
                            equity: yearlyStatements[selectedYear].equity,
                          }, "CashOS Business");
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Download
                      </button>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-3">Assets</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600">Total Assets</span>
                            <span className="text-sm font-mono text-gray-900">{formatCurrency(yearlyStatements[selectedYear].assets)}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-3">Liabilities & Equity</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600">Total Liabilities</span>
                            <span className="text-sm font-mono text-gray-900">{formatCurrency(yearlyStatements[selectedYear].liabilities)}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600">Equity</span>
                            <span className="text-sm font-mono text-gray-900">{formatCurrency(yearlyStatements[selectedYear].equity)}</span>
                          </div>
                          <div className="flex justify-between py-3 bg-gray-50 px-3 rounded-lg">
                            <span className="text-sm font-semibold text-gray-700">Total Liabilities & Equity</span>
                            <span className="text-sm font-mono font-semibold text-gray-900">
                              {formatCurrency(yearlyStatements[selectedYear].liabilities + yearlyStatements[selectedYear].equity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Cash Flow Statement */}
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">Statement of Cash Flows</h3>
                        <p className="text-xs text-gray-500">For the year ended 31 December {selectedYear}</p>
                      </div>
                      <button
                        onClick={() => {
                          void generateCashFlowStatementPDF({
                            year: selectedYear,
                            cashFromOperations: accountingEngine.generateStatements().cashFromOperations,
                            cashFromInvesting: accountingEngine.generateStatements().cashFromInvesting,
                            cashFromFinancing: accountingEngine.generateStatements().cashFromFinancing,
                          }, "CashOS Business");
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Download
                      </button>
                    </div>
                    <div className="space-y-4 max-w-md">
                      <div>
                        <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Operating Activities</h4>
                        <div className="flex justify-between py-2 border-b border-gray-100 pl-4">
                          <span className="text-sm text-gray-600">Net Cash from Operations</span>
                          <span className="text-sm font-mono text-gray-900">
                            {formatCurrency(accountingEngine.generateStatements().cashFromOperations)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Investing Activities</h4>
                        <div className="flex justify-between py-2 border-b border-gray-100 pl-4">
                          <span className="text-sm text-gray-600">Net Cash from Investing</span>
                          <span className="text-sm font-mono text-gray-900">
                            {formatCurrency(accountingEngine.generateStatements().cashFromInvesting)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Financing Activities</h4>
                        <div className="flex justify-between py-2 border-b border-gray-100 pl-4">
                          <span className="text-sm text-gray-600">Net Cash from Financing</span>
                          <span className="text-sm font-mono text-gray-900">
                            {formatCurrency(accountingEngine.generateStatements().cashFromFinancing)}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between py-3 bg-gray-50 px-3 rounded-lg mt-2">
                        <span className="text-sm font-semibold text-gray-900">Net Change in Cash</span>
                        <span className="text-sm font-mono font-bold text-gray-900">
                          {formatCurrency(
                            accountingEngine.generateStatements().cashFromOperations +
                            accountingEngine.generateStatements().cashFromInvesting +
                            accountingEngine.generateStatements().cashFromFinancing
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Statement of Changes in Equity */}
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">Statement of Changes in Equity</h3>
                        <p className="text-xs text-gray-500">For the year ended 31 December {selectedYear}</p>
                      </div>
                      <button
                        onClick={() => {
                          void generateEquityStatementPDF({
                            year: selectedYear,
                            openingBalance: accountingEngine.generateStatements().equityStatement?.openingBalance || 0,
                            additions: accountingEngine.generateStatements().equityStatement?.additions || 0,
                            netIncome: accountingEngine.generateStatements().equityStatement?.netIncome || 0,
                            drawings: accountingEngine.generateStatements().equityStatement?.drawings || 0,
                            closingBalance: accountingEngine.generateStatements().equityStatement?.closingBalance || 0,
                          }, "CashOS Business");
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Download
                      </button>
                    </div>
                    <div className="space-y-2 max-w-md">
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-600">Opening Balance</span>
                        <span className="text-sm font-mono text-gray-900">
                          {formatCurrency(accountingEngine.generateStatements().equityStatement?.openingBalance || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-600">Add: Capital Introduced</span>
                        <span className="text-sm font-mono text-gray-900">
                          {formatCurrency(accountingEngine.generateStatements().equityStatement?.additions || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-600">Add: Net Income for the Year</span>
                        <span className="text-sm font-mono text-gray-900">
                          {formatCurrency(accountingEngine.generateStatements().equityStatement?.netIncome || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-600">Less: Drawings</span>
                        <span className="text-sm font-mono text-gray-900">
                          ({formatCurrency(accountingEngine.generateStatements().equityStatement?.drawings || 0)})
                        </span>
                      </div>
                      <div className="flex justify-between py-3 bg-gray-50 px-3 rounded-lg mt-2">
                        <span className="text-sm font-semibold text-gray-900">Closing Balance</span>
                        <span className="text-sm font-mono font-bold text-gray-900">
                          {formatCurrency(accountingEngine.generateStatements().equityStatement?.closingBalance || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* All Years Download Section */}
                  <div className="p-6 bg-gray-50">
                    <h3 className="font-semibold text-gray-900 mb-3">Download Yearly Statements</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {availableYears.map((year) => (
                        <button
                          key={year}
                          onClick={() => {
                            void handleDownloadYearlyStatement(year);
                          }}
                          disabled={!yearlyStatements[year]}
                          className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-[#8fff00] hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="text-left">
                            <p className="text-sm font-semibold text-gray-900">{year}</p>
                            <p className="text-xs text-gray-500">{entriesByYear[year]?.length || 0} entries</p>
                          </div>
                          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="px-6 py-12 text-center text-gray-400">
                  <p>No financial data for {selectedYear}</p>
                  <p className="text-xs mt-1">Add transactions to generate statements</p>
                </div>
              )}
            </div>
          )
        }

        {/* Tax Payables */}
        {/* Tax Payables - 2026 Nigerian Tax Analysis Engine */}
        {
          activeTab === "tax-payables" && (
            <div className="divide-y divide-gray-200">
              {(() => {
                // Generate tax schedule using the new 2026 Tax Analyzer
                const taxSchedule = generateTaxSchedule(journalEntries, {
                  isVatRegistered: true, // Configurable later
                  // isSmallCompany is now auto-detected if omitted (based on ₦50M threshold)
                });

                return (
                  <>
                    {/* Header & Controls */}
                    <div className="bg-gray-50 px-4 py-4 sm:px-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h2 className="text-lg font-semibold leading-tight text-gray-900 sm:text-xl">
                            Tax Payables Schedule - {selectedYear}
                          </h2>
                          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-500">
                            Based on 2026 Nigerian Tax Laws (Nigeria Tax Reform Acts)
                          </p>
                        </div>
                      {/* Main Download Button - Consistent with Financial Statements */}
                      <button
                        onClick={async () => {
                          try {
                            console.log("Generating Tax Payables PDF...", taxSchedule);
                            await generateTaxPayablesPDF(taxSchedule, "CashOS Business");
                          } catch (error) {
                            console.error("Failed to generate PDF:", error);
                            alert("Failed to generate PDF. Please try again or check console for details.");
                          }
                        }}
                          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#8fff00] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#6fcc00] sm:w-auto"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Download Schedule
                      </button>
                    </div>
                    </div>

                    {/* Period Summary Section - Accounting Basis */}
                    <div className="mx-4 mt-4 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 sm:mx-6 sm:mt-6 sm:p-5">
                      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700 sm:text-xs">
                        Financial Period Summary (Accounting Basis)
                      </h4>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="min-w-0 rounded-lg border border-blue-100 bg-white/80 p-3">
                          <span className="block text-xs font-medium text-blue-600">Total Revenue</span>
                          <span className="mt-1 block break-words font-mono text-base font-semibold text-gray-900 sm:text-lg">
                            {formatCurrency(taxSchedule.periodSummary.totalRevenue)}
                          </span>
                        </div>
                        <div className="min-w-0 rounded-lg border border-blue-100 bg-white/80 p-3">
                          <span className="block text-xs font-medium text-blue-600">Total Expenses</span>
                          <span className="mt-1 block break-words font-mono text-base font-semibold text-gray-900 sm:text-lg">
                            {formatCurrency(taxSchedule.periodSummary.totalExpenses)}
                          </span>
                        </div>
                        <div className="min-w-0 rounded-lg border border-blue-100 bg-white/80 p-3">
                          <span className="block text-xs font-medium text-blue-600">Payroll Costs</span>
                          <span className="mt-1 block break-words font-mono text-base font-semibold text-gray-900 sm:text-lg">
                            {formatCurrency(taxSchedule.periodSummary.payrollExpense)}
                          </span>
                        </div>
                        <div className="min-w-0 rounded-lg border border-blue-100 bg-white/80 p-3">
                          <span className="block text-xs font-medium text-blue-600">Net Profit (Before Tax)</span>
                          <span className={`mt-1 block break-words font-mono text-base font-bold sm:text-lg ${taxSchedule.periodSummary.netProfitBeforeTax >= 0 ? "text-gray-900" : "text-red-600"}`}>
                            {formatCurrency(taxSchedule.periodSummary.netProfitBeforeTax)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Tax Summary Section - Matches Balance Sheet Layout */}
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="font-semibold text-gray-900">Tax Liability Summary</h3>
                          <p className="text-xs text-gray-500">Breakdown of estimated tax obligations for {selectedYear}</p>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-8">
                        {/* Left Column: Transaction Taxes (Indirect) */}
                        <div>
                          <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-3">Transaction Taxes (VAT/WHT)</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between py-2 border-b border-gray-100">
                              <div className="flex flex-col">
                                <span className="text-sm text-gray-600">Value Added Tax (VAT)</span>
                                <span className="text-[10px] text-gray-400">7.5% on taxable supplies</span>
                              </div>
                              <span className="text-sm font-mono text-gray-900">{formatCurrency(taxSchedule.summary.vatPayable)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-100">
                              <div className="flex flex-col">
                                <span className="text-sm text-gray-600">Withholding Tax (WHT)</span>
                                <span className="text-[10px] text-gray-400">Deducted from payments</span>
                              </div>
                              <span className="text-sm font-mono text-gray-900">{formatCurrency(taxSchedule.summary.whtPayable)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-100">
                              <div className="flex flex-col">
                                <span className="text-sm text-gray-600">Capital Gains Tax (CGT)</span>
                                <span className="text-[10px] text-gray-400">10% on chargeable gains</span>
                              </div>
                              <span className="text-sm font-mono text-gray-900">{formatCurrency(taxSchedule.summary.cgtPayable)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Period Taxes (Direct) */}
                        <div>
                          <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-3">Period Taxes (Profit Based)</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between py-2 border-b border-gray-100">
                              <div className="flex flex-col">
                                <span className="text-sm text-gray-600">Company Income Tax (CIT)</span>
                                <span className={`text-[10px] ${taxSchedule.periodTaxes.citAssessment.applies ? 'text-gray-400' : 'text-blue-600'}`}>
                                  {taxSchedule.periodTaxes.citAssessment.reason}
                                </span>
                              </div>
                              <span className="text-sm font-mono text-gray-900">{formatCurrency(taxSchedule.summary.citPayable)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-100">
                              <div className="flex flex-col">
                                <span className="text-sm text-gray-600">Development Levy</span>
                                <span className={`text-[10px] ${taxSchedule.periodTaxes.devLevyAssessment.applies ? 'text-gray-400' : 'text-blue-600'}`}>
                                  {taxSchedule.periodTaxes.devLevyAssessment.reason}
                                </span>
                              </div>
                              <span className="text-sm font-mono text-gray-900">{formatCurrency(taxSchedule.summary.developmentLevy)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-100">
                              <div className="flex flex-col">
                                <span className="text-sm text-gray-600">PAYE Liability (Est.)</span>
                                <span className="text-[10px] text-gray-400">Based on gross payroll</span>
                              </div>
                              <span className="text-sm font-mono text-gray-900">{formatCurrency(taxSchedule.summary.payePayable)}</span>
                            </div>
                          </div>

                          {/* Total Box */}
                          <div className="flex justify-between py-3 bg-gray-50 px-4 rounded-lg mt-4 border border-gray-100">
                            <span className="text-sm font-semibold text-gray-700">Total Tax Liability</span>
                            <span className="text-sm font-mono font-bold text-rose-700">
                              {formatCurrency(taxSchedule.summary.totalPayable)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Assumptions Footer */}
                      <div className="mt-6 pt-4 border-t border-gray-100">
                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                          {taxSchedule.assumptions.map((assumption, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-xs text-gray-400">
                              <span className="w-1 h-1 rounded-full bg-gray-300" />
                              {assumption}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Trace Table - Only Transaction Taxes */}
                    <div>
                      <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Transaction Tax Trace (VAT / WHT / CGT)</h3>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                            <tr>
                              <th className="px-6 py-3 text-left font-medium w-24">Date</th>
                              <th className="px-6 py-3 text-left font-medium">Transaction</th>
                              <th className="px-6 py-3 text-right font-medium w-32">Amount (₦)</th>
                              <th className="px-6 py-3 text-left font-medium w-64">Applicable Taxes</th>
                              <th className="px-6 py-3 text-right font-medium w-32">Tax Payable (₦)</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                            {taxSchedule.analyses.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-400 text-sm">
                                  <p>No transactions found to analyze</p>
                                </td>
                              </tr>
                            ) : (
                              taxSchedule.analyses.map((analysis) => {
                                const applicableTaxes = analysis.taxAssessments.filter(t => t.applies);
                                const totalTaxForTx = analysis.totalTaxForTransaction;

                                return (
                                  <tr key={analysis.transactionId} className="hover:bg-gray-50">
                                    <td className="px-6 py-3 text-xs text-gray-500 font-mono align-top whitespace-nowrap">
                                      {new Date(analysis.transactionDate).toLocaleDateString("en-NG")}
                                    </td>
                                    <td className="px-6 py-3 text-sm text-gray-900 align-top">
                                      <div className="font-medium text-[10px] text-blue-600 mb-0.5 uppercase tracking-wide">
                                        {analysis.transactionNature.replace(/_/g, " ")}
                                      </div>
                                      <span className="text-gray-700">{analysis.transactionNarration}</span>
                                    </td>
                                    <td className="px-6 py-3 text-sm text-gray-900 text-right align-top font-mono">
                                      {formatCurrency(analysis.transactionAmount)}
                                    </td>
                                    <td className="px-6 py-3 text-xs text-gray-600 align-top">
                                      {applicableTaxes.length > 0 ? (
                                        <div className="space-y-1.5">
                                          {applicableTaxes.map((tax, i) => (
                                            <div key={i} className="flex flex-col">
                                              <div className="flex items-center gap-1.5 font-medium text-gray-700">
                                                <span className={`w-1.5 h-1.5 rounded-full ${tax.taxType === 'VAT' ? 'bg-purple-500' :
                                                  tax.taxType === 'WHT' ? 'bg-orange-500' :
                                                    tax.taxType === 'CGT' ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                                                {tax.taxType} @ {tax.legalRate}
                                              </div>
                                              <span className="text-[10px] text-gray-400 pl-3">{tax.reason}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-gray-300 italic text-[11px]">No transaction tax</span>
                                      )}
                                    </td>
                                    <td className="px-6 py-3 text-sm font-medium text-right align-top font-mono">
                                      {totalTaxForTx !== 0 ? (
                                        <span className={totalTaxForTx > 0 ? "text-rose-600" : "text-blue-600"}>
                                          {formatCurrency(totalTaxForTx)}
                                        </span>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                          <tfoot className="bg-gray-50">
                            <tr>
                              <td colSpan={2} className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">Total Transaction Taxes (VAT/WHT/CGT)</td>
                              <td className="px-6 py-3 text-sm text-right font-mono font-medium text-gray-500">
                                {formatCurrency(taxSchedule.analyses.reduce((sum, a) => sum + a.transactionAmount, 0))}
                              </td>
                              <td className="px-6 py-3"></td>
                              <td className="px-6 py-3 text-sm font-bold text-rose-700 text-right font-mono">
                                {formatCurrency(taxSchedule.summary.vatPayable + taxSchedule.summary.whtPayable + taxSchedule.summary.cgtPayable)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )
        }

        {/* Cashbook */}
        {
          activeTab === "cashbook" && (
            <div className="divide-y divide-gray-200">
              {/* Header */}
              <div className="px-6 py-4 bg-gray-50 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Cashbook - {selectedYear}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">All receipts and payments (Cash & Bank)</p>
                </div>
              </div>

              {(() => {
                // Get all cash transactions (accounts 1000 - Cash, 1010 - Petty Cash, 1020 - Bank, 1021 - Savings)
                const cashAccountCodes = ["1000", "1010", "1020", "1021"];
                const cashTransactions: Array<{
                  date: string;
                  description: string;
                  receipt: number;
                  payment: number;
                  account: string;
                  entryId: string;
                }> = [];

                journalEntries.forEach((entry) => {
                  entry.lines.forEach((line) => {
                    if (cashAccountCodes.includes(line.accountCode)) {
                      cashTransactions.push({
                        date: entry.date,
                        description: entry.narration,
                        receipt: line.debit,
                        payment: line.credit,
                        account: line.accountName,
                        entryId: entry.id,
                      });
                    }
                  });
                });

                // Sort by date
                cashTransactions.sort((a, b) => a.date.localeCompare(b.date));

                // Calculate running balance
                let runningBalance = 0;
                const transactionsWithBalance = cashTransactions.map((tx) => {
                  runningBalance += tx.receipt - tx.payment;
                  return { ...tx, balance: runningBalance };
                });

                const totalReceipts = cashTransactions.reduce((sum, tx) => sum + tx.receipt, 0);
                const totalPayments = cashTransactions.reduce((sum, tx) => sum + tx.payment, 0);

                return (
                  <>
                    {/* Summary Section */}
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">Cash Position Summary</h3>
                          <p className="text-xs text-gray-500">As at <span suppressHydrationWarning>{asAtDateLabel || "—"}</span></p>
                        </div>
                      </div>
                      <div className="space-y-2 max-w-md">
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-sm text-gray-600">Total Receipts</span>
                          <span className="text-sm font-mono text-emerald-600">{formatCurrency(totalReceipts)}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-sm text-gray-600">Total Payments</span>
                          <span className="text-sm font-mono text-rose-600">({formatCurrency(totalPayments)})</span>
                        </div>
                        <div className="flex justify-between py-3 bg-gray-50 px-3 rounded-lg">
                          <span className="text-sm font-semibold text-gray-900">Cash Balance</span>
                          <span className={`text-sm font-mono font-bold ${runningBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {formatCurrency(runningBalance)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Transaction Detail */}
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">Transaction Detail</h3>
                          <p className="text-xs text-gray-500">{cashTransactions.length} transactions</p>
                        </div>
                      </div>
                      <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-emerald-600 uppercase tracking-wider">Receipts</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-rose-600 uppercase tracking-wider">Payments</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {transactionsWithBalance.length > 0 ? (
                              transactionsWithBalance.map((tx, idx) => (
                                <tr key={`${tx.entryId}-${idx}`} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(tx.date)}</td>
                                  <td className="px-4 py-3 text-gray-900 max-w-[250px] truncate">{tx.description}</td>
                                  <td className="px-4 py-3 text-right font-mono text-emerald-600">
                                    {tx.receipt > 0 ? formatCurrency(tx.receipt) : "—"}
                                  </td>
                                  <td className="px-4 py-3 text-right font-mono text-rose-600">
                                    {tx.payment > 0 ? formatCurrency(tx.payment) : "—"}
                                  </td>
                                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
                                    {formatCurrency(tx.balance)}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                  <p>No cash transactions yet</p>
                                  <p className="text-xs mt-1">Post entries with Cash or Bank accounts to see the cashbook</p>
                                </td>
                              </tr>
                            )}
                          </tbody>
                          {transactionsWithBalance.length > 0 && (
                            <tfoot className="bg-gray-900 text-white">
                              <tr>
                                <td colSpan={2} className="px-4 py-3 text-sm font-semibold">Totals</td>
                                <td className="px-4 py-3 text-right font-mono font-semibold">
                                  {formatCurrency(totalReceipts)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-semibold">
                                  {formatCurrency(totalPayments)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold">
                                  {formatCurrency(runningBalance)}
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )
        }
      </div >

      {/* Quick Actions */}
      < div className="flex flex-wrap gap-3" >
        <Link
          href="/accounting"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Accounting Studio
        </Link>
        <button
          type="button"
          onClick={() => {
            void handleDownloadYearlyStatement(selectedYear);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download Statements
        </button>
        <button
          type="button"
          onClick={() => {
            void handleDownloadJournals(selectedYear);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download Journals
        </button>
      </div >
    </div >
  );
}
