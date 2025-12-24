/**
 * Other Nigerian Levies and Contributions
 * 
 * Various statutory levies applicable to businesses in Nigeria
 */

import { PayrollEntry } from "../types";

// ============================================
// NIGERIA POLICE TRUST FUND LEVY
// Finance Act 2021 - 0.005% of net profit
// ============================================

export interface PoliceLevy {
    netProfit: number;
    isCompany: boolean;
}

export interface PoliceLevyResult {
    netProfit: number;
    rate: number;
    levyPayable: number;
    isApplicable: boolean;
    note: string;
}

export const POLICE_LEVY_RATE = 0.00005;  // 0.005%

export function calculatePoliceLevy(input: PoliceLevy): PoliceLevyResult {
    if (!input.isCompany) {
        return {
            netProfit: input.netProfit,
            rate: POLICE_LEVY_RATE,
            levyPayable: 0,
            isApplicable: false,
            note: 'Police Trust Fund Levy applies only to companies',
        };
    }

    const levyPayable = Math.max(0, input.netProfit) * POLICE_LEVY_RATE;

    return {
        netProfit: input.netProfit,
        rate: POLICE_LEVY_RATE,
        levyPayable,
        isApplicable: true,
        note: 'Nigeria Police Trust Fund Levy at 0.005% of net profit',
    };
}

// ============================================
// NASENI LEVY
// National Agency for Science & Engineering Infrastructure
// 0.25% of profit before tax (for certain industries)
// ============================================

export const NASENI_INDUSTRIES = [
    'banking',
    'mobile_telecom',
    'ict',
    'aviation',
    'maritime',
    'oil_gas',
];

export interface NASENILevy {
    profitBeforeTax: number;
    industry: string;
    isCompany: boolean;
}

export interface NASENILevyResult {
    profitBeforeTax: number;
    rate: number;
    levyPayable: number;
    isApplicable: boolean;
    note: string;
}

export const NASENI_LEVY_RATE = 0.0025;  // 0.25%

export function calculateNASENILevy(input: NASENILevy): NASENILevyResult {
    if (!input.isCompany) {
        return {
            profitBeforeTax: input.profitBeforeTax,
            rate: NASENI_LEVY_RATE,
            levyPayable: 0,
            isApplicable: false,
            note: 'NASENI Levy applies only to companies',
        };
    }

    const isApplicableIndustry = NASENI_INDUSTRIES.includes(input.industry.toLowerCase());

    if (!isApplicableIndustry) {
        return {
            profitBeforeTax: input.profitBeforeTax,
            rate: NASENI_LEVY_RATE,
            levyPayable: 0,
            isApplicable: false,
            note: 'NASENI Levy only applies to specified industries (banking, telecom, ICT, aviation, maritime, oil & gas)',
        };
    }

    const levyPayable = Math.max(0, input.profitBeforeTax) * NASENI_LEVY_RATE;

    return {
        profitBeforeTax: input.profitBeforeTax,
        rate: NASENI_LEVY_RATE,
        levyPayable,
        isApplicable: true,
        note: 'NASENI Levy at 0.25% of profit before tax',
    };
}

// ============================================
// NSITF CONTRIBUTION
// Nigeria Social Insurance Trust Fund
// 1% of total monthly payroll (employer contribution)
// ============================================

export interface NSITFInput {
    monthlyPayroll: number;
    numberOfMonths: number;      // Usually 12 for annual
}

export interface NSITFResult {
    totalPayroll: number;
    rate: number;
    contributionPayable: number;
    isApplicable: boolean;
    note: string;
}

export const NSITF_RATE = 0.01;  // 1%

export function calculateNSITF(input: NSITFInput): NSITFResult {
    const totalPayroll = input.monthlyPayroll * input.numberOfMonths;
    const contributionPayable = totalPayroll * NSITF_RATE;

    return {
        totalPayroll,
        rate: NSITF_RATE,
        contributionPayable,
        isApplicable: totalPayroll > 0,
        note: 'NSITF Employer Contribution at 1% of payroll',
    };
}

