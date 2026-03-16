"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import {
    parseBankStatementCSV,
    parseLedgerCSV,
    performReconciliation,
    formatCurrency,
    ParsedFile,
    ReconciliationResult,
    MatchedPair,
    DiscrepancyItem,
    BankTransaction,
    LedgerTransaction,
} from "@/lib/accounting/bankReconciliation";

// Types for AI Response
interface AIInsight {
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    affectedTransactions: string[];
    recommendation: string;
}

interface AIReconciliationResponse {
    overallAssessment: 'balanced' | 'needs_attention' | 'critical_issues';
    confidence: number;
    summary: string;
    insights: AIInsight[];
    recommendations: string[];
    flaggedPatterns: {
        pattern: string;
        riskLevel: 'low' | 'medium' | 'high';
        recommendation: string;
    }[];
}

type TabType = 'summary' | 'matched' | 'unmatched' | 'discrepancies' | 'ai-insights';

export default function BankReconciliationPage() {
    // File upload state
    const [bankFile, setBankFile] = useState<ParsedFile | null>(null);
    const [ledgerFile, setLedgerFile] = useState<ParsedFile | null>(null);
    const [bankDragActive, setBankDragActive] = useState(false);
    const [ledgerDragActive, setLedgerDragActive] = useState(false);
    const bankInputRef = useRef<HTMLInputElement>(null);
    const ledgerInputRef = useRef<HTMLInputElement>(null);

    // Reconciliation state
    const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);
    const [isReconciling, setIsReconciling] = useState(false);
    const [reconcileError, setReconcileError] = useState<string | null>(null);

    // AI Analysis state
    const [aiResult, setAiResult] = useState<AIReconciliationResponse | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    // UI state
    const [activeTab, setActiveTab] = useState<TabType>('summary');

    // Handle file upload
    const handleFileUpload = useCallback(async (
        file: File,
        type: 'bank' | 'ledger'
    ) => {
        try {
            const content = await file.text();

            if (type === 'bank') {
                const parsed = parseBankStatementCSV(content, file.name);
                setBankFile(parsed);
            } else {
                const parsed = parseLedgerCSV(content, file.name);
                setLedgerFile(parsed);
            }
        } catch (error) {
            console.error('Error parsing file:', error);
            setReconcileError(`Failed to parse ${type} file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, []);

    // Drag and drop handlers
    const handleDrag = useCallback((e: React.DragEvent, type: 'bank' | 'ledger', active: boolean) => {
        e.preventDefault();
        e.stopPropagation();
        if (type === 'bank') {
            setBankDragActive(active);
        } else {
            setLedgerDragActive(active);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, type: 'bank' | 'ledger') => {
        e.preventDefault();
        e.stopPropagation();
        if (type === 'bank') setBankDragActive(false);
        else setLedgerDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0], type);
        }
    }, [handleFileUpload]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'bank' | 'ledger') => {
        if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0], type);
        }
    }, [handleFileUpload]);

    // Perform reconciliation
    const handleReconcile = useCallback(() => {
        if (!bankFile || !ledgerFile) {
            setReconcileError('Please upload both bank statement and ledger files');
            return;
        }

        setIsReconciling(true);
        setReconcileError(null);
        setAiResult(null);

        try {
            const result = performReconciliation(bankFile, ledgerFile);
            setReconciliationResult(result);
            setActiveTab('summary');
        } catch (error) {
            setReconcileError(`Reconciliation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsReconciling(false);
        }
    }, [bankFile, ledgerFile]);

    // AI Analysis
    const handleAIAnalysis = useCallback(async () => {
        if (!reconciliationResult) return;

        setIsAnalyzing(true);
        setAiError(null);

        try {
            const response = await fetch('/api/ai/bank-reconciliation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reconciliationResult }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'AI analysis failed');
            }

            const result = await response.json();
            setAiResult(result);
            setActiveTab('ai-insights');
        } catch (error) {
            setAiError(error instanceof Error ? error.message : 'Failed to run AI analysis');
        } finally {
            setIsAnalyzing(false);
        }
    }, [reconciliationResult]);

    // Reset
    const handleReset = useCallback(() => {
        setBankFile(null);
        setLedgerFile(null);
        setReconciliationResult(null);
        setAiResult(null);
        setReconcileError(null);
        setAiError(null);
        setActiveTab('summary');
    }, []);

    // Severity color helpers
    const getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
        switch (severity) {
            case 'high': return 'bg-red-100 text-red-700 border-red-200';
            case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'low': return 'bg-blue-100 text-blue-700 border-blue-200';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'balanced': return 'bg-emerald-100 text-emerald-700';
            case 'critical_issues': return 'bg-red-100 text-red-700';
            default: return 'bg-amber-100 text-amber-700';
        }
    };

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 0.9) return 'text-emerald-600';
        if (confidence >= 0.7) return 'text-blue-600';
        if (confidence >= 0.5) return 'text-amber-600';
        return 'text-red-600';
    };

    return (
        <div className="space-y-6 px-2 md:px-0">
            {/* Header */}
            <div className="rounded-2xl bg-white border border-gray-200 px-6 py-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Bank Reconciliation</h1>
                                <p className="text-sm text-gray-500">Match bank statements with ledger entries • AI-powered analysis</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/accounting"
                            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Accounting
                        </Link>
                        {(bankFile || ledgerFile) && (
                            <button
                                onClick={handleReset}
                                className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Reset
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* File Upload Section */}
            {!reconciliationResult && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Bank Statement Upload */}
                    <div
                        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${bankDragActive
                                ? 'border-blue-500 bg-blue-50'
                                : bankFile
                                    ? 'border-emerald-300 bg-emerald-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                            }`}
                        onDragEnter={(e) => handleDrag(e, 'bank', true)}
                        onDragLeave={(e) => handleDrag(e, 'bank', false)}
                        onDragOver={(e) => handleDrag(e, 'bank', true)}
                        onDrop={(e) => handleDrop(e, 'bank')}
                        onClick={() => bankInputRef.current?.click()}
                    >
                        <input
                            ref={bankInputRef}
                            type="file"
                            accept=".csv,.xlsx"
                            onChange={(e) => handleInputChange(e, 'bank')}
                            className="hidden"
                        />
                        {bankFile ? (
                            <div>
                                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="font-semibold text-gray-900 mb-1">{bankFile.filename}</p>
                                <p className="text-sm text-gray-500">
                                    {bankFile.metadata.totalRecords} transactions • {bankFile.metadata.dateRange.start} to {bankFile.metadata.dateRange.end}
                                </p>
                                <p className="text-xs text-gray-400 mt-2">
                                    Debits: {formatCurrency(bankFile.metadata.totalDebits)} | Credits: {formatCurrency(bankFile.metadata.totalCredits)}
                                </p>
                            </div>
                        ) : (
                            <div>
                                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                    </svg>
                                </div>
                                <p className="font-semibold text-gray-900 mb-1">Bank Statement</p>
                                <p className="text-sm text-gray-500 mb-4">Drop CSV file here or click to browse</p>
                                <p className="text-xs text-gray-400">Supported: CSV files with Date, Description, Debit, Credit columns</p>
                            </div>
                        )}
                    </div>

                    {/* Ledger Upload */}
                    <div
                        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${ledgerDragActive
                                ? 'border-purple-500 bg-purple-50'
                                : ledgerFile
                                    ? 'border-emerald-300 bg-emerald-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                            }`}
                        onDragEnter={(e) => handleDrag(e, 'ledger', true)}
                        onDragLeave={(e) => handleDrag(e, 'ledger', false)}
                        onDragOver={(e) => handleDrag(e, 'ledger', true)}
                        onDrop={(e) => handleDrop(e, 'ledger')}
                        onClick={() => ledgerInputRef.current?.click()}
                    >
                        <input
                            ref={ledgerInputRef}
                            type="file"
                            accept=".csv,.xlsx"
                            onChange={(e) => handleInputChange(e, 'ledger')}
                            className="hidden"
                        />
                        {ledgerFile ? (
                            <div>
                                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="font-semibold text-gray-900 mb-1">{ledgerFile.filename}</p>
                                <p className="text-sm text-gray-500">
                                    {ledgerFile.metadata.totalRecords} entries • {ledgerFile.metadata.dateRange.start} to {ledgerFile.metadata.dateRange.end}
                                </p>
                                <p className="text-xs text-gray-400 mt-2">
                                    Debits: {formatCurrency(ledgerFile.metadata.totalDebits)} | Credits: {formatCurrency(ledgerFile.metadata.totalCredits)}
                                </p>
                            </div>
                        ) : (
                            <div>
                                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <p className="font-semibold text-gray-900 mb-1">Ledger / Journal Export</p>
                                <p className="text-sm text-gray-500 mb-4">Drop CSV file here or click to browse</p>
                                <p className="text-xs text-gray-400">Supported: CSV files with Date, Narration, Debit, Credit columns</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Error Message */}
            {reconcileError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <p className="font-medium text-red-800">Error</p>
                        <p className="text-sm text-red-600">{reconcileError}</p>
                    </div>
                </div>
            )}

            {/* Reconcile Button */}
            {bankFile && ledgerFile && !reconciliationResult && (
                <div className="flex justify-center">
                    <button
                        onClick={handleReconcile}
                        disabled={isReconciling}
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                        {isReconciling ? (
                            <>
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Reconciling...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Start Reconciliation
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Results Section */}
            {reconciliationResult && (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="rounded-xl bg-white border border-gray-200 p-4">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total Transactions</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {reconciliationResult.totalBankTransactions + reconciliationResult.totalLedgerTransactions}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">Bank: {reconciliationResult.totalBankTransactions} | Ledger: {reconciliationResult.totalLedgerTransactions}</p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                            <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-1">Matched</p>
                            <p className="text-2xl font-bold text-emerald-700">{reconciliationResult.summary.matchedCount}</p>
                            <p className="text-xs text-emerald-500 mt-1">
                                {((reconciliationResult.summary.matchedCount / reconciliationResult.totalBankTransactions) * 100).toFixed(1)}% match rate
                            </p>
                        </div>
                        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                            <p className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-1">Unmatched Bank</p>
                            <p className="text-2xl font-bold text-amber-700">{reconciliationResult.summary.unmatchedBankCount}</p>
                        </div>
                        <div className="rounded-xl bg-purple-50 border border-purple-200 p-4">
                            <p className="text-xs font-medium text-purple-600 uppercase tracking-wider mb-1">Unmatched Ledger</p>
                            <p className="text-2xl font-bold text-purple-700">{reconciliationResult.summary.unmatchedLedgerCount}</p>
                        </div>
                        <div className={`rounded-xl p-4 ${reconciliationResult.summary.reconciliationStatus === 'balanced'
                                ? 'bg-emerald-50 border border-emerald-200'
                                : 'bg-red-50 border border-red-200'
                            }`}>
                            <p className={`text-xs font-medium uppercase tracking-wider mb-1 ${reconciliationResult.summary.reconciliationStatus === 'balanced' ? 'text-emerald-600' : 'text-red-600'
                                }`}>Balance Difference</p>
                            <p className={`text-2xl font-bold ${reconciliationResult.summary.reconciliationStatus === 'balanced' ? 'text-emerald-700' : 'text-red-700'
                                }`}>{formatCurrency(reconciliationResult.summary.balanceDifference)}</p>
                            <p className={`text-xs mt-1 capitalize ${reconciliationResult.summary.reconciliationStatus === 'balanced' ? 'text-emerald-500' : 'text-red-500'
                                }`}>{reconciliationResult.summary.reconciliationStatus}</p>
                        </div>
                    </div>

                    {/* Tab Navigation + AI Button */}
                    <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex bg-gray-50 rounded-lg p-1 border border-gray-200 overflow-x-auto hide-scrollbar">
                                {(['summary', 'matched', 'unmatched', 'discrepancies', 'ai-insights'] as TabType[]).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${activeTab === tab
                                                ? 'bg-white text-gray-900 shadow-sm border border-gray-100'
                                                : 'text-gray-500 hover:text-gray-900'
                                            }`}
                                    >
                                        {tab === 'summary' ? 'Summary' :
                                            tab === 'matched' ? `Matched (${reconciliationResult.summary.matchedCount})` :
                                                tab === 'unmatched' ? `Unmatched (${reconciliationResult.summary.unmatchedBankCount + reconciliationResult.summary.unmatchedLedgerCount})` :
                                                    tab === 'discrepancies' ? `Discrepancies (${reconciliationResult.summary.discrepancyCount})` :
                                                        'AI Insights'}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={handleAIAnalysis}
                                disabled={isAnalyzing}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                        </svg>
                                        AI Analysis
                                    </>
                                )}
                            </button>
                        </div>

                        {/* AI Error */}
                        {aiError && (
                            <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-700">{aiError}</p>
                            </div>
                        )}

                        {/* Tab Content */}
                        <div className="p-6">
                            {/* Summary Tab */}
                            {activeTab === 'summary' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="rounded-xl bg-gray-50 p-5">
                                            <h3 className="text-sm font-semibold text-gray-900 mb-3">Bank Statement</h3>
                                            <dl className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <dt className="text-gray-500">Period</dt>
                                                    <dd className="font-medium text-gray-900">{reconciliationResult.bankStatementPeriod.start} to {reconciliationResult.bankStatementPeriod.end}</dd>
                                                </div>
                                                <div className="flex justify-between">
                                                    <dt className="text-gray-500">Transactions</dt>
                                                    <dd className="font-medium text-gray-900">{reconciliationResult.totalBankTransactions}</dd>
                                                </div>
                                                <div className="flex justify-between">
                                                    <dt className="text-gray-500">Closing Balance</dt>
                                                    <dd className="font-medium text-gray-900">{formatCurrency(reconciliationResult.bankClosingBalance)}</dd>
                                                </div>
                                            </dl>
                                        </div>
                                        <div className="rounded-xl bg-gray-50 p-5">
                                            <h3 className="text-sm font-semibold text-gray-900 mb-3">Internal Ledger</h3>
                                            <dl className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <dt className="text-gray-500">Entries</dt>
                                                    <dd className="font-medium text-gray-900">{reconciliationResult.totalLedgerTransactions}</dd>
                                                </div>
                                                <div className="flex justify-between">
                                                    <dt className="text-gray-500">Matched</dt>
                                                    <dd className="font-medium text-emerald-600">{reconciliationResult.summary.matchedCount}</dd>
                                                </div>
                                                <div className="flex justify-between">
                                                    <dt className="text-gray-500">Unmatched</dt>
                                                    <dd className="font-medium text-amber-600">{reconciliationResult.summary.unmatchedLedgerCount}</dd>
                                                </div>
                                            </dl>
                                        </div>
                                    </div>

                                    {reconciliationResult.discrepancies.length > 0 && (
                                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                                            <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                Attention Required
                                            </h3>
                                            <p className="text-sm text-amber-700 mb-2">
                                                {reconciliationResult.discrepancies.length} discrepancies detected. Review the Discrepancies tab for details.
                                            </p>
                                            <button
                                                onClick={() => setActiveTab('discrepancies')}
                                                className="text-sm font-medium text-amber-800 hover:text-amber-900 underline"
                                            >
                                                View Discrepancies →
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Matched Tab */}
                            {activeTab === 'matched' && (
                                <div className="overflow-x-auto">
                                    {reconciliationResult.matchedPairs.length > 0 ? (
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-gray-200">
                                                    <th className="text-left py-3 px-2 font-semibold text-gray-900">Bank Transaction</th>
                                                    <th className="text-left py-3 px-2 font-semibold text-gray-900">Ledger Entry</th>
                                                    <th className="text-center py-3 px-2 font-semibold text-gray-900">Confidence</th>
                                                    <th className="text-left py-3 px-2 font-semibold text-gray-900">Matched On</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {reconciliationResult.matchedPairs.slice(0, 50).map((pair) => (
                                                    <tr key={pair.id} className="hover:bg-gray-50">
                                                        <td className="py-3 px-2">
                                                            <p className="font-medium text-gray-900 truncate max-w-xs">{pair.bankTransaction.description}</p>
                                                            <p className="text-xs text-gray-500">{pair.bankTransaction.date} • {formatCurrency(Math.abs(pair.bankTransaction.amount))}</p>
                                                        </td>
                                                        <td className="py-3 px-2">
                                                            <p className="font-medium text-gray-900 truncate max-w-xs">{pair.ledgerTransaction.narration}</p>
                                                            <p className="text-xs text-gray-500">{pair.ledgerTransaction.date} • {formatCurrency(Math.abs(pair.ledgerTransaction.amount))}</p>
                                                        </td>
                                                        <td className="py-3 px-2 text-center">
                                                            <span className={`font-semibold ${getConfidenceColor(pair.confidence)}`}>
                                                                {(pair.confidence * 100).toFixed(0)}%
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-2">
                                                            <div className="flex flex-wrap gap-1">
                                                                {pair.matchedOn.map((field, i) => (
                                                                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                                                        {field}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="text-center py-12 text-gray-400">
                                            <p>No matched transactions</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Unmatched Tab */}
                            {activeTab === 'unmatched' && (
                                <div className="space-y-6">
                                    {reconciliationResult.unmatchedBankTransactions.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-900 mb-3">Unmatched Bank Transactions</h3>
                                            <div className="overflow-x-auto rounded-lg border border-gray-200">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="text-left py-2 px-3 font-semibold text-gray-700">Date</th>
                                                            <th className="text-left py-2 px-3 font-semibold text-gray-700">Description</th>
                                                            <th className="text-right py-2 px-3 font-semibold text-gray-700">Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {reconciliationResult.unmatchedBankTransactions.slice(0, 30).map((tx) => (
                                                            <tr key={tx.id} className="hover:bg-amber-50">
                                                                <td className="py-2 px-3 text-gray-900">{tx.date}</td>
                                                                <td className="py-2 px-3 text-gray-900 max-w-md truncate">{tx.description}</td>
                                                                <td className={`py-2 px-3 text-right font-medium ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                    {formatCurrency(tx.amount)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {reconciliationResult.unmatchedLedgerTransactions.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-900 mb-3">Unmatched Ledger Entries</h3>
                                            <div className="overflow-x-auto rounded-lg border border-gray-200">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="text-left py-2 px-3 font-semibold text-gray-700">Date</th>
                                                            <th className="text-left py-2 px-3 font-semibold text-gray-700">Narration</th>
                                                            <th className="text-right py-2 px-3 font-semibold text-gray-700">Debit</th>
                                                            <th className="text-right py-2 px-3 font-semibold text-gray-700">Credit</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {reconciliationResult.unmatchedLedgerTransactions.slice(0, 30).map((tx) => (
                                                            <tr key={tx.id} className="hover:bg-purple-50">
                                                                <td className="py-2 px-3 text-gray-900">{tx.date}</td>
                                                                <td className="py-2 px-3 text-gray-900 max-w-md truncate">{tx.narration}</td>
                                                                <td className="py-2 px-3 text-right font-medium text-gray-900">
                                                                    {tx.debit > 0 ? formatCurrency(tx.debit) : '—'}
                                                                </td>
                                                                <td className="py-2 px-3 text-right font-medium text-gray-900">
                                                                    {tx.credit > 0 ? formatCurrency(tx.credit) : '—'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {reconciliationResult.unmatchedBankTransactions.length === 0 && reconciliationResult.unmatchedLedgerTransactions.length === 0 && (
                                        <div className="text-center py-12">
                                            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                                                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            <p className="text-gray-600 font-medium">All transactions matched!</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Discrepancies Tab */}
                            {activeTab === 'discrepancies' && (
                                <div className="space-y-4">
                                    {reconciliationResult.discrepancies.length > 0 ? (
                                        reconciliationResult.discrepancies.slice(0, 30).map((disc) => (
                                            <div key={disc.id} className={`rounded-xl border p-4 ${getSeverityColor(disc.severity)}`}>
                                                <div className="flex items-start justify-between gap-4 mb-2">
                                                    <div>
                                                        <span className="text-xs font-semibold uppercase tracking-wider opacity-75">
                                                            {disc.type.replace(/_/g, ' ')}
                                                        </span>
                                                        <p className="font-medium mt-1">{disc.description}</p>
                                                    </div>
                                                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${disc.severity === 'high' ? 'bg-red-200' :
                                                            disc.severity === 'medium' ? 'bg-amber-200' : 'bg-blue-200'
                                                        }`}>
                                                        {disc.severity}
                                                    </span>
                                                </div>
                                                {disc.difference !== undefined && (
                                                    <p className="text-sm opacity-75 mb-2">
                                                        Difference: <span className="font-semibold">{formatCurrency(disc.difference)}</span>
                                                    </p>
                                                )}
                                                {disc.recommendation && (
                                                    <div className="mt-3 pt-3 border-t border-current/20">
                                                        <p className="text-sm">
                                                            <span className="font-semibold">Recommendation:</span> {disc.recommendation}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-12">
                                            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                                                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            <p className="text-gray-600 font-medium">No discrepancies detected!</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* AI Insights Tab */}
                            {activeTab === 'ai-insights' && (
                                <div className="space-y-6">
                                    {aiResult ? (
                                        <>
                                            {/* Overall Assessment */}
                                            <div className={`rounded-xl p-5 ${getStatusColor(aiResult.overallAssessment)}`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <h3 className="text-sm font-semibold uppercase tracking-wider">Overall Assessment</h3>
                                                    <span className="text-sm font-semibold">
                                                        Confidence: {(aiResult.confidence * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                                <p className="text-sm">{aiResult.summary}</p>
                                            </div>

                                            {/* Recommendations */}
                                            {aiResult.recommendations && aiResult.recommendations.length > 0 && (
                                                <div className="rounded-xl bg-blue-50 border border-blue-200 p-5">
                                                    <h3 className="text-sm font-semibold text-blue-800 mb-3">Priority Recommendations</h3>
                                                    <ol className="space-y-2 text-sm text-blue-700 list-decimal list-inside">
                                                        {aiResult.recommendations.map((rec, i) => (
                                                            <li key={i}>{rec}</li>
                                                        ))}
                                                    </ol>
                                                </div>
                                            )}

                                            {/* AI Insights */}
                                            {aiResult.insights && aiResult.insights.length > 0 && (
                                                <div>
                                                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Detailed Insights</h3>
                                                    <div className="space-y-3">
                                                        {aiResult.insights.map((insight, i) => (
                                                            <div key={i} className={`rounded-lg border p-4 ${getSeverityColor(insight.severity)}`}>
                                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                                    <span className="text-xs font-semibold uppercase tracking-wider opacity-75">
                                                                        {insight.type.replace(/_/g, ' ')}
                                                                    </span>
                                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${insight.severity === 'high' ? 'bg-red-200' :
                                                                            insight.severity === 'medium' ? 'bg-amber-200' : 'bg-blue-200'
                                                                        }`}>
                                                                        {insight.severity}
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm mb-2">{insight.description}</p>
                                                                <p className="text-sm opacity-75">
                                                                    <span className="font-semibold">Recommendation:</span> {insight.recommendation}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Flagged Patterns */}
                                            {aiResult.flaggedPatterns && aiResult.flaggedPatterns.length > 0 && (
                                                <div className="rounded-xl bg-red-50 border border-red-200 p-5">
                                                    <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                        </svg>
                                                        Flagged Patterns
                                                    </h3>
                                                    <div className="space-y-3">
                                                        {aiResult.flaggedPatterns.map((pattern, i) => (
                                                            <div key={i} className="text-sm">
                                                                <p className="font-medium text-red-800">{pattern.pattern}</p>
                                                                <p className="text-red-600 text-xs mt-1">
                                                                    Risk Level: {pattern.riskLevel} • {pattern.recommendation}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="text-center py-12">
                                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                                                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                </svg>
                                            </div>
                                            <p className="text-gray-600 font-medium mb-2">No AI analysis yet</p>
                                            <p className="text-sm text-gray-400">Click the &quot;AI Analysis&quot; button to get intelligent insights</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
