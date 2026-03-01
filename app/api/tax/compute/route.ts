import { NextRequest, NextResponse } from "next/server";
import { accountingEngine } from "@/lib/accounting/transactionBridge";
import {
    computeVATPosition,
    generateTaxAdjustmentSchedule,
    computeCIT,
    determineCompanySize,
} from "@/lib/tax/nigerianTaxCompliance";
import { TAX_RATES_2026 } from "@/lib/accounting/transactionTaxAnalyzer";
import { taxScheduleRepo } from "@/lib/tax/compliance/server";

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
    entityId?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body: TaxComputeRequest = await request.json();
        const taxType = (body.taxType || "all").toLowerCase() as TaxType;
        const year = body.year || new Date().getFullYear();
        const entityId = body.entityId || "entity-default";
        const period = body.period;

        const dashboard = await taxScheduleRepo.getDashboard(entityId, period);

        // Get statements from accounting engine
        const statements = accountingEngine.generateStatements();

        const totalRevenue = statements.revenue || 0;
        const totalExpenses = (statements.costOfSales || 0) + (statements.operatingExpenses || 0);
        const grossProfit = statements.grossProfit || (totalRevenue - totalExpenses);
        const turnover = body.turnover || totalRevenue;
        const vatSchedule = dashboard.schedules.find((schedule) => schedule.taxType === "VAT");
        const whtSchedule = dashboard.schedules.find((schedule) => schedule.taxType === "WHT");

        let result: Record<string, unknown> = {
            year,
            taxType,
            source: "tax-ledger",
            engineVersion: "v2",
        };

        switch (taxType) {
            case "vat": {
                const outputVAT = dashboard.vatPayable;
                const inputVAT = dashboard.vatReceivable;
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
                        period: period || vatSchedule?.period || null,
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
                const whtPayable = dashboard.whtPayable;

                result = {
                    ...result,
                    wht: {
                        estimatedProfessionalServices: 0,
                        rate: `${TAX_RATES_2026.WHT_PROFESSIONAL_SERVICES * 100}%`,
                        whtPayable: Math.round(whtPayable),
                        note: "Ledger-first WHT from tax sub-ledger",
                        period: period || whtSchedule?.period || null,
                    },
                };
                break;
            }

            case "all":
            default: {
                const outputVAT = dashboard.vatPayable;
                const inputVAT = dashboard.vatReceivable;
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
                        period: period || null,
                    },
                    vat: {
                        outputVAT: Math.round(outputVAT),
                        inputVAT: Math.round(inputVAT),
                        netPayable: vatPosition.displayAmount,
                        position: vatPosition.displayLabel,
                    },
                    wht: {
                        whtPayable: Math.round(dashboard.whtPayable),
                    },
                    cit: {
                        taxableProfit: Math.round(taxAdjustment.taxableProfit),
                        citPayable: Math.round(citComputation.citPayable),
                        educationTax: Math.round(citComputation.educationTax),
                    },
                    totalTaxLiability: Math.round(
                        vatPosition.displayAmount +
                        dashboard.whtPayable +
                        citComputation.totalDirectTax
                    ),
                };
            }
        }

        if (process.env.TAX_ENGINE_V2_DUAL_RUN === "true") {
            const legacyOutputVAT = totalRevenue * TAX_RATES_2026.VAT_RATE;
            const legacyInputVAT = totalExpenses * TAX_RATES_2026.VAT_RATE * 0.6;
            const legacyVatPosition = computeVATPosition(legacyOutputVAT, legacyInputVAT);
            const vatDiff = Math.round((dashboard.netVatPosition - legacyVatPosition.displayAmount) * 100) / 100;

            result = {
                ...result,
                dualRun: {
                    enabled: true,
                    legacy: {
                        vatNet: legacyVatPosition.displayAmount,
                        whtPayable: Math.round(totalExpenses * 0.2 * TAX_RATES_2026.WHT_PROFESSIONAL_SERVICES),
                    },
                    v2: {
                        vatNet: dashboard.netVatPosition,
                        whtPayable: dashboard.whtPayable,
                    },
                    diff: {
                        vatNet: vatDiff,
                        whtPayable:
                            Math.round(
                                (dashboard.whtPayable -
                                    totalExpenses * 0.2 * TAX_RATES_2026.WHT_PROFESSIONAL_SERVICES) *
                                    100
                            ) / 100,
                    },
                },
            };
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
        const entityId = searchParams.get("entityId") || "entity-default";
        const period = searchParams.get("period") || undefined;

        // Simulate POST request with tax type
        const mockRequest = {
            json: async () => ({ taxType, entityId, period }),
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
