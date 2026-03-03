import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

const REQUIRED_DELEGATES = [
  "accountingJournal",
  "vendor",
  "bill",
  "approvalRequest",
  "periodLock",
  "recurringTemplate",
  "exchangeRate",
  "trackingClass",
  "trackingLocation",
  "actionExecutionLog",
  "chatConversation",
  "chatMessage",
  "taxSyncRun",
] as const;

export async function GET(): Promise<NextResponse> {
  const prismaRecord = prisma as unknown as Record<string, unknown>;
  const missing = REQUIRED_DELEGATES.filter((name) => !(name in prismaRecord) || !prismaRecord[name]);

  const checks: Array<{ check: string; ok: boolean; detail: string }> = [];

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ check: "database", ok: true, detail: "SQLite connection ok" });
  } catch (error) {
    checks.push({
      check: "database",
      ok: false,
      detail: error instanceof Error ? error.message : "Database connection failed",
    });
  }

  checks.push({
    check: "prisma_delegates",
    ok: missing.length === 0,
    detail: missing.length === 0 ? "All required delegates loaded" : `Missing: ${missing.join(", ")}`,
  });

  const ok = checks.every((item) => item.ok);

  let latestTaxSyncRun: {
    id: string;
    entityId: string;
    source: string;
    mode: string;
    status: string;
    createdAt: string;
    duplicatesPruned: number;
    staleRowsRemoved: number;
  } | null = null;
  try {
    const latest = await prisma.taxSyncRun.findFirst({
      where: { entityId: "entity-default" },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        entityId: true,
        source: true,
        mode: true,
        status: true,
        createdAt: true,
        duplicatesPruned: true,
        staleRowsRemoved: true,
      },
    });
    latestTaxSyncRun = latest
      ? {
          ...latest,
          createdAt: latest.createdAt.toISOString(),
        }
      : null;
  } catch {
    latestTaxSyncRun = null;
  }

  return NextResponse.json(
    {
      success: ok,
      status: ok ? "healthy" : "degraded",
      checks,
      latestTaxSyncRun,
      remediation:
        ok
          ? null
          : "Run `npx prisma generate` and restart the Next.js server process to refresh Prisma model delegates.",
    },
    { status: ok ? 200 : 503 }
  );
}
