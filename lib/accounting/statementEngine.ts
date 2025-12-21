import { RawTransaction, StatementDraft, TransactionType, StatementLineItem, AISettings, DEFAULT_AI_SETTINGS } from "./types";
import { 
  classifyTransaction, 
  classifyTransactions, 
  generateJournalEntry, 
  calculateTaxImplications,
  analyzeStatement,
  AIClassificationResult,
  AIConfig 
} from "./aiEngine";
import { getAccountByCode, CHART_OF_ACCOUNTS } from "./standards";

// ============================================================================
// LEGACY CATEGORY MAPPING (Rule-based fallback)
// ============================================================================

const CATEGORY_MAP: Record<string, TransactionType> = {
  // Income categories
  sales: "income",
  revenue: "income",
  subscription: "income",
  "service fee": "income",
  interest: "income",
  dividend: "income",
  rental: "income",
  commission: "income",
  
  // Expense categories - Cost of Sales
  cogs: "expense",
  "cost of goods": "expense",
  "raw materials": "expense",
  purchases: "expense",
  
  // Expense categories - Operating
  payroll: "expense",
  salary: "expense",
  wages: "expense",
  rent: "expense",
  utilities: "expense",
  electricity: "expense",
  water: "expense",
  telephone: "expense",
  internet: "expense",
  insurance: "expense",
  depreciation: "expense",
  maintenance: "expense",
  repairs: "expense",
  advertising: "expense",
  marketing: "expense",
  travel: "expense",
  training: "expense",
  "bank charges": "expense",
  "professional fees": "expense",
  audit: "expense",
  legal: "expense",
  
  // Asset categories
  equipment: "asset",
  machinery: "asset",
  vehicle: "asset",
  computer: "asset",
  furniture: "asset",
  building: "asset",
  land: "asset",
  inventory: "asset",
  "accounts receivable": "asset",
  prepaid: "asset",
  
  // Liability categories
  loan: "liability",
  "accounts payable": "liability",
  accrued: "liability",
  "vat payable": "liability",
  "paye payable": "liability",
  pension: "liability",
  
  // Equity categories
  equity: "equity",
  "share capital": "equity",
  "retained earnings": "equity",
  dividends: "equity",
};

export function normaliseCategory(category: string): TransactionType {
  const key = category.toLowerCase().trim();
  
  // Direct match
  if (CATEGORY_MAP[key]) {
    return CATEGORY_MAP[key];
  }
  
  // Partial match
  for (const [pattern, type] of Object.entries(CATEGORY_MAP)) {
    if (key.includes(pattern) || pattern.includes(key)) {
      return type;
    }
  }
  
  return "other";
}

// ============================================================================
// ENHANCED STATEMENT GENERATION (Rule-based + AI ready)
// ============================================================================

export function generateStatementDraft(
  transactions: RawTransaction[], 
  options?: { includeLineItems?: boolean }
): StatementDraft {
  let revenue = 0;
  let costOfSales = 0;
  let operatingExpenses = 0;
  let otherIncome = 0;
  let assets = 0;
  let liabilities = 0;
  let equity = 0;
  let cashFromOperations = 0;
  let cashFromInvesting = 0;
  let cashFromFinancing = 0;

  const items: StatementLineItem[] = [];

  transactions.forEach((tx, index) => {
    // Create line item
    const lineItem: StatementLineItem = {
      id: tx.id || `item-${index}`,
      label: tx.description,
      amount: Math.abs(tx.amount),
      type: tx.type,
      accountCode: tx.accountCode,
      accountName: tx.accountName,
      category: tx.category,
    };
    
    if (options?.includeLineItems) {
      items.push(lineItem);
    }

    switch (tx.type) {
      case "income":
        if (tx.category?.toLowerCase().includes("other") || tx.category?.toLowerCase().includes("interest")) {
          otherIncome += tx.amount;
        } else {
          revenue += tx.amount;
        }
        cashFromOperations += tx.amount;
        break;
      case "expense":
        if (tx.category?.toLowerCase().includes("cog") || tx.category?.toLowerCase().includes("cost of")) {
          costOfSales += Math.abs(tx.amount);
        } else {
          operatingExpenses += Math.abs(tx.amount);
        }
        cashFromOperations -= Math.abs(tx.amount);
        break;
      case "asset":
        assets += Math.abs(tx.amount);
        cashFromInvesting -= Math.abs(tx.amount);
        break;
      case "liability":
        liabilities += Math.abs(tx.amount);
        cashFromFinancing += Math.abs(tx.amount);
        break;
      case "equity":
        equity += Math.abs(tx.amount);
        cashFromFinancing += Math.abs(tx.amount);
        break;
      default:
        otherIncome += tx.amount;
        break;
    }
  });

  const grossProfit = revenue - costOfSales;
  const operatingIncome = grossProfit - operatingExpenses;
  const netIncome = operatingIncome + otherIncome;

  if (equity === 0) {
    equity = netIncome + (assets - liabilities - netIncome);
  }

  return {
    revenue,
    costOfSales,
    grossProfit,
    operatingExpenses,
    operatingIncome,
    otherIncome,
    netIncome,
    assets,
    liabilities,
    equity,
    cashFromOperations,
    cashFromInvesting,
    cashFromFinancing,
    items,
    analysisSource: "rule",
    analysisConfidence: 0.7,
  };
}

