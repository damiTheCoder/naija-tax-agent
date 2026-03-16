"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, useRef } from "react";
import { useTheme } from "@/lib/ThemeContext";

// =============================================================================
// TYPES
// =============================================================================

export type ReceiptCategory =
    | "travel"
    | "office"
    | "equipment"
    | "meals"
    | "utilities"
    | "software"
    | "marketing"
    | "professional"
    | "other";

export interface Receipt {
    id: string;
    fileName: string;
    vendor: string;
    amount: number;
    date: string;
    category: ReceiptCategory;
    description?: string;
    isVerified: boolean;
    extractedData?: {
        vendor?: string;
        amount?: number;
        date?: string;
        confidence: number;
    };
    createdAt: string;
}

// =============================================================================
// CATEGORY CONFIG
// =============================================================================

const categoryConfig: Record<ReceiptCategory, { label: string; color: string; bg: string }> = {
    travel: { label: "Travel", color: "text-blue-700", bg: "bg-blue-100" },
    office: { label: "Office Supplies", color: "text-amber-700", bg: "bg-amber-100" },
    equipment: { label: "Equipment", color: "text-purple-700", bg: "bg-purple-100" },
    meals: { label: "Meals & Entertainment", color: "text-orange-700", bg: "bg-orange-100" },
    utilities: { label: "Utilities", color: "text-teal-700", bg: "bg-teal-100" },
    software: { label: "Software & Subscriptions", color: "text-indigo-700", bg: "bg-indigo-100" },
    marketing: { label: "Marketing", color: "text-pink-700", bg: "bg-pink-100" },
    professional: { label: "Professional Services", color: "text-green-700", bg: "bg-green-100" },
    other: { label: "Other", color: "text-gray-700", bg: "bg-gray-100" },
};

// =============================================================================
// ICONS
// =============================================================================

const icons = {
    receipt: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
        </svg>
    ),
    upload: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
    ),
    close: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    ),
    trash: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
    ),
    check: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
    ),
    edit: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
    ),
    document: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    ),
    money: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    folder: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
    ),
    ai: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
        </svg>
    ),
};

