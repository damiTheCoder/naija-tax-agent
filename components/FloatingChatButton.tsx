"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { accountingEngine, parseTransactionFromChat } from "@/lib/accounting/transactionBridge";
import { RawTransaction, TransactionType } from "@/lib/accounting/types";
import { taxEngine, detectTaxType } from "@/lib/tax/taxEngine";

type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
};

export default function FloatingChatButton() {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: "intro",
            role: "assistant",
            content: "Hi! Enter your transactions in natural language and I'll help you record them.\n\nExamples:\n• \"Sold goods for ₦50,000\"\n• \"Paid rent ₦150,000\"\n• \"Bought office supplies ₦5,000\"",
            timestamp: Date.now(),
        },
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Load accounting engine state on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            accountingEngine.load();
            taxEngine.load();
        }
    }, []);

    // Animate the "Chat" text - slide in/out every 5 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setIsExpanded(prev => !prev);
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            const nextHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 24), 120);
            textareaRef.current.style.height = `${nextHeight}px`;
        }
    }, [inputValue]);

    // Scroll to bottom when messages change
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Focus input when modal opens
    useEffect(() => {
        if (isModalOpen && textareaRef.current) {
            setTimeout(() => textareaRef.current?.focus(), 100);
        }
    }, [isModalOpen]);

    const appendMessage = useCallback((role: ChatMessage["role"], content: string) => {
        setMessages(prev => [
            ...prev,
            {
                id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                role,
                content,
                timestamp: Date.now(),
            },
        ]);
    }, []);

    const handleSend = useCallback(async () => {
        const trimmed = inputValue.trim();
        if (!trimmed || isLoading) return;

        appendMessage("user", trimmed);
        setInputValue("");
        setIsLoading(true);

        try {
            // Try to parse transaction from natural language
            const parsedTx = parseTransactionFromChat(trimmed);

            if (parsedTx && parsedTx.amount && parsedTx.amount > 0) {
                // Map parsedType to transaction type
                const typeMap: Record<string, TransactionType> = {
                    'sale': 'income',
                    'receipt': 'income',
                    'purchase': 'expense',
                    'expense': 'expense',
                    'payment': 'liability',
                    'transfer': 'asset',
                    'asset': 'asset',
                    'equity': 'equity',
                    'loan': 'liability',
                    'other': 'expense',
                };

                // Map category to proper transaction type
                const categoryToType: Record<string, TransactionType> = {
                    'sales': 'income',
                    'service': 'income',
                    'receipt': 'income',
                    'purchases': 'expense',
                    'rent': 'expense',
                    'salary': 'expense',
                    'utilities': 'expense',
                    'transport': 'expense',
                    'expense': 'expense',
                    'asset': 'asset',
                    'capital': 'equity',
                    'drawing': 'equity',
                    'loan-received': 'liability',
                    'loan-repayment': 'liability',
                    'supplier-payment': 'liability',
                    'payment': 'liability',
                    'transfer': 'asset',
                };

                const transactionType = categoryToType[parsedTx.category || ''] || typeMap[parsedTx.parsedType] || 'expense';

                const newTransaction: RawTransaction = {
                    id: `chat-${Date.now()}`,
                    date: new Date().toISOString().split("T")[0],
                    description: parsedTx.description || trimmed.substring(0, 150),
                    category: parsedTx.category || "other",
                    amount: parsedTx.amount,
                    type: transactionType,
                };

                // Show confidence indicator
                const confidenceText = parsedTx.confidence >= 0.9 ? "✓ High confidence" :
                    parsedTx.confidence >= 0.7 ? "⚡ Medium confidence" : "⚠️ Low confidence";

                const results: string[] = [];

                // 1. Process through Enhanced Accounting Engine (word-by-word analysis)
                try {
                    // Use enhanced processor with word-by-word sentence analysis
                    const accountingResult = accountingEngine.processTransactionEnhanced(newTransaction);
                    accountingEngine.generateStatements();

                    // Show detailed account detection
                    const debitLine = accountingResult.journalEntry.lines.find(l => l.debit > 0);
                    const creditLine = accountingResult.journalEntry.lines.find(l => l.credit > 0);
                    const confidence = Math.round((accountingResult.analysis.debitAccount.confidence + accountingResult.analysis.creditAccount.confidence) / 2 * 100);

                    results.push(`📚 **Accounting** (${confidence}% confidence): ${accountingResult.journalEntry.id}`);
                    results.push(`   DR: ${debitLine?.accountName} ₦${debitLine?.debit.toLocaleString()}`);
                    results.push(`   CR: ${creditLine?.accountName} ₦${creditLine?.credit.toLocaleString()}`);
                } catch (err) {
                    console.error("[Chat] Accounting error:", err);
                    results.push("📚 **Accounting**: Could not post (check manually)");
                }

                // 2. Process through Tax Engine
                try {
                    const taxDetection = detectTaxType(
                        parsedTx.description || trimmed,
                        parsedTx.amount,
                        parsedTx.category
                    );
                    const taxResult = taxEngine.processTransaction({
                        date: new Date().toISOString().split("T")[0],
                        description: parsedTx.description || trimmed.slice(0, 100),
                        amount: parsedTx.amount,
                        category: parsedTx.category || "chat-entry",
                        type: taxDetection.transactionType,
                        isResident: true,
                    });
                    results.push(`💰 **Tax**: ${taxResult.transaction.type.toUpperCase()} recorded for ₦${parsedTx.amount.toLocaleString()}`);
                } catch {
                    results.push("💰 **Tax**: Could not compute (check manually)");
                }

                // 3. Dispatch custom event to notify other components of the update
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("accounting-update", { detail: { source: "chat" } }));
                    // Also trigger storage event for cross-tab sync
                    window.dispatchEvent(new StorageEvent("storage", { key: "insight::accounting-engine" }));
                }

                const response = `Transaction processed!\n\n${results.join("\n")}\n\n_${confidenceText} (${parsedTx.parsedType} detected)_`;
                appendMessage("assistant", response);
            } else {
                // General chat message - not a transaction
                appendMessage(
                    "assistant",
                    "I couldn't detect a valid transaction. Please try again with an amount, e.g.:\n\n• \"Sold goods for ₦50,000\"\n• \"Paid rent ₦150,000\"\n• \"Bought supplies ₦5,000\"",
                );
            }
        } catch (error) {
            appendMessage("assistant", "Sorry, I couldn't process that. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }, [inputValue, isLoading, appendMessage]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            {/* Floating Chat Button */}
            <button
                onClick={() => setIsModalOpen(true)}
                className="fixed bottom-20 right-3 z-40 flex items-center gap-1.5 bg-[#1a8cff] text-white px-3 py-2 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                aria-label="Open chat"
            >
                {/* ChatGPT-style Logo */}
                <svg
                    className="w-5 h-5 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                >
                    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
                </svg>

                {/* Animated "Chat" text */}
                <span
                    className={`font-semibold text-xs overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? "max-w-16 opacity-100" : "max-w-0 opacity-0"
                        }`}
                >
                    Chat
                </span>
            </button>

            {/* Chat Modal - Gemini Style */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-[100] flex flex-col"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsModalOpen(false);
                    }}
                >
                    {/* Full-page Blur Backdrop - covers everything including bottom nav */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

                    {/* Modal Card - Gemini Style */}
                    <div
                        className="relative mt-auto mx-4 mb-4 lg:mx-auto lg:max-w-3xl lg:w-full lg:mb-8 rounded-[28px] shadow-2xl flex flex-col bg-gray-100 dark:bg-[#1a1a1a]"
                        style={{
                            animation: "slideUp 0.3s ease-out forwards",
                            maxHeight: "85vh",
                        }}
                    >
                        {/* Header with Title */}
                        <div className="flex items-center gap-3 px-5 py-4">
                            <h3 className="flex-1 font-semibold text-gray-900 dark:text-white text-base">
                                Transaction Assistant
                            </h3>
                            {/* Audio/Speaker Icon */}
                            <button className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                </svg>
                            </button>
                            {/* Close Modal Icon */}
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Scrollable Content Area */}
                        <div className="flex-1 overflow-y-auto px-5 pb-4">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`mb-4 ${msg.role === "user" ? "text-right" : "text-left"}`}
                                >
                                    {msg.role === "user" ? (
                                        <div className="inline-block max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap bg-blue-500 text-white">
                                            {msg.content}
                                        </div>
                                    ) : (
                                        <div className="text-sm leading-relaxed text-gray-900 dark:text-gray-200 whitespace-pre-wrap">
                                            {msg.content}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {isLoading && (
                                <div className="mb-4">
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Bottom Input Bar - Gemini Style */}
                        <div className="px-4 py-4">
                            <div className="flex items-center gap-2 bg-gray-200 dark:bg-[#2a2a2a] rounded-full px-2 py-1.5">
                                {/* Plus Button */}
                                <button className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>

                                {/* Input Field */}
                                <textarea
                                    ref={textareaRef}
                                    rows={1}
                                    placeholder="Ask CashOS"
                                    className="flex-1 bg-transparent border-none text-sm text-gray-700 dark:text-white placeholder:text-gray-400 focus:outline-none resize-none py-2.5 min-h-[40px]"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                />

                                {/* Microphone Button */}
                                <button className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                </button>

                                {/* Equalizer/Send Button */}
                                <button
                                    onClick={handleSend}
                                    disabled={!inputValue.trim() || isLoading}
                                    className="w-10 h-10 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-gray-50 dark:hover:bg-gray-600"
                                >
                                    {inputValue.trim() ? (
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CSS for slide-up animation */}
            <style jsx>{`
                @keyframes slideUp {
                    from {
                        transform: translateY(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
            `}</style>
        </>
    );
}
