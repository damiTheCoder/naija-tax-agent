/**
 * CashOS Validate Transaction Tool for Clawdbot
 * 
 * Validates transaction interpretations using AI.
 * This replaces the Gemini-based Layer 2 validation.
 */

const CASHOS_BASE_URL = process.env.CASHOS_BASE_URL || "http://localhost:3000";

interface AccountInfo {
    code: string;
    name: string;
}

interface ValidateTransactionInput {
    transactionText: string;
    debitAccount?: AccountInfo;
    creditAccount?: AccountInfo;
    amount: number;
    nature?: string;
    taxImplications?: {
        outputVAT?: number;
        inputVAT?: number;
        wht?: number;
        paye?: number;
        cgt?: number;
        isDisallowable?: boolean;
    };
}

interface ValidationResult {
    success: boolean;
    validated?: boolean;
    corrected?: boolean;
    corrections?: Array<{
        field: string;
        was: unknown;
        correctedTo: unknown;
        reason: string;
    }>;
    finalInterpretation?: ValidateTransactionInput;
    confidence?: number;
    reasoning?: string;
    error?: string;
}

/**
 * Validate a transaction interpretation
 */
export async function cashos_validate_transaction(
    input: ValidateTransactionInput
): Promise<ValidationResult> {
    try {
        const response = await fetch(`${CASHOS_BASE_URL}/api/accounting/validate-transaction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error || "Validation failed" };
        }

        return {
            success: true,
            validated: data.validated,
            corrected: data.corrected,
            corrections: data.corrections,
            finalInterpretation: data.finalInterpretation,
            confidence: data.confidence,
            reasoning: data.reasoning,
        };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
}

export const toolDefinition = {
    name: "cashos_validate_transaction",
    description: "Validate transaction classification and tax treatment using Nigerian accounting rules.",
    parameters: {
        type: "object",
        properties: {
            transactionText: { type: "string", description: "Original transaction description" },
            debitAccount: {
                type: "object",
                properties: { code: { type: "string" }, name: { type: "string" } },
            },
            creditAccount: {
                type: "object",
                properties: { code: { type: "string" }, name: { type: "string" } },
            },
            amount: { type: "number", description: "Transaction amount" },
            nature: { type: "string", description: "Transaction nature" },
        },
        required: ["transactionText", "amount"],
    },
    handler: cashos_validate_transaction,
};

export default cashos_validate_transaction;
