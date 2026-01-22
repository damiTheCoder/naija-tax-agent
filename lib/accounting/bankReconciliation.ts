/**
 * Bank Reconciliation Engine
 * 
 * Handles parsing, matching, and discrepancy detection for bank statements
 * and internal ledger/journal entries.
 */

// ============================================
// TYPES
// ============================================

export interface BankTransaction {
    id: string;
    date: string;
    description: string;
    reference?: string;
    debit?: number;
    credit?: number;
    balance?: number;
    amount: number; // Positive for credit, negative for debit
    rawLine?: string;
}

export interface LedgerTransaction {
    id: string;
    date: string;
    narration: string;
    reference?: string;
    accountCode?: string;
    accountName?: string;
    debit: number;
    credit: number;
    amount: number; // Net amount (debit - credit or credit - debit depending on context)
}

export interface MatchedPair {
    id: string;
    bankTransaction: BankTransaction;
    ledgerTransaction: LedgerTransaction;
    confidence: number; // 0-1 scale
    matchType: 'exact' | 'fuzzy' | 'manual';
    matchedOn: string[]; // Fields that matched (date, amount, reference)
}

export interface DiscrepancyItem {
    id: string;
    type: 'unmatched_bank' | 'unmatched_ledger' | 'amount_difference' | 'timing_difference' | 'duplicate' | 'missing_reference';
    severity: 'low' | 'medium' | 'high';
    description: string;
    bankTransaction?: BankTransaction;
    ledgerTransaction?: LedgerTransaction;
    difference?: number;
    recommendation?: string;
}

export interface ReconciliationResult {
    id: string;
    reconciliationDate: string;
    bankStatementPeriod: { start: string; end: string };
    bankOpeningBalance: number;
    bankClosingBalance: number;
    ledgerOpeningBalance: number;
    ledgerClosingBalance: number;
    totalBankTransactions: number;
    totalLedgerTransactions: number;
    matchedPairs: MatchedPair[];
    discrepancies: DiscrepancyItem[];
    unmatchedBankTransactions: BankTransaction[];
    unmatchedLedgerTransactions: LedgerTransaction[];
    summary: {
        matchedCount: number;
        unmatchedBankCount: number;
        unmatchedLedgerCount: number;
        discrepancyCount: number;
        balanceDifference: number;
        reconciliationStatus: 'balanced' | 'unbalanced' | 'pending';
    };
}

export interface ParsedFile {
    type: 'bank_statement' | 'ledger';
    filename: string;
    transactions: BankTransaction[] | LedgerTransaction[];
    metadata: {
        totalRecords: number;
        dateRange: { start: string; end: string };
        totalDebits: number;
        totalCredits: number;
    };
}

// ============================================
// PARSERS
// ============================================

/**
 * Parse CSV content into bank transactions
 * Supports common bank statement formats
 */
export function parseBankStatementCSV(csvContent: string, filename: string): ParsedFile {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
        throw new Error('CSV file must have at least a header row and one data row');
    }

    const header = lines[0].toLowerCase();
    const transactions: BankTransaction[] = [];

    // Detect column positions based on header
    const columns = parseCSVLine(lines[0]);
    const dateCol = findColumnIndex(columns, ['date', 'transaction date', 'posted date', 'value date']);
    const descCol = findColumnIndex(columns, ['description', 'narration', 'details', 'particulars', 'memo']);
    const refCol = findColumnIndex(columns, ['reference', 'ref', 'cheque no', 'check no', 'transaction id']);
    const debitCol = findColumnIndex(columns, ['debit', 'withdrawal', 'dr', 'amount out']);
    const creditCol = findColumnIndex(columns, ['credit', 'deposit', 'cr', 'amount in']);
    const amountCol = findColumnIndex(columns, ['amount', 'transaction amount']);
    const balanceCol = findColumnIndex(columns, ['balance', 'closing balance', 'running balance']);

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0 || values.every(v => !v.trim())) continue;

        const debit = debitCol >= 0 ? parseAmount(values[debitCol]) : 0;
        const credit = creditCol >= 0 ? parseAmount(values[creditCol]) : 0;
        let amount = 0;

        if (amountCol >= 0) {
            amount = parseAmount(values[amountCol]);
        } else {
            amount = credit - debit;
        }

        transactions.push({
            id: `bank-${i}-${Date.now()}`,
            date: dateCol >= 0 ? parseDate(values[dateCol]) : '',
            description: descCol >= 0 ? (values[descCol] || '').trim() : '',
            reference: refCol >= 0 ? (values[refCol] || '').trim() : undefined,
            debit: debit || undefined,
            credit: credit || undefined,
            balance: balanceCol >= 0 ? parseAmount(values[balanceCol]) : undefined,
            amount,
            rawLine: lines[i],
        });
    }

    const dates = transactions.map(t => t.date).filter(d => d).sort();
    const totalDebits = transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
    const totalCredits = transactions.reduce((sum, t) => sum + (t.credit || 0), 0);

    return {
        type: 'bank_statement',
        filename,
        transactions,
        metadata: {
            totalRecords: transactions.length,
            dateRange: {
                start: dates[0] || '',
                end: dates[dates.length - 1] || '',
            },
            totalDebits,
            totalCredits,
        },
    };
}

