/**
 * =============================================================================
 * AI BANK TRANSACTION CLASSIFIER
 * =============================================================================
 *
 * Classifies raw bank transactions into proper accounting entries with
 * tax implications. Uses a 3-layer approach:
 *
 *   Layer 1 — Rule-based pattern matching on Nigerian bank narrations
 *   Layer 2 — Heuristic scoring (amount ranges, counterparty, channel)
 *   Layer 3 — AI fallback via Gemini for ambiguous transactions
 *
 * Nigerian banks have distinctive narration patterns:
 *   "NIP/JOHN DOE/ACME LTD/Payment for consulting"
 *   "POS/SHOPRITE IKEJA/1234"
 *   "ATM/WDL/IKOYI/12345"
 *   "USSD/Transfer to 0123456789"
 *   "MC INTL PURCHASE/AMAZON.COM/USD 50.00"
 */

import { CHART_OF_ACCOUNTS } from "@/lib/accounting/doubleEntry";
import type { InboundBankTransaction, ClassificationResult, TransactionNature } from "./types";

// =============================================================================
// NIGERIAN NARRATION PATTERNS
// =============================================================================

interface NarrationRule {
    pattern: RegExp;
    nature: TransactionNature;
    category: string;
    categoryLabel: string;
    debitCode: string;
    creditCode: string;
    confidence: number;
    tax: Partial<ClassificationResult["tax"]>;
    budget?: Partial<ClassificationResult["budget"]>;
}

const findAccount = (code: string) =>
    CHART_OF_ACCOUNTS.find((a) => a.code === code);

const accountName = (code: string): string =>
    findAccount(code)?.name ?? code;

// WHT rates per FIRS circular
const WHT_RATES: Record<string, number> = {
    professional: 0.10,
    consulting: 0.10,
    management: 0.10,
    technical: 0.10,
    commission: 0.10,
    contract: 0.05,
    construction: 0.05,
    supply: 0.05,
    rent: 0.10,
    dividend: 0.10,
    interest: 0.10,
    royalty: 0.10,
    director_fee: 0.10,
};

// Standard VAT rate
const VAT_RATE = 0.075;

const DEFAULT_GEMINI_MODEL_CANDIDATES = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
];

const GEMINI_FALLBACK_CONFIDENCE_THRESHOLD = 0.75;

const ACCOUNT_CATALOG_PROMPT = CHART_OF_ACCOUNTS
    .map((account) => `${account.code} | ${account.name} | ${account.type}`)
    .join("\n");

const NATURES: TransactionNature[] = [
    "revenue",
    "cost_of_sales",
    "operating_expense",
    "asset_purchase",
    "asset_disposal",
    "financing",
    "equity",
    "transfer",
    "tax_payment",
    "other",
];

interface GeminiClassificationCandidate {
    nature?: string;
    category?: string;
    categoryLabel?: string;
    debitAccountCode?: string;
    creditAccountCode?: string;
    confidence?: number;
    reasoning?: string;
    tax?: {
        vatApplicable?: boolean;
        vatCategory?: "output" | "input" | "exempt" | "zero_rated";
        vatAmount?: number;
        whtApplicable?: boolean;
        whtRate?: number;
        whtAmount?: number;
        whtType?: string;
        cgtApplicable?: boolean;
        stampDutyApplicable?: boolean;
    };
    budget?: {
        category?: string;
        department?: string;
    };
}

/**
 * Rule bank: patterns matched against bank narrations.
 * Ordered from most specific to least specific.
 * For credits (inflows), the bank account is debited; for debits (outflows), the bank account is credited.
 * The debitCode/creditCode below reflect the NON-BANK side of the double entry.
 * The pipeline will flip debit/credit based on direction.
 */
