"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/lib/ThemeContext";
import { useConnectedApps } from "@/lib/ConnectedAppsContext";
import { generatePfmResponse } from "./action";
import { BarChart2, Wallet, RefreshCw, Layers, Send } from "lucide-react";
import { playGoogleButtonClickSound } from "@/lib/sounds";

type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
};

const SUGGESTION_CARDS = [
    {
        icon: BarChart2,
        title: "Analyse my spending",
        prompt: "Break down my spending across all accounts this month and highlight unusual patterns",
        color: "text-blue-500",
    },
    {
        icon: Wallet,
        title: "Investment overview",
        prompt: "Show me a summary of all my investments, returns, and recommendations",
        color: "text-green-500",
    },
    {
        icon: RefreshCw,
        title: "Automate a payment",
        prompt: "Help me set up an automatic payment for my recurring bills",
        color: "text-purple-500",
    },
    {
        icon: Layers,
        title: "Bank reconciliation",
        prompt: "Reconcile my bank transactions from the past week across all connected accounts",
        color: "text-orange-500",
    },
];

function formatTime(ts: number) {
    return new Intl.DateTimeFormat("en-NG", { hour: "2-digit", minute: "2-digit" }).format(ts);
}

export default function PersonalChatPage() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const { apps } = useConnectedApps();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

    const hasMessages = messages.length > 0;
    const chatAreaBottomPaddingClass = isExpanded
        ? "pb-[calc(19rem+env(safe-area-inset-bottom))] sm:pb-64 lg:pb-52"
        : "pb-[calc(9rem+env(safe-area-inset-bottom))] sm:pb-36 lg:pb-28";

    // Auto-scroll
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping, isExpanded]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    }, [input]);

    // Inactivity Timer Logic
    const resetInactivityTimer = () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        if (isExpanded && !input.trim()) { // Only auto-collapse if empty
            inactivityTimerRef.current = setTimeout(() => {
                setIsExpanded(false);
            }, 120000); // 2 minutes
        }
    };

    useEffect(() => {
        if (isExpanded) {
            resetInactivityTimer();
            window.addEventListener("mousemove", resetInactivityTimer);
            window.addEventListener("keydown", resetInactivityTimer);
        } else {
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        }

        return () => {
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
            window.removeEventListener("mousemove", resetInactivityTimer);
            window.removeEventListener("keydown", resetInactivityTimer);
        };
    }, [isExpanded, input]);

    const sendMessage = async (text?: string) => {
        const msg = (text ?? input).trim();
        if (!msg) return;

        const userMsg: ChatMessage = {
            id: `u-${Date.now()}`,
            role: "user",
            content: msg,
            timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, userMsg]);
        if (!text) setInput("");
        setIsTyping(true);
        setIsExpanded(true);

        try {
            // Call Server Action with user message and connected apps context
            const responseText = await generatePfmResponse(msg, apps);

            const assistantMsg: ChatMessage = {
                id: `a-${Date.now()}`,
                role: "assistant",
                content: responseText,
                timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
        } catch (error) {
            console.error("Chat Error:", error);
            const errorMsg: ChatMessage = {
                id: `e-${Date.now()}`,
                role: "assistant",
                content: "Sorry, I encountered an error connecting to Google AI. Please try again.",
                timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleSuggestionClick = (prompt: string) => {
        setIsExpanded(true);
        sendMessage(prompt);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] lg:h-[calc(100vh-80px)] -mx-2 lg:-mx-8 relative">
            {/* Chat Area */}
            <div className={`flex-1 overflow-y-auto pt-2 sm:pt-3 transition-all duration-300 ${chatAreaBottomPaddingClass}`}>
                {!hasMessages ? (
                    /* ── Welcome State ── */
                    <div className="flex flex-col items-center justify-start lg:justify-center min-h-full px-4 pt-4 lg:pt-0 pb-3">
                        <div className="max-w-2xl w-full text-center space-y-8">
                            {/* Google Logo / AI Branding */}
                            <div className="flex justify-center">
                                <div className="p-4 bg-white rounded-full shadow-md">
                                    <img
                                        src="/google-logo.jpg"
                                        alt="Google AI"
                                        className="w-12 h-12 object-contain"
                                    />
                                </div>
                            </div>

                            {/* Greeting */}
                            <div>
                                <h1 className={`text-2xl md:text-3xl font-semibold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                                    Hi there, I'm your Personal Finance AI
                                </h1>
                                <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                                    Powered by Google Gemini. Connect your apps and ask me anything about your money.
                                </p>
                            </div>

                            {/* Suggestion Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                                {SUGGESTION_CARDS.map((card) => (
                                    <button
                                        key={card.title}
                                        onClick={() => handleSuggestionClick(card.prompt)}
                                        className={`
                      group rounded-2xl border p-4 transition-all text-left flex flex-col gap-3
                      ${isDark
                                                ? "border-gray-700 bg-gray-900/50 hover:bg-gray-800/80 hover:border-gray-600"
                                                : "border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300"
                                            }
                    `}
                                    >
                                        <div className={`p-2 rounded-lg w-fit ${isDark ? "bg-gray-800" : "bg-gray-100"}`}>
                                            <card.icon className={`w-5 h-5 ${card.color}`} />
                                        </div>
                                        <div>
                                            <p className={`text-sm font-medium ${isDark ? "text-gray-200" : "text-gray-800"}`}>
                                                {card.title}
                                            </p>
                                            <p className={`text-xs mt-1 line-clamp-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                                                {card.prompt}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── Message Feed ── */
                    <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-6">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`flex gap-3 max-w-[85%] md:max-w-[75%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                                    {/* Avatar */}
                                    {msg.role === "assistant" ? (
                                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0">
                                            <img src="/google-logo.jpg" alt="AI" className="w-6 h-6 object-contain" />
                                        </div>
                                    ) : (
                                        <div className={`
                                            w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold
                                            ${isDark ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-600"}
                                        `}>
                                            U
                                        </div>
                                    )}

                                    {/* Bubble */}
                                    <div>
                                        <div className={`
                      rounded-2xl px-4 py-3 text-sm leading-relaxed
                      ${msg.role === "assistant"
                                                ? isDark ? "bg-gray-800 text-gray-200" : "bg-white border border-gray-100 text-gray-800 shadow-sm"
                                                : "bg-[#2264ff] text-white"
                                            }
                    `}>
                                            <p className="whitespace-pre-wrap">{msg.content}</p>
                                        </div>
                                        <p className={`text-[10px] mt-1.5 px-1 ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                                            {formatTime(msg.timestamp)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0">
                                        <img src="/google-logo.jpg" alt="AI" className="w-6 h-6 object-contain" />
                                    </div>
                                    <div className={`rounded-2xl px-4 py-3 ${isDark ? "bg-gray-800" : "bg-white border border-gray-100 shadow-sm"}`}>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full animate-bounce bg-blue-500" style={{ animationDelay: "0ms" }} />
                                            <div className="w-2 h-2 rounded-full animate-bounce bg-red-500" style={{ animationDelay: "150ms" }} />
                                            <div className="w-2 h-2 rounded-full animate-bounce bg-yellow-500" style={{ animationDelay: "300ms" }} />
                                            <div className="w-2 h-2 rounded-full animate-bounce bg-green-500" style={{ animationDelay: "450ms" }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>
                )}
            </div>

            {/* ── Expanding Composer / FAB ── */}
            <div className={`fixed bottom-6 left-1/2 lg:left-[calc(50%_+_7.5rem)] transform -translate-x-1/2 flex justify-center z-50 transition-all duration-500 ease-in-out w-auto`}>
                {!isExpanded ? (
                    // Floating Action Button - same style as accounting button
                    <button
                        onClick={() => {
                            playGoogleButtonClickSound();
                            setIsExpanded(true);
                        }}
                        className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#2264ff] to-[#1a4fd6] text-white px-3 py-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                    >
                        <img src="/google-logo.jpg" alt="Google" className="w-8 h-8 flex-shrink-0 rounded-full" />
                        <span className="font-semibold text-sm text-white">Chat</span>
                    </button>
                ) : (
                    // Expanded Composer
                    <div className={`
                        w-[90vw] max-w-2xl flex flex-col gap-2 rounded-3xl border px-4 py-3 shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300
                        ${isDark
                            ? "border-gray-700 bg-gray-900 focus-within:border-gray-500"
                            : "border-gray-200 bg-white focus-within:border-gray-300"
                        }
                    `}>
                        {/* Header in Expanded State */}
                        <div className="flex items-center gap-2 mb-1 px-1">
                            <img src="/google-logo.jpg" alt="Google" className="w-8 h-8 rounded-full" />
                            <span className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-500"}`}>
                                Chat with Finance AI
                            </span>
                        </div>

                        <div className="flex items-end gap-2">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        sendMessage();
                                    }
                                }}
                                placeholder="Ask about your money..."
                                rows={1}
                                autoFocus
                                className={`
                                    flex-1 resize-none py-2 text-sm bg-transparent border-none outline-none
                                    ${isDark ? "text-gray-200 placeholder-gray-500" : "text-gray-900 placeholder-gray-400"}
                                `}
                            />
                            <button
                                onClick={() => sendMessage()}
                                disabled={!input.trim()}
                                className={`
                                    flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all
                                    ${input.trim()
                                        ? "bg-[#2264ff] hover:bg-[#1b54d9] text-white"
                                        : isDark ? "bg-gray-800 text-gray-600" : "bg-gray-100 text-gray-400"
                                    }
                                `}
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
