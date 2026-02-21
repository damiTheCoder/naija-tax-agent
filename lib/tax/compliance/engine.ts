import { getRuleSet } from "./rulesets";
import type {
  ComplianceTransaction,
  TaxClassification,
  TaxComputationResult,
  TaxLedgerEntry,
  TaxSchedule,
  TaxType,
  TaxIssue,
  CITReconciliation,
  TaxReconciliationReport,
} from "./types";
import {
  loadClassifications,
  loadLedgerEntries,
  loadSchedules,
  loadIssues,
  saveLedgerEntries,
  saveSchedules,
  saveIssues,
} from "./store";
import { applyClassificationRules } from "./classification";
import { recordAuditLog } from "./audit";
import { buildIssues } from "./issues";

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const parsePeriod = (periodInput: string | undefined, transactions: ComplianceTransaction[]) => {
  const today = new Date();
  const fallbackDate = transactions.length
    ? new Date(transactions[transactions.length - 1].date)
    : today;
  const period = periodInput && periodInput !== "current" ? periodInput : undefined;

  if (!period) {
    const year = fallbackDate.getFullYear();
    const quarter = Math.ceil((fallbackDate.getMonth() + 1) / 3);
    const startMonth = (quarter - 1) * 3;
    const startDate = new Date(year, startMonth, 1);
    const endDate = new Date(year, startMonth + 3, 0);
    return {
      period: `${year}-Q${quarter}`,
      startDate,
      endDate,
    };
  }

  const quarterMatch = period.match(/^(\d{4})-Q(\d)$/i);
  if (quarterMatch) {
    const year = Number(quarterMatch[1]);
    const q = Number(quarterMatch[2]);
    const startMonth = (q - 1) * 3;
    const startDate = new Date(year, startMonth, 1);
    const endDate = new Date(year, startMonth + 3, 0);
    return { period, startDate, endDate };
  }

  const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]) - 1;
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    return { period, startDate, endDate };
  }

  const yearMatch = period.match(/^(\d{4})$/);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    return { period: `${year}-FY`, startDate, endDate };
  }

  return {
    period: periodInput || "current",
    startDate: new Date(today.getFullYear(), 0, 1),
    endDate: new Date(today.getFullYear(), 11, 31),
  };
};

const getYearFromPeriod = (period: string): number => {
  const match = period.match(/^(\d{4})/);
  return match ? Number(match[1]) : new Date().getFullYear();
};

const getVatWhtDueDate = (period: string): string => {
  const year = getYearFromPeriod(period);
  const quarterMatch = period.match(/^(\d{4})-Q(\d)$/i);
  if (quarterMatch) {
    const q = Number(quarterMatch[2]);
    let month = q * 3 + 1;
    let dueYear = year;
    if (month > 12) {
      month -= 12;
      dueYear += 1;
    }
    return `${dueYear}-${String(month).padStart(2, "0")}-21`;
  }
  const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    let month = Number(monthMatch[2]) + 1;
    let dueYear = year;
    if (month > 12) {
      month = 1;
      dueYear += 1;
    }
    return `${dueYear}-${String(month).padStart(2, "0")}-21`;
  }
  return `${year}-12-21`;
};

const getCitDueDate = (period: string): string => {
  const year = getYearFromPeriod(period);
  return `${year + 1}-06-30`;
};

const filterTransactions = (transactions: ComplianceTransaction[], start: Date, end: Date) =>
  transactions.filter((tx) => {
    const date = new Date(tx.date);
    return date >= start && date <= end;
  });

const sumLedger = (entries: TaxLedgerEntry[]) =>
  entries.reduce((sum, entry) => sum + entry.taxAmount, 0);