const NARRATION_RULES: NarrationRule[] = [
    // ─── SALARY & PAYROLL ──────────────────────────────────────────────
    {
        pattern: /salary|payroll|wages?|staff\s*pay|monthly\s*pay/i,
        nature: "operating_expense",
        category: "payroll",
        categoryLabel: "Salary & Wages",
        debitCode: "5500",
        creditCode: "1000",
        confidence: 0.92,
        tax: { vatApplicable: false, whtApplicable: false },
        budget: { category: "Payroll", department: "People" },
    },
    {
        pattern: /pension|pencom|pen\s*fund|retirement/i,
        nature: "operating_expense",
        category: "pension",
        categoryLabel: "Pension Contribution",
        debitCode: "5510",
        creditCode: "1000",
        confidence: 0.90,
        tax: { vatApplicable: false, whtApplicable: false },
        budget: { category: "Payroll", department: "People" },
    },

    // ─── TAX PAYMENTS ──────────────────────────────────────────────────
    {
        pattern: /firs|federal\s*inland|vat\s*payment|vat\s*remit/i,
        nature: "tax_payment",
        category: "vat-remittance",
        categoryLabel: "VAT Remittance to FIRS",
        debitCode: "2200",
        creditCode: "1000",
        confidence: 0.95,
        tax: { vatApplicable: false, whtApplicable: false },
    },
    {
        pattern: /paye|pay\s*as\s*you\s*earn|state\s*irs|lirs|lga\s*tax/i,
        nature: "tax_payment",
        category: "paye-remittance",
        categoryLabel: "PAYE Tax Remittance",
        debitCode: "2210",
        creditCode: "1000",
        confidence: 0.93,
        tax: { vatApplicable: false, whtApplicable: false },
    },
    {
        pattern: /wht\s*remit|withholding\s*tax\s*pay/i,
        nature: "tax_payment",
        category: "wht-remittance",
        categoryLabel: "WHT Remittance",
        debitCode: "2220",
        creditCode: "1000",
        confidence: 0.93,
        tax: { vatApplicable: false, whtApplicable: false },
    },
    {
        pattern: /cit\s*pay|company\s*income\s*tax|corporate\s*tax/i,
        nature: "tax_payment",
        category: "cit-payment",
        categoryLabel: "Company Income Tax Payment",
        debitCode: "7000",
        creditCode: "1000",
        confidence: 0.93,
        tax: { vatApplicable: false, whtApplicable: false },
    },

    // ─── UTILITIES ─────────────────────────────────────────────────────
    {
        pattern: /ikedc|ekedc|phcn|nepa|electricity|power|prepaid\s*meter|disco/i,
        nature: "operating_expense",
        category: "utilities-electricity",
        categoryLabel: "Electricity",
        debitCode: "5610",
        creditCode: "1000",
        confidence: 0.93,
        tax: { vatApplicable: true, vatCategory: "input" },
        budget: { category: "Utilities" },
    },
    {
        pattern: /water\s*(bill|rate|corp)/i,
        nature: "operating_expense",
        category: "utilities-water",
        categoryLabel: "Water Bill",
        debitCode: "5610",
        creditCode: "1000",
        confidence: 0.90,
        tax: { vatApplicable: true, vatCategory: "input" },
        budget: { category: "Utilities" },
    },
    {
        pattern: /mtn|glo|airtel|9mobile|etisalat|ntel|data|internet|wifi|broadband|spectranet|swift/i,
        nature: "operating_expense",
        category: "utilities-telecom",
        categoryLabel: "Internet & Telecom",
        debitCode: "5620",
        creditCode: "1000",
        confidence: 0.88,
        tax: { vatApplicable: true, vatCategory: "input" },
        budget: { category: "Technology", department: "Engineering" },
    },

    // ─── RENT ──────────────────────────────────────────────────────────
    {
        pattern: /rent|lease|landlord|tenancy|property\s*pay/i,
        nature: "operating_expense",
        category: "rent",
        categoryLabel: "Rent Expense",
        debitCode: "5600",
        creditCode: "1000",
        confidence: 0.90,
        tax: {
            vatApplicable: false,
            whtApplicable: true,
            whtRate: WHT_RATES.rent,
            whtType: "rent",
        },
        budget: { category: "Rent" },
    },

    // ─── PROFESSIONAL SERVICES ─────────────────────────────────────────
    {
        pattern: /consult|advisory|legal\s*fee|audit\s*fee|professional\s*fee|accounting\s*fee/i,
        nature: "operating_expense",
        category: "professional-services",
        categoryLabel: "Professional Services",
        debitCode: "5700",
        creditCode: "1000",
        confidence: 0.88,
        tax: {
            vatApplicable: true,
            vatCategory: "input",
            whtApplicable: true,
            whtRate: WHT_RATES.professional,
            whtType: "professional",
        },
        budget: { department: "Finance" },
    },
    {
        pattern: /contract|contractor|sub-?contract|building|construct|renovation|repair/i,
        nature: "operating_expense",
        category: "contracts",
        categoryLabel: "Contract Services",
        debitCode: "5700",
        creditCode: "1000",
        confidence: 0.85,
        tax: {
            vatApplicable: true,
            vatCategory: "input",
            whtApplicable: true,
            whtRate: WHT_RATES.contract,
            whtType: "contract",
        },
        budget: { category: "Operations" },
    },

    // ─── TRANSPORT ─────────────────────────────────────────────────────
    {
        pattern: /uber|bolt|taxi|cab|transport|logistics|dispatch|courier|dhl|fedex|gig\s*logistics/i,
        nature: "operating_expense",
        category: "transport",
        categoryLabel: "Transport & Logistics",
        debitCode: "5800",
        creditCode: "1000",
        confidence: 0.87,
        tax: { vatApplicable: true, vatCategory: "input" },
        budget: { category: "Operations" },
    },
    {
        pattern: /fuel|petrol|diesel|gas\s*station|filling\s*station|nnpc|oando|total|conoil/i,
        nature: "operating_expense",
        category: "fuel",
        categoryLabel: "Fuel & Energy",
        debitCode: "5800",
        creditCode: "1000",
        confidence: 0.88,
        tax: { vatApplicable: true, vatCategory: "input" },
        budget: { category: "Operations" },
    },

    // ─── SUPPLIES & SHOPPING ───────────────────────────────────────────
    {
        pattern: /shoprite|spar|supermarket|grocery|market|store|mall/i,
        nature: "operating_expense",
        category: "supplies",
        categoryLabel: "Supplies & Shopping",
        debitCode: "5820",
        creditCode: "1000",
        confidence: 0.82,
        tax: { vatApplicable: true, vatCategory: "input" },
        budget: { category: "Office Supplies" },
    },
    {
        pattern: /stationery|office\s*supplies|printing|toner|paper/i,
        nature: "operating_expense",
        category: "office-supplies",
        categoryLabel: "Office Supplies",
        debitCode: "5820",
        creditCode: "1000",
        confidence: 0.88,
        tax: { vatApplicable: true, vatCategory: "input" },
        budget: { category: "Office Supplies" },
    },

    // ─── MEALS & ENTERTAINMENT ─────────────────────────────────────────
    {
        pattern: /restaurant|food|lunch|dinner|breakfast|eatery|cafe|chicken\s*republic|kilimanjaro/i,
        nature: "operating_expense",
        category: "meals",
        categoryLabel: "Meals & Entertainment",
        debitCode: "6010",
        creditCode: "1000",
        confidence: 0.82,
        tax: { vatApplicable: true, vatCategory: "input" },
    },

    // ─── MARKETING & ADVERTISING ───────────────────────────────────────
    {
        pattern: /advert|marketing|promo|campaign|google\s*ads|meta\s*ads|facebook\s*ads|instagram/i,
        nature: "operating_expense",
        category: "marketing",
        categoryLabel: "Marketing & Advertising",
        debitCode: "6000",
        creditCode: "1000",
        confidence: 0.88,
        tax: { vatApplicable: true, vatCategory: "input" },
        budget: { category: "Marketing", department: "Marketing" },
    },

    // ─── INSURANCE ─────────────────────────────────────────────────────
    {
        pattern: /insurance|hmo|health\s*plan|premium|leadway|axa|aiico/i,
        nature: "operating_expense",
        category: "insurance",
        categoryLabel: "Insurance",
        debitCode: "5640",
        creditCode: "1000",
        confidence: 0.88,
        tax: { vatApplicable: false, whtApplicable: false },
        budget: { category: "Operations" },
    },

    // ─── SUBSCRIPTIONS ─────────────────────────────────────────────────
    {
        pattern: /subscription|saas|netflix|spotify|youtube|microsoft|google\s*workspace|slack|zoom/i,
        nature: "operating_expense",
        category: "subscriptions",
        categoryLabel: "Subscriptions & Software",
        debitCode: "5620",
        creditCode: "1000",
        confidence: 0.85,
        tax: { vatApplicable: true, vatCategory: "input" },
        budget: { category: "Technology", department: "Engineering" },
    },

    // ─── BANK CHARGES ──────────────────────────────────────────────────
    {
        pattern: /bank\s*charge|maintenance\s*fee|sms\s*alert|alert\s*charge|commission|comm\s*on\s*turnover|\bcot\b|vat\s*on\s*charge/i,
        nature: "operating_expense",
        category: "bank-charges",
        categoryLabel: "Bank Charges",
        debitCode: "6030",
        creditCode: "1000",
        confidence: 0.93,
        tax: { vatApplicable: true, vatCategory: "input" },
        budget: { category: "Bank Charges", department: "Finance" },
    },

    // ─── ASSET PURCHASES ──────────────────────────────────────────────
    {
        pattern: /laptop|computer|server|printer|equipment|machinery/i,
        nature: "asset_purchase",
        category: "equipment",
        categoryLabel: "Equipment Purchase",
        debitCode: "1540",
        creditCode: "1000",
        confidence: 0.82,
        tax: { vatApplicable: true, vatCategory: "input" },
        budget: { category: "Technology" },
    },
    {
        pattern: /vehicle|car|truck|motorcycle|van\s*purchase/i,
        nature: "asset_purchase",
        category: "vehicles",
        categoryLabel: "Vehicle Purchase",
        debitCode: "1550",
        creditCode: "1000",
        confidence: 0.82,
        tax: { vatApplicable: true, vatCategory: "input" },
    },
    {
        pattern: /furniture|fittings?|desk|chair|cabinet|shelv/i,
        nature: "asset_purchase",
        category: "furniture",
        categoryLabel: "Furniture & Fittings",
        debitCode: "1530",
        creditCode: "1000",
        confidence: 0.82,
        tax: { vatApplicable: true, vatCategory: "input" },
    },

    // ─── LOANS ─────────────────────────────────────────────────────────
    {
        pattern: /loan\s*repay|installment|credit\s*repay|emi|mortgage\s*pay/i,
        nature: "financing",
        category: "loan-repayment",
        categoryLabel: "Loan Repayment",
        debitCode: "2300",
        creditCode: "1000",
        confidence: 0.88,
        tax: { vatApplicable: false, whtApplicable: false },
    },
    {
        pattern: /loan\s*disburs|credit\s*receiv|facility|overdraft/i,
        nature: "financing",
        category: "loan-received",
        categoryLabel: "Loan Received",
        debitCode: "1000",
        creditCode: "2300",
        confidence: 0.85,
        tax: { vatApplicable: false, whtApplicable: false },
    },

    // ─── POS SALES (credit / inflow) ──────────────────────────────────
    {
        pattern: /pos\s*(credit|settlement|merchant|payment\s*received)/i,
        nature: "revenue",
        category: "pos-sales",
        categoryLabel: "POS Sales Income",
        debitCode: "1000",
        creditCode: "4000",
        confidence: 0.88,
        tax: { vatApplicable: true, vatCategory: "output" },
        budget: { category: "Revenue", department: "Sales" },
    },

    // ─── GENERIC POS (debit / spending) ───────────────────────────────
    {
        pattern: /^pos\b|pos\/|pos\s*purchase|web\s*pos/i,
        nature: "operating_expense",
        category: "pos-purchase",
        categoryLabel: "POS Purchase",
        debitCode: "5820",
        creditCode: "1000",
        confidence: 0.72,
        tax: { vatApplicable: true, vatCategory: "input" },
    },

    // ─── INCOME PATTERNS ──────────────────────────────────────────────
    {
        pattern: /invoice\s*pay|payment\s*received|inward|credit\s*alert|customer\s*pay/i,
        nature: "revenue",
        category: "sales-revenue",
        categoryLabel: "Sales Revenue",
        debitCode: "1000",
        creditCode: "4000",
        confidence: 0.85,
        tax: { vatApplicable: true, vatCategory: "output" },
        budget: { category: "Revenue", department: "Sales" },
    },
    {
        pattern: /dividend|interest\s*earned|interest\s*credit|yield/i,
        nature: "revenue",
        category: "investment-income",
        categoryLabel: "Investment Income",
        debitCode: "1000",
        creditCode: "4500",
        confidence: 0.88,
        tax: {
            vatApplicable: false,
            whtApplicable: true,
            whtRate: WHT_RATES.dividend,
            whtType: "interest",
        },
    },
    {
        pattern: /refund|reversal|chargeback/i,
        nature: "other",
        category: "refund",
        categoryLabel: "Refund/Reversal",
        debitCode: "1000",
        creditCode: "5820",
        confidence: 0.80,
        tax: { vatApplicable: false },
    },

    // ─── OWNER'S TRANSACTIONS ─────────────────────────────────────────
    {
        pattern: /capital\s*inject|owner\s*invest|equity\s*contrib/i,
        nature: "equity",
        category: "owner-investment",
        categoryLabel: "Owner's Capital Investment",
        debitCode: "1000",
        creditCode: "3000",
        confidence: 0.85,
        tax: { vatApplicable: false, whtApplicable: false },
    },
    {
        pattern: /owner\s*draw|personal\s*withdraw|director\s*draw/i,
        nature: "equity",
        category: "owner-drawing",
        categoryLabel: "Owner's Drawing",
        debitCode: "3200",
        creditCode: "1000",
        confidence: 0.82,
        tax: { vatApplicable: false, whtApplicable: false },
    },

    // ─── INTER-ACCOUNT TRANSFERS ───────────────────────────────────────
    {
        pattern: /transfer\s*to\s*(self|own|my|savings|current)|self\s*transfer|internal\s*transfer/i,
        nature: "transfer",
        category: "inter-account",
        categoryLabel: "Inter-Account Transfer",
        debitCode: "1000",
        creditCode: "1000",
        confidence: 0.85,
        tax: { vatApplicable: false, whtApplicable: false },
    },
];

