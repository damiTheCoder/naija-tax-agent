/**
 * AI Transaction Validator (Layer 2)
 * 
 * ============================================================================
 * CLAWDBOT INTEGRATION (Replaces Google Gemini)
 * ============================================================================
 * 
 * Uses Clawdbot AI to validate and correct transaction interpretations
 * from the system logic (Layer 1).
 * 
 * This provides a second layer of verification to ensure:
 * 1. Correct accounting logic (debit/credit accounts)
 * 2. Correct tax treatment (VAT, WHT, PAYE, CGT per FIRS rules)
 */

import { CHART_OF_ACCOUNTS, getAccount, getAccountByName } from './doubleEntry';

// ============================================================================
// CONFIGURATION
// ============================================================================

// AI Provider: 'clawdbot' or 'gemini' (for backward compatibility)
const AI_PROVIDER = process.env.AI_VALIDATION_PROVIDER || 'gemini';
const CLAWDBOT_API_URL = process.env.CLAWDBOT_API_URL || 'http://localhost:8080';
const CLAWDBOT_API_KEY = process.env.CLAWDBOT_API_KEY || '';
const VALIDATION_RETRY_LIMIT = 2;
const VALIDATION_RETRY_DELAY_MS = 300;
const DEFAULT_DEBIT_ACCOUNT = { code: "5010", name: "Purchases" };
const DEFAULT_CREDIT_ACCOUNT = { code: "1020", name: "Bank" };

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
// NIGERIAN TAX RULES PROMPT
// ============================================================================

const NIGERIAN_TAX_RULES_PROMPT = `
You are a Nigerian Chartered Accountant (ACA/FCA) and Tax Expert with deep knowledge of FIRS regulations.

## YOUR TASK
Review the transaction interpretation and validate BOTH:
1. **ACCOUNTING LOGIC**: Are the debit and credit accounts correct?
2. **TAX CALCULATION**: Are the tax amounts correctly calculated?

## NIGERIAN TAX RATES (2024 - FIRS COMPLIANT)

### VAT: 7.5%
- Calculation: VAT = Amount × 0.075 (or Amount / 1.075 × 0.075 if inclusive)
- OUTPUT VAT: On sales
- INPUT VAT: On purchases of GOODS only (not services)

### WHT Rates:
| Type | Corporate | Individual |
|------|-----------|------------|
| Dividends/Interest/Rent/Royalties | 10% | 10% |
| Professional fees | 10% | 5% |
| Construction | 2.5% | 2.5% |
| Supply contracts | 5% | 5% |

### CGT: 10% on GAIN (Proceeds - Cost)

### CIT:
| Size | Turnover | Rate |
|------|----------|------|
| Small | ≤₦25M | 0% |
| Medium | ₦25M-100M | 20% |
| Large | >₦100M | 30% |

## RESPONSE FORMAT (JSON only):
{
  "validated": true/false,
  "corrected": true/false,
  "corrections": [{ "field": "...", "was": ..., "correctedTo": ..., "reason": "..." }],
  "finalInterpretation": { ... full interpretation object ... },
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}
`;

// ============================================================================
// CHART OF ACCOUNTS SUMMARY
// ============================================================================

function getChartOfAccountsSummary(): string {
    const summary = CHART_OF_ACCOUNTS.map(acc =>
        `${acc.code}: ${acc.name} (${acc.type})`
    ).join('\n');
    return summary;
}

function ensureChartAccount(
    account: { code?: string; name?: string } | undefined,
    fallback: { code: string; name: string }
): { code: string; name: string } {
    if (account) {
        const chartAccount =
            (account.code && getAccount(account.code)) ||
            (account.name && getAccountByName(account.name));
        if (chartAccount) {
            return { code: chartAccount.code, name: chartAccount.name };
        }
    }
    return fallback;
}

// ============================================================================
// CLAWDBOT AI VALIDATOR CLASS
// ============================================================================

export class AITransactionValidator {
    private isEnabled: boolean = true;
    private provider: string = AI_PROVIDER;

    constructor() {
        const enabled = process.env.ENABLE_AI_VALIDATION !== 'false';

        if (enabled && this.provider === 'clawdbot') {
            this.isEnabled = true;
            console.log('[AI Validator] Initialized with Clawdbot');
        } else if (enabled && this.provider === 'gemini') {
            // Legacy Gemini support - check for API key
            const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
            this.isEnabled = !!apiKey && apiKey !== 'your_api_key_here';
            console.log(`[AI Validator] Gemini mode - ${this.isEnabled ? 'enabled' : 'disabled'}`);
        } else {
            this.isEnabled = false;
            console.log('[AI Validator] Disabled by configuration');
        }
    }

    /**
     * Check if AI validation is enabled
     */
    isAIEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Validate a transaction interpretation using Clawdbot AI
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

        let lastError: unknown = null;
        for (let attempt = 1; attempt <= VALIDATION_RETRY_LIMIT; attempt++) {
            try {
                if (this.provider === 'clawdbot') {
                    return await this.validateWithClawdbot(systemInterpretation, startTime);
                } else {
                    return await this.validateWithGemini(systemInterpretation, startTime);
                }
            } catch (error) {
                lastError = error;
                console.error(`[AI Validator] Attempt ${attempt} failed:`, error);
                if (attempt < VALIDATION_RETRY_LIMIT) {
                    await sleep(VALIDATION_RETRY_DELAY_MS * attempt);
                }
            }
        }