const computeVatLedger = (
  entityId: string,
  period: string,
  ruleSetId: string,
  vatRate: number,
  classifications: TaxClassification[],
  transactions: ComplianceTransaction[]
): { entries: TaxLedgerEntry[]; schedule: TaxSchedule } => {
  const outputEntries: TaxLedgerEntry[] = [];
  const inputEntries: TaxLedgerEntry[] = [];

  const relevant = classifications.filter((cls) => cls.taxType === "VAT");
  relevant.forEach((cls) => {
    const tx = transactions.find((item) => item.id === cls.transactionId);
    if (!tx) return;
    const vatInclusive = tx.metadata?.vatInclusive !== false;
    const baseAmount = vatInclusive ? tx.amount / (1 + vatRate) : tx.amount;
    const vatAmount = vatInclusive ? tx.amount - baseAmount : tx.amount * vatRate;

    if (cls.category === "output") {
      outputEntries.push({
        id: makeId("ledger"),
        entityId,
        transactionId: tx.id,
        taxType: "VAT",
        ruleSetId,
        ruleId: cls.ruleId,
        category: cls.category,
        period,
        baseAmount,
        taxAmount: vatAmount,
        direction: "payable",
        ledger: "output",
        createdAt: new Date().toISOString(),
      });
    } else if (cls.category === "input") {
      inputEntries.push({
        id: makeId("ledger"),
        entityId,
        transactionId: tx.id,
        taxType: "VAT",
        ruleSetId,
        ruleId: cls.ruleId,
        category: cls.category,
        period,
        baseAmount,
        taxAmount: -vatAmount,
        direction: "credit",
        ledger: "input",
        createdAt: new Date().toISOString(),
      });
    }
  });

  const outputVat = outputEntries.reduce((sum, entry) => sum + entry.taxAmount, 0);
  const inputVat = inputEntries.reduce((sum, entry) => sum + Math.abs(entry.taxAmount), 0);
  const netVat = outputVat - inputVat;
  const carryForward = netVat < 0 ? Math.abs(netVat) : 0;
  const adjustmentEntries: TaxLedgerEntry[] = [];
  if (carryForward > 0) {
    adjustmentEntries.push({
      id: makeId("ledger"),
      entityId,
      taxType: "VAT",
      ruleSetId,
      category: "carry_forward",
      period,
      baseAmount: 0,
      taxAmount: carryForward,
      direction: "payable",
      ledger: "adjustment",
      createdAt: new Date().toISOString(),
      metadata: {
        note: "Carry-forward credit to zero payable.",
      },
    });
  }

  const schedule: TaxSchedule = {
    id: makeId("schedule"),
    entityId,
    period,
    taxType: "VAT",
    dueDate: getVatWhtDueDate(period),
    status: "draft",
    totalBase: outputEntries.reduce((sum, entry) => sum + entry.baseAmount, 0),
    totalTax: Math.max(0, netVat),
    carryForward,
    ruleSetId,
    ledgerEntryIds: [...outputEntries, ...inputEntries, ...adjustmentEntries].map((entry) => entry.id),
    metadata: {
      outputVat,
      inputVat,
    },
  };

  return { entries: [...outputEntries, ...inputEntries, ...adjustmentEntries], schedule };
};

const computeWhtLedger = (
  entityId: string,
  period: string,
  ruleSetId: string,
  classifications: TaxClassification[],
  transactions: ComplianceTransaction[],
  rates: Record<string, number>
): { entries: TaxLedgerEntry[]; schedule: TaxSchedule } => {
  const entries: TaxLedgerEntry[] = [];

  classifications
    .filter((cls) => cls.taxType === "WHT")
    .forEach((cls) => {
      const tx = transactions.find((item) => item.id === cls.transactionId);
      if (!tx) return;
      const rate = rates[cls.category] ?? 0.05;
      const taxAmount = tx.amount * rate;
      entries.push({
        id: makeId("ledger"),
        entityId,
        transactionId: tx.id,
        taxType: "WHT",
        ruleSetId,
        ruleId: cls.ruleId,
        category: cls.category,
        period,
        baseAmount: tx.amount,
        taxAmount,
        direction: "payable",
        ledger: "output",
        createdAt: new Date().toISOString(),
      });
    });

  const schedule: TaxSchedule = {
    id: makeId("schedule"),
    entityId,
    period,
    taxType: "WHT",
    dueDate: getVatWhtDueDate(period),
    status: "draft",
    totalBase: entries.reduce((sum, entry) => sum + entry.baseAmount, 0),
    totalTax: entries.reduce((sum, entry) => sum + entry.taxAmount, 0),
    carryForward: 0,
    ruleSetId,
    ledgerEntryIds: entries.map((entry) => entry.id),
  };

  return { entries, schedule };
};

