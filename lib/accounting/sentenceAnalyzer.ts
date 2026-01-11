/**
 * Sentence Analyzer for Transaction Classification
 * 
 * Analyzes transaction text word-by-word and sentence-level to identify
 * both debit and credit accounts with high accuracy.
 */

import {
    ACCOUNT_KEYWORD_MAP,
    ACTION_VERBS,
    AccountMapping,
    getKeywordsByPriority
} from "./accountKeywordMap";

/**
 * Result of analyzing a transaction
 */
export interface TransactionAnalysis {
    debitAccount: {
        code: string;
        name: string;
        confidence: number;
        matchedKeyword: string;
    };
    creditAccount: {
        code: string;
        name: string;
        confidence: number;
        matchedKeyword: string;
    };
    amount: number;
    flow: "inflow" | "outflow" | "transfer" | "unknown";
    isCredit: boolean; // Is this a credit transaction (involves payables/receivables)?
    assumptions: string[];
    validationLog: string[];
}

/**
 * Match result from keyword analysis
 */
interface KeywordMatch {
    keyword: string;
    account: AccountMapping;
    position: number;
    phraseLength: number; // 1 for single word, 2 for two-word phrase, etc.
}

/**
 * Analyze a raw transaction description to identify both accounts
 */
export function analyzeTransactionText(
    description: string,
    amount: number
): TransactionAnalysis {
    const text = description.toLowerCase().trim();
    const validationLog: string[] = [];
    const assumptions: string[] = [];

    validationLog.push(`Analyzing: "${description}"`);

    // Step 1: Detect transaction flow direction
    const flow = detectTransactionFlow(text);
    validationLog.push(`Flow detected: ${flow}`);

    // Step 2: Extract amount if not provided
    const extractedAmount = amount || extractAmountFromText(text);
    validationLog.push(`Amount: ${extractedAmount}`);

    // Step 3: Find all keyword matches
    const matches = findAllKeywordMatches(text);
    validationLog.push(`Keywords matched: ${matches.length}`);
    matches.forEach(m => validationLog.push(`  - "${m.keyword}" → ${m.account.name} (${m.account.code})`));

    // Step 4: Identify if this is a credit transaction
    const isCredit = detectCreditTransaction(text);
    validationLog.push(`Credit transaction: ${isCredit}`);
    if (isCredit) {
        assumptions.push("Credit transaction - involves receivables or payables");
    }

    // Step 5: Determine debit and credit accounts based on flow and matches
    const { debitAccount, creditAccount } = determineAccounts(
        matches,
        flow,
        isCredit,
        text,
        validationLog
    );

    // Add assumptions based on detection
    if (flow === "outflow") {
        assumptions.push("Money flowing OUT - we are paying");
    } else if (flow === "inflow") {
        assumptions.push("Money flowing IN - we are receiving");
    }

    return {
        debitAccount,
        creditAccount,
        amount: extractedAmount,
        flow,
        isCredit,
        assumptions,
        validationLog,
    };
}

/**
 * Detect transaction flow direction from action verbs
 */
function detectTransactionFlow(text: string): "inflow" | "outflow" | "transfer" | "unknown" {
    // Check outflow verbs first (pay, buy, spend, etc.)
    for (const verb of ACTION_VERBS.outflow) {
        if (new RegExp(`\\b${verb}\\b`, "i").test(text)) {
            return "outflow";
        }
    }

    // Check inflow verbs (receive, sell, earn, etc.)
    for (const verb of ACTION_VERBS.inflow) {
        if (new RegExp(`\\b${verb}\\b`, "i").test(text)) {
            return "inflow";
        }
    }

    // Check transfer verbs
    for (const verb of ACTION_VERBS.transfer) {
        if (new RegExp(`\\b${verb}\\b`, "i").test(text)) {
            return "transfer";
        }
    }

    return "unknown";
}

/**
 * Detect if this is a credit transaction (not cash)
 */
