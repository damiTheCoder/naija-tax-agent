/**
 * Nigerian Tax Calculator
 * 
 * Pure function for calculating Nigerian taxes for freelancers and companies.
 * All rates and thresholds are imported from config.ts for easy maintenance.
 */

import { UserProfile, TaxInputs, TaxResult, TaxBandBreakdown, VATSummary } from "../types";
import {
    PIT_BANDS,
    CRA_FIXED_AMOUNT,
    CRA_PERCENTAGE_OF_GROSS,
    CRA_ADDITIONAL_PERCENTAGE,
    CIT_CONFIG,
    VAT_RATE,
    MINIMUM_TAX_RATE,
} from "./config";

/**
 * Calculate Consolidated Relief Allowance (CRA) for individuals
 * CRA = Higher of (₦200,000 OR 1% of gross income) + 20% of gross income
 */
function calculateCRA(grossIncome: number): number {
    const fixedOrPercentage = Math.max(CRA_FIXED_AMOUNT, grossIncome * CRA_PERCENTAGE_OF_GROSS);
    const additional = grossIncome * CRA_ADDITIONAL_PERCENTAGE;
    return fixedOrPercentage + additional;
}

/**
 * Calculate total reliefs from pension, NHF, life insurance, and other deductions
 */
function calculateTotalReliefs(inputs: TaxInputs): number {
    return (
        (inputs.pensionContributions || 0) +
        (inputs.nhfContributions || 0) +
        (inputs.lifeInsurancePremiums || 0) +
        (inputs.otherReliefs || 0)
    );
}

/**
 * Apply progressive PIT bands to taxable income
 * Returns array of band breakdowns showing tax at each level
 */
function applyPITBands(taxableIncome: number): TaxBandBreakdown[] {
    const bands: TaxBandBreakdown[] = [];
    let remainingIncome = taxableIncome;
    let previousLimit = 0;

    for (const band of PIT_BANDS) {
        if (remainingIncome <= 0) break;

        const bandWidth = band.upperLimit === Infinity
            ? remainingIncome
            : band.upperLimit - previousLimit;

        const incomeInBand = Math.min(remainingIncome, bandWidth);
        const taxInBand = incomeInBand * band.rate;

        if (incomeInBand > 0) {
            bands.push({
                bandLabel: band.label,
                rate: band.rate,
                baseAmount: incomeInBand,
                taxAmount: taxInBand,
            });
        }

        remainingIncome -= incomeInBand;
        previousLimit = band.upperLimit;
    }

    return bands;
}

/**
 * Calculate CIT for companies based on turnover thresholds
 */
function calculateCIT(taxableProfit: number, turnover: number): { rate: number; tax: number; label: string } {
    if (turnover <= CIT_CONFIG.smallCompanyThreshold) {
        return {
            rate: CIT_CONFIG.smallCompanyRate,
            tax: 0,
            label: `Small Company (Turnover ≤ ₦${(CIT_CONFIG.smallCompanyThreshold / 1000000).toFixed(0)}M)`,
        };
    } else if (turnover <= CIT_CONFIG.mediumCompanyThreshold) {
        return {
            rate: CIT_CONFIG.mediumCompanyRate,
            tax: taxableProfit * CIT_CONFIG.mediumCompanyRate,
            label: `Medium Company (Turnover ≤ ₦${(CIT_CONFIG.mediumCompanyThreshold / 1000000).toFixed(0)}M)`,
        };
    } else {
        return {
            rate: CIT_CONFIG.largeCompanyRate,
            tax: taxableProfit * CIT_CONFIG.largeCompanyRate,
            label: `Large Company (Turnover > ₦${(CIT_CONFIG.mediumCompanyThreshold / 1000000).toFixed(0)}M)`,
        };
    }
}

/**
 * Calculate VAT if registered
 * For V1, we assume all revenue is vatable
 */
function calculateVAT(grossRevenue: number, isVATRegistered: boolean): VATSummary | undefined {
    if (!isVATRegistered) return undefined;

    const outputVAT = grossRevenue * VAT_RATE;

    return {
        vatRate: VAT_RATE,
        outputVAT,
        netVATPayable: outputVAT, // For V1, no input VAT deduction
    };
}

