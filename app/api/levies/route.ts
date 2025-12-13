/**
 * API Route: /api/levies
 * POST endpoint for calculating various Nigerian business levies
 */

import { NextRequest, NextResponse } from "next/server";
import {
    calculateAllCompanyLevies,
    calculatePoliceLevy,
    calculateNASENILevy,
    calculateNSITF,
    calculateITF,
    CompanyLeviesInput,
    CompanyLeviesResult,
    POLICE_LEVY_RATE,
    NASENI_LEVY_RATE,
    NSITF_RATE,
    ITF_RATE,
    NASENI_INDUSTRIES
} from "@/lib/taxRules/levies";

interface LeviesInfo {
    policeLevy: { rate: number; description: string };
    naseniLevy: { rate: number; description: string; applicableIndustries: string[] };
    nsitf: { rate: number; description: string };
    itf: { rate: number; description: string };
}

const toNumber = (value: unknown): number => {
    if (value === null || value === undefined || value === "") {
        return 0;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

// GET - Return levy rates info
export async function GET(): Promise<NextResponse<LeviesInfo>> {
    return NextResponse.json({
        policeLevy: {
            rate: POLICE_LEVY_RATE,
            description: "Nigeria Police Trust Fund Levy at 0.005% of net profit",
        },
        naseniLevy: {
            rate: NASENI_LEVY_RATE,
            description: "NASENI Levy at 0.25% of profit before tax (specified industries)",
            applicableIndustries: NASENI_INDUSTRIES,
        },
        nsitf: {
            rate: NSITF_RATE,
            description: "NSITF Employer Contribution at 1% of payroll",
        },
        itf: {
            rate: ITF_RATE,
            description: "Industrial Training Fund Levy at 1% of annual payroll (5+ employees or N50m+ turnover)",
        },
    });
}

// POST - Calculate all company levies
export async function POST(request: NextRequest): Promise<NextResponse<CompanyLeviesResult | { error: string }>> {
    try {
        const body = await request.json() as CompanyLeviesInput;

        // Validate required fields
        if (typeof body.netProfit !== "number") {
            return NextResponse.json(
                { error: "Net profit is required" },
                { status: 400 }
            );
        }

        // Set defaults for optional fields
        const payrollEntries = Array.isArray(body.payrollEntries)
            ? body.payrollEntries
                .map((entry) => {
                    if (!entry || typeof entry !== "object") return undefined;
                    const month = typeof entry.month === "string" ? entry.month : "";
                    const grossPayroll = toNumber((entry as { grossPayroll?: number }).grossPayroll);
                    const employeeCount = toNumber((entry as { employeeCount?: number }).employeeCount);
                    if (!month || (grossPayroll <= 0 && employeeCount <= 0)) {
                        return undefined;
                    }
                    return { month, grossPayroll, employeeCount };
                })
                .filter((entry): entry is { month: string; grossPayroll: number; employeeCount: number } => Boolean(entry))
            : undefined;

        const input: CompanyLeviesInput = {
            netProfit: body.netProfit,
            profitBeforeTax: body.profitBeforeTax ?? body.netProfit,
            industry: body.industry ?? "other",
            monthlyPayroll: body.monthlyPayroll ?? 0,
            numberOfEmployees: body.numberOfEmployees ?? 0,
            annualTurnover: body.annualTurnover ?? 0,
            payrollEntries,
        };

        const result = calculateAllCompanyLevies(input);
        return NextResponse.json(result);
    } catch (error) {
        console.error("Error calculating levies:", error);
        return NextResponse.json(
            { error: "Unable to calculate levies. Please try again." },
            { status: 500 }
        );
    }
}
