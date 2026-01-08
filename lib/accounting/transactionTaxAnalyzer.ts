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
    WHT_PROFESSIONAL_SERVICES: 0.05, // 5%
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
    transactionAmount: number;
    journalEntry: JournalEntry;
    taxAssessments: TaxAssessment[]; // Only VAT, WHT, CGT
    totalTaxForTransaction: number;
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

    // Section 2: Period Summary (Accounting Basis)
    periodSummary: {
        totalRevenue: number;
        totalExpenses: number;
        payrollExpense: number;
        netProfitBeforeTax: number;
    };

    // Section 3: Period Taxes (CIT/Dev Levy)
    periodTaxes: PeriodTaxAssessment;

    // Section 4: Final Totals
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

export function identifyTransactionNature(entry: JournalEntry): TransactionNature {
    const accountCodes = entry.lines.map(line => line.accountCode);
    const narration = entry.narration.toLowerCase();

    // Check for payroll indicators
    if (accountCodes.some(code => code.startsWith('54')) || // Payroll expenses
        narration.includes('salary') || narration.includes('wage') ||
        narration.includes('payroll')) {
        return 'payroll';
    }

    // Check for revenue accounts (4xxx)
    const hasRevenueAccount = accountCodes.some(code => code.startsWith('4'));

    if (hasRevenueAccount) {
        if (accountCodes.includes('4200') || narration.includes('interest')) return 'interest_income';
        if (accountCodes.includes('4210') || narration.includes('dividend')) return 'dividend_income';
        if (accountCodes.includes('4220') || narration.includes('rent')) return 'rent_income';
        if (accountCodes.includes('4010') || narration.includes('service') ||
            narration.includes('consulting') || narration.includes('professional')) {
            return 'sale_of_services';
        }
        return 'sale_of_goods';
    }

    // Check for asset sales
    if (accountCodes.includes('4300') || accountCodes.includes('6020') ||
        narration.includes('disposal') || narration.includes('sold asset')) {
        return 'asset_sale';
    }

    // Check for purchases
    const hasExpenseAccount = accountCodes.some(code => code.startsWith('5') || code.startsWith('6'));
    if (hasExpenseAccount) {
        if (narration.includes('professional') || narration.includes('consulting') ||
            narration.includes('legal') || narration.includes('audit')) {
            return 'purchase_services';
        }
        if (accountCodes.some(code => code.startsWith('50'))) {
            return 'purchase_goods';
        }
    }

    if (accountCodes.some(code => code.startsWith('15'))) {
        return 'capital_expenditure';
    }

    return 'other';
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

    if (nature === 'purchase_goods' || nature === 'purchase_services') {
        const vat = amount * TAX_RATES_2026.VAT_RATE;
        return createAssessment('VAT', true, 'Input VAT (recoverable)', 0.075, amount, -vat, 'business',
            `Input VAT = ${formatCurrency(amount)} × 7.5%`, 'Supplier');
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
            `WHT Credit = ${formatCurrency(amount)} × ${rate * 100}%`, undefined, 'Payer');
    }

    if (nature === 'purchase_services') {
        const rate = TAX_RATES_2026.WHT_PROFESSIONAL_SERVICES;
        const wht = amount * rate;
        return createAssessment('WHT', true, 'WHT Payable to FIRS', rate, amount, wht, 'counterparty',
            `WHT Payable = ${formatCurrency(amount)} × 5%`, 'Business (payer)');
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
    // Determine isSmallCompany: use option if provided, otherwise auto-detect based on revenue
    let resolvedIsSmallCompany = options.isSmallCompany;

    // 0. Pre-scan for Total Revenue to determine Company Size if status not explicitly forced
    if (resolvedIsSmallCompany === undefined) {
        let tempRevenue = 0;
        for (const entry of entries) {
            const nature = identifyTransactionNature(entry);
            if (['sale_of_goods', 'sale_of_services', 'interest_income', 'rent_income', 'dividend_income'].includes(nature)) {
                // Revenue amount
                const amount = entry.lines.filter(l => l.debit > 0).reduce((s, l) => s + l.debit, 0);
                tempRevenue += amount;
            }
        }
        // Auto-detect: Exempt if turnover < ₦50M
        resolvedIsSmallCompany = tempRevenue < TAX_RATES_2026.CIT_SMALL_COMPANY_THRESHOLD;
    }

    const analyses: TransactionTaxAnalysis[] = [];

    // 1. Transaction Logic (VAT, WHT, CGT)
    let totalVat = 0;
    let totalWht = 0;
    let totalCgt = 0;

    // Period Aggregates
    let totalRevenue = 0;
    let totalExpenses = 0;
    let payrollExpense = 0;

    for (const entry of entries) {
        const nature = identifyTransactionNature(entry);

        // Compute Amount (One-sided)
        const amount = entry.lines.filter(l => l.debit > 0).reduce((s, l) => s + l.debit, 0);

        // Aggregate for Period Taxes
        if (['sale_of_goods', 'sale_of_services', 'interest_income', 'rent_income', 'dividend_income'].includes(nature)) {
            totalRevenue += amount;
        } else if (['purchase_goods', 'purchase_services', 'payroll', 'expense'].includes(nature)) {
            // Note: Journal entries for expenses are Dr Expense. Revenue is Cr Revenue.
            // We need to be careful with signs.
            // But here we rely on "Nature" classification.
            if (nature === 'payroll') payrollExpense += amount;
            totalExpenses += amount;
        }

        // Assess Transaction Taxes
        const vat = assessVAT(entry, nature, amount, isVatRegistered);
        const wht = assessWHT(entry, nature, amount);
        const cgt = assessCGT(nature, amount, resolvedIsSmallCompany ?? false); // key correction

        const taxAssessments = [vat, wht, cgt];
        const txTotal = taxAssessments.reduce((sum, t) => sum + (t.applies ? t.calculatedAmount : 0), 0);

        if (vat.applies) totalVat += vat.calculatedAmount;
        if (wht.applies) totalWht += wht.calculatedAmount;
        if (cgt.applies) totalCgt += cgt.calculatedAmount;

        analyses.push({
            transactionId: entry.id,
            transactionDate: entry.date,
            transactionNarration: entry.narration,
            transactionNature: nature,
            transactionAmount: amount,
            journalEntry: entry,
            taxAssessments,
            totalTaxForTransaction: txTotal
        });
    }

    // 2. Period Logic (CIT, Dev Levy, PAYE)
    // 2. Period Logic (CIT, Dev Levy, PAYE)
    const netProfit = totalRevenue - totalExpenses;
    const periodTaxes = calculatePeriodTaxes(totalRevenue, netProfit, payrollExpense, resolvedIsSmallCompany ?? false);

    // 3. Final Summary
    return {
        asAtDate: new Date().toISOString().split('T')[0],
        analyses,
        periodSummary: {
            totalRevenue,
            totalExpenses,
            payrollExpense,
            netProfitBeforeTax: netProfit
        },
        periodTaxes,
        summary: {
            vatPayable: totalVat,
            whtPayable: totalWht,
            cgtPayable: totalCgt,
            payePayable: periodTaxes.payeAssessment.calculatedAmount,
            citPayable: periodTaxes.citAssessment.calculatedAmount,
            developmentLevy: periodTaxes.devLevyAssessment.calculatedAmount,
            totalPayable: totalVat + totalWht + totalCgt + periodTaxes.totalPeriodTax
        },
        assumptions: [
            isVatRegistered ? 'VAT Registered' : 'Not VAT Registered',
            resolvedIsSmallCompany ? 'Small Company (Exempt from CIT/Dev Levy)' : 'Large Company',
            'CIT/Levy calc based on Accounting Profit (Strict Basis)'
        ]
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
