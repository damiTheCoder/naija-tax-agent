import type { TaxRuleSet } from "@/lib/tax/compliance";

export type TaxJurisdiction = "Nigeria" | "Ghana" | "Kenya" | "South Africa" | "Custom";
export type FilingCadence = "monthly" | "quarterly";
export type VatMode = "inclusive" | "exclusive";

export interface TaxCategoryRule {
  vatApplicable?: boolean;
  vatCategory?: "input" | "output" | "exempt" | "zero";
  whtApplicable?: boolean;
  whtRate?: number;
  defaultVatMode?: VatMode;
}

export interface TaxEnvironmentSettings {
  entityId: string;
  jurisdiction: TaxJurisdiction;
  taxRates: {
    vatRate: number;
    citSmallRate: number;
    citMediumRate: number;
    citLargeRate: number;
    minimumTaxRate: number;
    whtProfessionalServices: number;
    whtRent: number;
    whtContract: number;
    whtDividend: number;
    whtInterest: number;
    whtRoyalty: number;
    cgtRate: number;
  };
  companyInfo: {
    legalName: string;
    tradingName: string;
    tin: string;
    rcNumber: string;
    email: string;
    phone: string;
    address: string;
  };
  fiscalYear: {
    startMonth: number;
  };
  filingCadence: {
    vat: FilingCadence;
    wht: FilingCadence;
  };
  filingDueDay: number;
  categoryTaxMatrix: Record<string, TaxCategoryRule>;
  defaultVatModeByCategory: Record<string, VatMode>;
  updatedAt: string;
}

const SETTINGS_KEY = "ql::tax::environment-settings";

const readRate = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0) return 0;
  if (parsed > 1.5) return 1.5;
  return parsed;
};

const readString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);

const readStartMonth = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(12, Math.max(1, Math.round(parsed)));
};

export const getDefaultTaxSettings = (entityId = "entity-default"): TaxEnvironmentSettings => ({
  entityId,
  jurisdiction: "Nigeria",
  taxRates: {
    vatRate: 0.075,
    citSmallRate: 0,
    citMediumRate: 0.2,
    citLargeRate: 0.3,
    minimumTaxRate: 0.005,
    whtProfessionalServices: 0.1,
    whtRent: 0.1,
    whtContract: 0.05,
    whtDividend: 0.1,
    whtInterest: 0.1,
    whtRoyalty: 0.05,
    cgtRate: 0.1,
  },
  companyInfo: {
    legalName: "",
    tradingName: "",
    tin: "",
    rcNumber: "",
    email: "",
    phone: "",
    address: "",
  },
  fiscalYear: {
    startMonth: 1,
  },
  filingCadence: {
    vat: "monthly",
    wht: "monthly",
  },
  filingDueDay: 21,
  categoryTaxMatrix: {
    inventory: { vatApplicable: true, vatCategory: "input", whtApplicable: false, defaultVatMode: "exclusive" },
    revenue: { vatApplicable: true, vatCategory: "output", whtApplicable: false, defaultVatMode: "exclusive" },
    rent: { vatApplicable: true, vatCategory: "input", whtApplicable: true, whtRate: 0.1, defaultVatMode: "exclusive" },
    salary: { vatApplicable: false, whtApplicable: false },
  },
  defaultVatModeByCategory: {
    inventory: "exclusive",
    revenue: "exclusive",
    rent: "exclusive",
  },
  updatedAt: new Date().toISOString(),
});

const readSettingsMap = (): Record<string, TaxEnvironmentSettings> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, TaxEnvironmentSettings>;
  } catch {
    return {};
  }
};

const writeSettingsMap = (map: Record<string, TaxEnvironmentSettings>) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(map));
};