        // On repeated failure, return system interpretation with warning
        return {
            validated: true,
            corrected: false,
            corrections: [],
            finalInterpretation: systemInterpretation,
            confidence: systemInterpretation.confidence || 0.5,
            reasoning: `AI validation failed after retries: ${lastError instanceof Error ? lastError.message : 'Unknown error'}. Using system logic.`,
            processingTimeMs: Date.now() - startTime
        };
    }

    /**
     * Validate using Clawdbot API
     */
    private async validateWithClawdbot(
        interpretation: SystemInterpretation,
        startTime: number
    ): Promise<AIValidationResult> {
        const prompt = this.buildPrompt(interpretation);

        const response = await fetch(`${CLAWDBOT_API_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(CLAWDBOT_API_KEY && { Authorization: `Bearer ${CLAWDBOT_API_KEY}` }),
            },
            body: JSON.stringify({
                message: prompt,
                user_id: 'ai_validator',
                context: {
                    module: 'accounting_validation',
                    expect_json: true,
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`Clawdbot API error: ${response.status}`);
        }

        const data = await response.json();
        const text = data.reply || '';

        if (!text || text.trim().length === 0) {
            throw new Error('Empty response from Clawdbot');
        }

        const aiResult = this.parseAIResponse(text, interpretation);
        aiResult.processingTimeMs = Date.now() - startTime;

        return aiResult;
    }

    /**
     * Validate using Gemini API (legacy support)
     */
    private async validateWithGemini(
        interpretation: SystemInterpretation,
        startTime: number
    ): Promise<AIValidationResult> {
        // Dynamic import for Gemini (only if needed)
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY!;
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = this.buildPrompt(interpretation);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response?.text?.() || '';

        if (!text || text.trim().length === 0) {
            throw new Error('Empty response from Gemini');
        }

        const aiResult = this.parseAIResponse(text, interpretation);
        aiResult.processingTimeMs = Date.now() - startTime;

        return aiResult;
    }

    /**
     * Build the prompt for AI validation
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
- Nature: ${interpretation.nature}
- Tax Implications:
  * Output VAT: ₦${interpretation.taxImplications.outputVAT || 0}
  * Input VAT: ₦${interpretation.taxImplications.inputVAT || 0}
  * WHT: ₦${interpretation.taxImplications.wht || 0}
  * PAYE: ₦${interpretation.taxImplications.paye || 0}
  * CGT: ₦${interpretation.taxImplications.cgt || 0}
  * Disallowable: ${interpretation.taxImplications.isDisallowable || false}

Validate this interpretation and correct any errors. Respond with JSON only.`;
    }

    /**
     * Parse the AI response JSON
     */
    private parseAIResponse(
        text: string,
        fallback: SystemInterpretation
    ): AIValidationResult {
        try {
            let jsonStr = text.trim();

            // Remove markdown code blocks if present
            if (jsonStr.startsWith('```json')) {
                jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            } else if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
            }

            const parsed = JSON.parse(jsonStr);

            // Start with fallback interpretation
            let finalInterpretation = { ...fallback };

            // Apply finalInterpretation from AI if provided
            if (parsed.finalInterpretation) {
                finalInterpretation = {
                    ...fallback,
                    ...parsed.finalInterpretation,
                    transactionText: fallback.transactionText
                };
            }

            // CRITICAL: Apply corrections from the corrections array
            // This ensures AI corrections are actually used even if finalInterpretation is incomplete
            const corrections = parsed.corrections || [];
            for (const correction of corrections) {
                const field = correction.field?.toLowerCase() || '';
                const correctedTo = correction.correctedTo;

                // Handle debit account correction
                if (field.includes('debit') && correctedTo) {
                    const match = String(correctedTo).match(/(\d{4})\s*[-–]\s*(.+)/);
                    if (match) {
                        finalInterpretation.debitAccount = {
                            code: match[1],
                            name: match[2].trim()
                        };
                    }
                }

                // Handle credit account correction
                if (field.includes('credit') && correctedTo) {
                    const match = String(correctedTo).match(/(\d{4})\s*[-–]\s*(.+)/);
                    if (match) {
                        finalInterpretation.creditAccount = {
                            code: match[1],
                            name: match[2].trim()
                        };
                    }
                }

                // Handle nature correction
                if (field.includes('nature') && correctedTo) {
                    finalInterpretation.nature = String(correctedTo);
                }

                // Handle tax implications corrections
                if (field.toLowerCase().includes('output vat') && correctedTo !== undefined) {
                    const vatValue = parseFloat(String(correctedTo).replace(/[^0-9.-]/g, '')) || 0;
                    finalInterpretation.taxImplications = {
                        ...finalInterpretation.taxImplications,
                        outputVAT: vatValue
                    };
                }
            }

            finalInterpretation = {
                ...finalInterpretation,
                debitAccount: ensureChartAccount(finalInterpretation.debitAccount, DEFAULT_DEBIT_ACCOUNT),
                creditAccount: ensureChartAccount(finalInterpretation.creditAccount, DEFAULT_CREDIT_ACCOUNT)
            };

            return {
                validated: parsed.validated ?? true,
                corrected: corrections.length > 0 || parsed.corrected === true,
                corrections: corrections,
                finalInterpretation,
                confidence: parsed.confidence ?? 0.8,
                reasoning: parsed.reasoning ?? 'AI validation complete',
                processingTimeMs: 0
            };
        } catch (parseError) {
            console.error('[AI Validator] Failed to parse response:', parseError);
            console.error('[AI Validator] Raw response:', text.substring(0, 500));

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
 * Layer 2: AI verification (this function) - Now uses Clawdbot by default
 */
export async function validateWithAI(
    systemInterpretation: SystemInterpretation
): Promise<AIValidationResult> {
    const validator = getAIValidator();
    return validator.validateTransaction(systemInterpretation);
}
