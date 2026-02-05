import { NextRequest, NextResponse } from "next/server";
import { accountingEngine } from "@/lib/accounting/transactionBridge";
import {
    computeVATPosition,
    generateTaxAdjustmentSchedule,
    computeCIT,
    determineCompanySize,
} from "@/lib/tax/nigerianTaxCompliance";
import { TAX_RATES_2026 } from "@/lib/accounting/transactionTaxAnalyzer";

/**
 * Tax Computation API for Clawdbot
 * 
 * Computes Nigerian taxes (VAT, WHT, CIT, PAYE, CGT).
 * Called by the cashos_compute_tax tool.
 */

type TaxType = "vat" | "wht" | "cit" | "paye" | "cgt" | "tet" | "all";

interface TaxComputeRequest {
    taxType?: TaxType;
    year?: number;
    period?: string;
    turnover?: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body: TaxComputeRequest = await request.json();
        const taxType = (body.taxType || "all").toLowerCase() as TaxType;
        const year = body.year || new Date().getFullYear();

        // Get statements from accounting engine
        const statements = accountingEngine.generateStatements();

        const totalRevenue = statements.revenue || 0;
        const totalExpenses = (statements.costOfSales || 0) + (statements.operatingExpenses || 0);
        const grossProfit = statements.grossProfit || (totalRevenue - totalExpenses);
        const turnover = body.turnover || totalRevenue;

        let result: Record<string, unknown> = {
            year,
            taxType,
        };

        switch (taxType) {
            case "vat": {
                const outputVAT = totalRevenue * TAX_RATES_2026.VAT_RATE;
                const inputVAT = totalExpenses * TAX_RATES_2026.VAT_RATE * 0.6; // Estimate 60% claimable
                const vatPosition = computeVATPosition(outputVAT, inputVAT);

                result = {
                    ...result,
                    vat: {
                        rate: `${TAX_RATES_2026.VAT_RATE * 100}%`,
                        outputVAT: Math.round(outputVAT),
                        inputVAT: Math.round(inputVAT),
                        netPayable: vatPosition.displayAmount,
                        position: vatPosition.displayLabel,
                        isCredit: vatPosition.isCredit,
                    },
                };
                break;
            }

            case "cit": {
                const companySize = determineCompanySize(turnover);
                const taxAdjustment = generateTaxAdjustmentSchedule(grossProfit, [], 0);
                const citComputation = computeCIT(taxAdjustment.taxableProfit, turnover);

                result = {
                    ...result,
                    cit: {
                        companySize: companySize,
                        turnover: Math.round(turnover),
                        accountingProfit: Math.round(grossProfit),
                        taxableProfit: Math.round(taxAdjustment.taxableProfit),
                        citRate: `${citComputation.citRate * 100}%`,
                        citPayable: Math.round(citComputation.citPayable),
                        educationTax: Math.round(citComputation.educationTax),
                        totalDirectTax: Math.round(citComputation.totalDirectTax),
                        reason: citComputation.reason,
                    },
                };
                break;
            }

            case "wht": {
                // Estimate WHT from professional services (typically 10% of such expenses)
                const estimatedProfessionalExpenses = totalExpenses * 0.2; // Assume 20% are professional services
                const whtPayable = estimatedProfessionalExpenses * TAX_RATES_2026.WHT_PROFESSIONAL_SERVICES;

                result = {
                    ...result,
                    wht: {
                        estimatedProfessionalServices: Math.round(estimatedProfessionalExpenses),
                        rate: `${TAX_RATES_2026.WHT_PROFESSIONAL_SERVICES * 100}%`,
                        whtPayable: Math.round(whtPayable),
                        note: "WHT on professional services, consulting, legal fees",
                    },
                };
                break;
            }

            case "all":
            default: {
                const outputVAT = totalRevenue * TAX_RATES_2026.VAT_RATE;
                const inputVAT = totalExpenses * TAX_RATES_2026.VAT_RATE * 0.6;
                const vatPosition = computeVATPosition(outputVAT, inputVAT);

                const companySize = determineCompanySize(turnover);
                const taxAdjustment = generateTaxAdjustmentSchedule(grossProfit, [], 0);
                const citComputation = computeCIT(taxAdjustment.taxableProfit, turnover);

                result = {
                    ...result,
                    summary: {
                        totalRevenue: Math.round(totalRevenue),
                        totalExpenses: Math.round(totalExpenses),
                        grossProfit: Math.round(grossProfit),
                        companySize: companySize,
                    },
                    vat: {
                        outputVAT: Math.round(outputVAT),
                        inputVAT: Math.round(inputVAT),
                        netPayable: vatPosition.displayAmount,
                        position: vatPosition.displayLabel,
                    },
                    cit: {
                        taxableProfit: Math.round(taxAdjustment.taxableProfit),
                        citPayable: Math.round(citComputation.citPayable),
                        educationTax: Math.round(citComputation.educationTax),
                    },
                    totalTaxLiability: Math.round(
                        vatPosition.displayAmount +
                        citComputation.totalDirectTax
                    ),
                };
            }
        }

        return NextResponse.json({
            success: true,
            ...result,
        });

    } catch (error) {
        console.error("[Tax Compute API] Error:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to compute tax",
        }, { status: 500 });
    }
}

// GET: Get current tax position summary
export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(request.url);
        const taxType = searchParams.get("type") || "all";

        // Simulate POST request with tax type
        const mockRequest = {
            json: async () => ({ taxType }),
        } as NextRequest;

        return POST(mockRequest);

    } catch (error) {
        console.error("[Tax Compute API] GET Error:", error);
        return NextResponse.json({
            success: false,
            error: "Failed to get tax summary",
        }, { status: 500 });
    }
}
