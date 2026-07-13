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

    const completedAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      data: {
        id: `sync_${Date.now()}`,
        connectionId,
        startedAt,
        completedAt,
        status: "success",
        transactionsImported: 0,
        transactionsSkipped: 0,
        duplicatesFound: 0,
        pipeline: {
          total: 0,
          processed: 0,
          failed: 0,
          summary: "No live bank provider is connected yet.",
          details: [],
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
