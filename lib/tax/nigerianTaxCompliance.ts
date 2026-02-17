/**
 * INSIGHT — NIGERIAN TAX & ACCOUNTING COMPLIANCE ENGINE
 * 
 * This module implements the core non-negotiable rules for Nigerian tax compliance
 * under CITA, VAT Act, and FIRS practice notes.
 * 
 * All outputs must be audit-safe, mathematically consistent, and legally defensible.
 */

// =============================================================================
// CONSTANTS & RATES
// =============================================================================

export const VAT_RATE = 7.5; // Current Nigerian VAT rate
export const VAT_MULTIPLIER = 1 + (VAT_RATE / 100); // 1.075

// WHT Rates by category
export const WHT_RATES = {
    PROFESSIONAL_SERVICES: 10,
    CONTRACT_SUPPLY: 5,
    RENT: 10,
    INTEREST: 10,
    DIVIDENDS: 10,
    ROYALTIES: 10,
    COMMISSION: 10,
    CONSULTANCY: 10,
    DIRECTORS_FEES: 10,
    CONSTRUCTION: 5,
    ALL_ASPECTS_CONTRACT: 5,
} as const;

// Education Tax Rate
export const EDUCATION_TAX_RATE = 2.5;

// CIT Rates by company size
export const CIT_RATES = {
    SMALL: 0,      // Turnover < ₦25M
    MEDIUM: 20,    // Turnover ₦25M - ₦100M
    LARGE: 30,     // Turnover > ₦100M
} as const;

// Turnover thresholds
export const TURNOVER_THRESHOLDS = {
    SMALL_MAX: 25_000_000,
    MEDIUM_MAX: 100_000_000,
} as const;

// =============================================================================
// RULE 1 & 2: VAT EXTRACTION FUNCTIONS
// =============================================================================

/**
 * RULE 2: Always strip VAT before computation
 * If a transaction amount includes VAT, extract it first.
 * 
 * Formula: Net Amount = Gross ÷ 1.075
 *          VAT = Gross − Net
 */
export function extractVATFromGross(grossAmount: number): {
    netAmount: number;
    vatAmount: number;
} {
    const netAmount = grossAmount / VAT_MULTIPLIER;
    const vatAmount = grossAmount - netAmount;

    return {
        netAmount: Math.round(netAmount * 100) / 100,
        vatAmount: Math.round(vatAmount * 100) / 100,
    };
}

/**
 * RULE 3: Compute VAT on VAT-exclusive base only
 * 
 * VAT = 7.5% × VAT-exclusive amount
 * NEVER compute VAT on VAT-inclusive figures.
 */
export function computeVATOnExclusiveBase(exclusiveAmount: number): number {
    return Math.round((exclusiveAmount * VAT_RATE / 100) * 100) / 100;
}

// =============================================================================
// RULE 4: INPUT VAT RESTRICTIONS
// =============================================================================

/**
 * Categories that are allowed to claim input VAT
 */
export const INPUT_VAT_CLAIMABLE_CATEGORIES = [
    'raw-materials',
    'inventory',
    'direct-production',
    'cost-of-goods-sold',
    'cost-of-sales',
    'stock-purchase',
    'material-purchase',
] as const;

/**
 * Categories that CANNOT claim input VAT
 */
export const INPUT_VAT_NON_CLAIMABLE = [
    'entertainment',
    'staff-welfare',
    'professional-services',
    'donations',
    'fines-penalties',
    'personal-expenses',
] as const;

/**
 * RULE 4: Determine if input VAT can be claimed for a given expense category
 */
export function canClaimInputVAT(category: string): {
    canClaim: boolean;
    reason: string;
} {
    const lowerCategory = category.toLowerCase().replace(/\s+/g, '-');

    // Check if it's explicitly claimable
    const isClaimable = INPUT_VAT_CLAIMABLE_CATEGORIES.some(c =>
        lowerCategory.includes(c)
    );

    // Check if it's explicitly non-claimable
    const isBlocked = INPUT_VAT_NON_CLAIMABLE.some(c =>
        lowerCategory.includes(c)
    );

    if (isBlocked) {
        return {
            canClaim: false,
            reason: `Input VAT not claimable on ${category} per FIRS rules`
        };
    }

    if (isClaimable) {
        return {
            canClaim: true,
            reason: 'Input VAT claimable on direct production/inventory costs'
        };
    }

    // Default: not claimable for other expenses
    return {
        canClaim: false,
        reason: 'Input VAT only claimable on direct production costs'
    };
}

// =============================================================================
// RULE 5: VAT PAYABLE COMPUTATION
// =============================================================================

