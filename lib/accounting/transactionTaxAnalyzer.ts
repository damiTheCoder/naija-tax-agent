/**
 * Nigerian Transaction Tax Analyzer
 * 
 * Analyzes accounting transactions and computes all applicable Nigerian taxes
 * based on 2026 Nigerian Tax Laws (Nigeria Tax Reform Acts).
 * 
 * STRICT ACCOUNTING LOGIC:
 * 1. Transaction Taxes (VAT, WHT, CGT) -> Calculated per transaction
 * 2. Period Taxes (CIT, Dev Levy, PAYE) -> Calculated on aggregated period totals
 */

import { JournalEntry, CHART_OF_ACCOUNTS, AccountDefinition, formatCurrency } from "./doubleEntry";

// ============================================================================
// 2026 NIGERIAN TAX RATES
// ============================================================================

export const TAX_RATES_2026 = {
    // VAT
    VAT_RATE: 0.075, // 7.5%

    // WHT Rates
    WHT_PROFESSIONAL_SERVICES: 0.10, // 10%
    WHT_DIVIDENDS_RESIDENT: 0.10, // 10%
    WHT_INTEREST_FX: 0.10, // 10% on FX deposits
    WHT_RENT: 0.10, // 10%
    WHT_ROYALTIES: 0.05, // 5%

    // PAYE Progressive Rates (2026 Reform)
    PAYE_BANDS: [
        { limit: 800000, rate: 0 }, // 0% up to ₦800K
        { limit: 3000000, rate: 0.15 }, // 15% for ₦800K - ₦3M
        { limit: 12000000, rate: 0.18 }, // 18% for ₦3M - ₦12M
        { limit: 25000000, rate: 0.21 }, // 21% for ₦12M - ₦25M
        { limit: 50000000, rate: 0.23 }, // 23% for ₦25M - ₦50M
        { limit: Infinity, rate: 0.25 }, // 25% above ₦50M
    ],

    // CIT
    CIT_RATE: 0.30, // 30%
    CIT_SMALL_COMPANY_THRESHOLD: 50000000, // ₦50M (exempt)

    // Development Levy (2026 - replaces previous levies)
    DEVELOPMENT_LEVY_RATE: 0.04, // 4%

    // CGT
    CGT_RATE: 0.10, // 10% (30% for companies in 2026)
    CGT_CORPORATE_RATE: 0.30, // 30% for companies
};

// ============================================================================
// TYPES
// ============================================================================

export type TransactionNature =
    | 'sale_of_goods'
    | 'sale_of_services'
    | 'payroll'
    | 'interest_income'
    | 'dividend_income'
    | 'rent_income'
    | 'asset_sale'
    | 'purchase_goods'
    | 'purchase_services'
    | 'capital_expenditure'
    | 'entertainment'        // Disallowable expense
    | 'capital_injection'    // Equity - not taxable
    | 'other';

export type TaxType = 'VAT' | 'WHT' | 'PAYE' | 'CIT' | 'DEV_LEVY' | 'CGT';

export interface TaxAssessment {
    taxType: TaxType;
    applies: boolean;
    reason: string;
    legalRate: string;
    rateDecimal: number;
    baseAmount: number;
    calculatedAmount: number;
    calculationSteps: string[];
    bearerOfTax: 'business' | 'counterparty' | 'employee';
    remittedBy: string;
    remittedTo: string;
}

export interface TransactionTaxAnalysis {
    transactionId: string;
    transactionDate: string;
    transactionNarration: string;
    transactionNature: TransactionNature;
    transactionAmount: number;          // VAT-exclusive amount
    grossAmount: number;                 // Original VAT-inclusive amount
    journalEntry: JournalEntry;
    taxAssessments: TaxAssessment[];
    totalTaxForTransaction: number;
    isDisallowable: boolean;            // For CIT purposes
    disallowableReason?: string;
}

export interface PeriodTaxAssessment {
    citAssessment: TaxAssessment;
    devLevyAssessment: TaxAssessment;
    payeAssessment: TaxAssessment;
    totalPeriodTax: number;
}

export interface TaxPayablesSchedule {
    asAtDate: string;

    // Section 1: Transaction Trace (VAT/WHT)
    analyses: TransactionTaxAnalysis[];

    // Section 2: Period Summary (Accounting Basis - VAT-EXCLUSIVE)
    periodSummary: {
        totalRevenue: number;           // VAT-exclusive
        totalExpenses: number;          // VAT-exclusive
        payrollExpense: number;
        disallowableExpenses: number;   // Not deductible for CIT
        netProfitBeforeTax: number;
        taxableProfit: number;          // Net profit - disallowables added back
    };

    // Section 3: VAT Breakdown
    vatSummary: {
        outputVAT: number;
        inputVAT: number;
        netVATPayable: number;
    };

    // Section 4: Period Taxes (CIT/Dev Levy)
    periodTaxes: PeriodTaxAssessment;

    // Section 5: Final Totals
    summary: {
        vatPayable: number;
        whtPayable: number;
        payePayable: number;
        citPayable: number;
        developmentLevy: number;
        cgtPayable: number;
        totalPayable: number;
    };

    assumptions: string[];
}

// ============================================================================
// TRANSACTION NATURE IDENTIFICATION
// ============================================================================

/**
 * INTELLIGENT NARRATION-BASED TRANSACTION CLASSIFICATION
 * 
 * This system uses keyword analysis on the narration text to accurately determine
 * transaction nature, even when the account code selected is incorrect.
 * 
 * Priority: Narration keywords > Account codes
 * 
 * This ensures correct tax treatment regardless of user's account selection.
 */

