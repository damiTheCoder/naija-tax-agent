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
    loadRuleBook,
    evaluateFormula,
    calculateProgressiveTax,
    ReconciliationRow,
    TaxRuleBook
} from "./rulebook";

/**
 * Interface for internal state tracking during calculation
 */
interface CalculationState {
    context: Record<string, number>;
    reconciliationReport: ReconciliationRow[];
    rulebook: TaxRuleBook;
}

function recordStep(state: CalculationState, row: ReconciliationRow) {
    state.reconciliationReport.push(row);
    if (row.rule_key) {
        state.context[row.rule_key] = row.value;
    }
}

/**
 * Calculate total reliefs for PIT
 */
function calculateTotalReliefs(inputs: TaxInputs, state: CalculationState): number {
    const pension = inputs.pensionContributions || 0;
    const nhf = inputs.nhfContributions || 0;
    const lifeInsurance = inputs.lifeInsurancePremiums || 0;
    const other = inputs.otherReliefs || 0;

    if (pension > 0) recordStep(state, { step_id: "RELIEF_PENSION", label: "Pension Contributions", value: pension });
    if (nhf > 0) recordStep(state, { step_id: "RELIEF_NHF", label: "NHF Contributions", value: nhf, citation: "PITA Sec 33" });
    if (lifeInsurance > 0) recordStep(state, { step_id: "RELIEF_LIFE_INS", label: "Life Insurance Premiums", value: lifeInsurance });
    if (other > 0) recordStep(state, { step_id: "RELIEF_OTHER", label: "Other Allowable Reliefs", value: other });

    return pension + nhf + lifeInsurance + other;
}

