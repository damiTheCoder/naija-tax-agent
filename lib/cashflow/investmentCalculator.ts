/**
 * Nigerian Investment Calculator
 * Calculates returns for T-Bills and Savings accounts based on current Nigerian rates
 */

// =============================================================================
// NIGERIAN INVESTMENT RATES (2024/2025)
// =============================================================================

export interface TBillsTenor {
    id: '91-day' | '182-day' | '364-day';
    name: string;
    days: number;
    rate: number; // Annual percentage rate
}

export const TBILLS_RATES: TBillsTenor[] = [
    { id: '91-day', name: '91-Day T-Bills', days: 91, rate: 17.00 },
    { id: '182-day', name: '182-Day T-Bills', days: 182, rate: 17.50 },
    { id: '364-day', name: '364-Day T-Bills', days: 364, rate: 20.65 },
];

export const SAVINGS_RATE = 8.00; // Nigerian bank average (30% of MPR ~27.25%)

// =============================================================================
// INVESTMENT SCENARIO TYPES
// =============================================================================

export interface InvestmentScenario {
    id: string;
    name: string;
    productType: 'tbills' | 'savings';
    tenor?: TBillsTenor['id'];
    percentOfInflow: number;
    monthlyInvestment: number;
    annualRate: number;
    projectedReturn12Months: number;
    projectedValue12Months: number;
}

export interface CashflowAnalytics {
    // Core metrics from cashflow statement
    cashBalance: number;
    monthlyInflow: number;
    monthlyOutflow: number;
    netCashflow: number;

    // Calculated metrics
    burnRate: number;         // Daily expense rate
    runwayDays: number;       // Days of cash remaining at current burn
    runwayMonths: number;     // Months of cash remaining
    healthStatus: 'critical' | 'low' | 'moderate' | 'healthy' | 'strong';

    // Period
    periodStart: string;
    periodEnd: string;
}

// =============================================================================
// T-BILLS CALCULATOR
// =============================================================================

/**
 * Calculate T-Bills discount and maturity value
 * Nigerian T-Bills are issued at a discount and mature at face value
 * 
 * @param investmentAmount - Amount to invest (purchase price)
 * @param tenor - T-Bills tenor (91, 182, or 364 days)
 * @returns Maturity value and effective return
 */
export function calculateTBillsReturn(
    investmentAmount: number,
    tenorId: TBillsTenor['id']
): {
    investmentAmount: number;
    maturityValue: number;
    interestEarned: number;
    effectiveRate: number;
    tenorDays: number;
} {
    const tenor = TBILLS_RATES.find(t => t.id === tenorId);
    if (!tenor) {
        throw new Error(`Invalid tenor: ${tenorId}`);
    }

    // T-Bills formula: Interest = Principal × Rate × (Days/365)
    const interestEarned = investmentAmount * (tenor.rate / 100) * (tenor.days / 365);
    const maturityValue = investmentAmount + interestEarned;
    const effectiveRate = (interestEarned / investmentAmount) * 100;

    return {
        investmentAmount,
        maturityValue: Math.round(maturityValue * 100) / 100,
        interestEarned: Math.round(interestEarned * 100) / 100,
        effectiveRate: Math.round(effectiveRate * 100) / 100,
        tenorDays: tenor.days,
    };
}

/**
 * Calculate annual T-Bills return with rolling investments
 * Assumes reinvestment at each maturity
 */
export function calculateTBillsAnnualReturn(
    monthlyInvestment: number,
    tenorId: TBillsTenor['id']
): {
    totalInvested: number;
    projectedValue: number;
    totalReturn: number;
    effectiveAnnualRate: number;
} {
    const tenor = TBILLS_RATES.find(t => t.id === tenorId);
    if (!tenor) {
        throw new Error(`Invalid tenor: ${tenorId}`);
    }

    // Calculate how many full cycles fit in 12 months
    const cyclesPerYear = Math.floor(365 / tenor.days);
    const totalInvested = monthlyInvestment * 12;

    // Simplified: assume monthly contributions earn pro-rated returns
    // Average investment period = 6 months (midpoint of contributions)
    const averageInvestmentPeriod = 182; // 6 months in days
    const projectedReturn = totalInvested * (tenor.rate / 100) * (averageInvestmentPeriod / 365);
    const projectedValue = totalInvested + projectedReturn;
    const effectiveAnnualRate = (projectedReturn / totalInvested) * 100;

    return {
        totalInvested,
        projectedValue: Math.round(projectedValue),
        totalReturn: Math.round(projectedReturn),
        effectiveAnnualRate: Math.round(effectiveAnnualRate * 100) / 100,
    };
}

// =============================================================================
// SAVINGS CALCULATOR
// =============================================================================

/**
 * Calculate savings account return over a period
 */
