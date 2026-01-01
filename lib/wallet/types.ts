// =============================================================================
// WALLET TYPES
// =============================================================================

export type CardNetwork = "visa" | "mastercard" | "verve";

export interface LinkedCard {
    id: string;
    last4: string;
    network: CardNetwork;
    expiry: string; // MM/YY
    isDefault: boolean;
    addedAt: number;
}

export type TransactionType = "send" | "receive" | "fund" | "withdraw";
export type TransactionStatus = "pending" | "success" | "failed";

export interface WalletTransaction {
    id: string;
    type: TransactionType;
    amount: number;
    recipient?: string; // phone, email, or account
    sender?: string;
    provider?: string; // Opay, GTB, Kuda, etc.
    status: TransactionStatus;
    reference: string;
    fee: number;
    createdAt: number;
    completedAt?: number;
}

export interface WalletState {
    balance: number;
    cards: LinkedCard[];
    transactions: WalletTransaction[];
    userId: string;
    userName: string;
    paymentLink: string;
}

export interface TransferRequest {
    amount: number;
    recipient: string;
    provider?: string;
    type: "phone" | "email" | "account";
}

// Nigerian bank/fintech providers
export const NIGERIAN_PROVIDERS = [
    { id: "opay", name: "Opay", color: "#00B74F" },
    { id: "kuda", name: "Kuda", color: "#40196D" },
    { id: "moniepoint", name: "Moniepoint", color: "#0052CC" },
    { id: "palmpay", name: "PalmPay", color: "#8B2FC9" },
    { id: "gtb", name: "GTBank", color: "#E35205" },
    { id: "zenith", name: "Zenith", color: "#EE1C25" },
    { id: "access", name: "Access Bank", color: "#F78D2D" },
    { id: "uba", name: "UBA", color: "#E20613" },
    { id: "firstbank", name: "First Bank", color: "#003366" },
    { id: "fcmb", name: "FCMB", color: "#522E8E" },
    { id: "fidelity", name: "Fidelity", color: "#00703C" },
    { id: "stanbic", name: "Stanbic IBTC", color: "#0033A0" },
] as const;

export type ProviderId = typeof NIGERIAN_PROVIDERS[number]["id"];
