"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/ThemeContext";

type SearchCategory = "all" | "transactions" | "ledgers" | "statements";

interface SearchResult {
    id: string;
    type: "transaction" | "ledger" | "statement";
    title: string;
    description: string;
    date?: string;
    amount?: number;
    path: string;
}

type StoredJournalEntry = {
    id?: string;
    description?: string;
    narration?: string;
    date?: string;
    entries?: Array<{ amount?: number }>;
};

type StoredInvoice = {
    id?: string;
    customerName?: string;
    invoiceNumber?: string;
    total?: number;
    date?: string;
};

export default function GlobalSearch() {
    const { theme } = useTheme();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState<SearchCategory>("all");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const isDark = theme === "dark";

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Simulate search (in a real app, this would query your backend/localStorage)
    useEffect(() => {
        if (!query.trim()) {
            const idleTimer = window.setTimeout(() => setIsSearching(false), 0);
            return () => window.clearTimeout(idleTimer);
        }

        const startTimer = window.setTimeout(() => setIsSearching(true), 0);
        const timer = setTimeout(() => {
            // Simulated search results
            const mockResults: SearchResult[] = [];
            const lowerQuery = query.toLowerCase();

            // Search transactions from localStorage
            try {
                const txData = localStorage.getItem("insight::journal_entries");
                if (txData) {
                    const parsed = JSON.parse(txData) as unknown;
                    const entries = Array.isArray(parsed) ? (parsed as StoredJournalEntry[]) : [];
                    entries.forEach((entry) => {
                        const title = entry.description || entry.narration || "Transaction";
                        const description = `${entry.date || "N/A"} • ${entry.entries?.length || 0} entries`;
                        const amount = typeof entry.entries?.[0]?.amount === "number" ? entry.entries[0].amount : undefined;
                        if (
                            entry.description?.toLowerCase().includes(lowerQuery) ||
                            entry.narration?.toLowerCase().includes(lowerQuery)
                        ) {
                            mockResults.push({
                                id: entry.id || `tx-${Math.random().toString(36).slice(2, 8)}`,
                                type: "transaction",
                                title,
                                description,
                                date: entry.date,
                                amount,
                                path: "/accounting",
                            });
                        }
                    });
                }
            } catch (e) { }

            // Search invoices
            try {
                const invoiceData = localStorage.getItem("insight::invoices");
                if (invoiceData) {
                    const parsed = JSON.parse(invoiceData) as unknown;
                    const invoices = Array.isArray(parsed) ? (parsed as StoredInvoice[]) : [];
                    invoices.forEach((inv) => {
                        if (
                            inv.customerName?.toLowerCase().includes(lowerQuery) ||
                            inv.invoiceNumber?.toLowerCase().includes(lowerQuery)
                        ) {
                            mockResults.push({
                                id: inv.id || `inv-${Math.random().toString(36).slice(2, 8)}`,
                                type: "transaction",
                                title: `Invoice ${inv.invoiceNumber}`,
                                description: `${inv.customerName} • ₦${inv.total?.toLocaleString()}`,
                                date: inv.date,
                                amount: inv.total,
                                path: "/accounting/invoices",
                            });
                        }
                    });
                }
            } catch (e) { }

            // Add ledger results if searching for accounts
            if (category === "all" || category === "ledgers") {
                const ledgerKeywords = ["cash", "bank", "revenue", "expense", "asset", "liability", "equity"];
                if (ledgerKeywords.some(k => lowerQuery.includes(k))) {
                    mockResults.push({
                        id: "ledger-1",
                        type: "ledger",
                        title: "Chart of Accounts",
                        description: "View all accounts and balances",
                        path: "/accounting/reports",
                    });
                }
            }

            // Add statement results
            if (category === "all" || category === "statements") {
                const statementKeywords = ["income", "balance", "trial", "statement", "profit", "loss"];
                if (statementKeywords.some(k => lowerQuery.includes(k))) {
                    mockResults.push({
                        id: "stmt-income",
                        type: "statement",
                        title: "Income Statement",
                        description: "Revenue and expenses for the period",
                        path: "/accounting/reports",
                    });
                    mockResults.push({
                        id: "stmt-balance",
                        type: "statement",
                        title: "Balance Sheet",
                        description: "Assets, liabilities, and equity",
                        path: "/accounting/reports",
                    });
                }
            }

            // Filter by category
            const resultTypeByCategory: Record<Exclude<SearchCategory, "all">, SearchResult["type"]> = {
                transactions: "transaction",
                ledgers: "ledger",
                statements: "statement",
            };
            const filtered = category === "all"
                ? mockResults
                : mockResults.filter((r) => r.type === resultTypeByCategory[category]);

            setResults(filtered.slice(0, 6));
            setIsSearching(false);
        }, 300);

        return () => {
            window.clearTimeout(startTimer);
            clearTimeout(timer);
        };
    }, [query, category]);

    const handleResultClick = (result: SearchResult) => {
        setIsOpen(false);
        setQuery("");
        router.push(result.path);
    };

    const visibleResults = query.trim() ? results : [];

    const getTypeIcon = (type: string) => {
        switch (type) {
            case "transaction":
                return (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                );
            case "ledger":
                return (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                );
            case "statement":
                return (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                );
            default:
                return null;
        }
    };

    return (
        <div ref={containerRef} className="relative">
            {/* Search Icon Button with bar */}
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full transition-colors"
                style={{
                    background: isDark ? "#000000" : "rgba(0,0,0,0.06)",
                    color: isDark ? "#9ca3af" : "#6b7280"
                }}
                aria-label="Search"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="text-xs">Search</span>
            </button>

            {/* Search Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-start justify-center pt-16 px-4">
                    {/* Backdrop with strong blur */}
                    <div
                        className="absolute inset-0 bg-black/30 backdrop-blur-xl"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Search Panel */}
                    <div
                        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
                        style={{ background: isDark ? "#000000" : "white" }}
                    >
                        {/* Input */}
                        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: isDark ? "#333" : "#e5e7eb" }}>
                            <svg className="w-5 h-5 flex-shrink-0" style={{ color: isDark ? "#9ca3af" : "#6b7280" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search transactions, ledgers, statements..."
                                className="flex-1 bg-transparent text-sm outline-none"
                                style={{ color: isDark ? "#fff" : "#111827" }}
                            />
                            {query && (
                                <button
                                    onClick={() => setQuery("")}
                                    className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                                    style={{ color: isDark ? "#9ca3af" : "#6b7280" }}
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Category Tabs */}
                        <div className="flex gap-1 px-4 py-2 border-b overflow-x-auto" style={{ borderColor: isDark ? "#333" : "#e5e7eb" }}>
                            {(["all", "transactions", "ledgers", "statements"] as SearchCategory[]).map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setCategory(cat)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${category === cat
                                        ? "bg-[#2563eb] text-white"
                                        : isDark
                                            ? "bg-gray-800 text-gray-300"
                                            : "bg-gray-100 text-gray-600"
                                        }`}
                                >
                                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                </button>
                            ))}
                        </div>

                        {/* Results */}
                        <div className="max-h-[300px] overflow-y-auto">
                            {isSearching ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-5 h-5 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : visibleResults.length > 0 ? (
                                <div className="py-2">
                                    {visibleResults.map((result) => (
                                        <button
                                            key={result.id}
                                            onClick={() => handleResultClick(result)}
                                            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors"
                                        >
                                            <div
                                                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                style={{
                                                    background: isDark ? "#000000" : "#f3f4f6",
                                                    color: isDark ? "#9ca3af" : "#6b7280"
                                                }}
                                            >
                                                {getTypeIcon(result.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate" style={{ color: isDark ? "#fff" : "#111827" }}>
                                                    {result.title}
                                                </p>
                                                <p className="text-xs truncate" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                                                    {result.description}
                                                </p>
                                            </div>
                                            {result.amount && (
                                                <span className="text-sm font-medium" style={{ color: isDark ? "#fff" : "#111827" }}>
                                                    ₦{result.amount.toLocaleString()}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ) : query ? (
                                <div className="py-8 text-center">
                                    <p className="text-sm" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                                        No results found for &quot;{query}&quot;
                                    </p>
                                </div>
                            ) : (
                                <div className="py-8 text-center">
                                    <p className="text-sm" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                                        Start typing to search...
                                    </p>
                                    <p className="text-xs mt-1" style={{ color: isDark ? "#6b7280" : "#9ca3af" }}>
                                        Search transactions, ledgers, or financial statements
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div
                            className="flex items-center justify-between px-4 py-2 text-xs border-t"
                            style={{
                                borderColor: isDark ? "#333" : "#e5e7eb",
                                color: isDark ? "#6b7280" : "#9ca3af"
                            }}
                        >
                            <span>Press ESC to close</span>
                            <span>{visibleResults.length} results</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
