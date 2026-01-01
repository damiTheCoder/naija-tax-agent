// =============================================================================
// WALLET ENGINE - State Management & Mock API
// =============================================================================

import {
    type LinkedCard,
    type WalletTransaction,
    type WalletState,
    type TransferRequest,
    type CardNetwork,
    type TransactionType,
    NIGERIAN_PROVIDERS,
} from "./types";

// =============================================================================
// HELPERS
// =============================================================================

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const generateRef = () => `TXN${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;

export const formatNaira = (amount: number): string => {
    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
};

// Detect card network from card number
const detectCardNetwork = (cardNumber: string): CardNetwork => {
    const cleaned = cardNumber.replace(/\s/g, "");
    if (cleaned.startsWith("4")) return "visa";
    if (cleaned.startsWith("5") || cleaned.startsWith("2")) return "mastercard";
    if (cleaned.startsWith("506") || cleaned.startsWith("650")) return "verve";
    return "visa"; // default
};

// =============================================================================
// CHAT-TO-PAY PARSER
// =============================================================================

export interface ParsedPaymentCommand {
    amount: number;
    recipient: string;
    provider?: string;
    type: "phone" | "email" | "account";
    confidence: number;
}

export const parsePaymentCommand = (input: string): ParsedPaymentCommand | null => {
    const normalized = input.toLowerCase().trim();

    // Match patterns like "send 500 naira to 9168961220 Opay"
    // or "pay 1000 to john@email.com"
    // or "transfer 2500 to 0123456789 GTB"

    const amountPatterns = [
        /(?:send|pay|transfer)\s+(?:₦|ngn|naira)?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:naira|ngn)?/i,
        /(?:₦|ngn|naira)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
        /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:naira|ngn)/i,
    ];

    let amount: number | null = null;
    for (const pattern of amountPatterns) {
        const match = normalized.match(pattern);
        if (match) {
            amount = parseFloat(match[1].replace(/,/g, ""));
            break;
        }
    }

    if (!amount || amount <= 0) return null;

    // Find recipient (phone, email, or account number)
    let recipient: string | null = null;
    let type: "phone" | "email" | "account" = "phone";

    // Email pattern
    const emailMatch = input.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
        recipient = emailMatch[1];
        type = "email";
    }

    // Phone pattern (Nigerian format)
    if (!recipient) {
        const phoneMatch = input.match(/(?:to\s+)?(\+?234|0)?(\d{10})/);
        if (phoneMatch) {
            recipient = phoneMatch[2];
            if (phoneMatch[1] === "+234" || phoneMatch[1] === "234") {
                recipient = phoneMatch[2];
            }
            type = "phone";
        }
    }

    // Account number pattern (10 digits)
    if (!recipient) {
        const accountMatch = input.match(/(\d{10})/);
        if (accountMatch) {
            recipient = accountMatch[1];
            type = "account";
        }
    }

    if (!recipient) return null;

    // Find provider
    let provider: string | undefined;
    for (const p of NIGERIAN_PROVIDERS) {
        if (normalized.includes(p.id) || normalized.includes(p.name.toLowerCase())) {
            provider = p.name;
            break;
        }
    }

    return {
        amount,
        recipient,
        provider,
        type,
        confidence: provider ? 0.9 : 0.7,
    };
};

// =============================================================================
// WALLET ENGINE CLASS
// =============================================================================

type Listener = (state: WalletState) => void;

class WalletEngine {
    private state: WalletState;
    private listeners: Set<Listener> = new Set();
    private storageKey = "naija-wallet-state";

    constructor() {
        this.state = this.getDefaultState();
    }

    private getDefaultState(): WalletState {
        return {
            balance: 25000, // Demo starting balance
            cards: [],
            transactions: [
                // Some demo transactions
                {
                    id: "demo-1",
                    type: "receive",
                    amount: 15000,
                    sender: "Chidi Okonkwo",
                    status: "success",
                    reference: "TXNDEMO001",
                    fee: 0,
                    createdAt: Date.now() - 86400000 * 2,
                    completedAt: Date.now() - 86400000 * 2,
                },
                {
                    id: "demo-2",
                    type: "send",
                    amount: 5000,
                    recipient: "0812****4567",
                    provider: "Opay",
                    status: "success",
                    reference: "TXNDEMO002",
                    fee: 10,
                    createdAt: Date.now() - 86400000,
                    completedAt: Date.now() - 86400000,
                },
                {
                    id: "demo-3",
                    type: "fund",
                    amount: 20000,
                    status: "success",
                    reference: "TXNDEMO003",
                    fee: 100,
                    createdAt: Date.now() - 3600000,
                    completedAt: Date.now() - 3600000,
                },
            ],
            userId: "user-demo-001",
            userName: "@chijioke",
            paymentLink: "pay.me/chijioke",
        };
    }

    // Persistence
    load(): void {
        if (typeof window === "undefined") return;
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                this.state = { ...this.getDefaultState(), ...JSON.parse(stored) };
            }
        } catch {
            this.state = this.getDefaultState();
        }
        this.notify();
    }

    private save(): void {
        if (typeof window === "undefined") return;
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch {
            // Storage error - ignore
        }
    }

    // Subscriptions
    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        this.listeners.forEach((l) => l(this.state));
    }

    getState(): WalletState {
        return this.state;
    }

    // ==========================================================================
    // MOCK API OPERATIONS
    // ==========================================================================

    // Link a new card
    async linkCard(cardNumber: string, expiry: string, cvv: string): Promise<LinkedCard> {
        // Simulate API delay
        await new Promise((r) => setTimeout(r, 1500));

        const network = detectCardNetwork(cardNumber);
        const last4 = cardNumber.replace(/\s/g, "").slice(-4);

        const newCard: LinkedCard = {
            id: generateId(),
            last4,
            network,
            expiry,
            isDefault: this.state.cards.length === 0,
            addedAt: Date.now(),
        };

        this.state.cards.push(newCard);
        this.save();
        this.notify();

        return newCard;
    }

    // Remove a card
    removeCard(cardId: string): void {
        this.state.cards = this.state.cards.filter((c) => c.id !== cardId);
        // If removed default, make first card default
        if (this.state.cards.length > 0 && !this.state.cards.some((c) => c.isDefault)) {
            this.state.cards[0].isDefault = true;
        }
        this.save();
        this.notify();
    }

    // Fund wallet from card
    async fundWallet(amount: number, cardId: string): Promise<WalletTransaction> {
        await new Promise((r) => setTimeout(r, 2000));

        const fee = Math.min(amount * 0.015, 2000); // 1.5% capped at ₦2000

        const txn: WalletTransaction = {
            id: generateId(),
            type: "fund",
            amount,
            status: "success",
            reference: generateRef(),
            fee,
            createdAt: Date.now(),
            completedAt: Date.now(),
        };

        this.state.balance += amount;
        this.state.transactions.unshift(txn);
        this.save();
        this.notify();

        return txn;
    }

    // Send money
    async sendMoney(request: TransferRequest): Promise<WalletTransaction> {
        await new Promise((r) => setTimeout(r, 2000));

        const fee = request.amount <= 5000 ? 10 : request.amount <= 50000 ? 25 : 50;

        if (this.state.balance < request.amount + fee) {
            throw new Error("Insufficient wallet balance");
        }

        const txn: WalletTransaction = {
            id: generateId(),
            type: "send",
            amount: request.amount,
            recipient: request.recipient,
            provider: request.provider,
            status: "success",
            reference: generateRef(),
            fee,
            createdAt: Date.now(),
            completedAt: Date.now(),
        };

        this.state.balance -= request.amount + fee;
        this.state.transactions.unshift(txn);
        this.save();
        this.notify();

        return txn;
    }

    // Withdraw to bank
    async withdraw(amount: number, bankAccount: string, provider: string): Promise<WalletTransaction> {
        await new Promise((r) => setTimeout(r, 2500));

        const fee = 50; // Flat withdrawal fee

        if (this.state.balance < amount + fee) {
            throw new Error("Insufficient wallet balance");
        }

        const txn: WalletTransaction = {
            id: generateId(),
            type: "withdraw",
            amount,
            recipient: bankAccount,
            provider,
            status: "pending", // Withdrawals are usually pending
            reference: generateRef(),
            fee,
            createdAt: Date.now(),
        };

        this.state.balance -= amount + fee;
        this.state.transactions.unshift(txn);
        this.save();
        this.notify();

        return txn;
    }

    // Get transaction by ID
    getTransaction(id: string): WalletTransaction | undefined {
        return this.state.transactions.find((t) => t.id === id);
    }

    // Get filtered transactions
    getTransactions(filter?: TransactionType): WalletTransaction[] {
        if (!filter) return this.state.transactions;
        return this.state.transactions.filter((t) => t.type === filter);
    }
}

// Singleton export
export const walletEngine = new WalletEngine();

// =============================================================================
// CHAT RESPONSE GENERATORS
// =============================================================================

export const generateTransferResponse = (txn: WalletTransaction): string => {
    const maskedRecipient = txn.recipient?.replace(/(\d{3})(\d+)(\d{3})/, "$1****$3") || "recipient";

    return `✅ **Transfer Successful!**

Sent **${formatNaira(txn.amount)}** to ${maskedRecipient}${txn.provider ? ` (${txn.provider})` : ""}

• Fee: ${formatNaira(txn.fee)}
• Reference: ${txn.reference}
• Time: ${new Date(txn.createdAt).toLocaleTimeString()}

Your new balance: **${formatNaira(walletEngine.getState().balance)}**`;
};

export const generateFundingResponse = (txn: WalletTransaction): string => {
    return `✅ **Wallet Funded!**

Added **${formatNaira(txn.amount)}** to your wallet

• Fee: ${formatNaira(txn.fee)}
• Reference: ${txn.reference}

New balance: **${formatNaira(walletEngine.getState().balance)}**`;
};

export const generateBalanceResponse = (): string => {
    const state = walletEngine.getState();
    const recentCount = state.transactions.slice(0, 5).length;

    return `💰 **Your Wallet**

Balance: **${formatNaira(state.balance)}**
Linked Cards: ${state.cards.length}
Recent Transactions: ${recentCount}

Payment Link: ${state.paymentLink}`;
};
