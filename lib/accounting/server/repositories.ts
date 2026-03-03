import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/server/prisma";
import type { JournalEntry, JournalLine } from "@/lib/accounting/doubleEntry";
import { taxTransactionRepo } from "@/lib/tax/compliance/server";
import { accountingFeatureFlags } from "./flags";
import type {
  AccountingMigrationResult,
  AccountingMigrationSnapshot,
  ActionReceipt,
  BillApprovalInput,
  BillDraftInput,
  BillPaymentInput,
  BillSubmitInput,
  JournalPostInput,
  PeriodLockState,
  RecurringRunResult,
  RecurringTemplateInput,
  WorkflowRole,
} from "./types";
import {
  addCadence,
  ensureEntity,
  fingerprintObject,
  generateDeterministicId,
  hasRoleAtLeast,
  normalizeCurrency,
  normalizeEntityId,
  normalizeRole,
  round2,
  safeJsonParse,
  safeJsonStringify,
  toDate,
  toIsoDate,
  toMonthlyPeriod,
  toQuarterlyPeriod,
} from "./utils";

const DEFAULT_AP_ACCOUNT_CODE = "2000";
const DEFAULT_AP_ACCOUNT_NAME = "Accounts Payable";
const DEFAULT_EXPENSE_ACCOUNT_CODE = "5000";
const DEFAULT_EXPENSE_ACCOUNT_NAME = "Operating Expenses";
const DEFAULT_BANK_ACCOUNT_CODE = "1020";
const DEFAULT_BANK_ACCOUNT_NAME = "Bank - Current Account";

const ensurePrismaModel = <K extends keyof typeof prisma>(key: K): NonNullable<(typeof prisma)[K]> => {
  const delegate = prisma[key];
  if (!delegate) {
    throw new Error(
      `Prisma model delegate '${String(
        key
      )}' is unavailable. Run 'npx prisma generate', then restart the server process.`
    );
  }
  return delegate as NonNullable<(typeof prisma)[K]>;
};

const toJournalLinesPayload = (lines: JournalLine[]) =>
  lines.map((line) => ({
    accountCode: String(line.accountCode || "").trim(),
    accountName: String(line.accountName || "").trim(),
    debit: round2(Math.max(0, Number(line.debit) || 0)),
    credit: round2(Math.max(0, Number(line.credit) || 0)),
    memo: line.memo || undefined,
  }));

const assertBalancedLines = (lines: JournalLine[]) => {
  const totalDebits = round2(lines.reduce((sum, line) => sum + Math.max(0, Number(line.debit) || 0), 0));
  const totalCredits = round2(lines.reduce((sum, line) => sum + Math.max(0, Number(line.credit) || 0), 0));
  const diff = Math.abs(totalDebits - totalCredits);
  if (diff > 0.01) {
    throw new Error(`Journal is not balanced (debits ${totalDebits}, credits ${totalCredits})`);
  }
  return { totalDebits, totalCredits };
};

const normalizeBillStatus = (status?: string) => {
  const raw = (status || "").trim().toLowerCase();
  if (raw === "voided") return "voided";
  if (raw === "paid") return "paid";
  if (raw === "received") return "received";
  return "draft";
};

const mapJournalToTax = (journal: {
  id: string;
  date: Date;
  narration: string;
  reference: string | null;
  status: string;
  lines: Array<{
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    memo: string | null;
  }>;
  metadata: string | null;
}): JournalEntry => ({
  id: journal.id,
  date: journal.date.toISOString().slice(0, 10),
  narration: journal.narration,
  reference: journal.reference || undefined,
  lines: journal.lines.map((line) => ({
    accountCode: line.accountCode,
    accountName: line.accountName,
    debit: round2(line.debit),
    credit: round2(line.credit),
    memo: line.memo || undefined,
  })),
  isBalanced: true,
  totalDebits: round2(journal.lines.reduce((sum, line) => sum + (line.debit || 0), 0)),
  totalCredits: round2(journal.lines.reduce((sum, line) => sum + (line.credit || 0), 0)),
  transactionType: "other",
  createdAt: new Date().toISOString(),
  status: journal.status === "voided" ? "voided" : "posted",
  metadata: safeJsonParse<Record<string, unknown>>(journal.metadata, {}),
});

const buildActionReceipt = (params: {
  actionType: string;
  entityId: string;
  resourceType: string;
  resourceId?: string;
  journalId?: string;
  status: "success" | "failure";
  deepLink?: string;
}): ActionReceipt => {
  const actionId = `act-${Date.now()}-${randomUUID().slice(0, 8)}`;
  return {
    actionId,
    entityId: params.entityId,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    journalId: params.journalId,
    status: params.status,
    timestamp: new Date().toISOString(),
    deepLink: params.deepLink,
  };
};

const logActionReceipt = async (params: {
  receipt: ActionReceipt;
  actionType: string;
  message?: string;
  metadata?: Record<string, unknown>;
}) => {
  await prisma.actionExecutionLog.upsert({
    where: {
      entityId_actionId: {
        entityId: params.receipt.entityId,
        actionId: params.receipt.actionId,
      },
    },
    update: {
      status: params.receipt.status,
      message: params.message,
      metadata: safeJsonStringify(params.metadata || {}),
      deepLink: params.receipt.deepLink,
    },
    create: {
      entityId: params.receipt.entityId,
      actionId: params.receipt.actionId,
      actionType: params.actionType,
      resourceType: params.receipt.resourceType,
      resourceId: params.receipt.resourceId,
      journalId: params.receipt.journalId,
      status: params.receipt.status,
      message: params.message,
      deepLink: params.receipt.deepLink,
      metadata: safeJsonStringify(params.metadata || {}),
    },
  });
};

const ensureApprovalPolicy = async (entityId: string) => {
  const normalized = normalizeEntityId(entityId);
  await ensureEntity(normalized);
  return ensurePrismaModel("approvalPolicy").upsert({
    where: { entityId: normalized },
    update: {},
    create: {
      entityId: normalized,
      currency: "NGN",
      managerThreshold: 500000,
      ownerThreshold: 500000,
    },
  });
};

