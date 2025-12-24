/**
 * Double-Entry Bookkeeping Core Engine
 * Implements proper accounting rules following GAAP/IFRS principles
 * 
 * Core Rules:
 * 1. Every transaction must balance: Total Debits = Total Credits
 * 2. Uses accrual accounting by default
 * 3. Proper account classification with normal balances
 */

// ============================================================================
// ACCOUNT TYPES & NORMAL BALANCES
// ============================================================================

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export type NormalBalance = "debit" | "credit";

export interface AccountDefinition {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  subType?: string;
  description?: string;
  taxApplicable?: {
    vat?: boolean;
    wht?: boolean;
    whtRate?: number;
  };
}

/**
 * Account Normal Balance Rules:
 * - Assets: Debit increases, Credit decreases
 * - Expenses: Debit increases, Credit decreases
 * - Liabilities: Credit increases, Debit decreases
 * - Equity: Credit increases, Debit decreases
 * - Income/Revenue: Credit increases, Debit decreases
 */
export function getNormalBalance(type: AccountType): NormalBalance {
  switch (type) {
    case "asset":
    case "expense":
      return "debit";
    case "liability":
    case "equity":
    case "income":
      return "credit";
  }
}

/**
 * Determine if a debit/credit increases or decreases the account
 */
export function getBalanceEffect(
  accountType: AccountType,
  entryType: "debit" | "credit"
): "increase" | "decrease" {
  const normal = getNormalBalance(accountType);
  return entryType === normal ? "increase" : "decrease";
}

// ============================================================================
// CHART OF ACCOUNTS - FULL NIGERIAN STANDARD
// ============================================================================

