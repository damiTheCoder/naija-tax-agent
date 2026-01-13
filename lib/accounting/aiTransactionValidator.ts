/**
 * AI Transaction Validator (Layer 2)
 * 
 * Uses Google Gemini API to validate and correct transaction interpretations
 * from the system logic (Layer 1).
 * 
 * This provides a second layer of verification to ensure:
 * 1. Correct accounting logic (debit/credit accounts)
 * 2. Correct tax treatment (VAT, WHT, PAYE, CGT per FIRS rules)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { CHART_OF_ACCOUNTS } from './doubleEntry';

// ============================================================================
// TYPES
// ============================================================================

export interface SystemInterpretation {
    transactionText: string;
    debitAccount: { code: string; name: string };
    creditAccount: { code: string; name: string };
    amount: number;
    nature: string;
    taxImplications: {
        outputVAT?: number;
        inputVAT?: number;
        wht?: number;
        paye?: number;
        cgt?: number;
        isDisallowable?: boolean;
    };
    isCredit?: boolean;
    confidence?: number;
}

export interface AIValidationResult {
    validated: boolean;
    corrected: boolean;
    corrections: Array<{
        field: string;
        was: unknown;
        correctedTo: unknown;
        reason: string;
    }>;
    finalInterpretation: SystemInterpretation;
    confidence: number;
    reasoning: string;
    processingTimeMs: number;
}

// ============================================================================
// NIGERIAN TAX RULES PROMPT - COMPREHENSIVE TAX RATES 2024
// ============================================================================

const NIGERIAN_TAX_RULES_PROMPT = `
You are a Nigerian Chartered Accountant (ACA/FCA) and Tax Expert with deep knowledge of FIRS regulations (Finance Acts 2019-2023).

## YOUR TASK
Review the transaction interpretation below and validate BOTH:
1. **ACCOUNTING LOGIC**: Are the debit and credit accounts correct?
2. **TAX CALCULATION**: Are the tax amounts correctly calculated using the rates below?

If the system's tax calculation is WRONG, you MUST correct it with the proper amount.

## NIGERIAN TAX RATES (2024 - FIRS COMPLIANT)

### 1. VAT (Value Added Tax) - FIRS Standard
- **Rate**: 7.5% (increased from 5% per Finance Act 2019)
- **Calculation**: VAT = (Amount / 1.075) × 0.075 for VAT-inclusive, or Amount × 0.075 for VAT-exclusive
- **OUTPUT VAT**: On sales - we charge customer, remit to FIRS monthly
- **INPUT VAT**: On purchases of GOODS - claimable against output VAT
- **VAT NOT CLAIMABLE on**:
  - Professional/consulting services
  - Entertainment expenses
  - Capital assets/fixed assets
  - Asset disposals (capital transaction)
- **Example**: Sale of ₦107,500 inclusive = VAT ₦7,500, Revenue ₦100,000

### 2. WHT (Withholding Tax) - FIRS Rates
| Transaction Type | Corporate Rate | Individual Rate |
|------------------|----------------|-----------------|
| Dividends | 10% | 10% |
| Interest | 10% | 10% |
| Rent | 10% | 10% |
| Royalties | 10% | 10% |
| Professional fees (legal, audit, consulting) | 10% | 5% |
| Technical/management fees | 10% | 5% |
| Construction/building | 2.5% | 2.5% |
| Contracts (supply of goods) | 5% | 5% |
| Directors fees | - | 10% |

- **Calculation**: WHT = Gross Amount × Rate
- **WHO PAYS**: The PAYER withholds and remits to FIRS
- **Due date**: 21st of following month
- **Example**: Audit fee ₦500,000 to company = WHT ₦50,000 (10%)

### 3. PAYE (Pay As You Earn) - Personal Income Tax
**Graduated Tax Rates (after CRA deduction):**
| Taxable Income Band | Rate |
|---------------------|------|
| First ₦300,000 | 7% |
| Next ₦300,000 (₦300,001 - ₦600,000) | 11% |
| Next ₦500,000 (₦600,001 - ₦1,100,000) | 15% |
| Next ₦500,000 (₦1,100,001 - ₦1,600,000) | 19% |
| Next ₦1,600,000 (₦1,600,001 - ₦3,200,000) | 21% |
| Above ₦3,200,000 | 24% |

**Consolidated Relief Allowance (CRA):**
- CRA = Higher of (₦200,000 OR 1% of Gross Income) + 20% of Gross Income
- Taxable Income = Gross Income - CRA - Other Reliefs

**Simplified Effective Rate**: For quick estimation, use 15% average rate on gross salary

### 4. CGT (Capital Gains Tax)
- **Rate**: 10% on GAIN only
- **GAIN Calculation**: Proceeds - Cost (or Net Book Value for depreciated assets)
- **Net Book Value** = Original Cost - Accumulated Depreciation
- **APPLIES TO**: Land, buildings, shares, stocks, machinery, equipment, patents
- **NOT SUBJECT TO VAT** - Capital disposals exempt from VAT
- **Example**: 
  - Sold asset for ₦300,000
  - Original cost ₦400,000, Accumulated Depreciation ₦120,930
  - NBV = ₦400,000 - ₦120,930 = ₦279,070
  - GAIN = ₦300,000 - ₦279,070 = ₦20,930
  - CGT = ₦20,930 × 10% = ₦2,093

### 5. CIT (Company Income Tax)
| Company Size | Turnover | Tax Rate |
|--------------|----------|----------|
| Small | ≤ ₦25,000,000 | 0% (Exempt) |
| Medium | ₦25M - ₦100M | 20% |
| Large | > ₦100,000,000 | 30% |

- **Tertiary Education Tax (TET)**: 2.5% of assessable profit (separate from CIT)
- **Nigeria Police Trust Fund Levy**: 0.005% of net profit

### 6. Stamp Duty
- **Receipts**: ₦50 for amounts ≤ ₦1,000, else ₦100
- **Bank transfers (electronic)**: 0.5% on ₦10,000+ (capped at ₦100,000)

### 7. Disallowable Expenses (CIT Computation)
These expenses are NOT deductible for tax purposes:
- Entertainment expenses
- Personal expenses of directors/shareholders
- Fines and penalties
- Donations to non-approved bodies
- Capital expenditure (depreciation allowed instead)
- Provisions for bad debts (specific bad debts allowed)

## DOUBLE-ENTRY ACCOUNTING RULES

### Sales
- **Cash sale**: DR Bank, CR Sales, CR Output VAT (if applicable)
- **Credit sale**: DR Accounts Receivable, CR Sales, CR Output VAT

### Purchases
- **Cash purchase of goods**: DR Purchases, CR Bank, DR Input VAT (if claimable)
- **Credit purchase**: DR Purchases, CR Accounts Payable
- **Professional services**: DR Professional Fees, CR Bank/Payable, CR WHT Payable

### Asset Disposal
- DR Bank (proceeds received)
- DR Accumulated Depreciation
- CR Fixed Asset (original cost)
- DR/CR Loss/Gain on Disposal

## RESPONSE FORMAT
You MUST respond with valid JSON only, no markdown:

{
  "validated": true/false,
  "corrected": true/false,
  "corrections": [
    {
      "field": "debitAccount|creditAccount|nature|taxImplications.outputVAT|taxImplications.wht|etc",
      "was": original_value,
      "correctedTo": correct_value,
      "reason": "explanation with calculation"
    }
  ],
  "finalInterpretation": {
    "transactionText": "original text",
    "debitAccount": { "code": "XXXX", "name": "Account Name" },
    "creditAccount": { "code": "XXXX", "name": "Account Name" },
    "amount": number,
    "nature": "sale_of_goods|sale_of_services|purchase_goods|purchase_services|payroll|asset_sale|entertainment|capital_injection|other",
    "taxImplications": {
      "outputVAT": number (calculate: amount/1.075 × 0.075 for sales),
      "inputVAT": number (only for goods purchases, NOT services),
      "wht": number (use rates table above),
      "paye": number (use graduated rates or 15% estimate),
      "cgt": number (10% on GAIN only, not proceeds),
      "isDisallowable": true/false (entertainment, personal expenses)
    }
  },
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation including any calculations performed"
}
`;

// ============================================================================
// CHART OF ACCOUNTS SUMMARY (for AI context)
// ============================================================================

function getChartOfAccountsSummary(): string {
    const summary = CHART_OF_ACCOUNTS.map(acc =>
        `${acc.code}: ${acc.name} (${acc.type}, normal balance: ${acc.normalBalance})`
    ).join('\n');
    return summary;
}

// ============================================================================
// AI VALIDATOR CLASS
// ============================================================================

export class AITransactionValidator {
    private genAI: GoogleGenerativeAI | null = null;
    private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null;
    private isEnabled: boolean = true;

    constructor() {
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        const enabled = process.env.ENABLE_AI_VALIDATION !== 'false';

        if (apiKey && apiKey !== 'your_api_key_here' && enabled) {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            this.isEnabled = true;
            console.log('[AI Validator] Initialized with Gemini API');
        } else {
            this.isEnabled = false;
            console.log('[AI Validator] Disabled - No valid API key or disabled in config');
        }
    }

    /**
     * Check if AI validation is enabled
     */
    isAIEnabled(): boolean {
        return this.isEnabled && this.model !== null;
    }

    /**
     * Validate a transaction interpretation using AI
     */
    async validateTransaction(
        systemInterpretation: SystemInterpretation
    ): Promise<AIValidationResult> {
        const startTime = Date.now();

        // If AI is disabled, return the system interpretation as-is
        if (!this.isAIEnabled()) {
            return {
                validated: true,
                corrected: false,
                corrections: [],
                finalInterpretation: systemInterpretation,
                confidence: systemInterpretation.confidence || 0.7,
                reasoning: 'AI validation disabled - using system logic only',
                processingTimeMs: Date.now() - startTime
            };
        }

        try {
            // Build the prompt
            const prompt = this.buildPrompt(systemInterpretation);

            // Call Gemini API
            const result = await this.model!.generateContent(prompt);
            const response = await result.response;
            const text = response?.text?.() || '';

            // Check if we got a valid response
            if (!text || text.trim().length === 0) {
                throw new Error('Empty response from AI');
            }

            // Parse the JSON response
            const aiResult = this.parseAIResponse(text, systemInterpretation);
            aiResult.processingTimeMs = Date.now() - startTime;

            return aiResult;
        } catch (error) {
            console.error('[AI Validator] Error:', error);

            // On error, return system interpretation with warning
            return {
                validated: true,
                corrected: false,
                corrections: [],
                finalInterpretation: systemInterpretation,
                confidence: systemInterpretation.confidence || 0.5,
                reasoning: `AI validation failed: ${error instanceof Error ? error.message : 'Unknown error'}. Using system logic.`,
                processingTimeMs: Date.now() - startTime
            };
        }
    }

    /**
     * Build the prompt for Gemini
     */
    private buildPrompt(interpretation: SystemInterpretation): string {
        const chartSummary = getChartOfAccountsSummary();

        return `${NIGERIAN_TAX_RULES_PROMPT}

## CHART OF ACCOUNTS
${chartSummary}

## TRANSACTION TO VALIDATE

Transaction Text: "${interpretation.transactionText}"

System's Interpretation:
- Debit Account: ${interpretation.debitAccount.code} - ${interpretation.debitAccount.name}
- Credit Account: ${interpretation.creditAccount.code} - ${interpretation.creditAccount.name}
- Amount: ₦${interpretation.amount.toLocaleString()}
- Transaction Nature: ${interpretation.nature}
- Is Credit Transaction: ${interpretation.isCredit || false}
- Tax Implications:
  * Output VAT: ₦${interpretation.taxImplications.outputVAT || 0}
  * Input VAT: ₦${interpretation.taxImplications.inputVAT || 0}
  * WHT: ₦${interpretation.taxImplications.wht || 0}
  * PAYE: ₦${interpretation.taxImplications.paye || 0}
  * CGT: ₦${interpretation.taxImplications.cgt || 0}
  * Disallowable: ${interpretation.taxImplications.isDisallowable || false}

Please validate this interpretation and correct any errors. Respond with JSON only.`;
    }

    /**
     * Parse the AI response JSON
     */
    private parseAIResponse(
        text: string,
        fallback: SystemInterpretation
    ): AIValidationResult {
        try {
            // Try to extract JSON from the response
            let jsonStr = text.trim();

            // Remove markdown code blocks if present
            if (jsonStr.startsWith('```json')) {
                jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            } else if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
            }

            const parsed = JSON.parse(jsonStr);

            // Validate the response structure
            if (!parsed.finalInterpretation) {
                throw new Error('Missing finalInterpretation in AI response');
            }

            return {
                validated: parsed.validated ?? true,
                corrected: parsed.corrected ?? false,
                corrections: parsed.corrections ?? [],
                finalInterpretation: {
                    ...fallback,
                    ...parsed.finalInterpretation,
                    transactionText: fallback.transactionText // Keep original
                },
                confidence: parsed.confidence ?? 0.8,
                reasoning: parsed.reasoning ?? 'AI validation complete',
                processingTimeMs: 0 // Will be set by caller
            };
        } catch (parseError) {
            console.error('[AI Validator] Failed to parse response:', parseError);
            console.error('[AI Validator] Raw response:', text);

            return {
                validated: true,
                corrected: false,
                corrections: [],
                finalInterpretation: fallback,
                confidence: 0.5,
                reasoning: 'Failed to parse AI response - using system logic',
                processingTimeMs: 0
            };
        }
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let validatorInstance: AITransactionValidator | null = null;

export function getAIValidator(): AITransactionValidator {
    if (!validatorInstance) {
        validatorInstance = new AITransactionValidator();
    }
    return validatorInstance;
}

// ============================================================================
// CONVENIENCE FUNCTION
// ============================================================================

/**
 * Validate a transaction using the 2-layer system
 * Layer 1: System logic (already applied)
 * Layer 2: AI verification (this function)
 */
export async function validateWithAI(
    systemInterpretation: SystemInterpretation
): Promise<AIValidationResult> {
    const validator = getAIValidator();
    return validator.validateTransaction(systemInterpretation);
}