// Keyword patterns for each transaction type (ordered by priority)
const TRANSACTION_KEYWORDS: { nature: TransactionNature; keywords: string[]; priority: number }[] = [
    // HIGHEST PRIORITY: Explicit tax-relevant keywords
    {
        nature: 'payroll',
        priority: 100,
        keywords: ['salary', 'salaries', 'wage', 'wages', 'payroll', 'staff cost', 'employee salary',
            'paye', 'pension contribution', 'gratuity', 'staff allowance', 'bonus payment']
    },
    {
        nature: 'purchase_services',
        priority: 95,
        keywords: ['legal', 'lawyer', 'attorney', 'solicitor', 'consultancy', 'consulting',
            'consultant fee', 'professional fee', 'advisory', 'audit fee', 'auditor',
            'accounting fee', 'accountant', 'architect', 'engineer fee', 'surveyor',
            'valuer', 'management fee', 'technical service', 'medical consultant', 'doctor fee']
    },
    {
        nature: 'entertainment',
        priority: 90,
        keywords: ['entertainment', 'hospitality', 'client entertainment', 'staff party',
            'dinner', 'lunch meeting', 'gifts', 'hamper', 'christmas party', 'celebration',
            'team building', 'staff welfare party']
    },
    {
        nature: 'capital_injection',
        priority: 88,
        keywords: ['capital injection', 'owner capital', 'additional capital', 'capital introduced',
            'share capital', 'equity injection', 'investor capital', 'shareholder contribution']
    },

    // HIGH PRIORITY: Purchase types (determines VAT treatment)
    {
        nature: 'purchase_goods',
        priority: 85,
        keywords: ['inventory', 'stock', 'raw material', 'raw materials', 'merchandise',
            'goods purchase', 'bought goods', 'purchase of goods', 'credit purchase',
            'cash purchase', 'supplies', 'materials purchase', 'purchase of inventory',
            'bought inventory', 'purchased inventory', 'inventory purchase']
    },

    // MEDIUM PRIORITY: Revenue types
    {
        nature: 'sale_of_services',
        priority: 80,
        keywords: ['service revenue', 'service income', 'consulting income', 'fee earned',
            'professional income', 'service rendered', 'commission earned']
    },
    {
        nature: 'sale_of_goods',
        priority: 78,
        keywords: ['sold goods', 'sale of goods', 'cash sale', 'credit sale', 'sales revenue',
            'goods sold', 'sold inventory', 'sold merchandise', 'sold finished goods']
    },
    {
        nature: 'interest_income',
        priority: 75,
        keywords: ['interest income', 'bank interest', 'interest received', 'fd interest',
            'deposit interest', 'interest earned']
    },
    {
        nature: 'dividend_income',
        priority: 75,
        keywords: ['dividend', 'dividend income', 'dividend received', 'share dividend']
    },
    {
        nature: 'rent_income',
        priority: 75,
        keywords: ['rent income', 'rental income', 'rent received', 'lease income', 'tenancy income']
    },

    // MEDIUM PRIORITY: Asset transactions
    {
        nature: 'asset_sale',
        priority: 70,
        keywords: ['disposal', 'sold asset', 'asset sale', 'sale of equipment', 'sale of vehicle',
            'sale of property', 'sold machine', 'asset disposal', 'equipment disposal']
    },
    {
        nature: 'capital_expenditure',
        priority: 65,
        keywords: ['fixed asset', 'machinery purchase', 'equipment purchase', 'vehicle purchase',
            'building purchase', 'land purchase', 'furniture purchase', 'computer purchase']
    }
];

/**
 * Analyze narration text and return the best matching transaction nature
 * Uses weighted keyword matching with longest-match-wins for compound keywords
 */
function analyzeNarration(narration: string): { nature: TransactionNature | null; confidence: number; matchedKeyword: string | null } {
    const text = narration.toLowerCase();

    let bestMatch: { nature: TransactionNature; priority: number; keyword: string } | null = null;

    for (const group of TRANSACTION_KEYWORDS) {
        for (const keyword of group.keywords) {
            if (text.includes(keyword)) {
                // Prefer longer keyword matches and higher priority
                const score = group.priority + (keyword.length / 10);
                if (!bestMatch || score > bestMatch.priority + (bestMatch.keyword.length / 10)) {
                    bestMatch = { nature: group.nature, priority: group.priority, keyword };
                }
            }
        }
    }

    if (bestMatch) {
        // Confidence based on priority (100 = highest)
        const confidence = Math.min(bestMatch.priority, 100);
        return { nature: bestMatch.nature, confidence, matchedKeyword: bestMatch.keyword };
    }

    return { nature: null, confidence: 0, matchedKeyword: null };
}

export function identifyTransactionNature(entry: JournalEntry): TransactionNature {
    const accountCodes = entry.lines.map(line => line.accountCode);
    const narration = entry.narration.toLowerCase();

    // ========================================================================
    // STEP 1: NARRATION KEYWORD ANALYSIS (Primary - takes precedence)
    // ========================================================================
    const narrationAnalysis = analyzeNarration(entry.narration);

    if (narrationAnalysis.nature && narrationAnalysis.confidence >= 70) {
        // High confidence match from narration - use this regardless of account codes
        return narrationAnalysis.nature;
    }

    // ========================================================================
    // STEP 2: ACCOUNT CODE ANALYSIS (Fallback when narration is unclear)
    // ========================================================================

    // Check for revenue accounts (4xxx)
    const hasRevenueAccount = accountCodes.some(code => code.startsWith('4'));
    const hasExpenseAccount = accountCodes.some(code => code.startsWith('5') || code.startsWith('6'));
    const hasEquityAccount = accountCodes.some(code => code.startsWith('30') || code.startsWith('31'));
    const hasFixedAssetAccount = accountCodes.some(code => code.startsWith('15'));
    const hasPayrollAccount = accountCodes.some(code => code.startsWith('54') || code.startsWith('55'));

    // Payroll detection
    if (hasPayrollAccount ||
        ['salary', 'wage', 'payroll'].some(kw => narration.includes(kw))) {
        return 'payroll';
    }

    // Revenue detection
    if (hasRevenueAccount) {
        if (accountCodes.includes('4200') || narration.includes('interest')) return 'interest_income';
        if (accountCodes.includes('4210') || narration.includes('dividend')) return 'dividend_income';
        if (accountCodes.includes('4220') || narration.includes('rent')) return 'rent_income';
        if (accountCodes.includes('4010') || narration.includes('service')) return 'sale_of_services';
        if (accountCodes.includes('4300') || narration.includes('disposal')) return 'asset_sale';
        return 'sale_of_goods';
    }

    // Expense detection
    if (hasExpenseAccount) {
        // Professional services keywords
        if (['legal', 'audit', 'consult', 'professional'].some(kw => narration.includes(kw))) {
            return 'purchase_services';
        }
        // Entertainment/disallowable
        if (['entertainment', 'hospitality', 'gift'].some(kw => narration.includes(kw))) {
            return 'entertainment';
        }
        // Cost of sales accounts (50xx) = purchase of goods
        if (accountCodes.some(code => code.startsWith('50'))) {
            return 'purchase_goods';
        }
        // Any other expense with "purchase" keyword = likely goods
        if (narration.includes('purchase') || narration.includes('bought')) {
            return 'purchase_goods';
        }
    }

    // Equity detection
    if (hasEquityAccount) {
        return 'capital_injection';
    }

    // Fixed asset detection
    if (hasFixedAssetAccount) {
        return 'capital_expenditure';
    }

    // ========================================================================
    // STEP 3: LOW CONFIDENCE NARRATION MATCH (Last resort)
    // ========================================================================
    if (narrationAnalysis.nature && narrationAnalysis.confidence >= 50) {
        return narrationAnalysis.nature;
    }

    return 'other';
}