export function calculateSavingsReturn(
    monthlyDeposit: number,
    months: number = 12,
    annualRate: number = SAVINGS_RATE
): {
    totalDeposited: number;
    interestEarned: number;
    finalBalance: number;
    effectiveRate: number;
} {
    let balance = 0;
    let totalInterest = 0;
    const monthlyRate = annualRate / 100 / 12;

    for (let m = 0; m < months; m++) {
        balance += monthlyDeposit;
        const monthlyInterest = balance * monthlyRate;
        totalInterest += monthlyInterest;
        balance += monthlyInterest;
    }

    const totalDeposited = monthlyDeposit * months;
    const effectiveRate = (totalInterest / totalDeposited) * 100;

    return {
        totalDeposited,
        interestEarned: Math.round(totalInterest),
        finalBalance: Math.round(balance),
        effectiveRate: Math.round(effectiveRate * 100) / 100,
    };
}

// =============================================================================
// WHAT-IF SCENARIO MODELLING
// =============================================================================

/**
 * Model "What if I invest X% of my monthly inflow"
 */
export function modelInflowInvestment(
    monthlyInflow: number,
    percentToInvest: number,
    productType: 'tbills' | 'savings',
    tenorId?: TBillsTenor['id']
): InvestmentScenario {
    const monthlyInvestment = (monthlyInflow * percentToInvest) / 100;

    let projectedReturn12Months = 0;
    let projectedValue12Months = 0;
    let annualRate = 0;

    if (productType === 'tbills' && tenorId) {
        const result = calculateTBillsAnnualReturn(monthlyInvestment, tenorId);
        projectedReturn12Months = result.totalReturn;
        projectedValue12Months = result.projectedValue;
        annualRate = TBILLS_RATES.find(t => t.id === tenorId)?.rate || 0;
    } else {
        const result = calculateSavingsReturn(monthlyInvestment, 12);
        projectedReturn12Months = result.interestEarned;
        projectedValue12Months = result.finalBalance;
        annualRate = SAVINGS_RATE;
    }

    return {
        id: `${productType}-${percentToInvest}`,
        name: productType === 'tbills'
            ? `${percentToInvest}% in ${tenorId} T-Bills`
            : `${percentToInvest}% in Savings`,
        productType,
        tenor: tenorId,
        percentOfInflow: percentToInvest,
        monthlyInvestment: Math.round(monthlyInvestment),
        annualRate,
        projectedReturn12Months,
        projectedValue12Months,
    };
}

/**
 * Generate multiple scenarios for comparison
 */
export function generateScenarioComparison(
    monthlyInflow: number,
    percentages: number[] = [2, 5, 10, 15, 20]
): {
    tbillsScenarios: InvestmentScenario[];
    savingsScenarios: InvestmentScenario[];
} {
    const tbillsScenarios = percentages.map(p =>
        modelInflowInvestment(monthlyInflow, p, 'tbills', '364-day')
    );

    const savingsScenarios = percentages.map(p =>
        modelInflowInvestment(monthlyInflow, p, 'savings')
    );

    return { tbillsScenarios, savingsScenarios };
}

// =============================================================================
// CASHFLOW ANALYTICS
// =============================================================================

/**
 * Calculate cashflow analytics from statement data
 */
export function calculateCashflowAnalytics(
    cashBalance: number,
    monthlyInflow: number,
    monthlyOutflow: number,
    periodStart: string,
    periodEnd: string
): CashflowAnalytics {
    const netCashflow = monthlyInflow - monthlyOutflow;
    const burnRate = monthlyOutflow / 30; // Daily burn

    // Runway calculation
    let runwayDays = 0;
    let runwayMonths = 0;

    if (netCashflow >= 0) {
        // Positive cashflow = no burn, infinite runway
        runwayDays = 999;
        runwayMonths = 999;
    } else if (burnRate > 0) {
        runwayDays = Math.floor(cashBalance / burnRate);
        runwayMonths = Math.round(runwayDays / 30 * 10) / 10;
    }

    // Health status
    let healthStatus: CashflowAnalytics['healthStatus'];
    if (runwayMonths >= 12 || netCashflow >= 0) {
        healthStatus = 'strong';
    } else if (runwayMonths >= 6) {
        healthStatus = 'healthy';
    } else if (runwayMonths >= 3) {
        healthStatus = 'moderate';
    } else if (runwayMonths >= 1) {
        healthStatus = 'low';
    } else {
        healthStatus = 'critical';
    }

    return {
        cashBalance,
        monthlyInflow,
        monthlyOutflow,
        netCashflow,
        burnRate: Math.round(burnRate),
        runwayDays: Math.min(runwayDays, 999),
        runwayMonths: Math.min(runwayMonths, 99),
        healthStatus,
        periodStart,
        periodEnd,
    };
}

// =============================================================================
// FORMAT HELPERS
// =============================================================================

export function formatNaira(amount: number): string {
    return `₦${amount.toLocaleString('en-NG')}`;
}

export function formatPercent(value: number): string {
    return `${value.toFixed(2)}%`;
}
