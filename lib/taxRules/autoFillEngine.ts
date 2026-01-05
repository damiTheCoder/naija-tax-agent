/**
 * Tax Pro Max - Agentic Auto-Fill Engine
 * 
 * Provides intelligent suggestions based on Nigerian tax laws including:
 * - PITA (Personal Income Tax Act)
 * - CITA (Companies Income Tax Act)
 * - Pension Reform Act 2014
 * - NHF Act
 * - VAT Act
 */

import { UserProfile, TaxInputs } from "../types";

// ===========================================================================
// TYPES
// ===========================================================================

export interface AutoFillSuggestion {
    field: keyof TaxInputs;
    suggestedValue: number;
    currentValue: number;
    source: 'accounting' | 'calculated' | 'policy' | 'benchmark';
    lawReference?: string;
    confidence: 'high' | 'medium' | 'low';
    explanation: string;
    category: 'relief' | 'income' | 'deduction' | 'compliance';
}

export interface TaxLawReference {
    code: string;
    title: string;
    section: string;
    summary: string;
    url?: string;
}

export interface QuickFillPreset {
    id: string;
    name: string;
    description: string;
    applicableTo: ('freelancer' | 'company')[];
    fields: Partial<TaxInputs>;
    icon: string;
}

// ===========================================================================
// NIGERIAN TAX LAW REFERENCES
// ===========================================================================

export const NIGERIAN_TAX_LAWS: Record<string, TaxLawReference> = {
    PITA_SEC_33: {
        code: "PITA_SEC_33",
        title: "Personal Income Tax Act",
        section: "Section 33",
        summary: "Consolidated Relief Allowance (CRA): ₦200,000 or 1% of gross income (whichever is higher) + 20% of gross income",
    },
    PITA_SEC_37: {
        code: "PITA_SEC_37",
        title: "Personal Income Tax Act",
        section: "Section 37",
        summary: "Minimum tax of 1% of gross income applies when computed tax is lower",
    },
    PENSION_ACT_2014: {
        code: "PENSION_ACT_2014",
        title: "Pension Reform Act 2014",
        section: "Section 4",
        summary: "Mandatory pension contribution: 8% employee + 10% employer of monthly emoluments",
    },
    NHF_ACT: {
        code: "NHF_ACT",
        title: "National Housing Fund Act",
        section: "Section 5",
        summary: "2.5% of monthly basic salary contribution for eligible employees",
    },
    CITA_SEC_9: {
        code: "CITA_SEC_9",
        title: "Companies Income Tax Act",
        section: "Section 9",
        summary: "Company tax rates: 0% (small <₦25M), 20% (medium ₦25M-₦100M), 30% (large >₦100M)",
    },
    CITA_SEC_33: {
        code: "CITA_SEC_33",
        title: "Companies Income Tax Act",
        section: "Section 33 (as amended)",
        summary: "Minimum tax of 0.5% of turnover for companies with no taxable profit",
    },
    VAT_ACT_SEC_4: {
        code: "VAT_ACT_SEC_4",
        title: "Value Added Tax Act",
        section: "Section 4",
        summary: "VAT rate of 7.5% on taxable goods and services",
    },
    LIFE_INSURANCE: {
        code: "LIFE_INSURANCE",
        title: "Personal Income Tax Act",
        section: "Section 33(1)(d)",
        summary: "Life insurance premiums are deductible as personal relief",
    },
};

// ===========================================================================
// QUICK-FILL PRESETS
// ===========================================================================

export const QUICK_FILL_PRESETS: QuickFillPreset[] = [
    {
        id: "salaried_employee",
        name: "Salaried Employee",
        description: "Standard reliefs for PAYE employees with pension and NHF",
        applicableTo: ["freelancer"],
        icon: "💼",
        fields: {
            // These will be calculated based on income
        },
    },
    {
        id: "freelancer_consultant",
        name: "Freelancer / Consultant",
        description: "Self-employed professional with business expenses",
        applicableTo: ["freelancer"],
        icon: "👨‍💻",
        fields: {},
    },
    {
        id: "small_business",
        name: "Small Business",
        description: "Turnover below ₦25M - 0% CIT rate",
        applicableTo: ["company"],
        icon: "🏪",
        fields: {},
    },
    {
        id: "medium_enterprise",
        name: "Medium Enterprise",
        description: "Turnover ₦25M-₦100M - 20% CIT rate",
        applicableTo: ["company"],
        icon: "🏢",
        fields: {},
    },
];