export const CHART_OF_ACCOUNTS: AccountDefinition[] = [
  // ===== ASSETS (1000-1999) =====
  // Current Assets
  { code: "1000", name: "Cash", type: "asset", normalBalance: "debit", subType: "current", description: "Cash in hand" },
  { code: "1010", name: "Petty Cash", type: "asset", normalBalance: "debit", subType: "current", description: "Petty cash fund" },
  { code: "1020", name: "Bank", type: "asset", normalBalance: "debit", subType: "current", description: "Bank current account" },
  { code: "1021", name: "Bank - Savings", type: "asset", normalBalance: "debit", subType: "current", description: "Bank savings account" },
  { code: "1100", name: "Accounts Receivable", type: "asset", normalBalance: "debit", subType: "current", description: "Trade debtors" },
  { code: "1110", name: "Allowance for Doubtful Debts", type: "asset", normalBalance: "credit", subType: "current", description: "Contra account" },
  { code: "1200", name: "Inventory", type: "asset", normalBalance: "debit", subType: "current", description: "Stock/goods for sale" },
  { code: "1210", name: "Inventory - Raw Materials", type: "asset", normalBalance: "debit", subType: "current" },
  { code: "1220", name: "Inventory - Work in Progress", type: "asset", normalBalance: "debit", subType: "current" },
  { code: "1230", name: "Inventory - Finished Goods", type: "asset", normalBalance: "debit", subType: "current" },
  { code: "1300", name: "Prepaid Expenses", type: "asset", normalBalance: "debit", subType: "current" },
  { code: "1310", name: "Prepaid Rent", type: "asset", normalBalance: "debit", subType: "current" },
  { code: "1320", name: "Prepaid Insurance", type: "asset", normalBalance: "debit", subType: "current" },
  { code: "1400", name: "Input VAT Receivable", type: "asset", normalBalance: "debit", subType: "current", taxApplicable: { vat: true } },
  { code: "1410", name: "WHT Receivable", type: "asset", normalBalance: "debit", subType: "current", taxApplicable: { wht: true } },

  // Fixed Assets
  { code: "1500", name: "Land", type: "asset", normalBalance: "debit", subType: "fixed" },
  { code: "1510", name: "Buildings", type: "asset", normalBalance: "debit", subType: "fixed" },
  { code: "1511", name: "Accumulated Depreciation - Buildings", type: "asset", normalBalance: "credit", subType: "fixed", description: "Contra account" },
  { code: "1520", name: "Plant and Machinery", type: "asset", normalBalance: "debit", subType: "fixed" },
  { code: "1521", name: "Accumulated Depreciation - Plant", type: "asset", normalBalance: "credit", subType: "fixed" },
  { code: "1530", name: "Motor Vehicles", type: "asset", normalBalance: "debit", subType: "fixed" },
  { code: "1531", name: "Accumulated Depreciation - Vehicles", type: "asset", normalBalance: "credit", subType: "fixed" },
  { code: "1540", name: "Office Equipment", type: "asset", normalBalance: "debit", subType: "fixed" },
  { code: "1541", name: "Accumulated Depreciation - Equipment", type: "asset", normalBalance: "credit", subType: "fixed" },
  { code: "1550", name: "Furniture and Fittings", type: "asset", normalBalance: "debit", subType: "fixed" },
  { code: "1551", name: "Accumulated Depreciation - Furniture", type: "asset", normalBalance: "credit", subType: "fixed" },
  { code: "1560", name: "Computer Equipment", type: "asset", normalBalance: "debit", subType: "fixed" },
  { code: "1561", name: "Accumulated Depreciation - Computers", type: "asset", normalBalance: "credit", subType: "fixed" },

  // ===== LIABILITIES (2000-2999) =====
  // Current Liabilities
  { code: "2000", name: "Accounts Payable", type: "liability", normalBalance: "credit", subType: "current", description: "Trade creditors" },
  { code: "2100", name: "Accrued Expenses", type: "liability", normalBalance: "credit", subType: "current" },
  { code: "2110", name: "Accrued Salaries", type: "liability", normalBalance: "credit", subType: "current" },
  { code: "2120", name: "Accrued Interest", type: "liability", normalBalance: "credit", subType: "current" },
  { code: "2200", name: "Output VAT Payable", type: "liability", normalBalance: "credit", subType: "current", taxApplicable: { vat: true } },
  { code: "2210", name: "PAYE Payable", type: "liability", normalBalance: "credit", subType: "current" },
  { code: "2220", name: "WHT Payable", type: "liability", normalBalance: "credit", subType: "current", taxApplicable: { wht: true } },
  { code: "2230", name: "Pension Payable", type: "liability", normalBalance: "credit", subType: "current" },
  { code: "2240", name: "NHF Payable", type: "liability", normalBalance: "credit", subType: "current" },
  { code: "2250", name: "NSITF Payable", type: "liability", normalBalance: "credit", subType: "current" },
  { code: "2260", name: "ITF Payable", type: "liability", normalBalance: "credit", subType: "current" },
  { code: "2300", name: "Short-term Loans", type: "liability", normalBalance: "credit", subType: "current" },
  { code: "2310", name: "Bank Overdraft", type: "liability", normalBalance: "credit", subType: "current" },
  { code: "2400", name: "Unearned Revenue", type: "liability", normalBalance: "credit", subType: "current" },
  { code: "2410", name: "Customer Deposits", type: "liability", normalBalance: "credit", subType: "current" },

  // Non-Current Liabilities
  { code: "2500", name: "Long-term Loans", type: "liability", normalBalance: "credit", subType: "non-current" },
  { code: "2510", name: "Mortgage Payable", type: "liability", normalBalance: "credit", subType: "non-current" },
  { code: "2600", name: "Deferred Tax Liability", type: "liability", normalBalance: "credit", subType: "non-current" },

  // ===== EQUITY (3000-3999) =====
  { code: "3000", name: "Owner's Capital", type: "equity", normalBalance: "credit", description: "Owner's investment" },
  { code: "3010", name: "Share Capital", type: "equity", normalBalance: "credit" },
  { code: "3020", name: "Share Premium", type: "equity", normalBalance: "credit" },
  { code: "3100", name: "Retained Earnings", type: "equity", normalBalance: "credit" },
  { code: "3200", name: "Drawings", type: "equity", normalBalance: "debit", description: "Owner withdrawals (contra)" },
  { code: "3300", name: "Dividends Declared", type: "equity", normalBalance: "debit", description: "Dividends (contra)" },
  { code: "3400", name: "Revaluation Reserve", type: "equity", normalBalance: "credit" },

  // ===== INCOME/REVENUE (4000-4999) =====
  { code: "4000", name: "Sales", type: "income", normalBalance: "credit", taxApplicable: { vat: true } },
  { code: "4010", name: "Service Revenue", type: "income", normalBalance: "credit", taxApplicable: { vat: true, wht: true, whtRate: 5 } },
  { code: "4020", name: "Contract Revenue", type: "income", normalBalance: "credit", taxApplicable: { vat: true, wht: true, whtRate: 5 } },
  { code: "4100", name: "Sales Returns", type: "income", normalBalance: "debit", description: "Contra revenue" },
  { code: "4110", name: "Sales Discounts", type: "income", normalBalance: "debit", description: "Contra revenue" },
  { code: "4200", name: "Interest Income", type: "income", normalBalance: "credit", taxApplicable: { wht: true, whtRate: 10 } },
  { code: "4210", name: "Dividend Income", type: "income", normalBalance: "credit" },
  { code: "4220", name: "Rental Income", type: "income", normalBalance: "credit", taxApplicable: { wht: true, whtRate: 10 } },
  { code: "4300", name: "Gain on Asset Disposal", type: "income", normalBalance: "credit" },
  { code: "4400", name: "Foreign Exchange Gain", type: "income", normalBalance: "credit" },
  { code: "4500", name: "Other Income", type: "income", normalBalance: "credit" },

  // ===== EXPENSES (5000-6999) =====
  // Cost of Sales
  { code: "5000", name: "Cost of Goods Sold", type: "expense", normalBalance: "debit", subType: "cos" },
  { code: "5010", name: "Purchases", type: "expense", normalBalance: "debit", subType: "cos" },
  { code: "5020", name: "Purchases Returns", type: "expense", normalBalance: "credit", subType: "cos", description: "Contra" },
  { code: "5030", name: "Purchases Discounts", type: "expense", normalBalance: "credit", subType: "cos", description: "Contra" },
  { code: "5040", name: "Direct Labour", type: "expense", normalBalance: "debit", subType: "cos" },
  { code: "5050", name: "Manufacturing Overhead", type: "expense", normalBalance: "debit", subType: "cos" },
  { code: "5060", name: "Freight-In", type: "expense", normalBalance: "debit", subType: "cos" },

  // Operating Expenses
  { code: "5500", name: "Salaries and Wages", type: "expense", normalBalance: "debit", subType: "operating" },
  { code: "5510", name: "Staff Welfare", type: "expense", normalBalance: "debit", subType: "operating" },
  { code: "5520", name: "Pension Expense", type: "expense", normalBalance: "debit", subType: "operating" },
  { code: "5530", name: "NSITF Expense", type: "expense", normalBalance: "debit", subType: "operating" },
  { code: "5540", name: "ITF Expense", type: "expense", normalBalance: "debit", subType: "operating" },
  { code: "5600", name: "Rent Expense", type: "expense", normalBalance: "debit", subType: "operating", taxApplicable: { wht: true, whtRate: 10 } },
  { code: "5610", name: "Utilities Expense", type: "expense", normalBalance: "debit", subType: "operating" },
  { code: "5620", name: "Telephone and Internet", type: "expense", normalBalance: "debit", subType: "operating" },
  { code: "5700", name: "Depreciation Expense", type: "expense", normalBalance: "debit", subType: "operating" },
  { code: "5710", name: "Amortization Expense", type: "expense", normalBalance: "debit", subType: "operating" },
  { code: "5800", name: "Insurance Expense", type: "expense", normalBalance: "debit", subType: "operating" },
  { code: "5810", name: "Repairs and Maintenance", type: "expense", normalBalance: "debit", subType: "operating" },
  { code: "5820", name: "Office Supplies", type: "expense", normalBalance: "debit", subType: "operating" },
  { code: "5900", name: "Professional Fees", type: "expense", normalBalance: "debit", subType: "operating", taxApplicable: { wht: true, whtRate: 10 } },
  { code: "5910", name: "Audit Fees", type: "expense", normalBalance: "debit", subType: "operating", taxApplicable: { wht: true, whtRate: 10 } },
  { code: "5920", name: "Legal Fees", type: "expense", normalBalance: "debit", subType: "operating", taxApplicable: { wht: true, whtRate: 10 } },

  // Administrative Expenses
  { code: "6000", name: "Advertising and Marketing", type: "expense", normalBalance: "debit", subType: "admin" },
  { code: "6010", name: "Travel and Entertainment", type: "expense", normalBalance: "debit", subType: "admin" },
  { code: "6020", name: "Training and Development", type: "expense", normalBalance: "debit", subType: "admin" },
  { code: "6030", name: "Bank Charges", type: "expense", normalBalance: "debit", subType: "admin" },
  { code: "6040", name: "Bad Debts Expense", type: "expense", normalBalance: "debit", subType: "admin" },
  { code: "6050", name: "Donations", type: "expense", normalBalance: "debit", subType: "admin" },
  { code: "6060", name: "Fines and Penalties", type: "expense", normalBalance: "debit", subType: "admin" },
  { code: "6070", name: "Transport Expense", type: "expense", normalBalance: "debit", subType: "admin" },

  // Finance Costs
  { code: "6500", name: "Interest Expense", type: "expense", normalBalance: "debit", subType: "finance" },
  { code: "6600", name: "Foreign Exchange Loss", type: "expense", normalBalance: "debit", subType: "finance" },

  // Tax Expenses
  { code: "7000", name: "Income Tax Expense", type: "expense", normalBalance: "debit", subType: "tax" },
  { code: "7010", name: "Tertiary Education Tax", type: "expense", normalBalance: "debit", subType: "tax" },
];

