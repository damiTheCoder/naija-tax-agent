import type { AccountingState } from "@/lib/accounting/transactionBridge";

export type DepreciationMethod = "straight-line" | "reducing-balance";

export interface FixedAssetRow {
  accountCode: string;
  accountName: string;
  accumulatedCode?: string;
  accumulatedName?: string;
  grossCost: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  rate: number;
  method: DepreciationMethod | "none";
  annualDepreciation: number;
  monthlyDepreciation: number;
  additionsYtd: number;
  disposalsYtd: number;
  postedDepreciationYtd: number;
  lastActivityDate: string | null;
}

export interface FixedAssetRegisterSummary {
  rows: FixedAssetRow[];
  totals: {
    grossCost: number;
    accumulatedDepreciation: number;
    netBookValue: number;
    annualDepreciation: number;
    monthlyDepreciation: number;
  };
}

export interface DepreciationSummary extends FixedAssetRegisterSummary {
  postedDepreciationExpenseYtd: number;
  postedAmortizationExpenseYtd: number;
  annualVariance: number;
  recommendedMonthlyJournal: {
    totalDebit: number;
    creditLines: Array<{ accountCode: string; accountName: string; amount: number }>;
  };
}

type FixedAssetProfile = {
  code: string;
  name: string;
  accumulatedCode?: string;
  accumulatedName?: string;
  rate: number;
  method: DepreciationMethod | "none";
};

const FIXED_ASSET_PROFILES: FixedAssetProfile[] = [
  { code: "1500", name: "Land", rate: 0, method: "none" },
  {
    code: "1510",
    name: "Buildings",
    accumulatedCode: "1511",
    accumulatedName: "Accumulated Depreciation - Buildings",
    rate: 5,
    method: "straight-line",
  },
  {
    code: "1520",
    name: "Plant and Machinery",
    accumulatedCode: "1521",
    accumulatedName: "Accumulated Depreciation - Plant",
    rate: 20,
    method: "reducing-balance",
  },
  {
    code: "1530",
    name: "Motor Vehicles",
    accumulatedCode: "1531",
    accumulatedName: "Accumulated Depreciation - Vehicles",
    rate: 25,
    method: "reducing-balance",
  },
  {
    code: "1540",
    name: "Office Equipment",
    accumulatedCode: "1541",
    accumulatedName: "Accumulated Depreciation - Equipment",
    rate: 20,
    method: "reducing-balance",
  },
  {
    code: "1550",
    name: "Furniture and Fittings",
    accumulatedCode: "1551",
    accumulatedName: "Accumulated Depreciation - Furniture",
    rate: 20,
    method: "reducing-balance",
  },
  {
    code: "1560",
    name: "Computer Equipment",
    accumulatedCode: "1561",
    accumulatedName: "Accumulated Depreciation - Computers",
    rate: 25,
    method: "reducing-balance",
  },
];

const toAmount = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const getYear = (asOf?: Date): number => (asOf || new Date()).getFullYear();

const getEntryYear = (date: string): number => {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getFullYear();
};

