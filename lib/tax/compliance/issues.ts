import type { ComplianceTransaction, TaxClassification, TaxIssue, TaxLedgerEntry, TaxSchedule } from "./types";

const makeId = () => `issue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function buildIssues(params: {
  entityId: string;
  period: string;
  transactions: ComplianceTransaction[];
  classifications: TaxClassification[];
  ledgerEntries: TaxLedgerEntry[];
  schedules: TaxSchedule[];
}): TaxIssue[] {
  const issues: TaxIssue[] = [];
  const { entityId, period } = params;

  const classificationMap = new Map<string, TaxClassification[]>();
  params.classifications.forEach((cls) => {
    if (cls.entityId !== entityId) return;
    if (!classificationMap.has(cls.transactionId)) {
      classificationMap.set(cls.transactionId, []);
    }
    classificationMap.get(cls.transactionId)?.push(cls);
  });

  params.transactions.forEach((tx) => {
    const txClasses = classificationMap.get(tx.id) || [];
    if (txClasses.length === 0) {
      issues.push({
        id: makeId(),
        entityId,
        period,
        type: "UNCLASSIFIED",
        severity: "medium",
        message: "Transaction has no tax classification.",
        transactionId: tx.id,
      });
    }

    const cgtClass = txClasses.find((cls) => cls.taxType === "CGT");
    if (cgtClass && typeof tx.metadata?.costBasis !== "number") {
      issues.push({
        id: makeId(),
        entityId,
        period,
        type: "MISSING_METADATA",
        severity: "high",
        message: "CGT transaction missing cost basis.",
        transactionId: tx.id,
        taxType: "CGT",
      });
    }
  });

  params.schedules.forEach((schedule) => {
    const ledgerTotal = params.ledgerEntries
      .filter((entry) => entry.taxType === schedule.taxType)
      .reduce((sum, entry) => sum + entry.taxAmount, 0);
    if (Math.abs(ledgerTotal - schedule.totalTax) > 0.01) {
      issues.push({
        id: makeId(),
        entityId,
        period,
        type: "RECONCILIATION_MISMATCH",
        severity: "high",
        message: `Schedule total does not reconcile for ${schedule.taxType}.`,
        taxType: schedule.taxType,
        metadata: {
          scheduleTotal: schedule.totalTax,
          ledgerTotal,
        },
      });
    }
  });

  return issues;
}