// ===========================================================================
// AUTO-FILL ENGINE FUNCTIONS
// ===========================================================================

/**
 * Calculates pension contribution suggestion (8% of income)
 */
function calculatePensionSuggestion(grossIncome: number): number {
    const PENSION_RATE = 0.08; // 8% employee contribution
    return Math.round(grossIncome * PENSION_RATE);
}

/**
 * Calculates NHF contribution suggestion (2.5% of basic salary)
 * Assuming basic salary is approximately 60% of gross income
 */
function calculateNHFSuggestion(grossIncome: number): number {
    const NHF_RATE = 0.025; // 2.5%
    const BASIC_SALARY_RATIO = 0.6; // Basic is typically 60% of gross
    const basicSalary = grossIncome * BASIC_SALARY_RATIO;
    return Math.round(basicSalary * NHF_RATE);
}

/**
 * Calculates suggested life insurance premium (industry benchmark: 2-5% of income)
 */
function calculateLifeInsuranceSuggestion(grossIncome: number): number {
    const LIFE_INSURANCE_RATE = 0.02; // Conservative 2%
    return Math.round(grossIncome * LIFE_INSURANCE_RATE);
}

/**
 * Estimates allowable business expenses based on industry benchmarks
 */
function estimateBusinessExpenses(grossRevenue: number, taxpayerType: string): number {
    // Industry benchmark expense ratios
    const EXPENSE_RATIOS: Record<string, number> = {
        freelancer: 0.30, // 30% for freelancers/consultants
        company: 0.60, // 60% for companies
    };

    const ratio = EXPENSE_RATIOS[taxpayerType] || 0.40;
    return Math.round(grossRevenue * ratio);
}

/**
 * Main function to generate auto-fill suggestions
 */
export function getAutoFillSuggestions(
    profile: UserProfile,
    currentInputs: TaxInputs,
    accountingData?: { revenue?: number; expenses?: number; vatPaid?: number }
): AutoFillSuggestion[] {
    const suggestions: AutoFillSuggestion[] = [];
    const grossIncome = currentInputs.grossRevenue || 0;

    // === INCOME SUGGESTIONS ===

    // If we have accounting data, suggest importing it
    if (accountingData?.revenue && accountingData.revenue > 0) {
        if (currentInputs.grossRevenue !== accountingData.revenue) {
            suggestions.push({
                field: "grossRevenue",
                suggestedValue: accountingData.revenue,
                currentValue: currentInputs.grossRevenue || 0,
                source: "accounting",
                confidence: "high",
                explanation: "Import gross revenue from Accounting Studio records",
                category: "income",
            });
        }
    }

    if (accountingData?.expenses && accountingData.expenses > 0) {
        if (currentInputs.allowableExpenses !== accountingData.expenses) {
            suggestions.push({
                field: "allowableExpenses",
                suggestedValue: accountingData.expenses,
                currentValue: currentInputs.allowableExpenses || 0,
                source: "accounting",
                confidence: "high",
                explanation: "Import recorded business expenses from Accounting Studio",
                category: "deduction",
            });
        }
    }

    // === RELIEF SUGGESTIONS (For Individuals) ===

    if (profile.taxpayerType === "freelancer" && grossIncome > 0) {
        // Pension Contribution
        const pensionSuggestion = calculatePensionSuggestion(grossIncome);
        if ((currentInputs.pensionContributions || 0) < pensionSuggestion * 0.5) {
            suggestions.push({
                field: "pensionContributions",
                suggestedValue: pensionSuggestion,
                currentValue: currentInputs.pensionContributions || 0,
                source: "policy",
                lawReference: "PENSION_ACT_2014",
                confidence: "high",
                explanation: `Suggested 8% pension contribution per Pension Reform Act 2014. This reduces your taxable income.`,
                category: "relief",
            });
        }

        // NHF Contribution
        const nhfSuggestion = calculateNHFSuggestion(grossIncome);
        if ((currentInputs.nhfContributions || 0) < nhfSuggestion * 0.5) {
            suggestions.push({
                field: "nhfContributions",
                suggestedValue: nhfSuggestion,
                currentValue: currentInputs.nhfContributions || 0,
                source: "policy",
                lawReference: "NHF_ACT",
                confidence: "medium",
                explanation: `National Housing Fund: 2.5% of basic salary is tax-deductible under PITA.`,
                category: "relief",
            });
        }

        // Life Insurance
        const lifeInsuranceSuggestion = calculateLifeInsuranceSuggestion(grossIncome);
        if ((currentInputs.lifeInsurancePremiums || 0) === 0 && lifeInsuranceSuggestion > 50000) {
            suggestions.push({
                field: "lifeInsurancePremiums",
                suggestedValue: lifeInsuranceSuggestion,
                currentValue: currentInputs.lifeInsurancePremiums || 0,
                source: "benchmark",
                lawReference: "LIFE_INSURANCE",
                confidence: "low",
                explanation: `Life insurance premiums are deductible. Benchmark suggestion based on 2% of income.`,
                category: "relief",
            });
        }
    }

    // === EXPENSE SUGGESTIONS ===

    if (grossIncome > 0 && (currentInputs.allowableExpenses || 0) === 0 && !accountingData?.expenses) {
        const expenseSuggestion = estimateBusinessExpenses(grossIncome, profile.taxpayerType);
        suggestions.push({
            field: "allowableExpenses",
            suggestedValue: expenseSuggestion,
            currentValue: 0,
            source: "benchmark",
            confidence: "low",
            explanation: `Industry benchmark: ${profile.taxpayerType === 'company' ? '60%' : '30%'} expense ratio. Enter actual expenses for accurate computation.`,
            category: "deduction",
        });
    }

    // === VAT SUGGESTIONS ===

    if (profile.isVATRegistered && accountingData?.vatPaid && accountingData.vatPaid > 0) {
        if ((currentInputs.inputVATPaid || 0) !== accountingData.vatPaid) {
            suggestions.push({
                field: "inputVATPaid",
                suggestedValue: accountingData.vatPaid,
                currentValue: currentInputs.inputVATPaid || 0,
                source: "accounting",
                lawReference: "VAT_ACT_SEC_4",
                confidence: "high",
                explanation: "Import VAT paid on purchases from Accounting Studio for input credit.",
                category: "compliance",
            });
        }
    }

    return suggestions;
}