function KpiCard({ label, value, hint, accent }: { label: string; value: string; hint: string; accent: string }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 min-w-0">
            <p className={`text-xs font-semibold uppercase tracking-wide ${accent}`}>{label}</p>
            <p className="mt-3 text-lg sm:text-xl font-semibold text-gray-900 leading-tight break-words">{value}</p>
            <p className="text-xs text-gray-500 mt-2">{hint}</p>
        </div>
    );
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function ReceiptsManagementPage() {
    const { theme } = useTheme();
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
    const [filterCategory, setFilterCategory] = useState<ReceiptCategory | "all">("all");
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Upload form state
    const [uploadForm, setUploadForm] = useState({
        vendor: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        category: "other" as ReceiptCategory,
        description: "",
        fileName: "",
    });

    // Edit form state
    const [editForm, setEditForm] = useState({
        vendor: "",
        amount: "",
        date: "",
        category: "other" as ReceiptCategory,
        description: "",
    });

    // Load receipts from localStorage
    useEffect(() => {
        const loadReceipts = () => {
            setIsLoading(true);
            try {
                const saved = localStorage.getItem("insight::receipts");
                if (saved) {
                    setReceipts(JSON.parse(saved));
                }
            } catch (e) {
                console.error("Failed to load receipts:", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadReceipts();
    }, []);

    // Save receipts to localStorage
    useEffect(() => {
        if (!isLoading && receipts.length >= 0) {
            localStorage.setItem("insight::receipts", JSON.stringify(receipts));
        }
    }, [receipts, isLoading]);

    // Stats calculation
    const stats = useMemo(() => {
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();

        const thisMonthReceipts = receipts.filter(r => {
            const rDate = new Date(r.date);
            return rDate.getMonth() === thisMonth && rDate.getFullYear() === thisYear;
        });

        const categoryBreakdown = Object.keys(categoryConfig).reduce((acc, cat) => {
            const total = receipts.filter(r => r.category === cat).reduce((sum, r) => sum + r.amount, 0);
            if (total > 0) acc[cat as ReceiptCategory] = total;
            return acc;
        }, {} as Record<ReceiptCategory, number>);

        return {
            totalExpenses: receipts.reduce((sum, r) => sum + r.amount, 0),
            thisMonthExpenses: thisMonthReceipts.reduce((sum, r) => sum + r.amount, 0),
            totalReceipts: receipts.length,
            verifiedReceipts: receipts.filter(r => r.isVerified).length,
            categoryBreakdown,
        };
    }, [receipts]);

    // Filter receipts
    const filteredReceipts = useMemo(() => {
        if (filterCategory === "all") return receipts;
        return receipts.filter(r => r.category === filterCategory);
    }, [receipts, filterCategory]);

    // Simulate OCR extraction
    const simulateOCR = (fileName: string) => {
        // Simulate vendor names based on filename patterns
        const vendors = ["ShopRite", "Jumia", "Total Energies", "MTN", "Uber", "Bolt", "Amazon Web Services"];
        const randomVendor = vendors[Math.floor(Math.random() * vendors.length)];
        const randomAmount = Math.floor(Math.random() * 50000) + 1000;

        return {
            vendor: randomVendor,
            amount: randomAmount,
            date: new Date().toISOString().split("T")[0],
            confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
        };
    };

    // Handle file upload
    const handleFileUpload = (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const file = files[0];
        const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
        if (!validTypes.includes(file.type)) {
            alert("Please upload an image (JPEG, PNG, WebP) or PDF file.");
            return;
        }

        setIsProcessing(true);
        setUploadForm(prev => ({ ...prev, fileName: file.name }));

        // Simulate OCR processing
        setTimeout(() => {
            const extracted = simulateOCR(file.name);
            setUploadForm(prev => ({
                ...prev,
                vendor: extracted.vendor || "",
                amount: extracted.amount?.toString() || "",
                date: extracted.date || prev.date,
            }));
            setIsProcessing(false);
            setShowUploadModal(true);
        }, 1500);
    };

    // Handle drag and drop
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileUpload(e.dataTransfer.files);
    };

    // Save new receipt
    const handleSaveReceipt = () => {
        if (!uploadForm.vendor || !uploadForm.amount) return;

        const newReceipt: Receipt = {
            id: `rcpt_${Date.now()}`,
            fileName: uploadForm.fileName,
            vendor: uploadForm.vendor,
            amount: parseFloat(uploadForm.amount) || 0,
            date: uploadForm.date,
            category: uploadForm.category,
            description: uploadForm.description,
            isVerified: true,
            extractedData: {
                vendor: uploadForm.vendor,
                amount: parseFloat(uploadForm.amount),
                date: uploadForm.date,
                confidence: 0.95,
            },
            createdAt: new Date().toISOString(),
        };

        setReceipts(prev => [newReceipt, ...prev]);
        resetUploadForm();
        setShowUploadModal(false);
    };

    const resetUploadForm = () => {
        setUploadForm({
            vendor: "",
            amount: "",
            date: new Date().toISOString().split("T")[0],
            category: "other",
            description: "",
            fileName: "",
        });
    };

    // Open edit modal
    const openEditModal = (receipt: Receipt) => {
        setSelectedReceipt(receipt);
        setEditForm({
            vendor: receipt.vendor,
            amount: receipt.amount.toString(),
            date: receipt.date,
            category: receipt.category,
            description: receipt.description || "",
        });
        setShowEditModal(true);
    };

    // Save edited receipt
    const handleSaveEdit = () => {
        if (!selectedReceipt || !editForm.vendor || !editForm.amount) return;

        setReceipts(prev =>
            prev.map(r =>
                r.id === selectedReceipt.id
                    ? {
                        ...r,
                        vendor: editForm.vendor,
                        amount: parseFloat(editForm.amount) || 0,
                        date: editForm.date,
                        category: editForm.category,
                        description: editForm.description,
                    }
                    : r
            )
        );
        setShowEditModal(false);
        setSelectedReceipt(null);
    };

    // Delete receipt
    const deleteReceipt = (receiptId: string) => {
        if (confirm("Are you sure you want to delete this receipt?")) {
            setReceipts(prev => prev.filter(r => r.id !== receiptId));
        }
    };

    // Format currency
    const formatCurrency = (amount: number) => `₦${amount.toLocaleString()}`;
    const formatDate = (date: string) =>
        new Date(date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-2 border-[#2264ff] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-10 sm:pb-14">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Receipts Management</h1>
                    <p className="text-sm text-gray-500 mt-1">Track and organize expense receipts from one workspace.</p>
                    <Link href="/accounting/workspace" className="mt-2 inline-flex text-sm font-medium text-[#2264ff] hover:text-[#1a50cc]">
                        Open Accounting Workspace
                    </Link>
                </div>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Upload Receipt
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={e => handleFileUpload(e.target.files)}
                    className="hidden"
                />
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard
                    label="Total Expenses"
                    value={formatCurrency(stats.totalExpenses)}
                    hint="All receipt expenses to date"
                    accent="text-teal-600"
                />
                <KpiCard
                    label="This Month"
                    value={formatCurrency(stats.thisMonthExpenses)}
                    hint="Receipt spend in current month"
                    accent="text-blue-600"
                />
                <KpiCard
                    label="Total Receipts"
                    value={stats.totalReceipts.toString()}
                    hint="Uploaded and tracked receipts"
                    accent="text-indigo-600"
                />
                <KpiCard
                    label="Verified"
                    value={`${stats.verifiedReceipts}/${stats.totalReceipts}`}
                    hint="AI validated receipt records"
                    accent="text-emerald-600"
                />
            </div>

            {/* Upload Drop Zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${isDragging
                    ? "border-[#2264ff] bg-blue-50"
                    : "border-gray-300 hover:border-gray-400 bg-white"
                    }`}
            >
                {isProcessing ? (
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-2 border-[#2264ff] border-t-transparent rounded-full animate-spin" />
                        <p className="font-medium text-gray-900">
                            Processing receipt...
                        </p>
                        <p className="text-sm text-gray-500">
                            Extracting data with AI
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-gray-100">
                            <span className="text-gray-500">{icons.upload}</span>
                        </div>
                        <p className="font-medium mb-1 text-gray-900">
                            Drop receipt here or click to upload
                        </p>
                        <p className="text-sm text-gray-500">
                            Supports JPEG, PNG, WebP, and PDF files
                        </p>
                    </>
                )}
            </div>

            {/* Category Filter */}
            <div className="rounded-2xl border border-gray-100 bg-white p-3">
                <div className="flex gap-2 overflow-x-auto pb-1">
                    <button
                        onClick={() => setFilterCategory("all")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterCategory === "all"
                            ? "bg-[#2264ff] text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                    >
                        All Categories
                    </button>
                    {Object.entries(categoryConfig).map(([key, config]) => (
                        <button
                            key={key}
                            onClick={() => setFilterCategory(key as ReceiptCategory)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterCategory === key
                                ? "bg-[#2264ff] text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                        >
                            {config.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Receipts List */}
            <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
                {filteredReceipts.length === 0 ? (
                    <div className="p-12 text-center">
                        <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                            style={{ background: theme === "dark" ? "#333" : "#f3f4f6" }}
                        >
                            <svg
                                className="w-8 h-8"
                                style={{ color: theme === "dark" ? "#6b7280" : "#9ca3af" }}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={1.5}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
                                />
                            </svg>
                        </div>
                        <h3
                            className="text-lg font-semibold mb-2"
                            style={{ color: theme === "dark" ? "#fff" : "#111827" }}
                        >
                            No receipts yet
                        </h3>
                        <p
                            style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}
                            className="mb-6 max-w-sm mx-auto"
                        >
                            Upload your first receipt to start tracking expenses.
                        </p>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-2 bg-[#2264ff] text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#1a50cc] transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Upload Your First Receipt
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {filteredReceipts.map(receipt => {
                            const catConfig = categoryConfig[receipt.category];
                            return (
                                <div
                                    key={receipt.id}
                                    className="p-5 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4 flex-1 min-w-0">
                                            <div
                                                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: theme === "dark" ? "#333" : "#f3f4f6" }}
                                            >
                                                <span style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}>{icons.receipt}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <h3
                                                        className="font-semibold truncate"
                                                        style={{ color: theme === "dark" ? "#fff" : "#111827" }}
                                                    >
                                                        {receipt.vendor}
                                                    </h3>
                                                    <span
                                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${catConfig.bg} ${catConfig.color}`}
                                                    >
                                                        {catConfig.label}
                                                    </span>
                                                    {receipt.isVerified && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                            {icons.check}
                                                            Verified
                                                        </span>
                                                    )}
                                                </div>
                                                <p
                                                    className="text-sm truncate"
                                                    style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}
                                                >
                                                    {receipt.fileName} • {formatDate(receipt.date)}
                                                </p>
                                                {receipt.description && (
                                                    <p
                                                        className="text-sm mt-1 truncate"
                                                        style={{ color: theme === "dark" ? "#6b7280" : "#9ca3af" }}
                                                    >
                                                        {receipt.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p
                                                className="text-lg font-bold"
                                                style={{ color: theme === "dark" ? "#fff" : "#111827" }}
                                            >
                                                {formatCurrency(receipt.amount)}
                                            </p>
                                            <div className="flex items-center gap-1 mt-2 justify-end">
                                                <button
                                                    onClick={() => openEditModal(receipt)}
                                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                                    style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}
                                                    title="Edit"
                                                >
                                                    {icons.edit}
                                                </button>
                                                <button
                                                    onClick={() => deleteReceipt(receipt.id)}
                                                    className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                                                    title="Delete"
                                                >
                                                    {icons.trash}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Category Breakdown */}
            {Object.keys(stats.categoryBreakdown).length > 0 && (
                <div className="rounded-2xl bg-white border border-gray-100 p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Expense Breakdown</h3>
                    <div className="space-y-3">
                        {Object.entries(stats.categoryBreakdown)
                            .sort(([, a], [, b]) => b - a)
                            .map(([cat, amount]) => {
                                const config = categoryConfig[cat as ReceiptCategory];
                                const percentage = (amount / stats.totalExpenses) * 100;
                                return (
                                    <div key={cat}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                                            <span
                                                className="text-sm font-mono"
                                                style={{ color: theme === "dark" ? "#fff" : "#111827" }}
                                            >
                                                {formatCurrency(amount)}
                                            </span>
                                        </div>
                                        <div
                                            className="h-2 rounded-full overflow-hidden"
                                            style={{ background: theme === "dark" ? "#333" : "#e5e7eb" }}
                                        >
                                            <div
                                                className={`h-full rounded-full ${config.bg.replace("100", "500")}`}
                                                style={{ width: `${percentage}%`, background: config.color.includes("teal") ? "#0d9488" : undefined }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div
                        className="rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
                        style={{ background: theme === "dark" ? "#1a1a1a" : "white" }}
                    >
                        <div
                            className="px-6 py-4 border-b flex items-center justify-between"
                            style={{ borderColor: theme === "dark" ? "#333" : "#f3f4f6" }}
                        >
                            <div>
                                <h2
                                    className="text-lg font-semibold"
                                    style={{ color: theme === "dark" ? "#fff" : "#111827" }}
                                >
                                    Confirm Receipt Details
                                </h2>
                                <p
                                    className="text-sm"
                                    style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}
                                >
                                    {uploadForm.fileName}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowUploadModal(false);
                                    resetUploadForm();
                                }}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}
                            >
                                {icons.close}
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* AI Extraction Notice */}
                            <div
                                className="rounded-xl p-4 flex items-start gap-3"
                                style={{ background: theme === "dark" ? "#0a0a0a" : "#f0fdf4" }}
                            >
                                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">
                                    {icons.ai}
                                </div>
                                <div>
                                    <p
                                        className="text-sm font-medium"
                                        style={{ color: theme === "dark" ? "#86efac" : "#166534" }}
                                    >
                                        AI extracted data from your receipt
                                    </p>
                                    <p
                                        className="text-xs"
                                        style={{ color: theme === "dark" ? "#6b7280" : "#2264ff" }}
                                    >
                                        Please verify and correct any details below
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label
                                        className="block text-sm font-medium mb-2"
                                        style={{ color: theme === "dark" ? "#d1d5db" : "#374151" }}
                                    >
                                        Vendor *
                                    </label>
                                    <input
                                        type="text"
                                        value={uploadForm.vendor}
                                        onChange={e => setUploadForm(prev => ({ ...prev, vendor: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-lg border text-sm"
                                        style={{
                                            background: theme === "dark" ? "#0a0a0a" : "white",
                                            borderColor: theme === "dark" ? "#333" : "#d1d5db",
                                            color: theme === "dark" ? "#fff" : "#111827",
                                        }}
                                        placeholder="Vendor name"
                                    />
                                </div>
                                <div>
                                    <label
                                        className="block text-sm font-medium mb-2"
                                        style={{ color: theme === "dark" ? "#d1d5db" : "#374151" }}
                                    >
                                        Amount *
                                    </label>
                                    <input
                                        type="number"
                                        value={uploadForm.amount}
                                        onChange={e => setUploadForm(prev => ({ ...prev, amount: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-lg border text-sm"
                                        style={{
                                            background: theme === "dark" ? "#0a0a0a" : "white",
                                            borderColor: theme === "dark" ? "#333" : "#d1d5db",
                                            color: theme === "dark" ? "#fff" : "#111827",
                                        }}
                                        placeholder="Amount"
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label
                                        className="block text-sm font-medium mb-2"
                                        style={{ color: theme === "dark" ? "#d1d5db" : "#374151" }}
                                    >
                                        Date
                                    </label>
                                    <input
                                        type="date"
                                        value={uploadForm.date}
                                        onChange={e => setUploadForm(prev => ({ ...prev, date: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-lg border text-sm"
                                        style={{
                                            background: theme === "dark" ? "#0a0a0a" : "white",
                                            borderColor: theme === "dark" ? "#333" : "#d1d5db",
                                            color: theme === "dark" ? "#fff" : "#111827",
                                        }}
                                    />
                                </div>
                                <div>
                                    <label
                                        className="block text-sm font-medium mb-2"
                                        style={{ color: theme === "dark" ? "#d1d5db" : "#374151" }}
                                    >
                                        Category
                                    </label>
                                    <select
                                        value={uploadForm.category}
                                        onChange={e => setUploadForm(prev => ({ ...prev, category: e.target.value as ReceiptCategory }))}
                                        className="w-full px-4 py-2.5 rounded-lg border text-sm"
                                        style={{
                                            background: theme === "dark" ? "#0a0a0a" : "white",
                                            borderColor: theme === "dark" ? "#333" : "#d1d5db",
                                            color: theme === "dark" ? "#fff" : "#111827",
                                        }}
                                    >
                                        {Object.entries(categoryConfig).map(([key, config]) => (
                                            <option key={key} value={key}>
                                                {config.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label
                                    className="block text-sm font-medium mb-2"
                                    style={{ color: theme === "dark" ? "#d1d5db" : "#374151" }}
                                >
                                    Description (optional)
                                </label>
                                <textarea
                                    value={uploadForm.description}
                                    onChange={e => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full px-4 py-2.5 rounded-lg border text-sm resize-none"
                                    style={{
                                        background: theme === "dark" ? "#0a0a0a" : "white",
                                        borderColor: theme === "dark" ? "#333" : "#d1d5db",
                                        color: theme === "dark" ? "#fff" : "#111827",
                                    }}
                                    rows={2}
                                    placeholder="Add notes about this expense..."
                                />
                            </div>
                        </div>

                        <div
                            className="px-6 py-4 border-t flex justify-end gap-3"
                            style={{ borderColor: theme === "dark" ? "#333" : "#f3f4f6" }}
                        >
                            <button
                                onClick={() => {
                                    setShowUploadModal(false);
                                    resetUploadForm();
                                }}
                                className="px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
                                style={{
                                    background: theme === "dark" ? "#333" : "#f3f4f6",
                                    color: theme === "dark" ? "#fff" : "#374151",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveReceipt}
                                disabled={!uploadForm.vendor || !uploadForm.amount}
                                className="px-4 py-2.5 rounded-lg font-semibold text-sm bg-[#2264ff] text-white hover:bg-[#1a50cc] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save Receipt
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && selectedReceipt && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div
                        className="rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
                        style={{ background: theme === "dark" ? "#1a1a1a" : "white" }}
                    >
                        <div
                            className="px-6 py-4 border-b flex items-center justify-between"
                            style={{ borderColor: theme === "dark" ? "#333" : "#f3f4f6" }}
                        >
                            <h2
                                className="text-lg font-semibold"
                                style={{ color: theme === "dark" ? "#fff" : "#111827" }}
                            >
                                Edit Receipt
                            </h2>
                            <button
                                onClick={() => {
                                    setShowEditModal(false);
                                    setSelectedReceipt(null);
                                }}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}
                            >
                                {icons.close}
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label
                                        className="block text-sm font-medium mb-2"
                                        style={{ color: theme === "dark" ? "#d1d5db" : "#374151" }}
                                    >
                                        Vendor *
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.vendor}
                                        onChange={e => setEditForm(prev => ({ ...prev, vendor: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-lg border text-sm"
                                        style={{
                                            background: theme === "dark" ? "#0a0a0a" : "white",
                                            borderColor: theme === "dark" ? "#333" : "#d1d5db",
                                            color: theme === "dark" ? "#fff" : "#111827",
                                        }}
                                    />
                                </div>
                                <div>
                                    <label
                                        className="block text-sm font-medium mb-2"
                                        style={{ color: theme === "dark" ? "#d1d5db" : "#374151" }}
                                    >
                                        Amount *
                                    </label>
                                    <input
                                        type="number"
                                        value={editForm.amount}
                                        onChange={e => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-lg border text-sm"
                                        style={{
                                            background: theme === "dark" ? "#0a0a0a" : "white",
                                            borderColor: theme === "dark" ? "#333" : "#d1d5db",
                                            color: theme === "dark" ? "#fff" : "#111827",
                                        }}
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label
                                        className="block text-sm font-medium mb-2"
                                        style={{ color: theme === "dark" ? "#d1d5db" : "#374151" }}
                                    >
                                        Date
                                    </label>
                                    <input
                                        type="date"
                                        value={editForm.date}
                                        onChange={e => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-lg border text-sm"
                                        style={{
                                            background: theme === "dark" ? "#0a0a0a" : "white",
                                            borderColor: theme === "dark" ? "#333" : "#d1d5db",
                                            color: theme === "dark" ? "#fff" : "#111827",
                                        }}
                                    />
                                </div>
                                <div>
                                    <label
                                        className="block text-sm font-medium mb-2"
                                        style={{ color: theme === "dark" ? "#d1d5db" : "#374151" }}
                                    >
                                        Category
                                    </label>
                                    <select
                                        value={editForm.category}
                                        onChange={e => setEditForm(prev => ({ ...prev, category: e.target.value as ReceiptCategory }))}
                                        className="w-full px-4 py-2.5 rounded-lg border text-sm"
                                        style={{
                                            background: theme === "dark" ? "#0a0a0a" : "white",
                                            borderColor: theme === "dark" ? "#333" : "#d1d5db",
                                            color: theme === "dark" ? "#fff" : "#111827",
                                        }}
                                    >
                                        {Object.entries(categoryConfig).map(([key, config]) => (
                                            <option key={key} value={key}>
                                                {config.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label
                                    className="block text-sm font-medium mb-2"
                                    style={{ color: theme === "dark" ? "#d1d5db" : "#374151" }}
                                >
                                    Description
                                </label>
                                <textarea
                                    value={editForm.description}
                                    onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full px-4 py-2.5 rounded-lg border text-sm resize-none"
                                    style={{
                                        background: theme === "dark" ? "#0a0a0a" : "white",
                                        borderColor: theme === "dark" ? "#333" : "#d1d5db",
                                        color: theme === "dark" ? "#fff" : "#111827",
                                    }}
                                    rows={2}
                                />
                            </div>
                        </div>

                        <div
                            className="px-6 py-4 border-t flex justify-end gap-3"
                            style={{ borderColor: theme === "dark" ? "#333" : "#f3f4f6" }}
                        >
                            <button
                                onClick={() => {
                                    setShowEditModal(false);
                                    setSelectedReceipt(null);
                                }}
                                className="px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
                                style={{
                                    background: theme === "dark" ? "#333" : "#f3f4f6",
                                    color: theme === "dark" ? "#fff" : "#374151",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={!editForm.vendor || !editForm.amount}
                                className="px-4 py-2.5 rounded-lg font-semibold text-sm bg-[#2264ff] text-white hover:bg-[#1a50cc] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
