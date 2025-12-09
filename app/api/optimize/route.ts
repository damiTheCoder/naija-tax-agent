/**
 * API Route: /api/optimize
 * POST endpoint for generating tax optimization suggestions
 */

import { NextRequest, NextResponse } from "next/server";
import { UserProfile, TaxInputs, TaxResult, TaxOptimizationResult } from "@/lib/types";
import { generateOptimizations } from "@/lib/taxOptimizer";

interface OptimizeRequest {
    profile: UserProfile;
    inputs: TaxInputs;
    result: TaxResult;
}

export async function POST(request: NextRequest): Promise<NextResponse<TaxOptimizationResult | { error: string }>> {
    try {
        const body = await request.json() as OptimizeRequest;

        // Validate required fields
        if (!body.profile || !body.inputs || !body.result) {
            return NextResponse.json(
                { error: "Profile, inputs, and result are required" },
                { status: 400 }
            );
        }

        // Generate optimization suggestions
        const optimizations = generateOptimizations(body.profile, body.inputs, body.result);

        return NextResponse.json(optimizations);
    } catch (error) {
        console.error("Error generating optimizations:", error);
        return NextResponse.json(
            { error: "Unable to generate optimization suggestions." },
            { status: 500 }
        );
    }
}
