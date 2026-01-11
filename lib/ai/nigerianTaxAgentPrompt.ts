/**
 * Nigerian Tax Agent System Prompt
 * 
 * Production-grade system prompt for the AI tax analyst embedded in the accounting software.
 * Follows strict FIRS guidelines and accrual-based accounting principles.
 */

export const NIGERIAN_TAX_AGENT_SYSTEM_PROMPT = `
**Role**
You are a professional Nigerian financial accountant and tax computation engine.
You must strictly follow Nigerian tax laws, FIRS guidelines, and accrual-based accounting principles.

You DO NOT estimate profit independently.
You MUST derive taxable profit from the accounting financial statements provided.

---

## PRIMARY RULES

1. Always treat the **Income Statement (Profit or Loss)** as the single source of truth for profit.
2. Never recompute revenue or expenses outside the financial statements.
3. Tax computation must begin from **Accounting Profit Before Tax**.
4. Never guess or override accounting figures.
5. If figures don't match, STOP and raise an error.

---

## TAX COMPUTATION FLOW (MANDATORY)

All tax computations MUST follow this exact flow:

\`\`\`
Accounting Profit Before Tax
+ Disallowable Expenses (explicitly listed)
- Allowable Deductions
- Capital Allowances (tax-based, NOT accounting depreciation)
= Taxable Profit
- Exemptions/Reliefs (applied at final stage only)
= Tax Payable
\`\`\`

Only after full computation may tax exemptions or reliefs be applied.

---

## DISALLOWABLE EXPENSE RULES (NIGERIA)

The following expenses are **NOT tax-deductible** and MUST be **added back**:

| Expense Type | Treatment |
|-------------|-----------|
| Business entertainment expenses | NOT deductible - Add back |
| Penalties and fines | NOT deductible - Add back |
| Personal expenses | NOT deductible - Add back |
| Donations (except approved) | NOT deductible - Add back |
| Capital expenditure expensed | NOT deductible - Add back |
| Provisions (general) | NOT deductible - Add back |

Disallowable expenses must **ALWAYS** be added back and disclosed separately.

---

## SMALL COMPANY RULE

- Small company status does **NOT** skip computation.
- Taxable profit **must** be calculated and shown in full.
- CIT exemption is applied at the **final stage only**.
- The full computation trail must be visible.

---

## VAT RULES (7.5%)

| Type | Treatment |
|------|-----------|
| Output VAT | 7.5% on taxable sales |
| Input VAT | Only on eligible purchases |
| VAT on imports (port) | NOT claimable |
| VAT on imports (recoverable) | Claimable |
| Sales returns | Reverse output VAT |
| Capital items | NO input VAT credit |

VAT payable = Output VAT - Claimable Input VAT

---

## WITHHOLDING TAX (WHT) RULES

- WHT must be tracked as a **recoverable tax credit**.
- WHT does **NOT** reduce expense amounts.
- WHT payable and WHT credit must be disclosed **separately**.
- Apply correct WHT rates based on transaction type.

---

## PAYE RULES

- PAYE must be computed from **gross salaries**.
- PAYE is a **liability**, not an expense.
- Employer pension contribution is an **expense**.
- Employee pension contribution is a **liability**.
- Apply statutory reliefs per tax law.

---

## REPORTING REQUIREMENTS

You MUST generate the following schedules:

### 1️⃣ Tax Adjustment Schedule
| Item | Amount |
|------|--------|
| Accounting Profit Before Tax | ₦X |
| Add: Disallowable Expenses | |
| - Entertainment | ₦X |
| - Penalties/Fines | ₦X |
| Less: Allowable Deductions | (₦X) |
| Less: Capital Allowances | (₦X) |
| **Taxable Profit** | ₦X |

### 2️⃣ VAT Computation Schedule
| Item | Amount |
|------|--------|
| Output VAT on Sales | ₦X |
| Less: Input VAT (Claimable) | (₦X) |
| **Net VAT Payable** | ₦X |

### 3️⃣ Direct Tax Summary
| Tax Type | Basis | Rate | Payable |
|----------|-------|------|---------|
| CIT | Taxable Profit | X% | ₦X |
| Education Tax (TET) | Assessable Profit | 2.5% | ₦X |
| PAYE | Gross Salaries | Graduated | ₦X |
| WHT Payable | Applicable Payments | Various | ₦X |
| WHT Credit | Deducted at Source | N/A | ₦X |

### 4️⃣ Audit Trail
Every figure must link: Transaction → Account → Financial Statement → Tax Schedule

---

## ERROR HANDLING

**CRITICAL**: If figures in the tax schedule do not match the financial statements:
1. **STOP** the computation
2. **RAISE** a clear error message
3. **DO NOT** guess or override
4. **REQUEST** reconciliation

Never present unreconciled figures as final.

---

## CONFIDENCE LEVELS

Tag each computation:
- 🟢 **Complete** — All data present, fully reconciled
- 🟡 **Assumptive** — User review required
- 🔴 **Incomplete** — Missing critical data, cannot proceed

---

## OUTPUT FORMAT

- Use structured tables
- Clearly label:
  • Accounting figures
  • Tax adjustments
  • Final tax payable
- Do NOT combine taxes into a single line
- Each tax type must be shown separately

---

## WHAT YOU MUST NOT DO

❌ Do not guess missing values
❌ Do not override accounting figures
❌ Do not apply wrong tax year rules
❌ Do not present opinions as law
❌ Do not skip the computation flow
❌ Do not combine disallowable items without disclosure

---

## MISSION

You must behave like a **tax auditor reviewing a filing before submission to FIRS**.

Your goal is to produce:
- Transparent computations
- Defensible figures
- Audit-ready schedules
- Full traceability

Accuracy and compliance are more important than speed.
`;

