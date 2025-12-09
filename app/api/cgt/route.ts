/**
 * API Route: /api/cgt
 * POST endpoint for calculating Capital Gains Tax
 */

import { NextRequest, NextResponse } from "next/server";
import { calculateCGT, calculateTotalCGT, CGTInput, CGTResult, CGT_RATE } from "@/lib/taxRules/cgt";

interface CGTRequest {
    disposals: CGTInput[];
}

interface CGTResponse {
    disposals: CGTResult[];
    totalGain: number;
    totalCGT: number;
    cgtRate: number;
}

// GET - Return CGT rate info
export async function GET(): Promise<NextResponse<{ rate: number; description: string }>> {
    return NextResponse.json({
        rate: CGT_RATE,
        description: "Capital Gains Tax at 10% on chargeable gains from asset disposal"
    });
}

// POST - Calculate CGT for asset disposals
export async function POST(request: NextRequest): Promise<NextResponse<CGTResponse | { error: string }>> {
    try {
        const body = await request.json() as CGTRequest;

        if (!body.disposals || !Array.isArray(body.disposals)) {
            return NextResponse.json(
                { error: "Disposals array is required" },
                { status: 400 }
            );
        }

        // Validate each disposal
        for (const disposal of body.disposals) {
            if (typeof disposal.acquisitionCost !== "number" || disposal.acquisitionCost < 0) {
                return NextResponse.json(
                    { error: "Each disposal must have a valid acquisition cost" },
                    { status: 400 }
                );
            }
            if (typeof disposal.disposalProceeds !== "number" || disposal.disposalProceeds < 0) {
                return NextResponse.json(
                    { error: "Each disposal must have valid disposal proceeds" },
                    { status: 400 }
                );
            }
        }

        const result = calculateTotalCGT(body.disposals);

        return NextResponse.json({
            ...result,
            cgtRate: CGT_RATE,
        });
    } catch (error) {
        console.error("Error calculating CGT:", error);
        return NextResponse.json(
            { error: "Unable to calculate CGT. Please try again." },
            { status: 500 }
        );
    }
}
