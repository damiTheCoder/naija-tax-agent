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
    expect(ledgerCount).toBe(3);

    const dashboard = await taxScheduleRepo.getDashboard(ENTITY_ID);
    expect(dashboard.vatPayable).toBe(34875);
    expect(dashboard.vatReceivable).toBe(8700);
    expect(dashboard.netVatPosition).toBe(26175);
    expect(dashboard.whtPayable).toBe(5600);

    const vatSchedule = await prisma.taxSchedule.findFirst({
      where: { entityId: ENTITY_ID, taxType: "VAT" },
      orderBy: { updatedAt: "desc" },
    });
    const whtSchedule = await prisma.taxSchedule.findFirst({
      where: { entityId: ENTITY_ID, taxType: "WHT" },
      orderBy: { updatedAt: "desc" },
    });

    expect(vatSchedule?.totalTax).toBe(26175);
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
});
