/**
 * Bank Transaction Importer
 * 
 * Transforms bank transactions into double-entry journal entries
 * using the accounting engine.
 * 
 * Flow:
 * 1. Bank syncs transactions via Open Banking API
 * 2. This module categorizes each transaction
 * 3. Creates proper DR/CR entries per GAAP/IFRS
 * 4. Posts to accounting engine (ledger, journal, statements)
 */

import { RawTransaction } from "./types";
import { accountingEngine } from "./transactionBridge";

// Transaction category patterns for auto-classification
const CATEGORY_PATTERNS: Array<{
    pattern: RegExp;
    category: string;
    type: "income" | "expense" | "transfer" | "asset" | "liability";
    description?: string;
}> = [
        // Income patterns
        { pattern: /salary|payroll|wage/i, category: "salary", type: "income", description: "Salary/Wages Income" },
        { pattern: /invoice|payment received|inward transfer/i, category: "sales", type: "income", description: "Sales Revenue" },
        { pattern: /dividend|interest earned|interest credit/i, category: "investment-income", type: "income", description: "Investment Income" },
        { pattern: /refund/i, category: "refund", type: "income", description: "Refund Received" },

        // Expense patterns
        { pattern: /electricity|ikedc|ekedc|phcn|nepa/i, category: "utilities", type: "expense", description: "Electricity Bill" },
        { pattern: /internet|data|mtn|glo|airtel|9mobile/i, category: "utilities", type: "expense", description: "Internet/Data" },
        { pattern: /water bill|water rate/i, category: "utilities", type: "expense", description: "Water Bill" },
        { pattern: /rent|lease|landlord/i, category: "rent", type: "expense", description: "Rent Expense" },
        { pattern: /fuel|petrol|diesel|gas station|filling/i, category: "transport", type: "expense", description: "Fuel/Transport" },
        { pattern: /uber|bolt|taxi|transport/i, category: "transport", type: "expense", description: "Transport" },
        { pattern: /shoprite|spar|supermarket|grocery|market/i, category: "supplies", type: "expense", description: "Supplies/Shopping" },
        { pattern: /restaurant|food|lunch|dinner|breakfast|eatery/i, category: "meals", type: "expense", description: "Meals & Entertainment" },
        { pattern: /office|stationery|supplies/i, category: "office-supplies", type: "expense", description: "Office Supplies" },
        { pattern: /insurance|hmo|health|premium/i, category: "insurance", type: "expense", description: "Insurance" },
        { pattern: /bank charge|maintenance fee|sms alert|atm/i, category: "bank-charges", type: "expense", description: "Bank Charges" },
        { pattern: /subscription|netflix|spotify|saas/i, category: "subscriptions", type: "expense", description: "Subscriptions" },
        { pattern: /tax|firs|irs|paye|vat payment/i, category: "taxes", type: "expense", description: "Tax Payment" },

        // Transfer patterns
        { pattern: /transfer to|sent to|outward/i, category: "transfer-out", type: "transfer", description: "Outward Transfer" },
        { pattern: /transfer from|received from/i, category: "transfer-in", type: "transfer", description: "Inward Transfer" },

        // Asset patterns
        { pattern: /equipment|machinery|computer|laptop|phone/i, category: "assets", type: "asset", description: "Asset Purchase" },
        { pattern: /vehicle|car|truck|motorcycle/i, category: "vehicles", type: "asset", description: "Vehicle Purchase" },
        { pattern: /furniture|fittings|desk|chair/i, category: "furniture", type: "asset", description: "Furniture & Fittings" },

        // Liability patterns
        { pattern: /loan repayment|credit|installment/i, category: "loan-repayment", type: "liability", description: "Loan Repayment" },
        { pattern: /loan disbursement|credit received/i, category: "loan-received", type: "liability", description: "Loan Received" },
    ];

// Bank transaction from API
export interface BankTransaction {
    id: string;
    date: string;
    description: string;
    narration?: string;
    amount: number;
    balance?: number;
    type: "credit" | "debit";
    reference?: string;
    currency?: string;
}

// Import result
export interface ImportResult {
    success: boolean;
    transactionId: string;
    journalId?: string;
    category: string;
    description: string;
    amount: number;
    type: "income" | "expense" | "transfer" | "asset" | "liability";
    error?: string;
}

/**
 * Categorize a bank transaction based on its description
 */
export function categorizeTransaction(tx: BankTransaction): {
    category: string;
    type: "income" | "expense" | "transfer" | "asset" | "liability";
    description: string;
} {
    const text = `${tx.description} ${tx.narration || ""}`.toLowerCase();

    // Find matching pattern
    for (const pattern of CATEGORY_PATTERNS) {
        if (pattern.pattern.test(text)) {
            return {
                category: pattern.category,
                type: pattern.type,
                description: pattern.description || tx.description,
            };
        }
    }

    // Default categorization based on credit/debit
    if (tx.type === "credit") {
        return { category: "other-income", type: "income", description: "Other Income" };
    } else {
        return { category: "other-expense", type: "expense", description: "Other Expense" };
    }
}

/**
 * Import a single bank transaction into the accounting engine
 * Creates proper double-entry journal entry
 */
export function importBankTransaction(tx: BankTransaction): ImportResult {
    try {
        // Categorize the transaction
        const { category, type, description } = categorizeTransaction(tx);

        // Create raw transaction for accounting engine
        const rawTx: RawTransaction = {
            id: `bank-${tx.id}`,
            date: tx.date,
            description: `${tx.description}${tx.narration ? ` - ${tx.narration}` : ""}`,
            category,
            amount: Math.abs(tx.amount),
            type: type as RawTransaction["type"],
        };

        // Process through accounting engine
        // This will create proper double-entry: DR/CR based on transaction type
        const result = accountingEngine.processTransaction(rawTx);

        return {
            success: true,
            transactionId: tx.id,
            journalId: result.journalEntry.id,
            category,
            description,
            amount: Math.abs(tx.amount),
            type,
        };
    } catch (error) {
        return {
            success: false,
            transactionId: tx.id,
            category: "unknown",
            description: tx.description,
            amount: Math.abs(tx.amount),
            type: tx.type === "credit" ? "income" : "expense",
            error: error instanceof Error ? error.message : "Failed to import",
        };
    }
}

/**
 * Import multiple bank transactions
 * Returns summary of imported transactions
 */
export function importBankTransactions(transactions: BankTransaction[]): {
    total: number;
    imported: number;
    failed: number;
    results: ImportResult[];
    summary: {
        income: number;
        expenses: number;
        netAmount: number;
    };
} {
    const results: ImportResult[] = [];
    let income = 0;
    let expenses = 0;

    for (const tx of transactions) {
        const result = importBankTransaction(tx);
        results.push(result);

        if (result.success) {
            if (result.type === "income") {
                income += result.amount;
            } else if (result.type === "expense") {
                expenses += result.amount;
            }
        }
    }

    return {
        total: transactions.length,
        imported: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
        summary: {
            income,
            expenses,
            netAmount: income - expenses,
        },
    };
}

/**
 * Check if a transaction has already been imported
 * (Prevents duplicate imports)
 */
export function isTransactionImported(txId: string): boolean {
    const state = accountingEngine.getState();
    return state.journalEntries.some(entry =>
        entry.reference?.includes(`bank-${txId}`) ||
        entry.id.includes(txId)
    );
}
