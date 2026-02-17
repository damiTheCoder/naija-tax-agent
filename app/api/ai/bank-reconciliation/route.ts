import { NextRequest, NextResponse } from 'next/server';
import {
    ReconciliationResult,
    DiscrepancyItem,
    MatchedPair,
} from '@/lib/accounting/bankReconciliation';

/**
 * AI System Prompt for Bank Reconciliation Analysis
 */
const BANK_RECONCILIATION_SYSTEM_PROMPT = `You are an expert Nigerian bank reconciliation auditor. Your role is to analyze bank reconciliation data and provide intelligent insights, corrections, and recommendations.

CONTEXT:
- You are analyzing reconciliation between bank statements and internal ledger/journal entries
- All amounts are in Nigerian Naira (₦)
- Common discrepancy types include: timing differences, recording errors, omissions, and fraud indicators

YOUR RESPONSIBILITIES:
1. Analyze the provided reconciliation data
2. Identify potential issues not caught by automated matching
3. Provide specific recommendations for resolving discrepancies
4. Flag any suspicious patterns that may indicate errors or fraud
5. Suggest journal entries to correct identified issues
6. Provide an overall assessment of the reconciliation status

OUTPUT FORMAT (JSON):
  "conversationalResponse": "A professional and friendly preamble explaining the findings in natural language before the structured data. Talk to the user as a helpful auditor.",
  "overallAssessment": "balanced|needs_attention|critical_issues",
  "confidence": 0.0-1.0,
  "summary": "Brief overall summary of findings",
  "insights": [
    {
      "type": "timing_difference|recording_error|potential_fraud|omission|duplicate|other",
      "severity": "low|medium|high",
      "description": "Detailed description",
      "affectedTransactions": ["transaction IDs"],
      "recommendation": "Specific action to take",
      "suggestedEntry": {
        "debit": { "account": "Account Name", "amount": 0 },
        "credit": { "account": "Account Name", "amount": 0 }
      }
    }
  ],
  "recommendations": [
    "Priority-ordered list of actions to take"
  ],
  "flaggedPatterns": [
    {
      "pattern": "Description of suspicious pattern",
      "riskLevel": "low|medium|high",
      "recommendation": "Action to investigate"
    }
  ]
}

IMPORTANT GUIDELINES:
- Be specific and actionable in your recommendations
- **TONE**: Maintain a professional yet friendly and helpful tone in your "conversationalResponse". Imagine you are presenting this to a business owner who values both accuracy and clear communication.
- Consider Nigerian banking practices and common issues
- Account for bank processing delays (typically 1-3 business days)
- Flag round-number transactions over ₦500,000 for extra scrutiny
- Consider month-end timing differences for cheques and transfers`;

interface AIReconciliationRequest {
    reconciliationResult: ReconciliationResult;
    additionalContext?: string;
}

interface AIInsight {
    type: 'timing_difference' | 'recording_error' | 'potential_fraud' | 'omission' | 'duplicate' | 'other';
    severity: 'low' | 'medium' | 'high';
    description: string;
    affectedTransactions: string[];
    recommendation: string;
    suggestedEntry?: {
        debit: { account: string; amount: number };
        credit: { account: string; amount: number };
    };
}

interface AIReconciliationResponse {
    conversationalResponse: string;
    overallAssessment: 'balanced' | 'needs_attention' | 'critical_issues';
    confidence: number;
    summary: string;
    insights: AIInsight[];
    recommendations: string[];
    flaggedPatterns: {
        pattern: string;
        riskLevel: 'low' | 'medium' | 'high';
        recommendation: string;
    }[];
    metadata?: {
        analyzedAt: string;
        model: string;
    };
}

/**
 * POST /api/ai/bank-reconciliation
 * 
 * AI-powered bank reconciliation analysis endpoint.
 * Analyzes reconciliation results and provides intelligent insights.
 */
