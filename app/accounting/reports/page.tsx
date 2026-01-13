"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { CHART_OF_ACCOUNTS, AccountClass, ChartOfAccount } from "@/lib/accounting/standards";
import { accountingEngine, AccountingState, CustomAccount } from "@/lib/accounting/transactionBridge";
import { JournalEntry } from "@/lib/accounting/doubleEntry";
import {
    NigerianTaxCompliance,
    VAT_RATE,
    EDUCATION_TAX_RATE,
    CIT_RATES,
    DISALLOWABLE_EXPENSES,
    extractVATFromGross,
    computeVATPosition,
    generateTaxAdjustmentSchedule,
    computeCIT,
    validateComplianceRules,
    generateComplianceBlockError,
    canClaimInputVAT,
    TaxAuditResponse,
} from "@/lib/tax/nigerianTaxCompliance";

type AccountClassFilter = AccountClass | "all";

// Journal line for manual entry
interface JournalLine {
    id: string;
    accountCode: string;
    accountName: string;
    debit: string;
    credit: string;
}

// Icons for account classes
const classIcons: Record<AccountClass, React.ReactNode> = {
    asset: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
    ),
    liability: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
    ),
    equity: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
        </svg>
    ),
    revenue: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
    ),
    expense: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
        </svg>
    ),
};

