"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Settings,
  ExternalLink,
  Shield,
  Zap,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Link2,
  Unlink,
  Calendar,
  CreditCard,
  TrendingUp,
  FileText,
  Search,
  Filter,
} from "lucide-react";

// =============================================================================
// TYPES - Ready for backend integration
// =============================================================================

export type BankConnectionStatus = "connected" | "pending" | "error" | "disconnected" | "expired";

export type BankAccountType = "current" | "savings" | "domiciliary" | "corporate" | "merchant";

export interface BankAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  accountType: BankAccountType;
  currency: "NGN" | "USD" | "GBP" | "EUR";
  balance?: number;
  lastSynced?: string;
  isDefault: boolean;
}

export interface BankConnection {
  id: string;
  bankCode: string;
  bankName: string;
  bankLogo?: string;
  status: BankConnectionStatus;
  accounts: BankAccount[];
  connectedAt: string;
  lastSyncAt?: string;
  nextSyncAt?: string;
  syncFrequency: "realtime" | "hourly" | "daily" | "manual";
  transactionCount: number;
  errorMessage?: string;
  metadata?: {
    consentId?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: string;
  };
}

export interface BankProvider {
  code: string;
  name: string;
  shortName: string;
  logo?: string;
  color: string;
  supported: boolean;
  connectionType: "open_banking" | "statement_upload" | "api_direct" | "coming_soon";
  features: string[];
}

export interface SyncHistoryEntry {
  id: string;
  connectionId: string;
  startedAt: string;
  completedAt?: string;
  status: "success" | "partial" | "failed" | "in_progress";
  transactionsImported: number;
  transactionsSkipped: number;
  errorDetails?: string;
}

// =============================================================================
// MOCK DATA - Replace with API calls
// =============================================================================

const SUPPORTED_BANKS: BankProvider[] = [
  {
    code: "zenith",
    name: "Zenith Bank Plc",
    shortName: "Zenith",
    color: "#E21A2D",
    supported: true,
    connectionType: "open_banking",
    features: ["Real-time sync", "Multi-account", "Statement export"],
  },
  {
    code: "gtbank",
    name: "Guaranty Trust Bank",
    shortName: "GTBank",
    color: "#F7941D",
    supported: true,
    connectionType: "open_banking",
    features: ["Real-time sync", "Multi-account", "Statement export"],
  },
  {
    code: "access",
    name: "Access Bank Plc",
    shortName: "Access",
    color: "#F36F21",
    supported: true,
    connectionType: "open_banking",
    features: ["Real-time sync", "Multi-account", "Statement export"],
  },
  {
    code: "firstbank",
    name: "First Bank of Nigeria",
    shortName: "FirstBank",
    color: "#003B71",
    supported: true,
    connectionType: "api_direct",
    features: ["Daily sync", "Multi-account"],
  },
  {
    code: "uba",
    name: "United Bank for Africa",
    shortName: "UBA",
    color: "#E31937",
    supported: true,
    connectionType: "api_direct",
    features: ["Daily sync", "Multi-account"],
  },
  {
    code: "stanbic",
    name: "Stanbic IBTC Bank",
    shortName: "Stanbic",
    color: "#0033A0",
    supported: true,
    connectionType: "statement_upload",
    features: ["Statement upload", "PDF parsing"],
  },
  {
    code: "fcmb",
    name: "First City Monument Bank",
    shortName: "FCMB",
    color: "#5C2D91",
    supported: true,
    connectionType: "statement_upload",
    features: ["Statement upload", "PDF parsing"],
  },
  {
    code: "fidelity",
    name: "Fidelity Bank Plc",
    shortName: "Fidelity",
    color: "#00A859",
    supported: true,
    connectionType: "statement_upload",
    features: ["Statement upload", "PDF parsing"],
  },
  {
    code: "ecobank",
    name: "Ecobank Nigeria",
    shortName: "Ecobank",
    color: "#0066B3",
    supported: false,
    connectionType: "coming_soon",
    features: ["Coming soon"],
  },
  {
    code: "sterling",
    name: "Sterling Bank Plc",
    shortName: "Sterling",
    color: "#CE1126",
    supported: false,
    connectionType: "coming_soon",
    features: ["Coming soon"],
  },
  {
    code: "wema",
    name: "Wema Bank Plc",
    shortName: "Wema",
    color: "#7D2248",
    supported: false,
    connectionType: "coming_soon",
    features: ["Coming soon"],
  },
  {
    code: "polaris",
    name: "Polaris Bank Limited",
    shortName: "Polaris",
    color: "#8DC63F",
    supported: false,
    connectionType: "coming_soon",
    features: ["Coming soon"],
  },
];