export function buildFixedAssetRegister(state: AccountingState | null, asOf?: Date): FixedAssetRegisterSummary {
  const year = getYear(asOf);
  const ledger = state?.ledgerAccounts;

  const rows: FixedAssetRow[] = FIXED_ASSET_PROFILES.map((profile) => {
    const asset = ledger?.get(profile.code);
    const accumulated = profile.accumulatedCode ? ledger?.get(profile.accumulatedCode) : undefined;
    const grossCost = Math.max(0, toAmount(asset?.closingBalance));
    const accumulatedDepreciation = Math.max(0, toAmount(accumulated?.closingBalance));
    const netBookValue = Math.max(0, grossCost - accumulatedDepreciation);

    const annualDepreciation =
      profile.rate <= 0
        ? 0
        : profile.method === "straight-line"
        ? (grossCost * profile.rate) / 100
        : (netBookValue * profile.rate) / 100;
    const monthlyDepreciation = annualDepreciation / 12;

    let additionsYtd = 0;
    let disposalsYtd = 0;
    let postedDepreciationYtd = 0;

    for (const entry of asset?.entries || []) {
      if (getEntryYear(entry.date) !== year) continue;
      const movement = toAmount(entry.debit) - toAmount(entry.credit);
      if (movement > 0) additionsYtd += movement;
      if (movement < 0) disposalsYtd += Math.abs(movement);
    }

    for (const entry of accumulated?.entries || []) {
      if (getEntryYear(entry.date) !== year) continue;
      const movement = toAmount(entry.credit) - toAmount(entry.debit);
      if (movement > 0) postedDepreciationYtd += movement;
    }

    const assetLast = asset?.entries?.[asset.entries.length - 1]?.date || null;
    const accLast = accumulated?.entries?.[accumulated.entries.length - 1]?.date || null;
    const lastActivityDate = [assetLast, accLast].filter(Boolean).sort().reverse()[0] || null;

    return {
      accountCode: profile.code,
      accountName: asset?.accountName || profile.name,
      accumulatedCode: profile.accumulatedCode,
      accumulatedName: accumulated?.accountName || profile.accumulatedName,
      grossCost,
      accumulatedDepreciation,
      netBookValue,
      rate: profile.rate,
      method: profile.method,
      annualDepreciation,
      monthlyDepreciation,
      additionsYtd,
      disposalsYtd,
      postedDepreciationYtd,
      lastActivityDate,
    };
  }).filter((row) => row.grossCost > 0 || row.accumulatedDepreciation > 0);

  const totals = rows.reduce(
    (acc, row) => {
      acc.grossCost += row.grossCost;
      acc.accumulatedDepreciation += row.accumulatedDepreciation;
      acc.netBookValue += row.netBookValue;
      acc.annualDepreciation += row.annualDepreciation;
      acc.monthlyDepreciation += row.monthlyDepreciation;
      return acc;
    },
    {
      grossCost: 0,
      accumulatedDepreciation: 0,
      netBookValue: 0,
      annualDepreciation: 0,
      monthlyDepreciation: 0,
    }
  );

  return { rows, totals };
}

export function buildDepreciationSummary(state: AccountingState | null, asOf?: Date): DepreciationSummary {
  const register = buildFixedAssetRegister(state, asOf);
  const year = getYear(asOf);
  const ledger = state?.ledgerAccounts;

  const depExpense = ledger?.get("5700");
  const amortizationExpense = ledger?.get("5710");

  const postedDepreciationExpenseYtd = (depExpense?.entries || []).reduce((sum, entry) => {
    if (getEntryYear(entry.date) !== year) return sum;
    return sum + Math.max(0, toAmount(entry.debit) - toAmount(entry.credit));
  }, 0);

  const postedAmortizationExpenseYtd = (amortizationExpense?.entries || []).reduce((sum, entry) => {
    if (getEntryYear(entry.date) !== year) return sum;
    return sum + Math.max(0, toAmount(entry.debit) - toAmount(entry.credit));
  }, 0);

  const creditLines = register.rows
    .filter((row) => row.accumulatedCode && row.monthlyDepreciation > 0)
    .map((row) => ({
      accountCode: row.accumulatedCode as string,
      accountName: row.accumulatedName || `Accumulated Depreciation (${row.accountName})`,
      amount: row.monthlyDepreciation,
    }));

  const totalDebit = creditLines.reduce((sum, line) => sum + line.amount, 0);

  return {
    ...register,
    postedDepreciationExpenseYtd,
    postedAmortizationExpenseYtd,
    annualVariance: register.totals.annualDepreciation - postedDepreciationExpenseYtd,
    recommendedMonthlyJournal: {
      totalDebit,
      creditLines,
    },
  };
}