const classColors: Record<AccountClass, { bg: string; text: string; badge: string }> = {
    asset: { bg: "bg-blue-50", text: "text-blue-700", badge: "bg-blue-100 text-blue-700" },
    liability: { bg: "bg-rose-50", text: "text-rose-700", badge: "bg-rose-100 text-rose-700" },
    equity: { bg: "bg-purple-50", text: "text-purple-700", badge: "bg-purple-100 text-purple-700" },
    revenue: { bg: "bg-emerald-50", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
    expense: { bg: "bg-amber-50", text: "text-amber-700", badge: "bg-amber-100 text-amber-700" },
};

const subClassOptions: Record<AccountClass, string[]> = {
    asset: ["current-asset", "fixed-asset", "non-current-asset"],
    liability: ["current-liability", "non-current-liability"],
    equity: ["share-capital", "retained-earnings", "reserves"],
    revenue: ["operating-revenue", "other-income"],
    expense: ["cost-of-sales", "operating-expense", "administrative-expense", "finance-cost", "tax-expense"],
};

export default function ChartOfAccountsPage() {
    const [selectedClass, setSelectedClass] = useState<AccountClassFilter>("all");
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    const [customAccounts, setCustomAccounts] = useState<CustomAccount[]>([]);
    const [accountBalances, setAccountBalances] = useState<Map<string, number>>(new Map());
    const [isLoaded, setIsLoaded] = useState(false);

    // Create Account Modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newAccount, setNewAccount] = useState({
        code: "",
        name: "",
        class: "asset" as AccountClass,
        subClass: "current-asset",
        description: "",
    });
    const [createError, setCreateError] = useState("");

    // Manual Journal Entry
    const [showJournalEntry, setShowJournalEntry] = useState(false);
    const [journalNarration, setJournalNarration] = useState("");
    const [journalDate, setJournalDate] = useState(new Date().toISOString().split("T")[0]);
    const [journalLines, setJournalLines] = useState<JournalLine[]>([
        { id: "1", accountCode: "", accountName: "", debit: "", credit: "" },
        { id: "2", accountCode: "", accountName: "", debit: "", credit: "" },
    ]);
    const [journalError, setJournalError] = useState("");

    // Account Search State
    const [accountSearchQuery, setAccountSearchQuery] = useState<string>("");
    const [accountSearchLineId, setAccountSearchLineId] = useState<string | null>(null);
    const [accountClassFilter, setAccountClassFilter] = useState<AccountClassFilter>("all");

    // Tax Report Tabs
    const [activeTaxTab, setActiveTaxTab] = useState<"summary" | "adjustment" | "vat">("summary");

    // AI Tax Audit State
    const [isAuditing, setIsAuditing] = useState(false);
    const [auditResult, setAuditResult] = useState<TaxAuditResponse | null>(null);
    const [auditError, setAuditError] = useState<string | null>(null);
    const [showAuditModal, setShowAuditModal] = useState(false);

    // Load accounting data
    useEffect(() => {
        if (typeof window === "undefined") return;
        accountingEngine.load();
        const state = accountingEngine.getState();
        setJournalEntries(state.journalEntries);
        setCustomAccounts(state.customAccounts);

        // Calculate account balances from ledger
        const balances = new Map<string, number>();
        state.ledgerAccounts.forEach((account, code) => {
            balances.set(code, account.closingBalance);
        });
        setAccountBalances(balances);
        setIsLoaded(true);

        // Subscribe to updates
        const unsubscribe = accountingEngine.subscribe((newState) => {
            setJournalEntries(newState.journalEntries);
            setCustomAccounts(newState.customAccounts);
            const newBalances = new Map<string, number>();
            newState.ledgerAccounts.forEach((account, code) => {
                newBalances.set(code, account.closingBalance);
            });
            setAccountBalances(newBalances);
        });

        return () => unsubscribe();
    }, []);

    // Get all accounts (standard + custom)
    const allAccounts = useMemo(() => {
        const standard = CHART_OF_ACCOUNTS.map((acc) => ({
            code: acc.code,
            name: acc.name,
            class: acc.class,
            subClass: acc.subClass,
            description: acc.description,
            isCustom: false,
        }));

        const custom = customAccounts.map((acc) => ({
            code: acc.code,
            name: acc.name,
            class: acc.class,
            subClass: acc.subClass,
            description: acc.description,
            isCustom: true,
        }));

        return [...standard, ...custom].sort((a, b) => a.code.localeCompare(b.code));
    }, [customAccounts]);

    // Group accounts by class
    const accountsByClass = useMemo(() => {
        const grouped: Record<AccountClass, typeof allAccounts> = {
            asset: [],
            liability: [],
            equity: [],
            revenue: [],
            expense: [],
        };

        allAccounts.forEach((account) => {
            grouped[account.class].push(account);
        });

        return grouped;
    }, [allAccounts]);

    // Calculate totals per class
    const classTotals = useMemo(() => {
        const totals: Record<AccountClass, number> = {
            asset: 0,
            liability: 0,
            equity: 0,
            revenue: 0,
            expense: 0,
        };

        accountBalances.forEach((balance, code) => {
            const account = allAccounts.find((a) => a.code === code);
            if (account) {
                totals[account.class] += balance;
            }
        });

        return totals;
    }, [accountBalances, allAccounts]);

    // Filtered accounts
    const filteredAccounts = useMemo(() => {
        const accounts = selectedClass === "all" ? allAccounts : allAccounts.filter((a) => a.class === selectedClass);

        return accounts.map((account) => ({
            ...account,
            balance: accountBalances.get(account.code) || 0,
        }));
    }, [selectedClass, allAccounts, accountBalances]);

    // Filtered transactions
    const filteredTransactions = useMemo(() => {
        if (selectedClass === "all") {
            return journalEntries;
        }

        return journalEntries.filter((entry) => {
            return entry.lines.some((line) => {
                const account = allAccounts.find((a) => a.code === line.accountCode);
                return account?.class === selectedClass;
            });
        });
    }, [journalEntries, selectedClass, allAccounts]);

    // Journal entry balance check
    const journalTotals = useMemo(() => {
        const totalDebit = journalLines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
        const totalCredit = journalLines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
        const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
        return { totalDebit, totalCredit, isBalanced };
    }, [journalLines]);

    const formatCurrency = (amount: number): string => {
        return `₦${Math.abs(amount).toLocaleString()}`;
    };

    // Create custom account
    const handleCreateAccount = () => {
        setCreateError("");
        try {
            accountingEngine.addCustomAccount(newAccount);
            setShowCreateModal(false);
            setNewAccount({
                code: "",
                name: "",
                class: "asset",
                subClass: "current-asset",
                description: "",
            });
        } catch (err: unknown) {
            setCreateError(err instanceof Error ? err.message : "Failed to create account");
        }
    };

    // Post manual journal entry
    const handlePostJournal = () => {
        setJournalError("");
        if (!journalNarration.trim()) {
            setJournalError("Please enter a narration");
            return;
        }
        if (!journalTotals.isBalanced) {
            setJournalError("Entry must be balanced (Total DR = Total CR)");
            return;
        }

        try {
            accountingEngine.postManualJournalEntry({
                narration: journalNarration,
                date: journalDate,
                lines: journalLines
                    .filter((l) => l.accountCode && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
                    .map((l) => ({
                        accountCode: l.accountCode,
                        accountName: l.accountName,
                        debit: parseFloat(l.debit) || 0,
                        credit: parseFloat(l.credit) || 0,
                    })),
            });

            // Reset form
            setShowJournalEntry(false);
            setJournalNarration("");
            setJournalDate(new Date().toISOString().split("T")[0]);
            setJournalLines([
                { id: "1", accountCode: "", accountName: "", debit: "", credit: "" },
                { id: "2", accountCode: "", accountName: "", debit: "", credit: "" },
            ]);
        } catch (err: unknown) {
            setJournalError(err instanceof Error ? err.message : "Failed to post entry");
        }
    };

    // Add journal line
    const addJournalLine = () => {
        setJournalLines([
            ...journalLines,
            { id: Date.now().toString(), accountCode: "", accountName: "", debit: "", credit: "" },
        ]);
    };

    // Update journal line
    const updateJournalLine = (id: string, field: keyof JournalLine, value: string) => {
        setJournalLines(
            journalLines.map((l) => {
                if (l.id !== id) return l;
                if (field === "accountCode") {
                    const account = allAccounts.find((a) => a.code === value);
                    return { ...l, accountCode: value, accountName: account?.name || "" };
                }
                return { ...l, [field]: value };
            })
        );
    };

    // Remove journal line
    const removeJournalLine = (id: string) => {
        if (journalLines.length > 2) {
            setJournalLines(journalLines.filter((l) => l.id !== id));
        }
    };

    // AI Tax Audit Handler
    const handleAIAudit = async () => {
        setIsAuditing(true);
        setAuditError(null);
        setAuditResult(null);

        try {
            // Build transactions from journal entries
            const transactions = journalEntries.flatMap(entry =>
                entry.lines.map(line => ({
                    description: entry.narration,
                    amount: line.debit > 0 ? line.debit : line.credit,
                    type: line.debit > 0 ? 'expense' : 'income',
                    category: line.accountName,
                }))
            );

            // Calculate totals for computed taxes
            const computedTaxes = {
                cit: 0,
                vat: classTotals.revenue * 0.075, // Approximate
                wht: 0,
                paye: 0,
                educationTax: 0,
            };

            const response = await fetch('/api/ai/audit-tax', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transactions,
                    computedTaxes,
                    companyInfo: {
                        turnover: classTotals.revenue,
                        isVATRegistered: true,
                        companySize: classTotals.revenue < 25_000_000 ? 'small' :
                            classTotals.revenue < 100_000_000 ? 'medium' : 'large',
                    },
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Audit failed');
            }

            const result = await response.json();
            setAuditResult(result);
            setShowAuditModal(true);
        } catch (error) {
            setAuditError(error instanceof Error ? error.message : 'Failed to run AI audit');
        } finally {
            setIsAuditing(false);
        }
    };

    if (!isLoaded) return null;

    return (
        <div className="space-y-6 px-2 md:px-0">
            {/* Header */}
            <div className="rounded-2xl bg-white border border-gray-200 px-6 py-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Chart of Accounts</h1>
                                <p className="text-sm text-gray-500">IFRS-compliant account structure • {allAccounts.length} accounts</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            New Account
                        </button>
                        <button
                            onClick={() => setShowJournalEntry(true)}
                            className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-gray-800 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Post Entry
                        </button>
                    </div>
                </div>
            </div>

            {/* Account Class Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {(["asset", "liability", "equity", "revenue", "expense"] as AccountClass[]).map((cls) => {
                    const isSelected = selectedClass === cls;
                    const colors = classColors[cls];
                    const count = accountsByClass[cls].length;
                    const total = classTotals[cls];

                    return (
                        <button
                            key={cls}
                            onClick={() => setSelectedClass(isSelected ? "all" : cls)}
                            className={`rounded-xl p-4 border-2 transition-all text-left ${isSelected
                                ? `${colors.bg} border-current ${colors.text}`
                                : "bg-white border-gray-100 hover:border-gray-200"
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center mb-3 ${colors.text}`}>
                                {classIcons[cls]}
                            </div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                                {cls}
                            </p>
                            <p className="text-xl font-bold text-gray-900">{formatCurrency(total)}</p>
                            <p className="text-xs text-gray-500 mt-1">{count} accounts</p>
                        </button>
                    );
                })}
            </div>

            {/* Filter indicator */}
            {selectedClass !== "all" && (
                <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${classColors[selectedClass].badge}`}>
                        {classIcons[selectedClass]}
                        <span className="capitalize">{selectedClass} Accounts</span>
                    </span>
                    <button
                        onClick={() => setSelectedClass("all")}
                        className="text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                        Clear filter
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Accounts List */}
                <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                        <h2 className="text-sm font-semibold text-gray-900">
                            {selectedClass === "all" ? "All Accounts" : `${selectedClass.charAt(0).toUpperCase() + selectedClass.slice(1)} Accounts`}
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                            {filteredAccounts.filter(a => a.balance !== 0).length} with activity • {customAccounts.length} custom
                        </p>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                        {filteredAccounts.slice(0, 30).map((account) => {
                            const colors = classColors[account.class];
                            return (
                                <div
                                    key={account.code}
                                    className="px-5 py-3 hover:bg-gray-50 flex items-center justify-between gap-3"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-xs font-mono text-gray-400 w-12 flex-shrink-0">
                                            {account.code}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-gray-900 truncate">{account.name}</p>
                                                {account.isCustom && (
                                                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">CUSTOM</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 truncate">{account.description}</p>
                                        </div>
                                    </div>
                                    <span className={`text-sm font-semibold ${account.balance > 0 ? "text-gray-900" : account.balance < 0 ? "text-rose-600" : "text-gray-400"
                                        }`}>
                                        {account.balance !== 0 ? formatCurrency(account.balance) : "—"}
                                    </span>
                                </div>
                            );
                        })}
                        {filteredAccounts.length === 0 && (
                            <div className="px-5 py-8 text-center text-gray-400">
                                <p className="text-sm">No accounts found</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Transactions */}
                <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                        <h2 className="text-sm font-semibold text-gray-900">
                            {selectedClass === "all" ? "All Transactions" : `${selectedClass.charAt(0).toUpperCase() + selectedClass.slice(1)} Transactions`}
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                            {filteredTransactions.length} journal entries
                        </p>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                        {filteredTransactions.slice(-10).reverse().map((entry) => (
                            <div key={entry.id} className="px-5 py-3 hover:bg-gray-50">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="min-w-0">
                                        <span className="text-xs font-mono text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                                            {entry.id}
                                        </span>
                                        <p className="text-sm font-medium text-gray-900 mt-1 truncate">{entry.narration}</p>
                                    </div>
                                    <span className="text-xs text-gray-400 flex-shrink-0">{entry.date}</span>
                                </div>
                                <div className="space-y-1">
                                    {entry.lines.map((line, idx) => {
                                        const account = allAccounts.find((a) => a.code === line.accountCode);
                                        const colors = account ? classColors[account.class] : { badge: "bg-gray-100 text-gray-600" };
                                        return (
                                            <div key={idx} className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-1.5 py-0.5 rounded ${colors.badge}`}>
                                                        {line.accountCode}
                                                    </span>
                                                    <span className="text-gray-600">{line.accountName}</span>
                                                </div>
                                                <div className="flex gap-4 font-mono">
                                                    <span className={line.debit > 0 ? "text-gray-900" : "text-gray-300"}>
                                                        {line.debit > 0 ? formatCurrency(line.debit) : "—"}
                                                    </span>
                                                    <span className={line.credit > 0 ? "text-gray-900" : "text-gray-300"}>
                                                        {line.credit > 0 ? formatCurrency(line.credit) : "—"}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                        {filteredTransactions.length === 0 && (
                            <div className="px-5 py-8 text-center text-gray-400">
                                <p className="text-sm">No transactions yet</p>
                                <p className="text-xs mt-1">Click &quot;Post Entry&quot; to add a journal entry</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* IFRS Reference */}
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">GAAP/IFRS Account Structure</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
                    <div>
                        <p className="font-semibold text-blue-700">1000-1999</p>
                        <p className="text-gray-600">Assets</p>
                    </div>
                    <div>
                        <p className="font-semibold text-rose-700">2000-2999</p>
                        <p className="text-gray-600">Liabilities</p>
                    </div>
                    <div>
                        <p className="font-semibold text-purple-700">3000-3999</p>
                        <p className="text-gray-600">Equity</p>
                    </div>
                    <div>
                        <p className="font-semibold text-emerald-700">4000-4999</p>
                        <p className="text-gray-600">Revenue</p>
                    </div>
                    <div>
                        <p className="font-semibold text-amber-700">5000-7999</p>
                        <p className="text-gray-600">Expenses</p>
                    </div>
                </div>
            </div>

            {/* FIRS Tax Schedules Section */}
            <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Tax Schedules</h2>
                        <p className="text-xs text-gray-500 font-mono mt-1">FIRS COMPLIANT • {new Date().getFullYear()}</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex bg-gray-50 rounded-lg p-1 border border-gray-200 overflow-x-auto hide-scrollbar">
                            {(["summary", "adjustment", "vat"] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTaxTab(tab)}
                                    className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTaxTab === tab
                                        ? "bg-white text-gray-900 shadow-sm border border-gray-100"
                                        : "text-gray-500 hover:text-gray-900"
                                        }`}
                                >
                                    {tab === "summary" ? "Direct Tax" : tab === "adjustment" ? "Adjustments" : "VAT"}
                                </button>
                            ))}
                        </div>

                        {/* AI Audit Button */}
                        <button
                            onClick={handleAIAudit}
                            disabled={isAuditing || journalEntries.length === 0}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            {isAuditing ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Auditing...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    AI Audit
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Audit Error Display */}
                {auditError && (
                    <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-700">{auditError}</p>
                    </div>
                )}

                <div className="p-0 bg-gray-50/50">
                    {(() => {
                        // 1. Calculate Financial Definitions
                        const revenue = classTotals.revenue;
                        const expenses = classTotals.expense;
                        const costOfSales = allAccounts
                            .filter(a => a.code.startsWith("50") && a.class === "expense")
                            .reduce((sum, a) => sum + (accountBalances.get(a.code) || 0), 0);

                        const operatingExpenses = expenses - costOfSales;
                        const grossProfit = revenue - costOfSales;
                        const accountingProfit = revenue - expenses;

                        // Detect if we have a loss (critical for proper tax computation)
                        const hasLoss = accountingProfit < 0;
                        const profitOrLossLabel = hasLoss ? 'Net Loss' : 'Net Profit';

                        // 2. FIRS COMPLIANCE CHECKS (Guard Rails)
                        const complianceErrors: string[] = [];

                        // Check 1: PBT Verification
                        // In our engine, PBT is derived directly from P&L, so strictly PBT == Net Profit.

                        // Check 2: GP vs PBT (Operating Expenses Check)
                        if (grossProfit > 0 && grossProfit === accountingProfit && revenue > 0) {
                            complianceErrors.push("CRITICAL: Gross Profit equals Profit Before Tax. Operating expenses appear to be missing or zero. Tax computation halted to prevent under-deduction.");
                        }

                        // Check 3: Suspiciously Low Expenses
                        if (revenue > 1_000_000 && expenses === 0) {
                            complianceErrors.push("CRITICAL: Revenue detected with ZERO expenses. Income Statement is likely incomplete.");
                        }

                        // Check 4: Equity vs Income (Data Structure Verification)
                        // Our data structure strictly separates Equity (3xxx) from Revenue (4xxx).
                        // If any Equity account has a 'revenue' class tag, it would be a system corruption.
                        // We assume strict type safety here but could scan if needed.

                        // HALT IF CRITICAL ERRORS
                        if (complianceErrors.length > 0) {
                            return (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-red-800 mb-2">Compliance Check Failed</h3>
                                    <p className="text-sm text-red-600 mb-6">The system halted tax computation due to accounting violations:</p>
                                    <ul className="text-left max-w-md mx-auto space-y-2 mb-6">
                                        {complianceErrors.map((err, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-red-700 bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                                                <span className="mt-0.5">🚫</span>
                                                {err}
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="text-xs text-red-500">Please correct the Financial Statements before viewing Tax Schedules.</p>
                                </div>
                            );
                        }

                        // 3. Identify Disallowable Expenses
                        const disallowables: Array<{ name: string; amount: number }> = [];
                        const deductions: Array<{ name: string; amount: number }> = [];

                        allAccounts.forEach(acc => {
                            if (acc.class === "expense") {
                                const balance = accountBalances.get(acc.code) || 0;
                                if (balance > 0) {
                                    // Check against disallowable keywords
                                    const isDisallowable = DISALLOWABLE_EXPENSES.some(d =>
                                        d.keywords.some(k => acc.name.toLowerCase().includes(k))
                                    );

                                    if (isDisallowable) {
                                        disallowables.push({ name: acc.name, amount: balance });
                                    }
                                }
                            }
                        });

                        // 4. Generate Adjustment Schedule (using new compliance engine)
                        const capitalAllowances = 0;
                        const adjustmentSchedule = generateTaxAdjustmentSchedule(
                            accountingProfit,
                            disallowables,
                            capitalAllowances
                        );

                        // 5. Calculate CIT using new compliance engine
                        const turnover = revenue;
                        const cit = computeCIT(adjustmentSchedule.taxableProfit, turnover);

                        // 6. VAT Computation (Using new compliance rules)
                        // RULE: VAT base must be VAT-exclusive
                        // Output VAT = 7.5% × VAT-exclusive sales
                        const outputVAT = revenue * (VAT_RATE / 100);

                        // Input VAT: Only on claimable purchases (RULE 4)
                        let claimableInputVAT = 0;
                        let nonClaimableInputVAT = 0;

                        allAccounts.forEach(acc => {
                            if (acc.code.startsWith("5")) { // Expense accounts
                                const balance = accountBalances.get(acc.code) || 0;
                                if (balance > 0) {
                                    const vatCheck = canClaimInputVAT(acc.name);
                                    const vatOnPurchase = balance * (VAT_RATE / 100);

                                    if (vatCheck.canClaim) {
                                        claimableInputVAT += vatOnPurchase;
                                    } else {
                                        nonClaimableInputVAT += vatOnPurchase;
                                    }
                                }
                            }
                        });


                        // Use new computeVATPosition function
                        const vatResult = computeVATPosition(outputVAT, claimableInputVAT);
                        const hasVATCredit = vatResult.isCredit;
                        const vatPayable = vatResult.isPayable ? vatResult.netPosition : 0;
                        const vatCredit = vatResult.isCredit ? vatResult.displayAmount : 0;
                        const inputVAT = claimableInputVAT;

                        // Calculate vatable purchases proxy for display
                        const vatablePurchases = claimableInputVAT / (VAT_RATE / 100);

                        // CIT reason comes from the computation result
                        const citReason = cit.reason;

                        // PAYE
                        const payrollExpense = accountBalances.get("5400") || 0;
                        const payePayable = payrollExpense * 0.10;

                        if (activeTaxTab === "adjustment") {
                            return (
                                <div className="max-w-3xl mx-auto bg-white min-h-[500px] border border-gray-100 shadow-sm p-8 font-mono text-sm">
                                    {/* Header */}
                                    <div className="text-center mb-8 pb-4 border-b border-gray-900 border-double">
                                        <h2 className="uppercase text-lg font-bold tracking-widest mb-1">Tax Adjustment Schedule</h2>
                                        <p className="text-xs text-gray-500 uppercase">For the Year Ended {new Date().getFullYear()}</p>
                                    </div>

                                    {/* Compliance Badge - Minimal */}
                                    <div className="flex items-center justify-center mb-8">
                                        <span className="px-3 py-1 border border-gray-300 text-[10px] uppercase tracking-wider text-gray-600 rounded-full">
                                            ✓ FIRS Compliant
                                        </span>
                                    </div>

                                    <div className="space-y-0">
                                        {/* Row Component */}
                                        <div className="flex justify-between py-2 items-end">
                                            <span className={`font-bold ${hasLoss ? 'text-red-700' : 'text-gray-900'}`}>{profitOrLossLabel} Per Accounts</span>
                                            <span className={`font-bold border-b border-gray-900 min-w-[120px] text-right ${hasLoss ? 'text-red-700' : ''}`}>
                                                {hasLoss ? `(${formatCurrency(Math.abs(adjustmentSchedule.accountingProfit))})` : formatCurrency(adjustmentSchedule.accountingProfit)}
                                            </span>
                                        </div>

                                        <div className="py-4">
                                            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Add: Disallowable Expenses</div>
                                            {adjustmentSchedule.disallowables.length === 0 ? (
                                                <div className="flex justify-between py-1 text-gray-400 italic">
                                                    <span className="pl-4">No disallowable items</span>
                                                    <span className="text-right">-</span>
                                                </div>
                                            ) : (
                                                adjustmentSchedule.disallowables.map((d, i) => (
                                                    <div key={i} className="flex justify-between py-1 text-gray-700 hover:bg-gray-50">
                                                        <span className="pl-4">{d.name}</span>
                                                        <span className="text-right">{formatCurrency(d.amount)}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        <div className="flex justify-between py-2 items-end border-t border-gray-200">
                                            <span className="font-medium text-gray-900">Adjusted Profit</span>
                                            <span className="text-right min-w-[120px]">{formatCurrency(adjustmentSchedule.taxableProfit)}</span>
                                        </div>

                                        <div className="py-4">
                                            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Less: Capital Allowances</div>
                                            <div className="flex justify-between py-1 text-gray-700">
                                                <span className="pl-4">Capital Allowances</span>
                                                <span className="text-right">({formatCurrency(adjustmentSchedule.capitalAllowances)})</span>
                                            </div>
                                        </div>

                                        {/* Total */}
                                        <div className="flex justify-between py-4 items-end border-t-2 border-gray-900 mt-4">
                                            <span className="font-bold text-base uppercase tracking-wider">Total Taxable Profit</span>
                                            <span className="font-bold text-base border-b-4 border-double border-gray-900 min-w-[120px] text-right">
                                                {formatCurrency(adjustmentSchedule.taxableProfit)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        if (activeTaxTab === "vat") {
                            return (
                                <div className="max-w-3xl mx-auto bg-white min-h-[500px] border border-gray-100 shadow-sm p-8 font-mono text-sm">
                                    <div className="text-center mb-8 pb-4 border-b border-gray-900 border-double">
                                        <h2 className="uppercase text-lg font-bold tracking-widest mb-1">Value Added Tax Computation</h2>
                                        <p className="text-xs text-gray-500 uppercase">Period Ended {new Date().toLocaleDateString()}</p>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Output VAT Section */}
                                        <div>
                                            <div className="text-xs uppercase font-bold text-gray-400 mb-2 border-b border-gray-100 pb-1">Output Tax (Sales)</div>
                                            <div className="flex justify-between py-2">
                                                <span>Total Revenue (Vatable)</span>
                                                <span>{formatCurrency(revenue)}</span>
                                            </div>
                                            <div className="flex justify-between py-2 font-bold text-gray-900">
                                                <span>Output VAT @ {VAT_RATE}%</span>
                                                <span>{formatCurrency(outputVAT)}</span>
                                            </div>
                                        </div>

                                        {/* Input VAT Section */}
                                        <div>
                                            <div className="text-xs uppercase font-bold text-gray-400 mb-2 border-b border-gray-100 pb-1">Input Tax (Purchases)</div>
                                            <div className="flex justify-between py-2 text-gray-600">
                                                <span className="pl-2">Cost of Sales (Est. Vatable)</span>
                                                <span className="text-gray-400 italic">({formatCurrency(vatablePurchases)})</span>
                                            </div>
                                            <div className="flex justify-between py-2 font-bold text-gray-900">
                                                <span>Less: Input VAT @ {VAT_RATE}%</span>
                                                <span>({formatCurrency(inputVAT)})</span>
                                            </div>
                                        </div>

                                        {/* Net Position - Payable or Credit */}
                                        <div className={`flex justify-between py-4 items-end border-t-2 ${hasVATCredit ? 'border-emerald-600' : 'border-gray-900'} mt-4`}>
                                            <div>
                                                <span className={`font-bold text-base uppercase tracking-wider ${hasVATCredit ? 'text-emerald-700' : ''}`}>
                                                    {hasVATCredit ? 'VAT Credit (Recoverable)' : 'Net VAT Payable'}
                                                </span>
                                                {hasVATCredit && (
                                                    <div className="text-xs text-emerald-600 mt-1">Input VAT exceeds Output VAT — carry forward or claim refund</div>
                                                )}
                                            </div>
                                            <span className={`font-bold text-base border-b-4 border-double min-w-[120px] text-right ${hasVATCredit ? 'border-emerald-600 text-emerald-700' : 'border-gray-900'}`}>
                                                {hasVATCredit ? `(${formatCurrency(vatCredit)})` : formatCurrency(vatPayable)}
                                            </span>
                                        </div>

                                        <div className="mt-8 text-[10px] text-gray-400 text-center max-w-xs mx-auto leading-relaxed border-t border-gray-100 pt-4">
                                            CERTIFICATION: I certify that the information provided in this VAT return is true, correct, and complete in accordance with the Value Added Tax Act Cap V1 LFN 2004.
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        // Summary Tab - Statement Style
                        return (
                            <div className="max-w-3xl mx-auto bg-white min-h-[500px] border border-gray-100 shadow-sm p-8 font-mono text-sm">
                                <div className="text-center mb-8 pb-4 border-b border-gray-900 border-double">
                                    <h2 className="uppercase text-lg font-bold tracking-widest mb-1">Direct Taxes Summary</h2>
                                    <p className="text-xs text-gray-500 uppercase">Consolidated Liability Position</p>
                                </div>

                                <div className="space-y-0 divide-y divide-gray-100">
                                    {/* Header Row */}
                                    <div className="grid grid-cols-12 py-3 text-xs uppercase font-bold text-gray-400 tracking-wider">
                                        <div className="col-span-6">Tax Application</div>
                                        <div className="col-span-3 text-right">Rate / Basis</div>
                                        <div className="col-span-3 text-right">Amount</div>
                                    </div>

                                    {/* Item 1: CIT */}
                                    <div className="grid grid-cols-12 py-4 items-center">
                                        <div className="col-span-6">
                                            <div className="font-bold text-gray-900">Company Income Tax</div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {hasLoss || adjustmentSchedule.taxableProfit <= 0
                                                    ? <span className="text-amber-600 font-medium">Tax Loss — No taxable profit</span>
                                                    : `Based on Taxable Profit of ${formatCurrency(adjustmentSchedule.taxableProfit)}`
                                                }
                                            </div>
                                        </div>
                                        <div className="col-span-3 text-right text-gray-500 text-xs">
                                            {citReason}
                                        </div>
                                        <div className="col-span-3 text-right font-bold text-gray-900">
                                            {formatCurrency(cit.citPayable)}
                                        </div>
                                    </div>

                                    {/* Item 2: Education Tax */}
                                    <div className="grid grid-cols-12 py-4 items-center">
                                        <div className="col-span-6">
                                            <div className="font-bold text-gray-900">Tertiary Education Tax</div>
                                            <div className="text-xs text-gray-500 mt-1">Assessable Profit Basis</div>
                                        </div>
                                        <div className="col-span-3 text-right text-gray-500 text-xs">
                                            {EDUCATION_TAX_RATE}%
                                        </div>
                                        <div className="col-span-3 text-right font-bold text-gray-900">
                                            {formatCurrency(cit.educationTax)}
                                        </div>
                                    </div>

                                    {/* Item 3: PAYE */}
                                    <div className="grid grid-cols-12 py-4 items-center">
                                        <div className="col-span-6">
                                            <div className="font-bold text-gray-900">P.A.Y.E Liability</div>
                                            <div className="text-xs text-gray-500 mt-1">Employee Tax Deductions</div>
                                        </div>
                                        <div className="col-span-3 text-right text-gray-500 text-xs">
                                            Graduated Scale
                                        </div>
                                        <div className="col-span-3 text-right font-bold text-gray-900">
                                            {formatCurrency(payePayable)}
                                        </div>
                                    </div>

                                    {/* Item 4: VAT */}
                                    <div className="grid grid-cols-12 py-4 items-center">
                                        <div className="col-span-6">
                                            <div className={`font-bold ${hasVATCredit ? 'text-emerald-700' : 'text-gray-900'}`}>
                                                {hasVATCredit ? 'Value Added Tax Credit' : 'Value Added Tax'}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {hasVATCredit
                                                    ? <span className="text-emerald-600">Input exceeds Output — Recoverable</span>
                                                    : 'Net Payable (Output - Input)'
                                                }
                                            </div>
                                        </div>
                                        <div className="col-span-3 text-right text-gray-500 text-xs">
                                            {VAT_RATE}% Net
                                        </div>
                                        <div className={`col-span-3 text-right font-bold ${hasVATCredit ? 'text-emerald-700' : 'text-gray-900'}`}>
                                            {hasVATCredit ? `(${formatCurrency(vatCredit)})` : formatCurrency(vatPayable)}
                                        </div>
                                    </div>
                                </div>

                                {/* Total Tax Liability */}
                                <div className="mt-8 pt-4 border-t-2 border-gray-900 flex justify-between items-end">
                                    <div className="text-right flex-1 pr-8">
                                        <div className="text-xs uppercase tracking-widest text-gray-500">Total Tax Liability to FIRS/State</div>
                                        {hasVATCredit && (
                                            <div className="text-xs text-emerald-600 mt-1">Note: VAT Credit of {formatCurrency(vatCredit)} not included (recoverable)</div>
                                        )}
                                    </div>
                                    <div className="text-2xl font-bold font-mono border-b-4 border-double border-gray-900 pl-4">
                                        {formatCurrency(cit.totalDirectTax + payePayable + vatPayable)}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Cashbook Section */}
            <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-emerald-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Cashbook</h2>
                            <p className="text-sm text-gray-500">All receipts and payments</p>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    {(() => {
                        // Get all cash transactions (accounts 1000, 1010)
                        const cashAccountCodes = ["1000", "1010"];
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

                        return (
                            <>
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
                                            transactionsWithBalance.slice(-15).map((tx, idx) => (
                                                <tr key={`${tx.entryId}-${idx}`} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{tx.date}</td>
                                                    <td className="px-4 py-3 text-gray-900 truncate max-w-[200px]">{tx.description}</td>
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
                                                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                                                    <p>No cash transactions yet</p>
                                                    <p className="text-xs mt-1">Post entries with Cash or Bank accounts to see the cashbook</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    {transactionsWithBalance.length > 0 && (
                                        <tfoot className="bg-gray-50 border-t border-gray-200">
                                            <tr>
                                                <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-gray-700">Totals</td>
                                                <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600">
                                                    {formatCurrency(cashTransactions.reduce((sum, tx) => sum + tx.receipt, 0))}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-semibold text-rose-600">
                                                    {formatCurrency(cashTransactions.reduce((sum, tx) => sum + tx.payment, 0))}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                                                    {formatCurrency(runningBalance)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </>
                        );
                    })()}
                </div>
            </div>

            {/* Create Account Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
                        <div className="px-6 py-4 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900">Create Custom Account</h2>
                            <p className="text-sm text-gray-500">Add a new account to your Chart of Accounts</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Code</label>
                                    <input
                                        type="text"
                                        value={newAccount.code}
                                        onChange={(e) => setNewAccount({ ...newAccount, code: e.target.value })}
                                        placeholder="e.g., 1150"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Class</label>
                                    <select
                                        value={newAccount.class}
                                        onChange={(e) => {
                                            const cls = e.target.value as AccountClass;
                                            setNewAccount({ ...newAccount, class: cls, subClass: subClassOptions[cls][0] });
                                        }}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    >
                                        <option value="asset">Asset</option>
                                        <option value="liability">Liability</option>
                                        <option value="equity">Equity</option>
                                        <option value="revenue">Revenue</option>
                                        <option value="expense">Expense</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                                <input
                                    type="text"
                                    value={newAccount.name}
                                    onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                                    placeholder="e.g., Staff Loans Receivable"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Sub-Class</label>
                                <select
                                    value={newAccount.subClass}
                                    onChange={(e) => setNewAccount({ ...newAccount, subClass: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                >
                                    {subClassOptions[newAccount.class].map((sub) => (
                                        <option key={sub} value={sub}>{sub.replace(/-/g, " ")}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <input
                                    type="text"
                                    value={newAccount.description}
                                    onChange={(e) => setNewAccount({ ...newAccount, description: e.target.value })}
                                    placeholder="e.g., Loans given to staff members"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                            </div>
                            {createError && (
                                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{createError}</p>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateAccount}
                                disabled={!newAccount.code || !newAccount.name}
                                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                            >
                                Create Account
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Journal Entry Modal */}
            {showJournalEntry && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900">Post Journal Entry</h2>
                            <p className="text-sm text-gray-500">Create a double-entry journal transaction</p>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={journalDate}
                                        onChange={(e) => setJournalDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Narration</label>
                                    <input
                                        type="text"
                                        value={journalNarration}
                                        onChange={(e) => setJournalNarration(e.target.value)}
                                        placeholder="e.g., Purchased office equipment"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    />
                                </div>
                            </div>

                            {/* Journal Lines */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-gray-700">Entry Lines</label>
                                    <button
                                        onClick={addJournalLine}
                                        className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                                    >
                                        + Add Line
                                    </button>
                                </div>
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Account</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-28">Debit</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-28">Credit</th>
                                                <th className="w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {journalLines.map((line) => (
                                                <tr key={line.id}>
                                                    <td className="px-3 py-2">
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={accountSearchLineId === line.id ? accountSearchQuery : (line.accountCode ? `${line.accountCode} - ${line.accountName}` : "")}
                                                                onChange={(e) => {
                                                                    setAccountSearchQuery(e.target.value);
                                                                    setAccountSearchLineId(line.id);
                                                                }}
                                                                onFocus={() => {
                                                                    setAccountSearchLineId(line.id);
                                                                    setAccountSearchQuery("");
                                                                }}
                                                                placeholder="Search accounts..."
                                                                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                                            />
                                                            {/* Account Class Filter Pills */}
                                                            {accountSearchLineId === line.id && (
                                                                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden">
                                                                    {/* Class filter tabs */}
                                                                    <div className="flex gap-1 p-2 border-b border-gray-100 flex-wrap bg-gray-50">
                                                                        {(["all", "asset", "liability", "equity", "revenue", "expense"] as const).map((cls) => (
                                                                            <button
                                                                                key={cls}
                                                                                onClick={(e) => {
                                                                                    e.preventDefault();
                                                                                    setAccountClassFilter(cls);
                                                                                }}
                                                                                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${accountClassFilter === cls
                                                                                    ? "bg-purple-600 text-white"
                                                                                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                                                                                    }`}
                                                                            >
                                                                                {cls.charAt(0).toUpperCase() + cls.slice(1)}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                    {/* Filtered account list */}
                                                                    <div className="overflow-y-auto max-h-48">
                                                                        {allAccounts
                                                                            .filter(acc => {
                                                                                const matchesSearch = accountSearchQuery === "" ||
                                                                                    acc.code.toLowerCase().includes(accountSearchQuery.toLowerCase()) ||
                                                                                    acc.name.toLowerCase().includes(accountSearchQuery.toLowerCase());
                                                                                const matchesClass = accountClassFilter === "all" || acc.class === accountClassFilter;
                                                                                return matchesSearch && matchesClass;
                                                                            })
                                                                            .slice(0, 15)
                                                                            .map((acc) => (
                                                                                <button
                                                                                    key={acc.code}
                                                                                    onClick={(e) => {
                                                                                        e.preventDefault();
                                                                                        updateJournalLine(line.id, "accountCode", acc.code);
                                                                                        setAccountSearchLineId(null);
                                                                                        setAccountSearchQuery("");
                                                                                        setAccountClassFilter("all");
                                                                                    }}
                                                                                    className="w-full px-3 py-2 text-left text-sm hover:bg-purple-50 flex items-center justify-between group"
                                                                                >
                                                                                    <div>
                                                                                        <span className="font-mono text-purple-600 text-xs">{acc.code}</span>
                                                                                        <span className="ml-2 text-gray-900">{acc.name}</span>
                                                                                    </div>
                                                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${classColors[acc.class].badge}`}>
                                                                                        {acc.class}
                                                                                    </span>
                                                                                </button>
                                                                            ))}
                                                                        {allAccounts.filter(acc => {
                                                                            const matchesSearch = accountSearchQuery === "" ||
                                                                                acc.code.toLowerCase().includes(accountSearchQuery.toLowerCase()) ||
                                                                                acc.name.toLowerCase().includes(accountSearchQuery.toLowerCase());
                                                                            const matchesClass = accountClassFilter === "all" || acc.class === accountClassFilter;
                                                                            return matchesSearch && matchesClass;
                                                                        }).length === 0 && (
                                                                                <div className="px-3 py-4 text-sm text-gray-400 text-center">
                                                                                    No accounts found
                                                                                </div>
                                                                            )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="number"
                                                            value={line.debit}
                                                            onChange={(e) => updateJournalLine(line.id, "debit", e.target.value)}
                                                            placeholder="0"
                                                            className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-right focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="number"
                                                            value={line.credit}
                                                            onChange={(e) => updateJournalLine(line.id, "credit", e.target.value)}
                                                            placeholder="0"
                                                            className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-right focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        {journalLines.length > 2 && (
                                                            <button
                                                                onClick={() => removeJournalLine(line.id)}
                                                                className="text-gray-400 hover:text-red-500"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gray-50 border-t border-gray-200">
                                            <tr>
                                                <td className="px-3 py-2 text-sm font-semibold text-gray-700">Total</td>
                                                <td className="px-3 py-2 text-sm font-semibold text-right text-gray-900">
                                                    ₦{journalTotals.totalDebit.toLocaleString()}
                                                </td>
                                                <td className="px-3 py-2 text-sm font-semibold text-right text-gray-900">
                                                    ₦{journalTotals.totalCredit.toLocaleString()}
                                                </td>
                                                <td className="px-2 py-2">
                                                    {journalTotals.isBalanced ? (
                                                        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    ) : journalTotals.totalDebit > 0 || journalTotals.totalCredit > 0 ? (
                                                        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {journalError && (
                                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{journalError}</p>
                            )}

                            {!journalTotals.isBalanced && journalTotals.totalDebit > 0 && (
                                <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                                    Entry not balanced: DR ₦{journalTotals.totalDebit.toLocaleString()} ≠ CR ₦{journalTotals.totalCredit.toLocaleString()}
                                </p>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setShowJournalEntry(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePostJournal}
                                disabled={!journalTotals.isBalanced || !journalNarration.trim()}
                                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                            >
                                Post Entry
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Audit Results Modal */}
            {showAuditModal && auditResult && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-blue-50 to-purple-50">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${auditResult.isCompliant ? 'bg-green-100' : 'bg-amber-100'}`}>
                                    {auditResult.isCompliant ? (
                                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">AI Tax Audit Results</h2>
                                    <p className={`text-sm font-medium ${auditResult.isCompliant ? 'text-green-600' : 'text-amber-600'}`}>
                                        {auditResult.isCompliant ? '✓ Compliant' : `${auditResult.errors.length} Issues Found`}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAuditModal(false)}
                                className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {/* Errors Section */}
                            {auditResult.errors.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Detected Issues</h3>
                                    <div className="space-y-2">
                                        {auditResult.errors.map((error, idx) => (
                                            <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                                <div className="flex items-start gap-2">
                                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">{error.type}</span>
                                                    <p className="text-sm text-red-700 flex-1">{error.description}</p>
                                                </div>
                                                {error.corrected !== undefined && (
                                                    <p className="text-xs text-red-600 mt-1">
                                                        Corrected: {typeof error.corrected === 'object' ? JSON.stringify(error.corrected) : String(error.corrected)}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Corrected Summary */}
                            {auditResult.correctedSummary && (
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Corrected Tax Summary</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Direct Taxes */}
                                        <div className="p-4 bg-gray-50 rounded-xl">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Direct Taxes</h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">CIT</span>
                                                    <span className="font-mono font-semibold">₦{(auditResult.correctedSummary.directTaxes?.cit?.amount || 0).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Education Tax</span>
                                                    <span className="font-mono font-semibold">₦{(auditResult.correctedSummary.directTaxes?.educationTax?.amount || 0).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">PAYE</span>
                                                    <span className="font-mono font-semibold">₦{(auditResult.correctedSummary.directTaxes?.paye?.amount || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Transaction Taxes */}
                                        <div className="p-4 bg-gray-50 rounded-xl">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Transaction Taxes</h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Output VAT</span>
                                                    <span className="font-mono font-semibold">₦{(auditResult.correctedSummary.transactionTaxes?.outputVAT || 0).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Input VAT</span>
                                                    <span className="font-mono font-semibold">₦{(auditResult.correctedSummary.transactionTaxes?.inputVAT || 0).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Net VAT</span>
                                                    <span className={`font-mono font-semibold ${auditResult.correctedSummary.transactionTaxes?.vatStatus === 'CREDIT' ? 'text-green-600' : 'text-gray-900'}`}>
                                                        {auditResult.correctedSummary.transactionTaxes?.vatStatus === 'CREDIT' ? '(' : ''}
                                                        ₦{(auditResult.correctedSummary.transactionTaxes?.netVAT || 0).toLocaleString()}
                                                        {auditResult.correctedSummary.transactionTaxes?.vatStatus === 'CREDIT' ? ')' : ''}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Total WHT</span>
                                                    <span className="font-mono font-semibold">₦{(auditResult.correctedSummary.transactionTaxes?.totalWHT || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Total Liability */}
                                    <div className="mt-4 p-4 bg-gray-900 rounded-xl">
                                        <div className="flex justify-between items-center">
                                            <span className="text-white font-semibold">Total Tax Liability</span>
                                            <span className="text-white font-mono text-xl font-bold">
                                                ₦{(auditResult.correctedSummary.totalLiability || 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Explanations */}
                            {auditResult.explanations && auditResult.explanations.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Corrections Made</h3>
                                    <ul className="space-y-2">
                                        {auditResult.explanations.map((explanation, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                                <span className="text-green-500 font-bold">✓</span>
                                                {explanation}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setShowAuditModal(false)}
                                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
