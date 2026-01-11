import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
    AI_TAX_AUDIT_SYSTEM_PROMPT,
    TaxAuditRequest,
    TaxAuditResponse,
    WHT_RATES,
    VAT_RATE,
} from '@/lib/tax/nigerianTaxCompliance';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/ai/audit-tax
 * 
 * AI-powered tax schedule auditing endpoint.
 * Analyzes tax computations for errors and provides corrected output.
 */
export async function POST(request: NextRequest) {
    try {
        const body: TaxAuditRequest = await request.json();

        // Validate request
        if (!body.transactions || !body.companyInfo) {
            return NextResponse.json(
                { error: 'Missing required fields: transactions and companyInfo' },
                { status: 400 }
            );
        }

        // Build context for AI
        const transactionContext = body.transactions.map((tx, i) =>
            `${i + 1}. ${tx.description} - ₦${tx.amount.toLocaleString()} (${tx.type}${tx.category ? `, ${tx.category}` : ''})`
        ).join('\n');

        const computedTaxesContext = body.computedTaxes
            ? `
Current Computed Taxes:
- CIT: ₦${(body.computedTaxes.cit || 0).toLocaleString()}
- VAT: ₦${(body.computedTaxes.vat || 0).toLocaleString()}
- WHT: ₦${(body.computedTaxes.wht || 0).toLocaleString()}
- PAYE: ₦${(body.computedTaxes.paye || 0).toLocaleString()}
- Education Tax: ₦${(body.computedTaxes.educationTax || 0).toLocaleString()}
`
            : 'No computed taxes provided.';

        const companyContext = `
Company Information:
- Turnover: ₦${body.companyInfo.turnover.toLocaleString()}
- VAT Registered: ${body.companyInfo.isVATRegistered ? 'Yes' : 'No'}
- Company Size: ${body.companyInfo.companySize}
`;

        const referenceRates = `
Reference Tax Rates (FIRS 2024):
- VAT Rate: ${VAT_RATE}%
- WHT Rates:
  * Professional Services: ${WHT_RATES.PROFESSIONAL_SERVICES}%
  * Contract/Supply: ${WHT_RATES.CONTRACT_SUPPLY}%
  * Rent: ${WHT_RATES.RENT}%
  * Dividends: ${WHT_RATES.DIVIDENDS}%
  * Commission: ${WHT_RATES.COMMISSION}%
`;

        const userMessage = `
${companyContext}

Transactions:
${transactionContext}

${computedTaxesContext}

${referenceRates}

Please audit this tax computation and provide corrections.
`;

        // Call OpenAI
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: AI_TAX_AUDIT_SYSTEM_PROMPT,
                },
                {
                    role: 'user',
                    content: userMessage,
                },
            ],
            temperature: 0.3, // Lower temperature for more consistent tax calculations
            response_format: { type: 'json_object' },
        });

        const responseContent = completion.choices[0]?.message?.content;

        if (!responseContent) {
            return NextResponse.json(
                { error: 'AI did not return a response' },
                { status: 500 }
            );
        }

        // Parse AI response
        let auditResult: TaxAuditResponse;
        try {
            auditResult = JSON.parse(responseContent);
        } catch {
            return NextResponse.json(
                {
                    error: 'Failed to parse AI response',
                    rawResponse: responseContent
                },
                { status: 500 }
            );
        }

        // Add metadata
        const response = {
            ...auditResult,
            metadata: {
                auditedAt: new Date().toISOString(),
                transactionCount: body.transactions.length,
                model: 'gpt-4o',
            },
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('[AI Tax Audit] Error:', error);

        // Handle specific errors
        if (error instanceof Error) {
            if (error.message.includes('API key')) {
                return NextResponse.json(
                    { error: 'OpenAI API key not configured' },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json(
            { error: 'Failed to perform tax audit' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/ai/audit-tax
 * 
 * Returns information about the audit endpoint
 */
export async function GET() {
    return NextResponse.json({
        endpoint: '/api/ai/audit-tax',
        method: 'POST',
        description: 'AI-powered Nigerian tax schedule auditing',
        features: [
            'Detects incorrect WHT rates and amounts',
            'Identifies missing VAT on taxable supplies',
            'Recalculates Input/Output VAT and Net VAT payable',
            'Ensures mathematical accuracy and legal compliance',
            'Provides corrected tax summary with explanations'
        ],
        requestBody: {
            transactions: 'Array of transactions with description, amount, type, category',
            computedTaxes: 'Object with current computed taxes (cit, vat, wht, paye, educationTax)',
            companyInfo: 'Object with turnover, isVATRegistered, companySize'
        },
        responseFormat: {
            errors: 'Array of detected errors with corrections',
            correctedSummary: 'Corrected tax computation summary',
            explanations: 'List of corrections made',
            isCompliant: 'Whether the original computation was compliant'
        }
    });
}
