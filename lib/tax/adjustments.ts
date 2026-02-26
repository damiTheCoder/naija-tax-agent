import type { ComplianceTransaction } from "@/lib/tax/compliance";

export type TaxAdjustmentType = "deduction" | "allowance" | "tax_credit" | "adjustment";

export type TaxAdjustmentCategory =
  | "general_deduction"
  | "capital_allowance"
  | "loss_carryforward"
  | "tax_credit"
  | "general_adjustment";

export interface TaxAdjustmentRecord {
  id: string;
  entityId: string;
  type: TaxAdjustmentType;
  category: TaxAdjustmentCategory;
  description: string;
  amount: number;
  period: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const TAX_ADJUSTMENTS_KEY = "ql::tax::adjustments";

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isValidType = (value: string): value is TaxAdjustmentType =>
  value === "deduction" || value === "allowance" || value === "tax_credit" || value === "adjustment";

const isValidCategory = (value: string): value is TaxAdjustmentCategory =>
  value === "general_deduction" ||
  value === "capital_allowance" ||
  value === "loss_carryforward" ||
  value === "tax_credit" ||
  value === "general_adjustment";

const sanitizeAmount = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const normalizePeriod = (value: unknown) => {
  if (typeof value !== "string") return currentQuarterPeriod();
  const trimmed = value.trim();
  return trimmed || currentQuarterPeriod();
};

const quarterFromMonth = (month: number) => Math.floor(month / 3) + 1;

export const currentQuarterPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-Q${quarterFromMonth(now.getMonth())}`;
};

const parsePeriodDate = (period: string): string => {
  const quarter = period.match(/^(\d{4})-Q([1-4])$/i);
  if (quarter) {
    const year = Number(quarter[1]);
    const q = Number(quarter[2]);
    const month = q * 3 - 1;
    return `${year}-${String(month + 1).padStart(2, "0")}-01`;
  }

  const month = period.match(/^(\d{4})-(\d{2})$/);
  if (month) {
    return `${month[1]}-${month[2]}-01`;
  }

  const year = period.match(/^(\d{4})$/);
  if (year) {
    return `${year[1]}-01-01`;
  }

  return new Date().toISOString().slice(0, 10);
};

const parseStoredAdjustments = (raw: string | null): TaxAdjustmentRecord[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const output: TaxAdjustmentRecord[] = [];
    parsed.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const record = item as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : makeId("txadj");
      const entityId = typeof record.entityId === "string" ? record.entityId : "entity-default";
      const type = typeof record.type === "string" && isValidType(record.type) ? record.type : "adjustment";
      const category =
        typeof record.category === "string" && isValidCategory(record.category)
          ? record.category
          : "general_adjustment";
      const description =
        typeof record.description === "string" && record.description.trim()
          ? record.description.trim()
          : "Tax adjustment";
      const notes = typeof record.notes === "string" ? record.notes : undefined;
      const amount = sanitizeAmount(record.amount);
      const period = normalizePeriod(record.period);
      const createdAt =
        typeof record.createdAt === "string" && record.createdAt
          ? record.createdAt
          : new Date().toISOString();
      const updatedAt =
        typeof record.updatedAt === "string" && record.updatedAt
          ? record.updatedAt
          : createdAt;

      output.push({
        id,
        entityId,
        type,
        category,
        description,
        amount,
        period,
        notes,
        createdAt,
        updatedAt,
      });
    });
    return output;
  } catch {
    return [];
  }
};

const persistAdjustments = (records: TaxAdjustmentRecord[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TAX_ADJUSTMENTS_KEY, JSON.stringify(records));
};

const emitTaxAdjustmentsUpdated = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("tax-adjustments:updated"));
};

export const loadTaxAdjustments = (entityId = "entity-default"): TaxAdjustmentRecord[] => {
  if (typeof window === "undefined") return [];
  const records = parseStoredAdjustments(window.localStorage.getItem(TAX_ADJUSTMENTS_KEY));
  return records
    .filter((record) => record.entityId === entityId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

export const createTaxAdjustment = (
  payload: Omit<TaxAdjustmentRecord, "id" | "createdAt" | "updatedAt">
): TaxAdjustmentRecord => {
  const next: TaxAdjustmentRecord = {
    ...payload,
    id: makeId("txadj"),
    amount: sanitizeAmount(payload.amount),
    period: normalizePeriod(payload.period),
    description: payload.description.trim() || "Tax adjustment",
    notes: payload.notes?.trim() || undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (typeof window === "undefined") return next;
  const existing = parseStoredAdjustments(window.localStorage.getItem(TAX_ADJUSTMENTS_KEY));
  persistAdjustments([next, ...existing]);
  emitTaxAdjustmentsUpdated();
  return next;
};

export const deleteTaxAdjustment = (id: string, entityId = "entity-default") => {
  if (typeof window === "undefined") return;
  const existing = parseStoredAdjustments(window.localStorage.getItem(TAX_ADJUSTMENTS_KEY));
  const filtered = existing.filter((item) => !(item.id === id && item.entityId === entityId));
  persistAdjustments(filtered);
  emitTaxAdjustmentsUpdated();
};

const getAdjustmentDescription = (adjustment: TaxAdjustmentRecord) => {
  if (adjustment.category === "capital_allowance") return "Capital allowance adjustment";
  if (adjustment.category === "loss_carryforward") return "Loss carryforward adjustment";
  if (adjustment.category === "tax_credit") return "Tax credit adjustment";
  return adjustment.description || "Tax adjustment";
};

export const mapAdjustmentsToComplianceTransactions = (
  entityId: string,
  adjustments: TaxAdjustmentRecord[]
): ComplianceTransaction[] => {
  return adjustments.map((adjustment) => {
    const amount = sanitizeAmount(adjustment.amount);
    const metadata: Record<string, unknown> = {
      source: "tax_adjustment",
      adjustmentId: adjustment.id,
      adjustmentType: adjustment.type,
      adjustmentCategory: adjustment.category,
      adjustmentNotes: adjustment.notes || "",
    };

    if (adjustment.type === "deduction" || adjustment.category === "general_deduction") {
      metadata.manualDeductionAmount = Math.abs(amount);
    }
    if (adjustment.type === "allowance") {
      metadata.manualAllowanceAmount = Math.abs(amount);
    }
    if (adjustment.category === "capital_allowance") {
      metadata.manualCapitalAllowanceAmount = Math.abs(amount);
    }
    if (adjustment.category === "loss_carryforward") {
      metadata.lossCarryForward = Math.abs(amount);
    }
    if (adjustment.type === "tax_credit" || adjustment.category === "tax_credit") {
      metadata.taxCreditAmount = Math.abs(amount);
    }
    if (adjustment.type === "adjustment") {
      metadata.manualAdjustmentAmount = amount;
    }

    return {
      id: `tax-adjustment-${adjustment.id}`,
      entityId,
      date: parsePeriodDate(adjustment.period),
      description: `${getAdjustmentDescription(adjustment)}${adjustment.notes ? ` (${adjustment.notes})` : ""}`,
      amount: Math.abs(amount),
      currency: "NGN",
      type: "general",
      source: "tax_adjustments",
      metadata,
    } satisfies ComplianceTransaction;
  });
};

export const withTaxAdjustments = (
  entityId: string,
  transactions: ComplianceTransaction[]
): ComplianceTransaction[] => {
  const adjustments = loadTaxAdjustments(entityId);
  if (adjustments.length === 0) return transactions;
  return [...transactions, ...mapAdjustmentsToComplianceTransactions(entityId, adjustments)];
};