/**
 * Confidence levels for tax computations
 */
export type TaxConfidenceLevel = 'complete' | 'assumptive' | 'incomplete';

export interface TaxConfidenceIndicator {
    level: TaxConfidenceLevel;
    emoji: string;
    label: string;
    description: string;
}

export const CONFIDENCE_INDICATORS: Record<TaxConfidenceLevel, TaxConfidenceIndicator> = {
    complete: {
        level: 'complete',
        emoji: '🟢',
        label: 'Complete',
        description: 'All required data present',
    },
    assumptive: {
        level: 'assumptive',
        emoji: '🟡',
        label: 'Assumptive',
        description: 'User review required',
    },
    incomplete: {
        level: 'incomplete',
        emoji: '🔴',
        label: 'Incomplete',
        description: 'Missing critical data',
    },
};

/**
 * Get confidence indicator based on data completeness
 */
export function getConfidenceIndicator(
    hasAllRequiredData: boolean,
    hasAssumptions: boolean
): TaxConfidenceIndicator {
    if (!hasAllRequiredData) {
        return CONFIDENCE_INDICATORS.incomplete;
    }
    if (hasAssumptions) {
        return CONFIDENCE_INDICATORS.assumptive;
    }
    return CONFIDENCE_INDICATORS.complete;
}

/**
 * Risk patterns to detect in transactions
 */
export const RISK_PATTERNS = [
    {
        id: 'revenue-no-vat',
        pattern: 'Revenue with no VAT output',
        check: (revenue: number, outputVAT: number) => revenue > 0 && outputVAT === 0,
        severity: 'warning' as const,
    },
    {
        id: 'depreciation-no-assets',
        pattern: 'Depreciation without fixed assets',
        check: (depreciation: number, fixedAssets: number) => depreciation > 0 && fixedAssets === 0,
        severity: 'warning' as const,
    },
    {
        id: 'payroll-no-paye',
        pattern: 'Payroll expense with no PAYE schedule',
        check: (payrollExpense: number, payeAmount: number) => payrollExpense > 0 && payeAmount === 0,
        severity: 'warning' as const,
    },
    {
        id: 'large-disallowable',
        pattern: 'Large expense that may be disallowable',
        check: (expenseAmount: number, threshold: number) => expenseAmount > threshold,
        severity: 'info' as const,
    },
];

/**
 * Format a tax computation response with confidence indicator
 */
export function formatTaxResponse(
    message: string,
    confidence: TaxConfidenceIndicator,
    assumptions?: string[],
    warnings?: string[]
): string {
    const parts: string[] = [message];

    parts.push('');
    parts.push(`**Status:** ${confidence.emoji} ${confidence.label} — ${confidence.description}`);

    if (assumptions && assumptions.length > 0) {
        parts.push('');
        parts.push('**Assumptions:**');
        assumptions.forEach(a => parts.push(`• ${a}`));
    }

    if (warnings && warnings.length > 0) {
        parts.push('');
        parts.push('**⚠️ Warnings:**');
        warnings.forEach(w => parts.push(`• ${w}`));
    }

    return parts.join('\n');
}

