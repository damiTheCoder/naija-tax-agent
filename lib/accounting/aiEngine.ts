/**
 * AI Engine for Intelligent Accounting
 * Dual system: Rule-based + AI-powered classification
 * Designed for Nigerian accounting standards (FIRS, CAMA, IFRS for SMEs)
 */

import { RawTransaction, TransactionType, StatementDraft } from "./types";
import { 
  ChartOfAccount, 
  CHART_OF_ACCOUNTS, 
  getAccountByCode,
  getWHTApplicableAccounts,
  FIRS_WHT_RATES,
  runComplianceChecks,
  ComplianceResult 
} from "./standards";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface AIClassificationResult {
  transactionType: TransactionType;
  accountCode: string;
  accountName: string;
  confidence: number;
  source: "rule" | "ai" | "hybrid";
  whtApplicable: boolean;
  whtRate?: number;
  vatApplicable: boolean;
  suggestions?: string[];
  warnings?: string[];
}

export interface AIJournalEntry {
  date: string;
  description: string;
  debitAccount: ChartOfAccount;
  creditAccount: ChartOfAccount;
  amount: number;
  reference?: string;
  whtAmount?: number;
  vatAmount?: number;
  confidence: number;
  source: "rule" | "ai" | "hybrid";
}

export interface AIAnalysisResult {
  classification: AIClassificationResult;
  journalEntry: AIJournalEntry;
  complianceFlags: ComplianceResult[];
  taxImplications: TaxImplication[];
}

export interface TaxImplication {
  taxType: "CIT" | "VAT" | "WHT" | "CGT" | "PAYE" | "TET";
  amount: number;
  rate: number;
  description: string;
  dueDate?: string;
}

export interface AIConfig {
  apiEndpoint?: string;
  apiKey?: string;
  model?: string;
  useAI: boolean;
  confidenceThreshold: number; // Below this, use AI
  aiTimeout: number; // ms
}

// Default configuration
const DEFAULT_CONFIG: AIConfig = {
  useAI: true,
  confidenceThreshold: 0.75,
  aiTimeout: 10000,
};

// ============================================================================
// RULE-BASED CLASSIFICATION ENGINE
// ============================================================================

interface ClassificationRule {
  patterns: RegExp[];
  accountCode: string;
  transactionType: TransactionType;
  confidence: number;
}

