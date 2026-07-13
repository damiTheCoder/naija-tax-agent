import { NextRequest, NextResponse } from "next/server";
import { processTransactionsWithAI } from "@/lib/banking/transactionPipeline";
import type { InboundBankTransaction } from "@/lib/banking/types";

/**
 * Bank Connection API - Transactions Endpoint
 * 
 * Pulls transactions from connected bank accounts via Open Banking API.
 * 
 * Usage:
 * GET /api/bank-connections/transactions?connectionId=xxx&startDate=2024-01-01&endDate=2024-12-31
 */

export interface Transaction {
    id: string;
    date: string;
    description: string;
    narration: string;
    amount: number;
    balance: number;
    type: "credit" | "debit";
    category?: string;
    reference?: string;
    currency: string;
}

export interface TransactionsResponse {
    success: boolean;
    transactions: Transaction[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        pages: number;
    };
    account?: {
        accountNumber: string;
        accountName: string;
        bankName: string;
        balance: number;
        currency: string;
    };
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;

    const connectionId = searchParams.get("connectionId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!connectionId) {
        return NextResponse.json(
            { success: false, message: "connectionId is required" },
            { status: 400 }
        );
    }

    try {
        /**
         * PRODUCTION IMPLEMENTATION:
         * 
         * For Mono:
         * const mono = new MonoClient(process.env.MONO_SECRET_KEY);
         * const transactions = await mono.getTransactions(accountId, {
         *   start: startDate,
         *   end: endDate,
         *   paginate: true,
         *   limit: limit,
         * });
         * 
         * For Okra:
         * const okra = new OkraClient(process.env.OKRA_SECRET_KEY);
         * const transactions = await okra.getTransactions({
         *   customer_id: customerId,
         *   from: startDate,
         *   to: endDate,
         *   page: page,
         *   limit: limit,
         * });
         */

        const response: TransactionsResponse = {
            success: true,
            transactions: [],
            pagination: {
                total: 0,
                page,
                limit,
                pages: 0,
            },
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error("Failed to fetch transactions:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch transactions" },
            { status: 500 }
        );
    }
}

// POST - Import transactions to accounting system via the cross-module pipeline
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { connectionId, transactionIds, transactions: rawTransactions } = body;

        if (!connectionId) {
            return NextResponse.json(
                { success: false, message: "connectionId is required" },
                { status: 400 }
            );
        }

        // Build InboundBankTransactions from either provided data or mock lookup
        let toProcess: InboundBankTransaction[] = [];

        if (rawTransactions && Array.isArray(rawTransactions)) {
            // Client sent full transaction objects
            toProcess = rawTransactions.map((tx: Transaction) => ({
                id: tx.id,
                connectionId,
                accountId: "acc_001",
                date: tx.date,
                description: tx.description,
                narration: tx.narration || undefined,
                amount: Math.abs(tx.amount),
                balance: tx.balance || undefined,
                direction: (tx.type === "credit" ? "credit" : "debit") as "credit" | "debit",
                currency: tx.currency || "NGN",
                reference: tx.reference || undefined,
            }));
        } else if (transactionIds && Array.isArray(transactionIds)) {
            toProcess = [];
        }

        if (toProcess.length === 0) {
            return NextResponse.json(
                { success: false, message: "No valid transactions to import" },
                { status: 400 }
            );
        }

        // Run through the full cross-module pipeline
        const pipelineResult = await processTransactionsWithAI(toProcess, {
            entityId: connectionId,
            autoPost: true,
            runTaxClassification: true,
            updateBudgets: true,
            updateCashflow: true,
            bankAccountCode: "1000",
        });
        const transactionById = new Map(toProcess.map((tx) => [tx.id, tx]));

        return NextResponse.json({
            success: true,
            imported: pipelineResult.processed,
            failed: pipelineResult.failed,
            duplicatesSkipped: pipelineResult.duplicatesSkipped,
            message: `Processed ${pipelineResult.processed} of ${pipelineResult.total} transactions across all modules`,
            pipeline: {
                summary: pipelineResult.summary,
                details: pipelineResult.results.map((r) => ({
                    txDate: transactionById.get(r.bankTransactionId)?.date,
                    txDescription: transactionById.get(r.bankTransactionId)?.description,
                    txAmount: transactionById.get(r.bankTransactionId)?.amount,
                    txDirection: transactionById.get(r.bankTransactionId)?.direction,
                    bankTxId: r.bankTransactionId,
                    journalId: r.accounting.journalId,
                    category: r.classification.categoryLabel,
                    nature: r.classification.nature,
                    confidence: Math.round(r.classification.confidence * 100),
                    source: r.classification.source,
                    taxClassified: r.tax.classified,
                    budgetCategory: r.budgeting.categoryMatch,
                    warnings: r.warnings,
                })),
            },
        });
    } catch (error) {
        console.error("Failed to import transactions:", error);
        return NextResponse.json(
            { success: false, message: "Failed to import transactions" },
            { status: 500 }
        );
    }
}
