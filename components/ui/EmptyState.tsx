"use client";

import React from "react";
import Link from "next/link";

// ============================================
// EMPTY STATE COMPONENT
// ============================================

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    actionLabel?: string;
    actionHref?: string;
    onAction?: () => void;
    variant?: "default" | "minimal" | "large";
    className?: string;
}

/**
 * Reusable empty state component with various styles
 */
export function EmptyState({
    icon,
    title,
    description,
    actionLabel,
    actionHref,
    onAction,
    variant = "default",
    className = "",
}: EmptyStateProps) {
    const sizeClasses = {
        minimal: "py-6",
        default: "py-12",
        large: "py-20",
    };

    const iconSizeClasses = {
        minimal: "w-10 h-10",
        default: "w-16 h-16",
        large: "w-24 h-24",
    };

    return (
        <div className={`flex flex-col items-center justify-center text-center ${sizeClasses[variant]} ${className}`}>
            {/* Icon */}
            {icon ? (
                <div className={`${iconSizeClasses[variant]} text-gray-300 dark:text-gray-600 mb-4`}>
                    {icon}
                </div>
            ) : (
                <div className={`${iconSizeClasses[variant]} rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4`}>
                    <svg className="w-1/2 h-1/2 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                </div>
            )}

            {/* Title */}
            <h3 className={`font-semibold text-gray-900 dark:text-white ${variant === "large" ? "text-xl" : "text-base"}`}>
                {title}
            </h3>

            {/* Description */}
            {description && (
                <p className={`text-gray-500 dark:text-gray-400 mt-1 max-w-sm ${variant === "large" ? "text-base" : "text-sm"}`}>
                    {description}
                </p>
            )}

            {/* Action Button */}
            {(actionLabel && (actionHref || onAction)) && (
                <div className="mt-4">
                    {actionHref ? (
                        <Link
                            href={actionHref}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            {actionLabel}
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </Link>
                    ) : (
                        <button
                            onClick={onAction}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            {actionLabel}
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================
// PRE-BUILT EMPTY STATE VARIANTS
// ============================================

export function EmptyTransactions({ onAdd }: { onAdd?: () => void }) {
    return (
        <EmptyState
            icon={
                <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
            }
            title="No transactions yet"
            description="Start by recording your first transaction or import from your bank."
            actionLabel="Add Transaction"
            onAction={onAdd}
        />
    );
}

export function EmptyChat() {
    return (
        <EmptyState
            icon={
                <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            }
            title="Start a conversation"
            description="Ask anything about your finances, record transactions, or get insights."
            variant="minimal"
        />
    );
}

export function EmptyInventory({ onAdd }: { onAdd?: () => void }) {
    return (
        <EmptyState
            icon={
                <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
            }
            title="No products yet"
            description="Add your first product to start tracking inventory."
            actionLabel="Add Product"
            onAction={onAdd}
        />
    );
}

export function EmptyAutomations({ onAdd }: { onAdd?: () => void }) {
    return (
        <EmptyState
            icon={
                <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            }
            title="No automations set up"
            description="Create rules to automatically categorize transactions and trigger actions."
            actionLabel="Create Automation"
            onAction={onAdd}
        />
    );
}

export function EmptyDocuments({ onUpload }: { onUpload?: () => void }) {
    return (
        <EmptyState
            icon={
                <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
            }
            title="No documents uploaded"
            description="Upload receipts, invoices, or statements for AI-powered extraction."
            actionLabel="Upload Document"
            onAction={onUpload}
        />
    );
}

export function EmptySearch({ query }: { query?: string }) {
    return (
        <EmptyState
            icon={
                <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            }
            title="No results found"
            description={query ? `No matches for "${query}". Try a different search term.` : "Try adjusting your search or filters."}
            variant="minimal"
        />
    );
}
