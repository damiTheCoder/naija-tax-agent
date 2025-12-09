/**
 * Tax Optimizer - Nigerian Tax Saving Suggestions
 * 
 * Analyzes user inputs and provides personalized suggestions
 * to legally minimize tax liability.
 */

import {
    UserProfile,
    TaxInputs,
    TaxResult,
    TaxOptimizationSuggestion,
    TaxOptimizationResult,
} from "./types";
import { CRA_ADDITIONAL_PERCENTAGE } from "./taxRules/config";

// Maximum pension contribution as percentage of gross (tax-deductible)
const MAX_PENSION_RATE = 0.18; // 18% of gross income

// NHF contribution rate
const NHF_RATE = 0.025; // 2.5% of basic salary

// Life insurance relief limit (as percentage of gross)
const LIFE_INSURANCE_MAX_RATE = 0.10; // 10% of gross

/**
 * Generate tax optimization suggestions based on user profile and inputs
 */
export function generateOptimizations(
    profile: UserProfile,
    inputs: TaxInputs,
    result: TaxResult
): TaxOptimizationResult {
    const suggestions: TaxOptimizationSuggestion[] = [];
    let totalPotentialSavings = 0;

    if (profile.taxpayerType === "freelancer") {
        // Pension optimization
        const currentPension = inputs.pensionContributions || 0;
        const maxPension = inputs.grossRevenue * MAX_PENSION_RATE;

        if (currentPension < maxPension * 0.5) {
            const additionalPension = maxPension - currentPension;
            // Estimate savings based on effective rate (rough approximation)
            const estimatedSavings = additionalPension * (result.effectiveRate || 0.15);

            suggestions.push({
                type: "pension",
                title: "Maximize Pension Contributions",
                description: `You can contribute up to ₦${maxPension.toLocaleString()} annually to a PFA (18% of gross income). Additional contributions of ₦${additionalPension.toLocaleString()} could reduce your taxable income.`,
                potentialSavings: Math.round(estimatedSavings),
                priority: additionalPension > 500000 ? "high" : "medium",
                applicableTo: ["freelancer"],
            });
            totalPotentialSavings += Math.round(estimatedSavings);
        }

        // NHF optimization
        const currentNHF = inputs.nhfContributions || 0;
        const estimatedBasic = inputs.grossRevenue * 0.4; // Estimate basic as 40% of gross
        const maxNHF = estimatedBasic * NHF_RATE;

        if (currentNHF === 0 && maxNHF > 10000) {
            const estimatedSavings = maxNHF * (result.effectiveRate || 0.15);

            suggestions.push({
                type: "nhf",
                title: "Consider NHF Contributions",
                description: `National Housing Fund contributions (2.5% of basic salary) are tax-deductible. Estimated contribution of ₦${maxNHF.toLocaleString()} could provide tax relief.`,
                potentialSavings: Math.round(estimatedSavings),
                priority: "medium",
                applicableTo: ["freelancer"],
            });
            totalPotentialSavings += Math.round(estimatedSavings);
        }

        // Life insurance optimization
        const currentInsurance = inputs.lifeInsurancePremiums || 0;
        const maxInsurance = inputs.grossRevenue * LIFE_INSURANCE_MAX_RATE;

        if (currentInsurance === 0 && maxInsurance > 50000) {
            const estimatedSavings = maxInsurance * 0.5 * (result.effectiveRate || 0.15);

            suggestions.push({
                type: "life_insurance",
                title: "Life Insurance Premium Deduction",
                description: `Life insurance premiums are tax-deductible. Consider a policy with annual premiums to reduce your taxable income while getting life coverage.`,
                potentialSavings: Math.round(estimatedSavings),
                priority: "low",
                applicableTo: ["freelancer"],
            });
            totalPotentialSavings += Math.round(estimatedSavings);
        }

        // VAT registration suggestion for high-earners
        if (!profile.isVATRegistered && inputs.grossRevenue > 25000000) {
            suggestions.push({
                type: "vat_registration",
                title: "Consider VAT Registration",
                description: `With revenue above ₦25 million, VAT registration may be mandatory. Registering allows you to claim input VAT on business purchases, potentially reducing your net VAT liability.`,
                priority: "high",
                applicableTo: ["freelancer", "company"],
            });
        }

        // Expense documentation
        const expenseRatio = inputs.allowableExpenses / inputs.grossRevenue;
        if (expenseRatio < 0.2 && inputs.grossRevenue > 1000000) {
            const potentialExpenses = inputs.grossRevenue * 0.3 - inputs.allowableExpenses;
            const estimatedSavings = potentialExpenses * (result.effectiveRate || 0.15);

            suggestions.push({
                type: "expense_documentation",
                title: "Document Business Expenses",
                description: `Your claimed expenses are ${(expenseRatio * 100).toFixed(1)}% of revenue. Ensure you're documenting all legitimate business expenses (office supplies, internet, phone, travel, professional fees, etc.) to maximize deductions.`,
                potentialSavings: Math.round(estimatedSavings),
                priority: "high",
                applicableTo: ["freelancer", "company"],
            });
            totalPotentialSavings += Math.round(estimatedSavings);
        }
    }

    if (profile.taxpayerType === "company") {
        // Capital allowance optimization
        const currentCapitalAllowance = inputs.capitalAllowance || 0;
        const turnover = inputs.turnover || inputs.grossRevenue;

        if (currentCapitalAllowance === 0 && turnover > 25000000) {
            suggestions.push({
                type: "capital_allowance",
                title: "Claim Capital Allowances",
                description: `If you've purchased qualifying assets (machinery, equipment, vehicles, furniture), you can claim capital allowances to reduce taxable profit. Ensure all asset purchases are properly documented.`,
                priority: "high",
                applicableTo: ["company"],
            });
        }

        // Company structure suggestion for high-earning freelancers
        if (profile.taxpayerType === "company" && turnover < 25000000) {
            suggestions.push({
                type: "company_structure",
                title: "Small Company Tax Advantage",
                description: `Your company qualifies for 0% CIT rate as a small company (turnover ≤ ₦25M). Ensure you maintain accurate records to continue benefiting from this exemption.`,
                priority: "medium",
                applicableTo: ["company"],
            });
        }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return {
        suggestions,
        totalPotentialSavings,
    };
}
