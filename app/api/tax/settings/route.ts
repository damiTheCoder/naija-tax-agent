import { NextRequest, NextResponse } from "next/server";
import { taxSettingsRepo } from "@/lib/tax/compliance/server";
import type { TaxCategoryRule } from "@/lib/tax/settings";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId") || "entity-default";
    const settings = await taxSettingsRepo.load(entityId);
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("[Tax Settings API] GET Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load tax settings",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      entityId?: string;
      settings?: Record<string, unknown>;
    };
    const entityId = body.entityId || "entity-default";
    const payload = (body.settings || body) as Record<string, unknown>;

    const settings = await taxSettingsRepo.save(entityId, {
      entityId,
      filingCadence:
        payload.filingCadence && typeof payload.filingCadence === "object"
          ? {
              vat: (payload.filingCadence as Record<string, unknown>).vat as "monthly" | "quarterly",
              wht: (payload.filingCadence as Record<string, unknown>).wht as "monthly" | "quarterly",
            }
          : undefined,
      filingDueDay: typeof payload.filingDueDay === "number" ? payload.filingDueDay : undefined,
      categoryTaxMatrix:
        payload.categoryTaxMatrix && typeof payload.categoryTaxMatrix === "object"
          ? (payload.categoryTaxMatrix as Record<string, TaxCategoryRule>)
          : undefined,
      defaultVatModeByCategory:
        payload.defaultVatModeByCategory && typeof payload.defaultVatModeByCategory === "object"
          ? (payload.defaultVatModeByCategory as Record<string, "inclusive" | "exclusive">)
          : undefined,
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("[Tax Settings API] PUT Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save tax settings",
      },
      { status: 500 }
    );
  }
}
