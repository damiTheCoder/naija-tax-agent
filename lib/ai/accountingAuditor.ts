
import { JournalEntry } from "../accounting/doubleEntry";

export interface AuditResult {
    isValid: boolean;
    confidence: number; // 0 to 1
    reasoning: string;
    suggestedCorrections?: JournalEntry;
}

/**
 * Validates a generated Journal Entry against the raw user description using AI.
 * 
 * @param entry The system-generated Journal Entry
 * @param rawDescription The user's original input/description
 * @returns AuditResult containing validation status and reasoning
 */
export async function validateJournalEntry(
    entry: JournalEntry,
    rawDescription: string
): Promise<AuditResult> {
    // SIMULATED AI LATENCY
    await new Promise(resolve => setTimeout(resolve, 1500));

    const lowerDesc = rawDescription.toLowerCase();

    // MOCK LOGIC: Trigger a "Correction" if the description contains specific keywords
    // This allows the user to test the "AI Correction" UI flow easily.
    if (lowerDesc.includes("computer") || lowerDesc.includes("audit") || lowerDesc.includes("wrong")) {
        return {
            isValid: false,
            confidence: 0.85,
            reasoning: "The system classified this as a generic 'Office Expense', but 'Computer' purchases above ₦100,000 should typically be capitalized as 'Equipment' (Asset) rather than expensed immediately.",
            suggestedCorrections: {
                ...entry,
                lines: entry.lines.map(line => {
                    // Start pretending to fix it
                    if (line.accountName.includes("Expense")) {
                        return { ...line, accountName: "Computer Equipment (Asset)", accountCode: "1200" };
                    }
                    return line;
                })
            }
        };
    }

    // New MOCK LOGIC for "Credit Sale / Previously Owed"
    // New MOCK LOGIC for "Credit Sale / Previously Owed"
    if (lowerDesc.includes("previously owed") || lowerDesc.includes("credit sale") || lowerDesc.includes("debt") || lowerDesc.includes("customer paid")) {
        return {
            isValid: false,
            confidence: 0.95,
            reasoning: "The narration indicates a payment for a previous credit sale. This transaction should be a debt collection (Statement of Financial Position only), not new Revenue.",
            suggestedCorrections: {
                ...entry,
                lines: entry.lines.map(line => {
                    // Check if it's a Revenue account (Class 4 typically, or name match)
                    const isRevenue = line.accountCode.startsWith("4") ||
                        line.accountName.toLowerCase().includes("revenue") ||
                        line.accountName.toLowerCase().includes("sales") ||
                        line.accountName.toLowerCase().includes("income");

                    // Fix Credit Side: Revenue -> Accounts Receivable
                    if (isRevenue && line.credit > 0) {
                        return {
                            ...line,
                            accountName: "Accounts Receivable",
                            accountCode: "1100"
                        };
                    }

                    // Fix Debit Side: If not Bank -> Bank (as per user preference for collections)
                    // If the user already debited something, we might want to suggest Bank if it looks wrong (e.g. Expense??)
                    // But assume if it's a collection, it goes to Bank (1020) or Cash (1000).
                    if (line.debit > 0 && !line.accountName.toLowerCase().includes("bank") && !line.accountName.toLowerCase().includes("cash")) {
                        return {
                            ...line,
                            accountName: "Bank - Current Account",
                            accountCode: "1020"
                        };
                    }

                    return line;
                })
            }
        };
    }

    // Default: AI agrees with the rule-based engine
    return {
        isValid: true,
        confidence: 0.98,
        reasoning: "The journal entry appears consistent with standard accounting practices for this transaction type.",
    };
}