// =============================================================================
// AMOUNT-BASED HEURISTICS
// =============================================================================

/**
 * Apply amount-based heuristics to refine classification.
 * Nigerian business patterns:
 *  - Bank charges are typically < ₦10,000
 *  - Salary is typically > ₦50,000
 *  - Asset purchases are typically > ₦100,000
 */
function applyAmountHeuristics(
    result: ClassificationResult,
    tx: InboundBankTransaction
): ClassificationResult {
    const amount = tx.amount;

    // Bank charges over ₦50,000 are unusual — likely misclassified
    if (result.category === "bank-charges" && amount > 50_000) {
        return {
            ...result,
            confidence: Math.max(0.5, result.confidence - 0.2),
            warnings: `Amount ₦${amount.toLocaleString()} unusually high for bank charges`,
        } as ClassificationResult & { warnings: string };
    }

    // Very small inflows (< ₦1000) on credit are probably interest/refunds, not sales
    if (result.nature === "revenue" && tx.direction === "credit" && amount < 1000) {
        return {
            ...result,
            category: "other-income",
            categoryLabel: "Other Income",
            creditAccountCode: "4500",
            creditAccountName: accountName("4500"),
            confidence: Math.max(0.6, result.confidence - 0.1),
        };
    }

    // Large debit amounts (> ₦500,000) on generic categories may be asset purchases
    if (
        result.nature === "operating_expense" &&
        result.category === "pos-purchase" &&
        amount > 500_000
    ) {
        return {
            ...result,
            nature: "asset_purchase",
            category: "equipment",
            categoryLabel: "Possible Asset Purchase",
            debitAccountCode: "1540",
            debitAccountName: accountName("1540"),
            confidence: Math.max(0.55, result.confidence - 0.15),
            reasoning: `Large POS transaction (₦${amount.toLocaleString()}) may be a capital purchase`,
        };
    }

    return result;
}

