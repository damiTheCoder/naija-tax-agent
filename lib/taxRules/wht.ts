/**
 * Withholding Tax (WHT) Calculator for Nigeria
 * 
 * Calculates WHT on various payment types based on
 * Nigerian tax regulations.
 */

import { WHT_RATES, WHTRate } from "./whtConfig";

export interface WHTInput {
    paymentType: string;
    amount: number;
    isResident: boolean;
    description?: string;
}

export interface WHTCalculation {
    paymentType: string;
    paymentDescription: string;
    grossAmount: number;
    rate: number;
    whtAmount: number;
    netAmount: number;
    isResident: boolean;
}

export interface WHTResult {
    calculations: WHTCalculation[];
    totalGrossAmount: number;
    totalWHTDeducted: number;
    totalNetAmount: number;
}

/**
 * Get the WHT rate for a specific payment type
 */
export function getWHTRate(paymentType: string): WHTRate | undefined {
    return WHT_RATES.find(rate => rate.paymentType === paymentType);
}

/**
 * Calculate WHT for a single payment
 */
export function calculateSingleWHT(input: WHTInput): WHTCalculation | null {
    const rateInfo = getWHTRate(input.paymentType);

    if (!rateInfo) {
        return null;
    }

    const rate = input.isResident ? rateInfo.residentRate : rateInfo.nonResidentRate;
    const whtAmount = input.amount * rate;
    const netAmount = input.amount - whtAmount;

    return {
        paymentType: input.paymentType,
        paymentDescription: input.description || rateInfo.description,
        grossAmount: input.amount,
        rate,
        whtAmount,
        netAmount,
        isResident: input.isResident,
    };
}

/**
 * Calculate WHT for multiple payments
 */
export function calculateWHT(inputs: WHTInput[]): WHTResult {
    const calculations: WHTCalculation[] = [];
    let totalGrossAmount = 0;
    let totalWHTDeducted = 0;
    let totalNetAmount = 0;

    for (const input of inputs) {
        const calc = calculateSingleWHT(input);
        if (calc) {
            calculations.push(calc);
            totalGrossAmount += calc.grossAmount;
            totalWHTDeducted += calc.whtAmount;
            totalNetAmount += calc.netAmount;
        }
    }

    return {
        calculations,
        totalGrossAmount,
        totalWHTDeducted,
        totalNetAmount,
    };
}

/**
 * Get all available WHT payment types
 */
export function getAvailableWHTTypes(): WHTRate[] {
    return [...WHT_RATES];
}