const getBillTotals = (lines: BillDraftInput["lines"]) => {
  const normalized = lines.map((line) => {
    const quantity = Number.isFinite(line.quantity) ? Number(line.quantity) : 1;
    const unitPrice = Number.isFinite(line.unitPrice) ? Number(line.unitPrice) : 0;
    const taxRate = Number.isFinite(line.taxRate) ? Number(line.taxRate) : 0;
    const subtotal = round2(quantity * unitPrice);
    const taxAmount = Number.isFinite(line.taxAmount) ? Number(line.taxAmount) : round2(subtotal * taxRate);
    const total = Number.isFinite(line.total) ? Number(line.total) : round2(subtotal + taxAmount);
    return {
      ...line,
      quantity,
      unitPrice,
      taxRate,
      taxAmount: round2(taxAmount),
      total: round2(total),
    };
  });

  const subtotal = round2(normalized.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
  const taxTotal = round2(normalized.reduce((sum, line) => sum + line.taxAmount, 0));
  const total = round2(normalized.reduce((sum, line) => sum + line.total, 0));

  return { lines: normalized, subtotal, taxTotal, total };
};

const resolveBillExpenseLines = (bill: {
  total: number;
  lines: Array<{ description: string; total: number; metadata: string | null }>;
}) => {
  const grouped = new Map<string, { accountCode: string; accountName: string; amount: number }>();

  for (const line of bill.lines) {
    const meta = safeJsonParse<Record<string, unknown>>(line.metadata, {});
    const accountCodeRaw = typeof meta.accountCode === "string" ? meta.accountCode.trim() : DEFAULT_EXPENSE_ACCOUNT_CODE;
    const accountNameRaw = typeof meta.accountName === "string" ? meta.accountName.trim() : DEFAULT_EXPENSE_ACCOUNT_NAME;
    const accountCode = accountCodeRaw || DEFAULT_EXPENSE_ACCOUNT_CODE;
    const accountName = accountNameRaw || DEFAULT_EXPENSE_ACCOUNT_NAME;
    const amount = round2(Number(line.total) || 0);
    if (amount <= 0) continue;

    const existing = grouped.get(accountCode);
    if (existing) {
      existing.amount = round2(existing.amount + amount);
    } else {
      grouped.set(accountCode, { accountCode, accountName, amount });
    }
  }

  const debitLines = Array.from(grouped.values()).map((item) => ({
    accountCode: item.accountCode,
    accountName: item.accountName,
    debit: item.amount,
    credit: 0,
  }));

  if (debitLines.length === 0) {
    debitLines.push({
      accountCode: DEFAULT_EXPENSE_ACCOUNT_CODE,
      accountName: DEFAULT_EXPENSE_ACCOUNT_NAME,
      debit: round2(bill.total),
      credit: 0,
    });
  }

  return debitLines;
};

const withRoleValidation = (actorRole?: string, requiredRole?: string) => {
  const actual = normalizeRole(actorRole);
  const required = normalizeRole(requiredRole || "manager");
  if (!hasRoleAtLeast(actual, required)) {
    throw new Error(`Approval requires ${required} role. Current role: ${actual}.`);
  }
};

const toPeriodFromDate = (date: Date) => toMonthlyPeriod(date);

const assertPeriodUnlocked = async (entityId: string, date: Date) => {
  if (!accountingFeatureFlags.periodLockEnabled()) return;
  const period = toPeriodFromDate(date);
  const lock = await ensurePrismaModel("periodLock").findUnique({ where: { entityId_period: { entityId, period } } });
  if (lock) {
    throw new Error(`Period ${period} is locked. Unlock before posting.`);
  }
};

export const accountingJournalRepo = {
  async postJournal(input: JournalPostInput) {
    const entityId = normalizeEntityId(input.entityId);
    await ensureEntity(entityId);

    const lines = toJournalLinesPayload(input.lines || []);
    if (lines.length === 0) throw new Error("Journal lines are required");
    const { totalDebits } = assertBalancedLines(lines);

    const date = toDate(input.date);
    const status = input.status || "posted";
    if (status === "posted" || status === "reversed") {
      await assertPeriodUnlocked(entityId, date);
    }

    const sourceCurrency = normalizeCurrency(input.sourceCurrency);
    const baseCurrency = normalizeCurrency(input.baseCurrency || "NGN");
    const exchangeRate = Number.isFinite(input.exchangeRate) ? Number(input.exchangeRate) : 1;
    const journalId = input.journalId || generateDeterministicId("jnl", [entityId, input.narration, date.toISOString(), totalDebits]);

    const journalHash = fingerprintObject({
      entityId,
      sourceDocType: input.sourceDocType || "manual",
      sourceDocId: input.sourceDocId || "",
      date: date.toISOString(),
      narration: input.narration,
      reference: input.reference || "",
      lines,
      metadata: input.metadata || {},
    });

    const posted = await prisma.$transaction(async (tx) => {
      const existing = await tx.accountingJournal.findUnique({ where: { id: journalId } });

      const journal = existing
        ? await tx.accountingJournal.update({
            where: { id: journalId },
            data: {
              date,
              status,
              narration: input.narration,
              reference: input.reference,
              sourceDocType: input.sourceDocType,
              sourceDocId: input.sourceDocId,
              sourceCurrency,
              baseCurrency,
              exchangeRate,
              approvalStatus: input.approvalStatus || "approved",
              approvalRequestId: input.approvalRequestId,
              trackingClassId: input.trackingClassId,
              trackingLocationId: input.trackingLocationId,
              journalHash,
              metadata: safeJsonStringify(input.metadata || {}),
            },
          })
        : await tx.accountingJournal.create({
            data: {
              id: journalId,
              entityId,
              date,
              status,
              narration: input.narration,
              reference: input.reference,
              sourceDocType: input.sourceDocType,
              sourceDocId: input.sourceDocId,
              sourceCurrency,
              baseCurrency,
              exchangeRate,
              approvalStatus: input.approvalStatus || "approved",
              approvalRequestId: input.approvalRequestId,
              trackingClassId: input.trackingClassId,
              trackingLocationId: input.trackingLocationId,
              journalHash,
              metadata: safeJsonStringify(input.metadata || {}),
            },
          });

      await tx.accountingJournalLine.deleteMany({ where: { journalId: journal.id } });
      await tx.accountingJournalLine.createMany({
        data: lines.map((line) => ({
          journalId: journal.id,
          accountCode: line.accountCode,
          accountName: line.accountName,
          debit: round2(line.debit),
          credit: round2(line.credit),
          memo: line.memo,
          sourceAmount: round2(Math.max(line.debit, line.credit)),
          baseAmount: round2(Math.max(line.debit, line.credit) * (baseCurrency === sourceCurrency ? 1 : exchangeRate)),
          metadata: safeJsonStringify({
            trackingClassId: input.trackingClassId,
            trackingLocationId: input.trackingLocationId,
          }),
        })),
      });

      const txId = generateDeterministicId("tx", [entityId, journal.id]);
      await tx.transaction.upsert({
        where: { id: txId },
        update: {
          date,
          description: input.narration,
          amount: round2(totalDebits),
          currency: sourceCurrency,
          type: typeof input.metadata?.transactionType === "string" ? String(input.metadata.transactionType) : "general",
          source: "accounting",
          status: status === "voided" ? "voided" : "posted",
          metadata: safeJsonStringify({
            journalId: journal.id,
            sourceDocType: input.sourceDocType,
            sourceDocId: input.sourceDocId,
            sourceCurrency,
            baseCurrency,
            exchangeRate,
            approvalStatus: input.approvalStatus || "approved",
            trackingClassId: input.trackingClassId,
            trackingLocationId: input.trackingLocationId,
            ...input.metadata,
          }),
          updatedAt: new Date(),
        },
        create: {
          id: txId,
          entityId,
          date,
          description: input.narration,
          amount: round2(totalDebits),
          currency: sourceCurrency,
          type: typeof input.metadata?.transactionType === "string" ? String(input.metadata.transactionType) : "general",
          source: "accounting",
          status: status === "voided" ? "voided" : "posted",
          metadata: safeJsonStringify({
            journalId: journal.id,
            sourceDocType: input.sourceDocType,
            sourceDocId: input.sourceDocId,
            sourceCurrency,
            baseCurrency,
            exchangeRate,
            approvalStatus: input.approvalStatus || "approved",
            trackingClassId: input.trackingClassId,
            trackingLocationId: input.trackingLocationId,
            ...input.metadata,
          }),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return tx.accountingJournal.findUnique({
        where: { id: journal.id },
        include: { lines: true },
      });
    });

    if (!posted) {
      throw new Error("Unable to post journal");
    }

    if (input.syncTax !== false) {
      const taxJournal = mapJournalToTax({
        id: posted.id,
        date: posted.date,
        narration: posted.narration,
        reference: posted.reference,
        status: posted.status,
        metadata: posted.metadata,
        lines: posted.lines.map((line) => ({
          accountCode: line.accountCode,
          accountName: line.accountName,
          debit: line.debit,
          credit: line.credit,
          memo: line.memo,
        })),
      });

      await taxTransactionRepo.upsertJournalTransactions({
        entityId,
        journals: [taxJournal],
        source: "live_posting",
      });
    }

    return posted;
  },

  async list(entityId: string, limit = 100) {
    const normalized = normalizeEntityId(entityId);
    return ensurePrismaModel("accountingJournal").findMany({
      where: { entityId: normalized },
      include: { lines: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: Math.max(1, Math.min(500, Math.round(limit))),
    });
  },

  async voidJournal(params: { entityId: string; journalId: string; reason?: string; actor?: string }) {
    const entityId = normalizeEntityId(params.entityId);
    const journal = await prisma.accountingJournal.findFirst({
      where: { entityId, id: params.journalId },
      include: { lines: true },
    });
    if (!journal) throw new Error("Journal not found");

    if (journal.status === "voided") {
      return {
        journal,
        reversalJournal: null,
      };
    }

    await prisma.accountingJournal.update({
      where: { id: journal.id },
      data: {
        status: "voided",
        metadata: safeJsonStringify({
          ...safeJsonParse<Record<string, unknown>>(journal.metadata, {}),
          voidReason: params.reason,
          voidedBy: params.actor || "system",
          voidedAt: new Date().toISOString(),
        }),
      },
    });

    await taxTransactionRepo.upsertJournalTransactions({
      entityId,
      journals: [
        {
          ...mapJournalToTax({
            id: journal.id,
            date: journal.date,
            narration: journal.narration,
            reference: journal.reference,
            status: "voided",
            metadata: journal.metadata,
            lines: journal.lines,
          }),
          status: "voided",
        },
      ],
      source: "live_posting",
    });

    const reversalId = `${journal.id}-reversal`;
    const reversalLines = journal.lines.map((line) => ({
      accountCode: line.accountCode,
      accountName: line.accountName,
      debit: round2(line.credit),
      credit: round2(line.debit),
      memo: line.memo || undefined,
    }));

    const reversalJournal = await accountingJournalRepo.postJournal({
      entityId,
      journalId: reversalId,
      date: journal.date.toISOString(),
      narration: `Reversal: ${journal.narration}`,
      reference: journal.reference || undefined,
      sourceDocType: "journal_reversal",
      sourceDocId: journal.id,
      sourceCurrency: journal.sourceCurrency,
      baseCurrency: journal.baseCurrency,
      exchangeRate: journal.exchangeRate,
      lines: reversalLines,
      metadata: {
        reversalOf: journal.id,
        reason: params.reason || "void",
      },
      approvalStatus: "approved",
      status: "reversed",
      syncTax: false,
    });

    return {
      journal,
      reversalJournal,
    };
  },
};

export const approvalPolicyRepo = {
  async get(entityId: string) {
    const policy = await ensureApprovalPolicy(entityId);
    return {
      id: policy.id,
      entityId: policy.entityId,
      currency: policy.currency,
      managerThreshold: round2(policy.managerThreshold),
      ownerThreshold: round2(policy.ownerThreshold),
      metadata: safeJsonParse<Record<string, unknown>>(policy.metadata, {}),
      updatedAt: policy.updatedAt.toISOString(),
    };
  },

  async save(entityId: string, input: Partial<{ managerThreshold: number; ownerThreshold: number; currency: string; metadata: Record<string, unknown> }>) {
    const normalized = normalizeEntityId(entityId);
    await ensureEntity(normalized);
    const existing = await ensureApprovalPolicy(normalized);
    const updated = await ensurePrismaModel("approvalPolicy").update({
      where: { id: existing.id },
      data: {
        managerThreshold: Number.isFinite(input.managerThreshold) ? Number(input.managerThreshold) : undefined,
        ownerThreshold: Number.isFinite(input.ownerThreshold) ? Number(input.ownerThreshold) : undefined,
        currency: input.currency ? normalizeCurrency(input.currency) : undefined,
        metadata: input.metadata ? safeJsonStringify(input.metadata) : undefined,
      },
    });
    return {
      id: updated.id,
      entityId: updated.entityId,
      currency: updated.currency,
      managerThreshold: round2(updated.managerThreshold),
      ownerThreshold: round2(updated.ownerThreshold),
      metadata: safeJsonParse<Record<string, unknown>>(updated.metadata, {}),
      updatedAt: updated.updatedAt.toISOString(),
    };
  },
};

export const approvalRequestRepo = {
  async list(params: { entityId: string; status?: string; requiredRole?: string; assignee?: string; limit?: number }) {
    const entityId = normalizeEntityId(params.entityId);
    return ensurePrismaModel("approvalRequest").findMany({
      where: {
        entityId,
        ...(params.status ? { status: params.status } : {}),
        ...(params.requiredRole ? { requiredRole: normalizeRole(params.requiredRole) } : {}),
      },
      include: {
        bill: true,
        journal: true,
      },
      orderBy: [{ requestedAt: "desc" }],
      take: Math.max(1, Math.min(200, Math.round(params.limit || 100))),
    });
  },
};

export const periodLockRepo = {
  async list(entityId: string): Promise<PeriodLockState[]> {
    const normalized = normalizeEntityId(entityId);
    const rows = await ensurePrismaModel("periodLock").findMany({
      where: { entityId: normalized },
      orderBy: [{ period: "desc" }],
    });
    return rows.map((row) => ({
      entityId: row.entityId,
      period: row.period,
      locked: true,
      lockedBy: row.lockedBy,
      lockedAt: row.lockedAt.toISOString(),
      reason: row.reason || undefined,
    }));
  },

  async lock(entityId: string, period: string, actor: string, reason?: string): Promise<PeriodLockState> {
    const normalized = normalizeEntityId(entityId);
    await ensureEntity(normalized);
    const row = await prisma.periodLock.upsert({
      where: {
        entityId_period: {
          entityId: normalized,
          period,
        },
      },
      update: {
        lockedBy: actor || "owner",
        lockedAt: new Date(),
        reason,
      },
      create: {
        entityId: normalized,
        period,
        lockedBy: actor || "owner",
        lockedAt: new Date(),
        reason,
      },
    });
    return {
      entityId: row.entityId,
      period: row.period,
      locked: true,
      lockedBy: row.lockedBy,
      lockedAt: row.lockedAt.toISOString(),
      reason: row.reason || undefined,
    };
  },

  async unlock(entityId: string, period: string) {
    const normalized = normalizeEntityId(entityId);
    await prisma.periodLock.deleteMany({
      where: {
        entityId: normalized,
        period,
      },
    });
    return {
      entityId: normalized,
      period,
      locked: false,
    };
  },
};

export const vendorRepo = {
  async list(entityId: string, search?: string) {
    const normalized = normalizeEntityId(entityId);
    return prisma.vendor.findMany({
      where: {
        entityId: normalized,
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        bills: {
          select: {
            id: true,
            status: true,
            total: true,
            date: true,
          },
        },
      },
      take: 500,
    });
  },

  async get(entityId: string, id: string) {
    const normalized = normalizeEntityId(entityId);
    const vendor = await prisma.vendor.findFirst({
      where: { entityId: normalized, id },
      include: {
        bills: {
          orderBy: [{ date: "desc" }],
          take: 100,
        },
      },
    });
    if (!vendor) throw new Error("Vendor not found");
    return vendor;
  },

  async create(entityId: string, input: Partial<{ name: string; type: string; taxId: string; email: string; phone: string; address: string }>) {
    const normalized = normalizeEntityId(entityId);
    await ensureEntity(normalized);
    const name = String(input.name || "").trim();
    if (!name) throw new Error("Vendor name is required");

    const created = await prisma.vendor.create({
      data: {
        entityId: normalized,
        name,
        type: input.type || "corporate",
        taxId: input.taxId || null,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
      },
    });

    return created;
  },

  async update(entityId: string, id: string, input: Partial<{ name: string; type: string; taxId: string; email: string; phone: string; address: string }>) {
    const normalized = normalizeEntityId(entityId);
    const existing = await prisma.vendor.findFirst({ where: { entityId: normalized, id } });
    if (!existing) throw new Error("Vendor not found");

    return prisma.vendor.update({
      where: { id: existing.id },
      data: {
        name: input.name ? String(input.name).trim() : undefined,
        type: input.type,
        taxId: input.taxId,
        email: input.email,
        phone: input.phone,
        address: input.address,
      },
    });
  },

  async remove(entityId: string, id: string) {
    const normalized = normalizeEntityId(entityId);
    const existing = await prisma.vendor.findFirst({ where: { entityId: normalized, id }, include: { bills: { select: { id: true } } } });
    if (!existing) throw new Error("Vendor not found");
    if (existing.bills.length > 0) {
      throw new Error("Cannot delete vendor with linked bills");
    }
    await prisma.vendor.delete({ where: { id: existing.id } });
    return { success: true };
  },
};

export const billRepo = {
  async list(entityId: string, status?: string) {
    const normalized = normalizeEntityId(entityId);
    return prisma.bill.findMany({
      where: {
        entityId: normalized,
        ...(status ? { status: normalizeBillStatus(status) } : {}),
      },
      include: {
        vendor: true,
        lines: true,
        payments: true,
        approvalRequests: true,
        trackingClass: true,
        trackingLocation: true,
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 500,
    });
  },

  async get(entityId: string, billId: string) {
    const normalized = normalizeEntityId(entityId);
    const bill = await prisma.bill.findFirst({
      where: { entityId: normalized, id: billId },
      include: {
        vendor: true,
        lines: true,
        payments: true,
        approvalRequests: true,
        trackingClass: true,
        trackingLocation: true,
      },
    });
    if (!bill) throw new Error("Bill not found");
    return bill;
  },

  async createDraft(input: BillDraftInput) {
    const entityId = normalizeEntityId(input.entityId);
    await ensureEntity(entityId);

    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      throw new Error("Bill lines are required");
    }

    await assertPeriodUnlocked(entityId, toDate(input.date));

    const totals = getBillTotals(input.lines);
    const vendorId = input.vendorId
      ? input.vendorId
      : input.vendorName
      ? (
          await prisma.vendor.create({
            data: {
              entityId,
              name: input.vendorName,
              type: "corporate",
            },
          })
        ).id
      : null;

    const year = toDate(input.date).getUTCFullYear();
    const sequence = await prisma.bill.count({ where: { entityId } });
    const billNo = input.billNo || `BILL-${year}-${String(sequence + 1).padStart(4, "0")}`;

    const created = await prisma.bill.create({
      data: {
        entityId,
        vendorId,
        billNo,
        date: toDate(input.date),
        dueDate: input.dueDate ? toDate(input.dueDate) : null,
        status: "draft",
        approvalStatus: "draft",
        currency: normalizeCurrency(input.currency || "NGN"),
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        trackingClassId: input.trackingClassId || null,
        trackingLocationId: input.trackingLocationId || null,
        lines: {
          create: totals.lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate,
            taxAmount: line.taxAmount,
            total: line.total,
            metadata: safeJsonStringify(line.metadata || {}),
            trackingClassId: line.trackingClassId || null,
            trackingLocationId: line.trackingLocationId || null,
          })),
        },
      },
      include: {
        vendor: true,
        lines: true,
        payments: true,
        approvalRequests: true,
        trackingClass: true,
        trackingLocation: true,
      },
    });

    return created;
  },

  async updateDraft(entityId: string, billId: string, input: Partial<Omit<BillDraftInput, "entityId">>) {
    const normalized = normalizeEntityId(entityId);
    const existing = await prisma.bill.findFirst({ where: { entityId: normalized, id: billId }, include: { lines: true } });
    if (!existing) throw new Error("Bill not found");
    if (existing.approvalStatus !== "draft" && existing.approvalStatus !== "pending_approval") {
      throw new Error("Only draft or pending bills can be updated");
    }

    let nextTotals = {
      subtotal: existing.subtotal,
      taxTotal: existing.taxTotal,
      total: existing.total,
    };

    const date = input.date ? toDate(input.date) : existing.date;
    await assertPeriodUnlocked(normalized, date);

    if (Array.isArray(input.lines) && input.lines.length > 0) {
      const totals = getBillTotals(input.lines);
      nextTotals = {
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
      };

      await prisma.$transaction(async (tx) => {
        await tx.billLine.deleteMany({ where: { billId: existing.id } });
        await tx.billLine.createMany({
          data: totals.lines.map((line) => ({
            billId: existing.id,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate,
            taxAmount: line.taxAmount,
            total: line.total,
            metadata: safeJsonStringify(line.metadata || {}),
            trackingClassId: line.trackingClassId || null,
            trackingLocationId: line.trackingLocationId || null,
          })),
        });
      });
    }

    const updated = await prisma.bill.update({
      where: { id: existing.id },
      data: {
        vendorId: input.vendorId ?? undefined,
        date,
        dueDate: input.dueDate ? toDate(input.dueDate) : undefined,
        currency: input.currency ? normalizeCurrency(input.currency) : undefined,
        subtotal: nextTotals.subtotal,
        taxTotal: nextTotals.taxTotal,
        total: nextTotals.total,
        trackingClassId: input.trackingClassId ?? undefined,
        trackingLocationId: input.trackingLocationId ?? undefined,
      },
      include: {
        vendor: true,
        lines: true,
        payments: true,
        approvalRequests: true,
        trackingClass: true,
        trackingLocation: true,
      },
    });

    return updated;
  },

  async submitForApproval(input: BillSubmitInput) {
    const entityId = normalizeEntityId(input.entityId);
    const bill = await billRepo.get(entityId, input.billId);

    if (bill.status === "voided" || bill.approvalStatus === "voided") {
      throw new Error("Cannot submit a voided bill");
    }
    if (bill.approvalStatus === "approved" || bill.approvalStatus === "paid") {
      return { bill, approvalRequest: null };
    }

    await assertPeriodUnlocked(entityId, bill.date);

    const policy = await ensureApprovalPolicy(entityId);
    const requiredRole: WorkflowRole = bill.total > policy.managerThreshold ? "owner" : "manager";

    const pending = await ensurePrismaModel("approvalRequest").findFirst({
      where: {
        entityId,
        billId: bill.id,
        status: "pending",
      },
      orderBy: { requestedAt: "desc" },
    });

    const approvalRequest = pending
      ? pending
      : await prisma.approvalRequest.create({
          data: {
            entityId,
            resourceType: "bill",
            resourceId: bill.id,
            status: "pending",
            requiredRole,
            requestedBy: input.actor || "system",
            amount: bill.total,
            currency: bill.currency,
            billId: bill.id,
            metadata: safeJsonStringify({
              billNo: bill.billNo,
              submittedAt: new Date().toISOString(),
            }),
          },
        });

    const updatedBill = await prisma.bill.update({
      where: { id: bill.id },
      data: {
        status: "received",
        approvalStatus: "pending_approval",
        submittedAt: new Date(),
      },
      include: {
        vendor: true,
        lines: true,
        payments: true,
        approvalRequests: true,
        trackingClass: true,
        trackingLocation: true,
      },
    });

    return {
      bill: updatedBill,
      approvalRequest,
    };
  },

  async approve(input: BillApprovalInput) {
    const entityId = normalizeEntityId(input.entityId);
    const bill = await billRepo.get(entityId, input.billId);

    if (bill.approvalStatus === "voided") {
      throw new Error("Cannot approve a voided bill");
    }

    await assertPeriodUnlocked(entityId, bill.date);

    const pending = await ensurePrismaModel("approvalRequest").findFirst({
      where: {
        entityId,
        billId: bill.id,
        status: "pending",
      },
      orderBy: { requestedAt: "desc" },
    });

    const policy = await ensureApprovalPolicy(entityId);
    const requiredRole = pending?.requiredRole || (bill.total > policy.managerThreshold ? "owner" : "manager");
    withRoleValidation(input.actorRole, requiredRole);

    const expenseLines = resolveBillExpenseLines({
      total: bill.total,
      lines: bill.lines,
    });

    const approvalJournal = await accountingJournalRepo.postJournal({
      entityId,
      journalId: generateDeterministicId("jnl-bill-approve", [entityId, bill.id]),
      date: bill.date.toISOString(),
      narration: `Bill approved ${bill.billNo}`,
      reference: bill.billNo,
      sourceDocType: "bill_approval",
      sourceDocId: bill.id,
      sourceCurrency: bill.currency,
      baseCurrency: "NGN",
      exchangeRate: 1,
      lines: [
        ...expenseLines,
        {
          accountCode: DEFAULT_AP_ACCOUNT_CODE,
          accountName: DEFAULT_AP_ACCOUNT_NAME,
          debit: 0,
          credit: round2(bill.total),
        },
      ],
      metadata: {
        transactionType: "purchase",
        taxCategory: "expense",
        vatApplicable: true,
        whtApplicable: true,
      },
      approvalStatus: "approved",
      trackingClassId: bill.trackingClassId || undefined,
      trackingLocationId: bill.trackingLocationId || undefined,
      status: "posted",
      syncTax: true,
    });

    if (pending) {
      await prisma.approvalRequest.update({
        where: { id: pending.id },
        data: {
          status: "approved",
          decidedBy: input.actor || "manager",
          decidedAt: new Date(),
          decisionNote: input.decisionNote,
          journalId: approvalJournal.id,
        },
      });
    }

    const updatedBill = await prisma.bill.update({
      where: { id: bill.id },
      data: {
        status: "received",
        approvalStatus: "approved",
        approvedAt: new Date(),
        approvedBy: input.actor || normalizeRole(input.actorRole),
      },
      include: {
        vendor: true,
        lines: true,
        payments: true,
        approvalRequests: true,
      },
    });

    return {
      bill: updatedBill,
      journal: approvalJournal,
      approvalRequest: pending,
    };
  },

  async pay(input: BillPaymentInput) {
    const entityId = normalizeEntityId(input.entityId);
    const bill = await billRepo.get(entityId, input.billId);

    if (bill.approvalStatus === "voided" || bill.status === "voided") {
      throw new Error("Cannot pay a voided bill");
    }
    if (bill.approvalStatus !== "approved" && bill.approvalStatus !== "paid") {
      throw new Error("Bill must be approved before payment");
    }

    const paymentDate = toDate(input.date || new Date().toISOString());
    await assertPeriodUnlocked(entityId, paymentDate);

    const totalPaid = round2(bill.payments.reduce((sum, payment) => sum + payment.amount, 0));
    const outstanding = round2(Math.max(0, bill.total - totalPaid));
    if (outstanding <= 0) {
      throw new Error("Bill is already fully paid");
    }

    const amount = round2(Number.isFinite(input.amount) ? Number(input.amount) : outstanding);
    if (amount <= 0) throw new Error("Payment amount must be positive");
    if (amount - outstanding > 0.01) {
      throw new Error(`Payment amount ${amount} exceeds outstanding ${outstanding}`);
    }

    const payment = await prisma.payment.create({
      data: {
        entityId,
        billId: bill.id,
        date: paymentDate,
        amount,
        method: input.method || "bank_transfer",
        reference: input.reference || null,
        status: "completed",
        metadata: safeJsonStringify({
          source: "bill_payment",
          actor: input.actor || "system",
        }),
      },
    });

    const paymentJournal = await accountingJournalRepo.postJournal({
      entityId,
      journalId: generateDeterministicId("jnl-bill-pay", [entityId, bill.id, payment.id]),
      date: payment.date.toISOString(),
      narration: `Bill payment ${bill.billNo}`,
      reference: payment.reference || bill.billNo,
      sourceDocType: "bill_payment",
      sourceDocId: bill.id,
      sourceCurrency: bill.currency,
      baseCurrency: "NGN",
      exchangeRate: 1,
      lines: [
        {
          accountCode: DEFAULT_AP_ACCOUNT_CODE,
          accountName: DEFAULT_AP_ACCOUNT_NAME,
          debit: amount,
          credit: 0,
        },
        {
          accountCode: input.bankAccountCode || DEFAULT_BANK_ACCOUNT_CODE,
          accountName: input.bankAccountName || DEFAULT_BANK_ACCOUNT_NAME,
          debit: 0,
          credit: amount,
        },
      ],
      metadata: {
        transactionType: "payment",
        billId: bill.id,
        paymentId: payment.id,
        vatApplicable: false,
        whtApplicable: false,
      },
      approvalStatus: "approved",
      status: "posted",
      syncTax: true,
    });

    const refreshedPayments = await prisma.payment.findMany({ where: { billId: bill.id } });
    const paidTotal = round2(refreshedPayments.reduce((sum, row) => sum + row.amount, 0));
    const isFullyPaid = paidTotal + 0.01 >= round2(bill.total);

    const updatedBill = await prisma.bill.update({
      where: { id: bill.id },
      data: {
        status: isFullyPaid ? "paid" : "received",
        approvalStatus: isFullyPaid ? "paid" : "approved",
      },
      include: {
        vendor: true,
        lines: true,
        payments: true,
        approvalRequests: true,
      },
    });

    return {
      bill: updatedBill,
      payment,
      journal: paymentJournal,
    };
  },

  async void(entityId: string, billId: string, actor?: string, reason?: string) {
    const normalized = normalizeEntityId(entityId);
    const bill = await billRepo.get(normalized, billId);

    if (bill.approvalStatus === "voided" || bill.status === "voided") {
      return {
        bill,
        voidedJournals: [],
      };
    }

    const journals = await ensurePrismaModel("accountingJournal").findMany({
      where: {
        entityId: normalized,
        sourceDocId: bill.id,
        sourceDocType: {
          in: ["bill_approval", "bill_payment"],
        },
      },
      orderBy: [{ date: "asc" }],
    });

    const voidedJournals: Array<{ journalId: string; reversalJournalId?: string | null }> = [];

    for (const journal of journals) {
      const voidResult = await accountingJournalRepo.voidJournal({
        entityId: normalized,
        journalId: journal.id,
        actor,
        reason: reason || `Voided bill ${bill.billNo}`,
      });
      voidedJournals.push({
        journalId: journal.id,
        reversalJournalId: voidResult.reversalJournal?.id || null,
      });
    }

    const updated = await prisma.bill.update({
      where: { id: bill.id },
      data: {
        status: "voided",
        approvalStatus: "voided",
        voidedAt: new Date(),
        voidReason: reason || "Voided",
      },
      include: {
        vendor: true,
        lines: true,
        payments: true,
        approvalRequests: true,
      },
    });

    return {
      bill: updated,
      voidedJournals,
    };
  },
};

export const recurringRepo = {
  async listTemplates(entityId: string) {
    const normalized = normalizeEntityId(entityId);
    return ensurePrismaModel("recurringTemplate").findMany({
      where: { entityId: normalized },
      orderBy: [{ createdAt: "desc" }],
      include: {
        runs: {
          orderBy: [{ runAt: "desc" }],
          take: 10,
        },
      },
      take: 300,
    });
  },

  async getTemplate(entityId: string, templateId: string) {
    const normalized = normalizeEntityId(entityId);
    const template = await ensurePrismaModel("recurringTemplate").findFirst({
      where: { entityId: normalized, id: templateId },
      include: {
        runs: {
          orderBy: [{ runAt: "desc" }],
          take: 50,
        },
      },
    });
    if (!template) throw new Error("Recurring template not found");
    return template;
  },

  async createTemplate(input: RecurringTemplateInput) {
    const entityId = normalizeEntityId(input.entityId);
    await ensureEntity(entityId);

    return prisma.recurringTemplate.create({
      data: {
        entityId,
        name: input.name,
        resourceType: input.resourceType,
        frequency: input.frequency,
        startDate: toDate(input.startDate),
        endDate: input.endDate ? toDate(input.endDate) : null,
        nextRunAt: input.nextRunAt ? toDate(input.nextRunAt) : toDate(input.startDate),
        status: "active",
        payload: safeJsonStringify(input.payload),
        createdBy: input.createdBy || "system",
      },
    });
  },

  async updateTemplate(entityId: string, templateId: string, input: Partial<RecurringTemplateInput>) {
    const normalized = normalizeEntityId(entityId);
    const existing = await ensurePrismaModel("recurringTemplate").findFirst({ where: { entityId: normalized, id: templateId } });
    if (!existing) throw new Error("Recurring template not found");

    return prisma.recurringTemplate.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        resourceType: input.resourceType,
        frequency: input.frequency,
        startDate: input.startDate ? toDate(input.startDate) : undefined,
        endDate: input.endDate ? toDate(input.endDate) : undefined,
        nextRunAt: input.nextRunAt ? toDate(input.nextRunAt) : undefined,
        payload: input.payload ? safeJsonStringify(input.payload) : undefined,
      },
    });
  },

  async deleteTemplate(entityId: string, templateId: string) {
    const normalized = normalizeEntityId(entityId);
    const existing = await ensurePrismaModel("recurringTemplate").findFirst({ where: { entityId: normalized, id: templateId } });
    if (!existing) throw new Error("Recurring template not found");
    await prisma.recurringTemplate.delete({ where: { id: existing.id } });
    return { success: true };
  },

  async runDue(entityId: string, runAt?: string): Promise<RecurringRunResult> {
    const normalized = normalizeEntityId(entityId);
    const cursorDate = toDate(runAt || new Date().toISOString());

    const templates = await ensurePrismaModel("recurringTemplate").findMany({
      where: {
        entityId: normalized,
        status: "active",
        nextRunAt: { lte: cursorDate },
      },
      orderBy: [{ nextRunAt: "asc" }],
      take: 200,
    });

    let generated = 0;
    let skipped = 0;
    let failed = 0;
    const details: RecurringRunResult["details"] = [];

    for (const template of templates) {
      const periodKey = template.frequency === "quarterly" ? toQuarterlyPeriod(cursorDate) : toMonthlyPeriod(cursorDate);
      const existingRun = await prisma.recurringRun.findFirst({
        where: {
          entityId: normalized,
          templateId: template.id,
          periodKey,
        },
      });

      if (existingRun) {
        skipped += 1;
        details.push({
          templateId: template.id,
          status: "skipped",
          message: "Run already exists for period",
          resourceType: template.resourceType,
          resourceId: existingRun.resourceId || undefined,
          journalId: existingRun.journalId || undefined,
        });
        continue;
      }

      try {
        const lock = await ensurePrismaModel("periodLock").findUnique({
          where: {
            entityId_period: {
              entityId: normalized,
              period: template.frequency === "quarterly" ? toQuarterlyPeriod(cursorDate) : toMonthlyPeriod(cursorDate),
            },
          },
        });

        if (lock) {
          await prisma.recurringRun.create({
            data: {
              entityId: normalized,
              templateId: template.id,
              periodKey,
              status: "skipped",
              resourceType: template.resourceType,
              idempotencyKey: generateDeterministicId("rr", [normalized, template.id, periodKey]),
              error: `Period ${lock.period} is locked`,
            },
          });
          skipped += 1;
          details.push({
            templateId: template.id,
            status: "skipped",
            message: `Period ${lock.period} is locked`,
            resourceType: template.resourceType,
          });
          continue;
        }

        const payload = safeJsonParse<Record<string, unknown>>(template.payload, {});
        let resourceId: string | undefined;
        let journalId: string | undefined;

        if (template.resourceType === "bill") {
          const billPayload = (payload.bill || payload) as Record<string, unknown>;
          const bill = await billRepo.createDraft({
            entityId: normalized,
            vendorId: typeof billPayload.vendorId === "string" ? billPayload.vendorId : undefined,
            vendorName: typeof billPayload.vendorName === "string" ? billPayload.vendorName : undefined,
            date: typeof billPayload.date === "string" ? billPayload.date : toIsoDate(cursorDate.toISOString()),
            dueDate: typeof billPayload.dueDate === "string" ? billPayload.dueDate : undefined,
            currency: typeof billPayload.currency === "string" ? billPayload.currency : "NGN",
            lines: Array.isArray(billPayload.lines)
              ? (billPayload.lines as Array<Record<string, unknown>>).map((line) => ({
                  description: typeof line.description === "string" ? line.description : "Recurring bill line",
                  quantity: Number(line.quantity) || 1,
                  unitPrice: Number(line.unitPrice) || 0,
                  taxRate: Number.isFinite(Number(line.taxRate)) ? Number(line.taxRate) : 0,
                  taxAmount: Number.isFinite(Number(line.taxAmount)) ? Number(line.taxAmount) : undefined,
                  total: Number.isFinite(Number(line.total)) ? Number(line.total) : undefined,
                  metadata: (line.metadata as Record<string, unknown>) || {},
                }))
              : [
                  {
                    description: "Recurring bill",
                    quantity: 1,
                    unitPrice: Number(billPayload.amount) || 0,
                  },
                ],
            notes: "Generated from recurring template",
          });
          resourceId = bill.id;
        } else {
          const journalPayload = (payload.journal || payload) as Record<string, unknown>;
          const journal = await accountingJournalRepo.postJournal({
            entityId: normalized,
            date: typeof journalPayload.date === "string" ? journalPayload.date : cursorDate.toISOString(),
            narration:
              typeof journalPayload.narration === "string" ? journalPayload.narration : `Recurring journal ${template.name}`,
            reference: typeof journalPayload.reference === "string" ? journalPayload.reference : undefined,
            sourceDocType: "recurring_template",
            sourceDocId: template.id,
            sourceCurrency: typeof journalPayload.sourceCurrency === "string" ? journalPayload.sourceCurrency : "NGN",
            baseCurrency: "NGN",
            exchangeRate: Number.isFinite(Number(journalPayload.exchangeRate)) ? Number(journalPayload.exchangeRate) : 1,
            lines: Array.isArray(journalPayload.lines)
              ? (journalPayload.lines as Array<Record<string, unknown>>).map((line) => ({
                  accountCode: String(line.accountCode || ""),
                  accountName: String(line.accountName || ""),
                  debit: Number(line.debit) || 0,
                  credit: Number(line.credit) || 0,
                  memo: typeof line.memo === "string" ? line.memo : undefined,
                }))
              : [],
            metadata: {
              generatedFromTemplateId: template.id,
            },
            syncTax: true,
          });
          resourceId = journal.id;
          journalId = journal.id;
        }

        await prisma.recurringRun.create({
          data: {
            entityId: normalized,
            templateId: template.id,
            periodKey,
            status: "generated",
            resourceType: template.resourceType,
            resourceId,
            journalId,
            idempotencyKey: generateDeterministicId("rr", [normalized, template.id, periodKey]),
            metadata: safeJsonStringify({
              runAt: cursorDate.toISOString(),
            }),
          },
        });

        await prisma.recurringTemplate.update({
          where: { id: template.id },
          data: {
            nextRunAt: addCadence(template.nextRunAt, template.frequency === "quarterly" ? "quarterly" : "monthly"),
          },
        });

        generated += 1;
        details.push({
          templateId: template.id,
          status: "generated",
          message: "Generated successfully",
          resourceType: template.resourceType,
          resourceId,
          journalId,
        });
      } catch (error) {
        failed += 1;
        await prisma.recurringRun.create({
          data: {
            entityId: normalized,
            templateId: template.id,
            periodKey,
            status: "failed",
            resourceType: template.resourceType,
            idempotencyKey: generateDeterministicId("rr", [normalized, template.id, periodKey]),
            error: error instanceof Error ? error.message : "Unknown recurring error",
          },
        });
        details.push({
          templateId: template.id,
          status: "failed",
          message: error instanceof Error ? error.message : "Unknown recurring error",
          resourceType: template.resourceType,
        });
      }
    }

    return {
      entityId: normalized,
      runAt: cursorDate.toISOString(),
      generated,
      skipped,
      failed,
      details,
    };
  },
};

