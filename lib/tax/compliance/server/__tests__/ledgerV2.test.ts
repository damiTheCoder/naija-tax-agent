import { beforeEach, describe, expect, test } from "vitest";
import type { JournalEntry } from "@/lib/accounting/doubleEntry";
import { prisma } from "@/lib/server/prisma";
import { computeVatFromMode, taxScheduleRepo, taxTransactionRepo } from "@/lib/tax/compliance/server/repositories";

const ENTITY_ID = "entity-test-v2";

const makeJournal = (overrides: Partial<JournalEntry>): JournalEntry => {
  const now = new Date().toISOString();
  return {
    id: overrides.id || `jr-${Math.random().toString(36).slice(2, 8)}`,
    date: overrides.date || "2026-02-15",
    narration: overrides.narration || "Test journal",
    lines: overrides.lines || [],
    isBalanced: true,
    totalDebits: overrides.totalDebits || 0,
    totalCredits: overrides.totalCredits || 0,
    transactionType: overrides.transactionType || "other",
    status: overrides.status || "posted",
    createdAt: overrides.createdAt || now,
    metadata: overrides.metadata,
    reference: overrides.reference,
    source: overrides.source,
    assumptions: overrides.assumptions,
    anomalyFlag: overrides.anomalyFlag,
    confidence: overrides.confidence,
    reasoning: overrides.reasoning,
    postedAt: overrides.postedAt,
    updatedAt: overrides.updatedAt,
    reconciliationStatus: overrides.reconciliationStatus,
    matchedBankTransactionId: overrides.matchedBankTransactionId,
  };
};

const cleanupEntity = async (entityId: string) => {
  await prisma.taxLedgerEntry.deleteMany({ where: { entityId } });
  await prisma.taxSchedule.deleteMany({ where: { entityId } });
  await prisma.complianceStatus.deleteMany({ where: { entityId } });
  await prisma.taxClassification.deleteMany({ where: { entityId } });
  await prisma.taxPayment.deleteMany({ where: { entityId } });
  await prisma.taxReconciliation.deleteMany({ where: { entityId } });
  await prisma.auditLog.deleteMany({ where: { entityId } });
  await prisma.taxSyncRun.deleteMany({ where: { entityId } });
  await prisma.transaction.deleteMany({ where: { entityId } });
  await prisma.taxPeriod.deleteMany({ where: { entityId } });
  await prisma.taxRuleSet.deleteMany({ where: { entityId } });
  await prisma.taxEngineSetting.deleteMany({ where: { entityId } });
  await prisma.entity.deleteMany({ where: { id: entityId } });
};

beforeEach(async () => {
  await cleanupEntity(ENTITY_ID);
});