// Comprehensive rule-based classification patterns
const CLASSIFICATION_RULES: ClassificationRule[] = [
  // Revenue patterns
  { patterns: [/\bsales?\b/i, /\brevenue\b/i, /\bincome\b/i, /\breceipt\b/i], accountCode: "4000", transactionType: "income", confidence: 0.9 },
  { patterns: [/\bservice fee\b/i, /\bconsulting\b/i, /\bprofessional fee\b/i], accountCode: "4010", transactionType: "income", confidence: 0.85 },
  { patterns: [/\bcontract\b/i, /\bproject\b/i], accountCode: "4020", transactionType: "income", confidence: 0.8 },
  { patterns: [/\binterest received\b/i, /\bbank interest\b/i], accountCode: "4200", transactionType: "income", confidence: 0.95 },
  { patterns: [/\bdividend\b/i], accountCode: "4210", transactionType: "income", confidence: 0.95 },
  { patterns: [/\brental income\b/i, /\brent received\b/i], accountCode: "4220", transactionType: "income", confidence: 0.9 },
  
  // Expense patterns - Cost of Sales
  { patterns: [/\bcost of goods\b/i, /\bcogs\b/i, /\bpurchase\b/i], accountCode: "5000", transactionType: "expense", confidence: 0.85 },
  { patterns: [/\braw material\b/i, /\bmaterial\b/i, /\bsupplies\b/i], accountCode: "5010", transactionType: "expense", confidence: 0.8 },
  { patterns: [/\bfreight\b/i, /\bshipping\b/i, /\bdelivery\b/i, /\blogistics\b/i], accountCode: "5040", transactionType: "expense", confidence: 0.85 },
  
  // Expense patterns - Salaries & Staff
  { patterns: [/\bsalary\b/i, /\bsalaries\b/i, /\bwage\b/i, /\bpayroll\b/i], accountCode: "5500", transactionType: "expense", confidence: 0.95 },
  { patterns: [/\bstaff welfare\b/i, /\bemployee benefit\b/i], accountCode: "5510", transactionType: "expense", confidence: 0.85 },
  { patterns: [/\bpension\b/i, /\bpfa\b/i], accountCode: "5520", transactionType: "expense", confidence: 0.9 },
  { patterns: [/\bnsitf\b/i, /\bsocial insurance\b/i], accountCode: "5530", transactionType: "expense", confidence: 0.95 },
  { patterns: [/\bitf\b/i, /\btraining fund\b/i], accountCode: "5540", transactionType: "expense", confidence: 0.95 },
  
  // Expense patterns - Operating
  { patterns: [/\brent\b/i, /\blease\b/i, /\boffice space\b/i], accountCode: "5600", transactionType: "expense", confidence: 0.85 },
  { patterns: [/\belectric\b/i, /\bwater\b/i, /\butility\b/i, /\bnepa\b/i, /\bphcn\b/i, /\bdisco\b/i], accountCode: "5610", transactionType: "expense", confidence: 0.9 },
  { patterns: [/\bphone\b/i, /\binternet\b/i, /\bdata\b/i, /\bairtime\b/i, /\bmtn\b/i, /\bairtel\b/i, /\bglo\b/i], accountCode: "5620", transactionType: "expense", confidence: 0.85 },
  { patterns: [/\bdepreciation\b/i], accountCode: "5700", transactionType: "expense", confidence: 0.95 },
  { patterns: [/\binsurance\b/i, /\bpremium\b/i], accountCode: "5800", transactionType: "expense", confidence: 0.85 },
  { patterns: [/\brepair\b/i, /\bmaintenance\b/i, /\bservicing\b/i], accountCode: "5810", transactionType: "expense", confidence: 0.8 },
  { patterns: [/\bstationer\b/i, /\boffice supplies\b/i, /\bprinting\b/i], accountCode: "5820", transactionType: "expense", confidence: 0.8 },
  
  // Expense patterns - Professional fees
  { patterns: [/\baudit\b/i, /\bauditor\b/i], accountCode: "5910", transactionType: "expense", confidence: 0.95 },
  { patterns: [/\blegal\b/i, /\blawyer\b/i, /\bsolicitor\b/i, /\battorney\b/i], accountCode: "5920", transactionType: "expense", confidence: 0.9 },
  { patterns: [/\bconsultant\b/i, /\bprofessional\b/i, /\badvisory\b/i], accountCode: "5900", transactionType: "expense", confidence: 0.8 },
  
  // Expense patterns - Administrative
  { patterns: [/\badvert\b/i, /\bmarketing\b/i, /\bpromotion\b/i, /\bads\b/i], accountCode: "6000", transactionType: "expense", confidence: 0.85 },
  { patterns: [/\btravel\b/i, /\bflight\b/i, /\bhotel\b/i, /\baccommodation\b/i, /\btransport\b/i], accountCode: "6010", transactionType: "expense", confidence: 0.85 },
  { patterns: [/\btraining\b/i, /\bcourse\b/i, /\bworkshop\b/i, /\bseminar\b/i], accountCode: "6020", transactionType: "expense", confidence: 0.8 },
  { patterns: [/\bbank charge\b/i, /\bbank fee\b/i, /\bcot\b/i, /\bsms alert\b/i], accountCode: "6030", transactionType: "expense", confidence: 0.95 },
  { patterns: [/\bbad debt\b/i, /\bwrite.?off\b/i], accountCode: "6040", transactionType: "expense", confidence: 0.85 },
  { patterns: [/\bdonation\b/i, /\bcharity\b/i, /\bcsr\b/i], accountCode: "6050", transactionType: "expense", confidence: 0.85 },
  { patterns: [/\bfine\b/i, /\bpenalty\b/i], accountCode: "6060", transactionType: "expense", confidence: 0.9 },
  
  // Finance costs
  { patterns: [/\binterest paid\b/i, /\bloan interest\b/i, /\binterest expense\b/i], accountCode: "6500", transactionType: "expense", confidence: 0.9 },
  { patterns: [/\bbank loan\b/i, /\bfacility\b/i, /\boverdraft\b/i], accountCode: "6510", transactionType: "expense", confidence: 0.8 },
  { patterns: [/\bfx loss\b/i, /\bforeign exchange\b/i, /\bcurrency loss\b/i], accountCode: "6600", transactionType: "expense", confidence: 0.85 },
  
  // Asset patterns
  { patterns: [/\bpetty cash\b/i], accountCode: "1010", transactionType: "asset", confidence: 0.95 },
  { patterns: [/\bcash\b/i, /\bdeposit\b/i, /\bwithdraw\b/i], accountCode: "1000", transactionType: "asset", confidence: 0.7 },
  { patterns: [/\breceivable\b/i, /\bdebtor\b/i, /\bowed to us\b/i], accountCode: "1100", transactionType: "asset", confidence: 0.85 },
  { patterns: [/\binventory\b/i, /\bstock\b/i, /\bgoods\b/i], accountCode: "1220", transactionType: "asset", confidence: 0.8 },
  { patterns: [/\bprepaid\b/i, /\bprepayment\b/i, /\badvance payment\b/i], accountCode: "1300", transactionType: "asset", confidence: 0.85 },
  { patterns: [/\bvat input\b/i, /\bvat paid\b/i, /\bvat recoverable\b/i], accountCode: "1400", transactionType: "asset", confidence: 0.95 },
  { patterns: [/\bwht credit\b/i, /\bwht receivable\b/i], accountCode: "1410", transactionType: "asset", confidence: 0.95 },
  
  // Fixed asset patterns
  { patterns: [/\bland\b/i], accountCode: "1500", transactionType: "asset", confidence: 0.8 },
  { patterns: [/\bbuilding\b/i, /\bproperty\b/i], accountCode: "1510", transactionType: "asset", confidence: 0.8 },
  { patterns: [/\bmachine\b/i, /\bplant\b/i, /\bequipment\b/i], accountCode: "1520", transactionType: "asset", confidence: 0.75 },
  { patterns: [/\bvehicle\b/i, /\bcar\b/i, /\btruck\b/i, /\bbus\b/i], accountCode: "1530", transactionType: "asset", confidence: 0.85 },
  { patterns: [/\bcomputer\b/i, /\blaptop\b/i, /\bfurniture\b/i, /\boffice equipment\b/i], accountCode: "1540", transactionType: "asset", confidence: 0.8 },
  { patterns: [/\bsoftware\b/i, /\bpatent\b/i, /\bgoodwill\b/i, /\blicense\b/i], accountCode: "1600", transactionType: "asset", confidence: 0.8 },
  
  // Liability patterns
  { patterns: [/\bpayable\b/i, /\bcreditor\b/i, /\bowed by us\b/i, /\bwe owe\b/i], accountCode: "2000", transactionType: "liability", confidence: 0.85 },
  { patterns: [/\baccrued\b/i, /\baccrual\b/i], accountCode: "2100", transactionType: "liability", confidence: 0.8 },
  { patterns: [/\bvat output\b/i, /\bvat collected\b/i, /\bvat payable\b/i], accountCode: "2200", transactionType: "liability", confidence: 0.95 },
  { patterns: [/\bpaye\b/i, /\btax deducted\b/i], accountCode: "2210", transactionType: "liability", confidence: 0.95 },
  { patterns: [/\bwht payable\b/i, /\bwht deducted\b/i], accountCode: "2220", transactionType: "liability", confidence: 0.95 },
  { patterns: [/\bpension payable\b/i, /\bpension contribution\b/i], accountCode: "2230", transactionType: "liability", confidence: 0.9 },
  { patterns: [/\bnhf\b/i, /\bhousing fund\b/i], accountCode: "2240", transactionType: "liability", confidence: 0.95 },
  { patterns: [/\bdeferred revenue\b/i, /\bunearned\b/i, /\breceived in advance\b/i], accountCode: "2400", transactionType: "liability", confidence: 0.85 },
  { patterns: [/\bloan\b/i, /\bborrow\b/i, /\bdebt\b/i], accountCode: "2500", transactionType: "liability", confidence: 0.7 },
  
  // Equity patterns
  { patterns: [/\bshare capital\b/i, /\bpaid.?up capital\b/i, /\bequity\b/i], accountCode: "3000", transactionType: "equity", confidence: 0.9 },
  { patterns: [/\bshare premium\b/i], accountCode: "3100", transactionType: "equity", confidence: 0.95 },
  { patterns: [/\bretained earning\b/i, /\bprofit\b/i, /\bloss\b/i, /\bnet income\b/i], accountCode: "3200", transactionType: "equity", confidence: 0.75 },
  { patterns: [/\bdividend\b/i, /\bdistribution\b/i], accountCode: "3400", transactionType: "equity", confidence: 0.8 },
  
  // Tax patterns
  { patterns: [/\bcit\b/i, /\bcompany income tax\b/i, /\bcorporate tax\b/i], accountCode: "7000", transactionType: "expense", confidence: 0.95 },
  { patterns: [/\btet\b/i, /\btertiary education tax\b/i, /\beducation tax\b/i], accountCode: "7010", transactionType: "expense", confidence: 0.95 },
];