// Export for debugging/testing
export function debugNarrationAnalysis(narration: string): { nature: TransactionNature | null; confidence: number; matchedKeyword: string | null } {
    return analyzeNarration(narration);
}

// ============================================================================
// PART 1: TRANSACTION LEVEL TAXES (VAT, WHT, CGT)
// ============================================================================

function assessVAT(entry: JournalEntry, nature: TransactionNature, amount: number, isVatRegistered: boolean): TaxAssessment {
    const vatExemptNatures: TransactionNature[] = ['payroll', 'interest_income', 'dividend_income', 'asset_sale'];

    if (!isVatRegistered) {
        return createAssessment('VAT', false, 'Business not VAT-registered', 0, amount, 0, 'counterparty');
    }

    if (vatExemptNatures.includes(nature)) {
        return createAssessment('VAT', false, 'Transaction exempt from VAT', 0, amount, 0, 'counterparty');
    }

    if (nature === 'sale_of_goods' || nature === 'sale_of_services') {
        const vat = amount * TAX_RATES_2026.VAT_RATE;
        return createAssessment('VAT', true, 'Output VAT on taxable supply', 0.075, amount, vat, 'counterparty',
            `VAT = ${formatCurrency(amount)} × 7.5%`, 'Business (seller)');
    }

    // Only purchases of GOODS (raw materials, inventory) qualify for Input VAT recovery
    // Professional services do NOT qualify for Input VAT recovery per FIRS rules
    if (nature === 'purchase_goods') {
        const vat = amount * TAX_RATES_2026.VAT_RATE;
        return createAssessment('VAT', true, 'Input VAT (recoverable)', 0.075, amount, -vat, 'business',
            `Input VAT = ${formatCurrency(amount)} × 7.5%`, 'Supplier');
    }

    // Professional services - VAT not recoverable
    if (nature === 'purchase_services') {
        return createAssessment('VAT', false, 'Input VAT not recoverable on services', 0, amount, 0, 'business');
    }

    return createAssessment('VAT', false, 'Not applicable', 0, amount, 0, 'counterparty');
}

function assessWHT(entry: JournalEntry, nature: TransactionNature, amount: number): TaxAssessment {
    let rate = 0;

    if (nature === 'sale_of_services') rate = TAX_RATES_2026.WHT_PROFESSIONAL_SERVICES;
    else if (nature === 'interest_income') rate = TAX_RATES_2026.WHT_INTEREST_FX;
    else if (nature === 'dividend_income') rate = TAX_RATES_2026.WHT_DIVIDENDS_RESIDENT;
    else if (nature === 'rent_income') rate = TAX_RATES_2026.WHT_RENT;

    if (rate > 0) {
        const wht = amount * rate;
        return createAssessment('WHT', true, 'WHT Deducted at Source', rate, amount, wht, 'business',
            `WHT Credit = ${formatCurrency(amount)} × ${rate * 100}%`, 'Payer');
    }

    if (nature === 'purchase_services') {
        const rate = TAX_RATES_2026.WHT_PROFESSIONAL_SERVICES;
        const wht = amount * rate;
        return createAssessment('WHT', true, 'WHT Payable to FIRS', rate, amount, wht, 'counterparty',
            `WHT Payable = ${formatCurrency(amount)} × ${rate * 100}%`, 'Business (payer)');
    }

    return createAssessment('WHT', false, 'Not applicable', 0, amount, 0, 'counterparty');
}

function assessCGT(nature: TransactionNature, amount: number, isSmallCompany: boolean): TaxAssessment {
    if (nature !== 'asset_sale') return createAssessment('CGT', false, 'Not asset disposal', 0, 0, 0, 'business');

    const rate = isSmallCompany ? TAX_RATES_2026.CGT_RATE : TAX_RATES_2026.CGT_CORPORATE_RATE;
    const cgt = amount * rate;

    return createAssessment('CGT', true, 'CGT on Asset Disposal', rate, amount, cgt, 'business',
        `CGT = ${formatCurrency(amount)} × ${rate * 100}%`);
}

// ============================================================================
// PART 2: PERIOD LEVEL TAXES (CIT, DEV LEVY, PAYE)
// ============================================================================

