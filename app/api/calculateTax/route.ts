/**
 * API Route: /api/calculateTax
 * POST endpoint for calculating Nigerian taxes
 */

import { NextRequest, NextResponse } from "next/server";
import { CalculateTaxRequest, TaxResult, UserProfile, TaxInputs } from "@/lib/types";
import { calculateTaxForNigeria } from "@/lib/taxRules/ng";

/**
 * Sanitize numeric input - convert strings to numbers, handle NaN
 */
function sanitizeNumber(value: unknown, defaultValue: number = 0): number {
    if (value === null || value === undefined || value === "") {
        return defaultValue;
    }
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
}

/**
 * Sanitize and validate profile data
 */
function sanitizeProfile(profile: Partial<UserProfile>): UserProfile {
    return {
        fullName: String(profile.fullName || "").trim(),
        businessName: profile.businessName ? String(profile.businessName).trim() : undefined,
        taxpayerType: profile.taxpayerType === "company" ? "company" : "freelancer",
        taxYear: sanitizeNumber(profile.taxYear, new Date().getFullYear()),
        stateOfResidence: String(profile.stateOfResidence || "Lagos").trim(),
        isVATRegistered: Boolean(profile.isVATRegistered),
        currency: "NGN",
    };
}

/**
 * Sanitize and validate tax inputs
 */
function sanitizeInputs(inputs: Partial<TaxInputs>): TaxInputs {
    return {
        grossRevenue: sanitizeNumber(inputs.grossRevenue),
        allowableExpenses: sanitizeNumber(inputs.allowableExpenses),
        pensionContributions: sanitizeNumber(inputs.pensionContributions),
        nhfContributions: sanitizeNumber(inputs.nhfContributions),
        lifeInsurancePremiums: sanitizeNumber(inputs.lifeInsurancePremiums),
        otherReliefs: sanitizeNumber(inputs.otherReliefs),
        turnover: inputs.turnover !== undefined ? sanitizeNumber(inputs.turnover) : undefined,
        costOfSales: inputs.costOfSales !== undefined ? sanitizeNumber(inputs.costOfSales) : undefined,
        operatingExpenses: inputs.operatingExpenses !== undefined ? sanitizeNumber(inputs.operatingExpenses) : undefined,
        capitalAllowance: inputs.capitalAllowance !== undefined ? sanitizeNumber(inputs.capitalAllowance) : undefined,
    };
}

export async function POST(request: NextRequest): Promise<NextResponse<TaxResult | { error: string }>> {
    try {
        const body = await request.json() as CalculateTaxRequest;

        // Validate required fields
        if (!body.profile) {
            return NextResponse.json(
                { error: "Profile is required" },
                { status: 400 }
            );
        }

        if (!body.inputs) {
            return NextResponse.json(
                { error: "Tax inputs are required" },
                { status: 400 }
            );
        }

        if (!body.profile.fullName || String(body.profile.fullName).trim() === "") {
            return NextResponse.json(
                { error: "Full name is required" },
                { status: 400 }
            );
        }

        // Sanitize inputs
        const profile = sanitizeProfile(body.profile);
        const inputs = sanitizeInputs(body.inputs);

        // Calculate tax
        const result = calculateTaxForNigeria(profile, inputs);

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error calculating tax:", error);
        return NextResponse.json(
            { error: "Unable to compute tax. Please try again." },
            { status: 500 }
        );
    }
}
