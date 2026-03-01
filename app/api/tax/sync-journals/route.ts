import { NextRequest, NextResponse } from "next/server";
import type { JournalEntry } from "@/lib/accounting/doubleEntry";
import { taxTransactionRepo } from "@/lib/tax/compliance/server";

export const runtime = "nodejs";

type SyncRequestBody = {
  entityId?: string;
  journals?: JournalEntry[];
  journalEntries?: JournalEntry[];
  source?: "live_posting" | "backfill";
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as SyncRequestBody;
    const entityId = body.entityId || "entity-default";
    const journals = Array.isArray(body.journals)
      ? body.journals
      : Array.isArray(body.journalEntries)
      ? body.journalEntries
      : [];

    if (journals.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No journals provided",
        },
        { status: 400 }
      );
    }

    const result = await taxTransactionRepo.upsertJournalTransactions({
      entityId,
      journals: journals.map((journal) => ({
        id: journal.id,
        date: journal.date,
        narration: journal.narration,
        reference: journal.reference,
        lines: journal.lines,
        transactionType: journal.transactionType,
        source: journal.source,
        createdAt: journal.createdAt,
        updatedAt: journal.updatedAt,
        status: journal.status,
        metadata: {
          ...(journal as unknown as { metadata?: Record<string, unknown> }).metadata,
          ...(journal as unknown as { assumptions?: string[] }).assumptions
            ? { assumptions: (journal as unknown as { assumptions?: string[] }).assumptions }
            : {},
        },
      })),
      source: body.source || "live_posting",
    });

    return NextResponse.json({
      success: true,
      source: "tax-ledger",
      engineVersion: "v2",
      ...result,
    });
  } catch (error) {
    console.error("[Tax Sync Journals API] POST Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to sync journals",
      },
      { status: 500 }
    );
  }
}
