import { NextRequest, NextResponse } from "next/server";
import type { JournalEntry } from "@/lib/accounting/doubleEntry";
import { taxTransactionRepo } from "@/lib/tax/compliance/server";

export const runtime = "nodejs";

type BackfillBody = {
  entityId?: string;
  journals?: JournalEntry[];
  mode?: "apply" | "report";
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as BackfillBody;
    const entityId = body.entityId || "entity-default";
    const journals = Array.isArray(body.journals) ? body.journals : [];
    const mode = body.mode === "report" ? "report" : "apply";

    if (journals.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No journals provided for backfill",
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
          migratedAt: new Date().toISOString(),
        },
      })),
      source: "backfill",
      mode,
    });

    return NextResponse.json({
      success: true,
      source: "tax-ledger",
      engineVersion: "v2",
      mode,
      backfill: {
        journalsReceived: journals.length,
        transactionsUpserted: result.upsertedTransactions,
        prunedTransactions: result.prunedTransactions,
        duplicatesPruned: result.duplicatesPruned,
        staleRowsRemoved: result.staleRowsRemoved,
        syncRunId: result.syncRunId,
        impactedPeriods: result.impactedPeriods,
        reportOnly: result.reportOnly,
        report: result.report,
      },
    });
  } catch (error) {
    console.error("[Tax Backfill API] POST Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to backfill tax ledgers",
      },
      { status: 500 }
    );
  }
}