// ============================================================================
// JOURNAL ENTRY TYPES
// ============================================================================

export interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  narration: string;
  reference?: string;
  lines: JournalLine[];
  isBalanced: boolean;
  totalDebits: number;
  totalCredits: number;
  transactionType: TransactionType;
  createdAt: string;
  postedAt?: string;
  status: "draft" | "posted" | "voided";
}

export type TransactionType =
  | "sale"
  | "sale-return"
  | "purchase"
  | "purchase-return"
  | "expense"
  | "asset-purchase"
  | "asset-disposal"
  | "depreciation"
  | "loan-received"
  | "loan-repayment"
  | "owner-investment"
  | "owner-drawing"
  | "receipt"
  | "payment"
  | "transfer"
  | "adjustment"
  | "opening-balance"
  | "closing"
  | "other";

export type PaymentMethod = "cash" | "bank" | "pos" | "transfer" | "mobile" | "credit" | "cheque";

// ============================================================================
// TRANSACTION INPUT TYPES
// ============================================================================

export interface TransactionInput {
  date?: string;
  description: string;
  amount: number;
  paymentMethod?: PaymentMethod;
  counterparty?: string;
  isCredit?: boolean; // True for credit sale/purchase
  vatApplicable?: boolean;
  vatRate?: number;
  whtApplicable?: boolean;
  whtRate?: number;
  inventoryEnabled?: boolean;
  costOfGoods?: number;
  category?: string;
  reference?: string;
}

