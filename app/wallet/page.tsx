"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
    walletEngine,
    formatNaira,
    parsePaymentCommand,
    generateTransferResponse,
    generateFundingResponse,
    generateBalanceResponse,
} from "@/lib/wallet/walletEngine";
import {
    type WalletState,
    type LinkedCard,
    type WalletTransaction,
    NIGERIAN_PROVIDERS,
} from "@/lib/wallet/types";
import {
    SendHorizontal,
    CreditCard,
    ArrowUpRight,
    ArrowDownLeft,
    Plus,
    Wallet,
    QrCode,
    Copy,
    X,
    CheckCircle2,
    Clock,
    XCircle,
    Building2,
    ChevronDown,
} from "lucide-react";
import ModeSelector from "@/components/ModeSelector";

// =============================================================================
// TYPES
// =============================================================================

type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
};

type ModalType = "link-card" | "send" | "fund" | "receive" | "withdraw" | null;

// =============================================================================
// CARD NETWORK BADGE
// =============================================================================

function CardNetworkBadge({ card, onRemove }: { card: LinkedCard; onRemove?: () => void }) {
    const networkImages: Record<string, string> = {
        visa: "/Visa.png",
        mastercard: "/Mastercard.png",
        verve: "/Verve.png",
    };

    const imageSrc = networkImages[card.network] || "/Mastercard.png";

    return (
        <div className={`flex-shrink-0 flex flex-col items-center gap-2 p-2 group relative`}>
            <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center">
                <img
                    src={imageSrc}
                    alt={card.network}
                    className="w-12 h-12 object-cover rounded-full"
                />
            </div>
            <div className="text-center">
                <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>•••• {card.last4}</p>
                <p className="text-[10px] text-gray-500">{card.expiry}</p>
            </div>
            {onRemove && (
                <button
                    onClick={onRemove}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <X className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}

// =============================================================================
// ADD CARD BUTTON
// =============================================================================

function AddCardButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex-shrink-0 flex flex-col items-center gap-2 p-3"
        >
            <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-500 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors">
                <Plus className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-xs font-medium text-gray-500">Add Card</p>
        </button>
    );
}

// =============================================================================
// QUICK ACTION BUTTON
// =============================================================================

function QuickActionButton({
    icon: Icon,
    label,
    color,
    onClick,
}: {
    icon: React.ElementType;
    label: string;
    color: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="flex flex-col items-center gap-2 p-2 rounded-xl transition-colors"
        >
            <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${color}15` }}
            >
                <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
        </button>
    );
}

// =============================================================================
// TRANSACTION ITEM
// =============================================================================

function TransactionItem({ txn }: { txn: WalletTransaction }) {
    const typeConfig = {
        send: { icon: ArrowUpRight, color: "#f43f5e", bgColor: "#fef2f2" },
        receive: { icon: ArrowDownLeft, color: "#10b981", bgColor: "#ecfdf5" },
        fund: { icon: Plus, color: "#3b82f6", bgColor: "#eff6ff" },
        withdraw: { icon: Building2, color: "#f59e0b", bgColor: "#fffbeb" },
    };

    const statusConfig = {
        success: { icon: CheckCircle2, color: "#10b981" },
        pending: { icon: Clock, color: "#f59e0b" },
        failed: { icon: XCircle, color: "#f43f5e" },
    };

    const { icon: TypeIcon, color, bgColor } = typeConfig[txn.type];
    const { icon: StatusIcon, color: statusColor } = statusConfig[txn.status];

    // Determine prefix based on transaction type
    const prefix = txn.type === "send" || txn.type === "withdraw" ? "-" : "+";

    const getLabel = () => {
        switch (txn.type) {
            case "send":
                return txn.recipient ? `To ${txn.recipient}${txn.provider ? ` (${txn.provider})` : ""}` : "Sent";
            case "receive":
                return txn.sender ? `From ${txn.sender}` : "Received";
            case "fund":
                return "Card Funding";
            case "withdraw":
                return txn.provider ? `To ${txn.provider}` : "Bank Withdrawal";
        }
    };

    return (
        <div
            className="flex items-center justify-between py-3 last:border-0"
            style={{ borderBottom: '1px solid #e5e5e5' }}
        >
            <div className="flex items-center gap-3">
                <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: bgColor }}
                >
                    <TypeIcon className="w-5 h-5" style={{ color }} />
                </div>
                <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{getLabel()}</p>
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-500">
                            {new Date(txn.createdAt).toLocaleDateString("en-NG", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        </p>
                        <StatusIcon className="w-3 h-3" style={{ color: statusColor }} />
                    </div>
                </div>
            </div>
            <p className="text-sm font-semibold" style={{ color }}>
                {prefix}{formatNaira(txn.amount)}
            </p>
        </div>
    );
}

// =============================================================================
// LINK CARD MODAL
// =============================================================================

function LinkCardModal({
    isOpen,
    onClose,
    onSuccess,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (card: LinkedCard) => void;
}) {
    const [cardNumber, setCardNumber] = useState("");
    const [expiry, setExpiry] = useState("");
    const [cvv, setCvv] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const formatCardNumber = (value: string) => {
        const cleaned = value.replace(/\D/g, "").slice(0, 16);
        const groups = cleaned.match(/.{1,4}/g);
        return groups ? groups.join(" ") : cleaned;
    };

    const formatExpiry = (value: string) => {
        const cleaned = value.replace(/\D/g, "").slice(0, 4);
        if (cleaned.length >= 2) {
            return cleaned.slice(0, 2) + "/" + cleaned.slice(2);
        }
        return cleaned;
    };

    const handleSubmit = async () => {
        setError("");
        setLoading(true);

        try {
            const card = await walletEngine.linkCard(cardNumber, expiry, cvv);
            onSuccess(card);
            setCardNumber("");
            setExpiry("");
            setCvv("");
            onClose();
        } catch (e) {
            setError("Failed to link card. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Link Card</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wide">Card Number</label>
                        <input
                            type="text"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                            placeholder="0000 0000 0000 0000"
                            className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wide">Expiry</label>
                            <input
                                type="text"
                                value={expiry}
                                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                                placeholder="MM/YY"
                                className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wide">CVV</label>
                            <input
                                type="password"
                                value={cvv}
                                onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                placeholder="•••"
                                className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {error && <p className="text-sm text-rose-500">{error}</p>}

                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        Cards are securely encrypted and tokenized
                    </p>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={loading || cardNumber.length < 19 || expiry.length < 5 || cvv.length < 3}
                    className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {loading ? "Linking..." : "Link Card"}
                </button>
            </div>
        </div>
    );
}

// =============================================================================
// SEND MONEY MODAL
// =============================================================================

function SendMoneyModal({
    isOpen,
    onClose,
    balance,
    prefill,
}: {
    isOpen: boolean;
    onClose: () => void;
    balance: number;
    prefill?: { amount: number; recipient: string; provider?: string };
}) {
    const [amount, setAmount] = useState(prefill?.amount?.toString() || "");
    const [recipient, setRecipient] = useState(prefill?.recipient || "");
    const [provider, setProvider] = useState(prefill?.provider || "");
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<"form" | "confirm" | "success">("form");
    const [txn, setTxn] = useState<WalletTransaction | null>(null);

    useEffect(() => {
        if (prefill) {
            setAmount(prefill.amount.toString());
            setRecipient(prefill.recipient);
            setProvider(prefill.provider || "");
            setStep("confirm");
        }
    }, [prefill]);

    const numAmount = parseFloat(amount) || 0;
    const fee = numAmount <= 5000 ? 10 : numAmount <= 50000 ? 25 : 50;
    const total = numAmount + fee;

    const handleSend = async () => {
        setLoading(true);
        try {
            const result = await walletEngine.sendMoney({
                amount: numAmount,
                recipient,
                provider: provider || undefined,
                type: recipient.includes("@") ? "email" : "phone",
            });
            setTxn(result);
            setStep("success");
        } catch (e) {
            alert("Transfer failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setStep("form");
        setAmount("");
        setRecipient("");
        setProvider("");
        setTxn(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {step === "success" ? "Transfer Successful" : "Send Money"}
                    </h2>
                    <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {step === "form" && (
                    <>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-gray-500 uppercase tracking-wide">Amount</label>
                                <div className="relative mt-1">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">₦</span>
                                    <input
                                        type="text"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                                        placeholder="0.00"
                                        className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Balance: {formatNaira(balance)}</p>
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 uppercase tracking-wide">Recipient (Phone/Account)</label>
                                <input
                                    type="text"
                                    value={recipient}
                                    onChange={(e) => setRecipient(e.target.value)}
                                    placeholder="0812 345 6789"
                                    className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 uppercase tracking-wide">Bank/Provider (Optional)</label>
                                <select
                                    value={provider}
                                    onChange={(e) => setProvider(e.target.value)}
                                    className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select provider</option>
                                    {NIGERIAN_PROVIDERS.map((p) => (
                                        <option key={p.id} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={() => setStep("confirm")}
                            disabled={numAmount <= 0 || !recipient || total > balance}
                            className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Continue
                        </button>
                    </>
                )}

                {step === "confirm" && (
                    <>
                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700 space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Amount</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{formatNaira(numAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Recipient</span>
                                <span className="font-medium text-gray-900 dark:text-white">{recipient}</span>
                            </div>
                            {provider && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Provider</span>
                                    <span className="font-medium text-gray-900 dark:text-white">{provider}</span>
                                </div>
                            )}
                            <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                                <span className="text-gray-500">Fee</span>
                                <span className="font-medium text-gray-900 dark:text-white">{formatNaira(fee)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-semibold text-gray-900 dark:text-white">Total</span>
                                <span className="font-bold text-blue-600">{formatNaira(total)}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep("form")}
                                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={loading}
                                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                {loading ? "Sending..." : "Confirm"}
                            </button>
                        </div>
                    </>
                )}

                {step === "success" && txn && (
                    <>
                        <div className="text-center py-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mx-auto flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                            </div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNaira(txn.amount)}</p>
                            <p className="text-gray-500 mt-1">Sent to {txn.recipient}</p>
                        </div>

                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Reference</span>
                                <span className="font-mono text-gray-900 dark:text-white">{txn.reference}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Fee</span>
                                <span className="text-gray-900 dark:text-white">{formatNaira(txn.fee)}</span>
                            </div>
                        </div>

                        <button
                            onClick={handleClose}
                            className="w-full py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold hover:opacity-90 transition-opacity"
                        >
                            Done
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

// =============================================================================
// RECEIVE MONEY MODAL
// =============================================================================

function ReceiveMoneyModal({
    isOpen,
    onClose,
    userName,
    paymentLink,
}: {
    isOpen: boolean;
    onClose: () => void;
    userName: string;
    paymentLink: string;
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(paymentLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Receive Money</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="text-center py-6">
                    <div className="w-32 h-32 rounded-2xl bg-gray-100 dark:bg-gray-700 mx-auto flex items-center justify-center mb-4">
                        <QrCode className="w-20 h-20 text-gray-400" />
                    </div>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{userName}</p>
                    <p className="text-gray-500 mt-1">Share your payment link</p>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-700">
                    <p className="flex-1 text-sm text-gray-600 dark:text-gray-300 truncate">{paymentLink}</p>
                    <button
                        onClick={handleCopy}
                        className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    >
                        {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// FUND WALLET MODAL
// =============================================================================

function FundWalletModal({
    isOpen,
    onClose,
    cards,
    onLinkCard,
}: {
    isOpen: boolean;
    onClose: () => void;
    cards: LinkedCard[];
    onLinkCard: () => void;
}) {
    const [amount, setAmount] = useState("");
    const [selectedCard, setSelectedCard] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<"form" | "success">("form");

    const numAmount = parseFloat(amount) || 0;
    const fee = Math.min(numAmount * 0.015, 2000);

    useEffect(() => {
        if (cards.length > 0 && !selectedCard) {
            const defaultCard = cards.find((c) => c.isDefault) || cards[0];
            setSelectedCard(defaultCard.id);
        }
    }, [cards, selectedCard]);

    const handleFund = async () => {
        setLoading(true);
        try {
            await walletEngine.fundWallet(numAmount, selectedCard);
            setStep("success");
        } catch {
            alert("Funding failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setStep("form");
        setAmount("");
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {step === "success" ? "Wallet Funded!" : "Add Money"}
                    </h2>
                    <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {step === "form" && (
                    <>
                        {cards.length === 0 ? (
                            <div className="text-center py-6">
                                <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500 mb-4">Link a card to fund your wallet</p>
                                <button
                                    onClick={() => { onClose(); onLinkCard(); }}
                                    className="px-6 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                                >
                                    Link Card
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase tracking-wide">Amount</label>
                                        <div className="relative mt-1">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">₦</span>
                                            <input
                                                type="text"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                                                placeholder="0.00"
                                                className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-gray-500 uppercase tracking-wide">Select Card</label>
                                        <select
                                            value={selectedCard}
                                            onChange={(e) => setSelectedCard(e.target.value)}
                                            className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {cards.map((card) => (
                                                <option key={card.id} value={card.id}>
                                                    {card.network.toUpperCase()} •••• {card.last4}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {numAmount > 0 && (
                                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700 space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Amount</span>
                                            <span className="text-gray-900 dark:text-white">{formatNaira(numAmount)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Fee (1.5%, max ₦2,000)</span>
                                            <span className="text-gray-900 dark:text-white">{formatNaira(fee)}</span>
                                        </div>
                                        <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                                            <span className="font-medium text-gray-900 dark:text-white">Total Charge</span>
                                            <span className="font-bold text-blue-600">{formatNaira(numAmount + fee)}</span>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={handleFund}
                                    disabled={loading || numAmount <= 0}
                                    className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {loading ? "Processing..." : `Fund ${formatNaira(numAmount)}`}
                                </button>
                            </>
                        )}
                    </>
                )}

                {step === "success" && (
                    <>
                        <div className="text-center py-6">
                            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mx-auto flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                            </div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNaira(numAmount)}</p>
                            <p className="text-gray-500 mt-1">Added to your wallet</p>
                        </div>

                        <button
                            onClick={handleClose}
                            className="w-full py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold hover:opacity-90 transition-opacity"
                        >
                            Done
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function WalletPage() {
    const [walletState, setWalletState] = useState<WalletState | null>(null);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [composerInput, setComposerInput] = useState("");
    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [sendPrefill, setSendPrefill] = useState<{ amount: number; recipient: string; provider?: string } | undefined>();

    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const chatEndRef = useRef<HTMLDivElement | null>(null);

    // Load wallet
    const loadWallet = useCallback(() => {
        setLoading(true);
        walletEngine.load();
        setWalletState(walletEngine.getState());
        setLoading(false);
    }, []);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setTimeout(loadWallet, 0);
        }
    }, [loadWallet]);

    // Subscribe to wallet changes
    useEffect(() => {
        const unsubscribe = walletEngine.subscribe((state) => {
            setWalletState(state);
        });
        return () => unsubscribe();
    }, []);

    // Initial chat message
    useEffect(() => {
        if (messages.length === 0) {
            setMessages([
                {
                    id: "intro",
                    role: "assistant",
                    content: "Welcome to your Wallet! 💳\n\nSend money instantly using natural language:\n\n• \"Send ₦500 to 9168961220 Opay\"\n• \"Pay ₦1,000 to john@email.com\"\n• \"Transfer ₦2,500 to 0123456789 GTB\"\n\nYou can also use the quick action buttons above.",
                    timestamp: Date.now(),
                },
            ]);
        }
    }, [messages.length]);

    // Auto-expand textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            const nextHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 24), 150);
            textareaRef.current.style.height = `${nextHeight}px`;
        }
    }, [composerInput]);

    // Scroll to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Append message helper
    const appendMessage = useCallback((role: ChatMessage["role"], content: string) => {
        setMessages((prev) => [
            ...prev,
            {
                id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                role,
                content,
                timestamp: Date.now(),
            },
        ]);
    }, []);

    // Handle send message (chat-to-pay)
    const handleSendMessage = useCallback(() => {
        const trimmed = composerInput.trim();
        if (!trimmed) return;

        appendMessage("user", trimmed);
        setComposerInput("");

        const msg = trimmed.toLowerCase();

        // Try to parse as payment command
        const parsed = parsePaymentCommand(trimmed);
        if (parsed) {
            appendMessage(
                "assistant",
                `💸 **Payment Request Detected**\n\n• Amount: ${formatNaira(parsed.amount)}\n• Recipient: ${parsed.recipient}${parsed.provider ? `\n• Provider: ${parsed.provider}` : ""}\n\nOpening transfer...`
            );

            setTimeout(() => {
                setSendPrefill({ amount: parsed.amount, recipient: parsed.recipient, provider: parsed.provider });
                setActiveModal("send");
            }, 500);
            return;
        }

        // Check for balance query
        if (msg.includes("balance") || msg.includes("wallet") || msg.includes("how much")) {
            appendMessage("assistant", generateBalanceResponse());
            return;
        }

        // Check for help
        if (msg.includes("help") || msg.includes("how") || msg.includes("what can")) {
            appendMessage(
                "assistant",
                "I can help you with:\n\n• **Send money**: \"Send 500 to 08123456789 Opay\"\n• **Check balance**: \"What's my balance?\"\n• **View transactions**: \"Show recent transactions\"\n\nOr use the quick action buttons above!"
            );
            return;
        }

        // Check for transactions
        if (msg.includes("transaction") || msg.includes("history") || msg.includes("recent")) {
            const txns = walletState?.transactions.slice(0, 5) || [];
            if (txns.length === 0) {
                appendMessage("assistant", "You don't have any transactions yet.");
            } else {
                const summary = txns
                    .map((t) => `• ${t.type === "send" ? "Sent" : t.type === "receive" ? "Received" : t.type === "fund" ? "Added" : "Withdrew"} ${formatNaira(t.amount)} - ${t.status}`)
                    .join("\n");
                appendMessage("assistant", `📋 **Recent Transactions**\n\n${summary}`);
            }
            return;
        }

        // Default response
        appendMessage(
            "assistant",
            "I didn't understand that. Try saying something like:\n\n• \"Send 500 naira to 09168961220 Opay\"\n• \"What's my balance?\"\n• \"Show recent transactions\""
        );
    }, [appendMessage, composerInput, walletState]);

    const canSend = composerInput.trim().length > 0;

    if (loading || !walletState) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-pulse text-gray-500">Loading Wallet...</div>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-6 pb-32">
                <main className="px-1 space-y-4">
                    {/* Wallet Balance */}
                    <div>
                        <p className="text-xs font-medium text-gray-500 mb-0.5">Wallet Balance</p>
                        <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
                            {formatNaira(walletState.balance)}
                        </p>
                    </div>

                    {/* Linked Cards - Horizontal Scroll */}
                    <div className="rounded-2xl overflow-hidden">
                        <div className="py-2">
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Linked Cards</h3>
                            <p className="text-xs text-gray-500">Your payment sources</p>
                        </div>
                        <div className="overflow-x-auto hide-scrollbar">
                            <div className="flex gap-1 px-2 py-2 min-w-max">
                                {walletState.cards.map((card) => (
                                    <CardNetworkBadge
                                        key={card.id}
                                        card={card}
                                        onRemove={() => walletEngine.removeCard(card.id)}
                                    />
                                ))}
                                <AddCardButton onClick={() => setActiveModal("link-card")} />
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="rounded-2xl overflow-hidden">
                        <div className="py-2">
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Quick Actions</h3>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            <QuickActionButton
                                icon={ArrowUpRight}
                                label="Send"
                                color="#3b82f6"
                                onClick={() => { setSendPrefill(undefined); setActiveModal("send"); }}
                            />
                            <QuickActionButton
                                icon={ArrowDownLeft}
                                label="Receive"
                                color="#10b981"
                                onClick={() => setActiveModal("receive")}
                            />
                            <QuickActionButton
                                icon={Plus}
                                label="Add Money"
                                color="#8b5cf6"
                                onClick={() => setActiveModal("fund")}
                            />
                            <QuickActionButton
                                icon={Building2}
                                label="Withdraw"
                                color="#f59e0b"
                                onClick={() => setActiveModal("withdraw")}
                            />
                        </div>
                    </div>

                    {/* Recent Transactions */}
                    <div className="rounded-2xl overflow-hidden">
                        <div className="py-2">
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Recent Transactions</h3>
                            <p className="text-xs text-gray-500">{walletState.transactions.length} transactions</p>
                        </div>
                        <div className="px-0">
                            {walletState.transactions.length === 0 ? (
                                <p className="text-sm text-gray-400 py-4 text-center">No transactions yet</p>
                            ) : (
                                walletState.transactions.slice(0, 5).map((txn) => (
                                    <TransactionItem key={txn.id} txn={txn} />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Chat Messages */}
                    <div className="rounded-2xl overflow-hidden">
                        <div className="px-3 py-2">
                            <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Chat to Pay</p>
                        </div>
                        <div className="p-2 space-y-3 max-h-[300px] overflow-y-auto">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed border whitespace-pre-wrap ${msg.role === "user"
                                            ? "bg-blue-50 border-blue-100 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100"
                                            : "bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                                            }`}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                    </div>
                </main>
            </div>

            {/* Fixed Bottom Composer */}
            <div className="fixed bottom-4 left-0 right-0 lg:left-[252px] z-40 px-4 sm:px-6 pointer-events-none !bg-transparent">
                <div className="mx-auto w-full max-w-3xl !bg-transparent">
                    <div className="pointer-events-auto flex items-end gap-2 rounded-[32px] bg-[#e5e5e5] dark:bg-[#2a2a2a] px-3 py-1.5 shadow-lg transition-all">
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            placeholder="Send 500 naira to 9168961220 Opay..."
                            className="flex-1 bg-transparent border-none text-sm text-gray-700 dark:text-white placeholder:text-gray-400 focus:outline-none resize-none py-2.5 min-h-[44px] ml-1"
                            value={composerInput}
                            onChange={(e) => setComposerInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                        />
                        <button
                            className={`w-9 h-9 rounded-full flex items-center justify-center mb-0.5 transition-all ${canSend
                                ? "bg-white dark:bg-[#64B5F6] text-[#64B5F6] dark:text-white shadow-sm"
                                : "bg-white/50 dark:bg-[#3a3a3a] text-[#64B5F6] opacity-50 cursor-not-allowed"
                                }`}
                            onClick={handleSendMessage}
                            disabled={!canSend}
                        >
                            <SendHorizontal className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <LinkCardModal
                isOpen={activeModal === "link-card"}
                onClose={() => setActiveModal(null)}
                onSuccess={() => { }}
            />
            <SendMoneyModal
                isOpen={activeModal === "send"}
                onClose={() => { setActiveModal(null); setSendPrefill(undefined); }}
                balance={walletState.balance}
                prefill={sendPrefill}
            />
            <ReceiveMoneyModal
                isOpen={activeModal === "receive"}
                onClose={() => setActiveModal(null)}
                userName={walletState.userName}
                paymentLink={walletState.paymentLink}
            />
            <FundWalletModal
                isOpen={activeModal === "fund"}
                onClose={() => setActiveModal(null)}
                cards={walletState.cards}
                onLinkCard={() => setActiveModal("link-card")}
            />
        </>
    );
}
