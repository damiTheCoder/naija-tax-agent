/**
 * CashOS Record Transaction Tool for Clawdbot
 * 
 * This tool allows natural language transaction recording.
 * It calls the CashOS /api/transactions endpoint.
 */

const CASHOS_BASE_URL = process.env.CASHOS_BASE_URL || "http://localhost:3000";

interface RecordTransactionInput {
    description: string;
    amount?: number;
    date?: string;
}

interface TransactionResult {
    success: boolean;
    message?: string;
    journalEntry?: {
        id: string;
        date: string;
        description: string;
        lines: Array<{
            accountCode: string;
            accountName: string;
            debit: number;
            credit: number;
        }>;
    };
    taxes?: {
        vat?: number;
        wht?: number;
    };
    error?: string;
}

/**
 * Record a financial transaction in CashOS
 * 
 * @param input - Transaction details including description and optional amount/date
 * @returns Result with journal entry details or error
 */
export async function cashos_record_transaction(
    input: RecordTransactionInput
): Promise<TransactionResult> {
    try {
        const response = await fetch(`${CASHOS_BASE_URL}/api/transactions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                description: input.description,
                amount: input.amount,
                date: input.date,
            }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            return {
                success: false,
                error: data.error || data.suggestion || "Failed to record transaction",
            };
        }

        return {
            success: true,
            message: data.message,
            journalEntry: data.journalEntry,
            taxes: data.taxes,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Network error",
        };
    }
}

// Export tool definition for Clawdbot
export const toolDefinition = {
    name: "cashos_record_transaction",
    description: "Record a financial transaction (income, expense, transfer) in CashOS accounting software.",
    parameters: {
        type: "object",
        properties: {
            description: {
                type: "string",
                description: "Natural language description of the transaction",
            },
            amount: {
                type: "number",
                description: "Transaction amount in Naira (optional if in description)",
            },
            date: {
                type: "string",
                description: "Date in YYYY-MM-DD format (optional)",
            },
        },
        required: ["description"],
    },
    handler: cashos_record_transaction,
};

export default cashos_record_transaction;
