/**
 * API Route: /api/stamp-duty
 * POST endpoint for calculating Stamp Duties
 */

import { NextRequest, NextResponse } from "next/server";
import {
    calculateStampDuty,
    calculateTotalStampDuty,
    getStampDutyRate,
    StampDutyInput,
    StampDutyResult,
    STAMP_DUTY_RATES
} from "@/lib/taxRules/stampDuty";

interface StampDutyRequest {
    documents: StampDutyInput[];
}

interface StampDutyResponse {
    documents: StampDutyResult[];
    totalDuty: number;
}

// GET - Return available stamp duty types and rates
export async function GET(): Promise<NextResponse> {
    return NextResponse.json(STAMP_DUTY_RATES);
}

// POST - Calculate stamp duties
export async function POST(request: NextRequest): Promise<NextResponse<StampDutyResponse | { error: string }>> {
    try {
        const body = await request.json() as StampDutyRequest;

        if (!body.documents || !Array.isArray(body.documents)) {
            return NextResponse.json(
                { error: "Documents array is required" },
                { status: 400 }
            );
        }

        // Validate each document
        for (const doc of body.documents) {
            if (!doc.documentType) {
                return NextResponse.json(
                    { error: "Each document must have a documentType" },
                    { status: 400 }
                );
            }
            if (typeof doc.transactionValue !== "number" || doc.transactionValue < 0) {
                return NextResponse.json(
                    { error: "Each document must have a valid transaction value" },
                    { status: 400 }
                );
            }
        }

        const result = calculateTotalStampDuty(body.documents);
        return NextResponse.json(result);
    } catch (error) {
        console.error("Error calculating stamp duty:", error);
        return NextResponse.json(
            { error: "Unable to calculate stamp duty. Please try again." },
            { status: 500 }
        );
    }
}
