import { NextResponse } from "next/server";
import { createPocketBaseAdminClient } from "@/lib/pocketbase/adminClient";

export const runtime = "nodejs";

const REQUIRED_COLLECTIONS = [
  "users",
  "businesses",
  "business_members",
  "chart_of_accounts",
  "financial_accounts",
  "transactions",
  "journal_entries",
  "journal_lines",
  "audit_logs",
  "support_tickets",
  "support_messages",
  "usage_events",
  "v_trial_balance",
  "v_profit_and_loss",
  "v_balance_sheet",
  "v_cash_flow",
  "v_dashboard_metrics",
] as const;

const LEGACY_COLLECTIONS = [
  "ACCOUNTS",
  "AUTH_COLLECTION",
  "AUTH_COLLECTIONS",
  "BUSINESSES",
  "Journal_Entries",
  "Transactions",
] as const;

export async function GET(): Promise<NextResponse> {
  try {
    const pb = await createPocketBaseAdminClient();
    const collections = await pb.collections.getFullList({ requestKey: null });
    const existing = new Set(collections.map((collection) => collection.name));
    const missing = REQUIRED_COLLECTIONS.filter((name) => !existing.has(name));
    const legacy = LEGACY_COLLECTIONS.filter((name) => existing.has(name));
    const healthy = missing.length === 0 && legacy.length === 0;

    return NextResponse.json(
      {
        success: healthy,
        status: healthy ? "healthy" : "degraded",
        pocketbaseUrl: pb.baseUrl,
        checks: [
          {
            check: "superuser_auth",
            ok: true,
            detail: "PocketBase superuser authentication ok",
          },
          {
            check: "required_collections",
            ok: missing.length === 0,
            detail: missing.length === 0 ? "All required collections exist" : `Missing: ${missing.join(", ")}`,
          },
          {
            check: "legacy_collections",
            ok: legacy.length === 0,
            detail: legacy.length === 0 ? "No legacy collections detected" : `Legacy collections remain: ${legacy.join(", ")}`,
          },
        ],
      },
      { status: healthy ? 200 : 503 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        status: "down",
        checks: [
          {
            check: "pocketbase",
            ok: false,
            detail: error instanceof Error ? error.message : "PocketBase health check failed",
          },
        ],
      },
      { status: 503 },
    );
  }
}