const normalizeSettings = (entityId: string, input: Partial<TaxEnvironmentSettings>): TaxEnvironmentSettings => {
  const defaults = getDefaultTaxSettings(entityId);
  const normalizeCadence = (value: unknown, fallback: FilingCadence): FilingCadence =>
    value === "quarterly" || value === "monthly" ? value : fallback;
  const normalizeVatMode = (value: unknown, fallback: VatMode): VatMode =>
    value === "inclusive" || value === "exclusive" ? value : fallback;
  const normalizeCategoryMatrix = (
    value: unknown
  ): Record<string, TaxCategoryRule> => {
    if (!value || typeof value !== "object") return {};
    const matrix = value as Record<string, TaxCategoryRule>;
    const normalized: Record<string, TaxCategoryRule> = {};
    Object.entries(matrix).forEach(([key, rule]) => {
      const category = key.trim().toLowerCase();
      if (!category || !rule || typeof rule !== "object") return;
      normalized[category] = {
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
        defaultVatMode:
          rule.defaultVatMode === "inclusive" || rule.defaultVatMode === "exclusive"
            ? rule.defaultVatMode
            : undefined,
      };
    });
    return normalized;
  };
  const normalizeVatModes = (
    value: unknown
  ): Record<string, VatMode> => {
    if (!value || typeof value !== "object") return {};
    const raw = value as Record<string, unknown>;
    const normalized: Record<string, VatMode> = {};
    Object.entries(raw).forEach(([key, mode]) => {
      const category = key.trim().toLowerCase();
      if (!category) return;
      normalized[category] = normalizeVatMode(mode, defaults.defaultVatModeByCategory[category] || "exclusive");
    });
    return normalized;
  };

  return {
    entityId,
    jurisdiction:
      input.jurisdiction === "Nigeria" ||
      input.jurisdiction === "Ghana" ||
      input.jurisdiction === "Kenya" ||
      input.jurisdiction === "South Africa" ||
      input.jurisdiction === "Custom"
        ? input.jurisdiction
        : defaults.jurisdiction,
    taxRates: {
      vatRate: readRate(input.taxRates?.vatRate, defaults.taxRates.vatRate),
      citSmallRate: readRate(input.taxRates?.citSmallRate, defaults.taxRates.citSmallRate),
      citMediumRate: readRate(input.taxRates?.citMediumRate, defaults.taxRates.citMediumRate),
      citLargeRate: readRate(input.taxRates?.citLargeRate, defaults.taxRates.citLargeRate),
      minimumTaxRate: readRate(input.taxRates?.minimumTaxRate, defaults.taxRates.minimumTaxRate),
      whtProfessionalServices: readRate(
        input.taxRates?.whtProfessionalServices,
        defaults.taxRates.whtProfessionalServices
      ),
      whtRent: readRate(input.taxRates?.whtRent, defaults.taxRates.whtRent),
      whtContract: readRate(input.taxRates?.whtContract, defaults.taxRates.whtContract),
      whtDividend: readRate(input.taxRates?.whtDividend, defaults.taxRates.whtDividend),
      whtInterest: readRate(input.taxRates?.whtInterest, defaults.taxRates.whtInterest),
      whtRoyalty: readRate(input.taxRates?.whtRoyalty, defaults.taxRates.whtRoyalty),
      cgtRate: readRate(input.taxRates?.cgtRate, defaults.taxRates.cgtRate),
    },
    companyInfo: {
      legalName: readString(input.companyInfo?.legalName, defaults.companyInfo.legalName).trim(),
      tradingName: readString(input.companyInfo?.tradingName, defaults.companyInfo.tradingName).trim(),
      tin: readString(input.companyInfo?.tin, defaults.companyInfo.tin).trim(),
      rcNumber: readString(input.companyInfo?.rcNumber, defaults.companyInfo.rcNumber).trim(),
      email: readString(input.companyInfo?.email, defaults.companyInfo.email).trim(),
      phone: readString(input.companyInfo?.phone, defaults.companyInfo.phone).trim(),
      address: readString(input.companyInfo?.address, defaults.companyInfo.address).trim(),
    },
    fiscalYear: {
      startMonth: readStartMonth(input.fiscalYear?.startMonth ?? defaults.fiscalYear.startMonth),
    },
    filingCadence: {
      vat: normalizeCadence(input.filingCadence?.vat, defaults.filingCadence.vat),
      wht: normalizeCadence(input.filingCadence?.wht, defaults.filingCadence.wht),
    },
    filingDueDay: Math.min(28, Math.max(1, Math.round(Number(input.filingDueDay ?? defaults.filingDueDay) || 21))),
    categoryTaxMatrix: {
      ...defaults.categoryTaxMatrix,
      ...normalizeCategoryMatrix(input.categoryTaxMatrix),
    },
    defaultVatModeByCategory: {
      ...defaults.defaultVatModeByCategory,
      ...normalizeVatModes(input.defaultVatModeByCategory),
    },
    updatedAt:
      typeof input.updatedAt === "string" && input.updatedAt ? input.updatedAt : new Date().toISOString(),
  };
};

