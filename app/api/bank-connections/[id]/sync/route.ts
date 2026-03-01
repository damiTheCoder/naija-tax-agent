/**
 * =============================================================================
 * BANK CONNECTION SYNC API
 * =============================================================================
 *
 * POST /api/bank-connections/[id]/sync - Trigger manual sync
 * GET  /api/bank-connections/[id]/sync - Get sync history
 *
 * When a sync is triggered, the fetched transactions are run through the
 * full cross-module pipeline:
 *   Bank → Classify → Accounting → Tax → Budgeting → Cashflow
 *
 * =============================================================================
 */

import { NextRequest, NextResponse } from "next/server";
import { processTransactions } from "@/lib/banking/transactionPipeline";
import type { InboundBankTransaction } from "@/lib/banking/types";

// =============================================================================
// DEMO TRANSACTIONS (used until live Mono/Okra integration is wired)
// =============================================================================

function generateSyncTransactions(connectionId: string): InboundBankTransaction[] {
  const now = Date.now();
  return [
    {
      id: `sync-${now}-001`,
      connectionId,
      accountId: "acc_001",
      date: new Date(now - 1 * 86400000).toISOString(),
      description: "NIP/ACME LTD/Invoice Payment #2026-031",
      narration: "Payment for consulting services",
      amount: 750000,
      direction: "credit",
      currency: "NGN",
      reference: `NIP/${now}001`,
      channel: "transfer",
    },
    {
      id: `sync-${now}-002`,
      connectionId,
      accountId: "acc_001",
      date: new Date(now - 1 * 86400000).toISOString(),
      description: "POS/SHOPRITE IKEJA/GROCERIES",
      amount: 23500,
      direction: "debit",
      currency: "NGN",
      reference: `POS/${now}002`,
      channel: "pos",
    },
    {
      id: `sync-${now}-003`,
      connectionId,
      accountId: "acc_001",
      date: new Date(now - 2 * 86400000).toISOString(),
      description: "IKEDC PREPAID METER RECHARGE",
      narration: "Electricity bill",
      amount: 45000,
      direction: "debit",
      currency: "NGN",
      reference: `BP/${now}003`,
      channel: "web",
    },
    {
      id: `sync-${now}-004`,
      connectionId,
      accountId: "acc_001",
      date: new Date(now - 2 * 86400000).toISOString(),
      description: "SALARY CREDIT - DEC 2025",
      narration: "Monthly salary",
      amount: 850000,
      direction: "credit",
      currency: "NGN",
      reference: `SAL/${now}004`,
    },
    {
      id: `sync-${now}-005`,
      connectionId,
      accountId: "acc_001",
      date: new Date(now - 3 * 86400000).toISOString(),
      description: "TRANSFER TO VENDOR - OFFICE SUPPLIES LTD",
      narration: "Payment for stationery and printer cartridges",
      amount: 125000,
      direction: "debit",
      currency: "NGN",
      reference: `TRF/${now}005`,
      channel: "transfer",
    },
    {
      id: `sync-${now}-006`,
      connectionId,
      accountId: "acc_001",
      date: new Date(now - 3 * 86400000).toISOString(),
      description: "Bank Maintenance Fee + SMS Alert Charge",
      amount: 1562.5,
      direction: "debit",
      currency: "NGN",
      reference: `CHG/${now}006`,
    },
  ];
}

// =============================================================================
// POST /api/bank-connections/[id]/sync
// Trigger manual sync: fetch transactions & run through pipeline
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: connectionId } = await params;
    const startedAt = new Date().toISOString();

    // ── PRODUCTION: Fetch from Mono/Okra ────────────────────────────
    // const mono = new MonoClient(process.env.MONO_SECRET_KEY);
    // const raw = await mono.accounts.getTransactions(monoAccountId, {
    //   start: lastSyncAt, end: new Date().toISOString()
    // });
    // const transactions = raw.data.map(transformMonoTransaction);

    // ── DEMO: Generate sample transactions ──────────────────────────
    const transactions = generateSyncTransactions(connectionId);

    // ── Run through the full cross-module pipeline ──────────────────
    const pipelineResult = processTransactions(transactions, {
      entityId: connectionId,
      autoPost: true,
      runTaxClassification: true,
      updateBudgets: true,
      updateCashflow: true,
      bankAccountCode: "1000",
    });

    const completedAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      data: {
        id: `sync_${Date.now()}`,
        connectionId,
        startedAt,
        completedAt,
        status: pipelineResult.failed === 0 ? "success" : "partial",
        transactionsImported: pipelineResult.processed,
        transactionsSkipped: 0,
        duplicatesFound: pipelineResult.duplicatesSkipped,
        // Full pipeline summary
        pipeline: {
          total: pipelineResult.total,
          processed: pipelineResult.processed,
          failed: pipelineResult.failed,
          summary: pipelineResult.summary,
          // Per-transaction details
          details: pipelineResult.results.map((r) => ({
            bankTxId: r.bankTransactionId,
            journalId: r.accounting.journalId,
            category: r.classification.categoryLabel,
            nature: r.classification.nature,
            confidence: Math.round(r.classification.confidence * 100),
            taxClassifications: r.tax.classifications.length,
            budgetCategory: r.budgeting.categoryMatch,
            warnings: r.warnings,
          })),
        },
      },
    });
  } catch (error) {
    console.error("Failed to sync connection:", error);
    return NextResponse.json(
      { success: false, error: "Failed to sync connection" },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/bank-connections/[id]/sync
// Get sync history for a connection
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: connectionId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    // TODO: Verify user owns this connection
    // const user = await getAuthenticatedUser(request);
    // const connection = await db.bankConnections.findFirst({
    //   where: { id: connectionId, userId: user.id }
    // });
    // if (!connection) throw new Error("Connection not found");

    // TODO: Fetch sync history from database
    // const history = await db.syncHistory.findMany({
    //   where: { connectionId },
    //   orderBy: { startedAt: 'desc' },
    //   take: limit
    // });

    // Mock response
    const mockHistory = [
      {
        id: `sync_${Date.now() - 3600000}`,
        connectionId,
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        completedAt: new Date(Date.now() - 3598000).toISOString(),
        status: "success",
        transactionsImported: 12,
        transactionsSkipped: 1,
        duplicatesFound: 0,
      },
      {
        id: `sync_${Date.now() - 86400000}`,
        connectionId,
        startedAt: new Date(Date.now() - 86400000).toISOString(),
        completedAt: new Date(Date.now() - 86398000).toISOString(),
        status: "success",
        transactionsImported: 8,
        transactionsSkipped: 0,
        duplicatesFound: 2,
      },
    ];

    return NextResponse.json({
      success: true,
      data: mockHistory.slice(0, limit),
    });
  } catch (error) {
    console.error("Failed to get sync history:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get sync history" },
      { status: 500 }
    );
  }
}
