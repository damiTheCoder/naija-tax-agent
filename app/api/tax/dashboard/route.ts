import { NextRequest, NextResponse } from "next/server";
import { taxScheduleRepo } from "@/lib/tax/compliance/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") || "entity-default";
    const period = searchParams.get("period") || undefined;
    const dashboard = await taxScheduleRepo.getDashboard(entityId, period);

    return NextResponse.json({
      success: true,
      source: "tax-ledger",
      engineVersion: "v2",
      dashboard,
    });
  } catch (error) {
    console.error("[Tax Dashboard API] GET Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load tax dashboard",
      },
      { status: 500 }
    );
  }
}
