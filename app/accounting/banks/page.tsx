"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

// =============================================================================
// TYPES
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
  status: BankConnectionStatus;
  accounts: BankAccount[];
  connectedAt: string;
  lastSyncAt?: string;
  syncFrequency: "realtime" | "hourly" | "daily" | "manual";
  transactionCount: number;
}

export interface BankProvider {
  code: string;
  name: string;
  shortName: string;
  color: string;
  supported: boolean;
  connectionType: "open_banking" | "statement_upload" | "coming_soon";
  features: string[];
}

// =============================================================================
// BANK DATA
// =============================================================================

const SUPPORTED_BANKS: BankProvider[] = [
  { code: "zenith", name: "Zenith Bank Plc", shortName: "Zenith", color: "#E21A2D", supported: true, connectionType: "open_banking", features: ["Real-time sync", "Multi-account"] },
  { code: "gtbank", name: "Guaranty Trust Bank", shortName: "GTBank", color: "#F7941D", supported: true, connectionType: "open_banking", features: ["Real-time sync", "Multi-account"] },
  { code: "access", name: "Access Bank Plc", shortName: "Access", color: "#F36F21", supported: true, connectionType: "open_banking", features: ["Real-time sync", "Multi-account"] },
  { code: "firstbank", name: "First Bank of Nigeria", shortName: "FirstBank", color: "#003B71", supported: true, connectionType: "open_banking", features: ["Daily sync"] },
  { code: "uba", name: "United Bank for Africa", shortName: "UBA", color: "#E31937", supported: true, connectionType: "open_banking", features: ["Daily sync"] },
  { code: "stanbic", name: "Stanbic IBTC Bank", shortName: "Stanbic", color: "#0033A0", supported: true, connectionType: "statement_upload", features: ["Statement upload"] },
  { code: "fcmb", name: "First City Monument Bank", shortName: "FCMB", color: "#5C2D91", supported: true, connectionType: "statement_upload", features: ["Statement upload"] },
  { code: "fidelity", name: "Fidelity Bank Plc", shortName: "Fidelity", color: "#00A859", supported: true, connectionType: "statement_upload", features: ["Statement upload"] },
  { code: "ecobank", name: "Ecobank Nigeria", shortName: "Ecobank", color: "#0066B3", supported: false, connectionType: "coming_soon", features: ["Coming Q1 2025"] },
  { code: "sterling", name: "Sterling Bank Plc", shortName: "Sterling", color: "#CE1126", supported: false, connectionType: "coming_soon", features: ["Coming Q1 2025"] },
];

// =============================================================================
// ICONS
// =============================================================================