// ============================================
// INDUSTRIAL TRAINING FUND (ITF) LEVY
// 1% of annual payroll for companies with 5+ employees
// or turnover of N50m+
// ============================================

export interface ITFInput {
    annualPayroll: number;
    numberOfEmployees: number;
    annualTurnover: number;
}

export interface ITFResult {
    annualPayroll: number;
    rate: number;
    levyPayable: number;
    isApplicable: boolean;
    note: string;
}

export const ITF_RATE = 0.01;  // 1%
export const ITF_EMPLOYEE_THRESHOLD = 5;
export const ITF_TURNOVER_THRESHOLD = 50000000;  // N50 million

export function calculateITF(input: ITFInput): ITFResult {
    const isApplicable = input.numberOfEmployees >= ITF_EMPLOYEE_THRESHOLD ||
        input.annualTurnover >= ITF_TURNOVER_THRESHOLD;

    if (!isApplicable) {
        return {
            annualPayroll: input.annualPayroll,
            rate: ITF_RATE,
            levyPayable: 0,
            isApplicable: false,
            note: 'ITF levy applies to companies with 5+ employees or N50m+ turnover',
        };
    }

    const levyPayable = input.annualPayroll * ITF_RATE;

    return {
        annualPayroll: input.annualPayroll,
        rate: ITF_RATE,
        levyPayable,
        isApplicable: true,
        note: 'Industrial Training Fund Levy at 1% of annual payroll',
    };
}

// ============================================
// CONSOLIDATED LEVY CALCULATION
// ============================================

export interface CompanyLeviesInput {
    netProfit: number;
    profitBeforeTax: number;
    industry: string;
    monthlyPayroll: number;
    numberOfEmployees: number;
    annualTurnover: number;
    payrollEntries?: PayrollEntry[];
}

export interface CompanyLeviesResult {
    policeLevy: PoliceLevyResult;
    naseniLevy: NASENILevyResult;
    nsitf: NSITFResult;
    itf: ITFResult;
    totalLevies: number;
}

function derivePayrollMetrics(entries?: PayrollEntry[]): { monthlyPayroll: number; employeeCount: number } | null {
    if (!entries || entries.length === 0) {
        return null;
    }

    const filtered = entries.filter((entry) =>
        entry && (entry.grossPayroll || entry.employeeCount)
    );

    if (filtered.length === 0) {
        return null;
    }

    const totalPayroll = filtered.reduce((sum, entry) => sum + Math.max(0, entry.grossPayroll || 0), 0);
    const monthlyPayroll = totalPayroll / filtered.length;
    const totalEmployees = filtered.reduce((sum, entry) => sum + Math.max(0, entry.employeeCount || 0), 0);
    const employeeCount = filtered.length > 0 ? Math.round(totalEmployees / filtered.length) : 0;

    return { monthlyPayroll, employeeCount };
}

export function calculateAllCompanyLevies(input: CompanyLeviesInput): CompanyLeviesResult {
    const policeLevy = calculatePoliceLevy({
        netProfit: input.netProfit,
        isCompany: true,
    });

    const naseniLevy = calculateNASENILevy({
        profitBeforeTax: input.profitBeforeTax,
        industry: input.industry,
        isCompany: true,
    });

    const derivedPayroll = derivePayrollMetrics(input.payrollEntries);
    const payrollForLevies = derivedPayroll?.monthlyPayroll ?? input.monthlyPayroll;
    const employeeCountForLevies = derivedPayroll?.employeeCount ?? input.numberOfEmployees;

    const nsitf = calculateNSITF({
        monthlyPayroll: payrollForLevies,
        numberOfMonths: 12,
    });

    const itf = calculateITF({
        annualPayroll: payrollForLevies * 12,
        numberOfEmployees: employeeCountForLevies,
        annualTurnover: input.annualTurnover,
    });

    const totalLevies = policeLevy.levyPayable +
        naseniLevy.levyPayable +
        nsitf.contributionPayable +
        itf.levyPayable;

    return {
        policeLevy,
        naseniLevy,
        nsitf,
        itf,
        totalLevies,
    };
}