// =============================================================================
// CORE CLASSIFIER
// =============================================================================

/**
 * Classify a single bank transaction using Nigerian narration patterns.
 *
 * The classification properly handles direction:
 *  - CREDIT (money in): DR Bank, CR Income/Liability/Equity account
 *  - DEBIT (money out): DR Expense/Asset/Liability account, CR Bank
 */
export function classifyBankTransaction(
    tx: InboundBankTransaction,
    bankAccountCode = "1000"
): ClassificationResult {
    const text = `${tx.description} ${tx.narration || ""} ${tx.counterparty || ""}`.trim();
    const isCredit = tx.direction === "credit";

    // Layer 1: Pattern matching
    for (const rule of NARRATION_RULES) {
        if (rule.pattern.test(text)) {
            const vatAmount =
                rule.tax.vatApplicable && rule.tax.vatCategory
                    ? roundNaira(tx.amount * (VAT_RATE / (1 + VAT_RATE)))
                    : 0;
            const whtAmount =
                rule.tax.whtApplicable && rule.tax.whtRate
                    ? roundNaira(tx.amount * rule.tax.whtRate)
                    : 0;

            // Build the double-entry based on direction
            let debitCode: string;
            let creditCode: string;

            if (isCredit) {
                // Money coming in → DR Bank, CR the classified account
                debitCode = bankAccountCode;
                creditCode = rule.nature === "financing" && rule.category === "loan-received"
                    ? rule.creditCode // Loan: DR Bank, CR Loan Payable
                    : (rule.creditCode !== "1000" ? rule.creditCode : rule.debitCode);
            } else {
                // Money going out → DR the classified account, CR Bank
                debitCode = rule.debitCode !== "1000" ? rule.debitCode : rule.creditCode;
                creditCode = bankAccountCode;
            }

            const base: ClassificationResult = {
                nature: rule.nature,
                category: rule.category,
                categoryLabel: rule.categoryLabel,
                debitAccountCode: debitCode,
                debitAccountName: accountName(debitCode),
                creditAccountCode: creditCode,
                creditAccountName: accountName(creditCode),
                confidence: rule.confidence,
                source: "rule",
                reasoning: `Matched narration pattern: ${rule.pattern.source}`,
                tax: {
                    vatApplicable: rule.tax.vatApplicable ?? false,
                    vatCategory: rule.tax.vatCategory,
                    vatAmount,
                    whtApplicable: rule.tax.whtApplicable ?? false,
                    whtRate: rule.tax.whtRate ?? 0,
                    whtAmount,
                    whtType: rule.tax.whtType,
                    cgtApplicable: rule.tax.cgtApplicable ?? false,
                    stampDutyApplicable: rule.tax.stampDutyApplicable ?? false,
                },
                budget: {
                    category: rule.budget?.category,
                    department: rule.budget?.department,
                },
            };

            return applyAmountHeuristics(base, tx);
        }
    }

    // Layer 2: Generic fallback based on direction + channel
    if (isCredit) {
        const vatAmount = roundNaira(tx.amount * (VAT_RATE / (1 + VAT_RATE)));
        return {
            nature: "revenue",
            category: "other-income",
            categoryLabel: "Other Income",
            debitAccountCode: bankAccountCode,
            debitAccountName: accountName(bankAccountCode),
            creditAccountCode: "4500",
            creditAccountName: accountName("4500"),
            confidence: 0.55,
            source: "rule",
            reasoning: "Unmatched credit transaction — classified as Other Income",
            tax: {
                vatApplicable: true,
                vatCategory: "output",
                vatAmount,
                whtApplicable: false,
                whtRate: 0,
                whtAmount: 0,
                cgtApplicable: false,
                stampDutyApplicable: false,
            },
            budget: {},
        };
    }

    return {
        nature: "operating_expense",
        category: "other-expense",
        categoryLabel: "Other Expense",
        debitAccountCode: "5820",
        debitAccountName: accountName("5820"),
        creditAccountCode: bankAccountCode,
        creditAccountName: accountName(bankAccountCode),
        confidence: 0.50,
        source: "rule",
        reasoning: "Unmatched debit transaction — classified as Other Expense",
        tax: {
            vatApplicable: true,
            vatCategory: "input",
            vatAmount: roundNaira(tx.amount * (VAT_RATE / (1 + VAT_RATE))),
            whtApplicable: false,
            whtRate: 0,
            whtAmount: 0,
            cgtApplicable: false,
            stampDutyApplicable: false,
        },
        budget: {},
    };
}