export interface TransactionInterpretation {
  transactionType: TransactionType;
  description: string;
  amount: number;
  netAmount: number;
  vatAmount: number;
  whtAmount: number;
  paymentMethod: PaymentMethod;
  isCredit: boolean;
  counterparty?: string;
  hasTax: boolean;
  hasInventoryImpact: boolean;
  costOfGoods?: number;
  assumptions: string[];
  questionsNeeded: string[];
  // Extended fields for professional accounting logic
  parsed?: {
    action: string;
    object: string;
    counterparty: string;
    timing: 'immediate' | 'outstanding' | 'unknown';
    businessImpact: 'income' | 'expense' | 'asset' | 'liability' | 'equity' | 'unknown';
  };
  transactionNature?: 'income' | 'expense' | 'asset' | 'liability' | 'equity';
  hasCashMovement?: boolean;
  confidence?: number;
}

// ============================================================================
// LEDGER TYPES
// ============================================================================

export interface LedgerEntry {
  date: string;
  journalId: string;
  narration: string;
  debit: number;
  credit: number;
  balance: number;
  reference?: string;
}

export interface LedgerAccount {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  openingBalance: number;
  entries: LedgerEntry[];
  closingBalance: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getAccount(code: string): AccountDefinition | undefined {
  return CHART_OF_ACCOUNTS.find(acc => acc.code === code);
}

export function getAccountByName(name: string): AccountDefinition | undefined {
  const normalizedName = name.toLowerCase().trim();
  return CHART_OF_ACCOUNTS.find(acc =>
    acc.name.toLowerCase() === normalizedName ||
    acc.name.toLowerCase().includes(normalizedName)
  );
}

export function getAccountsByType(type: AccountType): AccountDefinition[] {
  return CHART_OF_ACCOUNTS.filter(acc => acc.type === type);
}

export function validateJournalEntry(lines: JournalLine[]): {
  isBalanced: boolean;
  totalDebits: number;
  totalCredits: number;
  difference: number;
} {
  const totalDebits = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredits = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
  const difference = Math.abs(totalDebits - totalCredits);

  // Allow for small rounding differences (< 0.01)
  const isBalanced = difference < 0.01;

  return { isBalanced, totalDebits, totalCredits, difference };
}

export function generateJournalId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `JE-${timestamp}-${random}`.toUpperCase();
}

export function formatCurrency(amount: number, currency = "NGN"): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

// ============================================================================
// END OF MODULE
// ============================================================================
