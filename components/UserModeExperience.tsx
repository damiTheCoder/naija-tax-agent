"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useTheme } from "@/lib/ThemeContext";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  summary?: string;
  sources?: string[];
};

type FileNode = {
  id: string;
  name: string;
  path: string;
  badge: string;
  value: string;
  updated: string;
  metrics: string;
  sources: string[];
  alerts: string[];
};

type FileGroup = {
  id: string;
  label: string;
  icon: string;
  accent: string;
  nodes: FileNode[];
};

const FILE_GROUPS: FileGroup[] = [
  {
    id: "accounting",
    label: "Accounting Stack",
    icon: "📒",
    accent: "#2563eb",
    nodes: [
      {
        id: "ledger",
        name: "Unified Ledger.qldb",
        path: "Accounting/Books",
        badge: "13 Entities",
        value: "₦18.2M",
        updated: "synced 2m ago",
        metrics: "Variance < 0.7%",
        sources: ["Zenith Business", "GTB Treasury", "Wave Payroll"],
        alerts: ["2 anomalies auto-resolved", "3 posted entries pending approval"],
      },
      {
        id: "payables",
        name: "Vendors + Obligations",
        path: "Accounting/Payables",
        badge: "Auto-runs nightly",
        value: "₦5.6M due",
        updated: "synced 9m ago",
        metrics: "74% matched to invoices",
        sources: ["Procurement Hub", "QuickInvoice"],
        alerts: ["Zenith facility covenant check tomorrow"],
      },
    ],
  },
  {
    id: "investments",
    label: "Investments",
    icon: "📈",
    accent: "#10b981",
    nodes: [
      {
        id: "treasury",
        name: "Treasury Ladder",
        path: "Investments/Buckets",
        badge: "7 / 14 / 30 / 90",
        value: "₦9.4M deployed",
        updated: "rebalanced 1h ago",
        metrics: "Avg APR 11.2%",
        sources: ["RiseVest", "Anchoria MMF"],
        alerts: ["30d bucket ready for rollover", "USD hedge request from chat"],
      },
      {
        id: "equities",
        name: "Equity + Alt stack",
        path: "Investments/Exposures",
        badge: "6 venues",
        value: "₦12.7M",
        updated: "synced 18m ago",
        metrics: "Risk-on tilt 32%",
        sources: ["Trove", "Chaka", "Carbon DeFi"],
        alerts: ["Cash sweep paused until FX inflow clears"],
      },
    ],
  },
  {
    id: "lifestyle",
    label: "Bills & Lifestyle",
    icon: "⚡",
    accent: "#f59e0b",
    nodes: [
      {
        id: "energy",
        name: "Energy & Mobility",
        path: "Lifestyle/Recurring/Energy",
        badge: "8 active",
        value: "₦420k monthly",
        updated: "synced 10m ago",
        metrics: "Auto top-up enabled",
        sources: ["Ikeja Electric", "Total Fleet", "Moove"],
        alerts: ["Renewal alert: Insurance by Friday"],
      },
      {
        id: "subscriptions",
        name: "Work & Cloud Apps",
        path: "Lifestyle/Subscriptions",
        badge: "21 seats",
        value: "₦185k monthly",
        updated: "synced 3m ago",
        metrics: "2 downgrades suggested",
        sources: ["Google Workspace", "Linear", "Figma"],
        alerts: ["Expensr usage spike detected"],
      },
    ],
  },
];

const QUICK_PROMPTS = [
  "Summarise this week's inflows",
  "Autopay my power bill",
  "Rebalance idle cash into 30d bills",
  "Explain the ₦1.2M debit at Zenith",
];

const CONNECTED_APPS = [
  { name: "Zenith Business", type: "Bank feed", status: "Streaming", accent: "#2264ff", impact: "+₦4.8M inflow", initial: "Z" },
  { name: "RiseVest", type: "Investment rail", status: "Smart ladder", accent: "#0ead69", impact: "₦9.4M deployed", initial: "R" },
  { name: "Wave Payroll", type: "Payroll", status: "Tomorrow 9:00am", accent: "#a162f7", impact: "-₦3.4M forecast", initial: "W" },
  { name: "QuickInvoice", type: "Revenue ops", status: "4 open invoices", accent: "#f97316", impact: "₦2.1M collectible", initial: "Q" },
  { name: "GTB Treasury", type: "Bank feed", status: "Synced", accent: "#e63946", impact: "+₦2.3M FX", initial: "G" },
  { name: "Carbon DeFi", type: "DeFi wallet", status: "Monitoring", accent: "#1d4ed8", impact: "₦1.8M staked", initial: "C" },
];