function detectCreditTransaction(text: string): boolean {
    const creditIndicators = [
        /\bon\s+credit\b/i,
        /\bcredit\s+sale\b/i,
        /\bcredit\s+purchase\b/i,
        /\baccount\b/i,
        /\breceivable\b/i,
        /\bpayable\b/i,
        /\binvoice\b/i,
        /\bowed\b/i,
        /\bowing\b/i,
        /\bdue\b/i,
    ];

    return creditIndicators.some(pattern => pattern.test(text));
}

/**
 * Extract amount from text
 */
function extractAmountFromText(text: string): number {
    // Match various number formats
    const patterns = [
        /₦\s?([\d,]+(?:\.\d{2})?)/,           // ₦50,000 or ₦50,000.00
        /NGN\s?([\d,]+(?:\.\d{2})?)/i,        // NGN 50000
        /([\d,]+(?:\.\d{2})?)\s?naira/i,      // 50000 naira
        /\b([\d,]+(?:\.\d{2})?)\b/g,          // Plain numbers
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const numStr = match[1].replace(/,/g, "");
            const num = parseFloat(numStr);
            if (!isNaN(num) && num > 0) {
                return num;
            }
        }
    }

    return 0;
}

/**
 * Find all keyword matches in text, preferring longer phrases
 */
function findAllKeywordMatches(text: string): KeywordMatch[] {
    const matches: KeywordMatch[] = [];
    const usedPositions = new Set<number>();

    // Get keywords sorted by priority
    const keywordsByPriority = getKeywordsByPriority();

    // First pass: find multi-word phrases (higher priority)
    for (const { keyword, mapping } of keywordsByPriority) {
        const words = keyword.split(" ");
        if (words.length > 1) {
            // Multi-word phrase
            const phrasePattern = new RegExp(`\\b${keyword.replace(/\s+/g, "\\s+")}\\b`, "gi");
            let match;
            while ((match = phrasePattern.exec(text)) !== null) {
                if (!usedPositions.has(match.index)) {
                    matches.push({
                        keyword,
                        account: mapping,
                        position: match.index,
                        phraseLength: words.length,
                    });
                    // Mark positions as used
                    for (let i = 0; i < keyword.length; i++) {
                        usedPositions.add(match.index + i);
                    }
                }
            }
        }
    }

    // Second pass: find single words (only if not already matched by phrase)
    for (const { keyword, mapping } of keywordsByPriority) {
        const words = keyword.split(" ");
        if (words.length === 1) {
            const wordPattern = new RegExp(`\\b${keyword}\\b`, "gi");
            let match;
            while ((match = wordPattern.exec(text)) !== null) {
                // Check if this position is already covered by a phrase match
                const positionUsed = Array.from(usedPositions).some(
                    pos => match!.index >= pos && match!.index < pos + keyword.length
                );

                if (!positionUsed) {
                    matches.push({
                        keyword,
                        account: mapping,
                        position: match.index,
                        phraseLength: 1,
                    });
                }
            }
        }
    }

    // Sort by position
    return matches.sort((a, b) => a.position - b.position);
}

/**
 * Determine debit and credit accounts based on matches and flow
 */