export interface VATPosition {
    outputVAT: number;
    inputVAT: number;
    netPosition: number;
    isPayable: boolean;
    isCredit: boolean;
    displayLabel: string;
    displayAmount: number;
}

/**
 * RULE 5: VAT Payable Logic
 * 
 * VAT Payable = Output VAT − Input VAT
 * - If result > 0 → VAT Payable (liability)
 * - If result < 0 → VAT Credit (recoverable)
 * - NEVER net VAT into income tax
 */
export function computeVATPosition(outputVAT: number, inputVAT: number): VATPosition {
    const netPosition = outputVAT - inputVAT;
    const isPayable = netPosition > 0;
    const isCredit = netPosition < 0;

    return {
        outputVAT,
        inputVAT,
        netPosition,
        isPayable,
        isCredit,
        displayLabel: isCredit ? 'VAT Credit (Recoverable)' : 'Net VAT Payable',
        displayAmount: Math.abs(netPosition),
    };
}

// =============================================================================
// RULE 7: DISALLOWABLE EXPENSES
// =============================================================================

export const DISALLOWABLE_EXPENSES = [
    {
        category: 'entertainment',
        keywords: ['entertainment', 'party', 'celebration', 'gifts', 'presents'],
        reason: 'Entertainment expenses are not deductible for tax purposes',
        partiallyAllowed: false,
    },
    {
        category: 'fines-penalties',
        keywords: ['fine', 'penalty', 'penalt', 'violation', 'infraction'],
        reason: 'Fines and penalties are not tax-deductible',
        partiallyAllowed: false,
    },
    {
        category: 'donations',
        keywords: ['donation', 'charity', 'contribution', 'philanthropic'],
        reason: 'Donations are disallowable unless to approved institutions',
        partiallyAllowed: true,
    },
    {
        category: 'personal-expenses',
        keywords: ['personal', 'private', 'owner', 'family'],
        reason: 'Personal expenses of directors/owners are not deductible',
        partiallyAllowed: false,
    },
    {
        category: 'depreciation',
        keywords: ['depreciation', 'amortisation', 'amortization'],
        reason: 'Accounting depreciation replaced by capital allowances',
        partiallyAllowed: false,
    },
    {
        category: 'provisions',
        keywords: ['provision', 'reserve', 'contingent'],
        reason: 'General provisions are not tax-deductible',
        partiallyAllowed: false,
    },
] as const;

/**
 * Check if an expense is disallowable for tax purposes
 */
export function isDisallowableExpense(expenseName: string): {
    isDisallowable: boolean;
    category: string;
    reason: string;
} {
    const lowerName = expenseName.toLowerCase();

    for (const rule of DISALLOWABLE_EXPENSES) {
        const match = rule.keywords.some(k => lowerName.includes(k));
        if (match) {
            return {
                isDisallowable: true,
                category: rule.category,
                reason: rule.reason,
            };
        }
    }

    return {
        isDisallowable: false,
        category: '',
        reason: '',
    };
}

// =============================================================================
// RULE 8: TAX ADJUSTMENT COMPUTATION (MANDATORY ORDER)
// =============================================================================

export interface TaxAdjustmentSchedule {
    accountingProfit: number;
    isLoss: boolean;
    disallowables: Array<{ name: string; amount: number; reason: string }>;
    totalDisallowables: number;
    adjustedProfit: number;
    capitalAllowances: number;
    taxableProfit: number;
    isTaxLoss: boolean;
}

/**
 * RULE 8: Order of Computation (MANDATORY)
 * 
 * 1. Compute Accounting Profit or Loss
 * 2. Identify Disallowable Expenses
 * 3. Add back disallowable items
 * 4. Apply capital allowances
 * 5. Derive Taxable Profit
 * 
 * NEVER force taxable profit to zero — derive it.
 */
export function generateTaxAdjustmentSchedule(
    accountingProfit: number,
    disallowables: Array<{ name: string; amount: number }>,
    capitalAllowances: number = 0
): TaxAdjustmentSchedule {
    const isLoss = accountingProfit < 0;

    // Tag disallowables with reasons
    const taggedDisallowables = disallowables.map(d => {
        const check = isDisallowableExpense(d.name);
        return {
            ...d,
            reason: check.reason || 'Disallowable per CITA',
        };
    });

    const totalDisallowables = disallowables.reduce((sum, d) => sum + d.amount, 0);

    // Add back disallowables
    const adjustedProfit = accountingProfit + totalDisallowables;

    // Apply capital allowances
    const taxableProfit = adjustedProfit - capitalAllowances;

    return {
        accountingProfit,
        isLoss,
        disallowables: taggedDisallowables,
        totalDisallowables,
        adjustedProfit,
        capitalAllowances,
        taxableProfit,
        isTaxLoss: taxableProfit <= 0,
    };
}

