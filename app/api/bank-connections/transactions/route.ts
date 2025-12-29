import { NextRequest, NextResponse } from "next/server";

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

// Mock transactions for demo
const MOCK_TRANSACTIONS: Transaction[] = [
    {
        id: "txn_001",
        date: new Date().toISOString(),
        description: "POS PAYMENT - SHOPRITE IKEJA",
        narration: "POS/WEB PURCHASE",
        amount: -15420,
        balance: 1234560,
        type: "debit",
        category: "shopping",
        reference: "FT24350XXXXX",
        currency: "NGN",
    },
    {
        id: "txn_002",
        date: new Date(Date.now() - 86400000).toISOString(),
        description: "INWARD TRANSFER FROM ACME LTD",
        narration: "Invoice Payment #1234",
        amount: 500000,
        balance: 1249980,
        type: "credit",
        category: "income",
        reference: "NIP/24350XXXXX",
        currency: "NGN",
    },
    {
        id: "txn_003",
        date: new Date(Date.now() - 172800000).toISOString(),
        description: "UTILITY BILL PAYMENT - IKEDC",
        narration: "Electricity Bill Dec 2024",
        amount: -45000,
        balance: 749980,
        type: "debit",
        category: "utilities",
        reference: "BP/24349XXXXX",
        currency: "NGN",
    },
    {
        id: "txn_004",
        date: new Date(Date.now() - 259200000).toISOString(),
        description: "SALARY CREDIT",
        narration: "December 2024 Salary",
        amount: 850000,
        balance: 794980,
        type: "credit",
        category: "income",
        reference: "SAL/24348XXXXX",
        currency: "NGN",
    },
    {
        id: "txn_005",
        date: new Date(Date.now() - 345600000).toISOString(),
        description: "TRANSFER TO VENDOR - OFFICE SUPPLIES",
        narration: "Payment for office supplies",
        amount: -125000,
        balance: -55020,
        type: "debit",
        category: "office",
        reference: "TRF/24347XXXXX",
        currency: "NGN",
    },
];

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;

    const connectionId = searchParams.get("connectionId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
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

        // Filter by date range if provided
        let filteredTransactions = [...MOCK_TRANSACTIONS];

        if (startDate) {
            const start = new Date(startDate);
            filteredTransactions = filteredTransactions.filter(
                t => new Date(t.date) >= start
            );
        }

        if (endDate) {
            const end = new Date(endDate);
            filteredTransactions = filteredTransactions.filter(
                t => new Date(t.date) <= end
            );
        }

        // Paginate
        const total = filteredTransactions.length;
        const pages = Math.ceil(total / limit);
        const offset = (page - 1) * limit;
        const paginatedTransactions = filteredTransactions.slice(offset, offset + limit);

        const response: TransactionsResponse = {
            success: true,
            transactions: paginatedTransactions,
            pagination: {
                total,
                page,
                limit,
                pages,
            },
            account: {
                accountNumber: "****7890",
                accountName: "Acme Technologies Ltd",
                bankName: "Zenith Bank",
                balance: 1234560,
                currency: "NGN",
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

// POST - Import transactions to accounting system
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { connectionId, transactionIds } = body;

        if (!connectionId || !transactionIds?.length) {
            return NextResponse.json(
                { success: false, message: "connectionId and transactionIds are required" },
                { status: 400 }
            );
        }

        /**
         * PRODUCTION: 
         * 1. Fetch full transaction details
         * 2. Transform to accounting journal entries
         * 3. Post to accounting engine
         * 4. Mark as imported in database
         */

        return NextResponse.json({
            success: true,
            imported: transactionIds.length,
            message: `Imported ${transactionIds.length} transactions to accounting`,
        });
    } catch (error) {
        console.error("Failed to import transactions:", error);
        return NextResponse.json(
            { success: false, message: "Failed to import transactions" },
            { status: 500 }
        );
    }
}
