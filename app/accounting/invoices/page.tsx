"use client";

import { useState, useEffect, useMemo } from "react";
import { useTheme } from "@/lib/ThemeContext";

// =============================================================================
// TYPES
// =============================================================================

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface InvoiceLineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
}

export interface Invoice {
    id: string;
    invoiceNumber: string;
    customerName: string;
    customerEmail: string;
    issueDate: string;
    dueDate: string;
    status: InvoiceStatus;
    lineItems: InvoiceLineItem[];
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

// =============================================================================
// ICONS
// =============================================================================

const icons = {
    invoice: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    ),
    plus: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
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
    send: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
    ),
    eye: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
    ),
    clock: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    money: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    alert: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
    ),
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function InvoiceManagementPage() {
    const { theme } = useTheme();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [filterStatus, setFilterStatus] = useState<InvoiceStatus | "all">("all");

    // Form state
    const [formData, setFormData] = useState({
        customerName: "",
        customerEmail: "",
        dueDate: "",
        notes: "",
        taxRate: 7.5,
    });
    const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
        { id: "1", description: "", quantity: 1, unitPrice: 0, amount: 0 },
    ]);

    // Load invoices from localStorage
    useEffect(() => {
        const loadInvoices = () => {
            setIsLoading(true);
            try {
                const saved = localStorage.getItem("insight::invoices");
                if (saved) {
                    setInvoices(JSON.parse(saved));
                }
            } catch (e) {
                console.error("Failed to load invoices:", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadInvoices();
    }, []);

    // Save invoices to localStorage
    useEffect(() => {
        if (!isLoading && invoices.length >= 0) {
            localStorage.setItem("insight::invoices", JSON.stringify(invoices));
        }
    }, [invoices, isLoading]);

    // Stats calculation
    const stats = useMemo(() => {
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();

        return {
            totalOutstanding: invoices
                .filter(inv => inv.status === "sent" || inv.status === "overdue")
                .reduce((sum, inv) => sum + inv.total, 0),
            paidThisMonth: invoices
                .filter(inv => {
                    if (inv.status !== "paid") return false;
                    const invDate = new Date(inv.updatedAt);
                    return invDate.getMonth() === thisMonth && invDate.getFullYear() === thisYear;
                })
                .reduce((sum, inv) => sum + inv.total, 0),
            overdueAmount: invoices
                .filter(inv => inv.status === "overdue")
                .reduce((sum, inv) => sum + inv.total, 0),
            totalInvoices: invoices.length,
        };
    }, [invoices]);

    // Filter invoices
    const filteredInvoices = useMemo(() => {
        if (filterStatus === "all") return invoices;
        return invoices.filter(inv => inv.status === filterStatus);
    }, [invoices, filterStatus]);

    // Generate invoice number
    const generateInvoiceNumber = () => {
        const year = new Date().getFullYear();
        const count = invoices.length + 1;
        return `INV-${year}-${String(count).padStart(4, "0")}`;
    };

    // Calculate line item totals
    const updateLineItem = (id: string, field: keyof InvoiceLineItem, value: string | number) => {
        setLineItems(prev =>
            prev.map(item => {
                if (item.id !== id) return item;
                const updated = { ...item, [field]: value };
                if (field === "quantity" || field === "unitPrice") {
                    updated.amount = updated.quantity * updated.unitPrice;
                }
                return updated;
            })
        );
    };

    const addLineItem = () => {
        setLineItems(prev => [
            ...prev,
            { id: Date.now().toString(), description: "", quantity: 1, unitPrice: 0, amount: 0 },
        ]);
    };

    const removeLineItem = (id: string) => {
        if (lineItems.length > 1) {
            setLineItems(prev => prev.filter(item => item.id !== id));
        }
    };

    // Calculate totals
    const invoiceTotals = useMemo(() => {
        const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
        const taxAmount = subtotal * (formData.taxRate / 100);
        const total = subtotal + taxAmount;
        return { subtotal, taxAmount, total };
    }, [lineItems, formData.taxRate]);

    // Create invoice
    const handleCreateInvoice = () => {
        if (!formData.customerName || !formData.dueDate) return;

        const validItems = lineItems.filter(item => item.description && item.amount > 0);
        if (validItems.length === 0) return;

        const newInvoice: Invoice = {
            id: `inv_${Date.now()}`,
            invoiceNumber: generateInvoiceNumber(),
            customerName: formData.customerName,
            customerEmail: formData.customerEmail,
            issueDate: new Date().toISOString(),
            dueDate: formData.dueDate,
            status: "draft",
            lineItems: validItems,
            subtotal: invoiceTotals.subtotal,
            taxRate: formData.taxRate,
            taxAmount: invoiceTotals.taxAmount,
            total: invoiceTotals.total,
            notes: formData.notes,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        setInvoices(prev => [newInvoice, ...prev]);
        resetForm();
        setShowCreateModal(false);
    };

    const resetForm = () => {
        setFormData({
            customerName: "",
            customerEmail: "",
            dueDate: "",
            notes: "",
            taxRate: 7.5,
        });
        setLineItems([{ id: "1", description: "", quantity: 1, unitPrice: 0, amount: 0 }]);
    };

    // Update invoice status
    const updateStatus = (invoiceId: string, newStatus: InvoiceStatus) => {
        setInvoices(prev =>
            prev.map(inv =>
                inv.id === invoiceId
                    ? { ...inv, status: newStatus, updatedAt: new Date().toISOString() }
                    : inv
            )
        );
    };

    // Delete invoice
    const deleteInvoice = (invoiceId: string) => {
        if (confirm("Are you sure you want to delete this invoice?")) {
            setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
        }
    };

    // Format currency
    const formatCurrency = (amount: number) => `₦${amount.toLocaleString()}`;
    const formatDate = (date: string) =>
        new Date(date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

    // Status badge styles
    const getStatusStyle = (status: InvoiceStatus) => {
        const styles: Record<InvoiceStatus, { bg: string; text: string; dot: string }> = {
            draft: { bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-500" },
            sent: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
            paid: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
            overdue: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
            cancelled: { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" },
        };
        return styles[status];
    };

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
            <div
                className="rounded-2xl border px-6 py-6"
                style={{
                    background: theme === "dark" ? "#1a1a1a" : "white",
                    borderColor: theme === "dark" ? "#333" : "#e5e7eb",
                }}
            >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                            {icons.invoice}
                        </div>
                        <div>
                            <h1
                                className="text-xl font-bold"
                                style={{ color: theme === "dark" ? "#fff" : "#111827" }}
                            >
                                Invoice Management
                            </h1>
                            <p
                                className="text-sm"
                                style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}
                            >
                                Create and manage sales invoices
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="inline-flex items-center gap-2 bg-[#2264ff] text-white px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#1a50cc] transition-colors"
                    >
                        {icons.plus}
                        Create Invoice
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    {
                        label: "Outstanding",
                        value: formatCurrency(stats.totalOutstanding),
                        icon: icons.clock,
                        color: "text-amber-600",
                        bg: "bg-amber-100",
                    },
                    {
                        label: "Paid This Month",
                        value: formatCurrency(stats.paidThisMonth),
                        icon: icons.money,
                        color: "text-blue-600",
                        bg: "bg-blue-100",
                    },
                    {
                        label: "Overdue",
                        value: formatCurrency(stats.overdueAmount),
                        icon: icons.alert,
                        color: "text-red-600",
                        bg: "bg-red-100",
                    },
                    {
                        label: "Total Invoices",
                        value: stats.totalInvoices.toString(),
                        icon: icons.invoice,
                        color: "text-blue-600",
                        bg: "bg-blue-100",
                    },
                ].map((stat, i) => (
                    <div
                        key={i}
                        className="rounded-2xl border p-5"
                        style={{
                            background: theme === "dark" ? "#1a1a1a" : "white",
                            borderColor: theme === "dark" ? "#333" : "#f3f4f6",
                        }}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center ${stat.color}`}>
                                {stat.icon}
                            </div>
                            <span style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }} className="text-sm">
                                {stat.label}
                            </span>
                        </div>
                        <p
                            className="text-2xl font-bold"
                            style={{ color: theme === "dark" ? "#fff" : "#111827" }}
                        >
                            {stat.value}
                        </p>
                    </div>
                ))}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {(["all", "draft", "sent", "paid", "overdue", "cancelled"] as const).map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === status
                            ? "bg-[#2264ff] text-white"
                            : theme === "dark"
                                ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                    >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                ))}
            </div>

            {/* Invoice List */}
            <div
                className="rounded-2xl border overflow-hidden"
                style={{
                    background: theme === "dark" ? "#1a1a1a" : "white",
                    borderColor: theme === "dark" ? "#333" : "#f3f4f6",
                }}
            >
                {filteredInvoices.length === 0 ? (
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
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                            </svg>
                        </div>
                        <h3
                            className="text-lg font-semibold mb-2"
                            style={{ color: theme === "dark" ? "#fff" : "#111827" }}
                        >
                            No invoices yet
                        </h3>
                        <p style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }} className="mb-6 max-w-sm mx-auto">
                            Create your first invoice to start tracking your sales and payments.
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center gap-2 bg-[#2264ff] text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#1a50cc] transition-colors"
                        >
                            {icons.plus}
                            Create Your First Invoice
                        </button>
                    </div>
                ) : (
                    <div className="divide-y" style={{ borderColor: theme === "dark" ? "#333" : "#f3f4f6" }}>
                        {filteredInvoices.map(invoice => {
                            const statusStyle = getStatusStyle(invoice.status);
                            return (
                                <div
                                    key={invoice.id}
                                    className="p-5 hover:bg-opacity-50 transition-colors"
                                    style={{
                                        background: theme === "dark" ? "transparent" : "transparent",
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span
                                                    className="font-mono font-semibold text-sm"
                                                    style={{ color: theme === "dark" ? "#2264ff" : "#2563eb" }}
                                                >
                                                    {invoice.invoiceNumber}
                                                </span>
                                                <span
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                                                >
                                                    <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                                                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                                                </span>
                                            </div>
                                            <h3
                                                className="font-semibold truncate"
                                                style={{ color: theme === "dark" ? "#fff" : "#111827" }}
                                            >
                                                {invoice.customerName}
                                            </h3>
                                            <p
                                                className="text-sm mt-1"
                                                style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}
                                            >
                                                Due: {formatDate(invoice.dueDate)} • {invoice.lineItems.length} item
                                                {invoice.lineItems.length !== 1 ? "s" : ""}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p
                                                className="text-lg font-bold"
                                                style={{ color: theme === "dark" ? "#fff" : "#111827" }}
                                            >
                                                {formatCurrency(invoice.total)}
                                            </p>
                                            <div className="flex items-center gap-1 mt-2">
                                                <button
                                                    onClick={() => {
                                                        setSelectedInvoice(invoice);
                                                        setShowPreviewModal(true);
                                                    }}
                                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                                    title="Preview"
                                                >
                                                    {icons.eye}
                                                </button>
                                                {invoice.status === "draft" && (
                                                    <button
                                                        onClick={() => updateStatus(invoice.id, "sent")}
                                                        className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                                                        title="Mark as Sent"
                                                    >
                                                        {icons.send}
                                                    </button>
                                                )}
                                                {(invoice.status === "sent" || invoice.status === "overdue") && (
                                                    <button
                                                        onClick={() => updateStatus(invoice.id, "paid")}
                                                        className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                                                        title="Mark as Paid"
                                                    >
                                                        {icons.check}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => deleteInvoice(invoice.id)}
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

            {/* Create Invoice Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div
                        className="rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
                        style={{ background: theme === "dark" ? "#1a1a1a" : "white" }}
                    >
                        <div
                            className="px-6 py-4 border-b flex items-center justify-between sticky top-0"
                            style={{
                                background: theme === "dark" ? "#1a1a1a" : "white",
                                borderColor: theme === "dark" ? "#333" : "#f3f4f6",
                            }}
                        >
                            <h2
                                className="text-lg font-semibold"
                                style={{ color: theme === "dark" ? "#fff" : "#111827" }}
                            >
                                Create Invoice
                            </h2>
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    resetForm();
                                }}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}
                            >
                                {icons.close}
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Customer Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label
                                        className="block text-sm font-medium mb-2"
                                        style={{ color: theme === "dark" ? "#d1d5db" : "#374151" }}
                                    >
                                        Customer Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.customerName}
                                        onChange={e => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-lg border text-sm"
                                        style={{
                                            background: theme === "dark" ? "#0a0a0a" : "white",
                                            borderColor: theme === "dark" ? "#333" : "#d1d5db",
                                            color: theme === "dark" ? "#fff" : "#111827",
                                        }}
                                        placeholder="Enter customer name"
                                    />
                                </div>
                                <div>
                                    <label
                                        className="block text-sm font-medium mb-2"
                                        style={{ color: theme === "dark" ? "#d1d5db" : "#374151" }}
                                    >
                                        Customer Email
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.customerEmail}
                                        onChange={e => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-lg border text-sm"
                                        style={{
                                            background: theme === "dark" ? "#0a0a0a" : "white",
                                            borderColor: theme === "dark" ? "#333" : "#d1d5db",
                                            color: theme === "dark" ? "#fff" : "#111827",
                                        }}
                                        placeholder="customer@email.com"
                                    />
                                </div>
                            </div>

                            {/* Due Date */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label
                                        className="block text-sm font-medium mb-2"
                                        style={{ color: theme === "dark" ? "#d1d5db" : "#374151" }}
                                    >
                                        Due Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.dueDate}
                                        onChange={e => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
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
                                        VAT Rate (%)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.taxRate}
                                        onChange={e => setFormData(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                                        className="w-full px-4 py-2.5 rounded-lg border text-sm"
                                        style={{
                                            background: theme === "dark" ? "#0a0a0a" : "white",
                                            borderColor: theme === "dark" ? "#333" : "#d1d5db",
                                            color: theme === "dark" ? "#fff" : "#111827",
                                        }}
                                        step="0.5"
                                        min="0"
                                    />
                                </div>
                            </div>

                            {/* Line Items */}
                            <div>
                                <label
                                    className="block text-sm font-medium mb-3"
                                    style={{ color: theme === "dark" ? "#d1d5db" : "#374151" }}
                                >
                                    Line Items
                                </label>
                                <div className="space-y-3">
                                    {lineItems.map((item, index) => (
                                        <div
                                            key={item.id}
                                            className="grid grid-cols-12 gap-2 items-center rounded-xl p-3"
                                            style={{ background: theme === "dark" ? "#0a0a0a" : "#f9fafb" }}
                                        >
                                            <div className="col-span-5">
                                                <input
                                                    type="text"
                                                    value={item.description}
                                                    onChange={e => updateLineItem(item.id, "description", e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                                    style={{
                                                        background: theme === "dark" ? "#1a1a1a" : "white",
                                                        borderColor: theme === "dark" ? "#333" : "#d1d5db",
                                                        color: theme === "dark" ? "#fff" : "#111827",
                                                    }}
                                                    placeholder="Description"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={e => updateLineItem(item.id, "quantity", parseInt(e.target.value) || 0)}
                                                    className="w-full px-3 py-2 rounded-lg border text-sm text-center"
                                                    style={{
                                                        background: theme === "dark" ? "#1a1a1a" : "white",
                                                        borderColor: theme === "dark" ? "#333" : "#d1d5db",
                                                        color: theme === "dark" ? "#fff" : "#111827",
                                                    }}
                                                    placeholder="Qty"
                                                    min="1"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <input
                                                    type="number"
                                                    value={item.unitPrice}
                                                    onChange={e => updateLineItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                                    style={{
                                                        background: theme === "dark" ? "#1a1a1a" : "white",
                                                        borderColor: theme === "dark" ? "#333" : "#d1d5db",
                                                        color: theme === "dark" ? "#fff" : "#111827",
                                                    }}
                                                    placeholder="Price"
                                                    min="0"
                                                />
                                            </div>
                                            <div className="col-span-2 text-right font-medium" style={{ color: theme === "dark" ? "#fff" : "#111827" }}>
                                                {formatCurrency(item.amount)}
                                            </div>
                                            <div className="col-span-1 text-center">
                                                {lineItems.length > 1 && (
                                                    <button
                                                        onClick={() => removeLineItem(item.id)}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                                                    >
                                                        {icons.trash}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={addLineItem}
                                    className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#2264ff] hover:text-[#1a50cc] transition-colors"
                                >
                                    {icons.plus}
                                    Add Line Item
                                </button>
                            </div>

                            {/* Notes */}
                            <div>
                                <label
                                    className="block text-sm font-medium mb-2"
                                    style={{ color: theme === "dark" ? "#d1d5db" : "#374151" }}
                                >
                                    Notes
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full px-4 py-2.5 rounded-lg border text-sm resize-none"
                                    style={{
                                        background: theme === "dark" ? "#0a0a0a" : "white",
                                        borderColor: theme === "dark" ? "#333" : "#d1d5db",
                                        color: theme === "dark" ? "#fff" : "#111827",
                                    }}
                                    rows={3}
                                    placeholder="Additional notes or payment instructions..."
                                />
                            </div>

                            {/* Totals */}
                            <div
                                className="rounded-xl p-4 space-y-2"
                                style={{ background: theme === "dark" ? "#0a0a0a" : "#f9fafb" }}
                            >
                                <div className="flex justify-between text-sm">
                                    <span style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}>Subtotal</span>
                                    <span style={{ color: theme === "dark" ? "#fff" : "#111827" }}>{formatCurrency(invoiceTotals.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}>VAT ({formData.taxRate}%)</span>
                                    <span style={{ color: theme === "dark" ? "#fff" : "#111827" }}>{formatCurrency(invoiceTotals.taxAmount)}</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold pt-2 border-t" style={{ borderColor: theme === "dark" ? "#333" : "#e5e7eb" }}>
                                    <span style={{ color: theme === "dark" ? "#fff" : "#111827" }}>Total</span>
                                    <span style={{ color: "#2264ff" }}>{formatCurrency(invoiceTotals.total)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div
                            className="px-6 py-4 border-t flex justify-end gap-3"
                            style={{ borderColor: theme === "dark" ? "#333" : "#f3f4f6" }}
                        >
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    resetForm();
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
                                onClick={handleCreateInvoice}
                                disabled={!formData.customerName || !formData.dueDate || invoiceTotals.subtotal <= 0}
                                className="px-4 py-2.5 rounded-lg font-semibold text-sm bg-[#2264ff] text-white hover:bg-[#1a50cc] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Create Invoice
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {showPreviewModal && selectedInvoice && (
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
                                {selectedInvoice.invoiceNumber}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowPreviewModal(false);
                                    setSelectedInvoice(null);
                                }}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}
                            >
                                {icons.close}
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <p className="text-sm" style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}>Customer</p>
                                <p className="font-semibold" style={{ color: theme === "dark" ? "#fff" : "#111827" }}>{selectedInvoice.customerName}</p>
                                {selectedInvoice.customerEmail && (
                                    <p className="text-sm" style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}>{selectedInvoice.customerEmail}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm" style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}>Issue Date</p>
                                    <p className="font-medium" style={{ color: theme === "dark" ? "#fff" : "#111827" }}>{formatDate(selectedInvoice.issueDate)}</p>
                                </div>
                                <div>
                                    <p className="text-sm" style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}>Due Date</p>
                                    <p className="font-medium" style={{ color: theme === "dark" ? "#fff" : "#111827" }}>{formatDate(selectedInvoice.dueDate)}</p>
                                </div>
                            </div>

                            <div
                                className="rounded-xl overflow-hidden border"
                                style={{ borderColor: theme === "dark" ? "#333" : "#e5e7eb" }}
                            >
                                <table className="w-full text-sm">
                                    <thead style={{ background: theme === "dark" ? "#0a0a0a" : "#f9fafb" }}>
                                        <tr>
                                            <th className="text-left px-4 py-2 font-medium" style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}>Item</th>
                                            <th className="text-center px-4 py-2 font-medium" style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}>Qty</th>
                                            <th className="text-right px-4 py-2 font-medium" style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedInvoice.lineItems.map((item, idx) => (
                                            <tr key={idx} style={{ borderTop: `1px solid ${theme === "dark" ? "#333" : "#e5e7eb"}` }}>
                                                <td className="px-4 py-2" style={{ color: theme === "dark" ? "#fff" : "#111827" }}>{item.description}</td>
                                                <td className="text-center px-4 py-2" style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}>{item.quantity}</td>
                                                <td className="text-right px-4 py-2 font-mono" style={{ color: theme === "dark" ? "#fff" : "#111827" }}>{formatCurrency(item.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}>Subtotal</span>
                                    <span style={{ color: theme === "dark" ? "#fff" : "#111827" }}>{formatCurrency(selectedInvoice.subtotal)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}>VAT ({selectedInvoice.taxRate}%)</span>
                                    <span style={{ color: theme === "dark" ? "#fff" : "#111827" }}>{formatCurrency(selectedInvoice.taxAmount)}</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold pt-2">
                                    <span style={{ color: theme === "dark" ? "#fff" : "#111827" }}>Total</span>
                                    <span style={{ color: "#2264ff" }}>{formatCurrency(selectedInvoice.total)}</span>
                                </div>
                            </div>

                            {selectedInvoice.notes && (
                                <div
                                    className="rounded-lg p-3 text-sm"
                                    style={{ background: theme === "dark" ? "#0a0a0a" : "#f9fafb" }}
                                >
                                    <p className="font-medium mb-1" style={{ color: theme === "dark" ? "#9ca3af" : "#6b7280" }}>Notes</p>
                                    <p style={{ color: theme === "dark" ? "#fff" : "#111827" }}>{selectedInvoice.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