function determineAccounts(
    matches: KeywordMatch[],
    flow: "inflow" | "outflow" | "transfer" | "unknown",
    isCredit: boolean,
    text: string,
    log: string[]
): {
    debitAccount: { code: string; name: string; confidence: number; matchedKeyword: string };
    creditAccount: { code: string; name: string; confidence: number; matchedKeyword: string };
} {
    // Default accounts
    const defaultCash = { code: "1020", name: "Bank", confidence: 0.5, matchedKeyword: "default" };
    const defaultExpense = { code: "5820", name: "Office Supplies", confidence: 0.3, matchedKeyword: "default" };
    const defaultRevenue = { code: "4000", name: "Sales", confidence: 0.5, matchedKeyword: "default" };
    const defaultPurchases = { code: "5010", name: "Purchases", confidence: 0.5, matchedKeyword: "default" };
    const defaultPayable = { code: "2000", name: "Accounts Payable", confidence: 0.5, matchedKeyword: "default" };
    const defaultReceivable = { code: "1100", name: "Accounts Receivable", confidence: 0.5, matchedKeyword: "default" };

    // Group matches by account type
    const expenseMatches = matches.filter(m =>
        m.account.code.startsWith("5") || m.account.code.startsWith("6") || m.account.code.startsWith("7")
    );
    const revenueMatches = matches.filter(m => m.account.code.startsWith("4"));
    const assetMatches = matches.filter(m => m.account.code.startsWith("1"));
    const liabilityMatches = matches.filter(m => m.account.code.startsWith("2"));
    const equityMatches = matches.filter(m => m.account.code.startsWith("3"));

    log.push(`Expense matches: ${expenseMatches.length}, Revenue: ${revenueMatches.length}, Asset: ${assetMatches.length}, Liability: ${liabilityMatches.length}`);

    // Determine based on flow
    if (flow === "outflow") {
        // Money going OUT
        // Check if buying goods for resale (purchase)
        if (text.includes("purchased") || text.includes("bought") || text.includes("resale") || text.includes("goods")) {
            if (isCredit) {
                // Purchased on credit: DR Purchases, CR Accounts Payable
                const debit = expenseMatches.find(m => m.account.code === "5010")
                    ? {
                        code: "5010",
                        name: "Purchases",
                        confidence: 0.95,
                        matchedKeyword: expenseMatches.find(m => m.account.code === "5010")!.keyword
                    }
                    : { ...defaultPurchases, confidence: 0.85 };

                log.push(`Purchase on credit detected - DR Purchases, CR Accounts Payable`);
                return {
                    debitAccount: debit,
                    creditAccount: { code: "2000", name: "Accounts Payable", confidence: 0.95, matchedKeyword: "on credit" },
                };
            } else {
                // Cash purchase: DR Purchases, CR Bank
                const debit = expenseMatches.find(m => m.account.code === "5010")
                    ? {
                        code: "5010",
                        name: "Purchases",
                        confidence: 0.95,
                        matchedKeyword: expenseMatches.find(m => m.account.code === "5010")!.keyword
                    }
                    : { ...defaultPurchases, confidence: 0.85 };

                log.push(`Cash purchase detected - DR Purchases, CR Bank`);
                return {
                    debitAccount: debit,
                    creditAccount: { ...defaultCash, confidence: 0.9 },
                };
            }
        }

        // Check if buying an asset
        const assetExpenseMatches = matches.filter(m =>
            m.account.code.startsWith("15") // Fixed assets
        );
        if (assetExpenseMatches.length > 0) {
            const bestAsset = assetExpenseMatches.sort((a, b) => b.account.priority - a.account.priority)[0];
            log.push(`Asset purchase detected - DR ${bestAsset.account.name}, CR ${isCredit ? "Payable" : "Bank"}`);
            return {
                debitAccount: {
                    code: bestAsset.account.code,
                    name: bestAsset.account.name,
                    confidence: 0.9,
                    matchedKeyword: bestAsset.keyword
                },
                creditAccount: isCredit
                    ? { ...defaultPayable, confidence: 0.9 }
                    : { ...defaultCash, confidence: 0.9 },
            };
        }

        // Regular expense payment
        if (expenseMatches.length > 0) {
            // Get highest priority expense match
            const bestExpense = expenseMatches.sort((a, b) => b.account.priority - a.account.priority)[0];
            log.push(`Expense detected - DR ${bestExpense.account.name}, CR Bank`);
            return {
                debitAccount: {
                    code: bestExpense.account.code,
                    name: bestExpense.account.name,
                    confidence: bestExpense.account.priority / 100,
                    matchedKeyword: bestExpense.keyword
                },
                creditAccount: { ...defaultCash, confidence: 0.9 },
            };
        }

        // Default outflow: expense, credit bank
        log.push(`Default outflow - DR Expense, CR Bank`);
        return {
            debitAccount: defaultExpense,
            creditAccount: defaultCash,
        };
    }

    if (flow === "inflow") {
        // Money coming IN
        // Check if sale
        if (text.includes("sold") || text.includes("sale") || revenueMatches.length > 0) {
            if (isCredit) {
                // Credit sale: DR Accounts Receivable, CR Sales
                log.push(`Credit sale detected - DR Accounts Receivable, CR Sales`);
                return {
                    debitAccount: { ...defaultReceivable, confidence: 0.95 },
                    creditAccount: revenueMatches.length > 0
                        ? {
                            code: revenueMatches[0].account.code,
                            name: revenueMatches[0].account.name,
                            confidence: 0.95,
                            matchedKeyword: revenueMatches[0].keyword
                        }
                        : { ...defaultRevenue, confidence: 0.9 },
                };
            } else {
                // Cash sale: DR Bank, CR Sales
                log.push(`Cash sale detected - DR Bank, CR Sales`);
                return {
                    debitAccount: { ...defaultCash, confidence: 0.9 },
                    creditAccount: revenueMatches.length > 0
                        ? {
                            code: revenueMatches[0].account.code,
                            name: revenueMatches[0].account.name,
                            confidence: 0.95,
                            matchedKeyword: revenueMatches[0].keyword
                        }
                        : { ...defaultRevenue, confidence: 0.9 },
                };
            }
        }

        // Loan received
        if (text.includes("borrowed") || text.includes("loan")) {
            log.push(`Loan received - DR Bank, CR Loan`);
            return {
                debitAccount: { ...defaultCash, confidence: 0.9 },
                creditAccount: { code: "2500", name: "Long-term Loans", confidence: 0.9, matchedKeyword: "loan" },
            };
        }

        // Receipt from customer (AR collection)
        if (text.includes("customer") || text.includes("debtor") || text.includes("receivable")) {
            log.push(`Receipt from customer - DR Bank, CR Accounts Receivable`);
            return {
                debitAccount: { ...defaultCash, confidence: 0.9 },
                creditAccount: { ...defaultReceivable, confidence: 0.9 },
            };
        }

        // Owner investment
        if (equityMatches.length > 0 && equityMatches.some(m => m.account.code === "3000")) {
            log.push(`Owner investment - DR Bank, CR Capital`);
            return {
                debitAccount: { ...defaultCash, confidence: 0.9 },
                creditAccount: { code: "3000", name: "Owner's Capital", confidence: 0.9, matchedKeyword: "capital" },
            };
        }

        // Default inflow: bank, credit revenue
        log.push(`Default inflow - DR Bank, CR Revenue`);
        return {
            debitAccount: defaultCash,
            creditAccount: defaultRevenue,
        };
    }

    // Unknown flow - try to determine from matches
    log.push(`Unknown flow - determining from matches`);

    if (expenseMatches.length > 0) {
        const bestExpense = expenseMatches.sort((a, b) => b.account.priority - a.account.priority)[0];
        return {
            debitAccount: {
                code: bestExpense.account.code,
                name: bestExpense.account.name,
                confidence: bestExpense.account.priority / 100,
                matchedKeyword: bestExpense.keyword
            },
            creditAccount: isCredit ? defaultPayable : defaultCash,
        };
    }

    if (revenueMatches.length > 0) {
        const bestRevenue = revenueMatches.sort((a, b) => b.account.priority - a.account.priority)[0];
        return {
            debitAccount: isCredit ? defaultReceivable : defaultCash,
            creditAccount: {
                code: bestRevenue.account.code,
                name: bestRevenue.account.name,
                confidence: bestRevenue.account.priority / 100,
                matchedKeyword: bestRevenue.keyword
            },
        };
    }

    // Final fallback
    return {
        debitAccount: defaultExpense,
        creditAccount: defaultCash,
    };
}

/**
 * Validate that debit equals credit (for a single transaction, both should be the same amount)
 */
export function validateDoubleEntry(
    debitAmount: number,
    creditAmount: number
): { valid: boolean; message: string } {
    if (Math.abs(debitAmount - creditAmount) < 0.01) {
        return { valid: true, message: "Balanced" };
    }
    return {
        valid: false,
        message: `Unbalanced: Debit ${debitAmount} ≠ Credit ${creditAmount}`
    };
}
