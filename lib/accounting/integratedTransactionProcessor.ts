/**
 * Integrated Transaction Processor
 * 
 * Combines Layer 1 (System Logic) + Layer 2 (AI Validation) for
 * maximum accuracy in transaction classification and tax treatment.
 * 
 * Flow:
 * 1. User enters transaction text
 * 2. Layer 1: System logic interprets (fast, rule-based)
 * 3. Layer 2: AI validates and corrects (smart, context-aware)
 * 4. Final result used for journal posting
 */

import { analyzeTransactionText } from './sentenceAnalyzer';
import type { TransactionAnalysis } from './sentenceAnalyzer';
import { AITransactionValidator, getAIValidator, validateWithAI } from './aiTransactionValidator';
import type { SystemInterpretation, AIValidationResult } from './aiTransactionValidator';
import { identifyTransactionNature } from './transactionTaxAnalyzer';

// ============================================================================
// TYPES
// ============================================================================

export interface IntegratedTransactionResult {
    // Original input
    transactionText: string;
    amount: number;

    // Layer 1 result
    layer1: {
        debitAccount: { code: string; name: string };
        creditAccount: { code: string; name: string };
        flow: 'inflow' | 'outflow' | 'transfer' | 'unknown';
        isCredit: boolean;
        nature: string;
        confidence: number;
    };

    // Layer 2 result
    layer2: AIValidationResult | null;

    // Final validated result
    final: {
        debitAccount: { code: string; name: string };
        creditAccount: { code: string; name: string };
        amount: number;
        nature: string;
        taxImplications: {
            outputVAT: number;
            inputVAT: number;
            wht: number;
            paye: number;
            cgt: number;
            isDisallowable: boolean;
        };
        confidence: number;
    };

    // Metadata
    aiCorrectionsMade: boolean;
    aiEnabled: boolean;
    processingTimeMs: number;
    auditLog: string[];
}

// ============================================================================
// TAX CALCULATION HELPERS
// ============================================================================

const TAX_RATES = {
    VAT: 0.075,
    WHT_PROFESSIONAL: 0.10,
    WHT_RENT: 0.10,
    WHT_DIVIDEND: 0.10,
    PAYE_SIMPLIFIED: 0.15,
    CGT: 0.10
};

function calculateTaxImplications(
    nature: string,
    amount: number,
    isVatRegistered: boolean = true
): { outputVAT: number; inputVAT: number; wht: number; paye: number; cgt: number; isDisallowable: boolean } {
    const vatExclusiveAmount = amount / 1.075;
    const vatAmount = amount - vatExclusiveAmount;

    switch (nature) {
        case 'sale_of_goods':
        case 'sale_of_services':
            return {
                outputVAT: isVatRegistered ? Math.round(vatAmount * 100) / 100 : 0,
                inputVAT: 0,
                wht: nature === 'sale_of_services' ? Math.round(vatExclusiveAmount * TAX_RATES.WHT_PROFESSIONAL * 100) / 100 : 0,
                paye: 0,
                cgt: 0,
                isDisallowable: false
            };

        case 'purchase_goods':
            return {
                outputVAT: 0,
                inputVAT: isVatRegistered ? Math.round(vatAmount * 100) / 100 : 0,
                wht: 0,
                paye: 0,
                cgt: 0,
                isDisallowable: false
            };

        case 'purchase_services':
            return {
                outputVAT: 0,
                inputVAT: 0, // NOT claimable on professional services
                wht: Math.round(amount * TAX_RATES.WHT_PROFESSIONAL * 100) / 100,
                paye: 0,
                cgt: 0,
                isDisallowable: false
            };

        case 'payroll':
            return {
                outputVAT: 0,
                inputVAT: 0,
                wht: 0,
                paye: Math.round(amount * TAX_RATES.PAYE_SIMPLIFIED * 100) / 100,
                cgt: 0,
                isDisallowable: false
            };

        case 'entertainment':
            return {
                outputVAT: 0,
                inputVAT: 0, // NOT claimable
                wht: 0,
                paye: 0,
                cgt: 0,
                isDisallowable: true
            };

        case 'asset_sale':
            // CGT on full amount as estimate (actual gain calculation needs cost basis)
            return {
                outputVAT: 0, // Asset disposal NOT VATable
                inputVAT: 0,
                wht: 0,
                paye: 0,
                cgt: Math.round(amount * TAX_RATES.CGT * 100) / 100,
                isDisallowable: false
            };

        default:
            return {
                outputVAT: 0,
                inputVAT: 0,
                wht: 0,
                paye: 0,
                cgt: 0,
                isDisallowable: false
            };
    }
}

// ============================================================================
// INTEGRATED PROCESSOR
// ============================================================================

/**
 * Process a transaction through both layers
 */