/**
 * Parse CSV content into ledger transactions
 * Supports journal/ledger export formats
 */
export function parseLedgerCSV(csvContent: string, filename: string): ParsedFile {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
        throw new Error('CSV file must have at least a header row and one data row');
    }

    const columns = parseCSVLine(lines[0]);
    const dateCol = findColumnIndex(columns, ['date', 'entry date', 'journal date', 'posted date']);
    const narrationCol = findColumnIndex(columns, ['narration', 'description', 'memo', 'details', 'particulars']);
    const refCol = findColumnIndex(columns, ['reference', 'ref', 'journal no', 'entry id', 'voucher no']);
    const accountCodeCol = findColumnIndex(columns, ['account code', 'code', 'gl code', 'account no']);
    const accountNameCol = findColumnIndex(columns, ['account name', 'account', 'gl account']);
    const debitCol = findColumnIndex(columns, ['debit', 'dr', 'debit amount']);
    const creditCol = findColumnIndex(columns, ['credit', 'cr', 'credit amount']);

    const transactions: LedgerTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0 || values.every(v => !v.trim())) continue;

        const debit = debitCol >= 0 ? parseAmount(values[debitCol]) : 0;
        const credit = creditCol >= 0 ? parseAmount(values[creditCol]) : 0;

        transactions.push({
            id: `ledger-${i}-${Date.now()}`,
            date: dateCol >= 0 ? parseDate(values[dateCol]) : '',
            narration: narrationCol >= 0 ? (values[narrationCol] || '').trim() : '',
            reference: refCol >= 0 ? (values[refCol] || '').trim() : undefined,
            accountCode: accountCodeCol >= 0 ? (values[accountCodeCol] || '').trim() : undefined,
            accountName: accountNameCol >= 0 ? (values[accountNameCol] || '').trim() : undefined,
            debit,
            credit,
            amount: debit > 0 ? -debit : credit,
        });
    }

    const dates = transactions.map(t => t.date).filter(d => d).sort();
    const totalDebits = transactions.reduce((sum, t) => sum + t.debit, 0);
    const totalCredits = transactions.reduce((sum, t) => sum + t.credit, 0);

    return {
        type: 'ledger',
        filename,
        transactions,
        metadata: {
            totalRecords: transactions.length,
            dateRange: {
                start: dates[0] || '',
                end: dates[dates.length - 1] || '',
            },
            totalDebits,
            totalCredits,
        },
    };
}

// ============================================
// MATCHING ENGINE
// ============================================

/**
 * Auto-match bank transactions with ledger transactions
 */
export function matchTransactions(
    bankTransactions: BankTransaction[],
    ledgerTransactions: LedgerTransaction[]
): {
    matched: MatchedPair[];
    unmatchedBank: BankTransaction[];
    unmatchedLedger: LedgerTransaction[];
} {
    const matched: MatchedPair[] = [];
    const usedBankIds = new Set<string>();
    const usedLedgerIds = new Set<string>();

    // Pass 1: Exact matches (same date, amount, and reference)
    for (const bank of bankTransactions) {
        if (usedBankIds.has(bank.id)) continue;

        for (const ledger of ledgerTransactions) {
            if (usedLedgerIds.has(ledger.id)) continue;

            const matchResult = calculateMatch(bank, ledger);
            if (matchResult.confidence >= 0.95) {
                matched.push({
                    id: `match-${matched.length + 1}`,
                    bankTransaction: bank,
                    ledgerTransaction: ledger,
                    confidence: matchResult.confidence,
                    matchType: 'exact',
                    matchedOn: matchResult.matchedOn,
                });
                usedBankIds.add(bank.id);
                usedLedgerIds.add(ledger.id);
                break;
            }
        }
    }

    // Pass 2: Fuzzy matches (similar date, same amount)
    for (const bank of bankTransactions) {
        if (usedBankIds.has(bank.id)) continue;

        let bestMatch: { ledger: LedgerTransaction; confidence: number; matchedOn: string[] } | null = null;

        for (const ledger of ledgerTransactions) {
            if (usedLedgerIds.has(ledger.id)) continue;

            const matchResult = calculateMatch(bank, ledger);
            if (matchResult.confidence >= 0.7 && (!bestMatch || matchResult.confidence > bestMatch.confidence)) {
                bestMatch = { ledger, confidence: matchResult.confidence, matchedOn: matchResult.matchedOn };
            }
        }

        if (bestMatch) {
            matched.push({
                id: `match-${matched.length + 1}`,
                bankTransaction: bank,
                ledgerTransaction: bestMatch.ledger,
                confidence: bestMatch.confidence,
                matchType: 'fuzzy',
                matchedOn: bestMatch.matchedOn,
            });
            usedBankIds.add(bank.id);
            usedLedgerIds.add(bestMatch.ledger.id);
        }
    }

    const unmatchedBank = bankTransactions.filter(t => !usedBankIds.has(t.id));
    const unmatchedLedger = ledgerTransactions.filter(t => !usedLedgerIds.has(t.id));

    return { matched, unmatchedBank, unmatchedLedger };
}