function aggregateIncome(inputs: TaxInputs): IncomeAggregationSummary & { source: string } {
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
 * Main tax calculation function for Nigeria (V2 - Rulebook Driven)
 */
export function calculateTaxForNigeria(profile: UserProfile, inputs: TaxInputs): TaxResult {
    const notes: string[] = [];
    const bands: TaxBandBreakdown[] = [];
    const calculationTrace: CalculationTraceEntry[] = [];
    const statutoryReferences: StatutoryReference[] = [];

    // 1. Initialise Rulebook & State
    const rulebook = loadRuleBook(profile.taxYear.toString(), profile.stateOfResidence === "Lagos" ? "Lagos" : "Federal");
    const state: CalculationState = {
        context: {},
        reconciliationReport: [],
        rulebook
    };

    const incomeAggregation = aggregateIncome(inputs);
    const validationIssues = validateTaxScenario(profile, inputs, incomeAggregation);
    const grossRevenue = incomeAggregation.totalRevenue;
    const allowableExpenses = incomeAggregation.totalExpenses;

    // Record base income steps
    recordStep(state, { step_id: "GROSS_REVENUE", label: "Total Gross Revenue", value: grossRevenue });
    recordStep(state, { step_id: "ALLOWABLE_EXPENSES", label: "Allowable Business Expenses", value: allowableExpenses });

    let taxableIncome: number;
    let totalTaxDue: number;
    let taxBeforeCredits: number;

    if (profile.taxpayerType === "freelancer") {
        // PERSONAL INCOME TAX (PIT)

        // Step 1: Net Business Income
        const netBusinessIncome = Math.max(0, grossRevenue - allowableExpenses);
        recordStep(state, {
            step_id: "NET_BUSINESS_INCOME",
            label: "Net Business Income",
            value: netBusinessIncome,
            formula: "GROSS_REVENUE - ALLOWABLE_EXPENSES"
        });

        // Step 2: Calculate CRA
        const craFixed = evaluateFormula(rulebook.rules.CRA_FIXED.formula, state.context);
        const craPerc = evaluateFormula(rulebook.rules.CRA_PERCENTAGE.formula, state.context);
        const craAddPerc = evaluateFormula(rulebook.rules.CRA_ADDITIONAL.formula, state.context);

        const craBase = netBusinessIncome;
        const fixedOrOnePercent = Math.max(craFixed, netBusinessIncome * craPerc);
        const additionalRelief = netBusinessIncome * craAddPerc;
        const totalCRA = fixedOrOnePercent + additionalRelief;

        recordStep(state, {
            step_id: "CRA",
            label: "Consolidated Relief Allowance (CRA)",
            value: totalCRA,
            formula: `max(${craFixed.toLocaleString()}, 1% * ${craBase.toLocaleString()}) + 20% * ${craBase.toLocaleString()}`,
            rule_key: "CRA",
            citation: "PITA Sec 33"
        });

        // Step 3: Other Reliefs
        const otherReliefs = calculateTotalReliefs(inputs, state);
        const totalReliefs = totalCRA + otherReliefs;
        recordStep(state, {
            step_id: "TOTAL_RELIEFS",
            label: "Total Reliefs & Deductions",
            value: totalReliefs,
            formula: "CRA + SUM(Other Reliefs)"
        });

        // Step 4: Taxable Income
        taxableIncome = Math.max(0, netBusinessIncome - totalReliefs);
        recordStep(state, {
            step_id: "TAXABLE_INCOME",
            label: "Total Taxable Income",
            value: taxableIncome,
            formula: "max(0, NET_BUSINESS_INCOME - TOTAL_RELIEFS)"
        });

        // Step 5: Apply Progressive Bands
        const pitRule = rulebook.rules.PIT_BANDS_2024;
        const bandResult = calculateProgressiveTax(taxableIncome, pitRule.bands || []);

        bandResult.breakdown.forEach(row => recordStep(state, row));
        totalTaxDue = bandResult.total;

        bands.push(...bandResult.breakdown.map(r => ({
            bandLabel: r.label,
            rate: parseFloat(r.formula?.split("*")[1] || "0"),
            baseAmount: parseFloat(r.notes?.split(": ")[1] || "0"),
            taxAmount: r.value
        })));

        recordStep(state, {
            step_id: "GROSS_TAX_LIABILITY",
            label: "Gross Tax Liability (Before Min Tax)",
            value: totalTaxDue,
            formula: "SUM(PIT_BANDS)"
        });

        // Step 6: Minimum Tax Check
        const minTaxRate = evaluateFormula(rulebook.rules.MINIMUM_TAX_RATE.formula, state.context);
        const minimumTax = grossRevenue * minTaxRate;

        if (totalTaxDue < minimumTax && grossRevenue > 0) {
            recordStep(state, {
                step_id: "MINIMUM_TAX_APPLIED",
                label: "Minimum Tax Applied (1% of Gross)",
                value: minimumTax,
                formula: `GROSS_REVENUE * ${minTaxRate}`,
                citation: "PITA Sec 37"
            });
            totalTaxDue = minimumTax;
            notes.push(`Minimum tax rule applied (1% of gross revenue).`);
        }

        notes.push("Tax calculated under Personal Income Tax Act (PITA) using rulebook-driven engine.");

    } else {
        // COMPANY INCOME TAX (CIT)
        const turnover = grossRevenue;
        const taxableProfit = Math.max(0, grossRevenue - allowableExpenses);

        const smallThreshold = evaluateFormula(rulebook.rules.CIT_SMALL_THRESHOLD.formula, state.context);
        const mediumThreshold = evaluateFormula(rulebook.rules.CIT_MEDIUM_THRESHOLD.formula, state.context);
        const smallRate = evaluateFormula(rulebook.rules.CIT_SMALL_RATE.formula, state.context);
        const mediumRate = evaluateFormula(rulebook.rules.CIT_MEDIUM_RATE.formula, state.context);
        const largeRate = evaluateFormula(rulebook.rules.CIT_LARGE_RATE.formula, state.context);

        let citRate = 0;
        let label = "Exempt (Small Company)";

        if (turnover > mediumThreshold) {
            citRate = largeRate;
            label = `Large Company CIT (${(citRate * 100).toFixed(0)}%)`;
        } else if (turnover > smallThreshold) {
            citRate = mediumRate;
            label = `Medium Company CIT (${(citRate * 100).toFixed(0)}%)`;
        } else {
            citRate = smallRate;
            label = `Small Company CIT (${(citRate * 100).toFixed(0)}%)`;
        }

        totalTaxDue = taxableProfit * citRate;
        taxableIncome = taxableProfit;

        recordStep(state, {
            step_id: "CIT_PRIMARY",
            label: label,
            value: totalTaxDue,
            formula: `TAXABLE_PROFIT * ${citRate}`,
            citation: "CITA Section 9"
        });

        // Minimum Tax Check for Companies (FA 2023: 0.5% of turnover)
        const citMinTaxRate = evaluateFormula(rulebook.rules.CIT_MIN_TAX_RATE.formula, state.context);
        const citMinTax = turnover * citMinTaxRate;

        if (totalTaxDue < citMinTax && turnover > smallThreshold) {
            recordStep(state, {
                step_id: "CIT_MIN_TAX_APPLIED",
                label: `CIT Minimum Tax Applied (${(citMinTaxRate * 100).toFixed(1)}% of Turnover)`,
                value: citMinTax,
                formula: `TURNOVER * ${citMinTaxRate}`,
                citation: "CITA Sec 33 (as amended)"
            });
            totalTaxDue = citMinTax;
            notes.push(`Minimum tax rule applied for company (${(citMinTaxRate * 100).toFixed(1)}% of turnover).`);
        }

        bands.push({
            bandLabel: label,
            rate: citRate,
            baseAmount: taxableProfit,
            taxAmount: totalTaxDue
        });

        notes.push("Tax calculated under Companies Income Tax Act (CITA)");
    }

    taxBeforeCredits = totalTaxDue;

    // Withholding Tax Credits
    const withholdingCredits = Math.max(0, inputs.withholdingTaxCredits || 0);
    const taxCreditsApplied = Math.min(taxBeforeCredits, withholdingCredits);

    if (taxCreditsApplied > 0) {
        recordStep(state, {
            step_id: "WHT_CREDIT_APPLIED",
            label: "WHT Credits Applied",
            value: taxCreditsApplied,
            formula: "min(TAX_DUE, WHT_CREDITS)"
        });
        totalTaxDue = Math.max(0, taxBeforeCredits - taxCreditsApplied);
    }

    // VAT (Optional)
    let vat: VATSummary | undefined;
    if (profile.isVATRegistered) {
        const vatRate = evaluateFormula(rulebook.rules.VAT_RATE.formula, state.context);
        const outputVAT = grossRevenue * vatRate;
        const inputVAT = inputs.inputVATPaid || 0;
        vat = {
            vatRate,
            outputVAT,
            inputVAT,
            netVATPayable: outputVAT - inputVAT
        };
        recordStep(state, {
            step_id: "VAT_NET_PAYABLE",
            label: "VAT Net Payable",
            value: vat.netVATPayable,
            formula: "OUTPUT_VAT - INPUT_VAT",
            citation: "VAT Act Section 4"
        });
    }

    // Add citations to statutoryReferences
    (rulebook.citations || []).forEach(cit => {
        statutoryReferences.push({
            title: cit.law,
            citation: cit.section,
            description: cit.text
        });
    });

    const effectiveRate = taxableIncome > 0 ? totalTaxDue / taxableIncome : 0;

    // Add disclaimer
    notes.push("Auditable computation generated via CashOS Tax Engine V2.");

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
        calculationTrace: state.reconciliationReport.map(r => ({
            step: r.step_id,
            detail: r.label,
            amount: r.value
        })),
        taxRuleMetadata: {
            version: rulebook.metadata.version,
            source: rulebook.metadata.legal_reference || "Rulebook"
        },
        reconciliationReport: state.reconciliationReport
    };
}
