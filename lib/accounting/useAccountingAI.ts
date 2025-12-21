/**
 * React Hook for AI-Enhanced Accounting
 * Provides dual rule-based + AI classification for Nigerian accounting
 */

import { useState, useCallback, useEffect } from "react";
import type { 
  RawTransaction, 
  StatementDraft, 
  AISettings, 
  JournalEntry,
  ComplianceAlert,
  TaxLiability,
  AccountingConfig,
  DEFAULT_AI_SETTINGS,
  DEFAULT_ACCOUNTING_CONFIG 
} from "./types";
import { 
  classifyTransaction, 
  classifyTransactions, 
  generateJournalEntry,
  calculateTaxImplications,
  analyzeStatement,
  AIClassificationResult,
  AIJournalEntry,
  AIAnalysisResult 
} from "./aiEngine";
import { 
  generateStatementDraft, 
  generateStatementDraftWithAI,
  analyzeForCompliance 
} from "./statementEngine";
import { runComplianceChecks, ComplianceResult } from "./standards";

// ============================================================================
// TYPES
// ============================================================================

export interface UseAccountingAIOptions {
  aiEndpoint?: string;
  aiApiKey?: string;
  aiModel?: string;
  autoClassify?: boolean;
  confidenceThreshold?: number;
}

export interface UseAccountingAIReturn {
  // State
  isLoading: boolean;
  error: string | null;
  aiEnabled: boolean;
  
  // Configuration
  config: AccountingConfig;
  updateConfig: (updates: Partial<AccountingConfig>) => void;
  
  // Classification
  classifyTransaction: (tx: RawTransaction) => Promise<AIClassificationResult>;
  classifyBatch: (txs: RawTransaction[]) => Promise<Map<string, AIClassificationResult>>;
  
  // Statement Generation
  generateStatement: (txs: RawTransaction[], useAI?: boolean) => Promise<{
    statement: StatementDraft;
    classifications?: Map<string, AIClassificationResult>;
  }>;
  
  // Journal Entry
  createJournalEntry: (tx: RawTransaction, classification: AIClassificationResult) => AIJournalEntry;
  
  // Analysis
  analyzeTransaction: (tx: RawTransaction) => Promise<AIAnalysisResult>;
  analyzeStatement: (statement: StatementDraft) => Promise<{
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    estimatedCIT: number;
    estimatedTET: number;
    vatPosition: number;
    recommendations: string[];
  }>;
  
  // Compliance
  runComplianceCheck: (data: Record<string, unknown>) => ComplianceResult[];
  getComplianceAlerts: () => ComplianceAlert[];
  
  // Tax
  calculateTaxes: (tx: RawTransaction, classification: AIClassificationResult) => TaxLiability[];
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useAccountingAI(options: UseAccountingAIOptions = {}): UseAccountingAIReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AccountingConfig>({
    companyName: "",
    fiscalYearEnd: "12-31",
    currency: "NGN",
    companySize: "small",
    aiSettings: {
      enabled: true,
      apiEndpoint: options.aiEndpoint,
      apiKey: options.aiApiKey,
      model: options.aiModel,
      confidenceThreshold: options.confidenceThreshold || 0.75,
      autoClassify: options.autoClassify ?? true,
      autoGenerateJournals: false,
      complianceMode: "advisory",
    },
    defaultAccounts: {
      cashAccount: "1020",
      revenueAccount: "4000",
      expenseAccount: "5000",
      receivablesAccount: "1100",
      payablesAccount: "2000",
      vatOutputAccount: "2200",
      vatInputAccount: "1400",
      whtPayableAccount: "2220",
      whtReceivableAccount: "1410",
    },
  });
  
  const [complianceAlerts, setComplianceAlerts] = useState<ComplianceAlert[]>([]);
  
