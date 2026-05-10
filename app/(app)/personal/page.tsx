"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/ThemeContext";
import { useConnectedApps } from "@/lib/ConnectedAppsContext";
import { generatePfmResponse } from "./action";
import { formatPlanSourceLabel, runUnifiedAgentMessage, type AgentPlanSource } from "@/lib/agent/unifiedClient";
import { BarChart2, Wallet, RefreshCw, Layers, Send, TrendingUp, MessageSquarePlus, Square } from "lucide-react";
import { playGoogleButtonClickSound } from "@/lib/sounds";
import {
    ChatConversationMessage,
    CHAT_HISTORY_SELECTED_EVENT,
    consumeSelectedChatHistory,
    createChatConversation,
    getChatConversation,
    saveChatConversationMessages,
} from "@/lib/personalChatHistory";

type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
};

function toConversationMessages(messages: ChatMessage[]): ChatConversationMessage[] {
    return messages
        .filter((item) => item.content.trim().length > 0)
        .map((item) => ({
            id: item.id,
            role: item.role,
            content: item.content,
            timestamp: item.timestamp,
        }));
}

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
    const router = useRouter();
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const { apps } = useConnectedApps();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [agentPlanSource, setAgentPlanSource] = useState<AgentPlanSource>("fallback");
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
    const activeRequestIdRef = useRef<number | null>(null);
    const cancelledRequestIdsRef = useRef<Set<number>>(new Set());

    const persistConversation = useCallback((
        nextMessages: ChatMessage[],
        preferredConversationId?: string | null
    ): string | null => {
        const normalized = toConversationMessages(nextMessages);
        if (!normalized.length) return preferredConversationId || activeConversationId || null;

        let conversationId = preferredConversationId || activeConversationId;
        if (!conversationId) {
            const title = normalized.find((item) => item.role === "user")?.content || "New chat";
            const conversation = createChatConversation({
                module: "personal",
                route: "/personal",
                title,
            });
            conversationId = conversation.id;
            setActiveConversationId(conversation.id);
        }

        let saved = saveChatConversationMessages({
            conversationId,
            module: "personal",
            route: "/personal",
            messages: normalized,
        });

        if (!saved) {
            const title = normalized.find((item) => item.role === "user")?.content || "New chat";
            const conversation = createChatConversation({
                module: "personal",
                route: "/personal",
                title,
            });
            conversationId = conversation.id;
            setActiveConversationId(conversation.id);
            saved = saveChatConversationMessages({
                conversationId,
                module: "personal",
                route: "/personal",
                messages: normalized,
            });
        }

        return saved?.id || conversationId || null;
    }, [activeConversationId]);

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

    useEffect(() => {
        const applySelectedHistory = () => {
            const selected = consumeSelectedChatHistory({ module: "personal", pathname: "/personal" });
            if (!selected) return;

            setIsExpanded(true);

            if (selected.conversationId) {
                const conversation = getChatConversation(selected.conversationId);
                if (conversation) {
                    setActiveConversationId(conversation.id);
                    setMessages(
                        conversation.messages.map((item) => ({
                            id: item.id,
                            role: item.role,
                            content: item.content,
                            timestamp: item.timestamp,
                        }))
                    );
                    setInput("");
                    setTimeout(() => textareaRef.current?.focus(), 50);
                    return;
                }
            }

            const baseTs = selected.timestamp || Date.now();
            const restored: ChatMessage[] = [
                {
                    id: `hist-u-${selected.id}`,
                    role: "user",
                    content: selected.prompt,
                    timestamp: baseTs,
                },
            ];
            if (selected.response) {
                restored.push({
                    id: `hist-a-${selected.id}`,
                    role: "assistant",
                    content: selected.response,
                    timestamp: baseTs + 1,
                });
            }
            setActiveConversationId(null);
            setMessages(restored);
            setInput(selected.response ? "" : selected.prompt);
            setTimeout(() => textareaRef.current?.focus(), 50);
        };

        applySelectedHistory();
        window.addEventListener(CHAT_HISTORY_SELECTED_EVENT, applySelectedHistory as EventListener);
        return () => {
            window.removeEventListener(CHAT_HISTORY_SELECTED_EVENT, applySelectedHistory as EventListener);
        };
    }, []);

    const stopAiResponse = () => {
        const activeRequestId = activeRequestIdRef.current;
        if (activeRequestId !== null) {
            cancelledRequestIdsRef.current.add(activeRequestId);
            activeRequestIdRef.current = null;
        }
        setIsTyping(false);
    };

    const startNewChat = () => {
        stopAiResponse();
        setMessages([]);
        setInput("");
        setActiveConversationId(null);
        setIsExpanded(true);
    };

    const sendMessage = async (text?: string) => {
        if (isTyping) return;
        const msg = (text ?? input).trim();
        if (!msg) return;

        const requestId = Date.now();
        activeRequestIdRef.current = requestId;
        let workingConversationId: string | null = activeConversationId;

        const userMsg: ChatMessage = {
            id: `u-${requestId}`,
            role: "user",
            content: msg,
            timestamp: requestId,
        };
        const nextMessages = [...messages, userMsg];
        setMessages(nextMessages);
        const savedAfterUser = persistConversation(nextMessages, workingConversationId);
        if (savedAfterUser) {
            workingConversationId = savedAfterUser;
        }
        if (!text) setInput("");
        setIsTyping(true);
        setIsExpanded(true);

        try {
            let responseText: string;
            try {
                const conversation = toConversationMessages(nextMessages)
                    .slice(-12)
                    .map((item) => ({ role: item.role, content: item.content }));
                const result = await runUnifiedAgentMessage({
                    message: msg,
                    module: "personal",
                    route: "/personal",
                    conversation,
                });
                responseText = result.finalReply;
                setAgentPlanSource(result.planSource);
                if (result.navigateTo && result.navigateTo !== "/personal") {
                    router.push(result.navigateTo);
                }
            } catch {
                // Preserve existing personal assistant fallback.
                responseText = await generatePfmResponse(msg, apps);
                setAgentPlanSource("fallback");
            }

            if (cancelledRequestIdsRef.current.has(requestId) || activeRequestIdRef.current !== requestId) {
                return;
            }

            const assistantMsg: ChatMessage = {
                id: `a-${Date.now()}`,
                role: "assistant",
                content: responseText,
                timestamp: Date.now(),
            };
            const withAssistant = [...nextMessages, assistantMsg];
            setMessages(withAssistant);
            const savedAfterAssistant = persistConversation(withAssistant, workingConversationId);
            if (savedAfterAssistant) {
                workingConversationId = savedAfterAssistant;
            }
        } catch (error) {
            if (cancelledRequestIdsRef.current.has(requestId) || activeRequestIdRef.current !== requestId) {
                return;
            }
            console.error("Chat Error:", error);
            const errorMsg: ChatMessage = {
                id: `e-${Date.now()}`,
                role: "assistant",
                content: "Sorry, I encountered an error connecting to Google AI. Please try again.",
                timestamp: Date.now(),
            };
            const withError = [...nextMessages, errorMsg];
            setMessages(withError);
            const savedAfterError = persistConversation(withError, workingConversationId);
            if (savedAfterError) {
                workingConversationId = savedAfterError;
            }
            setAgentPlanSource("fallback");
        } finally {
            cancelledRequestIdsRef.current.delete(requestId);
            if (activeRequestIdRef.current === requestId) {
                activeRequestIdRef.current = null;
                setIsTyping(false);
            }
        }
    };

    const handleSuggestionClick = (prompt: string) => {
        setIsExpanded(true);
        sendMessage(prompt);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] lg:h-[calc(100vh-80px)] relative">
            {/* Chat Area */}
            <div className={`flex-1 overflow-y-auto hide-scrollbar pt-2 sm:pt-3 transition-all duration-300 ${chatAreaBottomPaddingClass}`}>
                {!hasMessages ? (
                    /* ── Welcome State ── */
                    <div className="flex flex-col items-center justify-start lg:justify-center min-h-full px-4 pt-4 lg:pt-0 pb-3">
                        <div className="max-w-2xl w-full text-center space-y-8">
                            {/* Google Logo / AI Branding */}
                            <div className="flex justify-center">
                                <div className="p-4 rounded-full bg-transparent">
                                    <img
                                        src="/google-logo.jpg"
                                        alt="Google AI"
                                        className="w-12 h-12 object-contain rounded-full"
                                    />
                                </div>
                            </div>

                            {/* Greeting */}
                            <div>
                                <h1 className={`text-2xl md:text-3xl font-semibold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                                    Hi there, I&apos;m your Personal Finance AI
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
                                            group rounded-2xl p-4 transition-all text-left flex flex-col gap-3
                                            ${isDark
                                                ? "bg-gray-800/70 hover:bg-gray-800/90"
                                                : "bg-gray-100 hover:bg-gray-200/70"
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
                    <div className="max-w-3xl mx-auto w-full px-3 py-3 space-y-4">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`flex max-w-[85%] md:max-w-[75%] ${msg.role === "user" ? "flex-row-reverse" : "gap-3"}`}>
                                    {/* Avatar */}
                                    {msg.role === "assistant" ? (
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 bg-transparent">
                                            <img src="/google-logo.jpg" alt="AI" className="w-6 h-6 object-contain rounded-full" />
                                        </div>
                                    ) : null}

                                    {/* Bubble */}
                                    <div>
                                        <div className={`
                                            rounded-2xl px-3 py-2.5 text-sm leading-relaxed
                                            ${msg.role === "assistant"
                                                ? isDark ? "bg-gray-800 text-gray-200" : "bg-gray-100 text-gray-800"
                                                : "bg-[#8fff00] text-white"
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
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 bg-transparent">
                                        <img src="/google-logo.jpg" alt="AI" className="w-6 h-6 object-contain rounded-full" />
                                    </div>
                                    <div className={`rounded-2xl px-4 py-3 ${isDark ? "bg-gray-800" : "bg-gray-100"}`}>
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
                    // Floating Action Button
                    <button
                        onClick={() => {
                            playGoogleButtonClickSound();
                            setIsExpanded(true);
                        }}
                        className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#8fff00] to-[#6fcc00] px-3 py-2 text-[#101010] transition-all duration-300 hover:scale-105"
                    >
                        <img src="/google-logo.jpg" alt="Google" className="w-8 h-8 flex-shrink-0 rounded-full" />
                        <span className="font-semibold text-sm text-white">Chat</span>
                    </button>
                ) : (
                    // Expanded Composer
                    <div className={`
                        w-[90vw] max-w-2xl flex flex-col gap-2 rounded-3xl px-3 py-2 animate-in slide-in-from-bottom-5 fade-in duration-300
                        ${isDark
                            ? "bg-gray-800/90"
                            : "bg-gray-100"
                        }
                    `}>
                        <div className={`px-2 text-[11px] ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                            {formatPlanSourceLabel(agentPlanSource)}
                        </div>
                        <div className="flex items-end gap-2">
                            <img src="/google-logo.jpg" alt="Google" className="w-8 h-8 flex-shrink-0 rounded-full mb-0.5" />
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
                                    flex-1 resize-none py-1.5 text-sm bg-transparent border-none outline-none
                                    ${isDark ? "text-gray-200 placeholder-gray-500" : "text-gray-900 placeholder-gray-400"}
                                `}
                            />
                            <button
                                onClick={startNewChat}
                                className={`flex-shrink-0 p-1.5 rounded-full hover:bg-gray-100 ${isDark ? "hover:bg-gray-800 text-gray-500" : "text-gray-400"}`}
                                aria-label="Start new chat"
                                title="Start new chat"
                            >
                                <MessageSquarePlus className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setIsExpanded(false)}
                                className={`flex-shrink-0 p-1.5 rounded-full hover:bg-gray-100 ${isDark ? "hover:bg-gray-800 text-gray-500" : "text-gray-400"}`}
                                aria-label="Collapse composer"
                                title="Collapse composer"
                            >
                                <TrendingUp className="w-4 h-4 rotate-180" />
                            </button>
                            <button
                                onClick={() => {
                                    if (isTyping) {
                                        stopAiResponse();
                                        return;
                                    }
                                    sendMessage();
                                }}
                                disabled={!isTyping && !input.trim()}
                                className={`
                                    flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all
                                    ${isTyping
                                        ? "bg-red-500 hover:bg-red-600 text-white"
                                        : input.trim()
                                            ? "bg-[#8fff00] hover:bg-[#6fcc00] text-white"
                                        : isDark ? "bg-gray-800 text-gray-600" : "bg-gray-100 text-gray-400"
                                    }
                                `}
                                aria-label={isTyping ? "Stop AI response" : "Send message"}
                                title={isTyping ? "Stop AI response" : "Send message"}
                            >
                                {isTyping ? <Square className="w-3.5 h-3.5 fill-current" /> : <Send className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
