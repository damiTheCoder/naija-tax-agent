/**
 * AI Transaction Validation API Route
 * 
 * POST /api/accounting/validate-transaction
 * 
 * Accepts a transaction description and returns AI-validated interpretation.
 * Uses 2-layer validation: Layer 1 (system logic) + Layer 2 (Gemini AI)
 */

import { NextRequest, NextResponse } from 'next/server';
import { processTransaction } from '@/lib/accounting/integratedTransactionProcessor';
import { parseTransactionFromChat } from '@/lib/accounting/transactionBridge';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { transactionText, amount } = body;

        if (!transactionText || typeof transactionText !== 'string') {
            return NextResponse.json(
                { error: 'Missing or invalid transactionText' },
                { status: 400 }
            );
        }

        // Run the 2-layer integrated processor
        const result = await processTransaction(transactionText, amount);
        const ruleParsed = parseTransactionFromChat(transactionText);

        if (!result || result.amount <= 0) {
            return NextResponse.json(
                { error: 'Could not parse transaction', result: null },
                { status: 200 }
            );
        }

        // Map nature to parsedType for backwards compatibility
        const natureToTypeMap: Record<string, string> = {
            'sale_of_goods': 'sale',
            'sale_of_services': 'sale',
            'purchase_goods': 'purchase',
            'purchase_services': 'expense',
            'payroll': 'expense',
            'entertainment': 'expense',
            'capital_injection': 'equity',
            'capital_expenditure': 'asset',
            'asset_sale': 'sale',
            'interest_income': 'receipt',
            'dividend_income': 'receipt',
            'rent_income': 'receipt',
            'other': 'other'
        };

        // Map nature to category
        const natureToCategoryMap: Record<string, string> = {
            'sale_of_goods': 'sales',
            'sale_of_services': 'service',
            'purchase_goods': 'purchases',
            'purchase_services': 'expense',
            'payroll': 'salary',
            'entertainment': 'expense',
            'capital_injection': 'capital',
            'capital_expenditure': 'asset',
            'asset_sale': 'sales',
            'interest_income': 'receipt',
            'dividend_income': 'receipt',
            'rent_income': 'rent',
            'other': 'other'
        };

        return NextResponse.json({
            success: true,
            result: {
                // Core transaction data
                amount: result.amount,
                description: result.transactionText,
                // Prefer the dedicated transaction parser for user-facing type/category labels.
                category: ruleParsed?.category || natureToCategoryMap[result.final.nature] || 'other',
                parsedType: ruleParsed?.parsedType || natureToTypeMap[result.final.nature] || 'other',

                // Account information
                debitAccount: result.final.debitAccount,
                creditAccount: result.final.creditAccount,

                // AI validation info
                aiEnabled: result.aiEnabled,
                aiProvider: process.env.AI_VALIDATION_PROVIDER || 'gemini',
                aiValidated: result.layer2?.validated ?? false,
                aiCorrected: result.aiCorrectionsMade,
                confidence: result.final.confidence,
                aiReasoning: result.layer2?.reasoning ?? (result.aiEnabled ? 'AI validation attempted without explicit reasoning' : 'AI validation not performed'),

                // Tax implications
                taxImplications: result.final.taxImplications,

                // Metadata
                processingTimeMs: result.processingTimeMs,
                auditLog: result.auditLog
            }
        });
    } catch (error) {
        console.error('[API] Error validating transaction:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