const computeCgtLedger = (
  entityId: string,
  period: string,
  ruleSetId: string,
  classifications: TaxClassification[],
  transactions: ComplianceTransaction[],
  rate: number,
  issues: TaxIssue[]
): { entries: TaxLedgerEntry[]; schedule: TaxSchedule } => {
  const entries: TaxLedgerEntry[] = [];

  classifications
    .filter((cls) => cls.taxType === "CGT")
    .forEach((cls) => {
      const tx = transactions.find((item) => item.id === cls.transactionId);
      if (!tx) return;
      const costBasis = typeof tx.metadata?.costBasis === "number" ? (tx.metadata?.costBasis as number) : null;
      if (costBasis === null) {
        issues.push({
          id: makeId("issue"),
          entityId,
          period,
          type: "MISSING_METADATA",
          severity: "high",
          message: "Missing cost basis for CGT computation.",
          transactionId: tx.id,
          taxType: "CGT",
          metadata: { required: "costBasis" },
        });
        return;
      }
      const gain = tx.amount - costBasis;
      if (gain <= 0) return;
      const taxAmount = gain * rate;
      entries.push({
        id: makeId("ledger"),
        entityId,
        transactionId: tx.id,
        taxType: "CGT",
        ruleSetId,
        ruleId: cls.ruleId,
        category: cls.category,
        period,
        baseAmount: gain,
        taxAmount,
        direction: "payable",
        ledger: "output",
        createdAt: new Date().toISOString(),
      });
    });

  const schedule: TaxSchedule = {
    id: makeId("schedule"),
    entityId,
    period,
    taxType: "CGT",
    dueDate: `${period.split("-")[0]}-12-31`,
    status: "draft",
    totalBase: entries.reduce((sum, entry) => sum + entry.baseAmount, 0),
    totalTax: entries.reduce((sum, entry) => sum + entry.taxAmount, 0),
    carryForward: 0,
    ruleSetId,
    ledgerEntryIds: entries.map((entry) => entry.id),
  };

  return { entries, schedule };
};

const computeStampLedger = (
  entityId: string,
  period: string,
  ruleSetId: string,
  classifications: TaxClassification[],
  transactions: ComplianceTransaction[],
  stampRules: { documentType: string; rateType: "fixed" | "percentage"; rate: number }[]
): { entries: TaxLedgerEntry[]; schedule: TaxSchedule } => {
  const entries: TaxLedgerEntry[] = [];

  classifications
    .filter((cls) => cls.taxType === "STAMP")
    .forEach((cls) => {
      const tx = transactions.find((item) => item.id === cls.transactionId);
      if (!tx) return;
      const rule = stampRules.find((item) => item.documentType === cls.category);
      if (!rule) return;
      const taxAmount = rule.rateType === "fixed" ? rule.rate : tx.amount * rule.rate;
      entries.push({
        id: makeId("ledger"),
        entityId,
        transactionId: tx.id,
        taxType: "STAMP",
        ruleSetId,
        ruleId: cls.ruleId,
        category: cls.category,
        period,
        baseAmount: tx.amount,
        taxAmount,
        direction: "payable",
        ledger: "output",
        createdAt: new Date().toISOString(),
      });
    });

  const schedule: TaxSchedule = {
    id: makeId("schedule"),
    entityId,
    period,
    taxType: "STAMP",
    dueDate: `${period.split("-")[0]}-12-31`,
    status: "draft",
    totalBase: entries.reduce((sum, entry) => sum + entry.baseAmount, 0),
    totalTax: entries.reduce((sum, entry) => sum + entry.taxAmount, 0),
    carryForward: 0,
    ruleSetId,
    ledgerEntryIds: entries.map((entry) => entry.id),
  };

  return { entries, schedule };
};