/**
 * Nigerian Disallowable Expenses (FIRS Guidelines)
 * These expenses must be added back to accounting profit for tax purposes
 */
export const DISALLOWABLE_EXPENSES = [
    {
        id: 'entertainment',
        name: 'Business Entertainment',
        keywords: ['entertainment', 'hospitality', 'client dinner', 'staff party', 'gifts to clients'],
        description: 'NOT tax-deductible under Nigerian tax law',
    },
    {
        id: 'penalties',
        name: 'Penalties and Fines',
        keywords: ['penalty', 'fine', 'late fee', 'regulatory fine', 'court fine'],
        description: 'NOT tax-deductible - punitive in nature',
    },
    {
        id: 'personal',
        name: 'Personal Expenses',
        keywords: ['personal', 'owner personal', 'director personal', 'private'],
        description: 'NOT tax-deductible - not incurred for business purposes',
    },
    {
        id: 'donations-unapproved',
        name: 'Donations (Unapproved)',
        keywords: ['donation', 'charity', 'contribution'],
        description: 'NOT deductible unless to approved organizations',
    },
    {
        id: 'capital-expensed',
        name: 'Capital Expenditure',
        keywords: ['capital', 'fixed asset', 'acquisition'],
        description: 'NOT deductible - should be capitalized and depreciated',
    },
    {
        id: 'general-provisions',
        name: 'General Provisions',
        keywords: ['provision', 'reserve', 'contingency'],
        description: 'NOT deductible - must be specific and crystallized',
    },
    {
        id: 'depreciation',
        name: 'Accounting Depreciation',
        keywords: ['depreciation', 'amortization'],
        description: 'NOT deductible - replaced by Capital Allowances',
    },
];

/**
 * Nigerian WHT Rates by Transaction Type
 */
export const WHT_RATES: Record<string, { rate: number; description: string }> = {
    'dividend': { rate: 10, description: 'Dividends from companies' },
    'interest': { rate: 10, description: 'Interest payments' },
    'rent': { rate: 10, description: 'Rent for any property' },
    'royalties': { rate: 10, description: 'Royalties and license fees' },
    'professional': { rate: 10, description: 'Professional services (legal, accounting, etc.)' },
    'technical': { rate: 10, description: 'Technical and management fees' },
    'consultancy': { rate: 10, description: 'Consultancy services' },
    'construction': { rate: 5, description: 'Construction activities' },
    'contracts': { rate: 5, description: 'All contracts and agency' },
    'director-fees': { rate: 10, description: 'Directors fees' },
    'hire': { rate: 10, description: 'Hire of equipment' },
};

/**
 * Nigerian CIT Rates by Company Size
 */
export const CIT_RATES = {
    small: { turnoverMax: 25_000_000, rate: 0, description: 'Small Company (< ₦25M) - 0% CIT' },
    medium: { turnoverMax: 100_000_000, rate: 20, description: 'Medium Company (₦25M - ₦100M) - 20% CIT' },
    large: { turnoverMax: Infinity, rate: 30, description: 'Large Company (> ₦100M) - 30% CIT' },
};

/**
 * Education Tax Rate (Tertiary Education Tax)
 */
export const EDUCATION_TAX_RATE = 2.5; // 2.5% of assessable profit

/**
 * VAT Rate
 */
export const VAT_RATE = 7.5; // 7.5%

/**
 * Tax Adjustment Schedule Interface
 */
export interface TaxAdjustmentSchedule {
    accountingProfitBeforeTax: number;
    disallowableExpenses: Array<{ name: string; amount: number }>;
    allowableDeductions: Array<{ name: string; amount: number }>;
    capitalAllowances: number;
    taxableProfit: number;
    exemptions: Array<{ name: string; amount: number }>;
    finalTaxableProfit: number;
}

/**
 * Generate Tax Adjustment Schedule
 */
export function generateTaxAdjustmentSchedule(
    accountingProfit: number,
    disallowables: Array<{ name: string; amount: number }>,
    deductions: Array<{ name: string; amount: number }>,
    capitalAllowances: number,
    exemptions: Array<{ name: string; amount: number }> = []
): TaxAdjustmentSchedule {
    const totalDisallowables = disallowables.reduce((sum, d) => sum + d.amount, 0);
    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
    const totalExemptions = exemptions.reduce((sum, e) => sum + e.amount, 0);

    const taxableProfit = accountingProfit + totalDisallowables - totalDeductions - capitalAllowances;
    const finalTaxableProfit = Math.max(0, taxableProfit - totalExemptions);

    return {
        accountingProfitBeforeTax: accountingProfit,
        disallowableExpenses: disallowables,
        allowableDeductions: deductions,
        capitalAllowances,
        taxableProfit,
        exemptions,
        finalTaxableProfit,
    };
}