const icons = {
  bank: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
    </svg>
  ),
  refresh: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  plus: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  trash: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  close: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  link: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  card: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  document: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  chart: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  shield: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function BankConnectionsPage() {
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedBank, setSelectedBank] = useState<BankProvider | null>(null);
  const [connectStep, setConnectStep] = useState<"select" | "connecting" | "success">("select");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    show: boolean;
    imported: number;
    income: number;
    expenses: number;
  } | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    type: "credit" | "debit";
    narration?: string;
  }>>([]);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const saved = localStorage.getItem("insight::bank-connections");
        if (saved) setConnections(JSON.parse(saved));

        const res = await fetch("/api/bank-connections/transactions?connectionId=demo&limit=5");
        if (res.ok) {
          const data = await res.json();
          setRecentTransactions(data.transactions || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Save connections
  useEffect(() => {
    if (connections.length > 0) {
      localStorage.setItem("insight::bank-connections", JSON.stringify(connections));
    }
  }, [connections]);

  // Stats
  const stats = useMemo(() => ({
    connectedBanks: connections.filter(c => c.status === "connected").length,
    totalAccounts: connections.reduce((acc, c) => acc + c.accounts.length, 0),
    totalTransactions: connections.reduce((acc, c) => acc + c.transactionCount, 0),
    totalBalance: connections.reduce((acc, c) =>
      acc + c.accounts.filter(a => a.currency === "NGN").reduce((s, a) => s + (a.balance || 0), 0), 0),
  }), [connections]);

  // Connect bank
  const handleConnectBank = async (bank: BankProvider) => {
    if (!bank.supported) return;

    setSelectedBank(bank);
    setConnectStep("connecting");

    try {
      const res = await fetch("/api/bank-connections/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankCode: bank.code }),
      });

      const data = await res.json();
      await new Promise(r => setTimeout(r, 2000));

      const newConnection: BankConnection = {
        id: data.connectionId || `conn_${bank.code}_${Date.now()}`,
        bankCode: bank.code,
        bankName: bank.name,
        status: "connected",
        accounts: [{
          id: `acc_${Date.now()}`,
          accountNumber: "****" + Math.floor(1000 + Math.random() * 9000),
          accountName: "Business Account",
          accountType: "corporate",
          currency: "NGN",
          balance: Math.floor(1000000 + Math.random() * 9000000),
          lastSynced: new Date().toISOString(),
          isDefault: true,
        }],
        connectedAt: new Date().toISOString(),
        lastSyncAt: new Date().toISOString(),
        syncFrequency: "hourly",
        transactionCount: Math.floor(100 + Math.random() * 500),
      };

      setConnections(prev => [...prev, newConnection]);
      setConnectStep("success");

      setTimeout(() => {
        setShowConnectModal(false);
        setConnectStep("select");
        setSelectedBank(null);
      }, 2000);
    } catch (error) {
      console.error(error);
      setConnectStep("select");
    }
  };

  // Sync and import
  const handleSync = async (connectionId: string) => {
    setSyncingId(connectionId);
    try {
      const res = await fetch("/api/bank-connections/transactions?connectionId=" + connectionId + "&limit=20");
      const data = await res.json();

      if (data.success && data.transactions?.length > 0) {
        const { importBankTransactions } = await import("@/lib/accounting/bankImporter");
        const result = importBankTransactions(data.transactions);

        setImportResult({
          show: true,
          imported: result.imported,
          income: result.summary.income,
          expenses: result.summary.expenses,
        });

        setConnections(prev => prev.map(c =>
          c.id === connectionId
            ? { ...c, lastSyncAt: new Date().toISOString(), transactionCount: c.transactionCount + result.imported }
            : c
        ));

        setRecentTransactions(data.transactions.slice(0, 5));
        setTimeout(() => setImportResult(null), 5000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncingId(null);
    }
  };

  // Disconnect
  const handleDisconnect = (connectionId: string) => {
    if (confirm("Disconnect this bank? Transaction sync will stop.")) {
      setConnections(prev => prev.filter(c => c.id !== connectionId));
    }
  };

  const formatCurrency = (amount: number) => `₦${amount.toLocaleString()}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-[#64B5F6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-white border border-gray-200 px-6 py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
              {icons.bank}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Bank Connections</h1>
              <p className="text-sm text-gray-500">Connect accounts for automatic transaction sync</p>
            </div>
          </div>
          <button
            onClick={() => setShowConnectModal(true)}
            className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-gray-800 transition-colors"
          >
            {icons.plus}
            Connect Bank
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Connected Banks", value: stats.connectedBanks.toString(), icon: icons.link, color: "text-blue-600", bg: "bg-blue-100" },
          { label: "Total Accounts", value: stats.totalAccounts.toString(), icon: icons.card, color: "text-green-600", bg: "bg-green-100" },
          { label: "Transactions", value: stats.totalTransactions.toLocaleString(), icon: icons.document, color: "text-purple-600", bg: "bg-purple-100" },
          { label: "Total Balance", value: formatCurrency(stats.totalBalance), icon: icons.chart, color: "text-amber-600", bg: "bg-amber-100" },
        ].map((stat, i) => (
          <div key={i} className="rounded-2xl bg-white border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center ${stat.color}`}>
                {stat.icon}
              </div>
              <span className="text-sm text-gray-500">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Connected Banks */}
      <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Your Banks</h2>
        </div>

        {connections.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No banks connected</h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Connect your business accounts to automatically import transactions and create journal entries.
            </p>
            <button
              onClick={() => setShowConnectModal(true)}
              className="inline-flex items-center gap-2 bg-[#64B5F6] text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#4A9FD9] transition-colors"
            >
              {icons.plus}
              Connect Your First Bank
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {connections.map((connection) => {
              const bank = SUPPORTED_BANKS.find(b => b.code === connection.bankCode);
              const isSyncing = syncingId === connection.id;

              return (
                <div key={connection.id} className="p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                        style={{ backgroundColor: bank?.color || "#666" }}
                      >
                        {bank?.shortName.slice(0, 2) || "BK"}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{connection.bankName}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${connection.status === "connected"
                              ? "bg-green-50 text-green-700"
                              : "bg-amber-50 text-amber-700"
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${connection.status === "connected" ? "bg-green-500" : "bg-amber-500"
                              }`} />
                            {connection.status === "connected" ? "Connected" : "Pending"}
                          </span>
                          <span className="text-sm text-gray-500">
                            {connection.accounts.length} account{connection.accounts.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSync(connection.id)}
                        disabled={isSyncing}
                        className="p-2.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                        title="Sync & Import"
                      >
                        <span className={isSyncing ? "animate-spin inline-block" : ""}>
                          {icons.refresh}
                        </span>
                      </button>
                      <button
                        onClick={() => handleDisconnect(connection.id)}
                        className="p-2.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                        title="Disconnect"
                      >
                        {icons.trash}
                      </button>
                    </div>
                  </div>

                  {/* Accounts */}
                  {connection.accounts.length > 0 && (
                    <div className="mt-4 grid gap-3">
                      {connection.accounts.map((account) => (
                        <div key={account.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                          <div>
                            <p className="font-medium text-gray-900">{account.accountName}</p>
                            <p className="text-sm text-gray-500">{account.accountNumber} • {account.accountType}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">{formatCurrency(account.balance || 0)}</p>
                            <p className="text-xs text-gray-400">Synced: {account.lastSynced ? formatDate(account.lastSynced) : "Never"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
                    <span className="text-gray-500">{connection.transactionCount.toLocaleString()} transactions synced</span>
                    <span className="text-gray-400">Connected {new Date(connection.connectedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      {recentTransactions.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
            <Link href="/accounting/workspace" className="text-sm text-[#64B5F6] hover:underline font-medium">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentTransactions.slice(0, 5).map((tx) => (
              <div key={tx.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === "credit" ? "bg-green-50" : "bg-red-50"
                    }`}>
                    <svg className={`w-5 h-5 ${tx.type === "credit" ? "text-green-600" : "text-red-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={tx.type === "credit" ? "M12 4v16m0-16l-4 4m4-4l4 4" : "M12 20V4m0 16l-4-4m4 4l4-4"} />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{tx.description}</p>
                    <p className="text-xs text-gray-400">{formatDate(tx.date)}</p>
                  </div>
                </div>
                <span className={`font-semibold ${tx.type === "credit" ? "text-green-600" : "text-gray-900"}`}>
                  {tx.type === "credit" ? "+" : "-"}{formatCurrency(Math.abs(tx.amount))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supported Banks */}
      <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Supported Banks</h2>
        </div>
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {SUPPORTED_BANKS.map((bank) => {
            const isConnected = connections.some(c => c.bankCode === bank.code);

            return (
              <button
                key={bank.code}
                onClick={() => !isConnected && bank.supported && handleConnectBank(bank)}
                disabled={!bank.supported || isConnected}
                className={`relative rounded-xl p-4 text-center transition-all ${isConnected
                    ? "bg-green-50 border-2 border-green-200"
                    : bank.supported
                      ? "bg-gray-50 hover:bg-gray-100 border border-gray-200"
                      : "bg-gray-50 border border-gray-100 opacity-50"
                  }`}
              >
                {isConnected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center">
                    {icons.check}
                  </div>
                )}
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm mx-auto mb-2"
                  style={{ backgroundColor: bank.color }}
                >
                  {bank.shortName.slice(0, 2)}
                </div>
                <p className="font-medium text-gray-900 text-sm">{bank.shortName}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isConnected ? "Connected" : bank.supported ? bank.connectionType.replace("_", " ") : "Coming soon"}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Security Notice */}
      <div className="rounded-2xl bg-blue-50 border border-blue-100 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
            {icons.shield}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">Bank-grade Security</h3>
            <p className="text-sm text-gray-600">
              Your credentials are never stored. We use OAuth 2.0 and Open Banking APIs for secure, read-only access.
            </p>
          </div>
        </div>
      </div>

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {connectStep === "select" && "Connect a Bank"}
                {connectStep === "connecting" && "Connecting..."}
                {connectStep === "success" && "Connected!"}
              </h2>
              <button
                onClick={() => { setShowConnectModal(false); setConnectStep("select"); setSelectedBank(null); }}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                {icons.close}
              </button>
            </div>

            <div className="p-6">
              {connectStep === "select" && (
                <div className="grid grid-cols-2 gap-3">
                  {SUPPORTED_BANKS.filter(b => b.supported).map((bank) => (
                    <button
                      key={bank.code}
                      onClick={() => handleConnectBank(bank)}
                      className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-left"
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: bank.color }}
                      >
                        {bank.shortName.slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{bank.shortName}</p>
                        <p className="text-xs text-gray-400">{bank.connectionType.replace("_", " ")}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {connectStep === "connecting" && selectedBank && (
                <div className="text-center py-8">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-6 animate-pulse"
                    style={{ backgroundColor: selectedBank.color }}
                  >
                    {selectedBank.shortName.slice(0, 2)}
                  </div>
                  <p className="text-gray-900 font-medium mb-2">Connecting to {selectedBank.name}...</p>
                  <p className="text-sm text-gray-500">Establishing secure connection</p>
                  <div className="mt-6 flex justify-center">
                    <div className="w-8 h-8 border-2 border-[#64B5F6] border-t-transparent rounded-full animate-spin" />
                  </div>
                </div>
              )}

              {connectStep === "success" && selectedBank && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-gray-900 font-medium mb-2">Successfully Connected!</p>
                  <p className="text-sm text-gray-500">{selectedBank.name} is now linked.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Toast */}
      {importResult?.show && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-gray-900 text-white rounded-2xl shadow-2xl p-5 max-w-sm">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">Imported to Accounting</h4>
                <p className="text-sm text-gray-400 mb-2">{importResult.imported} journal entries created</p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-400">+₦{importResult.income.toLocaleString()}</span>
                  <span className="text-red-400">-₦{importResult.expenses.toLocaleString()}</span>
                </div>
              </div>
              <button onClick={() => setImportResult(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
