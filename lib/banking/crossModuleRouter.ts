/**
 * =============================================================================
 * CROSS-MODULE TRANSACTION ROUTER
 * =============================================================================
 *
 * Once a bank transaction is classified, this module routes it to:
 *
 *   1. ACCOUNTING  — Creates a double-entry journal (DR/CR) via the AccountingEngine
 *   2. TAX         — Converts the journal to a ComplianceTransaction and runs
 *                    tax classification (VAT, WHT, CIT, CGT, Stamp)
 *   3. BUDGETING   — Records a BudgetImpact so budget-vs-actual tracking updates
 *
 * Each module is called independently so a failure in one doesn't block the rest.
 */

import { accountingEngine } from "@/lib/accounting/transactionBridge";
import type { RawTransaction } from "@/lib/accounting/types";
import type { JournalEntry } from "@/lib/accounting/doubleEntry";
import { mapJournalEntriesToCompliance } from "@/lib/tax/compliance/adapters";
import { runTaxComputation } from "@/lib/tax/compliance/engine";
import type {
    InboundBankTransaction,
    ClassificationResult,
    PipelineResult,
} from "./types";

// =============================================================================
// HELPERS
// =============================================================================

const makeRef = () =>
    `BNK-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const natureToRawType = (
    nature: ClassificationResult["nature"]
): RawTransaction["type"] => {
    switch (nature) {
        case "revenue":
            return "income";
        case "cost_of_sales":
        case "operating_expense":
            return "expense";
        case "asset_purchase":
        case "asset_disposal":
            return "asset";
        case "financing":
            return "liability";
        case "equity":
            return "equity";
        default:
            return "other";
    }
};

const normalizePostingDate = (value?: string): string => {
    const raw = String(value || "").trim();
    if (!raw) return new Date().toISOString().split("T")[0];

    const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return new Date().toISOString().split("T")[0];
    return parsed.toISOString().split("T")[0];
};

// =============================================================================
// 1. ACCOUNTING MODULE
// =============================================================================

function postToAccounting(
    tx: InboundBankTransaction,
    classification: ClassificationResult
): { posted: boolean; journalId?: string; journalEntry?: JournalEntry; error?: string } {
    try {
        const result = accountingEngine.processTransactionWithAIAccounts(
            {
                id: `bank-${tx.id}`,
                date: normalizePostingDate(tx.date),
                description: `${tx.description}${tx.narration ? ` — ${tx.narration}` : ""}`,
                category: classification.category,
                amount: tx.amount,
                type: natureToRawType(classification.nature),
                reference: tx.reference,
                currency: tx.currency || "NGN",
                classificationSource: classification.source,
                classificationConfidence: classification.confidence,
                vatApplicable: classification.tax.vatApplicable,
                vatAmount: classification.tax.vatAmount,
                whtApplicable: classification.tax.whtApplicable,
                whtAmount: classification.tax.whtAmount,
            } satisfies RawTransaction,
            {
                debitCode: classification.debitAccountCode,
                debitName: classification.debitAccountName,
                creditCode: classification.creditAccountCode,
                creditName: classification.creditAccountName,
                confidence: classification.confidence,
                reasoning: classification.reasoning,
                parsedType: classification.nature,
                taxImplications: {
                    outputVAT:
                        classification.tax.vatCategory === "output"
                            ? classification.tax.vatAmount
                            : 0,
                    inputVAT:
                        classification.tax.vatCategory === "input"
                            ? classification.tax.vatAmount
                            : 0,
                },
            }
        );

        return {
            posted: true,
            journalId: result.journalEntry.id,
            journalEntry: result.journalEntry,
        };
    } catch (err) {
        return {
            posted: false,
            error: err instanceof Error ? err.message : "Accounting posting failed",
        };
    }
}

// =============================================================================
// 2. TAX COMPLIANCE MODULE
// =============================================================================

function routeToTax(
    entityId: string,
    journalEntry: JournalEntry | undefined,
    period?: string
): { classified: boolean; classifications: string[]; error?: string } {
    if (!journalEntry) {
        return { classified: false, classifications: [], error: "No journal entry to classify" };
    }

    try {
        // Convert posted journal → ComplianceTransaction
        const complianceTxs = mapJournalEntriesToCompliance(entityId, [journalEntry]);
        if (complianceTxs.length === 0) {
            return { classified: false, classifications: [], error: "Journal entry could not be mapped" };
        }

        // Run the full tax computation for this transaction
        const result = runTaxComputation({
            entityId,
            period,
            transactions: complianceTxs,
        });

        return {
            classified: true,
            classifications: result.classifications.map((c) => c.id),
        };
    } catch (err) {
        return {
            classified: false,
            classifications: [],
            error: err instanceof Error ? err.message : "Tax classification failed",
        };
    }
}

// =============================================================================
// 3. BUDGETING MODULE
// =============================================================================

/**
 * Budget tracking doesn't need an explicit "post" — the budgeting engine reads
 * journal entries directly via `extractBudgetImpacts()`. After the accounting
 * module posts the journal entry, the budget dashboard automatically picks it up.
 *
 * What we do here is return metadata so the PipelineResult can confirm the
 * budget category match for transparency.
 */
function routeToBudgeting(
    classification: ClassificationResult
): { tracked: boolean; categoryMatch?: string; error?: string } {
    try {
        // The budget engine reads journal entries reactively.
        // We just confirm the mapping for the pipeline result.
        const category = classification.budget?.category;
        return {
            tracked: !!category,
            categoryMatch: category,
        };
    } catch (err) {
        return {
            tracked: false,
            error: err instanceof Error ? err.message : "Budget tracking failed",
        };
    }
}

// =============================================================================
// UNIFIED ROUTER
// =============================================================================

export interface RouteOptions {
    entityId: string;
    autoPost?: boolean;
    runTaxClassification?: boolean;
    updateBudgets?: boolean;
    updateCashflow?: boolean;
    fiscalPeriod?: string;
}

/**
 * Route a classified bank transaction through all modules.
 * Each module is called independently — failures are isolated.
 */
export function routeTransaction(
    tx: InboundBankTransaction,
    classification: ClassificationResult,
    options: RouteOptions
): PipelineResult {
    const internalRef = makeRef();
    const warnings: string[] = [];

    // ── 1. ACCOUNTING ──────────────────────────────────────────────────
    const accounting = postToAccounting(tx, classification);
    if (!accounting.posted) {
        warnings.push(`Accounting: ${accounting.error}`);
    }

    // ── 2. TAX ─────────────────────────────────────────────────────────
    let tax: PipelineResult["tax"] = { classified: false, classifications: [] };
    if (options.runTaxClassification !== false) {
        tax = routeToTax(
            options.entityId,
            accounting.journalEntry,
            options.fiscalPeriod
        );
        if (!tax.classified && tax.error) {
            warnings.push(`Tax: ${tax.error}`);
        }
    }

    // ── 3. BUDGETING ───────────────────────────────────────────────────
    let budgeting: PipelineResult["budgeting"] = { tracked: false };
    if (options.updateBudgets !== false) {
        budgeting = routeToBudgeting(classification);
    }

    const cashflow: PipelineResult["cashflow"] = { updated: false };

    // Low confidence warning
    if (classification.confidence < 0.7) {
        warnings.push(
            `Low classification confidence (${Math.round(classification.confidence * 100)}%). ` +
            `Consider manual review for: "${tx.description}"`
        );
    }

    return {
        success: accounting.posted,
        bankTransactionId: tx.id,
        internalRef,
        classification,
        accounting: {
            posted: accounting.posted,
            journalId: accounting.journalId,
            error: accounting.error,
        },
        tax,
        budgeting,
        cashflow,
        warnings,
        processedAt: new Date().toISOString(),
    };
}
