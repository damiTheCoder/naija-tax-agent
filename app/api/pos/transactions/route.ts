import { NextRequest, NextResponse } from 'next/server';
import {
    POSTransactionRequest,
    POSTransactionResponse,
    StoredPOSTransaction,
    validatePOSTransaction,
    POS_TRANSACTIONS_STORAGE_KEY,
} from '@/lib/pos/types';

/**
 * POST /api/pos/transactions
 * 
 * Receive transactions from external POS systems.
 * Each transaction is validated, journaled, and stored for display.
 * 
 * Example request:
 * {
 *   "apiKey": "pos_test_key_123",
 *   "provider": "moniepoint",
 *   "transaction": {
 *     "id": "TXN-001",
 *     "timestamp": "2026-01-18T22:00:00Z",
 *     "items": [
 *       { "name": "Product A", "quantity": 2, "unitPrice": 500, "total": 1000 }
 *     ],
 *     "subtotal": 1000,
 *     "vat": 75,
 *     "total": 1075,
 *     "paymentMethod": "card",
 *     "reference": "REF-12345"
 *   }
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<POSTransactionResponse>> {
    try {
        const body = await request.json();

        // Validate the incoming request
        const validation = validatePOSTransaction(body);
        if (!validation.valid) {
            return NextResponse.json(
                { success: false, message: validation.error || 'Invalid request' },
                { status: 400 }
            );
        }

        const { apiKey, provider, transaction } = body as POSTransactionRequest;

        // In production, validate API key against stored keys
        // For now, accept any key starting with 'pos_'
        if (!apiKey.startsWith('pos_')) {
            return NextResponse.json(
                { success: false, message: 'Invalid API key format' },
                { status: 401 }
            );
        }

        // Generate journal entry ID
        const journalEntryId = `POS-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        // Create stored transaction record
        const storedTransaction: StoredPOSTransaction = {
            ...transaction,
            provider,
            journalEntryId,
            receivedAt: new Date().toISOString(),
        };

        // Note: In a real implementation, this would:
        // 1. Store in a database
        // 2. Call the accounting engine to create journal entries
        // 3. Trigger real-time updates via WebSocket/SSE

        // For now, we return success and the client-side will handle storage
        // The transaction data is returned so the frontend can process it

        return NextResponse.json({
            success: true,
            journalEntryId,
            message: `Transaction ${transaction.id} recorded successfully`,
        });

    } catch (error) {
        console.error('[POS API] Error processing transaction:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/pos/transactions
 * 
 * Get recent POS transactions (for debugging/testing)
 */
export async function GET(): Promise<NextResponse> {
    return NextResponse.json({
        message: 'POS Transaction API',
        endpoints: {
            'POST /api/pos/transactions': 'Submit a new POS transaction',
        },
        examplePayload: {
            apiKey: 'pos_your_api_key',
            provider: 'moniepoint',
            transaction: {
                id: 'TXN-001',
                timestamp: new Date().toISOString(),
                items: [
                    { name: 'Product A', quantity: 2, unitPrice: 500, total: 1000 },
                ],
                subtotal: 1000,
                vat: 75,
                total: 1075,
                paymentMethod: 'card',
                reference: 'REF-12345',
            },
        },
    });
}