function resolveGeminiApiKey(): string {
    const keys = [
        process.env.GOOGLE_GEMINI_API_KEY,
        process.env.GEMINI_API_KEY,
        process.env.GOOGLE_API_KEY,
        process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY,
        process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    ];

    for (const key of keys) {
        const value = (key || "").trim();
        if (value && value !== "your_api_key_here") return value;
    }
    return "";
}

function resolveGeminiModels(): string[] {
    const configured = (process.env.GOOGLE_GEMINI_MODEL || process.env.GEMINI_MODEL || "").trim();
    const models = configured
        ? [configured, ...DEFAULT_GEMINI_MODEL_CANDIDATES]
        : DEFAULT_GEMINI_MODEL_CANDIDATES;
    return Array.from(new Set(models));
}

function toTitleCase(value: string): string {
    return value
        .replace(/[_-]+/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => token[0].toUpperCase() + token.slice(1).toLowerCase())
        .join(" ");
}

function extractJsonObject(rawText: string): string | null {
    const start = rawText.indexOf("{");
    const end = rawText.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    return rawText.slice(start, end + 1);
}

function parseGeminiCandidate(rawText: string): GeminiClassificationCandidate | null {
    const parsedJson = extractJsonObject(rawText);
    if (!parsedJson) return null;

    try {
        const parsed = JSON.parse(parsedJson) as GeminiClassificationCandidate;
        if (!parsed || typeof parsed !== "object") return null;
        return parsed;
    } catch {
        return null;
    }
}

