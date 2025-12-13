import { NextRequest, NextResponse } from "next/server";
import {
    applyTaxRuleOverrides,
    getOverrideSnapshot,
    getTaxRuleMetadata,
    refreshOverridesFromRemote,
} from "@/lib/taxRules/liveRates";
import { PIT_BANDS, CIT_CONFIG, VAT_RATE, MINIMUM_TAX_RATE, CRA_FIXED_AMOUNT, CRA_PERCENTAGE_OF_GROSS, CRA_ADDITIONAL_PERCENTAGE } from "@/lib/taxRules/config";

export async function GET(): Promise<NextResponse> {
    await refreshOverridesFromRemote();
    return NextResponse.json({
        metadata: getTaxRuleMetadata(),
        overrides: getOverrideSnapshot(),
        baseConfig: {
            pitBands: PIT_BANDS,
            cra: {
                fixedAmount: CRA_FIXED_AMOUNT,
                percentageOfGross: CRA_PERCENTAGE_OF_GROSS,
                additionalPercentage: CRA_ADDITIONAL_PERCENTAGE,
            },
            cit: CIT_CONFIG,
            vatRate: VAT_RATE,
            minimumTaxRate: MINIMUM_TAX_RATE,
        },
    });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const payload = await request.json();
        if (typeof payload !== "object" || payload === null) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        applyTaxRuleOverrides(payload, { source: "api" });
        return NextResponse.json({ metadata: getTaxRuleMetadata(), overrides: getOverrideSnapshot() });
    } catch (error) {
        console.error("Error updating tax rules", error);
        return NextResponse.json({ error: "Unable to update tax rules" }, { status: 500 });
    }
}