/**
 * Apply a single suggestion to inputs
 */
export function applySuggestion(
    currentInputs: TaxInputs,
    suggestion: AutoFillSuggestion
): TaxInputs {
    return {
        ...currentInputs,
        [suggestion.field]: suggestion.suggestedValue,
    };
}

/**
 * Apply all suggestions to inputs
 */
export function applyAllSuggestions(
    currentInputs: TaxInputs,
    suggestions: AutoFillSuggestion[]
): TaxInputs {
    return suggestions.reduce(
        (inputs, suggestion) => applySuggestion(inputs, suggestion),
        currentInputs
    );
}

/**
 * Apply a quick-fill preset with calculated values
 */
export function applyQuickFillPreset(
    currentInputs: TaxInputs,
    presetId: string,
    grossIncome: number
): TaxInputs {
    const updates: Partial<TaxInputs> = {};

    switch (presetId) {
        case "salaried_employee":
            updates.pensionContributions = calculatePensionSuggestion(grossIncome);
            updates.nhfContributions = calculateNHFSuggestion(grossIncome);
            updates.lifeInsurancePremiums = calculateLifeInsuranceSuggestion(grossIncome);
            break;

        case "freelancer_consultant":
            updates.allowableExpenses = estimateBusinessExpenses(grossIncome, "freelancer");
            updates.pensionContributions = calculatePensionSuggestion(grossIncome * 0.7); // 70% of net
            break;

        case "small_business":
        case "medium_enterprise":
            updates.allowableExpenses = estimateBusinessExpenses(grossIncome, "company");
            break;
    }

    return {
        ...currentInputs,
        ...updates,
    };
}

/**
 * Get law reference details
 */
export function getLawReference(code: string): TaxLawReference | undefined {
    return NIGERIAN_TAX_LAWS[code];
}

/**
 * Get applicable presets for a taxpayer type
 */
export function getApplicablePresets(taxpayerType: 'freelancer' | 'company'): QuickFillPreset[] {
    return QUICK_FILL_PRESETS.filter(preset =>
        preset.applicableTo.includes(taxpayerType)
    );
}