/**
 * Classify a transaction using rule-based matching
 */
function classifyWithRules(description: string, amount: number): AIClassificationResult {
  const normalizedDesc = description.toLowerCase().trim();
  
  // Find matching rules
  const matches: { rule: ClassificationRule; matchCount: number }[] = [];
  
  for (const rule of CLASSIFICATION_RULES) {
    const matchCount = rule.patterns.filter(pattern => pattern.test(normalizedDesc)).length;
    if (matchCount > 0) {
      matches.push({ rule, matchCount });
    }
  }
  
  // Sort by match count and confidence
  matches.sort((a, b) => {
    const countDiff = b.matchCount - a.matchCount;
    if (countDiff !== 0) return countDiff;
    return b.rule.confidence - a.rule.confidence;
  });
  
  if (matches.length > 0) {
    const bestMatch = matches[0];
    const account = getAccountByCode(bestMatch.rule.accountCode);
    
    // Adjust confidence based on match count
    const adjustedConfidence = Math.min(bestMatch.rule.confidence + (bestMatch.matchCount - 1) * 0.05, 0.98);
    
    return {
      transactionType: bestMatch.rule.transactionType,
      accountCode: bestMatch.rule.accountCode,
      accountName: account?.name || "Unknown",
      confidence: adjustedConfidence,
      source: "rule",
      whtApplicable: account?.whtApplicable || false,
      whtRate: account?.whtRate,
      vatApplicable: account?.vatApplicable || false,
      suggestions: matches.slice(1, 4).map(m => getAccountByCode(m.rule.accountCode)?.name || ""),
    };
  }
  
  // Default classification based on amount sign
  if (amount >= 0) {
    return {
      transactionType: "income",
      accountCode: "4000",
      accountName: "Sales Revenue",
      confidence: 0.3,
      source: "rule",
      whtApplicable: false,
      vatApplicable: true,
      warnings: ["Low confidence classification - please verify"],
    };
  } else {
    return {
      transactionType: "expense",
      accountCode: "5000",
      accountName: "Cost of Goods Sold",
      confidence: 0.3,
      source: "rule",
      whtApplicable: false,
      vatApplicable: true,
      warnings: ["Low confidence classification - please verify"],
    };
  }
}

