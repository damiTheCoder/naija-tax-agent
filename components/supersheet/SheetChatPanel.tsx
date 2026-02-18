"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sheet, parseCellRange, getCellValue, createCellRef } from '@/lib/supersheet/spreadsheet';
import { runUnifiedAgentMessage } from '@/lib/agent/unifiedClient';

interface SheetChatPanelProps {
    sheet: Sheet;
    onSheetChange: (sheet: Sheet) => void;
    onFormulaInsert?: (formula: string, targetCell: string) => void;
    selectedCell: string;
}

interface FormulaActionData {
    formula: string;
    cell: string;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    action?: {
        type: 'formula' | 'analysis' | 'suggestion';
        data?: FormulaActionData;
    };
}

const SAMPLE_PROMPTS = [
    "Sum column A",
    "Calculate the average of B1:B10",
    "Find the max value in the selection",
    "Create a percentage formula",
    "Analyze my data trends",
];

export default function SheetChatPanel({
    sheet,
    onSheetChange,
    onFormulaInsert,
    selectedCell,
}: SheetChatPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Get sheet context for AI
    const getSheetContext = useCallback(() => {
        const cellData: Record<string, string | number | null> = {};
        let filledCells = 0;

        for (const [ref, cell] of Object.entries(sheet.cells)) {
            if (cell.value !== null && cell.value !== '') {
                cellData[ref] = cell.value;
                filledCells++;
                if (filledCells > 100) break; // Limit context size
            }
        }

        return {
            selectedCell,
            filledCells,
            sampleData: cellData,
        };
    }, [sheet.cells, selectedCell]);

    // Generate formula from natural language
    const generateFormula = useCallback((query: string): string | null => {
        const lowerQuery = query.toLowerCase();

        // Sum patterns
        if (lowerQuery.includes('sum')) {
            const colMatch = lowerQuery.match(/column\s*([a-z])/i);
            if (colMatch) {
                return `=SUM(${colMatch[1].toUpperCase()}1:${colMatch[1].toUpperCase()}100)`;
            }
            const rangeMatch = lowerQuery.match(/([a-z]\d+)\s*(?:to|:|-)\s*([a-z]\d+)/i);
            if (rangeMatch) {
                return `=SUM(${rangeMatch[1].toUpperCase()}:${rangeMatch[2].toUpperCase()})`;
            }
            return `=SUM(A1:A10)`;
        }

        // Average patterns
        if (lowerQuery.includes('average') || lowerQuery.includes('avg') || lowerQuery.includes('mean')) {
            const colMatch = lowerQuery.match(/column\s*([a-z])/i);
            if (colMatch) {
                return `=AVG(${colMatch[1].toUpperCase()}1:${colMatch[1].toUpperCase()}100)`;
            }
            const rangeMatch = lowerQuery.match(/([a-z]\d+)\s*(?:to|:|-)\s*([a-z]\d+)/i);
            if (rangeMatch) {
                return `=AVG(${rangeMatch[1].toUpperCase()}:${rangeMatch[2].toUpperCase()})`;
            }
            return `=AVG(A1:A10)`;
        }

        // Max patterns
        if (lowerQuery.includes('max') || lowerQuery.includes('maximum') || lowerQuery.includes('highest')) {
            const colMatch = lowerQuery.match(/column\s*([a-z])/i);
            if (colMatch) {
                return `=MAX(${colMatch[1].toUpperCase()}1:${colMatch[1].toUpperCase()}100)`;
            }
            return `=MAX(A1:A10)`;
        }

        // Min patterns
        if (lowerQuery.includes('min') || lowerQuery.includes('minimum') || lowerQuery.includes('lowest')) {
            const colMatch = lowerQuery.match(/column\s*([a-z])/i);
            if (colMatch) {
                return `=MIN(${colMatch[1].toUpperCase()}1:${colMatch[1].toUpperCase()}100)`;
            }
            return `=MIN(A1:A10)`;
        }

        // Count patterns
        if (lowerQuery.includes('count') || lowerQuery.includes('how many')) {
            const colMatch = lowerQuery.match(/column\s*([a-z])/i);
            if (colMatch) {
                return `=COUNT(${colMatch[1].toUpperCase()}1:${colMatch[1].toUpperCase()}100)`;
            }
            return `=COUNT(A1:A10)`;
        }

        // Percentage patterns
        if (lowerQuery.includes('percent')) {
            return `=${selectedCell}*100`;
        }

        // IF patterns
        if (lowerQuery.includes('if') && (lowerQuery.includes('greater') || lowerQuery.includes('less') || lowerQuery.includes('equal'))) {
            if (lowerQuery.includes('greater')) {
                return `=IF(${selectedCell}>0,"Yes","No")`;
            }
            if (lowerQuery.includes('less')) {
                return `=IF(${selectedCell}<0,"Yes","No")`;
            }
            return `=IF(${selectedCell}=0,"Zero","Not Zero")`;
        }

        return null;
    }, [selectedCell]);

    // Analyze data in range
    const analyzeData = useCallback((query: string): string => {
        const context = getSheetContext();
        const values = Object.values(context.sampleData).filter((v): v is number => typeof v === 'number');

        if (values.length === 0) {
            return "I don't see any numeric data in your spreadsheet yet. Try adding some numbers and I can help you analyze them!";
        }

        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min;

        let analysis = `📊 **Quick Analysis** (${values.length} numeric values found)\n\n`;
        analysis += `• **Sum:** ${sum.toLocaleString()}\n`;
        analysis += `• **Average:** ${avg.toFixed(2)}\n`;
        analysis += `• **Min:** ${min.toLocaleString()}\n`;
        analysis += `• **Max:** ${max.toLocaleString()}\n`;
        analysis += `• **Range:** ${range.toLocaleString()}\n\n`;

        if (query.toLowerCase().includes('trend')) {
            // Simple trend detection
            if (values.length >= 3) {
                const firstHalf = values.slice(0, Math.floor(values.length / 2));
                const secondHalf = values.slice(Math.floor(values.length / 2));
                const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
                const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

                if (secondAvg > firstAvg * 1.1) {
                    analysis += `📈 **Trend:** Upward (values increasing by ~${((secondAvg / firstAvg - 1) * 100).toFixed(1)}%)`;
                } else if (secondAvg < firstAvg * 0.9) {
                    analysis += `📉 **Trend:** Downward (values decreasing by ~${((1 - secondAvg / firstAvg) * 100).toFixed(1)}%)`;
                } else {
                    analysis += `➡️ **Trend:** Stable (minimal change detected)`;
                }
            }
        }

        return analysis;
    }, [getSheetContext]);

    // Process user message
    const processMessage = useCallback(async (userMessage: string) => {
        const lowerMessage = userMessage.toLowerCase();

        // Check for formula generation requests
        if (
            lowerMessage.includes('sum') ||
            lowerMessage.includes('average') ||
            lowerMessage.includes('avg') ||
            lowerMessage.includes('max') ||
            lowerMessage.includes('min') ||
            lowerMessage.includes('count') ||
            lowerMessage.includes('formula') ||
            lowerMessage.includes('calculate')
        ) {
            const formula = generateFormula(userMessage);
            if (formula) {
                return {
                    content: `Here's a formula for that:\n\n\`${formula}\`\n\nWould you like me to insert this into cell **${selectedCell}**?`,
                    action: { type: 'formula' as const, data: { formula, cell: selectedCell } },
                };
            }
        }

        // Check for analysis requests
        if (
            lowerMessage.includes('analyze') ||
            lowerMessage.includes('analysis') ||
            lowerMessage.includes('trend') ||
            lowerMessage.includes('insight') ||
            lowerMessage.includes('summary')
        ) {
            return {
                content: analyzeData(userMessage),
                action: { type: 'analysis' as const },
            };
        }

        // Check for help requests
        if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
            return {
                content: `I'm your AI spreadsheet assistant! Here's what I can help with:

**📝 Formula Generation**
• "Sum column A"
• "Calculate the average of B1:B10"
• "Create an IF formula for cell C1"

**📊 Data Analysis**
• "Analyze my data"
• "What are the trends?"
• "Give me a summary"

**💡 Suggestions**
• "How should I organize this data?"
• "What formulas would be useful?"

Just ask and I'll help you work with your spreadsheet!`,
            };
        }

        // Default helpful response
        return {
            content: `I can help you with that! Here are some things I can do:

• Generate formulas (try "sum column A")
• Analyze your data (try "analyze my data")
• Provide insights and suggestions

What would you like me to help with?`,
        };
    }, [generateFormula, analyzeData, selectedCell]);

    // Send message
    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: `msg_${Date.now()}`,
            role: 'user',
            content: input.trim(),
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            try {
                const conversation = [...messages, userMessage]
                    .slice(-12)
                    .map((msg) => ({ role: msg.role, content: msg.content }));
                const result = await runUnifiedAgentMessage({
                    message: userMessage.content,
                    module: "supersheet",
                    route: "/supersheet",
                    conversation,
                });
                const assistantMessage: ChatMessage = {
                    id: `msg_${Date.now() + 1}`,
                    role: 'assistant',
                    content: result.finalReply,
                    timestamp: Date.now(),
                };
                setMessages(prev => [...prev, assistantMessage]);
                return;
            } catch {
                // Fallback to local supersheet helper logic.
            }

            const response = await processMessage(userMessage.content);
            const assistantMessage: ChatMessage = {
                id: `msg_${Date.now() + 1}`,
                role: 'assistant',
                content: response.content,
                timestamp: Date.now(),
                action: response.action,
            };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            const errorMessage: ChatMessage = {
                id: `msg_${Date.now() + 1}`,
                role: 'assistant',
                content: "I'm sorry, I encountered an error. Please try again.",
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // Apply formula from suggestion
    const applyFormula = (formula: string, cell: string) => {
        onFormulaInsert?.(formula, cell);

        // Add confirmation message
        const confirmMessage: ChatMessage = {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: `✅ Done! I've inserted \`${formula}\` into cell **${cell}**.`,
            timestamp: Date.now(),
        };
        setMessages(prev => [...prev, confirmMessage]);
    };

    // Handle prompt click
    const handlePromptClick = (prompt: string) => {
        setInput(prompt);
        inputRef.current?.focus();
    };

    return (
        <>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
          fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg
          flex items-center justify-center transition-all duration-300
          ${isOpen
                        ? 'bg-gray-800 dark:bg-gray-700 rotate-0'
                        : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
                    }
        `}
                title={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
            >
                {isOpen ? (
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <div className="relative">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                    </div>
                )}
            </button>

            {/* Chat Panel */}
            <div
                className={`
          fixed bottom-24 right-6 z-40 w-96 max-h-[600px] 
          bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700
          flex flex-col overflow-hidden transition-all duration-300 transform
          ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4 pointer-events-none'}
        `}
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Sheet AI</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Ask me anything about your data</p>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                        {selectedCell}
                    </span>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[400px]">
                    {messages.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center">
                                <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <h4 className="font-medium text-gray-900 dark:text-white mb-2">How can I help?</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Ask me to create formulas, analyze data, or get insights.
                            </p>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {SAMPLE_PROMPTS.slice(0, 3).map((prompt, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handlePromptClick(prompt)}
                                        className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300 transition-colors"
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`
                    max-w-[85%] px-4 py-2.5 rounded-2xl
                    ${msg.role === 'user'
                                            ? 'bg-blue-500 text-white rounded-br-md'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md'
                                        }
                  `}
                                >
                                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>

                                    {/* Action button for formula suggestions */}
                                    {msg.action?.type === 'formula' && msg.action.data && (
                                        <button
                                            onClick={() => {
                                                applyFormula(msg.action!.data!.formula, msg.action!.data!.cell);
                                            }}
                                            className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                                        >
                                            Insert Formula
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-md">
                                <div className="flex gap-1.5">
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#151515]">
                    <div className="flex items-end gap-2">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    sendMessage();
                                }
                            }}
                            placeholder="Ask about your data..."
                            rows={1}
                            className="flex-1 px-4 py-2.5 bg-white dark:bg-[#252525] border border-gray-200 dark:border-gray-600 rounded-xl resize-none text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-24"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim() || isLoading}
                            className="w-10 h-10 flex items-center justify-center bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-xl transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