function calculatePeriodTaxes(
    revenue: number,
    netProfit: number,
    payrollExpense: number,
    isSmallCompany: boolean
): PeriodTaxAssessment {

    // 1. CIT Calculation
    let citAssessment: TaxAssessment;
    if (isSmallCompany) {
        citAssessment = createAssessment('CIT', false, 'Small Company Exempt (< ₦50M Turnover)', 0.30, netProfit, 0, 'business');
    } else if (netProfit <= 0) {
        citAssessment = createAssessment('CIT', false, 'No taxable profit', 0.30, 0, 0, 'business');
    } else {
        const cit = netProfit * TAX_RATES_2026.CIT_RATE;
        citAssessment = createAssessment('CIT', true, 'CIT on Assessable Profit', 0.30, netProfit, cit, 'business',
            `CIT = ${formatCurrency(netProfit)} × 30%`);
    }

    // 2. Development Levy
    let devLevyAssessment: TaxAssessment;
    if (isSmallCompany) {
        devLevyAssessment = createAssessment('DEV_LEVY', false, 'Small Company Exempt', 0.04, netProfit, 0, 'business');
    } else if (netProfit <= 0) {
        devLevyAssessment = createAssessment('DEV_LEVY', false, 'No assessable profit', 0.04, 0, 0, 'business');
    } else {
        const levy = netProfit * TAX_RATES_2026.DEVELOPMENT_LEVY_RATE;
        devLevyAssessment = createAssessment('DEV_LEVY', true, 'Development Levy (2026)', 0.04, netProfit, levy, 'business',
            `Levy = ${formatCurrency(netProfit)} × 4%`);
    }

    // 3. PAYE (Aggregated Estimate)
    // In a real system this is per-employee. Here we estimate based on total payroll.
    // We assume an average salary distribution for estimation.
    // Or strictly apply bands if we treat it as "one giant employee" (incorrect but placeholder)
    // Better: Apply a flat effective rate estimation of 15% for aggregate reporting
    let payeAssessment: TaxAssessment;
    if (payrollExpense <= 0) {
        payeAssessment = createAssessment('PAYE', false, 'No payroll expense', 0, 0, 0, 'employee');
    } else {
        const estimatedRate = 0.15;
        const paye = payrollExpense * estimatedRate;
        payeAssessment = createAssessment('PAYE', true, 'PAYE Remittance (Estimated)', estimatedRate, payrollExpense, paye, 'employee',
            `Est. PAYE = ${formatCurrency(payrollExpense)} × ~15% (avg effective rate)`);
    }

    return {
        citAssessment,
        devLevyAssessment,
        payeAssessment,
        totalPeriodTax: citAssessment.calculatedAmount + devLevyAssessment.calculatedAmount + payeAssessment.calculatedAmount
    };
}

/**
 * Assess PAYE applicability
 */
function assessPAYE(
    entry: JournalEntry,
    nature: TransactionNature,
    amount: number
): TaxAssessment {
    if (nature !== 'payroll') {
        return {
            taxType: 'PAYE',
            applies: false,
            reason: 'Not a payroll transaction',
            legalRate: '0-25%',
            rateDecimal: 0,
            baseAmount: 0,
            calculatedAmount: 0,
            calculationSteps: ['PAYE only applies to employment income'],
            bearerOfTax: 'employee',
            remittedBy: 'N/A',
            remittedTo: 'N/A',
        };
    }

    // PAYE is a Period-Level tax based on aggregate payroll
    // We do not assess it per individual transaction line to avoid double counting or bracket errors
    return {
        taxType: 'PAYE',
        applies: false, // Strict Period Level
        reason: 'PAYE judged on aggregate period payroll (Period Level)',
        legalRate: 'Progressive',
        rateDecimal: 0,
        baseAmount: amount,
        calculatedAmount: 0,
        calculationSteps: ['Assessed on total period payroll in Tax Summary'],
        bearerOfTax: 'employee',
        remittedBy: 'Employer',
        remittedTo: 'SIRS',
    };
}

/**
 * Assess CIT/Development Levy applicability (for period-end)
 */
function assessCIT(
    entry: JournalEntry,
    nature: TransactionNature,
    amount: number,
    isSmallCompany: boolean
): TaxAssessment {
    const isRevenueTransaction = ['sale_of_goods', 'sale_of_services', 'interest_income',
        'dividend_income', 'rent_income'].includes(nature);
    const isExpenseTransaction = ['purchase_goods', 'purchase_services', 'payroll'].includes(nature);

    if (isSmallCompany) {
        return {
            taxType: 'CIT',
            applies: false,
            reason: 'Small company exempt (< ₦50M)',
            legalRate: '30%',
            rateDecimal: 0.30,
            baseAmount: 0,
            calculatedAmount: 0,
            calculationSteps: [],
            bearerOfTax: 'business',
            remittedBy: 'N/A',
            remittedTo: 'N/A',
        };
    }

    // STRICT RULE: CIT is Period-Level Only. No transaction level liability.
    // We only identify if it affects the profit base.

    return {
        taxType: 'CIT',
        applies: false, // Strict Period Level
        reason: isRevenueTransaction
            ? 'Revenue contributes to Assessable Profit (Period Level)'
            : isExpenseTransaction
                ? 'Expense dedectuble from Assessable Profit (Period Level)'
                : 'No impact on Assessable Profit',
        legalRate: '30%',
        rateDecimal: 0.30,
        baseAmount: isRevenueTransaction || isExpenseTransaction ? amount : 0,
        calculatedAmount: 0,
        calculationSteps: ['CIT assessed on total period profit in Tax Summary'],
        bearerOfTax: 'business',
        remittedBy: 'Business',
        remittedTo: 'FIRS',
    };
}

/**
 * Assess Development Levy applicability (2026)
 */
function assessDevelopmentLevy(
    entry: JournalEntry,
    nature: TransactionNature,
    amount: number,
    isSmallCompany: boolean
): TaxAssessment {
    if (isSmallCompany) {
        return {
            taxType: 'DEV_LEVY',
            applies: false,
            reason: 'Small company exempt',
            legalRate: '4%',
            rateDecimal: 0.04,
            baseAmount: 0,
            calculatedAmount: 0,
            calculationSteps: [],
            bearerOfTax: 'business',
            remittedBy: 'N/A',
            remittedTo: 'N/A',
        };
    }

    // STRICT RULE: Development Levy is Period-Level Only.
    return {
        taxType: 'DEV_LEVY',
        applies: false, // Strict Period Level
        reason: 'Assessed on total period profit (Period Level)',
        legalRate: '4%',
        rateDecimal: 0.04,
        baseAmount: 0,
        calculatedAmount: 0,
        calculationSteps: ['Levy assessed on total period profit in Tax Summary'],
        bearerOfTax: 'business',
        remittedBy: 'Business',
        remittedTo: 'FIRS',
    };
}

// ============================================================================
// VAT EXTRACTION HELPER
// ============================================================================

const VAT_MULTIPLIER = 1 + TAX_RATES_2026.VAT_RATE; // 1.075

/**
 * CRITICAL: Extract VAT from VAT-inclusive amount
 * Formula: Net = Gross ÷ 1.075, VAT = Gross - Net
 * 
 * This MUST be applied to all VAT-inclusive transactions BEFORE any calculations.
 */
function extractVATFromGross(grossAmount: number): { netAmount: number; vatAmount: number } {
    const netAmount = Math.round((grossAmount / VAT_MULTIPLIER) * 100) / 100;
    const vatAmount = Math.round((grossAmount - netAmount) * 100) / 100;
    return { netAmount, vatAmount };
}