// =============================================================================
// RULE 10: COMPANY SIZE & CIT COMPUTATION
// =============================================================================

export type CompanySize = 'Small' | 'Medium' | 'Large';

export function determineCompanySize(turnover: number): CompanySize {
    if (turnover <= TURNOVER_THRESHOLDS.SMALL_MAX) return 'Small';
    if (turnover <= TURNOVER_THRESHOLDS.MEDIUM_MAX) return 'Medium';
    return 'Large';
}

export interface CITComputation {
    companySize: CompanySize;
    turnover: number;
    taxableProfit: number;
    isTaxLoss: boolean;
    citRate: number;
    citPayable: number;
    educationTax: number;
    totalDirectTax: number;
    reason: string;
}

/**
 * RULE 10: Small Company Rule (Nigeria)
 * 
 * If company qualifies as small company:
 * - CIT = ₦0 regardless of profit
 * - Taxable profit must still be computed and disclosed
 * 
 * RULE 9: Tax Loss Handling
 * - Losses must remain negative (don't force to zero)
 */
export function computeCIT(
    taxableProfit: number,
    turnover: number
): CITComputation {
    const companySize = determineCompanySize(turnover);
    const isTaxLoss = taxableProfit <= 0;

    // Determine CIT rate
    let citRate: number;
    switch (companySize) {
        case 'Small': citRate = CIT_RATES.SMALL; break;
        case 'Medium': citRate = CIT_RATES.MEDIUM; break;
        case 'Large': citRate = CIT_RATES.LARGE; break;
    }

    // Compute CIT (only on positive taxable profit)
    const citPayable = isTaxLoss ? 0 : Math.round((taxableProfit * citRate / 100) * 100) / 100;

    // Education tax (only on positive profit for non-small companies)
    const educationTax = (isTaxLoss || companySize === 'Small')
        ? 0
        : Math.round((taxableProfit * EDUCATION_TAX_RATE / 100) * 100) / 100;

    // Determine reason for ₦0 CIT
    let reason: string;
    if (isTaxLoss) {
        reason = 'Tax Loss — No taxable profit';
    } else if (companySize === 'Small') {
        reason = 'Small Company (0% CIT)';
    } else {
        reason = `${citRate}% (${companySize} Company)`;
    }

    return {
        companySize,
        turnover,
        taxableProfit,
        isTaxLoss,
        citRate,
        citPayable,
        educationTax,
        totalDirectTax: citPayable + educationTax,
        reason,
    };
}

// =============================================================================
// RULE 14: FAIL-SAFE VALIDATION
// =============================================================================

export interface ComplianceValidation {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * RULE 14: Mathematical Consistency Check
 * 
 * Before final output:
 * - Assets = Liabilities + Equity
 * - Profit/Loss ties across all statements
 * - VAT ledgers reconcile with transaction trace
 */
export function validateComplianceRules(params: {
    revenue: number;
    expenses: number;
    grossProfit: number;
    accountingProfit: number;
    assets: number;
    liabilities: number;
    equity: number;
    vatInPL?: boolean;
    outputVAT: number;
    inputVAT: number;
}): ComplianceValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // CHECK 1: Assets = Liabilities + Equity (with tolerance for rounding)
    const balanceEquation = Math.abs(params.assets - (params.liabilities + params.equity));
    if (balanceEquation > 1) {
        errors.push(`CRITICAL: Balance sheet equation violated. Assets (${params.assets}) ≠ Liabilities (${params.liabilities}) + Equity (${params.equity})`);
    }

    // CHECK 2: Gross Profit ≠ Accounting Profit when expenses exist
    if (params.expenses > 0 && params.grossProfit === params.accountingProfit) {
        errors.push('CRITICAL: Gross Profit equals Profit Before Tax. Operating expenses may be missing.');
    }

    // CHECK 3: Revenue with zero expenses
    if (params.revenue > 1_000_000 && params.expenses === 0) {
        errors.push('CRITICAL: Revenue detected with ZERO expenses. Income Statement is incomplete.');
    }

    // CHECK 4: VAT in P&L
    if (params.vatInPL) {
        errors.push('CRITICAL: VAT appears in Profit & Loss. VAT must be posted to liability/asset accounts only.');
    }