/**
 * Main tax calculation function for Nigeria
 * Handles both freelancers (PIT) and companies (CIT)
 */
export function calculateTaxForNigeria(profile: UserProfile, inputs: TaxInputs): TaxResult {
    const notes: string[] = [];
    const bands: TaxBandBreakdown[] = [];
    let taxableIncome: number;
    let totalTaxDue: number;

    if (profile.taxpayerType === "freelancer") {
        // PERSONAL INCOME TAX (PIT) for Freelancers

        // Step 1: Calculate gross income less allowable expenses
        const grossAfterExpenses = Math.max(0, inputs.grossRevenue - inputs.allowableExpenses);

        // Step 2: Calculate CRA (Consolidated Relief Allowance)
        const cra = calculateCRA(inputs.grossRevenue);
        notes.push(`Consolidated Relief Allowance (CRA): ₦${cra.toLocaleString()}`);

        // Step 3: Calculate other reliefs
        const otherReliefs = calculateTotalReliefs(inputs);
        if (otherReliefs > 0) {
            notes.push(`Other Reliefs (Pension, NHF, Insurance, etc.): ₦${otherReliefs.toLocaleString()}`);
        }

        // Step 4: Calculate taxable income
        taxableIncome = Math.max(0, grossAfterExpenses - cra - otherReliefs);

        // Step 5: Apply progressive PIT bands
        const pitBands = applyPITBands(taxableIncome);
        bands.push(...pitBands);

        // Step 6: Sum up total tax
        totalTaxDue = bands.reduce((sum, band) => sum + band.taxAmount, 0);

        // Step 7: Check minimum tax
        const minimumTax = inputs.grossRevenue * MINIMUM_TAX_RATE;
        if (totalTaxDue < minimumTax && inputs.grossRevenue > 0) {
            notes.push(`Minimum tax rule applied: 1% of gross income = ₦${minimumTax.toLocaleString()}`);
            totalTaxDue = minimumTax;
        }

        notes.push("Tax calculated under Personal Income Tax Act (PITA)");

    } else {
        // COMPANY INCOME TAX (CIT) for Companies/SMEs

        // Step 1: Calculate taxable profit
        const turnover = inputs.turnover || inputs.grossRevenue;
        const costOfSales = inputs.costOfSales || 0;
        const operatingExpenses = inputs.operatingExpenses || inputs.allowableExpenses;
        const capitalAllowance = inputs.capitalAllowance || 0;

        const grossProfit = turnover - costOfSales;
        taxableIncome = Math.max(0, grossProfit - operatingExpenses - capitalAllowance);

        notes.push(`Turnover: ₦${turnover.toLocaleString()}`);
        notes.push(`Gross Profit: ₦${grossProfit.toLocaleString()}`);

        // Step 2: Apply CIT based on turnover threshold
        const citResult = calculateCIT(taxableIncome, turnover);

        bands.push({
            bandLabel: citResult.label,
            rate: citResult.rate,
            baseAmount: taxableIncome,
            taxAmount: citResult.tax,
        });

        totalTaxDue = citResult.tax;

        notes.push("Tax calculated under Companies Income Tax Act (CITA)");
    }

    // Calculate VAT if registered
    const vat = calculateVAT(inputs.grossRevenue, profile.isVATRegistered);
    if (vat) {
        notes.push(`VAT @ ${(vat.vatRate * 100).toFixed(1)}% on gross revenue`);
    }

    // Calculate effective rate
    const effectiveRate = taxableIncome > 0 ? totalTaxDue / taxableIncome : 0;

    // Add standard disclaimer note
    notes.push("These calculations are estimates based on simplified rules.");
    notes.push("Please verify with FIRS/SBIRS or a qualified tax professional.");

    return {
        taxpayerType: profile.taxpayerType,
        taxYear: profile.taxYear,
        taxableIncome,
        totalTaxDue,
        effectiveRate,
        bands,
        vat,
        notes,
    };
}