/**
 * Calculate VAT on a VAT-exclusive amount
 * Formula: VAT = Net × 7.5%
 */
function calculateVATOnExclusive(exclusiveAmount: number): number {
    return Math.round((exclusiveAmount * TAX_RATES_2026.VAT_RATE) * 100) / 100;
}

// ============================================================================
// TAX LIABILITY ACCOUNT CODES (for manual override detection)
// ============================================================================

const TAX_LIABILITY_ACCOUNTS = {
    OUTPUT_VAT: '2200',      // Output VAT Payable
    INPUT_VAT: '1400',       // Input VAT Receivable
    WHT_PAYABLE: '2220',     // WHT Payable
    WHT_RECEIVABLE: '1410',  // WHT Receivable (credit)
    PAYE_PAYABLE: '2210',    // PAYE Payable
    PENSION_PAYABLE: '2230', // Pension Payable
};

/**
 * MANUAL TAX OVERRIDE DETECTION
 * 
 * Checks if the user has manually included tax liability accounts in their journal entry.
 * If found, returns the manually entered amounts so we skip auto-calculation for those taxes.
 */
interface ManualTaxEntries {
    hasManualOutputVAT: boolean;
    manualOutputVAT: number;
    hasManualInputVAT: boolean;
    manualInputVAT: number;
    hasManualWHT: boolean;
    manualWHT: number;
    hasManualPAYE: boolean;
    manualPAYE: number;
}

function detectManualTaxEntries(entry: JournalEntry): ManualTaxEntries {
    const result: ManualTaxEntries = {
        hasManualOutputVAT: false,
        manualOutputVAT: 0,
        hasManualInputVAT: false,
        manualInputVAT: 0,
        hasManualWHT: false,
        manualWHT: 0,
        hasManualPAYE: false,
        manualPAYE: 0,
    };

    for (const line of entry.lines) {
        // Output VAT Payable (credit = liability increase)
        if (line.accountCode === TAX_LIABILITY_ACCOUNTS.OUTPUT_VAT) {
            result.hasManualOutputVAT = true;
            result.manualOutputVAT = line.credit || line.debit; // Credit increases liability
        }

        // Input VAT Receivable (debit = asset increase)
        if (line.accountCode === TAX_LIABILITY_ACCOUNTS.INPUT_VAT) {
            result.hasManualInputVAT = true;
            result.manualInputVAT = line.debit || line.credit;
        }

        // WHT Payable (credit = liability, we deduct from vendor)
        if (line.accountCode === TAX_LIABILITY_ACCOUNTS.WHT_PAYABLE) {
            result.hasManualWHT = true;
            result.manualWHT = line.credit || line.debit;
        }

        // WHT Receivable (debit = asset, vendor deducted from us)
        if (line.accountCode === TAX_LIABILITY_ACCOUNTS.WHT_RECEIVABLE) {
            // This is a credit/receivable, doesn't affect payable
        }

        // PAYE Payable (credit = liability)
        if (line.accountCode === TAX_LIABILITY_ACCOUNTS.PAYE_PAYABLE) {
            result.hasManualPAYE = true;
            result.manualPAYE = line.credit || line.debit;
        }
    }

    return result;
}

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

