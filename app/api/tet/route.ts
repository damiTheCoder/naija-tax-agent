/**
 * API Route: /api/tet
 * POST endpoint for calculating Tertiary Education Tax
 */

import { NextRequest, NextResponse } from "next/server";
import { calculateTET, TETInput, TETResult, TET_RATE } from "@/lib/taxRules/tet";

// GET - Return TET rate info
export async function GET(): Promise<NextResponse<{ rate: number; description: string }>> {
    return NextResponse.json({
        rate: TET_RATE,
        description: "Tertiary Education Tax at 3% of assessable profit (companies only)"
    });
}

// POST - Calculate TET
export async function POST(request: NextRequest): Promise<NextResponse<TETResult | { error: string }>> {
    try {
        const body = await request.json() as TETInput;

        if (typeof body.assessableProfit !== "number") {
            return NextResponse.json(
                { error: "Assessable profit is required" },
                { status: 400 }
            );
        }

        if (typeof body.isCompany !== "boolean") {
            return NextResponse.json(
                { error: "isCompany (true/false) is required" },
                { status: 400 }
            );
        }

        const result = calculateTET(body);
        return NextResponse.json(result);
    } catch (error) {
        console.error("Error calculating TET:", error);
        return NextResponse.json(
            { error: "Unable to calculate TET. Please try again." },
            { status: 500 }
        );
    }
}