function normalizeNature(value: string | undefined, fallback: TransactionNature): TransactionNature {
    if (!value) return fallback;
    const normalized = value.trim().toLowerCase();
    if (NATURES.includes(normalized as TransactionNature)) {
        return normalized as TransactionNature;
    }
    return fallback;
}

function normalizeAccountCode(code: string | undefined): string | null {
    if (!code) return null;
    const cleaned = code.trim();
    if (!/^\d{4}$/.test(cleaned)) return null;
    return findAccount(cleaned) ? cleaned : null;
}

function normalizeVatCategory(
    value: string | undefined,
    fallback: ClassificationResult["tax"]["vatCategory"]
): ClassificationResult["tax"]["vatCategory"] {
    if (!value) return fallback;
    const normalized = value.toLowerCase();
    if (normalized === "output" || normalized === "input" || normalized === "exempt" || normalized === "zero_rated") {
        return normalized;
    }
    return fallback;
}

function coerceBoolean(value: unknown, fallback = false): boolean {
    if (typeof value === "boolean") return value;
    return fallback;
}

function coerceNumber(value: unknown, fallback = 0): number {
    const cast = Number(value);
    return Number.isFinite(cast) ? cast : fallback;
}

function clampConfidence(value: unknown, fallback: number): number {
    const cast = Number(value);
    if (!Number.isFinite(cast)) return fallback;
    return Math.max(0, Math.min(1, cast));
}