const MOCK_CONNECTIONS: BankConnection[] = [
  {
    id: "conn_zenith_001",
    bankCode: "zenith",
    bankName: "Zenith Bank Plc",
    status: "connected",
    accounts: [
      {
        id: "acc_001",
        accountNumber: "1234567890",
        accountName: "Acme Technologies Ltd",
        accountType: "corporate",
        currency: "NGN",
        balance: 15750000,
        lastSynced: new Date().toISOString(),
        isDefault: true,
      },
      {
        id: "acc_002",
        accountNumber: "1234567891",
        accountName: "Acme Technologies Ltd - USD",
        accountType: "domiciliary",
        currency: "USD",
        balance: 45200,
        lastSynced: new Date().toISOString(),
        isDefault: false,
      },
    ],
    connectedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastSyncAt: new Date().toISOString(),
    nextSyncAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    syncFrequency: "hourly",
    transactionCount: 847,
  },
];

// =============================================================================
// API SERVICE INTERFACE - For backend developer
// =============================================================================

/**
 * BankConnectionService Interface
 * 
 * Backend developer should implement these methods:
 * 
 * 1. listConnections() - Get all connected banks for the current user/company
 * 2. connectBank(bankCode, credentials) - Initiate OAuth or credential-based connection
 * 3. disconnectBank(connectionId) - Revoke access and remove connection
 * 4. syncConnection(connectionId) - Trigger manual sync for a connection
 * 5. getSyncHistory(connectionId) - Get sync history for a connection
 * 6. getTransactions(connectionId, filters) - Get transactions from a bank
 * 7. updateSyncSettings(connectionId, settings) - Update sync frequency etc.
 * 
 * Authentication: Use session/JWT token from auth context
 * Base URL: /api/bank-connections/
 */

interface BankConnectionService {
  // Connection Management
  listConnections(): Promise<BankConnection[]>;
  connectBank(bankCode: string, credentials?: Record<string, string>): Promise<{ redirectUrl?: string; connection?: BankConnection }>;
  disconnectBank(connectionId: string): Promise<void>;
  
  // Sync Operations
  syncConnection(connectionId: string): Promise<SyncHistoryEntry>;
  getSyncHistory(connectionId: string, limit?: number): Promise<SyncHistoryEntry[]>;
  