export const exchangeRateRepo = {
  async list(entityId: string, params?: { fromCurrency?: string; toCurrency?: string; fromDate?: string; toDate?: string; limit?: number }) {
    const normalized = normalizeEntityId(entityId);
    const limit = Math.max(1, Math.min(500, Math.round(params?.limit || 200)));
    return ensurePrismaModel("exchangeRate").findMany({
      where: {
        entityId: normalized,
        ...(params?.fromCurrency ? { fromCurrency: normalizeCurrency(params.fromCurrency) } : {}),
        ...(params?.toCurrency ? { toCurrency: normalizeCurrency(params.toCurrency) } : {}),
        ...(params?.fromDate || params?.toDate
          ? {
              date: {
                ...(params.fromDate ? { gte: toDate(params.fromDate) } : {}),
                ...(params.toDate ? { lte: toDate(params.toDate) } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: limit,
    });
  },

  async upsert(entityId: string, input: { date: string; fromCurrency: string; toCurrency: string; rate: number; source?: string; metadata?: Record<string, unknown> }) {
    const normalized = normalizeEntityId(entityId);
    await ensureEntity(normalized);

    const date = toDate(input.date);
    const fromCurrency = normalizeCurrency(input.fromCurrency);
    const toCurrency = normalizeCurrency(input.toCurrency);
    const rate = Number(input.rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("Rate must be greater than zero");
    }

    return prisma.exchangeRate.upsert({
      where: {
        entityId_date_fromCurrency_toCurrency: {
          entityId: normalized,
          date,
          fromCurrency,
          toCurrency,
        },
      },
      update: {
        rate,
        source: input.source || "manual",
        metadata: safeJsonStringify(input.metadata || {}),
      },
      create: {
        entityId: normalized,
        date,
        fromCurrency,
        toCurrency,
        rate,
        source: input.source || "manual",
        metadata: safeJsonStringify(input.metadata || {}),
      },
    });
  },
};

export const dimensionRepo = {
  async listClasses(entityId: string) {
    const normalized = normalizeEntityId(entityId);
    return ensurePrismaModel("trackingClass").findMany({
      where: { entityId: normalized },
      orderBy: [{ createdAt: "desc" }],
      take: 500,
    });
  },

  async createClass(entityId: string, input: { name: string; code?: string }) {
    const normalized = normalizeEntityId(entityId);
    await ensureEntity(normalized);
    const name = String(input.name || "").trim();
    if (!name) throw new Error("Class name is required");
    return prisma.trackingClass.create({
      data: {
        entityId: normalized,
        name,
        code: input.code || null,
        isActive: true,
      },
    });
  },

  async listLocations(entityId: string) {
    const normalized = normalizeEntityId(entityId);
    return ensurePrismaModel("trackingLocation").findMany({
      where: { entityId: normalized },
      orderBy: [{ createdAt: "desc" }],
      take: 500,
    });
  },

  async createLocation(entityId: string, input: { name: string; code?: string }) {
    const normalized = normalizeEntityId(entityId);
    await ensureEntity(normalized);
    const name = String(input.name || "").trim();
    if (!name) throw new Error("Location name is required");
    return prisma.trackingLocation.create({
      data: {
        entityId: normalized,
        name,
        code: input.code || null,
        isActive: true,
      },
    });
  },
};

export const migrationRepo = {
  async importLocal(entityId: string, clientId: string, snapshot: AccountingMigrationSnapshot): Promise<AccountingMigrationResult> {
    const normalized = normalizeEntityId(entityId);
    const normalizedClientId = clientId.trim();
    if (!normalizedClientId) {
      throw new Error("clientId is required");
    }

    await ensureEntity(normalized);

    const existing = await prisma.accountingMigrationRun.findUnique({
      where: {
        entityId_clientId: {
          entityId: normalized,
          clientId: normalizedClientId,
        },
      },
    });

    if (existing) {
      return {
        entityId: normalized,
        clientId: normalizedClientId,
        imported: existing.imported,
        skipped: existing.skipped,
        conflicts: existing.conflicts,
        report: safeJsonParse(existing.report, {
          importedItems: [],
          skippedItems: [],
          conflicts: [],
        }),
      };
    }

    let imported = 0;
    let skipped = 0;
    let conflicts = 0;
    const report: AccountingMigrationResult["report"] = {
      importedItems: [],
      skippedItems: [],
      conflicts: [],
    };

    const vendorRows = Array.isArray(snapshot.vendors) ? snapshot.vendors : [];
    for (const row of vendorRows) {
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!name) {
        skipped += 1;
        report.skippedItems.push("vendor:missing_name");
        continue;
      }

      const vendorSeedEmail = typeof row.email === "string" ? row.email : "";
      const key =
        typeof row.id === "string" && row.id.trim()
          ? row.id
          : generateDeterministicId("vendor", [normalized, name, vendorSeedEmail]);
      try {
        await prisma.vendor.upsert({
          where: { id: key },
          update: {
            name,
            type: typeof row.type === "string" ? row.type : "corporate",
            taxId: typeof row.taxId === "string" ? row.taxId : null,
            email: typeof row.email === "string" ? row.email : null,
            phone: typeof row.phone === "string" ? row.phone : null,
            address: typeof row.address === "string" ? row.address : null,
          },
          create: {
            id: key,
            entityId: normalized,
            name,
            type: typeof row.type === "string" ? row.type : "corporate",
            taxId: typeof row.taxId === "string" ? row.taxId : null,
            email: typeof row.email === "string" ? row.email : null,
            phone: typeof row.phone === "string" ? row.phone : null,
            address: typeof row.address === "string" ? row.address : null,
          },
        });
        imported += 1;
        report.importedItems.push(`vendor:${name}`);
      } catch (error) {
        conflicts += 1;
        report.conflicts.push(`vendor:${name}:${error instanceof Error ? error.message : "error"}`);
      }
    }

    const journalRows = Array.isArray(snapshot.journals) ? snapshot.journals : [];
    for (const row of journalRows) {
      const lines = Array.isArray(row.lines) ? (row.lines as Array<Record<string, unknown>>) : [];
      if (!lines.length) {
        skipped += 1;
        report.skippedItems.push("journal:missing_lines");
        continue;
      }

      try {
        const posted = await accountingJournalRepo.postJournal({
          entityId: normalized,
          journalId: typeof row.id === "string" ? row.id : undefined,
          date: typeof row.date === "string" ? row.date : new Date().toISOString(),
          narration: typeof row.narration === "string" ? row.narration : "Imported journal",
          reference: typeof row.reference === "string" ? row.reference : undefined,
          sourceDocType: "migration_import",
          sourceDocId:
            typeof row.id === "string" && row.id.trim()
              ? row.id
              : generateDeterministicId("import", [normalized, fingerprintObject(row)]),
          sourceCurrency: typeof row.sourceCurrency === "string" ? row.sourceCurrency : "NGN",
          baseCurrency: typeof row.baseCurrency === "string" ? row.baseCurrency : "NGN",
          exchangeRate: Number.isFinite(Number(row.exchangeRate)) ? Number(row.exchangeRate) : 1,
          lines: lines.map((line) => ({
            accountCode: typeof line.accountCode === "string" ? line.accountCode : "9999",
            accountName: typeof line.accountName === "string" ? line.accountName : "Imported Account",
            debit: Number(line.debit) || 0,
            credit: Number(line.credit) || 0,
            memo: typeof line.memo === "string" ? line.memo : undefined,
          })),
          metadata: {
            ...(typeof row.metadata === "object" && row.metadata ? (row.metadata as Record<string, unknown>) : {}),
            migratedFrom: "local_storage",
            migratedAt: new Date().toISOString(),
          },
          status: "posted",
          syncTax: false,
        });

        imported += 1;
        report.importedItems.push(`journal:${posted.id}`);
      } catch (error) {
        conflicts += 1;
        report.conflicts.push(`journal:${error instanceof Error ? error.message : "error"}`);
      }
    }

    const billRows = Array.isArray(snapshot.bills) ? snapshot.bills : [];
    for (const row of billRows) {
      try {
        const lines = Array.isArray(row.lines)
          ? (row.lines as Array<Record<string, unknown>>).map((line) => ({
              description: typeof line.description === "string" ? line.description : "Imported line",
              quantity: Number(line.quantity) || 1,
              unitPrice: Number(line.unitPrice) || 0,
              taxRate: Number.isFinite(Number(line.taxRate)) ? Number(line.taxRate) : 0,
              taxAmount: Number.isFinite(Number(line.taxAmount)) ? Number(line.taxAmount) : undefined,
              total: Number.isFinite(Number(line.total)) ? Number(line.total) : undefined,
            }))
          : [];

        if (lines.length === 0) {
          skipped += 1;
          report.skippedItems.push("bill:missing_lines");
          continue;
        }

        const bill = await billRepo.createDraft({
          entityId: normalized,
          billNo: typeof row.billNo === "string" ? row.billNo : undefined,
          vendorId: typeof row.vendorId === "string" ? row.vendorId : undefined,
          vendorName: typeof row.vendorName === "string" ? row.vendorName : undefined,
          date: typeof row.date === "string" ? row.date : new Date().toISOString(),
          dueDate: typeof row.dueDate === "string" ? row.dueDate : undefined,
          currency: typeof row.currency === "string" ? row.currency : "NGN",
          lines,
          notes: "Imported from local storage",
        });

        imported += 1;
        report.importedItems.push(`bill:${bill.id}`);
      } catch (error) {
        conflicts += 1;
        report.conflicts.push(`bill:${error instanceof Error ? error.message : "error"}`);
      }
    }

    const exchangeRateRows = Array.isArray(snapshot.exchangeRates) ? snapshot.exchangeRates : [];
    for (const row of exchangeRateRows) {
      try {
        await exchangeRateRepo.upsert(normalized, {
          date: typeof row.date === "string" ? row.date : new Date().toISOString(),
          fromCurrency: typeof row.fromCurrency === "string" ? row.fromCurrency : "NGN",
          toCurrency: typeof row.toCurrency === "string" ? row.toCurrency : "NGN",
          rate: Number(row.rate) || 1,
          source: typeof row.source === "string" ? row.source : "migration",
        });
        imported += 1;
        report.importedItems.push(`fx:${row.fromCurrency || "NGN"}-${row.toCurrency || "NGN"}`);
      } catch (error) {
        conflicts += 1;
        report.conflicts.push(`fx:${error instanceof Error ? error.message : "error"}`);
      }
    }

    await prisma.accountingMigrationRun.create({
      data: {
        entityId: normalized,
        clientId: normalizedClientId,
        imported,
        skipped,
        conflicts,
        report: safeJsonStringify(report),
        status: conflicts > 0 ? "completed_with_conflicts" : "completed",
      },
    });

    return {
      entityId: normalized,
      clientId: normalizedClientId,
      imported,
      skipped,
      conflicts,
      report,
    };
  },
};

export const actionExecutionRepo = {
  async list(entityId: string, limit = 50) {
    const normalized = normalizeEntityId(entityId);
    return ensurePrismaModel("actionExecutionLog").findMany({
      where: { entityId: normalized },
      orderBy: [{ createdAt: "desc" }],
      take: Math.max(1, Math.min(200, Math.round(limit))),
    });
  },

  async log(params: {
    receipt: ActionReceipt;
    actionType: string;
    message?: string;
    metadata?: Record<string, unknown>;
  }) {
    return logActionReceipt(params);
  },
};

export const accountingWorkflowService = {
  buildActionReceipt,

  async recordAction(params: {
    receipt: ActionReceipt;
    actionType: string;
    message?: string;
    metadata?: Record<string, unknown>;
  }) {
    await logActionReceipt(params);
  },

  async executeBillDraft(input: BillDraftInput) {
    const bill = await billRepo.createDraft(input);
    const receipt = buildActionReceipt({
      actionType: "accounting.createBill",
      entityId: bill.entityId,
      resourceType: "bill",
      resourceId: bill.id,
      status: "success",
      deepLink: `/accounting/bills?billId=${encodeURIComponent(bill.id)}`,
    });
    await logActionReceipt({
      receipt,
      actionType: "accounting.createBill",
      message: `Bill ${bill.billNo} drafted`,
      metadata: { billNo: bill.billNo },
    });
    return { bill, receipt };
  },

  async executeBillSubmit(input: BillSubmitInput) {
    const result = await billRepo.submitForApproval(input);
    const receipt = buildActionReceipt({
      actionType: "accounting.submitBill",
      entityId: input.entityId,
      resourceType: "bill",
      resourceId: input.billId,
      status: "success",
      deepLink: `/accounting/approvals?billId=${encodeURIComponent(input.billId)}`,
    });
    await logActionReceipt({
      receipt,
      actionType: "accounting.submitBill",
      message: `Bill submitted for approval`,
      metadata: {
        billId: input.billId,
        approvalRequestId: result.approvalRequest?.id,
      },
    });
    return { ...result, receipt };
  },

  async executeBillApprove(input: BillApprovalInput) {
    const result = await billRepo.approve(input);
    const receipt = buildActionReceipt({
      actionType: "accounting.approveBill",
      entityId: input.entityId,
      resourceType: "bill",
      resourceId: input.billId,
      journalId: result.journal.id,
      status: "success",
      deepLink: `/accounting/bills?billId=${encodeURIComponent(input.billId)}`,
    });
    await logActionReceipt({
      receipt,
      actionType: "accounting.approveBill",
      message: `Bill approved and posted`,
      metadata: {
        billNo: result.bill.billNo,
      },
    });
    return { ...result, receipt };
  },

  async executeBillPay(input: BillPaymentInput) {
    const result = await billRepo.pay(input);
    const receipt = buildActionReceipt({
      actionType: "accounting.payBill",
      entityId: input.entityId,
      resourceType: "payment",
      resourceId: result.payment.id,
      journalId: result.journal.id,
      status: "success",
      deepLink: `/accounting/bills?billId=${encodeURIComponent(input.billId)}`,
    });
    await logActionReceipt({
      receipt,
      actionType: "accounting.payBill",
      message: `Bill payment posted`,
      metadata: {
        billId: input.billId,
        paymentId: result.payment.id,
      },
    });
    return { ...result, receipt };
  },

  async executePeriodLock(params: { entityId: string; period: string; actor?: string; actorRole?: string; reason?: string }) {
    withRoleValidation(params.actorRole, "manager");
    const state = await periodLockRepo.lock(params.entityId, params.period, params.actor || "owner", params.reason);
    const receipt = buildActionReceipt({
      actionType: "accounting.lockPeriod",
      entityId: params.entityId,
      resourceType: "period_lock",
      resourceId: params.period,
      status: "success",
      deepLink: `/accounting/periods?period=${encodeURIComponent(params.period)}`,
    });
    await logActionReceipt({
      receipt,
      actionType: "accounting.lockPeriod",
      message: `Period ${params.period} locked`,
    });
    return { state, receipt };
  },

  async executePeriodUnlock(params: { entityId: string; period: string; actor?: string; actorRole?: string; reason?: string }) {
    withRoleValidation(params.actorRole, "owner");
    const state = await periodLockRepo.unlock(params.entityId, params.period);
    const receipt = buildActionReceipt({
      actionType: "accounting.unlockPeriod",
      entityId: params.entityId,
      resourceType: "period_lock",
      resourceId: params.period,
      status: "success",
      deepLink: `/accounting/periods?period=${encodeURIComponent(params.period)}`,
    });
    await logActionReceipt({
      receipt,
      actionType: "accounting.unlockPeriod",
      message: `Period ${params.period} unlocked`,
    });
    return { state, receipt };
  },

  async executeCreateRecurringTemplate(input: RecurringTemplateInput) {
    const template = await recurringRepo.createTemplate(input);
    const receipt = buildActionReceipt({
      actionType: "accounting.createRecurringTemplate",
      entityId: input.entityId,
      resourceType: "recurring_template",
      resourceId: template.id,
      status: "success",
      deepLink: `/accounting/recurring?templateId=${encodeURIComponent(template.id)}`,
    });
    await logActionReceipt({
      receipt,
      actionType: "accounting.createRecurringTemplate",
      message: `Recurring template created`,
    });
    return { template, receipt };
  },
};