  // Load config from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("insight::accounting-config");
      if (saved) {
        const parsed = JSON.parse(saved);
        setConfig(prev => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.warn("Failed to load accounting config:", e);
    }
  }, []);
  
  // Save config to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem("insight::accounting-config", JSON.stringify(config));
    } catch (e) {
      console.warn("Failed to save accounting config:", e);
    }
  }, [config]);
  
  // Update configuration
  const updateConfig = useCallback((updates: Partial<AccountingConfig>) => {
    setConfig(prev => ({
      ...prev,
      ...updates,
      aiSettings: updates.aiSettings 
        ? { ...prev.aiSettings, ...updates.aiSettings }
        : prev.aiSettings,
    }));
  }, []);
  
  // Check if AI is enabled and configured
  const aiEnabled = config.aiSettings.enabled && !!config.aiSettings.apiEndpoint;
  
  // Build AI config from settings
  const buildAIConfig = useCallback(() => ({
    useAI: aiEnabled,
    apiEndpoint: config.aiSettings.apiEndpoint,
    apiKey: config.aiSettings.apiKey,
    model: config.aiSettings.model,
    confidenceThreshold: config.aiSettings.confidenceThreshold,
    aiTimeout: 10000,
  }), [aiEnabled, config.aiSettings]);
  
  // Classify single transaction
  const handleClassifyTransaction = useCallback(async (tx: RawTransaction) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await classifyTransaction(tx, buildAIConfig());
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Classification failed";
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [buildAIConfig]);
  
  // Classify batch of transactions
  const handleClassifyBatch = useCallback(async (txs: RawTransaction[]) => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await classifyTransactions(txs, buildAIConfig());
      return results;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Batch classification failed";
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [buildAIConfig]);
  
  // Generate statement (with optional AI)
  const handleGenerateStatement = useCallback(async (
    txs: RawTransaction[], 
    useAI: boolean = config.aiSettings.autoClassify
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      if (useAI && aiEnabled) {
        const result = await generateStatementDraftWithAI(txs, buildAIConfig());
        return {
          statement: result.statement,
          classifications: result.classifications,
        };
      } else {
        const statement = generateStatementDraft(txs, { includeLineItems: true });
        return { statement };
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Statement generation failed";
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [aiEnabled, config.aiSettings.autoClassify, buildAIConfig]);
  
  // Create journal entry
  const handleCreateJournalEntry = useCallback((
    tx: RawTransaction, 
    classification: AIClassificationResult
  ) => {
    return generateJournalEntry(tx, classification);
  }, []);
  
  // Full transaction analysis
  const handleAnalyzeTransaction = useCallback(async (tx: RawTransaction) => {
    setIsLoading(true);
    setError(null);
    try {
      const classification = await classifyTransaction(tx, buildAIConfig());
      const journalEntry = generateJournalEntry(tx, classification);
      const taxImplications = calculateTaxImplications(tx, classification);
      
      // Run compliance checks
      const complianceData = {
        turnover: tx.amount > 0 ? tx.amount : 0,
        hasQualifyingPayments: classification.whtApplicable,
        whtDeducted: tx.whtAmount !== undefined,
      };
      const complianceFlags = runComplianceChecks(complianceData);
      
      return {
        classification,
        journalEntry,
        complianceFlags,
        taxImplications: taxImplications.map(ti => ({
          ...ti,
          taxType: ti.taxType as "CIT" | "VAT" | "WHT" | "CGT" | "PAYE" | "TET",
        })),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Analysis failed";
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [buildAIConfig]);
  
  // Analyze statement
  const handleAnalyzeStatement = useCallback(async (statement: StatementDraft) => {
    setIsLoading(true);
    setError(null);
    try {
      const analysis = await analyzeForCompliance(statement, buildAIConfig());
      
      // Update compliance alerts
      const alerts: ComplianceAlert[] = analysis.complianceIssues
        .filter((c: { passed: boolean }) => !c.passed)
        .map((c: { passed: boolean; message: string; recommendation?: string }, idx: number) => ({
          id: `alert-${Date.now()}-${idx}`,
          ruleId: `rule-${idx}`,
          severity: "warning" as const,
          category: "FIRS",
          title: c.message,
          message: c.message,
          recommendation: c.recommendation,
          resolved: false,
        }));
      
      setComplianceAlerts(prev => [...prev.filter(a => !a.resolved), ...alerts]);
      
      return analysis;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Statement analysis failed";
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [buildAIConfig]);
  
  // Run compliance check
  const handleRunComplianceCheck = useCallback((data: Record<string, unknown>) => {
    return runComplianceChecks(data);
  }, []);
  
  // Get current compliance alerts
  const getComplianceAlerts = useCallback(() => {
    return complianceAlerts;
  }, [complianceAlerts]);
  
  // Calculate taxes for a transaction
  const handleCalculateTaxes = useCallback((
    tx: RawTransaction, 
    classification: AIClassificationResult
  ): TaxLiability[] => {
    const implications = calculateTaxImplications(tx, classification);
    const today = new Date();
    const dueDate = new Date(today.getFullYear(), today.getMonth() + 1, 21); // 21st of next month
    
    return implications.map(ti => ({
      taxType: ti.taxType as TaxLiability["taxType"],
      period: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`,
      amount: ti.amount,
      rate: ti.rate,
      basis: Math.abs(tx.amount),
      dueDate: dueDate.toISOString().split("T")[0],
      status: "estimated" as const,
    }));
  }, []);
  
  return {
    isLoading,
    error,
    aiEnabled,
    config,
    updateConfig,
    classifyTransaction: handleClassifyTransaction,
    classifyBatch: handleClassifyBatch,
    generateStatement: handleGenerateStatement,
    createJournalEntry: handleCreateJournalEntry,
    analyzeTransaction: handleAnalyzeTransaction,
    analyzeStatement: handleAnalyzeStatement,
    runComplianceCheck: handleRunComplianceCheck,
    getComplianceAlerts,
    calculateTaxes: handleCalculateTaxes,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format currency in Nigerian Naira
 */
export function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get confidence level label
 */
export function getConfidenceLabel(confidence: number): {
  label: string;
  color: string;
} {
  if (confidence >= 0.9) return { label: "Very High", color: "text-green-600" };
  if (confidence >= 0.75) return { label: "High", color: "text-green-500" };
  if (confidence >= 0.5) return { label: "Medium", color: "text-yellow-500" };
  if (confidence >= 0.3) return { label: "Low", color: "text-orange-500" };
  return { label: "Very Low", color: "text-red-500" };
}

/**
 * Get source badge
 */
export function getSourceBadge(source: "rule" | "ai" | "hybrid" | "manual"): {
  label: string;
  bgColor: string;
  textColor: string;
} {
  switch (source) {
    case "ai":
      return { label: "AI", bgColor: "bg-purple-100", textColor: "text-purple-700" };
    case "hybrid":
      return { label: "Hybrid", bgColor: "bg-blue-100", textColor: "text-blue-700" };
    case "manual":
      return { label: "Manual", bgColor: "bg-gray-100", textColor: "text-gray-700" };
    default:
      return { label: "Rule", bgColor: "bg-green-100", textColor: "text-green-700" };
  }
}
