/**
 * POS Integration Types
 * Types for receiving transactions from external POS systems
 */

export interface POSTransactionItem {
    name: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface POSTransaction {
    id: string;
    timestamp: string;
    items: POSTransactionItem[];
    subtotal: number;
    discount?: number;
    vat?: number;
    total: number;
    paymentMethod: 'cash' | 'card' | 'transfer' | 'mixed';
    reference?: string;
    cashierName?: string;
    terminalId?: string;
}

export interface POSTransactionRequest {
    apiKey: string;
    provider: string;
    transaction: POSTransaction;
}

export interface POSTransactionResponse {
    success: boolean;
    journalEntryId?: string;
    message: string;
    error?: string;
}

export interface StoredPOSTransaction extends POSTransaction {
    provider: string;
    journalEntryId: string;
    receivedAt: string;
}

// Storage key for POS transactions
export const POS_TRANSACTIONS_STORAGE_KEY = 'insight::pos-transactions';
export const POS_API_KEYS_STORAGE_KEY = 'insight::pos-api-keys';

// Validate incoming POS transaction
export function validatePOSTransaction(data: unknown): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Invalid request body' };
    }

    const req = data as Record<string, unknown>;

    if (!req.apiKey || typeof req.apiKey !== 'string') {
        return { valid: false, error: 'Missing or invalid apiKey' };
    }

    if (!req.provider || typeof req.provider !== 'string') {
        return { valid: false, error: 'Missing or invalid provider' };
    }

    if (!req.transaction || typeof req.transaction !== 'object') {
        return { valid: false, error: 'Missing or invalid transaction object' };
    }

    const tx = req.transaction as Record<string, unknown>;

    if (!tx.id || typeof tx.id !== 'string') {
        return { valid: false, error: 'Missing transaction id' };
    }

    if (!tx.total || typeof tx.total !== 'number' || tx.total <= 0) {
        return { valid: false, error: 'Invalid transaction total' };
    }

    if (!Array.isArray(tx.items) || tx.items.length === 0) {
        return { valid: false, error: 'Transaction must have at least one item' };
    }

    return { valid: true };
}