const computeCitLedger = (
  entityId: string,
  period: string,
  ruleSetId: string,
  classifications: TaxClassification[],
  transactions: ComplianceTransaction[],
  config: {
    smallCompanyThreshold: number;
    mediumCompanyThreshold: number;
    smallRate: number;
    mediumRate: number;
    largeRate: number;
    minimumTaxRate: number;
  }
): { entries: TaxLedgerEntry[]; schedule: TaxSchedule; reconciliation: CITReconciliation } => {
  let revenue = 0;
  let expenses = 0;

  transactions.forEach((tx) => {
    const desc = tx.description.toLowerCase();
    const isIncome = tx.type.includes("sale") || tx.type.includes("income") || desc.includes("revenue");
    const isExpense = tx.type.includes("expense") || tx.type.includes("purchase") || desc.includes("expense");
    if (isIncome) revenue += tx.amount;
    if (isExpense) expenses += tx.amount;
  });

  const accountingProfit = revenue - expenses;
  const disallowable = classifications
    .filter((cls) => cls.taxType === "CIT" && cls.category === "disallowable")
    .reduce((sum, cls) => {
      const tx = transactions.find((item) => item.id === cls.transactionId);
      return sum + (tx ? tx.amount : 0);
    }, 0);
  const nonTaxable = classifications
    .filter((cls) => cls.taxType === "CIT" && cls.category === "non_taxable")
    .reduce((sum, cls) => {
      const tx = transactions.find((item) => item.id === cls.transactionId);
      return sum + (tx ? tx.amount : 0);
    }, 0);
  const capitalAllowance = classifications
    .filter((cls) => cls.taxType === "CIT" && cls.category === "capital_allowance")
    .reduce((sum, cls) => {
      const tx = transactions.find((item) => item.id === cls.transactionId);
      return sum + (tx ? tx.amount : 0);
    }, 0);
  const lossCarryForward = transactions.reduce((sum, tx) => {
    const loss = typeof tx.metadata?.lossCarryForward === "number" ? (tx.metadata?.lossCarryForward as number) : 0;
    return sum + loss;
  }, 0);

  const taxableProfit = Math.max(0, accountingProfit + disallowable - nonTaxable - capitalAllowance - lossCarryForward);
  const turnover = revenue;

  let rate = config.largeRate;
  if (turnover <= config.smallCompanyThreshold) {
    rate = config.smallRate;
  } else if (turnover <= config.mediumCompanyThreshold) {
    rate = config.mediumRate;
  }

  const computedTax = taxableProfit * rate;
  const minimumTax = turnover * config.minimumTaxRate;
  const taxPayable = rate === 0 ? 0 : Math.max(computedTax, minimumTax);

  const reconciliation: CITReconciliation = {
    accountingProfit,
    disallowable,
    nonTaxable,
    capitalAllowance,
    lossCarryForward,
    taxableProfit,
    turnover,
    rate,
    minimumTax,
    taxPayable,
  };

  const entry: TaxLedgerEntry = {
    id: makeId("ledger"),
    entityId,
    taxType: "CIT",
    ruleSetId,
    category: "cit",
    period,
    baseAmount: taxableProfit,
    taxAmount: taxPayable,
    direction: "payable",
    ledger: "adjustment",
    createdAt: new Date().toISOString(),
    metadata: reconciliation as Record<string, unknown>,
  };

  const schedule: TaxSchedule = {
    id: makeId("schedule"),
    entityId,
    period,
    taxType: "CIT",
    dueDate: getCitDueDate(period),
    status: "draft",
    totalBase: taxableProfit,
    totalTax: taxPayable,
    carryForward: 0,
    ruleSetId,
    ledgerEntryIds: [entry.id],
    metadata: reconciliation as Record<string, unknown>,
  };

  return { entries: [entry], schedule, reconciliation };
};

const buildReconciliationReports = (
  period: string,
  schedules: TaxSchedule[],
  ledgerEntries: TaxLedgerEntry[]
): TaxReconciliationReport[] => {
  return schedules.map((schedule) => {
    const entries = ledgerEntries.filter((entry) => entry.taxType === schedule.taxType);
    const total = entries.reduce((sum, entry) => sum + entry.taxAmount, 0);
    const matched = Math.abs(total - schedule.totalTax) < 0.01;
    return {
      taxType: schedule.taxType,
      period,
      status: matched ? "matched" : "mismatch",
      summary: {
        scheduleTotal: schedule.totalTax,
        ledgerTotal: total,
      },
    };
  });
};