describe("tax v2 ledger-first engine", () => {
  test("VAT mode math for inclusive/exclusive", () => {
    const exclusive = computeVatFromMode(116000, 0.075, "exclusive");
    expect(exclusive.baseAmount).toBe(116000);
    expect(exclusive.vatAmount).toBe(8700);

    const inclusive = computeVatFromMode(116000, 0.075, "inclusive");
    expect(inclusive.baseAmount).toBeCloseTo(107906.98, 2);
    expect(inclusive.vatAmount).toBeCloseTo(8093.02, 2);
  });

  test("journal sync is idempotent and produces expected VAT/WHT balances", async () => {
    const journals: JournalEntry[] = [
      makeJournal({
        id: "sale-001",
        date: "2026-02-10",
        narration: "Customer payment VAT sale",
        transactionType: "sale",
        totalDebits: 499875,
        totalCredits: 499875,
        lines: [
          { accountCode: "1020", accountName: "Bank", debit: 499875, credit: 0 },
          { accountCode: "4000", accountName: "Sales", debit: 0, credit: 465000 },
          { accountCode: "2200", accountName: "Output VAT Payable", debit: 0, credit: 34875 },
        ],
        metadata: { taxMode: "exclusive", taxCategory: "revenue" },
      }),
      makeJournal({
        id: "expense-001",
        date: "2026-02-12",
        narration: "Office supplies purchase",
        transactionType: "expense",
        totalDebits: 124700,
        totalCredits: 124700,
        lines: [
          { accountCode: "5820", accountName: "Office Supplies", debit: 116000, credit: 0 },
          { accountCode: "1400", accountName: "Input VAT Receivable", debit: 8700, credit: 0 },
          { accountCode: "1020", accountName: "Bank", debit: 0, credit: 124700 },
        ],
        metadata: { taxMode: "exclusive", taxCategory: "inventory" },
      }),
      makeJournal({
        id: "rent-001",
        date: "2026-02-15",
        narration: "Rent payment with withholding tax",
        transactionType: "expense",
        totalDebits: 56000,
        totalCredits: 56000,
        lines: [
          { accountCode: "5600", accountName: "Rent Expense", debit: 56000, credit: 0 },
          { accountCode: "1020", accountName: "Bank", debit: 0, credit: 50400 },
          { accountCode: "2220", accountName: "WHT Payable", debit: 0, credit: 5600 },
        ],
        metadata: { taxCategory: "rent", vatApplicable: false, whtRate: 0.1 },
      }),
    ];

    await taxTransactionRepo.upsertJournalTransactions({
      entityId: ENTITY_ID,
      journals,
      source: "backfill",
    });

    await taxTransactionRepo.upsertJournalTransactions({
      entityId: ENTITY_ID,
      journals,
      source: "backfill",
    });

    const ledgerCount = await prisma.taxLedgerEntry.count({ where: { entityId: ENTITY_ID } });
    expect(ledgerCount).toBe(4);

    const dashboard = await taxScheduleRepo.getDashboard(ENTITY_ID);
    expect(dashboard.vatPayable).toBe(34875);
    expect(dashboard.vatReceivable).toBe(12900);
    expect(dashboard.netVatPosition).toBe(21975);
    expect(dashboard.whtPayable).toBe(5600);

    const vatSchedule = await prisma.taxSchedule.findFirst({
      where: { entityId: ENTITY_ID, taxType: "VAT" },
      orderBy: { updatedAt: "desc" },
    });
    const whtSchedule = await prisma.taxSchedule.findFirst({
      where: { entityId: ENTITY_ID, taxType: "WHT" },
      orderBy: { updatedAt: "desc" },
    });

    expect(vatSchedule?.totalTax).toBe(21975);
    expect(vatSchedule?.carryForward).toBe(0);
    expect(whtSchedule?.totalTax).toBe(5600);
  });

  test("inclusive VAT expense computes WHT from pre-VAT base when tax lines are not explicit", async () => {
    const journal = makeJournal({
      id: "rent-inclusive-001",
      date: "2026-02-20",
      narration: "Paid office rent gross inclusive amount",
      transactionType: "expense",
      totalDebits: 1080000,
      totalCredits: 1080000,
      lines: [
        { accountCode: "5600", accountName: "Rent Expense", debit: 1080000, credit: 0 },
        { accountCode: "1020", accountName: "Bank", debit: 0, credit: 1080000 },
      ],
      metadata: {
        taxMode: "inclusive",
        taxCategory: "rent",
        vatApplicable: true,
        whtApplicable: true,
        whtRate: 0.1,
      },
    });

    await taxTransactionRepo.upsertJournalTransactions({
      entityId: ENTITY_ID,
      journals: [journal],
      source: "live_posting",
    });

    const vatInput = await prisma.taxLedgerEntry.findUnique({
      where: { id: `tle-${ENTITY_ID}-${journal.id}-VAT-input` },
    });
    const whtPayable = await prisma.taxLedgerEntry.findUnique({
      where: { id: `tle-${ENTITY_ID}-${journal.id}-WHT-payable` },
    });

    expect(vatInput?.taxAmount || 0).toBeCloseTo(-75348.84, 2);
    expect(whtPayable?.baseAmount || 0).toBeCloseTo(1004651.16, 2);
    expect(whtPayable?.taxAmount || 0).toBeCloseTo(100465.12, 2);
  });

  test("resync rewrites VAT/WHT entries canonically and removes stale legacy rows", async () => {
    const journal = makeJournal({
      id: "canon-001",
      date: "2026-02-22",
      narration: "Canonical rewrite check",
      transactionType: "sale",
      totalDebits: 215000,
      totalCredits: 215000,
      lines: [
        { accountCode: "1020", accountName: "Bank", debit: 215000, credit: 0 },
        { accountCode: "4000", accountName: "Sales", debit: 0, credit: 200000 },
        { accountCode: "2200", accountName: "Output VAT Payable", debit: 0, credit: 15000 },
      ],
      metadata: { taxMode: "exclusive", taxCategory: "revenue" },
    });

    await taxTransactionRepo.upsertJournalTransactions({
      entityId: ENTITY_ID,
      journals: [journal],
      source: "live_posting",
    });

    const txId = `tx-${ENTITY_ID}-${journal.id}`;
    const canonicalVat = await prisma.taxLedgerEntry.findUnique({
      where: { id: `tle-${ENTITY_ID}-${journal.id}-VAT-output` },
    });
    expect(canonicalVat).not.toBeNull();

    await prisma.taxLedgerEntry.create({
      data: {
        id: `legacy-${ENTITY_ID}-${journal.id}-WHT-old`,
        entityId: ENTITY_ID,
        transactionId: txId,
        taxType: "WHT",
        ruleSetId: canonicalVat!.ruleSetId,
        periodId: canonicalVat!.periodId,
        baseAmount: 200000,
        taxAmount: 10000,
        direction: "payable",
        ledger: "output",
        metadata: "{}",
      },
    });
    await prisma.taxClassification.create({
      data: {
        id: `legacy-${ENTITY_ID}-${journal.id}-cls-WHT-old`,
        entityId: ENTITY_ID,
        transactionId: txId,
        taxType: "WHT",
        status: "auto",
        confidence: 0.5,
      },
    });

    await taxTransactionRepo.upsertJournalTransactions({
      entityId: ENTITY_ID,
      journals: [journal],
      source: "live_posting",
    });

    const finalLedger = await prisma.taxLedgerEntry.findMany({
      where: {
        entityId: ENTITY_ID,
        transactionId: txId,
        OR: [{ taxType: "VAT" }, { taxType: "WHT" }],
      },
      orderBy: { id: "asc" },
    });
    const finalClassifications = await prisma.taxClassification.findMany({
      where: {
        entityId: ENTITY_ID,
        transactionId: txId,
        OR: [{ taxType: "VAT" }, { taxType: "WHT" }],
      },
      orderBy: { id: "asc" },
    });

    expect(finalLedger.map((item) => item.id)).toEqual([`tle-${ENTITY_ID}-${journal.id}-VAT-output`]);
    expect(finalClassifications.map((item) => item.id)).toEqual([`cls-${ENTITY_ID}-${journal.id}-VAT-output`]);
  });

  test("voided journal removes persisted VAT/WHT effects", async () => {
    const journalId = "sale-void-001";
    await taxTransactionRepo.upsertJournalTransactions({
      entityId: ENTITY_ID,
      journals: [
        makeJournal({
          id: journalId,
          date: "2026-02-11",
          narration: "Sale to void",
          transactionType: "sale",
          totalDebits: 215000,
          totalCredits: 215000,
          lines: [
            { accountCode: "1020", accountName: "Bank", debit: 215000, credit: 0 },
            { accountCode: "4000", accountName: "Sales", debit: 0, credit: 200000 },
            { accountCode: "2200", accountName: "Output VAT Payable", debit: 0, credit: 15000 },
          ],
          metadata: { taxMode: "exclusive", taxCategory: "revenue" },
        }),
      ],
      source: "live_posting",
    });

    await taxTransactionRepo.upsertJournalTransactions({
      entityId: ENTITY_ID,
      journals: [
        makeJournal({
          id: journalId,
          date: "2026-02-11",
          narration: "Sale to void",
          transactionType: "sale",
          status: "voided",
          totalDebits: 215000,
          totalCredits: 215000,
          lines: [
            { accountCode: "1020", accountName: "Bank", debit: 215000, credit: 0 },
            { accountCode: "4000", accountName: "Sales", debit: 0, credit: 200000 },
            { accountCode: "2200", accountName: "Output VAT Payable", debit: 0, credit: 15000 },
          ],
          metadata: { taxMode: "exclusive", taxCategory: "revenue" },
        }),
      ],
      source: "live_posting",
    });

    const ledgerCount = await prisma.taxLedgerEntry.count({ where: { entityId: ENTITY_ID } });
    expect(ledgerCount).toBe(0);

    const dashboard = await taxScheduleRepo.getDashboard(ENTITY_ID);
    expect(dashboard.vatPayable).toBe(0);
    expect(dashboard.whtPayable).toBe(0);
  });

  test("full sync prunes accounting transactions that no longer exist locally", async () => {
    const journal = makeJournal({
      id: "sync-prune-001",
      date: "2026-02-24",
      narration: "Sale for full-sync prune test",
      transactionType: "sale",
      totalDebits: 107500,
      totalCredits: 107500,
      lines: [
        { accountCode: "1020", accountName: "Bank", debit: 107500, credit: 0 },
        { accountCode: "4000", accountName: "Sales", debit: 0, credit: 100000 },
        { accountCode: "2200", accountName: "Output VAT Payable", debit: 0, credit: 7500 },
      ],
      metadata: { taxMode: "exclusive", taxCategory: "revenue" },
    });

    await taxTransactionRepo.upsertJournalTransactions({
      entityId: ENTITY_ID,
      journals: [journal],
      source: "live_posting",
    });

    const prune = await taxTransactionRepo.upsertJournalTransactions({
      entityId: ENTITY_ID,
      journals: [],
      source: "live_posting",
      fullSync: true,
    });

    expect(prune.upsertedTransactions).toBe(0);
    expect(prune.prunedTransactions).toBe(1);
    const ledgerCount = await prisma.taxLedgerEntry.count({ where: { entityId: ENTITY_ID } });
    expect(ledgerCount).toBe(0);
  });

  test("full sync also prunes legacy manual-source journal-linked transactions", async () => {
    const journal = makeJournal({
      id: "sync-prune-legacy-manual-001",
      date: "2026-02-24",
      narration: "Legacy manual source transaction",
      transactionType: "sale",
      totalDebits: 107500,
      totalCredits: 107500,
      lines: [
        { accountCode: "1020", accountName: "Bank", debit: 107500, credit: 0 },
        { accountCode: "4000", accountName: "Sales", debit: 0, credit: 100000 },
        { accountCode: "2200", accountName: "Output VAT Payable", debit: 0, credit: 7500 },
      ],
      metadata: { taxMode: "exclusive", taxCategory: "revenue" },
    });

    await taxTransactionRepo.upsertJournalTransactions({
      entityId: ENTITY_ID,
      journals: [journal],
      source: "live_posting",
    });

    await prisma.transaction.update({
      where: { id: `tx-${ENTITY_ID}-${journal.id}` },
      data: { source: "manual" },
    });

    const prune = await taxTransactionRepo.upsertJournalTransactions({
      entityId: ENTITY_ID,
      journals: [],
      source: "live_posting",
      fullSync: true,
    });

    expect(prune.upsertedTransactions).toBe(0);
    expect(prune.prunedTransactions).toBe(1);
    const ledgerCount = await prisma.taxLedgerEntry.count({ where: { entityId: ENTITY_ID } });
    expect(ledgerCount).toBe(0);
  });

  test("category rules still apply when legacy metadata booleans are false without manual override", async () => {
    const journal = makeJournal({
      id: "legacy-bool-001",
      date: "2026-02-25",
      narration: "Paid office rent",
      transactionType: "expense",
      totalDebits: 1080000,
      totalCredits: 1080000,
      lines: [
        { accountCode: "5600", accountName: "Rent Expense", debit: 1080000, credit: 0 },
        { accountCode: "1020", accountName: "Bank", debit: 0, credit: 1080000 },
      ],
      metadata: {
        taxCategory: "expense",
        vatApplicable: false,
        whtApplicable: false,
      },
    });

    await taxTransactionRepo.upsertJournalTransactions({
      entityId: ENTITY_ID,
      journals: [journal],
      source: "live_posting",
    });

    const vatInput = await prisma.taxLedgerEntry.findUnique({
      where: { id: `tle-${ENTITY_ID}-${journal.id}-VAT-input` },
    });
    const whtPayable = await prisma.taxLedgerEntry.findUnique({
      where: { id: `tle-${ENTITY_ID}-${journal.id}-WHT-payable` },
    });

    expect(vatInput).not.toBeNull();
    expect(whtPayable).not.toBeNull();
    expect(vatInput?.taxAmount || 0).toBeLessThan(0);
    expect(whtPayable?.taxAmount || 0).toBeGreaterThan(0);
  });

  test("manual false override keeps VAT/WHT disabled", async () => {
    const journal = makeJournal({
      id: "manual-disable-001",
      date: "2026-02-26",
      narration: "Rent with manual tax disable",
      transactionType: "expense",
      totalDebits: 56000,
      totalCredits: 56000,
      lines: [
        { accountCode: "5600", accountName: "Rent Expense", debit: 56000, credit: 0 },
        { accountCode: "1020", accountName: "Bank", debit: 0, credit: 56000 },
      ],
      metadata: {
        taxCategory: "rent",
        vatApplicable: false,
        vatApplicableManual: true,
        whtApplicable: false,
        whtApplicableManual: true,
      },
    });

    await taxTransactionRepo.upsertJournalTransactions({
      entityId: ENTITY_ID,
      journals: [journal],
      source: "live_posting",
    });

    const taxRows = await prisma.taxLedgerEntry.findMany({
      where: {
        entityId: ENTITY_ID,
        transactionId: `tx-${ENTITY_ID}-${journal.id}`,
      },
    });
    expect(taxRows.length).toBe(0);
  });

  test("report mode previews tax sync without applying writes", async () => {
    const journal = makeJournal({
      id: "report-mode-001",
      date: "2026-03-01",
      narration: "Report mode sale preview",
      transactionType: "sale",
      totalDebits: 107500,
      totalCredits: 107500,
      lines: [
        { accountCode: "1020", accountName: "Bank", debit: 107500, credit: 0 },
        { accountCode: "4000", accountName: "Sales", debit: 0, credit: 100000 },
        { accountCode: "2200", accountName: "Output VAT Payable", debit: 0, credit: 7500 },
      ],
      metadata: { taxMode: "exclusive", taxCategory: "revenue" },
    });

    const report = await taxTransactionRepo.upsertJournalTransactions({
      entityId: ENTITY_ID,
      journals: [journal],
      source: "backfill",
      mode: "report",
    });

    expect(report.reportOnly).toBe(true);
    expect(report.upsertedTransactions).toBe(0);
    expect(report.report?.wouldUpsertTransactions).toBe(1);

    const ledgerCount = await prisma.taxLedgerEntry.count({ where: { entityId: ENTITY_ID } });
    expect(ledgerCount).toBe(0);

    const syncRun = await prisma.taxSyncRun.findUnique({ where: { id: report.syncRunId } });
    expect(syncRun).not.toBeNull();
    expect(syncRun?.mode).toBe("report");
  });

  test("apply mode reports duplicates pruned and stale rows removed", async () => {
    const journal = makeJournal({
      id: "integrity-counts-001",
      date: "2026-03-01",
      narration: "Integrity count sample",
      transactionType: "sale",
      totalDebits: 107500,
      totalCredits: 107500,
      lines: [
        { accountCode: "1020", accountName: "Bank", debit: 107500, credit: 0 },
        { accountCode: "4000", accountName: "Sales", debit: 0, credit: 100000 },
        { accountCode: "2200", accountName: "Output VAT Payable", debit: 0, credit: 7500 },
      ],
      metadata: { taxMode: "exclusive", taxCategory: "revenue" },
    });

    await taxTransactionRepo.upsertJournalTransactions({
      entityId: ENTITY_ID,
      journals: [journal],
      source: "live_posting",
    });

    const canonicalTxId = `tx-${ENTITY_ID}-${journal.id}`;
    const canonicalVat = await prisma.taxLedgerEntry.findUnique({
      where: { id: `tle-${ENTITY_ID}-${journal.id}-VAT-output` },
    });
    expect(canonicalVat).not.toBeNull();

    await prisma.transaction.create({
      data: {
        id: `legacy-dup-${journal.id}`,
        entityId: ENTITY_ID,
        date: new Date("2026-03-01T00:00:00.000Z"),
        description: "Legacy duplicate",
        amount: 100000,
        currency: "NGN",
        type: "sale",
        source: "manual",
        status: "posted",
        metadata: JSON.stringify({ journalId: journal.id }),
      },
    });

    const duplicateRun = await taxTransactionRepo.upsertJournalTransactions({
      entityId: ENTITY_ID,
      journals: [journal],
      source: "live_posting",
    });
    expect(duplicateRun.duplicatesPruned).toBeGreaterThanOrEqual(1);

    await taxTransactionRepo.upsertJournalTransactions({
      entityId: ENTITY_ID,
      journals: [
        makeJournal({
          id: journal.id,
          date: journal.date,
          narration: journal.narration,
          transactionType: journal.transactionType,
          status: "voided",
          totalDebits: journal.totalDebits,
          totalCredits: journal.totalCredits,
          lines: journal.lines,
          metadata: journal.metadata,
        }),
      ],
      source: "live_posting",
    });

    await prisma.taxLedgerEntry.create({
      data: {
        id: `stale-${journal.id}-VAT-output`,
        entityId: ENTITY_ID,
        transactionId: canonicalTxId,
        taxType: "VAT",
        ruleSetId: canonicalVat!.ruleSetId,
        periodId: canonicalVat!.periodId,
        baseAmount: 100000,
        taxAmount: 7500,
        direction: "payable",
        ledger: "output",
        metadata: "{}",
      },
    });

    const staleCleanupRun = await taxTransactionRepo.upsertJournalTransactions({
      entityId: ENTITY_ID,
      journals: [],
      source: "live_posting",
      fullSync: true,
    });

    expect(staleCleanupRun.staleRowsRemoved).toBeGreaterThanOrEqual(1);
    const staleRow = await prisma.taxLedgerEntry.findUnique({
      where: { id: `stale-${journal.id}-VAT-output` },
    });
    expect(staleRow).toBeNull();
  });
});