// ============================================================================
// AI-ENHANCED STATEMENT GENERATION
// ============================================================================

export async function generateStatementDraftWithAI(
  transactions: RawTransaction[],
  aiConfig: Partial<AIConfig> = {}
): Promise<{
  statement: StatementDraft;
  classifications: Map<string, AIClassificationResult>;
  enhancedTransactions: RawTransaction[];
}> {
  // Classify all transactions using hybrid system
  const classifications = await classifyTransactions(transactions, aiConfig);
  
  // Enhance transactions with classification results
  const enhancedTransactions = transactions.map(tx => {
    const classification = classifications.get(tx.id);
    if (classification) {
      return {
        ...tx,
        type: classification.transactionType,
        accountCode: classification.accountCode,
        accountName: classification.accountName,
        classificationSource: classification.source,
        classificationConfidence: classification.confidence,
        whtApplicable: classification.whtApplicable,
        vatApplicable: classification.vatApplicable,
      };
    }
    return tx;
  });
  
  // Generate statement from enhanced transactions
  const statement = generateStatementDraft(enhancedTransactions, { includeLineItems: true });
  
  // Calculate overall confidence
  const avgConfidence = Array.from(classifications.values())
    .reduce((sum, c) => sum + c.confidence, 0) / classifications.size;
  
  statement.analysisSource = avgConfidence > 0.8 ? "ai" : "hybrid";
  statement.analysisConfidence = avgConfidence;
  
  return {
    statement,
    classifications,
    enhancedTransactions,
  };
}

// ============================================================================
// FILE PROCESSING (Rule-based with AI classification option)
// ============================================================================

export function buildTransactionsFromFiles(files: File[]): RawTransaction[] {
  const baseDate = new Date();
  return files.map((file, index) => {
    const amount = Math.round((Math.random() * 900_000 + 50_000) * (index % 2 === 0 ? 1 : -1));
    const categories = ["sales", "cogs", "payroll", "rent", "utilities", "professional fees"];
    const cat = categories[index % categories.length];
    const type = normaliseCategory(cat);
    const date = new Date(baseDate.getTime() - index * 86400000);
    return {
      id: `${file.name}-${index}`,
      date: date.toISOString().split("T")[0],
      description: `${cat.toUpperCase()} extracted from ${file.name}`,
      category: cat,
      amount: amount,
      type,
      sourceDocument: file.name,
    };
  });
}

export async function buildTransactionsFromFilesWithAI(
  files: File[],
  aiConfig: Partial<AIConfig> = {}
): Promise<RawTransaction[]> {
  // First, extract basic transactions
  const basicTransactions = buildTransactionsFromFiles(files);
  
  // Then classify them with AI
  const classifications = await classifyTransactions(basicTransactions, aiConfig);
  
  // Enhance with AI classifications
  return basicTransactions.map(tx => {
    const classification = classifications.get(tx.id);
    if (classification) {
      return {
        ...tx,
        type: classification.transactionType,
        accountCode: classification.accountCode,
        accountName: classification.accountName,
        classificationSource: classification.source,
        classificationConfidence: classification.confidence,
        whtApplicable: classification.whtApplicable,
        vatApplicable: classification.vatApplicable,
      };
    }
    return tx;
  });
}

// ============================================================================
// COMPLIANCE & TAX ANALYSIS
// ============================================================================

export async function analyzeForCompliance(
  statement: StatementDraft,
  aiConfig: Partial<AIConfig> = {}
): Promise<{
  totalIncome: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  estimatedCIT: number;
  estimatedTET: number;
  vatPosition: number;
  complianceIssues: { passed: boolean; message: string; recommendation?: string }[];
  recommendations: string[];
}> {
  return analyzeStatement(statement, aiConfig);
}

// ============================================================================
// EXPORTS
// ============================================================================

export { 
  classifyTransaction, 
  classifyTransactions, 
  generateJournalEntry, 
  calculateTaxImplications,
  analyzeStatement 
} from "./aiEngine";

export { 
  CHART_OF_ACCOUNTS, 
  getAccountByCode,
  getAccountsByClass,
  getAccountsBySubClass,
  runComplianceChecks,
  FIRS_WHT_RATES,
  FIRS_DEPRECIATION_RATES 
} from "./standards";