export function runTaxComputation(params: {
  entityId: string;
  period?: string;
  taxTypes?: TaxType[];
  transactions: ComplianceTransaction[];
  ruleSetVersion?: string;
}): TaxComputationResult {
  const ruleSet = getRuleSet(params.ruleSetVersion);
  const { period, startDate, endDate } = parsePeriod(params.period, params.transactions);
  const inPeriod = filterTransactions(params.transactions, startDate, endDate);

  const classifications = applyClassificationRules(params.entityId, inPeriod, ruleSet, params.taxTypes);
  const issues: TaxIssue[] = [];

  const ledgerEntries: TaxLedgerEntry[] = [];
  const schedules: TaxSchedule[] = [];
  const reconciliation: TaxReconciliationReport[] = [];

  if (!params.taxTypes || params.taxTypes.includes("VAT")) {
    const vat = computeVatLedger(params.entityId, period, ruleSet.id, ruleSet.vatRate, classifications, inPeriod);
    ledgerEntries.push(...vat.entries);
    schedules.push(vat.schedule);
  }

  if (!params.taxTypes || params.taxTypes.includes("WHT")) {
    const wht = computeWhtLedger(params.entityId, period, ruleSet.id, classifications, inPeriod, ruleSet.whtRates);
    ledgerEntries.push(...wht.entries);
    schedules.push(wht.schedule);
  }

  if (!params.taxTypes || params.taxTypes.includes("CGT")) {
    const cgt = computeCgtLedger(params.entityId, period, ruleSet.id, classifications, inPeriod, ruleSet.cgtRate, issues);
    ledgerEntries.push(...cgt.entries);
    schedules.push(cgt.schedule);
  }

  if (!params.taxTypes || params.taxTypes.includes("STAMP")) {
    const stamp = computeStampLedger(params.entityId, period, ruleSet.id, classifications, inPeriod, ruleSet.stampDutyRules);
    ledgerEntries.push(...stamp.entries);
    schedules.push(stamp.schedule);
  }

  let citReconciliation: CITReconciliation | null = null;
  if (!params.taxTypes || params.taxTypes.includes("CIT")) {
    const cit = computeCitLedger(params.entityId, period, ruleSet.id, classifications, inPeriod, ruleSet.citConfig);
    ledgerEntries.push(...cit.entries);
    schedules.push(cit.schedule);
    citReconciliation = cit.reconciliation;
  }

  const computedIssues = buildIssues({
    entityId: params.entityId,
    period,
    transactions: inPeriod,
    classifications,
    ledgerEntries,
    schedules,
  });

  issues.push(...computedIssues);

  const reconciliations = buildReconciliationReports(period, schedules, ledgerEntries);
  reconciliation.push(...reconciliations);

  saveLedgerEntries([
    ...ledgerEntries,
    ...loadLedgerEntries().filter((entry) => entry.entityId !== params.entityId || entry.period !== period),
  ]);
  saveSchedules([
    ...schedules,
    ...loadSchedules().filter((schedule) => schedule.entityId !== params.entityId || schedule.period !== period),
  ]);
  const existingIssues = loadIssues().filter(
    (issue) => issue.entityId !== params.entityId || issue.period !== period
  );
  saveIssues([...issues, ...existingIssues]);

  recordAuditLog({
    entityId: params.entityId,
    actor: "system",
    action: "tax.computation.run",
    resourceType: "tax_schedule",
    metadata: {
      period,
      taxTypes: params.taxTypes || ["VAT", "WHT", "CIT", "CGT", "STAMP"],
      ruleSetId: ruleSet.id,
      ledgerEntries: ledgerEntries.length,
      schedules: schedules.length,
      issues: issues.length,
      citReconciliation,
    },
  });

  return {
    ruleSetId: ruleSet.id,
    period,
    ledgerEntries,
    schedules,
    classifications,
    reconciliation: reconciliation,
    issues,
  };
}

export function generateSchedule(params: {
  entityId: string;
  period: string;
  taxType: TaxType;
}): TaxSchedule | null {
  const schedules = loadSchedules();
  return schedules.find(
    (schedule) => schedule.entityId === params.entityId && schedule.period === params.period && schedule.taxType === params.taxType
  ) || null;
}

export function listIssues(entityId: string, period: string): TaxIssue[] {
  const stored = loadIssues().filter((issue) => issue.entityId === entityId && issue.period === period);
  if (stored.length > 0) return stored;
  return buildIssues({
    entityId,
    period,
    transactions: [],
    classifications: loadClassifications(),
    ledgerEntries: loadLedgerEntries(),
    schedules: loadSchedules(),
  }).filter((issue) => issue.entityId === entityId && issue.period === period);
}

export function reconcileTax(entityId: string, period: string, taxType: TaxType): TaxReconciliationReport | null {
  const schedules = loadSchedules().filter((schedule) => schedule.entityId === entityId && schedule.period === period);
  const schedule = schedules.find((item) => item.taxType === taxType);
  if (!schedule) return null;
  const ledgerEntries = loadLedgerEntries().filter((entry) => entry.entityId === entityId && entry.period === period && entry.taxType === taxType);
  const ledgerTotal = ledgerEntries.reduce((sum, entry) => sum + entry.taxAmount, 0);
  const matched = Math.abs(ledgerTotal - schedule.totalTax) < 0.01;
  return {
    taxType,
    period,
    status: matched ? "matched" : "mismatch",
    summary: {
      scheduleTotal: schedule.totalTax,
      ledgerTotal,
    },
  };
}
