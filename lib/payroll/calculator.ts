import { calculateProgressiveTax, TaxBand } from "../taxRules/rulebook";

/**
 * NIGERIAN PAYROLL CALCULATION ENGINE
 * 
 * Implements statutory deductions for PAYE (PITA), 
 * Pension (PenCom), and NHF according to Nigerian laws (Finance Act 2020/2023).
 */

export const PENSION_EMPLOYEE_RATE = 0.08;
export const PENSION_EMPLOYER_RATE = 0.10;
export const NHF_RATE = 0.025; // 2.5% of basic salary

// PAYE Annual Tax Bands (Progressive) - Federal 2024
export const PAYE_BANDS: TaxBand[] = [
    { label: "First 300k", threshold: 300000, rate: 0.07 },
    { label: "Next 300k", threshold: 300000, rate: 0.11 },
    { label: "Next 500k", threshold: 500000, rate: 0.15 },
    { label: "Next 500k", threshold: 500000, rate: 0.19 },
    { label: "Next 1.6M", threshold: 1600000, rate: 0.21 },
    { label: "Above 3.2M", threshold: Infinity, rate: 0.24 },
];

export interface PayrollInput {
    basicSalary: number;
    housing: number;
    transport: number;
    otherAllowances: number;
}

export interface PayrollResult {
    grossIncome: number;
    pensionEmployee: number;
    pensionEmployer: number;
    nhf: number;
    cra: number; // Consolidated Relief Allowance
    taxableIncome: number;
    monthlyTax: number; // PAYE
    netSalary: number;
}

/**
 * Calculate Monthly Payroll for an employee
 * 
 * Logic follows Nigerian Personal Income Tax Act (PITA) as amended.
 */
export function calculateMonthlyPayroll(input: PayrollInput): PayrollResult {
    const { basicSalary, housing, transport, otherAllowances } = input;
    const monthlyGross = basicSalary + housing + transport + otherAllowances;
    const annualGross = monthlyGross * 12;

    // 1. Employee Pension Contribution
    // Statutory Base: Basic + Housing + Transport
    const pensionBase = basicSalary + housing + transport;
    const monthlyPensionEmployee = Math.round(pensionBase * PENSION_EMPLOYEE_RATE * 100) / 100;
    const monthlyPensionEmployer = Math.round(pensionBase * PENSION_EMPLOYER_RATE * 100) / 100;

    // 2. NHF (National Housing Fund) - 2.5% of Basic Salary
    const monthlyNHF = Math.round(basicSalary * NHF_RATE * 100) / 100;

    // 3. Consolidated Relief Allowance (CRA)
    // Formula: Higher of N200,000 or 1% of Gross, plus 20% of Gross
    const craFixed = Math.max(200000, 0.01 * annualGross);
    const annualCRA = craFixed + (0.20 * annualGross);
    const monthlyCRA = Math.round((annualCRA / 12) * 100) / 100;

    // 4. Taxable Income
    // Taxable = Gross - (Pension + NHF + CRA) - Any other tax-exempt items
    // (We treat statutory deductions as tax-exempt per PITA)
    const monthlyDeductions = monthlyPensionEmployee + monthlyNHF + monthlyCRA;
    const monthlyTaxable = Math.max(0, monthlyGross - monthlyDeductions);
    const annualTaxable = monthlyTaxable * 12;

    // 5. Apply Progressive Tax Bands (PAYE)
    // We use the helper from rulebook.ts to ensure consistency
    const { total: annualTax } = calculateProgressiveTax(annualTaxable, PAYE_BANDS);

    // Minimum Tax Rule: 1% of Gross Income if calculated tax is less
    // This applies to individuals earning > N30,000 monthly
    const annualMinTax = 0.01 * annualGross;
    const finalAnnualTax = (annualGross > 360000) ? Math.max(annualTax, annualMinTax) : annualTax;
    const monthlyTax = Math.round((finalAnnualTax / 12) * 100) / 100;

    // 6. Final Net Salary
    const netSalary = Math.round((monthlyGross - (monthlyPensionEmployee + monthlyNHF + monthlyTax)) * 100) / 100;

    return {
        grossIncome: monthlyGross,
        pensionEmployee: monthlyPensionEmployee,
        pensionEmployer: monthlyPensionEmployer,
        nhf: monthlyNHF,
        cra: monthlyCRA,
        taxableIncome: monthlyTaxable,
        monthlyTax,
        netSalary,
    };
}
