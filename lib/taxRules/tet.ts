/**
 * Tertiary Education Tax (TET) Calculator for Nigeria
 * 
 * TET Rate: 3% of assessable profits (for companies only)
 * Previously known as Education Tax
 * Legal Basis: Tertiary Education Trust Fund Act 2011
 */

export interface TETInput {
    assessableProfit: number;    // Company's assessable/taxable profit
    isCompany: boolean;          // TET only applies to companies
}

export interface TETResult {
    assessableProfit: number;
    tetRate: number;
    tetPayable: number;
    isApplicable: boolean;
    note: string;
}

// TET Rate - 3% of assessable profit
export const TET_RATE = 0.03;

/**
 * Calculate Tertiary Education Tax
 * Only applicable to companies, not individuals
 */
export function calculateTET(input: TETInput): TETResult {
    // TET only applies to companies
    if (!input.isCompany) {
        return {
            assessableProfit: input.assessableProfit,
            tetRate: TET_RATE,
            tetPayable: 0,
            isApplicable: false,
            note: 'TET is only applicable to companies, not individuals/freelancers',
        };
    }

    // Small companies with turnover <= N25m are exempt from TET under CITA 2007
    // For simplicity, we'll apply TET to all positive assessable profits
    const assessableProfit = Math.max(0, input.assessableProfit);
    const tetPayable = assessableProfit * TET_RATE;

    return {
        assessableProfit,
        tetRate: TET_RATE,
        tetPayable,
        isApplicable: true,
        note: 'Tertiary Education Tax at 3% of assessable profit',
    };
}
