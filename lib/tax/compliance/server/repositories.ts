import { prisma } from "@/lib/server/prisma";
import type { TaxType } from "@/lib/tax/compliance/types";
import type { JournalSyncInput, SyncJournalsRequest, TaxDashboardResponseV2, TaxEngineSettingsV2, VatMode } from "./types";
import { loadTaxEngineSettingsV2, saveTaxEngineSettingsV2 } from "./settingsRepo";
import {
  computePeriodBounds,
  deriveBaseAmountFromLines,
  dueDateForPeriod,
  readNumber,
  round2,
  safeJsonStringify,
  safeJsonParse,
} from "./utils";

const DEFAULT_VAT_RATE = 0.075;
const DEFAULT_WHT_RATE = 0.1;

type TaxSide = "output" | "input";

const getRuleSetId = (entityId: string) => `ruleset-${entityId}-v2`;
const getPeriodId = (entityId: string, period: string) => `period-${entityId}-${period}`;
const getScheduleId = (entityId: string, taxType: TaxType, period: string) =>
  `schedule-${entityId}-${taxType}-${period}`;
const getComplianceStatusId = (entityId: string, taxType: TaxType, period: string) =>
  `status-${entityId}-${taxType}-${period}`;

const toDate = (dateLike: string | undefined): Date => {
  const parsed = dateLike ? new Date(dateLike) : new Date();
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
};

const lower = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");

const readMetadata = (journal: JournalSyncInput): Record<string, unknown> =>
  journal.metadata && typeof journal.metadata === "object" ? journal.metadata : {};

const computeGrossFromLines = (lines: JournalSyncInput["lines"]): number => {
  const totalDebits = lines.reduce((sum, line) => sum + Math.max(0, line.debit || 0), 0);
  const totalCredits = lines.reduce((sum, line) => sum + Math.max(0, line.credit || 0), 0);
  return round2(Math.max(totalDebits, totalCredits));
};

const hasRevenueCredit = (lines: JournalSyncInput["lines"]) =>
  lines.some((line) => (line.accountCode || "").startsWith("4") && (line.credit || 0) > 0);
const hasExpenseDebit = (lines: JournalSyncInput["lines"]) =>
  lines.some(
    (line) =>
      ((line.accountCode || "").startsWith("5") ||
        (line.accountCode || "").startsWith("6") ||
        (line.accountCode || "").startsWith("12")) &&
      (line.debit || 0) > 0
  );

export const computeVatFromMode = (
  grossOrBase: number,
  vatRate: number,
  vatMode: VatMode
): { baseAmount: number; vatAmount: number } => {
  if (vatMode === "inclusive") {
    const baseAmount = round2(grossOrBase / (1 + vatRate));
    return { baseAmount, vatAmount: round2(grossOrBase - baseAmount) };
  }
  const baseAmount = round2(grossOrBase);
  return { baseAmount, vatAmount: round2(baseAmount * vatRate) };
};

const aggregateTaxLines = (lines: JournalSyncInput["lines"]) => {
  let vatOutput = 0;
  let vatInput = 0;
  let whtPayable = 0;
  let whtReceivable = 0;

  lines.forEach((line) => {
    const code = (line.accountCode || "").trim();
    if (!code) return;
    if (code === "2200") vatOutput += Math.max(0, (line.credit || 0) - (line.debit || 0));
    if (code === "1400") vatInput += Math.max(0, (line.debit || 0) - (line.credit || 0));
    if (code === "2220") whtPayable += Math.max(0, (line.credit || 0) - (line.debit || 0));
    if (code === "1410") whtReceivable += Math.max(0, (line.debit || 0) - (line.credit || 0));
  });

  return {
    vatOutput: round2(vatOutput),
    vatInput: round2(vatInput),
    whtPayable: round2(whtPayable),
    whtReceivable: round2(whtReceivable),
  };
};

const resolveCategory = (journal: JournalSyncInput, metadata: Record<string, unknown>) => {
  const fromMeta = lower(metadata.taxCategory || metadata.category);
  if (fromMeta) return fromMeta;
  const fromType = lower(journal.transactionType);
  if (fromType) return fromType;
  if (hasRevenueCredit(journal.lines)) return "revenue";
  if (hasExpenseDebit(journal.lines)) return "expense";
  return "general";
};

