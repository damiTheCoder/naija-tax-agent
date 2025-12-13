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

function sanitizeIncomeEntries(entries: unknown): TaxInputs["incomeEntries"] | undefined {
    if (!Array.isArray(entries)) {
        return undefined;
    }

    const sanitized = entries
        .map((entry, index) => {
            const record = entry as Partial<{ periodLabel: string; revenue: number; expenses: number }>;
            const label = typeof record.periodLabel === "string" && record.periodLabel.trim()
                ? record.periodLabel.trim()
                : `Period ${index + 1}`;
            const revenue = sanitizeNumber(record.revenue);
            const expenses = sanitizeNumber(record.expenses);
            if (revenue <= 0 && expenses <= 0) {
                return undefined;
            }
            return { periodLabel: label, revenue, expenses };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    return sanitized.length > 0 ? sanitized : undefined;
}

function sanitizePayrollEntries(entries: unknown): TaxInputs["payrollEntries"] | undefined {
    if (!Array.isArray(entries)) {
        return undefined;
    }

    const sanitized = entries
        .map((entry) => {
            const record = entry as Partial<{ month: string; grossPayroll: number; employeeCount: number }>;
            if (!record.month || typeof record.month !== "string") {
                return undefined;
            }
            const month = record.month;
            const grossPayroll = sanitizeNumber(record.grossPayroll);
            const employeeCount = sanitizeNumber(record.employeeCount);
            if (grossPayroll <= 0 && employeeCount <= 0) {
                return undefined;
            }
            return {
                month,
                grossPayroll,
                employeeCount,
            };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    return sanitized.length > 0 ? sanitized : undefined;
}

function sanitizeCertificates(entries: unknown): TaxInputs["withholdingCertificates"] | undefined {
    if (!Array.isArray(entries)) {
        return undefined;
    }

    const sanitized = entries
        .map((entry) => {
            const record = entry as Partial<{ id: string; payerName: string; certificateNumber: string; issueDate: string; amount: number; fileName?: string; fileData?: string }>;
            const amount = sanitizeNumber(record.amount);
            if (!record.payerName || !record.certificateNumber || amount <= 0) {
                return undefined;
            }
            return {
                id: record.id || `${record.certificateNumber}-${amount}`,
                payerName: String(record.payerName),
                certificateNumber: String(record.certificateNumber),
                issueDate: record.issueDate || new Date().toISOString().split("T")[0],
                amount,
                fileName: record.fileName,
                fileData: record.fileData,
            };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    return sanitized.length > 0 ? sanitized : undefined;
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
        incomeEntries: sanitizeIncomeEntries(inputs.incomeEntries),
        payrollEntries: sanitizePayrollEntries(inputs.payrollEntries),
        vatTaxablePurchases: inputs.vatTaxablePurchases !== undefined ? sanitizeNumber(inputs.vatTaxablePurchases) : undefined,
        inputVATPaid: inputs.inputVATPaid !== undefined ? sanitizeNumber(inputs.inputVATPaid) : undefined,
        withholdingTaxCredits: sanitizeNumber(inputs.withholdingTaxCredits),
        withholdingCertificates: sanitizeCertificates(inputs.withholdingCertificates),
        priorYearLosses: inputs.priorYearLosses !== undefined ? sanitizeNumber(inputs.priorYearLosses) : undefined,
        investmentAllowance: inputs.investmentAllowance !== undefined ? sanitizeNumber(inputs.investmentAllowance) : undefined,
        ruralInvestmentAllowance: inputs.ruralInvestmentAllowance !== undefined ? sanitizeNumber(inputs.ruralInvestmentAllowance) : undefined,
        pioneerStatusRelief: inputs.pioneerStatusRelief !== undefined ? sanitizeNumber(inputs.pioneerStatusRelief) : undefined,
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