function calculateMatch(
    bank: BankTransaction,
    ledger: LedgerTransaction
): { confidence: number; matchedOn: string[] } {
    let score = 0;
    const matchedOn: string[] = [];

    // Amount match (most important)
    const bankAmount = Math.abs(bank.amount);
    const ledgerAmount = Math.abs(ledger.amount);
    if (Math.abs(bankAmount - ledgerAmount) < 0.01) {
        score += 0.5;
        matchedOn.push('amount');
    } else if (Math.abs(bankAmount - ledgerAmount) / Math.max(bankAmount, ledgerAmount) < 0.01) {
        score += 0.4; // Within 1%
        matchedOn.push('amount (approximate)');
    }

    // Date match
    if (bank.date && ledger.date) {
        const bankDate = new Date(bank.date);
        const ledgerDate = new Date(ledger.date);
        const daysDiff = Math.abs((bankDate.getTime() - ledgerDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff === 0) {
            score += 0.3;
            matchedOn.push('date');
        } else if (daysDiff <= 3) {
            score += 0.2;
            matchedOn.push('date (within 3 days)');
        } else if (daysDiff <= 7) {
            score += 0.1;
            matchedOn.push('date (within 7 days)');
        }
    }

    // Reference match
    if (bank.reference && ledger.reference) {
        const bankRef = bank.reference.toLowerCase().replace(/\s+/g, '');
        const ledgerRef = ledger.reference.toLowerCase().replace(/\s+/g, '');
        if (bankRef === ledgerRef) {
            score += 0.2;
            matchedOn.push('reference');
        } else if (bankRef.includes(ledgerRef) || ledgerRef.includes(bankRef)) {
            score += 0.1;
            matchedOn.push('reference (partial)');
        }
    }

    // Description similarity (basic)
    const bankDesc = (bank.description || '').toLowerCase();
    const ledgerNarr = (ledger.narration || '').toLowerCase();
    if (bankDesc && ledgerNarr) {
        const words = bankDesc.split(/\s+/).filter(w => w.length > 3);
        const matchingWords = words.filter(w => ledgerNarr.includes(w));
        if (matchingWords.length >= 2) {
            score += 0.1;
            matchedOn.push('description');
        }
    }

    return { confidence: Math.min(score, 1), matchedOn };
}

// ============================================
// DISCREPANCY DETECTION
// ============================================

export function detectDiscrepancies(
    matchResult: {
        matched: MatchedPair[];
        unmatchedBank: BankTransaction[];
        unmatchedLedger: LedgerTransaction[];
    }
): DiscrepancyItem[] {
    const discrepancies: DiscrepancyItem[] = [];

    // Unmatched bank transactions
    for (const bank of matchResult.unmatchedBank) {
        discrepancies.push({
            id: `disc-bank-${bank.id}`,
            type: 'unmatched_bank',
            severity: Math.abs(bank.amount) > 100000 ? 'high' : Math.abs(bank.amount) > 10000 ? 'medium' : 'low',
            description: `Bank transaction not found in ledger: ${bank.description}`,
            bankTransaction: bank,
            difference: bank.amount,
            recommendation: 'Review if this transaction was recorded in the accounting system. If valid, create a journal entry to record it.',
        });
    }

    // Unmatched ledger transactions
    for (const ledger of matchResult.unmatchedLedger) {
        const amount = ledger.debit > 0 ? ledger.debit : ledger.credit;
        discrepancies.push({
            id: `disc-ledger-${ledger.id}`,
            type: 'unmatched_ledger',
            severity: amount > 100000 ? 'high' : amount > 10000 ? 'medium' : 'low',
            description: `Ledger entry not found in bank statement: ${ledger.narration}`,
            ledgerTransaction: ledger,
            difference: ledger.amount,
            recommendation: 'Verify if this is a timing difference (outstanding cheque/deposit) or an error that needs correction.',
        });
    }

    // Check for potential duplicates in bank transactions
    const bankByAmount = new Map<number, BankTransaction[]>();
    for (const bank of matchResult.unmatchedBank) {
        const key = Math.round(Math.abs(bank.amount) * 100);
        if (!bankByAmount.has(key)) bankByAmount.set(key, []);
        bankByAmount.get(key)!.push(bank);
    }

    bankByAmount.forEach((transactions, _) => {
        if (transactions.length > 1) {
            // Check if they're on the same or close dates
            for (let i = 0; i < transactions.length - 1; i++) {
                for (let j = i + 1; j < transactions.length; j++) {
                    const date1 = new Date(transactions[i].date);
                    const date2 = new Date(transactions[j].date);
                    const daysDiff = Math.abs((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysDiff <= 1) {
                        discrepancies.push({
                            id: `disc-dup-${transactions[i].id}-${transactions[j].id}`,
                            type: 'duplicate',
                            severity: 'high',
                            description: `Potential duplicate transactions detected: "${transactions[i].description}" and "${transactions[j].description}"`,
                            bankTransaction: transactions[i],
                            recommendation: 'Verify these are not duplicate entries. If one is invalid, it should be reversed or deleted.',
                        });
                    }
                }
            }
        }
    });

    return discrepancies;
}

// ============================================
// FULL RECONCILIATION
// ============================================

export function performReconciliation(
    bankData: ParsedFile,
    ledgerData: ParsedFile
): ReconciliationResult {
    const bankTransactions = bankData.transactions as BankTransaction[];
    const ledgerTransactions = ledgerData.transactions as LedgerTransaction[];

    const matchResult = matchTransactions(bankTransactions, ledgerTransactions);
    const discrepancies = detectDiscrepancies(matchResult);

    const bankTotal = bankTransactions.reduce((sum, t) => sum + t.amount, 0);
    const ledgerTotal = ledgerTransactions.reduce((sum, t) => sum + t.amount, 0);
    const balanceDifference = bankTotal - ledgerTotal;

    return {
        id: `recon-${Date.now()}`,
        reconciliationDate: new Date().toISOString().split('T')[0],
        bankStatementPeriod: bankData.metadata.dateRange,
        bankOpeningBalance: 0, // Would need to be extracted from statement
        bankClosingBalance: bankTransactions[bankTransactions.length - 1]?.balance || bankTotal,
        ledgerOpeningBalance: 0,
        ledgerClosingBalance: ledgerTotal,
        totalBankTransactions: bankTransactions.length,
        totalLedgerTransactions: ledgerTransactions.length,
        matchedPairs: matchResult.matched,
        discrepancies,
        unmatchedBankTransactions: matchResult.unmatchedBank,
        unmatchedLedgerTransactions: matchResult.unmatchedLedger,
        summary: {
            matchedCount: matchResult.matched.length,
            unmatchedBankCount: matchResult.unmatchedBank.length,
            unmatchedLedgerCount: matchResult.unmatchedLedger.length,
            discrepancyCount: discrepancies.length,
            balanceDifference,
            reconciliationStatus: Math.abs(balanceDifference) < 0.01 && discrepancies.length === 0
                ? 'balanced'
                : discrepancies.length === 0
                    ? 'pending'
                    : 'unbalanced',
        },
    };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    return result;
}

function findColumnIndex(columns: string[], possibleNames: string[]): number {
    for (let i = 0; i < columns.length; i++) {
        const col = columns[i].toLowerCase().trim();
        for (const name of possibleNames) {
            if (col === name || col.includes(name)) {
                return i;
            }
        }
    }
    return -1;
}

function parseAmount(value: string): number {
    if (!value) return 0;
    // Remove currency symbols, commas, and clean the string
    const cleaned = value.replace(/[₦$€£,\s]/g, '').trim();
    if (!cleaned) return 0;

    // Handle parentheses for negative numbers
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
        return -parseFloat(cleaned.slice(1, -1)) || 0;
    }

    return parseFloat(cleaned) || 0;
}

function parseDate(value: string): string {
    if (!value) return '';
    const trimmed = value.trim();

    // Try common date formats
    const formats = [
        // ISO format
        /^(\d{4})-(\d{2})-(\d{2})$/,
        // DD/MM/YYYY
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
        // MM/DD/YYYY
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
        // DD-MM-YYYY
        /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    ];

    // Try to parse with Date constructor first
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
    }

    // Manual parsing for DD/MM/YYYY (common in Nigeria)
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
        const [_, day, month, year] = match;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return trimmed;
}

/**
 * Format currency for display (Nigerian Naira)
 */
export function formatCurrency(amount: number): string {
    return `₦${Math.abs(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
