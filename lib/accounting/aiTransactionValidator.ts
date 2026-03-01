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
const RAW_AI_PROVIDER = process.env.AI_VALIDATION_PROVIDER || 'gemini';
const CLAWDBOT_API_URL = process.env.CLAWDBOT_API_URL || 'http://localhost:8080';
const CLAWDBOT_API_KEY = process.env.CLAWDBOT_API_KEY || '';
const VALIDATION_RETRY_LIMIT = 2;
const VALIDATION_RETRY_DELAY_MS = 300;
const DEFAULT_DEBIT_ACCOUNT = { code: "5010", name: "Purchases" };
const DEFAULT_CREDIT_ACCOUNT = { code: "1020", name: "Bank" };
const DEFAULT_GEMINI_MODEL_CANDIDATES = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function normalizeProvider(provider: string | undefined): 'clawdbot' | 'gemini' {
    const normalized = (provider || '').trim().toLowerCase();
    if (['clawdbot', 'claw', 'clawdbot-ai'].includes(normalized)) return 'clawdbot';
    if (['gemini', 'google', 'google-gemini', 'google_gemini'].includes(normalized)) return 'gemini';
    return 'gemini';
}

function resolveGeminiApiKey(): string {
    const keys = [
        process.env.GOOGLE_GEMINI_API_KEY,
        process.env.GEMINI_API_KEY,
        process.env.GOOGLE_API_KEY,
        process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY,
        process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    ];

    for (const key of keys) {
        const value = (key || '').trim();
        if (value && value !== 'your_api_key_here') return value;
    }
    return '';
}

function resolveGeminiModels(): string[] {
    const configured = (process.env.GOOGLE_GEMINI_MODEL || process.env.GEMINI_MODEL || '')
        .trim();
    const models = configured ? [configured, ...DEFAULT_GEMINI_MODEL_CANDIDATES] : DEFAULT_GEMINI_MODEL_CANDIDATES;
    return Array.from(new Set(models));
}

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
  "reasoning": "A professional and conversational explanation of why the transaction was validated or corrected. Explain the tax logic to the user as a helpful accountant."
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

// In-memory cache for AI validation results to save quota
const validationCache = new Map<string, AIValidationResult>();
const CONFIDENCE_THRESHOLD = 0.85;

export class AITransactionValidator {
    private isEnabled: boolean = true;
    private provider: 'clawdbot' | 'gemini' = normalizeProvider(RAW_AI_PROVIDER);
    private geminiApiKey: string = '';

    constructor() {
        const enabled = process.env.ENABLE_AI_VALIDATION !== 'false';
        this.geminiApiKey = resolveGeminiApiKey();

        if (enabled && this.provider === 'clawdbot') {
            this.isEnabled = true;
            console.log('[AI Validator] Initialized with Clawdbot');
        } else if (enabled && this.provider === 'gemini') {
            // Gemini support - check for API key aliases
            this.isEnabled = !!this.geminiApiKey;
            console.log(`[AI Validator] Gemini mode - ${this.isEnabled ? 'enabled' : 'disabled (missing API key)'}`);
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

    getProvider(): 'clawdbot' | 'gemini' {
        return this.provider;
    }

    /**
     * Validate a transaction interpretation using AI (Clawdbot or Gemini)
     * Includes caching and confidence thresholding to optimize quota usage.
     */
    async validateTransaction(
        systemInterpretation: SystemInterpretation
    ): Promise<AIValidationResult> {
        const startTime = Date.now();
        const textKey = `${systemInterpretation.transactionText}_${systemInterpretation.amount}`;

        // 1. Check Caching
        const cached = validationCache.get(textKey);
        if (cached) {
            console.log('[AI Validator] Using cached result for:', systemInterpretation.transactionText);
            return {
                ...cached,
                processingTimeMs: Date.now() - startTime
            };
        }

        // 2. Check Confidence Threshold
        // If Layer 1 is highly confident, skip Layer 2 AI to save quota
        if (systemInterpretation.confidence && systemInterpretation.confidence >= CONFIDENCE_THRESHOLD) {
            console.log(`[AI Validator] Skipping Layer 2 - Layer 1 confidence (${(systemInterpretation.confidence * 100).toFixed(0)}%) meets threshold (${CONFIDENCE_THRESHOLD * 100}%)`);
            return {
                validated: true,
                corrected: false,
                corrections: [],
                finalInterpretation: systemInterpretation,
                confidence: systemInterpretation.confidence,
                reasoning: `Layer 1 confidence (${(systemInterpretation.confidence * 100).toFixed(0)}%) sufficient. AI skipped to optimize quota.`,
                processingTimeMs: Date.now() - startTime
            };
        }

        // 3. AI is disabled check
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
                let result: AIValidationResult;
                if (this.provider === 'clawdbot') {
                    result = await this.validateWithClawdbot(systemInterpretation, startTime);
                } else {
                    result = await this.validateWithGemini(systemInterpretation, startTime);
                }

                // Store successful result in cache
                validationCache.set(textKey, result);
                return result;
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
        if (!this.geminiApiKey) {
            throw new Error('Gemini API key not configured. Set GOOGLE_GEMINI_API_KEY (or GEMINI_API_KEY/GOOGLE_API_KEY).');
        }

        // Dynamic import for Gemini (only if needed)
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(this.geminiApiKey);
        const modelCandidates = resolveGeminiModels();

        const prompt = this.buildPrompt(interpretation);
        let text = '';
        let lastGeminiError: unknown = null;

        for (const modelName of modelCandidates) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.2,
                        responseMimeType: 'application/json',
                    }
                });
                const response = await result.response;
                text = response?.text?.() || '';
                if (text.trim().length > 0) {
                    break;
                }
            } catch (error) {
                lastGeminiError = error;
                console.error(`[AI Validator] Gemini model ${modelName} failed:`, error);
            }
        }

        if (!text || text.trim().length === 0) {
            throw new Error(`Empty response from Gemini. Last error: ${lastGeminiError instanceof Error ? lastGeminiError.message : 'Unknown error'}`);
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

            type ValidationCorrection = {
                field?: string;
                correctedTo?: unknown;
            };

            type ParsedValidationPayload = {
                validated?: boolean;
                corrected?: boolean;
                confidence?: number;
                reasoning?: string;
                corrections?: ValidationCorrection[];
                finalInterpretation?: Partial<SystemInterpretation>;
            };

            let parsed: ParsedValidationPayload;
            try {
                parsed = JSON.parse(jsonStr);
            } catch {
                const start = jsonStr.indexOf('{');
                const end = jsonStr.lastIndexOf('}');
                if (start >= 0 && end > start) {
                    parsed = JSON.parse(jsonStr.slice(start, end + 1));
                } else {
                    throw new Error('No JSON object found in AI response');
                }
            }

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
            const corrections: AIValidationResult["corrections"] = (parsed.corrections || []).map(
                (correction) => ({
                    field: String(correction.field || ""),
                    was: null,
                    correctedTo: correction.correctedTo,
                    reason: "AI correction",
                })
            );
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
