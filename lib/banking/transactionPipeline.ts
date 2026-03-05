/**
 * =============================================================================
 * BANK TRANSACTION PIPELINE — ORCHESTRATOR
 * =============================================================================
 *
 * The main entry point for processing bank transactions across the entire system.
 *
 * Flow:
 *   InboundBankTransaction
 *     → Duplicate detection
 *     → AI Classification (narration patterns + heuristics)
 *     → Cross-module routing:
 *         → Accounting (double-entry journal)
 *         → Tax compliance (VAT/WHT/CIT classification)
 *         → Budgeting (budget-vs-actual tracking)
 *         → Cashflow intelligence (metrics refresh)
 *     → Pipeline result with full audit trail
 *
 * Usage:
 *   import { processTransaction, processTransactions } from "@/lib/banking";
 *
 *   // Single transaction (webhook / real-time)
 *   const result = processTransaction(tx, { entityId: "ent-001" });
 *
 *   // Batch (sync / statement upload)
 *   const batch = processTransactions(transactions, { entityId: "ent-001" });
 */

import { accountingEngine } from "@/lib/accounting/transactionBridge";
import { cashflowEngine } from "@/lib/cashflow/cashflowEngine";
import { classifyBankTransaction, classifyBankTransactionWithAI } from "./aiClassifier";
import { routeTransaction } from "./crossModuleRouter";
import type {
    InboundBankTransaction,
    PipelineOptions,
    PipelineResult,
    BatchPipelineResult,
} from "./types";

// =============================================================================
// DUPLICATE DETECTION
// =============================================================================

/**
 * Check if a bank transaction has already been imported.
 * Matches on: bank reference, or exact (date + amount + description) combo.
 */
function isDuplicate(tx: InboundBankTransaction): boolean {
    const state = accountingEngine.getState();
    const bankRef = `bank-${tx.id}`;

    return state.journalEntries.some((entry) => {
        // Check by reference ID
        if (entry.reference === bankRef || entry.id === bankRef) return true;

        // Check by exact match: same date + amount + description
        if (
            entry.date === tx.date.split("T")[0] &&
            entry.narration?.toLowerCase() === tx.description.toLowerCase()
        ) {
            const entryAmount = entry.totalDebits || 0;
            if (Math.abs(entryAmount - tx.amount) < 0.01) return true;
        }

        return false;
    });
}

function duplicateResult(tx: InboundBankTransaction): PipelineResult {
    return {
        success: false,
        bankTransactionId: tx.id,
        internalRef: "",
        classification: {
            nature: "other",
            category: "duplicate",
            categoryLabel: "Duplicate Transaction",
            debitAccountCode: "",
            debitAccountName: "",
            creditAccountCode: "",
            creditAccountName: "",
            confidence: 1,
            source: "rule",
            reasoning: "Transaction already imported",
            tax: {
                vatApplicable: false,
                vatAmount: 0,
                whtApplicable: false,
                whtRate: 0,
                whtAmount: 0,
                cgtApplicable: false,
                stampDutyApplicable: false,
            },
            budget: {},
        },
        accounting: { posted: false, error: "Duplicate — already imported" },
        tax: { classified: false, classifications: [] },
        budgeting: { tracked: false },
        cashflow: { updated: false },
        warnings: ["Duplicate transaction skipped"],
        processedAt: new Date().toISOString(),
    };
}

// =============================================================================
// SINGLE TRANSACTION PROCESSING
// =============================================================================

/**
 * Process a single bank transaction through the full pipeline.
 *
 * This is the primary entry point for:
 *  - Real-time webhook events (new transaction from Mono/Okra)
 *  - Manual import of individual transactions
 */
export function processTransaction(
    tx: InboundBankTransaction,
    options: PipelineOptions
): PipelineResult {
    // Step 1: Duplicate check
    if (!options.skipDuplicateCheck && isDuplicate(tx)) {
        return duplicateResult(tx);
    }

    // Step 2: Classify
    const classification = classifyBankTransaction(
        tx,
        options.bankAccountCode || "1000"
    );

    // Step 3: Route through all modules
    return routeTransaction(tx, classification, {
        entityId: options.entityId,
        autoPost: options.autoPost ?? true,
        runTaxClassification: options.runTaxClassification ?? true,
        updateBudgets: options.updateBudgets ?? true,
        updateCashflow: options.updateCashflow ?? true,
        fiscalPeriod: options.fiscalPeriod,
    });
}

/**
 * Process a single bank transaction through the full pipeline
 * with Gemini-assisted fallback for ambiguous classifications.
 */
