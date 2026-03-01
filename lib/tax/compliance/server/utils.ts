import type { FilingCadence } from "./types";

export const round2 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

export const safeJsonParse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const safeJsonStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return "{}";
  }
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

export const computePeriodBounds = (date: Date, cadence: FilingCadence) => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  if (cadence === "monthly") {
    const period = `${year}-${String(month).padStart(2, "0")}`;
    const startDate = startOfDay(new Date(Date.UTC(year, month - 1, 1)));
    const endDate = endOfDay(new Date(Date.UTC(year, month, 0)));
    return { period, startDate, endDate };
  }

  const quarter = Math.floor((month - 1) / 3) + 1;
  const startMonth = (quarter - 1) * 3;
  const period = `${year}-Q${quarter}`;
  const startDate = startOfDay(new Date(Date.UTC(year, startMonth, 1)));
  const endDate = endOfDay(new Date(Date.UTC(year, startMonth + 3, 0)));
  return { period, startDate, endDate };
};

export const dueDateForPeriod = (
  period: string,
  cadence: FilingCadence,
  dueDay: number
): Date => {
  const day = Math.min(28, Math.max(1, Math.round(dueDay || 21)));
  if (cadence === "monthly") {
    const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
    if (!monthMatch) return new Date();
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    return new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, day));
  }

  const qMatch = period.match(/^(\d{4})-Q([1-4])$/);
  if (!qMatch) return new Date();
  const year = Number(qMatch[1]);
  const quarter = Number(qMatch[2]);
  const endMonth = quarter * 3;
  return new Date(Date.UTC(endMonth === 12 ? year + 1 : year, endMonth === 12 ? 0 : endMonth, day));
};

export const readNumber = (value: unknown, fallback = 0): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric;
};

export const isTaxLine = (accountCode: string): boolean =>
  accountCode === "1400" || accountCode === "1410" || accountCode === "2200" || accountCode === "2220";

export const deriveBaseAmountFromLines = (
  lines: Array<{ accountCode: string; debit: number; credit: number }>,
  side: "revenue" | "expense"
): number => {
  const primary = lines.filter((line) => !isTaxLine(line.accountCode));
  if (side === "revenue") {
    const credits = primary
      .filter((line) => line.accountCode.startsWith("4"))
      .reduce((sum, line) => sum + Math.max(0, line.credit - line.debit), 0);
    if (credits > 0) return round2(credits);
  } else {
    const debits = primary
      .filter((line) => line.accountCode.startsWith("5") || line.accountCode.startsWith("6") || line.accountCode.startsWith("12"))
      .reduce((sum, line) => sum + Math.max(0, line.debit - line.credit), 0);
    if (debits > 0) return round2(debits);
  }

  const debits = primary.reduce((sum, line) => sum + Math.max(0, line.debit), 0);
  const credits = primary.reduce((sum, line) => sum + Math.max(0, line.credit), 0);
  return round2(Math.max(debits, credits, 0));
};

