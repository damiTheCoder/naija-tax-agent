import { NextRequest, NextResponse } from "next/server";
import { exchangeRateRepo } from "@/lib/accounting/server";
import { badRequest, ensureMinimumRole, errorResponse, getEntityId, parseLimit } from "../_utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = getEntityId(request);
    const rates = await exchangeRateRepo.list(entityId, {
      fromCurrency: searchParams.get("fromCurrency") || undefined,
      toCurrency: searchParams.get("toCurrency") || undefined,
      fromDate: searchParams.get("fromDate") || undefined,
      toDate: searchParams.get("toDate") || undefined,
      limit: parseLimit(searchParams.get("limit"), 200, 1, 1000),
    });

    return NextResponse.json({ success: true, rates, count: rates.length });
  } catch (error) {
    return errorResponse(error, "Failed to fetch exchange rates");
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const auth = ensureMinimumRole(request, body, "manager");
    if (auth.forbiddenResponse) return auth.forbiddenResponse;

    const entityId = getEntityId(request, body.entityId);

    if (typeof body.date !== "string") return badRequest("date is required");
    if (typeof body.fromCurrency !== "string") return badRequest("fromCurrency is required");
    if (typeof body.toCurrency !== "string") return badRequest("toCurrency is required");
    if (!Number.isFinite(Number(body.rate)) || Number(body.rate) <= 0) {
      return badRequest("rate must be greater than zero");
    }

    const rate = await exchangeRateRepo.upsert(entityId, {
      date: body.date,
      fromCurrency: body.fromCurrency,
      toCurrency: body.toCurrency,
      rate: Number(body.rate),
      source: typeof body.source === "string" ? body.source : undefined,
      metadata: body.metadata && typeof body.metadata === "object" ? (body.metadata as Record<string, unknown>) : undefined,
    });

    return NextResponse.json({ success: true, rate }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Failed to save exchange rate");
  }
}
