"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { CHART_OF_ACCOUNTS, AccountClass, ChartOfAccount } from "@/lib/accounting/standards";
import { accountingEngine, AccountingState, CustomAccount } from "@/lib/accounting/transactionBridge";
import { JournalEntry } from "@/lib/accounting/doubleEntry";

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

    if (!isLoaded) return null;

    return (
        <div className="space-y-6">
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
                                <p className="text-xs mt-1">Click "Post Entry" to add a journal entry</p>
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
                                                        <select
                                                            value={line.accountCode}
                                                            onChange={(e) => updateJournalLine(line.id, "accountCode", e.target.value)}
                                                            className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                                        >
                                                            <option value="">Select account...</option>
                                                            {allAccounts.map((acc) => (
                                                                <option key={acc.code} value={acc.code}>
                                                                    {acc.code} - {acc.name}
                                                                </option>
                                                            ))}
                                                        </select>
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
        </div>
    );
}