export async function processTransactionWithAI(
    tx: InboundBankTransaction,
    options: PipelineOptions
): Promise<PipelineResult> {
    // Step 1: Duplicate check
    if (!options.skipDuplicateCheck && isDuplicate(tx)) {
        return duplicateResult(tx);
    }

    // Step 2: Classify (rules + Gemini fallback for low-confidence cases)
    const classification = await classifyBankTransactionWithAI(
        tx,
        options.bankAccountCode || "1000"
    );

    // Step 3: Route through all modules
    return routeTransaction(tx, classification, {
        entityId: options.entityId,
        autoPost: options.autoPost ?? true,
        runTaxClassification: options.runTaxClassification ?? true,
        updateBudgets: options.updateBudgets ?? true,
        updateCashflow: options.updateCashflow ?? true,
        fiscalPeriod: options.fiscalPeriod,
    });
}

// =============================================================================
// BATCH TRANSACTION PROCESSING
// =============================================================================

/**
 * Process a batch of bank transactions (from sync or statement upload).
 *
 * Transactions are sorted by date (oldest first) and processed sequentially
 * so that running balances, cashflow metrics, and tax computations are
 * computed in chronological order.
 *
 * Cashflow is refreshed once at the end, not per-transaction, for efficiency.
 */
export function processTransactions(
    transactions: InboundBankTransaction[],
    options: PipelineOptions
): BatchPipelineResult {
    // Sort by date ascending
    const sorted = [...transactions].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const results: PipelineResult[] = [];
    let duplicatesSkipped = 0;
    let totalCredits = 0;
    let totalDebits = 0;
    const byNature: Record<string, { count: number; amount: number }> = {};
    let vatOutput = 0;
    let vatInput = 0;
    let whtDeducted = 0;

    for (const tx of sorted) {
        // Process each transaction, but defer cashflow refresh to the end
        const result = processTransaction(tx, {
            ...options,
            updateCashflow: false, // Deferred
        });

        results.push(result);

        if (result.classification.category === "duplicate") {
            duplicatesSkipped++;
            continue;
        }

        // Aggregate stats
        if (tx.direction === "credit") {
            totalCredits += tx.amount;
        } else {
            totalDebits += tx.amount;
        }

        const nature = result.classification.nature;
        if (!byNature[nature]) byNature[nature] = { count: 0, amount: 0 };
        byNature[nature].count++;
        byNature[nature].amount += tx.amount;

        if (result.classification.tax.vatCategory === "output") {
            vatOutput += result.classification.tax.vatAmount;
        } else if (result.classification.tax.vatCategory === "input") {
            vatInput += result.classification.tax.vatAmount;
        }
        if (result.classification.tax.whtApplicable) {
            whtDeducted += result.classification.tax.whtAmount;
        }
    }

    // Now refresh cashflow once after all transactions are posted
    if (options.updateCashflow !== false) {
        try {
            const accountingState = accountingEngine.getState();
            cashflowEngine.refresh(accountingState);
        } catch {
            // Non-critical — cashflow will refresh on next dashboard load
        }
    }

    return {
        total: transactions.length,
        processed: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success && r.classification.category !== "duplicate").length,
        duplicatesSkipped,
        results,
        summary: {
            totalCredits,
            totalDebits,
            netAmount: totalCredits - totalDebits,
            byNature,
            taxImplications: {
                vatOutput,
                vatInput,
                whtDeducted,
            },
        },
        processedAt: new Date().toISOString(),
    };
}

/**
 * Process a batch with Gemini-assisted classification fallback.
 */
export async function processTransactionsWithAI(
    transactions: InboundBankTransaction[],
    options: PipelineOptions
): Promise<BatchPipelineResult> {
    const sorted = [...transactions].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const results: PipelineResult[] = [];
    let duplicatesSkipped = 0;
    let totalCredits = 0;
    let totalDebits = 0;
    const byNature: Record<string, { count: number; amount: number }> = {};
    let vatOutput = 0;
    let vatInput = 0;
    let whtDeducted = 0;

    for (const tx of sorted) {
        const result = await processTransactionWithAI(tx, {
            ...options,
            updateCashflow: false,
        });

        results.push(result);

        if (result.classification.category === "duplicate") {
            duplicatesSkipped++;
            continue;
        }

        if (tx.direction === "credit") {
            totalCredits += tx.amount;
        } else {
            totalDebits += tx.amount;
        }

        const nature = result.classification.nature;
        if (!byNature[nature]) byNature[nature] = { count: 0, amount: 0 };
        byNature[nature].count++;
        byNature[nature].amount += tx.amount;

        if (result.classification.tax.vatCategory === "output") {
            vatOutput += result.classification.tax.vatAmount;
        } else if (result.classification.tax.vatCategory === "input") {
            vatInput += result.classification.tax.vatAmount;
        }
        if (result.classification.tax.whtApplicable) {
            whtDeducted += result.classification.tax.whtAmount;
        }
    }

    if (options.updateCashflow !== false) {
        try {
            const accountingState = accountingEngine.getState();
            cashflowEngine.refresh(accountingState);
        } catch {
            // Non-critical — cashflow will refresh on next dashboard load
        }
    }

    return {
        total: transactions.length,
        processed: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success && r.classification.category !== "duplicate").length,
        duplicatesSkipped,
        results,
        summary: {
            totalCredits,
            totalDebits,
            netAmount: totalCredits - totalDebits,
            byNature,
            taxImplications: {
                vatOutput,
                vatInput,
                whtDeducted,
            },
        },
        processedAt: new Date().toISOString(),
    };
}