async function requestGeminiClassification(tx: InboundBankTransaction, baseline: ClassificationResult): Promise<GeminiClassificationCandidate | null> {
    const apiKey = resolveGeminiApiKey();
    if (!apiKey) return null;

    const prompt = `You are a Nigerian IFRS accounting transaction classifier.
Return STRICT JSON only, no markdown.

Allowed natures: ${NATURES.join(", ")}

Chart of accounts (code | name | type):
${ACCOUNT_CATALOG_PROMPT}

Transaction:
${JSON.stringify(
        {
            id: tx.id,
            date: tx.date,
            description: tx.description,
            narration: tx.narration || "",
            amount: tx.amount,
            direction: tx.direction,
            counterparty: tx.counterparty || "",
            channel: tx.channel || "",
            currency: tx.currency || "NGN",
        },
        null,
        2
    )}

Baseline classification:
${JSON.stringify(baseline, null, 2)}

Response JSON schema:
{
  "nature": "operating_expense",
  "category": "short-machine-name",
  "categoryLabel": "Human label",
  "debitAccountCode": "1234",
  "creditAccountCode": "5678",
  "confidence": 0.0,
  "reasoning": "short reason",
  "tax": {
    "vatApplicable": false,
    "vatCategory": "output|input|exempt|zero_rated",
    "vatAmount": 0,
    "whtApplicable": false,
    "whtRate": 0,
    "whtAmount": 0,
    "whtType": "optional",
    "cgtApplicable": false,
    "stampDutyApplicable": false
  },
  "budget": {
    "category": "optional",
    "department": "optional"
  }
}`;

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const models = resolveGeminiModels();
    let lastError: unknown = null;

    for (const modelName of models) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const response = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1 },
            });

            const text = response.response.text();
            if (!text || !text.trim()) continue;

            const parsed = parseGeminiCandidate(text);
            if (parsed) return parsed;
        } catch (error) {
            lastError = error;
            console.error(`[BankClassifier] Gemini model ${modelName} failed:`, error);
        }
    }

    if (lastError) {
        throw new Error(lastError instanceof Error ? lastError.message : "Gemini classification failed");
    }
    return null;
}

