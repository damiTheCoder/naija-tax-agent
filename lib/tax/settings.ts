import type { TaxRuleSet } from "@/lib/tax/compliance";

export type TaxJurisdiction = "Nigeria" | "Ghana" | "Kenya" | "South Africa" | "Custom";

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
    settings.companyInfo.tradingName || settings.companyInfo.legalName || "Quantum Ledger";
  const taxpayerName = settings.companyInfo.legalName || businessName || "Authorized Taxpayer";
  return {
    taxpayerName,
    businessName,
  };
};