  // Transaction Import
  getTransactions(connectionId: string, filters?: {
    startDate?: string;
    endDate?: string;
    accountId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    transactions: Array<{
      id: string;
      date: string;
      description: string;
      amount: number;
      balance: number;
      type: "credit" | "debit";
      category?: string;
      reference?: string;
    }>;
    pagination: { total: number; page: number; pages: number };
  }>;
  
  // Settings
  updateSyncSettings(connectionId: string, settings: {
    syncFrequency?: BankConnection["syncFrequency"];
    defaultAccountId?: string;
    autoClassify?: boolean;
  }): Promise<BankConnection>;
}

// Mock implementation - replace with real API calls
const mockBankService: BankConnectionService = {
  async listConnections() {
    await new Promise(r => setTimeout(r, 500));
    const saved = typeof window !== "undefined" 
      ? localStorage.getItem("insight::bank-connections")
      : null;
    return saved ? JSON.parse(saved) : MOCK_CONNECTIONS;
  },
  
  async connectBank(bankCode) {
    await new Promise(r => setTimeout(r, 1500));
    const bank = SUPPORTED_BANKS.find(b => b.code === bankCode);
    if (!bank) throw new Error("Bank not supported");
    
    // In real implementation, this would return OAuth redirect URL
    // For now, simulate successful connection
    const newConnection: BankConnection = {
      id: `conn_${bankCode}_${Date.now()}`,
      bankCode,
      bankName: bank.name,
      status: "pending",
      accounts: [],
      connectedAt: new Date().toISOString(),
      syncFrequency: "daily",
      transactionCount: 0,
    };
    
    return { connection: newConnection };
  },
  
  async disconnectBank(connectionId) {
    await new Promise(r => setTimeout(r, 800));
    // In real implementation, revoke tokens and delete from DB
  },
  
  async syncConnection(connectionId) {
    await new Promise(r => setTimeout(r, 2000));
    return {
      id: `sync_${Date.now()}`,
      connectionId,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: "success" as const,
      transactionsImported: Math.floor(Math.random() * 20) + 5,
      transactionsSkipped: Math.floor(Math.random() * 3),
    };
  },
  
  async getSyncHistory(connectionId, limit = 10) {
    await new Promise(r => setTimeout(r, 300));
    return [];
  },
  
  async getTransactions() {
    await new Promise(r => setTimeout(r, 500));
    return { transactions: [], pagination: { total: 0, page: 1, pages: 0 } };
  },
  
  async updateSyncSettings(connectionId, settings) {
    await new Promise(r => setTimeout(r, 500));
    const connections = await this.listConnections();
    const connection = connections.find(c => c.id === connectionId);
    if (!connection) throw new Error("Connection not found");
    return { ...connection, ...settings };
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function BankConnectionsPage() {
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedBank, setSelectedBank] = useState<BankProvider | null>(null);
  const [connectingBank, setConnectingBank] = useState<string | null>(null);
  const [syncingConnection, setSyncingConnection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "open_banking" | "statement_upload">("all");
  const [selectedConnection, setSelectedConnection] = useState<BankConnection | null>(null);

  // Load connections on mount
  useEffect(() => {
    loadConnections();
  }, []);

  // Persist connections
  useEffect(() => {
    if (typeof window !== "undefined" && connections.length > 0) {
      localStorage.setItem("insight::bank-connections", JSON.stringify(connections));
    }
  }, [connections]);

  const loadConnections = async () => {
    setIsLoading(true);
    try {
      const data = await mockBankService.listConnections();
      setConnections(data);
    } catch (error) {
      console.error("Failed to load connections:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectBank = async (bank: BankProvider) => {
    if (!bank.supported || bank.connectionType === "coming_soon") return;
    
    setConnectingBank(bank.code);
    try {
      const result = await mockBankService.connectBank(bank.code);
      
      if (result.redirectUrl) {
        // OAuth flow - redirect to bank
        window.location.href = result.redirectUrl;
      } else if (result.connection) {
        // Direct connection - add to list
        setConnections(prev => [...prev, result.connection!]);
        setShowAddModal(false);
        setSelectedBank(null);
      }
    } catch (error) {
      console.error("Failed to connect bank:", error);
    } finally {
      setConnectingBank(null);
    }
  };

  const handleDisconnectBank = async (connectionId: string) => {
    if (!confirm("Are you sure you want to disconnect this bank? This will stop syncing transactions.")) {
      return;
    }
    
    try {
      await mockBankService.disconnectBank(connectionId);
      setConnections(prev => prev.filter(c => c.id !== connectionId));
      setSelectedConnection(null);
    } catch (error) {
      console.error("Failed to disconnect bank:", error);
    }
  };

  const handleSyncConnection = async (connectionId: string) => {
    setSyncingConnection(connectionId);
    try {
      const result = await mockBankService.syncConnection(connectionId);
      setConnections(prev => prev.map(c => 
        c.id === connectionId 
          ? { 
              ...c, 
              lastSyncAt: new Date().toISOString(),
              transactionCount: c.transactionCount + result.transactionsImported,
              status: "connected" as const,
            }
          : c
      ));
    } catch (error) {
      console.error("Failed to sync connection:", error);
    } finally {
      setSyncingConnection(null);
    }
  };

  const formatCurrency = (amount: number, currency: string = "NGN") => {
    const symbols: Record<string, string> = { NGN: "₦", USD: "$", GBP: "£", EUR: "€" };
    return `${symbols[currency] || ""}${amount.toLocaleString("en-NG")}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: BankConnectionStatus) => {
    switch (status) {
      case "connected": return "text-green-600 bg-green-50";
      case "pending": return "text-amber-600 bg-amber-50";
      case "error": return "text-red-600 bg-red-50";
      case "expired": return "text-orange-600 bg-orange-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  const getStatusIcon = (status: BankConnectionStatus) => {
    switch (status) {
      case "connected": return <CheckCircle2 className="w-4 h-4" />;
      case "pending": return <Clock className="w-4 h-4" />;
      case "error": return <AlertCircle className="w-4 h-4" />;
      case "expired": return <AlertCircle className="w-4 h-4" />;
      default: return <Unlink className="w-4 h-4" />;
    }
  };

  const filteredBanks = SUPPORTED_BANKS.filter(bank => {
    const matchesSearch = bank.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         bank.shortName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === "all" || bank.connectionType === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0D0D0D]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/accounting"
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Building2 className="w-6 h-6 text-[#64B5F6]" />
                Bank Connections
              </h1>
              <p className="text-sm text-gray-400">
                Connect your bank accounts for automatic transaction sync
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#64B5F6] text-black rounded-lg font-medium hover:bg-[#64B5F6]/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Bank
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* AI Automation Card - Matching accounting studio style */}
        <div className="rounded-2xl border border-white/10 bg-[#1A1A1A] overflow-hidden mb-8">
          {/* Header */}
          <div className="px-6 py-5 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">AI Automation</h2>
                  <p className="text-xs text-gray-400">Bank-fed journals, editable in chat</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                connections.some(c => c.status === "connected") 
                  ? "bg-emerald-500/20 text-emerald-400" 
                  : "bg-gray-700 text-gray-400"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  connections.some(c => c.status === "connected") ? "bg-emerald-400" : "bg-gray-500"
                }`}></span>
                {connections.some(c => c.status === "connected") ? "live" : "idle"}
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="p-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-gradient-to-br from-gray-800 to-gray-800/50 border border-white/5 p-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Selected Bank</p>
                <select
                  value={connections[0]?.bankCode || ""}
                  className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-[#64B5F6]/20 focus:border-[#64B5F6]"
                  disabled={connections.length === 0}
                >
                  {connections.length === 0 ? (
                    <option value="">No banks connected</option>
                  ) : (
                    connections.map((conn) => (
                      <option key={conn.id} value={conn.bankCode}>
                        {conn.bankName}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-emerald-900/30 to-emerald-900/10 border border-emerald-500/20 p-4">
                <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider">AI Confidence</p>
                <p className="mt-2 text-3xl font-bold text-white font-mono">82%</p>
                <p className="text-xs text-gray-400 mt-1">Adjusts as you review entries</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-blue-900/30 to-blue-900/10 border border-blue-500/20 p-4">
                <p className="text-xs font-medium text-blue-400 uppercase tracking-wider">Coverage</p>
                <p className="mt-2 text-3xl font-bold text-white font-mono">
                  {connections.some(c => c.status === "connected") ? "Live" : "0%"}
                </p>
                <p className="text-xs text-gray-400 mt-1">Journals & statements sync</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <Zap className="w-4 h-4" />
                {connections.length === 0 ? "Connect bank feed" : "Sync latest data"}
              </button>
              <Link
                href="/accounting/workspace"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-transparent px-5 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/5 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Files workspace
              </Link>
            </div>

            {/* Recent Activity */}
            <div className="mt-6">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Recent Activity</p>
              <div className="space-y-2">
                {connections.length === 0 ? (
                  <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">Workspace ready</p>
                      <p className="text-xs text-gray-500 truncate">Connect a bank feed to start streaming journals automatically.</p>
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0">Awaiting action</span>
                  </div>
                ) : (
                  connections.slice(0, 2).map((conn) => (
                    <div key={conn.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        conn.status === "connected" ? "bg-emerald-400" : "bg-amber-400"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{conn.bankName} connected</p>
                        <p className="text-xs text-gray-500 truncate">
                          {conn.transactionCount} transactions synced • {conn.accounts.length} account(s)
                        </p>
                      </div>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {conn.lastSyncAt ? formatDate(conn.lastSyncAt).split(",")[0] : "Pending sync"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#1A1A1A] rounded-xl p-5 border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-[#64B5F6]/10">
                <Link2 className="w-5 h-5 text-[#64B5F6]" />
              </div>
              <span className="text-sm text-gray-400">Connected Banks</span>
            </div>
            <p className="text-2xl font-semibold">{connections.filter(c => c.status === "connected").length}</p>
          </div>
          <div className="bg-[#1A1A1A] rounded-xl p-5 border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CreditCard className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-sm text-gray-400">Total Accounts</span>
            </div>
            <p className="text-2xl font-semibold">{connections.reduce((acc, c) => acc + c.accounts.length, 0)}</p>
          </div>
          <div className="bg-[#1A1A1A] rounded-xl p-5 border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <FileText className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-sm text-gray-400">Transactions Synced</span>
            </div>
            <p className="text-2xl font-semibold">{connections.reduce((acc, c) => acc + c.transactionCount, 0).toLocaleString()}</p>
          </div>
          <div className="bg-[#1A1A1A] rounded-xl p-5 border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <TrendingUp className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-sm text-gray-400">Total Balance</span>
            </div>
            <p className="text-2xl font-semibold">
              {formatCurrency(
                connections.reduce((acc, c) => 
                  acc + c.accounts
                    .filter(a => a.currency === "NGN")
                    .reduce((sum, a) => sum + (a.balance || 0), 0), 
                0)
              )}
            </p>
          </div>
        </div>

        {/* Connected Banks */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Your Connected Banks</h2>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#64B5F6]" />
            </div>
          ) : connections.length === 0 ? (
            <div className="bg-[#1A1A1A] rounded-xl border border-white/5 p-12 text-center">
              <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-300 mb-2">No banks connected yet</h3>
              <p className="text-gray-500 mb-6">
                Connect your business bank accounts to automatically import transactions
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#64B5F6] text-black rounded-lg font-medium hover:bg-[#64B5F6]/90 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Connect Your First Bank
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {connections.map((connection) => {
                const bank = SUPPORTED_BANKS.find(b => b.code === connection.bankCode);
                const isSyncing = syncingConnection === connection.id;
                
                return (
                  <div
                    key={connection.id}
                    className="bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden hover:border-white/10 transition-colors"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div 
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                            style={{ backgroundColor: bank?.color || "#333" }}
                          >
                            {bank?.shortName.slice(0, 2) || "BK"}
                          </div>
                          <div>
                            <h3 className="font-semibold text-white">{connection.bankName}</h3>
                            <div className="flex items-center gap-3 mt-1">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(connection.status)}`}>
                                {getStatusIcon(connection.status)}
                                {connection.status.charAt(0).toUpperCase() + connection.status.slice(1)}
                              </span>
                              <span className="text-sm text-gray-500">
                                {connection.accounts.length} account{connection.accounts.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSyncConnection(connection.id)}
                            disabled={isSyncing}
                            className="p-2 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
                            title="Sync now"
                          >
                            <RefreshCw className={`w-5 h-5 text-gray-400 ${isSyncing ? "animate-spin" : ""}`} />
                          </button>
                          <button
                            onClick={() => setSelectedConnection(connection)}
                            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                            title="Settings"
                          >
                            <Settings className="w-5 h-5 text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleDisconnectBank(connection.id)}
                            className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                            title="Disconnect"
                          >
                            <Trash2 className="w-5 h-5 text-red-400" />
                          </button>
                        </div>
                      </div>

                      {/* Accounts List */}
                      {connection.accounts.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/5">
                          <div className="grid gap-3">
                            {connection.accounts.map((account) => (
                              <div 
                                key={account.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]"
                              >
                                <div>
                                  <p className="font-medium text-sm">{account.accountName}</p>
                                  <p className="text-xs text-gray-500">
                                    {account.accountNumber.replace(/(\d{4})(\d{3})(\d{3})/, "$1 $2 $3")} • {account.accountType}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold">
                                    {account.balance !== undefined ? formatCurrency(account.balance, account.currency) : "—"}
                                  </p>
                                  <p className="text-xs text-gray-500">{account.currency}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sync Info */}
                      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4 text-gray-500">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            Connected {formatDate(connection.connectedAt).split(",")[0]}
                          </span>
                          {connection.lastSyncAt && (
                            <span className="flex items-center gap-1.5">
                              <RefreshCw className="w-4 h-4" />
                              Last sync {formatDate(connection.lastSyncAt)}
                            </span>
                          )}
                        </div>
                        <span className="text-gray-400">
                          {connection.transactionCount.toLocaleString()} transactions
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Security Notice */}
        <div className="bg-gradient-to-r from-[#64B5F6]/10 to-transparent rounded-xl border border-[#64B5F6]/20 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-[#64B5F6]/10">
              <Shield className="w-6 h-6 text-[#64B5F6]" />
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">Bank-level Security</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Your bank credentials are never stored on our servers. We use Open Banking protocols 
                and bank-grade encryption to securely connect to your accounts. You can revoke access 
                at any time from your bank's settings or from this page.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Add Bank Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#1A1A1A] rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden border border-white/10">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Connect a Bank</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Select your bank to start importing transactions
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedBank(null);
                  }}
                  className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search and Filter */}
              <div className="mt-4 flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search banks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#64B5F6]/50"
                  />
                </div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as typeof filterType)}
                  className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#64B5F6]/50"
                >
                  <option value="all">All Types</option>
                  <option value="open_banking">Open Banking</option>
                  <option value="statement_upload">Statement Upload</option>
                </select>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[50vh]">
              <div className="grid grid-cols-2 gap-3">
                {filteredBanks.map((bank) => {
                  const isConnecting = connectingBank === bank.code;
                  const isAlreadyConnected = connections.some(c => c.bankCode === bank.code);
                  
                  return (
                    <button
                      key={bank.code}
                      onClick={() => !isAlreadyConnected && handleConnectBank(bank)}
                      disabled={!bank.supported || isConnecting || isAlreadyConnected}
                      className={`
                        p-4 rounded-xl border text-left transition-all
                        ${bank.supported && !isAlreadyConnected
                          ? "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
                          : "border-white/5 opacity-50 cursor-not-allowed"
                        }
                        ${isAlreadyConnected ? "border-green-500/30 bg-green-500/5" : ""}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: bank.color }}
                        >
                          {bank.shortName.slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{bank.shortName}</p>
                          <p className="text-xs text-gray-500 truncate">{bank.name}</p>
                        </div>
                        {isConnecting && <Loader2 className="w-5 h-5 animate-spin text-[#64B5F6]" />}
                        {isAlreadyConnected && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {bank.features.map((feature, i) => (
                          <span
                            key={i}
                            className={`
                              px-2 py-0.5 rounded text-xs
                              ${bank.connectionType === "coming_soon"
                                ? "bg-gray-800 text-gray-500"
                                : bank.connectionType === "open_banking"
                                ? "bg-[#64B5F6]/10 text-[#64B5F6]"
                                : "bg-amber-500/10 text-amber-400"
                              }
                            `}
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Integration Methods Info */}
            <div className="p-6 border-t border-white/10 bg-white/[0.02]">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Connection Methods</h4>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-[#64B5F6] mt-0.5" />
                  <div>
                    <p className="font-medium text-white">Open Banking</p>
                    <p className="text-gray-500">Real-time sync via secure API</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-amber-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-white">Statement Upload</p>
                    <p className="text-gray-500">Upload PDF/CSV statements</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-white">Coming Soon</p>
                    <p className="text-gray-500">Integration in progress</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connection Settings Modal */}
      {selectedConnection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#1A1A1A] rounded-2xl w-full max-w-lg overflow-hidden border border-white/10">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Connection Settings</h2>
                <button
                  onClick={() => setSelectedConnection(null)}
                  className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Bank Info */}
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                  style={{ backgroundColor: SUPPORTED_BANKS.find(b => b.code === selectedConnection.bankCode)?.color || "#333" }}
                >
                  {SUPPORTED_BANKS.find(b => b.code === selectedConnection.bankCode)?.shortName.slice(0, 2) || "BK"}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedConnection.bankName}</h3>
                  <p className="text-sm text-gray-400">
                    Connection ID: {selectedConnection.id}
                  </p>
                </div>
              </div>

              {/* Sync Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Sync Frequency
                </label>
                <select
                  value={selectedConnection.syncFrequency}
                  onChange={(e) => {
                    setSelectedConnection({
                      ...selectedConnection,
                      syncFrequency: e.target.value as BankConnection["syncFrequency"]
                    });
                  }}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#64B5F6]/50"
                >
                  <option value="realtime">Real-time (as transactions occur)</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily (midnight)</option>
                  <option value="manual">Manual only</option>
                </select>
              </div>

              {/* Default Account */}
              {selectedConnection.accounts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Default Account for Imports
                  </label>
                  <select
                    value={selectedConnection.accounts.find(a => a.isDefault)?.id || ""}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#64B5F6]/50"
                  >
                    {selectedConnection.accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.accountNumber} - {account.accountName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Auto Classification Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/5">
                <div>
                  <p className="font-medium">Auto-classify Transactions</p>
                  <p className="text-sm text-gray-500">Use AI to categorize imported transactions</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#64B5F6]"></div>
                </label>
              </div>

              {/* Danger Zone */}
              <div className="pt-4 border-t border-white/10">
                <h4 className="text-sm font-medium text-red-400 mb-3">Danger Zone</h4>
                <button
                  onClick={() => handleDisconnectBank(selectedConnection.id)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-400 rounded-lg font-medium hover:bg-red-500/20 transition-colors"
                >
                  <Unlink className="w-5 h-5" />
                  Disconnect Bank
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-white/10 bg-white/[0.02] flex justify-end gap-3">
              <button
                onClick={() => setSelectedConnection(null)}
                className="px-4 py-2.5 text-gray-400 rounded-lg hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Save settings
                  setConnections(prev => prev.map(c => 
                    c.id === selectedConnection.id ? selectedConnection : c
                  ));
                  setSelectedConnection(null);
                }}
                className="px-4 py-2.5 bg-[#64B5F6] text-black rounded-lg font-medium hover:bg-[#64B5F6]/90 transition-colors"
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