const FLOW_TIMELINE = [
  { title: "Payroll run", detail: "Wave Payroll", eta: "Tomorrow 09:00", value: "-₦3.4M" },
  { title: "30d ladder rollover", detail: "RiseVest", eta: "Friday", value: "+₦2.0M" },
  { title: "Tax reserve top-up", detail: "Unified Ledger", eta: "Next week", value: "-₦1.1M" },
  { title: "USD hedge window", detail: "GTB Treasury", eta: "Open", value: "Flag FX" },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    role: "assistant",
    content: "Welcome back 👋🏾 I pulled fresh statements from Zenith and reconciled payroll accruals. What should we focus on?",
    timestamp: Date.now() - 1000 * 60 * 3,
    summary: "Bank + payroll refresh complete",
    sources: ["Zenith Business", "Wave Payroll"],
  },
  {
    id: "msg-2",
    role: "user",
    content: "Is there enough cash to ladder ₦5M into 30 day paper?",
    timestamp: Date.now() - 1000 * 60 * 2,
  },
  {
    id: "msg-3",
    role: "assistant",
    content: "Yes. Idle cash after buffers is ₦6.1M. I can sweep ₦5M into the 30d bucket and leave ₦1.1M for tax reserve.",
    timestamp: Date.now() - 1000 * 60,
    summary: "Idle cash validated across Zenith + GTB",
    sources: ["Zenith Business", "GTB Treasury", "Unified Ledger.qldb"],
  },
];

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export default function UserModeExperience() {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [composer, setComposer] = useState("");
  const [selectedNode, setSelectedNode] = useState<FileNode>(FILE_GROUPS[0].nodes[0]);
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDark = theme === "dark";

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [composer]);

  const totalNetWorth = useMemo(() => {
    let total = 0;
    FILE_GROUPS.forEach((g) =>
      g.nodes.forEach((n) => {
        const match = n.value.match(/([\d,.]+)/);
        if (match) {
          const num = parseFloat(match[1].replace(/,/g, ""));
          if (!isNaN(num)) total += num;
        }
      })
    );
    return total;
  }, []);

  const sendMessage = (prompt?: string) => {
    const text = (prompt ?? composer).trim();
    if (!text) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!prompt) setComposer("");

    const followUp: ChatMessage = {
      id: `assistant-${Date.now() + 1}`,
      role: "assistant",
      content: `Working on "${text}". Pulling context from ${selectedNode.name} and connected apps.`,
      timestamp: Date.now() + 500,
      summary: `${selectedNode.badge} coverage with ${selectedNode.metrics}`,
      sources: selectedNode.sources.slice(0, 3),
    };

    setTimeout(() => {
      setMessages((prev) => [...prev, followUp]);
    }, 600);
  };

  return (
    <div className="space-y-6 pb-32">
      <section className="relative min-h-[75vh]">
        <div className="chat-feed flex flex-col min-h-[60vh]">
          <div className="flex-1 overflow-y-auto px-2 md:px-6 pt-4 md:pt-6 pb-36 space-y-3 md:space-y-5">
            <div className="space-y-4">

              {/* Net Worth Summary */}
              <div>
                <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Net Worth</p>
                <p className="text-2xl font-bold" style={{ color: '#2264ff' }}>
                  ₦{totalNetWorth.toLocaleString()}M
                  <span className={`text-sm font-normal ml-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>total</span>
                </p>
              </div>

              {/* Connected Financial Apps — Horizontal Scroll (like Embedded Finance) */}
              <div className="rounded-2xl overflow-hidden">
                <div className="py-2">
                  <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Connected Rails</h3>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Your active financial connections</p>
                </div>
                <div className="overflow-x-auto hide-scrollbar">
                  <div className="flex gap-1 px-2 py-2 min-w-max">
                    {CONNECTED_APPS.map((app) => (
                      <div key={app.name} className="flex-shrink-0 flex flex-col items-center gap-2 p-3 group cursor-pointer">
                        <div className="relative">
                          <div
                            className="w-16 h-16 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform text-white text-xl font-bold"
                            style={{ background: app.accent }}
                          >
                            {app.initial}
                          </div>
                          {/* Status dot */}
                          <div className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                        <div className="text-center">
                          <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{app.name}</p>
                          <p className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{app.type}</p>
                          <p className="text-[10px] font-medium text-emerald-600">{app.impact}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons Grid — 2 columns (like Post Journal Entry / Bank Reconciliation) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Talk to Copilot */}
                <button
                  onClick={() => setShowChat(!showChat)}
                  className={`
                    w-full rounded-2xl border transition-all p-5 group
                    ${isDark
                      ? 'border-gray-600 bg-[#0a0a0a] hover:bg-[#1a1a1a] hover:border-gray-500'
                      : 'border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400'
                    } flex items-center justify-center gap-3
                  `}
                >
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0
                    ${isDark
                      ? 'bg-gray-700 group-hover:bg-gray-600'
                      : 'bg-blue-100 group-hover:bg-blue-200'
                    }
                  `}>
                    <svg
                      className={`w-5 h-5 ${isDark ? 'text-gray-300' : 'text-blue-600'}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Financial Copilot
                    </h3>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      {showChat ? 'Tap to collapse chat' : 'Chat across your entire balance sheet'}
                    </p>
                  </div>
                </button>

                {/* File System Health */}
                <div
                  className={`
                    w-full rounded-2xl border transition-all p-5
                    ${isDark
                      ? 'border-gray-600 bg-[#0a0a0a]'
                      : 'border-gray-300 bg-white'
                    } flex items-center justify-center gap-3
                  `}
                >
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                    ${isDark
                      ? 'bg-gray-700'
                      : 'bg-emerald-100'
                    }
                  `}>
                    <svg
                      className={`w-5 h-5 ${isDark ? 'text-gray-300' : 'text-emerald-600'}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      System Health 99.2%
                    </h3>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      All automations passing
                    </p>
                  </div>
                </div>
              </div>

              {/* Financial Copilot Chat — Collapsible (accounting-style card) */}
              {showChat && (
                <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-gray-700 bg-[#0a0a0a]' : 'border-gray-200 bg-white'}`}>
                  {/* Chat Header */}
                  <div className={`px-3 md:px-5 py-2 md:py-4 border-b ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-100 bg-gray-50/50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-900/50' : 'bg-blue-100'}`}>
                          <svg className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Financial Copilot</h3>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            Listening · {selectedNode.name}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Active
                      </span>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className={`divide-y-[0.5px] max-h-[400px] overflow-y-auto ${isDark ? 'divide-gray-800/50' : 'divide-gray-100'}`}>
                    {messages.map((message) => (
                      <div key={message.id} className={`px-3 md:px-5 py-3 ${isDark ? 'hover:bg-gray-900/30' : 'hover:bg-gray-50/50'} transition-colors`}>
                        <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-lg rounded-2xl px-4 py-3 text-sm space-y-1.5 ${message.role === "assistant"
                              ? isDark ? 'bg-emerald-900/20 border border-emerald-800/30' : 'bg-emerald-50 border border-emerald-100'
                              : isDark ? 'bg-gray-800 border border-gray-700' : 'bg-blue-50 border border-blue-100'
                            }`}>
                            <p className={`whitespace-pre-wrap leading-relaxed ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                              {message.content}
                            </p>
                            <div className={`flex items-center justify-between text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                              <span>{formatTimestamp(message.timestamp)}</span>
                              {message.summary && <span>{message.summary}</span>}
                            </div>
                            {message.sources && message.sources.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {message.sources.map((source) => (
                                  <span
                                    key={source}
                                    className={`px-2 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}
                                  >
                                    {source}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Quick Prompts + Composer */}
                  <div className={`border-t px-3 md:px-5 py-3 space-y-3 ${isDark ? 'border-gray-800 bg-gray-900/30' : 'border-gray-100 bg-gray-50/30'}`}>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => sendMessage(prompt)}
                          className={`text-[11px] px-3 py-1 rounded-full border transition-colors ${isDark
                              ? 'border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-gray-600'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
                            }`}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 relative">
                        <textarea
                          ref={textareaRef}
                          value={composer}
                          onChange={(e) => setComposer(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              sendMessage();
                            }
                          }}
                          placeholder="Message your finances..."
                          rows={1}
                          className={`w-full resize-none rounded-2xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2264ff] ${isDark
                              ? 'border-gray-700 bg-gray-900 text-gray-200 placeholder-gray-500'
                              : 'border-gray-200 bg-white text-gray-900 placeholder-gray-400'
                            }`}
                        />
                      </div>
                      <button
                        onClick={() => sendMessage()}
                        className="px-5 py-3 rounded-2xl text-sm font-semibold transition-all text-white"
                        style={{
                          background: composer.trim() ? "linear-gradient(135deg,#2264ff,#7c3aed)" : isDark ? "rgba(75,85,99,0.4)" : "rgba(148,163,184,0.4)",
                          opacity: composer.trim() ? 1 : 0.6,
                        }}
                        disabled={!composer.trim()}
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* File System — Financial Folders (accounting journal-entries-style card) */}
              {FILE_GROUPS.map((group) => (
                <div key={group.id} className={`rounded-2xl border overflow-hidden ${isDark ? 'border-gray-700 bg-[#0a0a0a]' : 'border-gray-200 bg-white'}`}>
                  {/* Group Header */}
                  <div className={`px-3 md:px-5 py-2 md:py-4 border-b ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-100 bg-gray-50/50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                          style={{ background: isDark ? `${group.accent}22` : `${group.accent}18` }}
                        >
                          {group.icon}
                        </div>
                        <div>
                          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{group.label}</h3>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{group.nodes.length} items · File system</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Live
                      </span>
                    </div>
                  </div>

                  {/* Nodes as list items */}
                  <div className={`divide-y-[0.5px] ${isDark ? 'divide-gray-800/50' : 'divide-gray-100'}`}>
                    {group.nodes.map((node) => {
                      const isSelected = selectedNode.id === node.id;
                      return (
                        <button
                          key={node.id}
                          onClick={() => setSelectedNode(node)}
                          className={`w-full px-3 md:px-5 py-4 text-left transition-colors group ${isSelected
                              ? isDark ? 'bg-blue-900/10' : 'bg-blue-50/50'
                              : isDark ? 'hover:bg-gray-900/30' : 'hover:bg-gray-50/50'
                            }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{node.name}</p>
                              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{node.path}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-sm font-semibold" style={{ color: group.accent }}>{node.value}</span>
                              <span className={`text-xs font-mono ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{node.updated}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                              {node.badge}
                            </span>
                            <span className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                              {node.metrics}
                            </span>
                          </div>
                          {/* Alerts */}
                          {node.alerts.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {node.alerts.map((alert) => (
                                <div
                                  key={alert}
                                  className={`text-[11px] rounded-lg px-2.5 py-1.5 font-medium ${isDark ? 'bg-amber-900/20 text-amber-400' : 'bg-amber-50 text-amber-700'
                                    }`}
                                >
                                  ⚠ {alert}
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Sources */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {node.sources.map((src) => (
                              <span
                                key={src}
                                className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}
                              >
                                {src}
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Flow Timeline — Upcoming Events Card */}
              <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-gray-700 bg-[#0a0a0a]' : 'border-gray-200 bg-white'}`}>
                <div className={`px-3 md:px-5 py-2 md:py-4 border-b ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-100 bg-gray-50/50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-purple-900/50' : 'bg-purple-100'}`}>
                        <svg className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Upcoming Flows</h3>
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{FLOW_TIMELINE.length} events scheduled</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className={`divide-y-[0.5px] ${isDark ? 'divide-gray-800/50' : 'divide-gray-100'}`}>
                  {FLOW_TIMELINE.map((item) => (
                    <div key={item.title} className={`px-3 md:px-5 py-3 ${isDark ? 'hover:bg-gray-900/30' : 'hover:bg-gray-50/50'} transition-colors`}>
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{item.title}</p>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            {item.detail} · {item.eta}
                          </p>
                        </div>
                        <span className={`text-sm font-semibold font-mono ${item.value.startsWith('+') ? 'text-emerald-500'
                            : item.value.startsWith('-') ? (isDark ? 'text-red-400' : 'text-red-600')
                              : (isDark ? 'text-amber-400' : 'text-amber-600')
                          }`}>
                          {item.value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