export function generateTaxSchedule(
    entries: JournalEntry[],
    options: {
        isVatRegistered?: boolean;
        isSmallCompany?: boolean;
    } = {}
): TaxPayablesSchedule {
    const { isVatRegistered = true } = options;
    let resolvedIsSmallCompany = options.isSmallCompany;

    // Pre-scan for Total Revenue to determine Company Size if not specified
    if (resolvedIsSmallCompany === undefined) {
        let tempRevenue = 0;
        for (const entry of entries) {
            const nature = identifyTransactionNature(entry);
            if (['sale_of_goods', 'sale_of_services', 'interest_income', 'rent_income', 'dividend_income'].includes(nature)) {
                const grossAmount = entry.lines.filter(l => l.debit > 0).reduce((s, l) => s + l.debit, 0);
                // For revenue, extract VAT to get true net revenue
                const { netAmount } = extractVATFromGross(grossAmount);
                tempRevenue += netAmount;
            }
        }
        resolvedIsSmallCompany = tempRevenue < TAX_RATES_2026.CIT_SMALL_COMPANY_THRESHOLD;
    }

    const analyses: TransactionTaxAnalysis[] = [];

    // Tax accumulators
    let totalOutputVAT = 0;
    let totalInputVAT = 0;
    let totalWht = 0;
    let totalCgt = 0;
    let totalPaye = 0;

    // Period aggregates (VAT-EXCLUSIVE)
    let totalRevenue = 0;
    let totalExpenses = 0;
    let payrollExpense = 0;
    let disallowableExpenses = 0;

    for (const entry of entries) {
        const nature = identifyTransactionNature(entry);

        // ========================================================================
        // DETECT MANUAL TAX ENTRIES (Override auto-calculation if present)
        // ========================================================================
        const manualTax = detectManualTaxEntries(entry);
        const isManualEntry = manualTax.hasManualOutputVAT || manualTax.hasManualInputVAT ||
            manualTax.hasManualWHT || manualTax.hasManualPAYE;

        // Gross amount from journal (may be VAT-inclusive)
        // If user has manually split VAT, we need to calculate gross differently
        let grossAmount: number;

        if (manualTax.hasManualOutputVAT || manualTax.hasManualInputVAT) {
            // User has manually split - calculate total transaction value
            // (exclude tax accounts from the calculation)
            grossAmount = entry.lines
                .filter(l => !Object.values(TAX_LIABILITY_ACCOUNTS).includes(l.accountCode))
                .reduce((s, l) => s + Math.max(l.debit, l.credit), 0);
        } else {
            grossAmount = entry.lines.filter(l => l.debit > 0).reduce((s, l) => s + l.debit, 0);
        }

        // ========================================================================
        // TRANSACTION TAX ANALYSIS (VAT-EXCLUSIVE BASES)
        // ========================================================================

        let netAmountForAccounting = grossAmount; // Default: full amount
        let outputVAT = 0;
        let inputVAT = 0;
        let wht = 0;
        let cgt = 0;
        let isDisallowable = false;
        let disallowableReason: string | undefined = undefined;

        const taxAssessments: TaxAssessment[] = [];

        // ========================================================================
        // CASE 1: SALE OF GOODS (VAT-inclusive cash received)
        // ========================================================================
        if (nature === 'sale_of_goods' && isVatRegistered) {
            if (manualTax.hasManualOutputVAT) {
                // USER MANUALLY CHARGED VAT - Use their amounts
                outputVAT = manualTax.manualOutputVAT;
                // Revenue line is already VAT-exclusive since user separated it
                const revenueLine = entry.lines.find(l => l.accountCode.startsWith('4') && l.credit > 0);
                netAmountForAccounting = revenueLine ? revenueLine.credit : grossAmount;

                taxAssessments.push(createAssessment('VAT', true,
                    '⚠️ MANUAL: Output VAT entered by user',
                    TAX_RATES_2026.VAT_RATE, netAmountForAccounting, outputVAT, 'counterparty',
                    `User manually charged VAT = ₦${outputVAT.toLocaleString()}`
                ));
            } else {
                // AUTO-CALCULATE: Gross is VAT-inclusive -> Strip VAT first
                const { netAmount, vatAmount } = extractVATFromGross(grossAmount);
                netAmountForAccounting = netAmount;
                outputVAT = vatAmount;

                taxAssessments.push(createAssessment('VAT', true,
                    'Output VAT on taxable supply (auto-calculated)',
                    TAX_RATES_2026.VAT_RATE, netAmount, outputVAT, 'counterparty',
                    `₦${grossAmount.toLocaleString()} ÷ 1.075 = Net ₦${netAmount.toLocaleString()}, VAT = ₦${vatAmount.toLocaleString()}`
                ));
            }

            totalRevenue += netAmountForAccounting;
            totalOutputVAT += outputVAT;
        }

        // ========================================================================
        // CASE 2: SALE OF SERVICES (VAT-inclusive, WHT deducted by payer)
        // ========================================================================
        else if (nature === 'sale_of_services' && isVatRegistered) {
            // Services sold: VAT-inclusive, client may also deduct WHT
            const { netAmount, vatAmount } = extractVATFromGross(grossAmount);
            netAmountForAccounting = netAmount;
            outputVAT = vatAmount;

            taxAssessments.push(createAssessment('VAT', true,
                'Output VAT on service income (stripped from gross)',
                TAX_RATES_2026.VAT_RATE, netAmount, outputVAT, 'counterparty',
                `₦${grossAmount.toLocaleString()} ÷ 1.075 = Net ₦${netAmount.toLocaleString()}, VAT = ₦${vatAmount.toLocaleString()}`
            ));

            // WHT credit (we receive less because payer withholds)
            wht = Math.round(netAmount * TAX_RATES_2026.WHT_PROFESSIONAL_SERVICES * 100) / 100;
            taxAssessments.push(createAssessment('WHT', true,
                'WHT deducted at source (credit)',
                TAX_RATES_2026.WHT_PROFESSIONAL_SERVICES, netAmount, -wht, 'business', // Negative = credit
                `WHT Credit = ₦${netAmount.toLocaleString()} × 10% = ₦${wht.toLocaleString()}`
            ));

            totalRevenue += netAmount;
            totalOutputVAT += outputVAT;
            // Note: WHT credit reduces our effective tax, not a payable
        }

        // ========================================================================
        // CASE 3: PURCHASE OF GOODS (VAT-inclusive, Input VAT recoverable)
        // ========================================================================
        else if (nature === 'purchase_goods' && isVatRegistered) {
            if (manualTax.hasManualInputVAT) {
                // USER MANUALLY CHARGED INPUT VAT - Use their amounts
                inputVAT = manualTax.manualInputVAT;
                // Expense line is already VAT-exclusive since user separated it
                const expenseLine = entry.lines.find(l => l.accountCode.startsWith('5') && l.debit > 0);
                netAmountForAccounting = expenseLine ? expenseLine.debit : grossAmount;

                taxAssessments.push(createAssessment('VAT', true,
                    '⚠️ MANUAL: Input VAT entered by user',
                    TAX_RATES_2026.VAT_RATE, netAmountForAccounting, -inputVAT, 'business',
                    `User manually claimed Input VAT = ₦${inputVAT.toLocaleString()}`
                ));
            } else {
                // AUTO-CALCULATE: Gross is VAT-inclusive -> Strip VAT first
                const { netAmount, vatAmount } = extractVATFromGross(grossAmount);
                netAmountForAccounting = netAmount;
                inputVAT = vatAmount;

                taxAssessments.push(createAssessment('VAT', true,
                    'Input VAT recoverable (auto-calculated)',
                    TAX_RATES_2026.VAT_RATE, netAmount, -inputVAT, 'business',
                    `₦${grossAmount.toLocaleString()} ÷ 1.075 = Net ₦${netAmount.toLocaleString()}, Input VAT = ₦${vatAmount.toLocaleString()}`
                ));
            }

            totalExpenses += netAmountForAccounting;
            totalInputVAT += inputVAT;
        }

        // ========================================================================
        // CASE 4: PURCHASE OF SERVICES (Professional - WHT payable, NO VAT recovery)
        // ========================================================================
        else if (nature === 'purchase_services') {
            // Professional services: NO VAT recovery per FIRS
            netAmountForAccounting = grossAmount;

            if (manualTax.hasManualWHT) {
                // USER MANUALLY CHARGED WHT - Use their amount
                wht = manualTax.manualWHT;

                taxAssessments.push(createAssessment('VAT', false,
                    'Input VAT NOT recoverable on professional services',
                    0, grossAmount, 0, 'business'
                ));

                taxAssessments.push(createAssessment('WHT', true,
                    '⚠️ MANUAL: WHT entered by user',
                    TAX_RATES_2026.WHT_PROFESSIONAL_SERVICES, grossAmount, wht, 'counterparty',
                    `User manually charged WHT = ₦${wht.toLocaleString()}`,
                    'Business (payer)'
                ));
            } else {
                // AUTO-CALCULATE WHT
                wht = Math.round(grossAmount * TAX_RATES_2026.WHT_PROFESSIONAL_SERVICES * 100) / 100;

                taxAssessments.push(createAssessment('VAT', false,
                    'Input VAT NOT recoverable on professional services',
                    0, grossAmount, 0, 'business'
                ));

                taxAssessments.push(createAssessment('WHT', true,
                    'WHT payable to FIRS (auto-calculated)',
                    TAX_RATES_2026.WHT_PROFESSIONAL_SERVICES, grossAmount, wht, 'counterparty',
                    `WHT Payable = ₦${grossAmount.toLocaleString()} × 10% = ₦${wht.toLocaleString()}`,
                    'Business (payer)'
                ));
            }

            totalExpenses += grossAmount;
            totalWht += wht;
        }

        // ========================================================================
        // CASE 5: PAYROLL (No VAT, PAYE withheld from employees)
        // ========================================================================
        else if (nature === 'payroll') {
            netAmountForAccounting = grossAmount;
            payrollExpense += grossAmount;
            totalExpenses += grossAmount;

            if (manualTax.hasManualPAYE) {
                // USER MANUALLY CHARGED PAYE - Use their amount
                const payeAmount = manualTax.manualPAYE;

                taxAssessments.push(createAssessment('VAT', false,
                    'Payroll exempt from VAT',
                    0, grossAmount, 0, 'employee'
                ));
                taxAssessments.push(createAssessment('PAYE', true,
                    '⚠️ MANUAL: PAYE entered by user',
                    0, grossAmount, payeAmount, 'employee',
                    `User manually charged PAYE = ₦${payeAmount.toLocaleString()}`
                ));

                totalPaye += payeAmount;
            } else {
                // AUTO-CALCULATE: Estimate PAYE at 15% (simplified flat rate for testing)
                // NOTE: Actual PAYE is graduated with CRA relief - this is a simplified estimate
                const estimatedPayeRate = 0.15;
                const payeAmount = Math.round(grossAmount * estimatedPayeRate * 100) / 100;

                taxAssessments.push(createAssessment('VAT', false,
                    'Payroll exempt from VAT',
                    0, grossAmount, 0, 'employee'
                ));
                taxAssessments.push(createAssessment('PAYE', true,
                    '⚠️ PAYE (simplified 15% test rate - actual PAYE is graduated)',
                    estimatedPayeRate, grossAmount, payeAmount, 'employee',
                    `Simplified PAYE = ₦${grossAmount.toLocaleString()} × 15% = ₦${payeAmount.toLocaleString()} (Note: Actual PAYE uses graduated rates with CRA relief)`
                ));

                totalPaye += payeAmount;
            }
        }

        // ========================================================================
        // CASE 6: INTEREST/DIVIDEND/RENT INCOME (WHT deducted, VAT exempt)
        // ========================================================================
        else if (['interest_income', 'dividend_income', 'rent_income'].includes(nature)) {
            netAmountForAccounting = grossAmount;

            let whtRate = 0;
            if (nature === 'interest_income') whtRate = TAX_RATES_2026.WHT_INTEREST_FX;
            else if (nature === 'dividend_income') whtRate = TAX_RATES_2026.WHT_DIVIDENDS_RESIDENT;
            else if (nature === 'rent_income') whtRate = TAX_RATES_2026.WHT_RENT;

            wht = Math.round(grossAmount * whtRate * 100) / 100;

            taxAssessments.push(createAssessment('VAT', false,
                'Income exempt from VAT',
                0, grossAmount, 0, 'counterparty'
            ));
            taxAssessments.push(createAssessment('WHT', true,
                'WHT deducted at source (credit)',
                whtRate, grossAmount, -wht, 'business', // Credit
                `WHT Credit = ₦${grossAmount.toLocaleString()} × ${whtRate * 100}%`
            ));

            totalRevenue += grossAmount;
        }

        // ========================================================================
        // CASE 7: ASSET SALE (CGT on GAIN, not proceeds. VAT-EXEMPT)
        // ========================================================================
        else if (nature === 'asset_sale') {
            // Asset disposals are CAPITAL transactions - NOT VATable
            // CGT is charged on the GAIN = Proceeds - Cost (or Net Book Value)

            // Extract proceeds (debit to cash/bank = what we received)
            const proceedsLine = entry.lines.find(l =>
                (l.accountCode.startsWith('10') || l.accountCode.startsWith('11') || l.accountCode.startsWith('12')) && l.debit > 0
            );
            const proceeds = proceedsLine ? proceedsLine.debit : grossAmount;

            // Extract cost/NBV (credit to asset account = original cost being removed)
            const assetLine = entry.lines.find(l =>
                l.accountCode.startsWith('15') && l.credit > 0  // Fixed assets (15xx)
            );
            const costBasis = assetLine ? assetLine.credit : 0;

            // Check for accumulated depreciation (debit reduces the asset removal)
            const accumDepLine = entry.lines.find(l =>
                (l.accountCode.includes('1') && l.accountName?.toLowerCase().includes('depreciation')) && l.debit > 0
            );
            const accumDep = accumDepLine ? accumDepLine.debit : 0;

            // Net Book Value = Cost - Accumulated Depreciation
            const netBookValue = costBasis - accumDep;

            // GAIN/LOSS = Proceeds - Net Book Value
            const gain = proceeds - netBookValue;

            // Only charge CGT if there's a gain (no CGT on losses)
            const rate = resolvedIsSmallCompany ? TAX_RATES_2026.CGT_RATE : TAX_RATES_2026.CGT_CORPORATE_RATE;
            cgt = gain > 0 ? Math.round(gain * rate * 100) / 100 : 0;

            netAmountForAccounting = proceeds; // Proceeds for reporting

            // Asset disposal is NOT VATable (capital transaction)
            taxAssessments.push(createAssessment('VAT', false,
                'Asset disposal is a capital transaction - NOT subject to VAT',
                0, proceeds, 0, 'business'
            ));

            if (gain > 0) {
                taxAssessments.push(createAssessment('CGT', true,
                    `CGT @ ${rate * 100}% on capital gain`,
                    rate, gain, cgt, 'business',
                    `Gain = ₦${proceeds.toLocaleString()} - ₦${netBookValue.toLocaleString()} = ₦${gain.toLocaleString()}; CGT = ₦${gain.toLocaleString()} × ${rate * 100}% = ₦${cgt.toLocaleString()}`
                ));
                totalCgt += cgt;
            } else if (gain < 0) {
                // Capital loss - no CGT, but record for reference
                taxAssessments.push(createAssessment('CGT', false,
                    `Capital loss on disposal (no CGT due)`,
                    0, Math.abs(gain), 0, 'business',
                    `Loss = ₦${proceeds.toLocaleString()} - ₦${netBookValue.toLocaleString()} = ₦${gain.toLocaleString()}`
                ));
            } else {
                // No gain/loss
                taxAssessments.push(createAssessment('CGT', false,
                    'No capital gain on disposal',
                    0, 0, 0, 'business'
                ));
            }
        }

        // ========================================================================
        // CASE 8: ENTERTAINMENT (Disallowable, no VAT claim)
        // ========================================================================
        else if (nature === 'entertainment') {
            netAmountForAccounting = grossAmount;
            isDisallowable = true;
            disallowableReason = 'Entertainment expenses are disallowable for CIT';

            taxAssessments.push(createAssessment('VAT', false,
                'Input VAT NOT claimable on entertainment',
                0, grossAmount, 0, 'business'
            ));
            taxAssessments.push(createAssessment('CIT', false,
                'Expense disallowable - will be added back for CIT',
                0, grossAmount, 0, 'business'
            ));

            totalExpenses += grossAmount;
            disallowableExpenses += grossAmount;
        }

        // ========================================================================
        // CASE 9: CAPITAL INJECTION (Equity - NOT taxable income)
        // ========================================================================
        else if (nature === 'capital_injection') {
            netAmountForAccounting = grossAmount;

            taxAssessments.push(createAssessment('VAT', false,
                'Capital injection not subject to VAT',
                0, grossAmount, 0, 'counterparty'
            ));
            taxAssessments.push(createAssessment('CIT', false,
                'Equity injection - not taxable income',
                0, grossAmount, 0, 'business'
            ));

            // Capital injection is NOT revenue - it's equity
            // Do not add to totalRevenue
        }

        // ========================================================================
        // CASE 10: CAPITAL EXPENDITURE (No immediate tax, VAT may be claimable)
        // ========================================================================
        else if (nature === 'capital_expenditure') {
            netAmountForAccounting = grossAmount;

            taxAssessments.push(createAssessment('VAT', false,
                'Capital expenditure - no immediate VAT impact',
                0, grossAmount, 0, 'business'
            ));

            // Not an expense for P&L purposes
        }

        // ========================================================================
        // OTHER CASES (Default)
        // ========================================================================
        else {
            netAmountForAccounting = grossAmount;
            taxAssessments.push(createAssessment('VAT', false, 'Not applicable', 0, grossAmount, 0, 'counterparty'));
        }

        // Calculate total tax for this transaction
        const txTotal = taxAssessments.reduce((sum, t) => {
            if (!t.applies) return sum;
            // Only add positive amounts (payables), not credits
            return sum + (t.calculatedAmount > 0 ? t.calculatedAmount : 0);
        }, 0);

        analyses.push({
            transactionId: entry.id,
            transactionDate: entry.date,
            transactionNarration: entry.narration,
            transactionNature: nature,
            transactionAmount: netAmountForAccounting,
            grossAmount: grossAmount,
            journalEntry: entry,
            taxAssessments,
            totalTaxForTransaction: txTotal,
            isDisallowable,
            disallowableReason
        });
    }

    // ========================================================================
    // PERIOD CALCULATIONS (VAT-EXCLUSIVE BASES)
    // ========================================================================
    const netProfit = totalRevenue - totalExpenses;

    // Taxable profit = Net profit + Disallowable expenses (added back)
    const taxableProfit = netProfit + disallowableExpenses;

    const periodTaxes = calculatePeriodTaxes(totalRevenue, taxableProfit, payrollExpense, resolvedIsSmallCompany ?? false);

    // Net VAT = Output VAT - Input VAT
    const netVAT = Math.round((totalOutputVAT - totalInputVAT) * 100) / 100;

    // PAYE payable (from individual transactions)
    const totalPayePayable = totalPaye;

    return {
        asAtDate: new Date().toISOString().split('T')[0],
        analyses,
        periodSummary: {
            totalRevenue,
            totalExpenses,
            payrollExpense,
            disallowableExpenses,
            netProfitBeforeTax: netProfit,
            taxableProfit
        },
        vatSummary: {
            outputVAT: totalOutputVAT,
            inputVAT: totalInputVAT,
            netVATPayable: netVAT
        },
        periodTaxes,
        summary: {
            vatPayable: netVAT,
            whtPayable: totalWht,
            cgtPayable: totalCgt,
            payePayable: totalPayePayable > 0 ? totalPayePayable : periodTaxes.payeAssessment.calculatedAmount,
            citPayable: periodTaxes.citAssessment.calculatedAmount,
            developmentLevy: periodTaxes.devLevyAssessment.calculatedAmount,
            totalPayable: netVAT + totalWht + totalCgt + totalPayePayable + periodTaxes.citAssessment.calculatedAmount + periodTaxes.devLevyAssessment.calculatedAmount
        },
        assumptions: [
            isVatRegistered ? 'VAT Registered' : 'Not VAT Registered',
            resolvedIsSmallCompany ? 'Small Company (CIT/Dev Levy Exempt)' : 'Large Company',
            'All amounts VAT-exclusive per FIRS rules',
            `Output VAT: ₦${totalOutputVAT.toLocaleString()}, Input VAT: ₦${totalInputVAT.toLocaleString()}`,
            disallowableExpenses > 0 ? `Disallowable expenses: ₦${disallowableExpenses.toLocaleString()}` : ''
        ].filter(a => a !== '')
    };
}



// Helpers
function createAssessment(
    type: TaxType,
    applies: boolean,
    reason: string,
    rateDec: number,
    base: number,
    calcAmount: number,
    bearer: 'business' | 'counterparty' | 'employee',
    step?: string,
    remittedBy: string = 'Business'
): TaxAssessment {
    return {
        taxType: type,
        applies,
        reason,
        legalRate: `${rateDec * 100}%`,
        rateDecimal: rateDec,
        baseAmount: base,
        calculatedAmount: calcAmount,
        calculationSteps: step ? [step] : [],
        bearerOfTax: bearer,
        remittedBy,
        remittedTo: 'FIRS/SIRS'
    };
}
