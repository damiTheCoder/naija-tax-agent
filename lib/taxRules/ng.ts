/**
 * Nigerian Tax Calculator
 * 
 * Pure function for calculating Nigerian taxes for freelancers and companies.
 * All rates and thresholds are imported from config.ts for easy maintenance.
 */

import {
    UserProfile,
    TaxInputs,
    TaxResult,
    TaxBandBreakdown,
    VATSummary,
    CalculationTraceEntry,
    StatutoryReference,
} from "../types";
import { validateTaxScenario, IncomeAggregationSummary } from "./validators";
import {
    getPitBands,
    getCRAParameters,
    getCITConfig,
    getVATRate,
    getMinimumTaxRate,
    getTaxRuleMetadata,
} from "./liveRates";

/**
 * Calculate Consolidated Relief Allowance (CRA) for individuals
 * CRA = Higher of (₦200,000 OR 1% of gross income) + 20% of gross income
 */
interface CRAParams {
    fixedAmount: number;
    percentageOfGross: number;
    additionalPercentage: number;
}

function calculateCRA(grossIncome: number, craParams: CRAParams): number {
    const fixedOrPercentage = Math.max(craParams.fixedAmount, grossIncome * craParams.percentageOfGross);
    const additional = grossIncome * craParams.additionalPercentage;
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

interface IncomeAggregation extends IncomeAggregationSummary {
    source: "entries" | "direct";
}

function aggregateIncome(inputs: TaxInputs): IncomeAggregation {
    const entries = (inputs.incomeEntries || []).filter(entry =>
        !Number.isNaN(entry.revenue) || !Number.isNaN(entry.expenses)
    );

    if (entries.length > 0) {
        const totalRevenue = entries.reduce((sum, entry) => sum + (entry.revenue || 0), 0);
        const totalExpenses = entries.reduce((sum, entry) => sum + (entry.expenses || 0), 0);
        return {
            totalRevenue,
            totalExpenses,
            entryCount: entries.length,
            source: "entries",
        };
    }

    return {
        totalRevenue: inputs.grossRevenue || 0,
        totalExpenses: inputs.allowableExpenses || 0,
        entryCount: 0,
        source: "direct",
    };
}

/**
 * Apply progressive PIT bands to taxable income
 * Returns array of band breakdowns showing tax at each level
 */
function applyPITBands(taxableIncome: number, pitBands: ReturnType<typeof getPitBands>): TaxBandBreakdown[] {
    const bands: TaxBandBreakdown[] = [];
    let remainingIncome = taxableIncome;
    let previousLimit = 0;

    for (const band of pitBands) {
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
function calculateCIT(
    taxableProfit: number,
    turnover: number,
    config = getCITConfig()
): { rate: number; tax: number; label: string } {
    if (turnover <= config.smallCompanyThreshold) {
        return {
            rate: config.smallCompanyRate,
            tax: 0,
            label: `Small Company (Turnover ≤ ₦${(config.smallCompanyThreshold / 1000000).toFixed(0)}M)`,
        };
    } else if (turnover <= config.mediumCompanyThreshold) {
        return {
            rate: config.mediumCompanyRate,
            tax: taxableProfit * config.mediumCompanyRate,
            label: `Medium Company (Turnover ≤ ₦${(config.mediumCompanyThreshold / 1000000).toFixed(0)}M)`,
        };
    } else {
        return {
            rate: config.largeCompanyRate,
            tax: taxableProfit * config.largeCompanyRate,
            label: `Large Company (Turnover > ₦${(config.mediumCompanyThreshold / 1000000).toFixed(0)}M)`,
        };
    }
}

/**
 * Calculate VAT if registered
 * For V1, we assume all revenue is vatable
 */
function calculateVAT(inputs: TaxInputs, grossRevenue: number, isVATRegistered: boolean, vatRate: number): VATSummary | undefined {
    if (!isVATRegistered) return undefined;

    const outputVAT = grossRevenue * vatRate;
    const computedInputVAT = (inputs.vatTaxablePurchases || 0) * vatRate;
    const inputVAT = typeof inputs.inputVATPaid === "number"
        ? inputs.inputVATPaid
        : computedInputVAT;
    const netVATPayable = outputVAT - inputVAT;

    return {
        vatRate,
        outputVAT,
        inputVAT,
        netVATPayable,
    };
}

/**
 * Main tax calculation function for Nigeria
 * Handles both freelancers (PIT) and companies (CIT)
 */
export function calculateTaxForNigeria(profile: UserProfile, inputs: TaxInputs): TaxResult {
    const notes: string[] = [];
    const bands: TaxBandBreakdown[] = [];
    const calculationTrace: CalculationTraceEntry[] = [];
    const statutoryReferences: StatutoryReference[] = [];
    let taxableIncome: number;
    let totalTaxDue: number;
    let taxBeforeCredits: number;

    const pitBandsConfig = getPitBands();
    const craParams = getCRAParameters();
    const vatRate = getVATRate();
    const minimumTaxRate = getMinimumTaxRate();
    const taxRuleMetadata = getTaxRuleMetadata();

    const incomeAggregation = aggregateIncome(inputs);
    const validationIssues = validateTaxScenario(profile, inputs, incomeAggregation);
    const grossRevenue = incomeAggregation.totalRevenue;
    const allowableExpenses = incomeAggregation.totalExpenses;

    if (incomeAggregation.source === "entries") {
        notes.push(`Using ${incomeAggregation.entryCount} detailed income entries to derive totals.`);
        calculationTrace.push({
            step: "income-aggregation",
            detail: `Summed income entries to ₦${grossRevenue.toLocaleString()} revenue and ₦${allowableExpenses.toLocaleString()} expenses`,
        });
    }

    if (profile.taxpayerType === "freelancer") {
        // PERSONAL INCOME TAX (PIT) for Freelancers

        // Step 1: Calculate gross income less allowable expenses
        const grossAfterExpenses = Math.max(0, grossRevenue - allowableExpenses);
        calculationTrace.push({
            step: "pit-base",
            detail: "Gross income after deductible expenses",
            amount: grossAfterExpenses,
        });

        // Step 2: Calculate CRA (Consolidated Relief Allowance)
        const cra = calculateCRA(grossRevenue, craParams);
        notes.push(`Consolidated Relief Allowance (CRA): ₦${cra.toLocaleString()}`);
        calculationTrace.push({ step: "cra", detail: "Consolidated Relief Allowance", amount: cra });
        statutoryReferences.push({
            title: "Personal Income Tax Act",
            citation: "Sections 33 & 34",
            description: "CRA and progressive PIT bands applied for individual taxpayers.",
        });

        // Step 3: Calculate other reliefs
        const otherReliefs = calculateTotalReliefs(inputs);
        if (otherReliefs > 0) {
            notes.push(`Other Reliefs (Pension, NHF, Insurance, etc.): ₦${otherReliefs.toLocaleString()}`);
        }
        calculationTrace.push({ step: "other-reliefs", detail: "Other reliefs (pension/NHF/etc)", amount: otherReliefs });

        // Step 4: Calculate taxable income
        taxableIncome = Math.max(0, grossAfterExpenses - cra - otherReliefs);
        calculationTrace.push({ step: "taxable-income", detail: "Taxable income after reliefs", amount: taxableIncome });

        // Step 5: Apply progressive PIT bands
        const pitBands = applyPITBands(taxableIncome, pitBandsConfig);
        bands.push(...pitBands);

        // Step 6: Sum up total tax
        totalTaxDue = bands.reduce((sum, band) => sum + band.taxAmount, 0);
        calculationTrace.push({ step: "pit-bands", detail: "Total PIT from progressive bands", amount: totalTaxDue });

        // Step 7: Check minimum tax
        const minimumTax = grossRevenue * minimumTaxRate;
        if (totalTaxDue < minimumTax && grossRevenue > 0) {
            notes.push(`Minimum tax rule applied: 1% of gross income = ₦${minimumTax.toLocaleString()}`);
            totalTaxDue = minimumTax;
            calculationTrace.push({ step: "minimum-tax", detail: "Applied minimum tax (1% of gross)", amount: minimumTax });
        }

        notes.push("Tax calculated under Personal Income Tax Act (PITA)");

    } else {
        // COMPANY INCOME TAX (CIT) for Companies/SMEs

        // Step 1: Calculate taxable profit
        const turnover = inputs.turnover || grossRevenue;
        const costOfSales = inputs.costOfSales || 0;
        const operatingExpenses = inputs.operatingExpenses || allowableExpenses;
        const capitalAllowance = inputs.capitalAllowance || 0;
        const investmentAllowance = inputs.investmentAllowance || 0;
        const ruralInvestmentAllowance = inputs.ruralInvestmentAllowance || 0;
        const pioneerRelief = inputs.pioneerStatusRelief || 0;
        const priorYearLosses = inputs.priorYearLosses || 0;

        const grossProfit = turnover - costOfSales;
        taxableIncome = Math.max(0, grossProfit - operatingExpenses - capitalAllowance - investmentAllowance - ruralInvestmentAllowance - pioneerRelief - priorYearLosses);

        notes.push(`Turnover: ₦${turnover.toLocaleString()}`);
        notes.push(`Gross Profit: ₦${grossProfit.toLocaleString()}`);
        if (priorYearLosses > 0) {
            notes.push(`Carried-forward losses utilised: ₦${priorYearLosses.toLocaleString()}`);
        }

        // Step 2: Apply CIT based on turnover threshold
        const citResult = calculateCIT(taxableIncome, turnover);

        bands.push({
            bandLabel: citResult.label,
            rate: citResult.rate,
            baseAmount: taxableIncome,
            taxAmount: citResult.tax,
        });

        totalTaxDue = citResult.tax;
        calculationTrace.push({ step: "cit", detail: citResult.label, amount: totalTaxDue });

        notes.push("Tax calculated under Companies Income Tax Act (CITA)");
        statutoryReferences.push({
            title: "Companies Income Tax Act",
            citation: "Section 9 & Finance Act 2020",
            description: "CIT thresholds for small, medium, and large companies applied to taxable profit.",
        });
    }

    taxBeforeCredits = totalTaxDue;

    const withholdingCredits = Math.max(0, inputs.withholdingTaxCredits || 0);
    let taxCreditsApplied = Math.min(taxBeforeCredits, withholdingCredits);
    if (taxCreditsApplied > 0) {
        notes.push(`Withholding tax credits applied: ₦${taxCreditsApplied.toLocaleString()}`);
        calculationTrace.push({ step: "wht-credit", detail: "Offset tax with WHT credits", amount: taxCreditsApplied });
    }
    totalTaxDue = Math.max(0, taxBeforeCredits - taxCreditsApplied);

    // Calculate VAT if registered
    const vat = calculateVAT(inputs, grossRevenue, profile.isVATRegistered, vatRate);
    if (vat) {
        notes.push(`VAT @ ${(vat.vatRate * 100).toFixed(1)}% on recorded turnover`);
        calculationTrace.push({ step: "vat", detail: "VAT summary", amount: vat.netVATPayable });
        statutoryReferences.push({
            title: "Value Added Tax Act",
            citation: "Section 4",
            description: "VAT calculated at 7.5% with input VAT deduction where supplied.",
        });
    }

    // Calculate effective rate
    const effectiveRate = taxableIncome > 0 ? totalTaxDue / taxableIncome : 0;

    // Add standard disclaimer note
    notes.push("These calculations are estimates based on simplified rules.");
    notes.push("Please verify with FIRS/SBIRS or a qualified tax professional.");
    notes.push(`Tax rule set: ${taxRuleMetadata.version} (${taxRuleMetadata.source})`);

    return {
        taxpayerType: profile.taxpayerType,
        taxYear: profile.taxYear,
        taxableIncome,
        totalTaxDue,
        effectiveRate,
        bands,
        vat,
        notes,
        taxBeforeCredits,
        taxCreditsApplied,
        validationIssues,
        statutoryReferences,
        calculationTrace,
        taxRuleMetadata,
    };
}