export const loadTaxSettings = (entityId = "entity-default"): TaxEnvironmentSettings => {
  if (typeof window === "undefined") return getDefaultTaxSettings(entityId);
  const map = readSettingsMap();
  return normalizeSettings(entityId, map[entityId] || {});
};

export const saveTaxSettings = (settings: TaxEnvironmentSettings) => {
  const normalized = normalizeSettings(settings.entityId, settings);
  if (typeof window === "undefined") return normalized;
  const map = readSettingsMap();
  map[normalized.entityId] = { ...normalized, updatedAt: new Date().toISOString() };
  writeSettingsMap(map);
  window.dispatchEvent(new Event("tax-settings:updated"));
  return map[normalized.entityId];
};

export const loadTaxSettingsFromApi = async (entityId = "entity-default"): Promise<TaxEnvironmentSettings> => {
  try {
    const response = await fetch(`/api/tax/settings?entityId=${encodeURIComponent(entityId)}`, {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) return loadTaxSettings(entityId);
    const payload = (await response.json()) as { success?: boolean; settings?: Partial<TaxEnvironmentSettings> };
    if (!payload.success || !payload.settings) return loadTaxSettings(entityId);
    const normalized = normalizeSettings(entityId, payload.settings);
    saveTaxSettings(normalized);
    return normalized;
  } catch {
    return loadTaxSettings(entityId);
  }
};

export const saveTaxSettingsToApi = async (
  settings: TaxEnvironmentSettings
): Promise<TaxEnvironmentSettings> => {
  try {
    const response = await fetch("/api/tax/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityId: settings.entityId,
        settings,
      }),
    });
    if (!response.ok) {
      return saveTaxSettings(settings);
    }
    const payload = (await response.json()) as { success?: boolean; settings?: Partial<TaxEnvironmentSettings> };
    if (!payload.success || !payload.settings) {
      return saveTaxSettings(settings);
    }
    const normalized = normalizeSettings(settings.entityId, payload.settings);
    saveTaxSettings(normalized);
    return normalized;
  } catch {
    return saveTaxSettings(settings);
  }
};

export const resetTaxSettings = (entityId = "entity-default") => {
  if (typeof window === "undefined") return getDefaultTaxSettings(entityId);
  const map = readSettingsMap();
  const defaults = getDefaultTaxSettings(entityId);
  map[entityId] = defaults;
  writeSettingsMap(map);
  window.dispatchEvent(new Event("tax-settings:updated"));
  return defaults;
};

export const applyTaxSettingsToRuleSet = (
  entityId: string,
  baseRuleSet: TaxRuleSet
): TaxRuleSet & { fiscalStartMonth: number; jurisdiction: TaxJurisdiction } => {
  const settings = loadTaxSettings(entityId);

  return {
    ...baseRuleSet,
    vatRate: settings.taxRates.vatRate,
    cgtRate: settings.taxRates.cgtRate,
    whtRates: {
      ...baseRuleSet.whtRates,
      professional_services: settings.taxRates.whtProfessionalServices,
      rent: settings.taxRates.whtRent,
      contract: settings.taxRates.whtContract,
      dividend: settings.taxRates.whtDividend,
      interest: settings.taxRates.whtInterest,
      royalty: settings.taxRates.whtRoyalty,
    },
    citConfig: {
      ...baseRuleSet.citConfig,
      smallRate: settings.taxRates.citSmallRate,
      mediumRate: settings.taxRates.citMediumRate,
      largeRate: settings.taxRates.citLargeRate,
      minimumTaxRate: settings.taxRates.minimumTaxRate,
    },
    fiscalStartMonth: settings.fiscalYear.startMonth,
    jurisdiction: settings.jurisdiction,
  };
};

export const getTaxpayerProfile = (entityId = "entity-default") => {
  const settings = loadTaxSettings(entityId);
  const businessName =
    settings.companyInfo.tradingName || settings.companyInfo.legalName || "Bace";
  const taxpayerName = settings.companyInfo.legalName || businessName || "Authorized Taxpayer";
  return {
    taxpayerName,
    businessName,
  };
};
