/**
 * API Route: /api/wht
 * POST endpoint for calculating Withholding Tax
 */

import { NextRequest, NextResponse } from "next/server";
import { calculateWHT, getAvailableWHTTypes, WHTInput, WHTResult } from "@/lib/taxRules/wht";
import { WHTRate } from "@/lib/taxRules/whtConfig";

interface WHTRequest {
    payments: WHTInput[];
}

// GET - Return available WHT types and rates
export async function GET(): Promise<NextResponse<WHTRate[]>> {
    const types = getAvailableWHTTypes();
    return NextResponse.json(types);
}

// POST - Calculate WHT for provided payments
export async function POST(request: NextRequest): Promise<NextResponse<WHTResult | { error: string }>> {
    try {
        const body = await request.json() as WHTRequest;

        if (!body.payments || !Array.isArray(body.payments)) {
            return NextResponse.json(
                { error: "Payments array is required" },
                { status: 400 }
            );
        }

        // Validate each payment
        for (const payment of body.payments) {
            if (!payment.paymentType) {
                return NextResponse.json(
                    { error: "Each payment must have a paymentType" },
                    { status: 400 }
                );
            }
            if (typeof payment.amount !== "number" || payment.amount < 0) {
                return NextResponse.json(
                    { error: "Each payment must have a valid positive amount" },
                    { status: 400 }
                );
            }
            if (typeof payment.isResident !== "boolean") {
                return NextResponse.json(
                    { error: "Each payment must specify isResident (true/false)" },
                    { status: 400 }
                );
            }
        }

        const result = calculateWHT(body.payments);
        return NextResponse.json(result);
    } catch (error) {
        console.error("Error calculating WHT:", error);
        return NextResponse.json(
            { error: "Unable to calculate WHT. Please try again." },
            { status: 500 }
        );
    }
}
