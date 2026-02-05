import { NextRequest, NextResponse } from "next/server";
import { accountingEngine, parseTransactionFromChat } from "@/lib/accounting/transactionBridge";
import { RawTransaction, TransactionType } from "@/lib/accounting/types";

/**
 * Transactions API for Clawdbot
 * 
 * Allows Clawdbot to record transactions via natural language.
 * Called by the cashos_record_transaction tool.
 */

interface TransactionRequest {
    description: string;
    amount?: number;
    date?: string;
    type?: "income" | "expense" | "transfer" | "auto";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body: TransactionRequest = await request.json();

        if (!body.description || typeof body.description !== "string") {
            return NextResponse.json(
                { error: "Transaction description is required" },
                { status: 400 }
            );
        }

        // Parse the transaction from natural language
        const parsed = parseTransactionFromChat(body.description);

        if (!parsed || parsed.confidence < 0.3) {
            return NextResponse.json({
                success: false,
                error: "Could not parse transaction",
                suggestion: "Please try rephrasing, e.g., 'Sold goods for ₦5000 cash' or 'Paid rent ₦100000'"
            }, { status: 400 });
        }

        // Use parsed amount or provided amount
        const amount = body.amount || parsed.amount || 0;

        if (amount <= 0) {
            return NextResponse.json({
                success: false,
                error: "Valid amount required",
                suggestion: "Include amount in description or provide amount parameter"
            }, { status: 400 });
        }

        // Build RawTransaction
        const rawTx: RawTransaction = {
            id: `api-${Date.now()}`,
            date: body.date || new Date().toISOString().split('T')[0],
            description: body.description,
            amount: amount,
            category: parsed.category || "general",
            type: (parsed.parsedType === "sale" || parsed.parsedType === "receipt" ? "income" :
                parsed.parsedType === "expense" || parsed.parsedType === "purchase" ? "expense" :
                    "expense") as TransactionType,
        };

        // Process transaction through accounting engine
        const result = accountingEngine.processTransactionEnhanced(rawTx);

        return NextResponse.json({
            success: true,
            message: `Transaction recorded: ${body.description}`,
            journalEntry: {
                id: result.journalEntry.id,
                date: result.journalEntry.date,
                narration: result.journalEntry.narration,
                lines: result.journalEntry.lines,
            },
            analysis: {
                debitAccount: result.analysis.debitAccount,
                creditAccount: result.analysis.creditAccount,
                confidence: (result.analysis.debitAccount.confidence + result.analysis.creditAccount.confidence) / 2,
            },
            response: result.chatResponse,
        });

    } catch (error) {
        console.error("[Transactions API] Error:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to record transaction",
        }, { status: 500 });
    }
}

// GET: List recent transactions
export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "10", 10);

        const state = accountingEngine.getState();
        const recentEntries = state.journalEntries
            .slice(-limit)
            .reverse()
            .map(entry => ({
                id: entry.id,
                date: entry.date,
                narration: entry.narration,
                amount: entry.lines.reduce((sum, line) => sum + (line.debit || 0), 0),
                lines: entry.lines,
            }));

        return NextResponse.json({
            success: true,
            transactions: recentEntries,
            count: recentEntries.length,
            totalEntries: state.journalEntries.length,
        });

    } catch (error) {
        console.error("[Transactions API] GET Error:", error);
        return NextResponse.json({
            success: false,
            error: "Failed to retrieve transactions",
        }, { status: 500 });
    }
}