const resolveVatMode = (
  metadata: Record<string, unknown>,
  settings: TaxEngineSettingsV2,
  category: string
): Exclude<VatMode, "category_default"> => {
  const raw = lower(metadata.taxMode);
  if (raw === "inclusive" || raw === "exclusive") return raw;
  return settings.defaultVatModeByCategory[category] || "exclusive";
};

const normalizeJournalType = (journal: JournalSyncInput): string => {
  const txType = lower(journal.transactionType);
  if (!txType) {
    if (hasRevenueCredit(journal.lines)) return "sale";
    if (hasExpenseDebit(journal.lines)) return "expense";
    return "general";
  }
  if (txType === "sale-return") return "sale";
  if (txType === "purchase-return") return "purchase";
  if (txType === "asset-disposal") return "asset_disposal";
  if (txType === "asset-purchase") return "asset_purchase";
  return txType;
};

const ensureEntityAndRuleSet = async (entityId: string) => {
  const now = new Date();
  await prisma.entity.upsert({
    where: { id: entityId },
    update: { updatedAt: now },
    create: {
      id: entityId,
      name: entityId === "entity-default" ? "Default Entity" : entityId,
      currency: "NGN",
      type: "BUSINESS",
      updatedAt: now,
    },
  });

  const ruleSetId = getRuleSetId(entityId);
  await prisma.taxRuleSet.upsert({
    where: { id: ruleSetId },
    update: {
      version: "v2",
      status: "active",
      source: "internal",
    },
    create: {
      id: ruleSetId,
      entityId,
      version: "v2",
      effectiveFrom: now,
      status: "active",
      source: "internal",
    },
  });

  return { ruleSetId };
};

const ensurePeriod = async (
  entityId: string,
  period: string,
  startDate: Date,
  endDate: Date
) => {
  const periodId = getPeriodId(entityId, period);
  await prisma.taxPeriod.upsert({
    where: { id: periodId },
    update: {
      period,
      startDate,
      endDate,
      status: "open",
    },
    create: {
      id: periodId,
      entityId,
      period,
      startDate,
      endDate,
      status: "open",
    },
  });
  return periodId;
};

const upsertSchedule = async (params: {
  entityId: string;
  taxType: TaxType;
  period: string;
  periodId: string;
  ruleSetId: string;
  cadence: "monthly" | "quarterly";
  dueDay: number;
}) => {
  const { entityId, taxType, period, periodId, ruleSetId, cadence, dueDay } = params;
  const entries = await prisma.taxLedgerEntry.findMany({
    where: { entityId, taxType, periodId },
  });

  const totalBase = round2(entries.reduce((sum, entry) => sum + (entry.baseAmount || 0), 0));
  const totalSigned = round2(entries.reduce((sum, entry) => sum + (entry.taxAmount || 0), 0));
  const positive = round2(entries.reduce((sum, entry) => sum + Math.max(0, entry.taxAmount || 0), 0));
  const negative = round2(
    entries.reduce((sum, entry) => sum + Math.abs(Math.min(0, entry.taxAmount || 0)), 0)
  );

  const dueDate = dueDateForPeriod(period, cadence, dueDay);
  const totalTax = taxType === "VAT" ? Math.max(0, totalSigned) : Math.max(0, totalSigned);
  const carryForward = taxType === "VAT" ? Math.max(0, negative - positive) : 0;

  const metadata =
    taxType === "VAT"
      ? {
          outputVat: positive,
          inputVat: negative,
          netVat: round2(positive - negative),
        }
      : {
          payable: positive,
          credit: negative,
          net: round2(positive - negative),
        };

  await prisma.taxSchedule.upsert({
    where: { id: getScheduleId(entityId, taxType, period) },
    update: {
      periodId,
      ruleSetId,
      taxType,
      dueDate,
      status: "draft",
      totalBase,
      totalTax,
      carryForward,
      metadata: safeJsonStringify(metadata),
      updatedAt: new Date(),
    },
    create: {
      id: getScheduleId(entityId, taxType, period),
      entityId,
      periodId,
      ruleSetId,
      taxType,
      dueDate,
      status: "draft",
      totalBase,
      totalTax,
      carryForward,
      metadata: safeJsonStringify(metadata),
    },
  });

  await prisma.complianceStatus.upsert({
    where: { id: getComplianceStatusId(entityId, taxType, period) },
    update: {
      periodId,
      stage: "draft",
      updatedAt: new Date(),
    },
    create: {
      id: getComplianceStatusId(entityId, taxType, period),
      entityId,
      periodId,
      taxType,
      stage: "draft",
      updatedAt: new Date(),
    },
  });
};