/**
 * Format Tax Adjustment Schedule as Markdown Table
 */
export function formatTaxAdjustmentSchedule(schedule: TaxAdjustmentSchedule): string {
    const formatAmount = (n: number) => `₦${n.toLocaleString()}`;

    let output = `## Tax Adjustment Schedule\n\n`;
    output += `| Item | Amount |\n|------|--------|\n`;
    output += `| Accounting Profit Before Tax | ${formatAmount(schedule.accountingProfitBeforeTax)} |\n`;

    if (schedule.disallowableExpenses.length > 0) {
        output += `| **Add: Disallowable Expenses** | |\n`;
        schedule.disallowableExpenses.forEach(d => {
            output += `| - ${d.name} | ${formatAmount(d.amount)} |\n`;
        });
    }

    if (schedule.allowableDeductions.length > 0) {
        output += `| **Less: Allowable Deductions** | |\n`;
        schedule.allowableDeductions.forEach(d => {
            output += `| - ${d.name} | (${formatAmount(d.amount)}) |\n`;
        });
    }

    if (schedule.capitalAllowances > 0) {
        output += `| Less: Capital Allowances | (${formatAmount(schedule.capitalAllowances)}) |\n`;
    }

    output += `| **Taxable Profit** | **${formatAmount(schedule.taxableProfit)}** |\n`;

    if (schedule.exemptions.length > 0) {
        output += `| **Less: Exemptions/Reliefs** | |\n`;
        schedule.exemptions.forEach(e => {
            output += `| - ${e.name} | (${formatAmount(e.amount)}) |\n`;
        });
        output += `| **Final Taxable Profit** | **${formatAmount(schedule.finalTaxableProfit)}** |\n`;
    }

    return output;
}

/**
 * Calculate CIT based on company size
 */
export function calculateCIT(taxableProfit: number, annualTurnover: number): {
    rate: number;
    companySize: string;
    citPayable: number;
    educationTax: number;
    totalDirectTax: number;
} {
    let rate: number;
    let companySize: string;

    if (annualTurnover < CIT_RATES.small.turnoverMax) {
        rate = CIT_RATES.small.rate;
        companySize = 'Small Company';
    } else if (annualTurnover < CIT_RATES.medium.turnoverMax) {
        rate = CIT_RATES.medium.rate;
        companySize = 'Medium Company';
    } else {
        rate = CIT_RATES.large.rate;
        companySize = 'Large Company';
    }

    const citPayable = taxableProfit * (rate / 100);
    const educationTax = taxableProfit * (EDUCATION_TAX_RATE / 100);

    return {
        rate,
        companySize,
        citPayable,
        educationTax,
        totalDirectTax: citPayable + educationTax,
    };
}

/**
 * Format Direct Tax Summary as Markdown Table
 */
export function formatDirectTaxSummary(
    cit: ReturnType<typeof calculateCIT>,
    taxableProfit: number,
    payePayable: number = 0,
    whtPayable: number = 0,
    whtCredit: number = 0
): string {
    const formatAmount = (n: number) => `₦${n.toLocaleString()}`;

    let output = `## Direct Tax Summary\n\n`;
    output += `| Tax Type | Basis | Rate | Payable |\n|----------|-------|------|---------|\n`;
    output += `| CIT | ${formatAmount(taxableProfit)} | ${cit.rate}% | ${formatAmount(cit.citPayable)} |\n`;
    output += `| Education Tax (TET) | ${formatAmount(taxableProfit)} | ${EDUCATION_TAX_RATE}% | ${formatAmount(cit.educationTax)} |\n`;

    if (payePayable > 0) {
        output += `| PAYE | Gross Salaries | Graduated | ${formatAmount(payePayable)} |\n`;
    }

    if (whtPayable > 0) {
        output += `| WHT Payable | Various | Per Type | ${formatAmount(whtPayable)} |\n`;
    }

    if (whtCredit > 0) {
        output += `| WHT Credit | Deducted at Source | N/A | (${formatAmount(whtCredit)}) |\n`;
    }

    output += `| **Total Direct Tax** | | | **${formatAmount(cit.totalDirectTax + payePayable + whtPayable - whtCredit)}** |\n`;

    return output;
}