// ============================================================================
// AI CLASSIFICATION ENGINE
// ============================================================================

export interface AIRequestPayload {
  description: string;
  amount: number;
  currency?: string;
  date?: string;
  vendor?: string;
  category?: string;
  context?: {
    previousTransactions?: string[];
    businessType?: string;
    industry?: string;
  };
}

export interface AIResponsePayload {
  classification: {
    transactionType: TransactionType;
    accountCode: string;
    confidence: number;
  };
  reasoning?: string;
  suggestions?: string[];
  complianceNotes?: string[];
}

/**
 * Call external AI API for classification
 */
async function classifyWithAI(
  payload: AIRequestPayload, 
  config: AIConfig
): Promise<AIClassificationResult | null> {
  if (!config.useAI || !config.apiEndpoint) {
    return null;
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.aiTimeout);
    
    const response = await fetch(config.apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey && { "Authorization": `Bearer ${config.apiKey}` }),
      },
      body: JSON.stringify({
        model: config.model || "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are a Nigerian accounting expert. Classify financial transactions according to FIRS standards, CAMA 2020, and IFRS for SMEs. 
            
            Available account codes: ${JSON.stringify(CHART_OF_ACCOUNTS.map(a => ({ code: a.code, name: a.name, class: a.class })))}.
            
            Return JSON: { "classification": { "transactionType": "income|expense|asset|liability|equity|other", "accountCode": "XXXX", "confidence": 0.0-1.0 }, "reasoning": "...", "complianceNotes": [...] }`
          },
          {
            role: "user",
            content: `Classify: "${payload.description}" | Amount: ₦${payload.amount.toLocaleString()} | Date: ${payload.date || "N/A"} | Vendor: ${payload.vendor || "N/A"}`
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error("AI API error:", response.status);
      return null;
    }
    
    const data = await response.json();
    const aiResponse: AIResponsePayload = JSON.parse(data.choices[0].message.content);
    const account = getAccountByCode(aiResponse.classification.accountCode);
    
    return {
      transactionType: aiResponse.classification.transactionType,
      accountCode: aiResponse.classification.accountCode,
      accountName: account?.name || "Unknown",
      confidence: aiResponse.classification.confidence,
      source: "ai",
      whtApplicable: account?.whtApplicable || false,
      whtRate: account?.whtRate,
      vatApplicable: account?.vatApplicable || false,
      suggestions: aiResponse.suggestions,
    };
    
  } catch (error) {
    console.error("AI classification error:", error);
    return null;
  }
}

// ============================================================================
// HYBRID CLASSIFICATION SYSTEM
// ============================================================================

/**
 * Intelligent hybrid classification using both rule-based and AI
 */
export async function classifyTransaction(
  transaction: RawTransaction,
  config: Partial<AIConfig> = {}
): Promise<AIClassificationResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Step 1: Rule-based classification
  const ruleResult = classifyWithRules(transaction.description, transaction.amount);
  
  // Step 2: If confidence is high enough, use rule-based result
  if (ruleResult.confidence >= finalConfig.confidenceThreshold) {
    return ruleResult;
  }
  
  // Step 3: Try AI classification for low-confidence cases
  if (finalConfig.useAI && finalConfig.apiEndpoint) {
    const aiResult = await classifyWithAI({
      description: transaction.description,
      amount: transaction.amount,
      date: transaction.date,
      vendor: transaction.vendor,
    }, finalConfig);
    
    if (aiResult && aiResult.confidence > ruleResult.confidence) {
      // Use AI result but mark as hybrid if rule also matched
      return {
        ...aiResult,
        source: ruleResult.confidence > 0.3 ? "hybrid" : "ai",
        suggestions: [...(aiResult.suggestions || []), ruleResult.accountName],
      };
    }
  }
  
  // Step 4: Fall back to rule-based result
  return {
    ...ruleResult,
    warnings: [
      ...(ruleResult.warnings || []),
      "AI enhancement unavailable - using rule-based classification",
    ],
  };
}

/**
 * Batch classify multiple transactions
 */
export async function classifyTransactions(
  transactions: RawTransaction[],
  config: Partial<AIConfig> = {}
): Promise<Map<string, AIClassificationResult>> {
  const results = new Map<string, AIClassificationResult>();
  
  // Process in parallel with concurrency limit
  const batchSize = 5;
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(t => classifyTransaction(t, config))
    );
    batch.forEach((t, idx) => {
      results.set(t.id, batchResults[idx]);
    });
  }
  
  return results;
}

// ============================================================================
// JOURNAL ENTRY GENERATION
// ============================================================================

/**
 * Generate double-entry journal for a transaction
 */
export function generateJournalEntry(
  transaction: RawTransaction,
  classification: AIClassificationResult
): AIJournalEntry {
  const debitAccount = getAccountByCode(classification.accountCode);
  let creditAccount: ChartOfAccount;
  
  // Determine contra account based on transaction type
  switch (classification.transactionType) {
    case "income":
      // Credit revenue, debit cash/receivables
      creditAccount = debitAccount!;
      const cashAccount = getAccountByCode("1020"); // Bank
      return {
        date: transaction.date,
        description: transaction.description,
        debitAccount: cashAccount!,
        creditAccount: creditAccount!,
        amount: Math.abs(transaction.amount),
        reference: transaction.reference,
        vatAmount: classification.vatApplicable ? Math.abs(transaction.amount) * 0.075 : undefined,
        confidence: classification.confidence,
        source: classification.source,
      };
      
    case "expense":
      // Debit expense, credit cash/payables
      const bankAccount = getAccountByCode("1020");
      return {
        date: transaction.date,
        description: transaction.description,
        debitAccount: debitAccount!,
        creditAccount: bankAccount!,
        amount: Math.abs(transaction.amount),
        reference: transaction.reference,
        whtAmount: classification.whtApplicable ? Math.abs(transaction.amount) * (classification.whtRate || 10) / 100 : undefined,
        vatAmount: classification.vatApplicable ? Math.abs(transaction.amount) * 0.075 : undefined,
        confidence: classification.confidence,
        source: classification.source,
      };
      
    case "asset":
      // Debit asset, credit cash
      creditAccount = getAccountByCode("1020")!;
      return {
        date: transaction.date,
        description: transaction.description,
        debitAccount: debitAccount!,
        creditAccount: creditAccount,
        amount: Math.abs(transaction.amount),
        reference: transaction.reference,
        confidence: classification.confidence,
        source: classification.source,
      };
      
    case "liability":
      // Credit liability, debit cash
      creditAccount = debitAccount!;
      return {
        date: transaction.date,
        description: transaction.description,
        debitAccount: getAccountByCode("1020")!,
        creditAccount: creditAccount,
        amount: Math.abs(transaction.amount),
        reference: transaction.reference,
        confidence: classification.confidence,
        source: classification.source,
      };
      
    default:
      // Default: treat as expense
      return {
        date: transaction.date,
        description: transaction.description,
        debitAccount: getAccountByCode("5000")!,
        creditAccount: getAccountByCode("1020")!,
        amount: Math.abs(transaction.amount),
        reference: transaction.reference,
        confidence: classification.confidence * 0.5,
        source: classification.source,
      };
  }
}

// ============================================================================
// TAX IMPLICATIONS CALCULATOR
// ============================================================================

/**
 * Calculate tax implications for a transaction
 */
export function calculateTaxImplications(
  transaction: RawTransaction,
  classification: AIClassificationResult
): TaxImplication[] {
  const implications: TaxImplication[] = [];
  const amount = Math.abs(transaction.amount);
  
  // VAT implications
  if (classification.vatApplicable) {
    implications.push({
      taxType: "VAT",
      amount: amount * 0.075,
      rate: 7.5,
      description: classification.transactionType === "income" 
        ? "VAT Output - collect and remit to FIRS"
        : "VAT Input - recoverable from FIRS",
    });
  }
  
  // WHT implications
  if (classification.whtApplicable && classification.whtRate) {
    implications.push({
      taxType: "WHT",
      amount: amount * classification.whtRate / 100,
      rate: classification.whtRate,
      description: classification.transactionType === "income"
        ? "WHT deducted at source - credit against CIT"
        : "WHT to be deducted and remitted to FIRS within 30 days",
    });
  }
  
  // CIT implications for expenses
  if (classification.transactionType === "expense") {
    const account = getAccountByCode(classification.accountCode);
    if (account?.taxDeductible) {
      implications.push({
        taxType: "CIT",
        amount: amount * 0.30, // 30% CIT rate
        rate: 30,
        description: "Tax deductible expense - reduces assessable profit",
      });
    } else if (account?.taxDeductible === false) {
      implications.push({
        taxType: "CIT",
        amount: 0,
        rate: 0,
        description: "Non-deductible expense - add back to assessable profit",
      });
    }
  }
  
  return implications;
}

// ============================================================================
// FULL ANALYSIS
// ============================================================================

/**
 * Complete transaction analysis including classification, journal entry, and compliance
 */
export async function analyzeTransaction(
  transaction: RawTransaction,
  config: Partial<AIConfig> = {},
  complianceData?: Record<string, unknown>
): Promise<AIAnalysisResult> {
  // Classify the transaction
  const classification = await classifyTransaction(transaction, config);
  
  // Generate journal entry
  const journalEntry = generateJournalEntry(transaction, classification);
  
  // Calculate tax implications
  const taxImplications = calculateTaxImplications(transaction, classification);
  
  // Run compliance checks if data provided
  const complianceFlags = complianceData 
    ? runComplianceChecks(complianceData)
    : [];
  
  return {
    classification,
    journalEntry,
    complianceFlags,
    taxImplications,
  };
}

/**
 * Analyze statement draft for compliance and tax implications
 */
export async function analyzeStatement(
  draft: StatementDraft,
  config: Partial<AIConfig> = {}
): Promise<{
  totalIncome: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  estimatedCIT: number;
  estimatedTET: number;
  vatPosition: number;
  complianceIssues: ComplianceResult[];
  recommendations: string[];
}> {
  const totalIncome = draft.items.filter(i => i.type === "income").reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = draft.items.filter(i => i.type === "expense").reduce((sum, i) => sum + i.amount, 0);
  const grossProfit = totalIncome - draft.items.filter(i => i.label.includes("Cost")).reduce((sum, i) => sum + i.amount, 0);
  const netProfit = totalIncome - totalExpenses;
  
  // CIT calculation (30% for large companies, 20% for medium, 0% for small)
  let citRate = 0;
  if (totalIncome > 100_000_000) citRate = 0.30;
  else if (totalIncome > 25_000_000) citRate = 0.20;
  
  const estimatedCIT = Math.max(0, netProfit * citRate);
  
  // TET calculation (3% of assessable profit for companies with turnover > ₦100M)
  const estimatedTET = totalIncome > 100_000_000 ? Math.max(0, netProfit * 0.03) : 0;
  
  // VAT position (simplified)
  const vatOnSales = totalIncome * 0.075;
  const vatOnPurchases = totalExpenses * 0.6 * 0.075; // Assume 60% of expenses are VAT-able
  const vatPosition = vatOnSales - vatOnPurchases;
  
  // Compliance checks
  const complianceIssues = runComplianceChecks({
    turnover: totalIncome,
    isVatRegistered: totalIncome > 25_000_000,
    hasEmployees: draft.items.some(i => i.label.toLowerCase().includes("salary")),
    employeeCount: 10, // Default assumption
  });
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (netProfit > 0) {
    recommendations.push(`Estimated CIT liability: ₦${estimatedCIT.toLocaleString()} at ${citRate * 100}% rate`);
  }
  if (estimatedTET > 0) {
    recommendations.push(`Tertiary Education Tax due: ₦${estimatedTET.toLocaleString()}`);
  }
  if (vatPosition > 0) {
    recommendations.push(`VAT payable to FIRS: ₦${vatPosition.toLocaleString()}`);
  } else {
    recommendations.push(`VAT recoverable from FIRS: ₦${Math.abs(vatPosition).toLocaleString()}`);
  }
  
  const failedCompliance = complianceIssues.filter(c => !c.passed);
  if (failedCompliance.length > 0) {
    failedCompliance.forEach(c => {
      if (c.recommendation) {
        recommendations.push(`⚠️ ${c.recommendation}`);
      }
    });
  }
  
  return {
    totalIncome,
    totalExpenses,
    grossProfit,
    netProfit,
    estimatedCIT,
    estimatedTET,
    vatPosition,
    complianceIssues,
    recommendations,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { CLASSIFICATION_RULES, DEFAULT_CONFIG };