// =============================================================================
// CSV STATEMENT PARSER
// =============================================================================

/**
 * Parse a CSV bank statement into InboundBankTransactions.
 * Handles common Nigerian bank CSV formats.
 *
 * Expected columns (flexible matching):
 *   Date, Description/Narration, Debit, Credit, Balance, Reference
 */
export function parseCSVStatement(
    csvText: string,
    connectionId: string,
    accountId: string,
    options?: { currency?: string; dateFormat?: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" }
): InboundBankTransaction[] {
    const lines = csvText.trim().split("\n");
    if (lines.length < 2) return [];

    // Parse header
    const headerLine = lines[0];
    const separator = headerLine.includes("\t") ? "\t" : ",";
    const headers = headerLine.split(separator).map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

    // Find column indices
    const dateIdx = headers.findIndex((h) => /^(date|trans.*date|value.*date|posting.*date)$/.test(h));
    const descIdx = headers.findIndex((h) => /^(desc|description|narration|remarks|particulars)$/.test(h));
    const debitIdx = headers.findIndex((h) => /^(debit|withdrawal|dr|debit.*amount|outflow)$/.test(h));
    const creditIdx = headers.findIndex((h) => /^(credit|deposit|cr|credit.*amount|inflow)$/.test(h));
    const amountIdx = headers.findIndex((h) => /^(amount|value|transaction.*amount)$/.test(h));
    const balanceIdx = headers.findIndex((h) => /^(balance|closing.*balance|running.*balance|book.*balance)$/.test(h));
    const refIdx = headers.findIndex((h) => /^(ref|reference|transaction.*ref|tran.*id)$/.test(h));

    if (dateIdx === -1 || (descIdx === -1)) return [];

    const transactions: InboundBankTransaction[] = [];
    const dateFormat = options?.dateFormat || "DD/MM/YYYY";

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = parseCSVLine(line, separator);

        const rawDate = cols[dateIdx]?.trim();
        if (!rawDate) continue;

        const date = parseDate(rawDate, dateFormat);
        if (!date) continue;

        const description = cols[descIdx]?.trim() || "";
        if (!description) continue;

        let amount = 0;
        let direction: "credit" | "debit" = "debit";

        if (debitIdx !== -1 && creditIdx !== -1) {
            const debitVal = parseAmount(cols[debitIdx]);
            const creditVal = parseAmount(cols[creditIdx]);
            if (creditVal > 0) {
                amount = creditVal;
                direction = "credit";
            } else {
                amount = debitVal;
                direction = "debit";
            }
        } else if (amountIdx !== -1) {
            const val = parseAmount(cols[amountIdx]);
            amount = Math.abs(val);
            direction = val >= 0 ? "credit" : "debit";
        }

        if (amount <= 0) continue;

        const balance = balanceIdx !== -1 ? parseAmount(cols[balanceIdx]) : undefined;
        const reference = refIdx !== -1 ? cols[refIdx]?.trim() : undefined;

        transactions.push({
            id: `csv-${i}-${Date.now()}`,
            connectionId,
            accountId,
            date: date.toISOString(),
            description,
            amount,
            balance: balance || undefined,
            direction,
            currency: options?.currency || "NGN",
            reference: reference || undefined,
            channel: "web",
        });
    }

    return transactions;
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

function parseCSVLine(line: string, separator: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
            result.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function parseDate(raw: string, format: string): Date | null {
    const cleaned = raw.replace(/['"]/g, "").trim();

    // Try ISO first
    if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
        const d = new Date(cleaned);
        return isNaN(d.getTime()) ? null : d;
    }

    const parts = cleaned.split(/[/\-\.]/);
    if (parts.length < 3) return null;

    let day: number, month: number, year: number;

    if (format === "DD/MM/YYYY") {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
    } else if (format === "MM/DD/YYYY") {
        month = parseInt(parts[0], 10) - 1;
        day = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
    } else {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
    }

    // Handle 2-digit years
    if (year < 100) year += 2000;

    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date;
}

function parseAmount(raw: string | undefined): number {
    if (!raw) return 0;
    const cleaned = raw.replace(/['"₦NGN,\s]/gi, "").trim();
    if (!cleaned || cleaned === "-" || cleaned === "--") return 0;
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
}