    // CHECK 5: Negative profit shown as positive
    // (This is a logical check - caller must track this)

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * FAIL-SAFE MODE: Generate error if computation is blocked
 */
export function generateComplianceBlockError(errors: string[]): string {
    return `
⛔ TAX COMPUTATION BLOCKED — INVALID BASE DETECTED

The following compliance violations were detected:

${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Please correct these issues before generating tax output.

Per FIRS compliance rules, tax computation cannot proceed with invalid accounting data.
  `.trim();
}

// =============================================================================
// AI TAX AUDIT SYSTEM PROMPT
// =============================================================================

export const AI_TAX_AUDIT_SYSTEM_PROMPT = `You are a Nigerian tax and accounting expert.

Review the tax computation and transaction schedule provided and **identify all errors and inconsistencies**.

**Specifically:**

* Detect any **incorrect Withholding Tax (WHT) rates or amounts**, especially on professional services, and correct them.
* Detect any **missing Value Added Tax (VAT)** on taxable supplies and apply the **correct 7.5% rate** where required.
* Recalculate **Input VAT, Output VAT, and Net VAT payable**, ensuring figures properly reconcile.
* Remove any tax marked as "None" where Nigerian tax law requires VAT or WHT.
* Ensure total tax liabilities are **mathematically accurate and legally compliant**.

**Improve the output by:**

* Presenting a clean, corrected tax summary table
* Clearly separating **direct taxes** and **transaction taxes**
* Adding short explanations for each correction made
* Ensuring all totals reconcile with the underlying figures

Assume the entity is **VAT-registered** and qualifies as a **small company exempt from Company Income Tax**.
Maintain a professional, helpful, and advisory tone in your "auditorCommentary".

**Response Format:**
Return a JSON object with the following structure:
{
  "auditorCommentary": "A helpful, professional summary of the audit findings in natural language. Talk to the user as a friendly tax advisor.",
  "errors": [
    { "type": "WHT" | "VAT" | "CIT" | "CALCULATION", "description": string, "original": any, "corrected": any }
  ],
  "correctedSummary": {
    "directTaxes": {
      "cit": { "amount": number, "reason": string },
      "educationTax": { "amount": number, "basis": string },
      "paye": { "amount": number, "note": string }
    },
    "transactionTaxes": {
      "outputVAT": number,
      "inputVAT": number,
      "netVAT": number,
      "vatStatus": "PAYABLE" | "CREDIT",
      "totalWHT": number,
      "whtBreakdown": [{ "category": string, "amount": number, "rate": number }]
    },
    "totalLiability": number
  },
  "explanations": string[],
  "isCompliant": boolean
}`;

// =============================================================================
// AI AUDIT REQUEST/RESPONSE TYPES
// =============================================================================

export interface TaxAuditRequest {
    transactions: Array<{
        description: string;
        amount: number;
        type: string;
        category?: string;
    }>;
    computedTaxes: {
        cit?: number;
        vat?: number;
        wht?: number;
        paye?: number;
        educationTax?: number;
    };
    companyInfo: {
        turnover: number;
        isVATRegistered: boolean;
        companySize: 'small' | 'medium' | 'large';
    };
}

export interface TaxAuditError {
    type: 'WHT' | 'VAT' | 'CIT' | 'CALCULATION';
    description: string;
    original: unknown;
    corrected: unknown;
}

export interface TaxAuditResponse {
    auditorCommentary: string;
    errors: TaxAuditError[];
    correctedSummary: {
        directTaxes: {
            cit: { amount: number; reason: string };
            educationTax: { amount: number; basis: string };
            paye: { amount: number; note: string };
        };
        transactionTaxes: {
            outputVAT: number;
            inputVAT: number;
            netVAT: number;
            vatStatus: 'PAYABLE' | 'CREDIT';
            totalWHT: number;
            whtBreakdown: Array<{ category: string; amount: number; rate: number }>;
        };
        totalLiability: number;
    };
    explanations: string[];
    isCompliant: boolean;
}

// =============================================================================
// EXPORTS FOR TAX MODULE
// =============================================================================

export const NigerianTaxCompliance = {
    VAT_RATE,
    VAT_MULTIPLIER,
    WHT_RATES,
    CIT_RATES,
    EDUCATION_TAX_RATE,
    TURNOVER_THRESHOLDS,

    extractVATFromGross,
    computeVATOnExclusiveBase,
    canClaimInputVAT,
    computeVATPosition,
    isDisallowableExpense,
    generateTaxAdjustmentSchedule,
    determineCompanySize,
    computeCIT,
    validateComplianceRules,
    generateComplianceBlockError,

    // AI Audit
    AI_TAX_AUDIT_SYSTEM_PROMPT,
};

export default NigerianTaxCompliance;