function buildAiClassification(
    candidate: GeminiClassificationCandidate,
    tx: InboundBankTransaction,
    bankAccountCode: string,
    baseline: ClassificationResult
): ClassificationResult | null {
    const isCredit = tx.direction === "credit";

    const aiDebit = normalizeAccountCode(candidate.debitAccountCode);
    const aiCredit = normalizeAccountCode(candidate.creditAccountCode);

    const fallbackCounterparty = isCredit ? baseline.creditAccountCode : baseline.debitAccountCode;
    const suggestedCounterparty =
        isCredit
            ? (aiCredit && aiCredit !== bankAccountCode ? aiCredit : aiDebit)
            : (aiDebit && aiDebit !== bankAccountCode ? aiDebit : aiCredit);

    const counterpartyCode = normalizeAccountCode(suggestedCounterparty || fallbackCounterparty);
    if (!counterpartyCode) return null;

    const debitCode = isCredit ? bankAccountCode : counterpartyCode;
    const creditCode = isCredit ? counterpartyCode : bankAccountCode;

    const vatCategory = normalizeVatCategory(candidate.tax?.vatCategory, baseline.tax.vatCategory);
    const vatApplicable = coerceBoolean(candidate.tax?.vatApplicable, baseline.tax.vatApplicable);
    const fallbackVatAmount = vatApplicable && (vatCategory === "input" || vatCategory === "output")
        ? roundNaira(tx.amount * (VAT_RATE / (1 + VAT_RATE)))
        : 0;

    const whtApplicable = coerceBoolean(candidate.tax?.whtApplicable, baseline.tax.whtApplicable);
    const whtRate = Math.max(0, coerceNumber(candidate.tax?.whtRate, baseline.tax.whtRate));
    const fallbackWhtAmount = whtApplicable ? roundNaira(tx.amount * whtRate) : 0;

    return {
        nature: normalizeNature(candidate.nature, baseline.nature),
        category: (candidate.category || baseline.category || "other").trim(),
        categoryLabel: (candidate.categoryLabel || toTitleCase(candidate.category || baseline.category || "other")).trim(),
        debitAccountCode: debitCode,
        debitAccountName: accountName(debitCode),
        creditAccountCode: creditCode,
        creditAccountName: accountName(creditCode),
        confidence: clampConfidence(candidate.confidence, baseline.confidence),
        source: "hybrid",
        reasoning: (candidate.reasoning || "Gemini-assisted fallback classification for ambiguous transaction").trim(),
        tax: {
            vatApplicable,
            vatCategory,
            vatAmount: roundNaira(coerceNumber(candidate.tax?.vatAmount, fallbackVatAmount)),
            whtApplicable,
            whtRate,
            whtAmount: roundNaira(coerceNumber(candidate.tax?.whtAmount, fallbackWhtAmount)),
            whtType: candidate.tax?.whtType || baseline.tax.whtType,
            cgtApplicable: coerceBoolean(candidate.tax?.cgtApplicable, baseline.tax.cgtApplicable),
            stampDutyApplicable: coerceBoolean(candidate.tax?.stampDutyApplicable, baseline.tax.stampDutyApplicable),
        },
        budget: {
            category: candidate.budget?.category || baseline.budget.category,
            department: candidate.budget?.department || baseline.budget.department,
        },
    };
}

/**
 * Classify with optional Gemini fallback.
 * Falls back to deterministic rule-based classification if Gemini is unavailable.
 */
export async function classifyBankTransactionWithAI(
    tx: InboundBankTransaction,
    bankAccountCode = "1000"
): Promise<ClassificationResult> {
    const baseline = classifyBankTransaction(tx, bankAccountCode);
    if (baseline.confidence >= GEMINI_FALLBACK_CONFIDENCE_THRESHOLD) {
        return baseline;
    }

    try {
        const candidate = await requestGeminiClassification(tx, baseline);
        if (!candidate) return baseline;

        const aiResult = buildAiClassification(candidate, tx, bankAccountCode, baseline);
        return aiResult ?? baseline;
    } catch (error) {
        console.error("[BankClassifier] Gemini fallback failed:", error);
        return baseline;
    }
}

/**
 * Classify a batch of transactions
 */
export function classifyBankTransactions(
    transactions: InboundBankTransaction[],
    bankAccountCode = "1000"
): Map<string, ClassificationResult> {
    const results = new Map<string, ClassificationResult>();
    for (const tx of transactions) {
        results.set(tx.id, classifyBankTransaction(tx, bankAccountCode));
    }
    return results;
}

export async function classifyBankTransactionsWithAI(
    transactions: InboundBankTransaction[],
    bankAccountCode = "1000"
): Promise<Map<string, ClassificationResult>> {
    const results = new Map<string, ClassificationResult>();
    for (const tx of transactions) {
        results.set(tx.id, await classifyBankTransactionWithAI(tx, bankAccountCode));
    }
    return results;
}

// =============================================================================
// HELPERS
// =============================================================================

function roundNaira(amount: number): number {
    return Math.round(amount * 100) / 100;
}
