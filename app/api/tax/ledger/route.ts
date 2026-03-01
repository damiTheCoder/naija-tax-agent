import { NextRequest, NextResponse } from "next/server";
import { taxLedgerRepo } from "@/lib/tax/compliance/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") || "entity-default";
    const period = searchParams.get("period") || undefined;
    const taxType = (searchParams.get("taxType") || "ALL").toUpperCase() as
      | "VAT"
      | "WHT"
      | "CIT"
      | "CGT"
      | "STAMP"
      | "ALL";
    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 50);

    const result = await taxLedgerRepo.getLedgerRows({
      entityId,
      period,
      taxType,
      page,
      pageSize,
    });

    return NextResponse.json({
      success: true,
      source: "tax-ledger",
      engineVersion: "v2",
      ...result,
    });
  } catch (error) {
    console.error("[Tax Ledger API] GET Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load tax ledger",
      },
      { status: 500 }
    );
  }
}