const writeTaxForJournal = async (params: {
  entityId: string;
  ruleSetId: string;
  journal: JournalSyncInput;
  settings: TaxEngineSettingsV2;
  source: "live_posting" | "backfill";
}) => {
  const { entityId, ruleSetId, journal, settings, source } = params;
  const metadata = readMetadata(journal);
  const txDate = toDate(journal.date);
  const category = resolveCategory(journal, metadata);
  const vatMode = resolveVatMode(metadata, settings, category);
  const vatRate = readNumber(metadata.vatRate, DEFAULT_VAT_RATE) || DEFAULT_VAT_RATE;
  const configuredWhtRate =
    readNumber(metadata.whtRate, settings.categoryTaxMatrix[category]?.whtRate ?? DEFAULT_WHT_RATE) ||
    DEFAULT_WHT_RATE;
  const type = normalizeJournalType(journal);
  const amounts = aggregateTaxLines(journal.lines);
  const grossAmount = computeGrossFromLines(journal.lines);
  const revenueBase = deriveBaseAmountFromLines(journal.lines, "revenue");
  const expenseBase = deriveBaseAmountFromLines(journal.lines, "expense");
  const hasRevenue = hasRevenueCredit(journal.lines) || type.includes("sale") || category === "revenue";
  const hasExpense = hasExpenseDebit(journal.lines) || type.includes("expense") || type.includes("purchase");

  const vatApplicableMeta = metadata.vatApplicable;
  const whtApplicableMeta = metadata.whtApplicable;
  const vatApplicableRule = settings.categoryTaxMatrix[category]?.vatApplicable;
  const whtApplicableRule = settings.categoryTaxMatrix[category]?.whtApplicable;
  const vatApplicable =
    typeof vatApplicableMeta === "boolean"
      ? vatApplicableMeta
      : typeof vatApplicableRule === "boolean"
      ? vatApplicableRule
      : amounts.vatInput > 0 || amounts.vatOutput > 0;
  const whtApplicable =
    typeof whtApplicableMeta === "boolean"
      ? whtApplicableMeta
      : typeof whtApplicableRule === "boolean"
      ? whtApplicableRule
      : amounts.whtPayable > 0 || amounts.whtReceivable > 0;

  const baseForComputation = hasRevenue ? revenueBase || grossAmount : expenseBase || grossAmount;
  const computedVat = computeVatFromMode(baseForComputation, vatRate, vatMode);

  const vatOutputAmount =
    amounts.vatOutput > 0
      ? amounts.vatOutput
      : vatApplicable && hasRevenue
      ? computedVat.vatAmount
      : 0;
  const vatInputAmount =
    amounts.vatInput > 0
      ? amounts.vatInput
      : vatApplicable && hasExpense
      ? computedVat.vatAmount
      : 0;

  const hasExplicitVatPosting = amounts.vatInput > 0 || amounts.vatOutput > 0;
  const baseFromEconomicLines = hasExpense ? expenseBase : revenueBase;
  const whtBase = round2(
    hasExplicitVatPosting
      ? baseFromEconomicLines || computedVat.baseAmount || baseForComputation
      : vatApplicable
      ? computedVat.baseAmount
      : baseFromEconomicLines || baseForComputation
  );
  const computedWhtAmount = round2(whtBase * configuredWhtRate);
  const grossBasedWhtAmount = round2(grossAmount * configuredWhtRate);
  const shouldPreferComputedWht =
    vatApplicable &&
    (vatMode === "inclusive" || hasExplicitVatPosting) &&
    Math.abs(computedWhtAmount - grossBasedWhtAmount) > 0.01;
  const normalizeExplicitWht = (explicitAmount: number) => {
    if (!Number.isFinite(explicitAmount) || explicitAmount <= 0) return 0;
    if (!shouldPreferComputedWht) return round2(explicitAmount);
    const explicitRounded = round2(explicitAmount);
    const looksGrossBased = Math.abs(explicitRounded - grossBasedWhtAmount) <= 0.05;
    return looksGrossBased ? computedWhtAmount : explicitRounded;
  };
  const whtPayableAmount =
    amounts.whtPayable > 0
      ? normalizeExplicitWht(amounts.whtPayable)
      : whtApplicable && hasExpense
      ? computedWhtAmount
      : 0;
  const whtReceivableAmount =
    amounts.whtReceivable > 0
      ? normalizeExplicitWht(amounts.whtReceivable)
      : whtApplicable && hasRevenue
      ? computedWhtAmount
      : 0;

  const txId = `tx-${entityId}-${journal.id}`;
  const now = new Date();
  const impactedScheduleKeys = new Set<string>();
  const existingLedgerEntries = await prisma.taxLedgerEntry.findMany({
    where: {
      entityId,
      transactionId: txId,
      OR: [{ taxType: "VAT" }, { taxType: "WHT" }],
    },
    include: { period: true },
  });
  existingLedgerEntries.forEach((entry) => {
    const taxType = entry.taxType as TaxType;
    if ((taxType === "VAT" || taxType === "WHT") && entry.period?.period) {
      impactedScheduleKeys.add(`${taxType}::${entry.period.period}`);
    }
  });

  await prisma.transaction.upsert({
    where: { id: txId },
    update: {
      date: txDate,
      description: journal.narration || "Journal entry",
      amount: round2(baseForComputation || grossAmount),
      currency: "NGN",
      type,
      source: source === "backfill" ? "import" : "accounting",
      status: "posted",
      metadata: safeJsonStringify({
        journalId: journal.id,
        reference: journal.reference,
        category,
        taxMode: vatMode,
        vatRate,
        whtRate: configuredWhtRate,
        vatApplicable,
        whtApplicable,
        vatOutputAmount,
        vatInputAmount,
        whtPayableAmount,
        whtReceivableAmount,
        grossAmount,
        source,
        ...metadata,
      }),
      updatedAt: now,
    },
    create: {
      id: txId,
      entityId,
      date: txDate,
      description: journal.narration || "Journal entry",
      amount: round2(baseForComputation || grossAmount),
      currency: "NGN",
      type,
      source: source === "backfill" ? "import" : "accounting",
      status: "posted",
      metadata: safeJsonStringify({
        journalId: journal.id,
        reference: journal.reference,
        category,
        taxMode: vatMode,
        vatRate,
        whtRate: configuredWhtRate,
        vatApplicable,
        whtApplicable,
        vatOutputAmount,
        vatInputAmount,
        whtPayableAmount,
        whtReceivableAmount,
        grossAmount,
        source,
        ...metadata,
      }),
      updatedAt: now,
    },
  });

  if (vatOutputAmount > 0 || vatInputAmount > 0) {
    const vatPeriodConfig = computePeriodBounds(txDate, settings.filingCadence.vat);
    const vatPeriodId = await ensurePeriod(
      entityId,
      vatPeriodConfig.period,
      vatPeriodConfig.startDate,
      vatPeriodConfig.endDate
    );

    if (vatOutputAmount > 0) {
      await prisma.taxClassification.upsert({
        where: { id: `cls-${entityId}-${journal.id}-VAT-output` },
        update: {
          transactionId: txId,
          taxType: "VAT",
          status: "auto",
          confidence: 0.95,
          reason: "Detected output VAT during journal sync",
          metadata: safeJsonStringify({ category: "output", source }),
          updatedAt: now,
        },
        create: {
          id: `cls-${entityId}-${journal.id}-VAT-output`,
          entityId,
          transactionId: txId,
          taxType: "VAT",
          status: "auto",
          confidence: 0.95,
          reason: "Detected output VAT during journal sync",
          metadata: safeJsonStringify({ category: "output", source }),
        },
      });

      await prisma.taxLedgerEntry.upsert({
        where: { id: `tle-${entityId}-${journal.id}-VAT-output` },
        update: {
          transactionId: txId,
          taxType: "VAT",
          ruleSetId,
          periodId: vatPeriodId,
          baseAmount: round2(baseForComputation || revenueBase || grossAmount),
          taxAmount: round2(vatOutputAmount),
          direction: "payable",
          ledger: "output",
          metadata: safeJsonStringify({
            accountCode: "2200",
            taxMode: vatMode,
            vatRate,
            source,
          }),
        },
        create: {
          id: `tle-${entityId}-${journal.id}-VAT-output`,
          entityId,
          transactionId: txId,
          taxType: "VAT",
          ruleSetId,
          periodId: vatPeriodId,
          baseAmount: round2(baseForComputation || revenueBase || grossAmount),
          taxAmount: round2(vatOutputAmount),
          direction: "payable",
          ledger: "output",
          metadata: safeJsonStringify({
            accountCode: "2200",
            taxMode: vatMode,
            vatRate,
            source,
          }),
        },
      });
    } else {
      await prisma.taxLedgerEntry.deleteMany({
        where: { id: `tle-${entityId}-${journal.id}-VAT-output` },
      });
      await prisma.taxClassification.deleteMany({
        where: { id: `cls-${entityId}-${journal.id}-VAT-output` },
      });
    }

    if (vatInputAmount > 0) {
      await prisma.taxClassification.upsert({
        where: { id: `cls-${entityId}-${journal.id}-VAT-input` },
        update: {
          transactionId: txId,
          taxType: "VAT",
          status: "auto",
          confidence: 0.95,
          reason: "Detected input VAT during journal sync",
          metadata: safeJsonStringify({ category: "input", source }),
          updatedAt: now,
        },
        create: {
          id: `cls-${entityId}-${journal.id}-VAT-input`,
          entityId,
          transactionId: txId,
          taxType: "VAT",
          status: "auto",
          confidence: 0.95,
          reason: "Detected input VAT during journal sync",
          metadata: safeJsonStringify({ category: "input", source }),
        },
      });

      await prisma.taxLedgerEntry.upsert({
        where: { id: `tle-${entityId}-${journal.id}-VAT-input` },
        update: {
          transactionId: txId,
          taxType: "VAT",
          ruleSetId,
          periodId: vatPeriodId,
          baseAmount: round2(baseForComputation || expenseBase || grossAmount),
          taxAmount: round2(-Math.abs(vatInputAmount)),
          direction: "credit",
          ledger: "input",
          metadata: safeJsonStringify({
            accountCode: "1400",
            taxMode: vatMode,
            vatRate,
            source,
          }),
        },
        create: {
          id: `tle-${entityId}-${journal.id}-VAT-input`,
          entityId,
          transactionId: txId,
          taxType: "VAT",
          ruleSetId,
          periodId: vatPeriodId,
          baseAmount: round2(baseForComputation || expenseBase || grossAmount),
          taxAmount: round2(-Math.abs(vatInputAmount)),
          direction: "credit",
          ledger: "input",
          metadata: safeJsonStringify({
            accountCode: "1400",
            taxMode: vatMode,
            vatRate,
            source,
          }),
        },
      });
    } else {
      await prisma.taxLedgerEntry.deleteMany({
        where: { id: `tle-${entityId}-${journal.id}-VAT-input` },
      });
      await prisma.taxClassification.deleteMany({
        where: { id: `cls-${entityId}-${journal.id}-VAT-input` },
      });
    }

    impactedScheduleKeys.add(`VAT::${vatPeriodConfig.period}`);
  } else {
    await prisma.taxLedgerEntry.deleteMany({
      where: {
        entityId,
        transactionId: txId,
        taxType: "VAT",
      },
    });
    await prisma.taxClassification.deleteMany({
      where: {
        entityId,
        transactionId: txId,
        taxType: "VAT",
      },
    });
  }

  if (whtPayableAmount > 0 || whtReceivableAmount > 0) {
    const whtPeriodConfig = computePeriodBounds(txDate, settings.filingCadence.wht);
    const whtPeriodId = await ensurePeriod(
      entityId,
      whtPeriodConfig.period,
      whtPeriodConfig.startDate,
      whtPeriodConfig.endDate
    );

    await prisma.taxClassification.upsert({
      where: { id: `cls-${entityId}-${journal.id}-WHT` },
      update: {
        transactionId: txId,
        taxType: "WHT",
        status: "auto",
        confidence: 0.95,
        reason: "Detected withholding tax during journal sync",
        metadata: safeJsonStringify({
          category,
          source,
        }),
        updatedAt: now,
      },
      create: {
        id: `cls-${entityId}-${journal.id}-WHT`,
        entityId,
        transactionId: txId,
        taxType: "WHT",
        status: "auto",
        confidence: 0.95,
        reason: "Detected withholding tax during journal sync",
        metadata: safeJsonStringify({
          category,
          source,
        }),
      },
    });

    if (whtPayableAmount > 0) {
      await prisma.taxLedgerEntry.upsert({
        where: { id: `tle-${entityId}-${journal.id}-WHT-payable` },
        update: {
          transactionId: txId,
          taxType: "WHT",
          ruleSetId,
          periodId: whtPeriodId,
          baseAmount: round2(whtBase),
          taxAmount: round2(whtPayableAmount),
          direction: "payable",
          ledger: "output",
          metadata: safeJsonStringify({
            accountCode: "2220",
            whtRate: configuredWhtRate,
            source,
          }),
        },
        create: {
          id: `tle-${entityId}-${journal.id}-WHT-payable`,
          entityId,
          transactionId: txId,
          taxType: "WHT",
          ruleSetId,
          periodId: whtPeriodId,
          baseAmount: round2(whtBase),
          taxAmount: round2(whtPayableAmount),
          direction: "payable",
          ledger: "output",
          metadata: safeJsonStringify({
            accountCode: "2220",
            whtRate: configuredWhtRate,
            source,
          }),
        },
      });
    } else {
      await prisma.taxLedgerEntry.deleteMany({
        where: { id: `tle-${entityId}-${journal.id}-WHT-payable` },
      });
    }

    if (whtReceivableAmount > 0) {
      await prisma.taxLedgerEntry.upsert({
        where: { id: `tle-${entityId}-${journal.id}-WHT-receivable` },
        update: {
          transactionId: txId,
          taxType: "WHT",
          ruleSetId,
          periodId: whtPeriodId,
          baseAmount: round2(whtBase),
          taxAmount: round2(-Math.abs(whtReceivableAmount)),
          direction: "credit",
          ledger: "input",
          metadata: safeJsonStringify({
            accountCode: "1410",
            whtRate: configuredWhtRate,
            source,
          }),
        },
        create: {
          id: `tle-${entityId}-${journal.id}-WHT-receivable`,
          entityId,
          transactionId: txId,
          taxType: "WHT",
          ruleSetId,
          periodId: whtPeriodId,
          baseAmount: round2(whtBase),
          taxAmount: round2(-Math.abs(whtReceivableAmount)),
          direction: "credit",
          ledger: "input",
          metadata: safeJsonStringify({
            accountCode: "1410",
            whtRate: configuredWhtRate,
            source,
          }),
        },
      });
    } else {
      await prisma.taxLedgerEntry.deleteMany({
        where: { id: `tle-${entityId}-${journal.id}-WHT-receivable` },
      });
    }

    impactedScheduleKeys.add(`WHT::${whtPeriodConfig.period}`);
  } else {
    await prisma.taxLedgerEntry.deleteMany({
      where: {
        entityId,
        transactionId: txId,
        taxType: "WHT",
      },
    });
    await prisma.taxClassification.deleteMany({
      where: {
        entityId,
        transactionId: txId,
        taxType: "WHT",
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      entityId,
      actor: "system",
      action: "tax.v2.sync_journal",
      resourceType: "transaction",
      resourceId: txId,
      metadata: safeJsonStringify({
        journalId: journal.id,
        source,
        vatOutputAmount,
        vatInputAmount,
        whtPayableAmount,
        whtReceivableAmount,
      }),
    },
  });

  return {
    transactionId: txId,
    periodKeys: Array.from(impactedScheduleKeys),
  };
};

const voidTaxForJournal = async (params: {
  entityId: string;
  journalId: string;
  source: "live_posting" | "backfill";
}) => {
  const { entityId, journalId, source } = params;
  const txId = `tx-${entityId}-${journalId}`;
  const existingLedgerEntries = await prisma.taxLedgerEntry.findMany({
    where: { entityId, transactionId: txId },
    include: { period: true },
  });
  const impactedScheduleKeys = new Set<string>();
  existingLedgerEntries.forEach((entry) => {
    const taxType = entry.taxType as TaxType;
    if ((taxType === "VAT" || taxType === "WHT") && entry.period?.period) {
      impactedScheduleKeys.add(`${taxType}::${entry.period.period}`);
    }
  });

  await prisma.taxLedgerEntry.deleteMany({
    where: { entityId, transactionId: txId },
  });
  await prisma.taxClassification.deleteMany({
    where: {
      entityId,
      transactionId: txId,
      OR: [{ taxType: "VAT" }, { taxType: "WHT" }],
    },
  });

  const now = new Date();
  const existingTx = await prisma.transaction.findUnique({ where: { id: txId } });
  const existingMetadata = safeJsonParse<Record<string, unknown>>(
    (existingTx?.metadata as string | null) || null,
    {}
  );
  await prisma.transaction.updateMany({
    where: { id: txId, entityId },
    data: {
      status: "voided",
      metadata: safeJsonStringify({
        ...existingMetadata,
        source,
        voidedAt: now.toISOString(),
      }),
      updatedAt: now,
    },
  });

  await prisma.auditLog.create({
    data: {
      entityId,
      actor: "system",
      action: "tax.v2.void_journal",
      resourceType: "transaction",
      resourceId: txId,
      metadata: safeJsonStringify({
        journalId,
        source,
      }),
    },
  });

  return {
    transactionId: txId,
    periodKeys: Array.from(impactedScheduleKeys),
  };
};

export interface TaxTransactionRepo {
  upsertJournalTransactions(req: SyncJournalsRequest): Promise<{
    upsertedTransactions: number;
    impactedPeriods: string[];
  }>;
}

export interface TaxLedgerRepo {
  getLedgerRows(params: {
    entityId: string;
    period?: string;
    taxType?: TaxType | "ALL";
    page?: number;
    pageSize?: number;
  }): Promise<{
    rows: Array<{
      id: string;
      taxType: TaxType;
      ledger: string;
      direction: string;
      baseAmount: number;
      taxAmount: number;
      period: string | null;
      transactionId: string | null;
      transactionDate: string | null;
      transactionDescription: string | null;
      accountCode?: string;
      runningBalance: number;
      createdAt: string;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }>;
}

export interface TaxScheduleRepo {
  recomputeSchedules(
    entityId: string,
    impactedPeriods: string[],
    settings: TaxEngineSettingsV2
  ): Promise<void>;
  getDashboard(entityId: string, period?: string): Promise<TaxDashboardResponseV2>;
}

export interface TaxSettingsRepo {
  load(entityId: string): Promise<TaxEngineSettingsV2>;
  save(entityId: string, input: Partial<TaxEngineSettingsV2>): Promise<TaxEngineSettingsV2>;
}

export const taxSettingsRepo: TaxSettingsRepo = {
  async load(entityId: string) {
    return loadTaxEngineSettingsV2(entityId);
  },
  async save(entityId: string, input: Partial<TaxEngineSettingsV2>) {
    return saveTaxEngineSettingsV2(entityId, input);
  },
};

export const taxScheduleRepo: TaxScheduleRepo = {
  async recomputeSchedules(entityId, impactedPeriods, settings) {
    const { ruleSetId } = await ensureEntityAndRuleSet(entityId);
    for (const key of impactedPeriods) {
      const [taxType, period] = key.split("::") as [TaxType, string];
      if (!period || (taxType !== "VAT" && taxType !== "WHT")) continue;
      const cadence = taxType === "VAT" ? settings.filingCadence.vat : settings.filingCadence.wht;
      const sampleDate =
        cadence === "monthly"
          ? new Date(`${period}-01T00:00:00.000Z`)
          : new Date(`${period.slice(0, 4)}-01-01T00:00:00.000Z`);
      const bounds = computePeriodBounds(sampleDate, cadence);
      const periodId = await ensurePeriod(entityId, period, bounds.startDate, bounds.endDate);
      await upsertSchedule({
        entityId,
        taxType,
        period,
        periodId,
        ruleSetId,
        cadence,
        dueDay: settings.filingDueDay,
      });
    }
  },

  async getDashboard(entityId, period) {
    const wherePeriod = period ? { period: { period } } : {};
    const entries = await prisma.taxLedgerEntry.findMany({
      where: {
        entityId,
        OR: [
          { taxType: "VAT" },
          { taxType: "WHT" },
        ],
        ...(period ? { period: { period } } : {}),
      },
      include: { period: true },
      orderBy: { createdAt: "desc" },
    });

    const vatPayable = round2(
      entries
        .filter((entry) => entry.taxType === "VAT" && (entry.taxAmount || 0) > 0)
        .reduce((sum, entry) => sum + (entry.taxAmount || 0), 0)
    );
    const vatReceivable = round2(
      entries
        .filter((entry) => entry.taxType === "VAT" && (entry.taxAmount || 0) < 0)
        .reduce((sum, entry) => sum + Math.abs(entry.taxAmount || 0), 0)
    );
    const netVatPosition = round2(vatPayable - vatReceivable);
    const whtPayable = round2(
      entries
        .filter((entry) => entry.taxType === "WHT" && (entry.taxAmount || 0) > 0)
        .reduce((sum, entry) => sum + (entry.taxAmount || 0), 0)
    );

    const schedules = await prisma.taxSchedule.findMany({
      where: {
        entityId,
        OR: [{ taxType: "VAT" }, { taxType: "WHT" }],
        ...wherePeriod,
      },
      include: { period: true },
      orderBy: [{ dueDate: "asc" }],
      take: period ? 50 : 20,
    });

    const now = new Date();
    const upcoming = schedules.find((schedule) => schedule.dueDate >= now);

    return {
      entityId,
      period,
      vatPayable,
      vatReceivable,
      netVatPosition,
      whtPayable,
      nextFilingDate: upcoming ? upcoming.dueDate.toISOString().slice(0, 10) : null,
      schedules: schedules.map((schedule) => ({
        taxType: schedule.taxType as "VAT" | "WHT",
        period: schedule.period.period,
        dueDate: schedule.dueDate.toISOString().slice(0, 10),
        totalTax: round2(schedule.totalTax || 0),
        carryForward: round2(schedule.carryForward || 0),
      })),
    };
  },
};

export const taxLedgerRepo: TaxLedgerRepo = {
  async getLedgerRows(params) {
    const page = Math.max(1, Math.round(params.page || 1));
    const pageSize = Math.min(200, Math.max(1, Math.round(params.pageSize || 50)));
    const skip = (page - 1) * pageSize;

    const where = {
      entityId: params.entityId,
      ...(params.taxType && params.taxType !== "ALL" ? { taxType: params.taxType } : {}),
      ...(params.period ? { period: { period: params.period } } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.taxLedgerEntry.count({ where }),
      prisma.taxLedgerEntry.findMany({
        where,
        include: {
          transaction: true,
          period: true,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip,
        take: pageSize,
      }),
    ]);

    let runningBalance = 0;
    const normalized = rows.map((entry) => {
      runningBalance = round2(runningBalance + (entry.taxAmount || 0));
      const metadata = safeJsonParse<Record<string, unknown>>(entry.metadata as string | null, {});
      return {
        id: entry.id,
        taxType: entry.taxType as TaxType,
        ledger: entry.ledger,
        direction: entry.direction,
        baseAmount: round2(entry.baseAmount || 0),
        taxAmount: round2(entry.taxAmount || 0),
        period: entry.period?.period || null,
        transactionId: entry.transactionId,
        transactionDate: entry.transaction?.date?.toISOString().slice(0, 10) || null,
        transactionDescription: entry.transaction?.description || null,
        accountCode: typeof metadata.accountCode === "string" ? metadata.accountCode : undefined,
        runningBalance,
        createdAt: entry.createdAt.toISOString(),
      };
    });

    return {
      rows: normalized,
      total,
      page,
      pageSize,
    };
  },
};

export const taxTransactionRepo: TaxTransactionRepo = {
  async upsertJournalTransactions(req) {
    const entityId = req.entityId || "entity-default";
    const settings = await taxSettingsRepo.load(entityId);
    const { ruleSetId } = await ensureEntityAndRuleSet(entityId);
    const impactedPeriods = new Set<string>();
    let upsertedTransactions = 0;

    for (const journal of req.journals || []) {
      const status = lower(journal.status);
      const result =
        status === "voided"
          ? await voidTaxForJournal({
              entityId,
              journalId: journal.id,
              source: req.source || "live_posting",
            })
          : await writeTaxForJournal({
              entityId,
              ruleSetId,
              journal,
              settings,
              source: req.source || "live_posting",
            });
      upsertedTransactions += 1;
      result.periodKeys.forEach((key) => impactedPeriods.add(key));
    }

    await taxScheduleRepo.recomputeSchedules(entityId, Array.from(impactedPeriods), settings);

    return {
      upsertedTransactions,
      impactedPeriods: Array.from(impactedPeriods).sort(),
    };
  },
};