export async function POST(request: NextRequest) {
    try {
        const body: AIReconciliationRequest = await request.json();

        if (!body.reconciliationResult) {
            return NextResponse.json(
                { error: 'Missing required field: reconciliationResult' },
                { status: 400 }
            );
        }

        const { reconciliationResult } = body;

        // Build context for AI analysis
        const matchedContext = reconciliationResult.matchedPairs.slice(0, 20).map((pair: MatchedPair, i: number) =>
            `${i + 1}. Bank: ₦${Math.abs(pair.bankTransaction.amount).toLocaleString()} "${pair.bankTransaction.description}" | Ledger: ₦${Math.abs(pair.ledgerTransaction.amount).toLocaleString()} "${pair.ledgerTransaction.narration}" (Confidence: ${(pair.confidence * 100).toFixed(0)}%)`
        ).join('\n');

        const unmatchedBankContext = reconciliationResult.unmatchedBankTransactions.slice(0, 15).map((tx, i) =>
            `${i + 1}. ${tx.date} | ₦${Math.abs(tx.amount).toLocaleString()} | "${tx.description}" ${tx.reference ? `(Ref: ${tx.reference})` : ''}`
        ).join('\n');

        const unmatchedLedgerContext = reconciliationResult.unmatchedLedgerTransactions.slice(0, 15).map((tx, i) =>
            `${i + 1}. ${tx.date} | DR: ₦${tx.debit.toLocaleString()} CR: ₦${tx.credit.toLocaleString()} | "${tx.narration}"`
        ).join('\n');

        const discrepancyContext = reconciliationResult.discrepancies.slice(0, 15).map((d: DiscrepancyItem, i: number) =>
            `${i + 1}. [${d.type.toUpperCase()}] ${d.description} (Severity: ${d.severity})`
        ).join('\n');

        const summaryContext = `
RECONCILIATION SUMMARY:
- Reconciliation Date: ${reconciliationResult.reconciliationDate}
- Period: ${reconciliationResult.bankStatementPeriod.start} to ${reconciliationResult.bankStatementPeriod.end}
- Bank Transactions: ${reconciliationResult.totalBankTransactions}
- Ledger Transactions: ${reconciliationResult.totalLedgerTransactions}
- Matched: ${reconciliationResult.summary.matchedCount}
- Unmatched Bank: ${reconciliationResult.summary.unmatchedBankCount}
- Unmatched Ledger: ${reconciliationResult.summary.unmatchedLedgerCount}
- Total Discrepancies: ${reconciliationResult.summary.discrepancyCount}
- Balance Difference: ₦${Math.abs(reconciliationResult.summary.balanceDifference).toLocaleString()}
- Status: ${reconciliationResult.summary.reconciliationStatus}
`;

        const userMessage = `
${summaryContext}

MATCHED TRANSACTIONS (Sample of ${reconciliationResult.matchedPairs.length}):
${matchedContext || 'No matched transactions.'}

UNMATCHED BANK TRANSACTIONS:
${unmatchedBankContext || 'None'}

UNMATCHED LEDGER TRANSACTIONS:
${unmatchedLedgerContext || 'None'}

DETECTED DISCREPANCIES:
${discrepancyContext || 'None'}

${body.additionalContext ? `ADDITIONAL CONTEXT:\n${body.additionalContext}` : ''}

Please analyze this bank reconciliation and provide detailed insights and recommendations.
`;

        // Initialize Gemini
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY || "";
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

        // Call Gemini
        const result = await model.generateContent({
            contents: [
                { role: 'user', parts: [{ text: BANK_RECONCILIATION_SYSTEM_PROMPT + "\n\n" + userMessage }] }
            ],
            generationConfig: {
                temperature: 0.3,
                responseMimeType: 'application/json',
            }
        });

        const responseContent = result.response.text();

        if (!responseContent) {
            return NextResponse.json(
                { error: 'AI did not return a response' },
                { status: 500 }
            );
        }

        // Parse AI response
        let aiResult: AIReconciliationResponse;
        try {
            aiResult = JSON.parse(responseContent);
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
        const response: AIReconciliationResponse = {
            ...aiResult,
            metadata: {
                analyzedAt: new Date().toISOString(),
                model: 'gemini-1.5-flash',
            },
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('[AI Bank Reconciliation] Error:', error);

        if (error instanceof Error) {
            if (error.message.includes('API key')) {
                return NextResponse.json(
                    { error: 'OpenAI API key not configured' },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json(
            { error: 'Failed to perform AI reconciliation analysis' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/ai/bank-reconciliation
 * 
 * Returns information about the endpoint
 */
export async function GET() {
    return NextResponse.json({
        endpoint: '/api/ai/bank-reconciliation',
        method: 'POST',
        description: 'AI-powered bank reconciliation analysis',
        features: [
            'Analyzes matched and unmatched transactions',
            'Identifies timing differences and recording errors',
            'Flags potential fraud indicators',
            'Provides specific correction recommendations',
            'Suggests journal entries to resolve discrepancies',
        ],
        requestBody: {
            reconciliationResult: 'The full ReconciliationResult object from performReconciliation()',
            additionalContext: 'Optional additional context for the AI',
        },
        responseFormat: {
            overallAssessment: 'balanced | needs_attention | critical_issues',
            confidence: 'Confidence score 0-1',
            summary: 'Brief summary of findings',
            insights: 'Array of specific insights with recommendations',
            recommendations: 'Priority-ordered action items',
            flaggedPatterns: 'Suspicious patterns detected',
        },
    });
}
