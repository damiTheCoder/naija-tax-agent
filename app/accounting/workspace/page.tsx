"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AutomationStatus,
  BANK_PROVIDERS,
  mockAutomationClient,
} from "@/lib/accounting/automationAgent";
import { RawTransaction, StatementDraft } from "@/lib/accounting/types";
import { accountingEngine, AccountingState } from "@/lib/accounting/transactionBridge";
import { JournalEntry, LedgerAccount } from "@/lib/accounting/doubleEntry";

type ActiveTab = "journal" | "ledger" | "trial-balance" | "statements";

export default function WorkspacePage() {
  const [transactions, setTransactions] = useState<RawTransaction[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<Map<string, LedgerAccount>>(new Map());
  const [financialStatements, setFinancialStatements] = useState<StatementDraft | null>(null);
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus>("idle");
  const [automationConfidence, setAutomationConfidence] = useState(0.82);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("journal");
  
  // Date filtering state
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  
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

  const automationConfidencePercent = Math.round(automationConfidence * 100);

  // Download yearly statement as PDF (stub - would need actual PDF generation)
  const handleDownloadYearlyStatement = (year: number) => {
    const statement = yearlyStatements[year];
    if (!statement) return;
    
    // Create a simple text representation for now
    const content = `
FINANCIAL STATEMENTS FOR YEAR ${year}
=====================================

INCOME STATEMENT
----------------
Revenue:                    ₦${statement.revenue.toLocaleString()}
Less: Cost of Sales:       (₦${statement.costOfSales.toLocaleString()})
                           ----------------
Gross Profit:               ₦${statement.grossProfit.toLocaleString()}
Less: Operating Expenses:  (₦${statement.operatingExpenses.toLocaleString()})
                           ----------------
Net Income:                 ₦${statement.netIncome.toLocaleString()}


BALANCE SHEET
-------------
Assets:                     ₦${statement.assets.toLocaleString()}
Liabilities:                ₦${statement.liabilities.toLocaleString()}
Equity:                     ₦${statement.equity.toLocaleString()}

Generated on: ${new Date().toLocaleDateString('en-NG')}
    `;
    
    // Download as text file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-statements-${year}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download journal entries for a year
  const handleDownloadJournals = (year: number) => {
    const entries = entriesByYear[year];
    if (!entries || entries.length === 0) return;
    
    let content = `GENERAL JOURNAL FOR YEAR ${year}\n${'='.repeat(50)}\n\n`;
    
    entries.forEach((entry) => {
      content += `Date: ${entry.date}\n`;
      content += `Entry ID: ${entry.id}\n`;
      content += `Narration: ${entry.narration}\n`;
      content += `${'─'.repeat(40)}\n`;
      content += `Account                          Debit         Credit\n`;
      entry.lines.forEach((line) => {
        const indent = line.credit > 0 ? '  ' : '';
        content += `${indent}${line.accountCode} ${line.accountName.padEnd(25)} ${line.debit > 0 ? '₦' + line.debit.toLocaleString().padStart(10) : ''.padStart(11)} ${line.credit > 0 ? '₦' + line.credit.toLocaleString().padStart(10) : ''}\n`;
      });
      content += `\n`;
    });
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-entries-${year}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Load data from accounting engine
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Load accounting engine state
    accountingEngine.load();
    const state = accountingEngine.getState();
    setJournalEntries(state.journalEntries);
    setLedgerAccounts(state.ledgerAccounts);
    setFinancialStatements(accountingEngine.generateStatements());
    
    // Subscribe to updates
    const unsubscribe = accountingEngine.subscribe((newState) => {
      setJournalEntries(newState.journalEntries);
      setLedgerAccounts(newState.ledgerAccounts);
      setFinancialStatements(accountingEngine.generateStatements());
    });
    
    // Also load raw transactions for display
    const cachedTransactions = window.localStorage.getItem("insight::accounting-transactions");
    if (cachedTransactions) {
      try {
        const parsed = JSON.parse(cachedTransactions);
        if (Array.isArray(parsed)) {
          setTransactions(parsed);
        }
      } catch {
        // ignore malformed cache
      }
    }
    
    const storedConfidence = window.localStorage.getItem("insight::automation-confidence");
    if (storedConfidence) {
      const numeric = parseFloat(storedConfidence);
      if (!Number.isNaN(numeric)) {
        setAutomationConfidence(numeric);
      }
    }
    
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("insight::automation-confidence", automationConfidence.toString());
  }, [automationConfidence]);

  useEffect(() => {
    if (journalEntries.length > 0 && automationStatus === "idle") {
      setAutomationStatus("live");
    }
  }, [journalEntries.length, automationStatus]);

  const handleRefresh = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setAutomationStatus("syncing");
    try {
      const update = await mockAutomationClient.runSync(transactions, BANK_PROVIDERS[0]);
      if (update.generatedTransactions?.length) {
        setTransactions((prev) => [...prev, ...update.generatedTransactions!]);
      }
      setAutomationConfidence((prev) => Math.min(0.99, prev + 0.02));
      setAutomationStatus(update.status);
    } finally {
      setIsSyncing(false);
    }
  };

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
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounting Records</h1>
          <p className="text-sm text-gray-500 mt-1">
            {journalEntries.length > 0 
              ? `${journalEntries.length} journal entries • ${availableYears.length} year(s) of records`
              : "Start adding transactions to build your accounting records"
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-xs">
            <span className={`w-2 h-2 rounded-full ${automationStatus === "live" ? "bg-green-500" : automationStatus === "syncing" ? "bg-amber-500 animate-pulse" : "bg-gray-400"}`}></span>
            <span className="text-gray-600 capitalize">{automationStatus}</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-600">{automationConfidencePercent}% confidence</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-[#0a0a0a] text-white text-sm font-medium rounded-lg hover:bg-[#1a1a1a] disabled:opacity-50 transition-colors"
          >
            <svg className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isSyncing ? "Syncing..." : "Sync"}
          </button>
        </div>
      </div>

      {/* Date Search & Year Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Filter by:</span>
          </div>
          
          {/* Year Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#64B5F6] focus:border-transparent"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          {/* Date Range */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">From:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#64B5F6] focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">To:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-[#64B5F6] focus:border-transparent"
            />
          </div>
          
          {/* Clear Filters */}
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Clear dates
            </button>
          )}
        </div>
        
        {/* Year Summary Cards */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs uppercase tracking-wider text-gray-400 mb-3">Yearly Records Summary</p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {availableYears.map((year) => {
              const yearEntries = entriesByYear[year] || [];
              const yearStatement = yearlyStatements[year];
              const isSelected = year === selectedYear;
              return (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isSelected 
                      ? 'border-[#64B5F6] bg-blue-50 ring-2 ring-[#64B5F6]/20' 
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <p className={`text-lg font-bold ${isSelected ? 'text-[#64B5F6]' : 'text-gray-900'}`}>{year}</p>
                  <p className="text-xs text-gray-500">{yearEntries.length} entries</p>
                  {yearStatement && (
                    <p className={`text-xs mt-1 font-medium ${yearStatement.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₦{Math.abs(yearStatement.netIncome).toLocaleString()}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-[#64B5F6] text-[#64B5F6]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* General Journal - Now showing real double-entry journal entries */}
        {activeTab === "journal" && (
          <div>
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">General Journal - {selectedYear}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{filteredJournalEntries.length} entries {dateFrom || dateTo ? '(filtered)' : ''} • Double-entry format</p>
              </div>
              {filteredJournalEntries.length > 0 && (
                <button
                  onClick={() => handleDownloadJournals(selectedYear)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download {selectedYear}
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              {filteredJournalEntries.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p>No journal entries for {selectedYear}</p>
                    <p className="text-xs">Add transactions in the Accounting Studio to create journal entries</p>
                    <Link href="/accounting" className="mt-2 text-[#64B5F6] text-sm font-medium hover:underline">
                      Go to Accounting Studio →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredJournalEntries.map((entry) => (
                    <div key={entry.id} className="p-4 hover:bg-gray-50/50">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-purple-600 bg-purple-50 px-2 py-0.5 rounded">{entry.id}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${entry.isBalanced ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                              {entry.isBalanced ? '✓ Balanced' : '✗ Unbalanced'}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 mt-1">{entry.narration}</p>
                        </div>
                        <span className="text-xs text-gray-400">{formatDate(entry.date)}</span>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-400 uppercase">
                            <th className="text-left py-1 font-medium">Account</th>
                            <th className="text-right py-1 font-medium w-28">Debit</th>
                            <th className="text-right py-1 font-medium w-28">Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.lines.map((line, idx) => (
                            <tr key={idx} className="border-t border-gray-50">
                              <td className={`py-2 text-gray-700 ${line.credit > 0 ? 'pl-6' : ''}`}>
                                <span className="text-xs text-gray-400 mr-2">{line.accountCode}</span>
                                {line.accountName}
                              </td>
                              <td className="py-2 text-right font-mono text-gray-900">
                                {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                              </td>
                              <td className="py-2 text-right font-mono text-gray-900">
                                {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t border-gray-200 font-semibold">
                            <td className="py-2 text-gray-600">Total</td>
                            <td className="py-2 text-right font-mono">{formatCurrency(entry.totalDebits)}</td>
                            <td className="py-2 text-right font-mono">{formatCurrency(entry.totalCredits)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* General Ledger - Now showing real ledger accounts */}
        {activeTab === "ledger" && (
          <div>
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-900">General Ledger</h2>
              <p className="text-xs text-gray-500 mt-0.5">{activeLedgerAccounts.length} accounts with activity</p>
            </div>
            {activeLedgerAccounts.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400">
                <p>No ledger accounts with activity</p>
                <p className="text-xs mt-1">Post journal entries to see ledger activity</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {activeLedgerAccounts.map(([code, account]) => (
                  <div key={code} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-400">{account.accountCode}</span>
                          <h3 className="font-semibold text-gray-900">{account.accountName}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded capitalize ${
                            account.accountType === 'asset' ? 'bg-blue-50 text-blue-600' :
                            account.accountType === 'liability' ? 'bg-orange-50 text-orange-600' :
                            account.accountType === 'equity' ? 'bg-purple-50 text-purple-600' :
                            account.accountType === 'income' ? 'bg-green-50 text-green-600' :
                            'bg-red-50 text-red-600'
                          }`}>{account.accountType}</span>
                        </div>
                        <p className="text-xs text-gray-500">{account.entries.length} entries</p>
                      </div>
                      <div className={`text-lg font-semibold ${
                        account.accountType === 'asset' || account.accountType === 'expense' 
                          ? (account.closingBalance >= 0 ? 'text-gray-900' : 'text-red-600')
                          : (account.closingBalance >= 0 ? 'text-green-600' : 'text-red-600')
                      }`}>
                        {formatCurrency(account.closingBalance)}
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100">
                          <th className="text-left py-2 font-medium">Date</th>
                          <th className="text-left py-2 font-medium">Description</th>
                          <th className="text-right py-2 font-medium">Debit</th>
                          <th className="text-right py-2 font-medium">Credit</th>
                          <th className="text-right py-2 font-medium">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {account.entries.slice(-5).map((entry, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="py-2 text-gray-600">{formatDate(entry.date)}</td>
                            <td className="py-2 text-gray-900">{entry.narration}</td>
                            <td className="py-2 text-right font-mono text-gray-700">
                              {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                            </td>
                            <td className="py-2 text-right font-mono text-gray-700">
                              {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                            </td>
                            <td className="py-2 text-right font-mono font-semibold text-gray-900">
                              {formatCurrency(entry.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {account.entries.length > 5 && (
                      <p className="text-xs text-gray-400 mt-2 text-center">
                        Showing last 5 of {account.entries.length} entries
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Trial Balance - Using real accounting engine data */}
        {activeTab === "trial-balance" && (
          <div>
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Trial Balance</h2>
                <p className="text-xs text-gray-500 mt-0.5">As at {new Date().toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
              <div className={`text-xs font-medium px-2 py-1 rounded ${Math.abs(trialBalance.totals.debit - trialBalance.totals.credit) < 0.01 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                {Math.abs(trialBalance.totals.debit - trialBalance.totals.credit) < 0.01 ? "✓ Balanced" : "⚠ Unbalanced"}
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
        )}

        {/* Financial Statements - Yearly statements with download */}
        {activeTab === "statements" && (
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
                  onClick={() => handleDownloadYearlyStatement(selectedYear)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#64B5F6] rounded-lg hover:bg-[#4A9FD9] transition-colors"
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
                  <h3 className="font-semibold text-gray-900 mb-1">Income Statement</h3>
                  <p className="text-xs text-gray-500 mb-4">For the year ended 31 December {selectedYear}</p>
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
                      <span className={`text-sm font-mono font-bold ${yearlyStatements[selectedYear].netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(yearlyStatements[selectedYear].netIncome)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Balance Sheet */}
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-1">Balance Sheet</h3>
                  <p className="text-xs text-gray-500 mb-4">As at 31 December {selectedYear}</p>
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

                {/* All Years Download Section */}
                <div className="p-6 bg-gray-50">
                  <h3 className="font-semibold text-gray-900 mb-3">Download Yearly Statements</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {availableYears.map((year) => (
                      <button
                        key={year}
                        onClick={() => handleDownloadYearlyStatement(year)}
                        disabled={!yearlyStatements[year]}
                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-[#64B5F6] hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
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
          onClick={() => handleDownloadYearlyStatement(selectedYear)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download Statements
        </button>
        <button
          type="button"
          onClick={() => handleDownloadJournals(selectedYear)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download Journals
        </button>
      </div>
    </div>
  );
}