export async function processTransaction(
    transactionText: string,
    amount?: number
): Promise<IntegratedTransactionResult> {
    const startTime = Date.now();
    const auditLog: string[] = [];

    auditLog.push(`[${new Date().toISOString()}] Processing: "${transactionText}"`);

    // ========================================================================
    // LAYER 1: SYSTEM LOGIC
    // ========================================================================
    auditLog.push('[Layer 1] Starting system logic analysis...');

    const layer1Result = analyzeTransactionText(transactionText, amount || 0);

    // Extract amount from text if not provided
    const extractedAmount = amount || layer1Result.amount;

    // Determine transaction nature
    // Create a mock journal entry for nature identification
    const mockEntry = {
        id: 'temp',
        date: new Date().toISOString(),
        narration: transactionText,
        lines: [
            { accountCode: layer1Result.debitAccount.code, accountName: layer1Result.debitAccount.name, debit: extractedAmount, credit: 0 },
            { accountCode: layer1Result.creditAccount.code, accountName: layer1Result.creditAccount.name, debit: 0, credit: extractedAmount }
        ],
        // Required JournalEntry fields
        isBalanced: true,
        totalDebits: extractedAmount,
        totalCredits: extractedAmount,
        transactionType: 'other' as const,
        status: 'posted' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const nature = identifyTransactionNature(mockEntry);
    auditLog.push(`[Layer 1] Nature identified: ${nature}`);
    auditLog.push(`[Layer 1] Accounts: DR ${layer1Result.debitAccount.code} ${layer1Result.debitAccount.name}, CR ${layer1Result.creditAccount.code} ${layer1Result.creditAccount.name}`);

    // Calculate tax implications based on nature
    const taxImplications = calculateTaxImplications(nature, extractedAmount);

    const layer1Final = {
        debitAccount: layer1Result.debitAccount,
        creditAccount: layer1Result.creditAccount,
        flow: layer1Result.flow,
        isCredit: layer1Result.isCredit,
        nature,
        confidence: Math.max(layer1Result.debitAccount.confidence, layer1Result.creditAccount.confidence)
    };

    auditLog.push(`[Layer 1] Confidence: ${(layer1Final.confidence * 100).toFixed(0)}%`);

    // ========================================================================
    // LAYER 2: AI VALIDATION
    // ========================================================================
    const validator = getAIValidator();
    let layer2Result: AIValidationResult | null = null;
    let aiCorrectionsMade = false;

    if (validator.isAIEnabled()) {
        auditLog.push('[Layer 2] AI validation enabled, sending to Gemini...');

        const systemInterpretation: SystemInterpretation = {
            transactionText,
            debitAccount: layer1Result.debitAccount,
            creditAccount: layer1Result.creditAccount,
            amount: extractedAmount,
            nature,
            taxImplications,
            isCredit: layer1Result.isCredit,
            confidence: layer1Final.confidence
        };

        layer2Result = await validateWithAI(systemInterpretation);

        aiCorrectionsMade = layer2Result.corrected;

        if (aiCorrectionsMade) {
            auditLog.push(`[Layer 2] AI made corrections!`);
            layer2Result.corrections.forEach(c => {
                auditLog.push(`  - ${c.field}: ${JSON.stringify(c.was)} → ${JSON.stringify(c.correctedTo)} (${c.reason})`);
            });
        } else {
            auditLog.push(`[Layer 2] AI validated - no corrections needed`);
        }

        auditLog.push(`[Layer 2] Confidence: ${(layer2Result.confidence * 100).toFixed(0)}%`);
        auditLog.push(`[Layer 2] Processing time: ${layer2Result.processingTimeMs}ms`);
    } else {
        auditLog.push('[Layer 2] AI validation disabled - using Layer 1 only');
    }

    // ========================================================================
    // FINAL RESULT
    // ========================================================================
    const totalTime = Date.now() - startTime;
    auditLog.push(`[Complete] Total processing time: ${totalTime}ms`);

    // Use Layer 2 result if available, otherwise Layer 1
    const finalInterpretation = layer2Result?.finalInterpretation || {
        transactionText,
        debitAccount: layer1Result.debitAccount,
        creditAccount: layer1Result.creditAccount,
        amount: extractedAmount,
        nature,
        taxImplications
    };

    return {
        transactionText,
        amount: extractedAmount,
        layer1: layer1Final,
        layer2: layer2Result,
        final: {
            debitAccount: finalInterpretation.debitAccount,
            creditAccount: finalInterpretation.creditAccount,
            amount: extractedAmount,
            nature: finalInterpretation.nature || nature,
            taxImplications: {
                outputVAT: finalInterpretation.taxImplications?.outputVAT || 0,
                inputVAT: finalInterpretation.taxImplications?.inputVAT || 0,
                wht: finalInterpretation.taxImplications?.wht || 0,
                paye: finalInterpretation.taxImplications?.paye || 0,
                cgt: finalInterpretation.taxImplications?.cgt || 0,
                isDisallowable: finalInterpretation.taxImplications?.isDisallowable || false
            },
            confidence: layer2Result?.confidence || layer1Final.confidence
        },
        aiCorrectionsMade,
        aiEnabled: validator.isAIEnabled(),
        processingTimeMs: totalTime,
        auditLog
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export values
export { AITransactionValidator, getAIValidator, validateWithAI };

// Re-export types (must use 'export type' for interfaces)
export type { SystemInterpretation, AIValidationResult };
