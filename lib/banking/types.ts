/**
 * =============================================================================
 * BANKING TRANSACTION PIPELINE — TYPES
 * =============================================================================
 *
 * Core types for the real-time bank transaction processing pipeline.
 * When a transaction arrives from Open Banking (Mono/Okra) or statement upload,
 * it flows through: Ingest → Classify → Route → Post across all modules.
 */

// =============================================================================
// INBOUND BANK TRANSACTION (from Open Banking provider)
// =============================================================================

export interface InboundBankTransaction {
    /** Provider's unique transaction ID */
    id: string;
    /** Bank connection ID in our system */
    connectionId: string;
    /** Bank account ID */
    accountId: string;
    /** ISO date string */
    date: string;
    /** Bank description/narration */
    description: string;
    /** Secondary narration (some banks provide two fields) */
    narration?: string;
    /** Transaction amount (always positive) */
    amount: number;
    /** Running balance after this transaction */
    balance?: number;
    /** Credit = money in, Debit = money out */
    direction: "credit" | "debit";
    /** Currency code */
    currency: string;
    /** Bank reference number */
    reference?: string;
    /** Counterparty name (if available from Open Banking) */
    counterparty?: string;
    /** Counterparty bank code */
    counterpartyBank?: string;
    /** Transaction channel */
    channel?: "pos" | "atm" | "web" | "mobile" | "branch" | "transfer" | "direct_debit" | "standing_order";
    /** Raw data from provider */
    rawData?: Record<string, unknown>;
}

// =============================================================================
// CLASSIFICATION RESULT
// =============================================================================

export type TransactionNature =
    | "revenue"           // Sales income, service income
    | "cost_of_sales"     // Direct costs, inventory purchases
    | "operating_expense" // Rent, utilities, salaries, etc.
    | "asset_purchase"    // Capital expenditure (equipment, vehicles)
    | "asset_disposal"    // Sale of fixed assets
    | "financing"         // Loans received/repaid
    | "equity"            // Owner's capital/drawings
    | "transfer"          // Inter-account transfers
    | "tax_payment"       // Tax remittances to FIRS/SIRS
    | "other";

export interface ClassificationResult {
    /** The broad nature of the transaction */
    nature: TransactionNature;
    /** Specific sub-category (e.g., "utilities", "professional-services") */
    category: string;
    /** Human-readable label */
    categoryLabel: string;
    /** Chart of accounts — debit account code */
    debitAccountCode: string;
    debitAccountName: string;
    /** Chart of accounts — credit account code */
    creditAccountCode: string;
    creditAccountName: string;
    /** Confidence score 0-1 */
    confidence: number;
    /** How classification was determined */
    source: "rule" | "ai" | "hybrid";
    /** Brief reasoning */
    reasoning: string;

    // Tax implications detected
    tax: {
        /** Is this transaction VAT-applicable? */
        vatApplicable: boolean;
        /** VAT category */
        vatCategory?: "output" | "input" | "exempt" | "zero_rated";
        /** Computed VAT amount (7.5% standard) */
        vatAmount: number;
        /** Is WHT applicable? */
        whtApplicable: boolean;
        /** WHT rate (e.g., 0.05 for 5%, 0.10 for 10%) */
        whtRate: number;
        /** Computed WHT amount */
        whtAmount: number;
        /** WHT transaction type for rate determination */
        whtType?: string;
        /** Is this a capital gain? */
        cgtApplicable: boolean;
        /** Is stamp duty applicable? */
        stampDutyApplicable: boolean;
    };

    // Budget mapping
    budget: {
        /** Matched budget category name */
        category?: string;
        /** Matched department */
        department?: string;
    };
}

// =============================================================================
// PIPELINE RESULT (output of full processing)
// =============================================================================

export interface PipelineResult {
    /** Whether all processing succeeded */
    success: boolean;
    /** Original bank transaction ID */
    bankTransactionId: string;
    /** Our internal transaction reference */
    internalRef: string;
    /** The classification applied */
    classification: ClassificationResult;

    // Module results
    accounting: {
        posted: boolean;
        journalId?: string;
        error?: string;
    };
    tax: {
        classified: boolean;
        classifications: string[]; // IDs of tax classifications created
        error?: string;
    };
    budgeting: {
        tracked: boolean;
        budgetId?: string;
        categoryMatch?: string;
        error?: string;
    };
    cashflow: {
        updated: boolean;
        error?: string;
    };

    /** Any warnings or issues */
    warnings: string[];
    /** Processing timestamp */
    processedAt: string;
}

// =============================================================================
// BATCH PROCESSING
// =============================================================================

export interface BatchPipelineResult {
    total: number;
    processed: number;
    failed: number;
    duplicatesSkipped: number;
    results: PipelineResult[];
    summary: {
        totalCredits: number;
        totalDebits: number;
        netAmount: number;
        byNature: Record<string, { count: number; amount: number }>;
        taxImplications: {
            vatOutput: number;
            vatInput: number;
            whtDeducted: number;
        };
    };
    processedAt: string;
}

// =============================================================================
// WEBHOOK EVENT (from Mono/Okra)
// =============================================================================

export type WebhookEventType =
    | "transaction.new"
    | "transaction.updated"
    | "account.connected"
    | "account.disconnected"
    | "sync.completed"
    | "sync.failed";

export interface WebhookEvent {
    /** Webhook event ID */
    id: string;
    /** Event type */
    type: WebhookEventType;
    /** ISO timestamp */
    timestamp: string;
    /** Provider (mono / okra) */
    provider: "mono" | "okra";
    /** Event payload */
    data: {
        connectionId?: string;
        accountId?: string;
        transactions?: InboundBankTransaction[];
        error?: string;
        metadata?: Record<string, unknown>;
    };
}

// =============================================================================
// PROCESSING OPTIONS
// =============================================================================

export interface PipelineOptions {
    /** Entity ID for tax compliance */
    entityId: string;
    /** Skip duplicate detection (for re-processing) */
    skipDuplicateCheck?: boolean;
    /** Auto-post journal entries (vs. leave as draft) */
    autoPost?: boolean;
    /** Run tax classification */
    runTaxClassification?: boolean;
    /** Update budgets */
    updateBudgets?: boolean;
    /** Update cashflow intelligence */
    updateCashflow?: boolean;
    /** Fiscal period for tax */
    fiscalPeriod?: string;
    /** Default bank account code in chart of accounts */
    bankAccountCode?: string;
}
