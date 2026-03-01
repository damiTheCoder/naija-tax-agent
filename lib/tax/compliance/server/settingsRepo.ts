import { prisma } from "@/lib/server/prisma";
import type { TaxEngineSettingsV2, FilingCadence, TaxCategoryMatrixRule } from "./types";
import { safeJsonParse, safeJsonStringify } from "./utils";

const DEFAULT_V2_SETTINGS = (entityId: string): TaxEngineSettingsV2 => ({
  entityId,
  filingCadence: {
    vat: "monthly",
    wht: "monthly",
  },
  filingDueDay: 21,
  categoryTaxMatrix: {
    inventory: { vatApplicable: true, vatCategory: "input", whtApplicable: false },
    revenue: { vatApplicable: true, vatCategory: "output", whtApplicable: false },
    rent: { vatApplicable: true, vatCategory: "input", whtApplicable: true, whtRate: 0.1, defaultVatMode: "exclusive" },
    professional: { vatApplicable: true, vatCategory: "input", whtApplicable: true, whtRate: 0.1, defaultVatMode: "exclusive" },
    utilities: { vatApplicable: true, vatCategory: "input", whtApplicable: false, defaultVatMode: "exclusive" },
    expense: { vatApplicable: true, vatCategory: "input", whtApplicable: false, defaultVatMode: "exclusive" },
    salary: { vatApplicable: false, whtApplicable: false },
  },
  defaultVatModeByCategory: {
    inventory: "exclusive",
    revenue: "exclusive",
    rent: "exclusive",
    professional: "exclusive",
    utilities: "exclusive",
    expense: "exclusive",
  },
  updatedAt: new Date().toISOString(),
});

const normalizeCadence = (value: unknown, fallback: FilingCadence): FilingCadence =>
  value === "quarterly" ? "quarterly" : value === "monthly" ? "monthly" : fallback;

const normalizeDueDay = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 21;
  return Math.min(28, Math.max(1, Math.round(parsed)));
};

const normalizeCategoryTaxMatrix = (value: unknown): Record<string, TaxCategoryMatrixRule> => {
  if (!value || typeof value !== "object") return {};
  const matrix = value as Record<string, TaxCategoryMatrixRule>;
  const next: Record<string, TaxCategoryMatrixRule> = {};
  Object.entries(matrix).forEach(([category, rule]) => {
    const key = category.trim().toLowerCase();
    if (!key || !rule || typeof rule !== "object") return;
    next[key] = {
      vatApplicable: typeof rule.vatApplicable === "boolean" ? rule.vatApplicable : undefined,
      vatCategory:
        rule.vatCategory === "input" ||
        rule.vatCategory === "output" ||
        rule.vatCategory === "exempt" ||
        rule.vatCategory === "zero"
          ? rule.vatCategory
          : undefined,
      whtApplicable: typeof rule.whtApplicable === "boolean" ? rule.whtApplicable : undefined,
      whtRate: typeof rule.whtRate === "number" && Number.isFinite(rule.whtRate) ? rule.whtRate : undefined,
      defaultVatMode: rule.defaultVatMode === "inclusive" || rule.defaultVatMode === "exclusive" ? rule.defaultVatMode : undefined,
    };
  });
  return next;
};

const normalizeDefaultVatModes = (
  value: unknown
): Record<string, "inclusive" | "exclusive"> => {
  if (!value || typeof value !== "object") return {};
  const next: Record<string, "inclusive" | "exclusive"> = {};
  Object.entries(value as Record<string, unknown>).forEach(([category, mode]) => {
    const key = category.trim().toLowerCase();
    if (!key) return;
    if (mode === "inclusive" || mode === "exclusive") {
      next[key] = mode;
    }
  });
  return next;
};

export const ensureEntity = async (entityId: string) => {
  const now = new Date();
  return prisma.entity.upsert({
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
};

export const loadTaxEngineSettingsV2 = async (entityId: string): Promise<TaxEngineSettingsV2> => {
  await ensureEntity(entityId);
  const existing = await prisma.taxEngineSetting.findUnique({ where: { entityId } });
  if (!existing) {
    return DEFAULT_V2_SETTINGS(entityId);
  }

  const defaults = DEFAULT_V2_SETTINGS(entityId);
  const categoryTaxMatrix = normalizeCategoryTaxMatrix(
    safeJsonParse<Record<string, TaxCategoryMatrixRule>>(existing.categoryTaxMatrix, {})
  );
  const defaultVatModeByCategory = normalizeDefaultVatModes(
    safeJsonParse<Record<string, "inclusive" | "exclusive">>(existing.defaultVatModeByCategory, {})
  );

  return {
    entityId,
    filingCadence: {
      vat: normalizeCadence(existing.filingCadenceVat, defaults.filingCadence.vat),
      wht: normalizeCadence(existing.filingCadenceWht, defaults.filingCadence.wht),
    },
    filingDueDay: normalizeDueDay(existing.filingDueDay),
    categoryTaxMatrix: {
      ...defaults.categoryTaxMatrix,
      ...categoryTaxMatrix,
    },
    defaultVatModeByCategory: {
      ...defaults.defaultVatModeByCategory,
      ...defaultVatModeByCategory,
    },
    updatedAt: existing.updatedAt.toISOString(),
  };
};

export const saveTaxEngineSettingsV2 = async (
  entityId: string,
  input: Partial<TaxEngineSettingsV2>
): Promise<TaxEngineSettingsV2> => {
  const current = await loadTaxEngineSettingsV2(entityId);
  const merged: TaxEngineSettingsV2 = {
    ...current,
    ...input,
    filingCadence: {
      vat: normalizeCadence(input.filingCadence?.vat, current.filingCadence.vat),
      wht: normalizeCadence(input.filingCadence?.wht, current.filingCadence.wht),
    },
    filingDueDay: normalizeDueDay(input.filingDueDay ?? current.filingDueDay),
    categoryTaxMatrix: {
      ...current.categoryTaxMatrix,
      ...normalizeCategoryTaxMatrix(input.categoryTaxMatrix),
    },
    defaultVatModeByCategory: {
      ...current.defaultVatModeByCategory,
      ...normalizeDefaultVatModes(input.defaultVatModeByCategory),
    },
    updatedAt: new Date().toISOString(),
  };

  await prisma.taxEngineSetting.upsert({
    where: { entityId },
    update: {
      filingCadenceVat: merged.filingCadence.vat,
      filingCadenceWht: merged.filingCadence.wht,
      filingDueDay: merged.filingDueDay,
      categoryTaxMatrix: safeJsonStringify(merged.categoryTaxMatrix),
      defaultVatModeByCategory: safeJsonStringify(merged.defaultVatModeByCategory),
      updatedAt: new Date(merged.updatedAt),
    },
    create: {
      entityId,
      filingCadenceVat: merged.filingCadence.vat,
      filingCadenceWht: merged.filingCadence.wht,
      filingDueDay: merged.filingDueDay,
      categoryTaxMatrix: safeJsonStringify(merged.categoryTaxMatrix),
      defaultVatModeByCategory: safeJsonStringify(merged.defaultVatModeByCategory),
      updatedAt: new Date(merged.updatedAt),
    },
  });

  return merged;
};
