import type { TaxRuleSet } from "./types";

export const DEFAULT_RULE_SET_2026: TaxRuleSet = {
  id: "ruleset-2026-1",
  version: "2026.1",
  effectiveFrom: "2026-01-01",
  status: "active",
  vatRate: 0.075,
  whtRates: {
    professional_services: 0.1,
    rent: 0.1,
    contract: 0.05,
    dividend: 0.1,
    interest: 0.1,
    royalty: 0.05,
  },
  citConfig: {
    smallCompanyThreshold: 50000000,
    mediumCompanyThreshold: 100000000,
    smallRate: 0,
    mediumRate: 0.2,
    largeRate: 0.3,
    minimumTaxRate: 0.005,
  },
  cgtRate: 0.1,
  stampDutyRules: [
    { documentType: "agreement", rateType: "fixed", rate: 500 },
    { documentType: "deed", rateType: "percentage", rate: 0.015 },
    { documentType: "mortgage", rateType: "percentage", rate: 0.00375 },
    { documentType: "share-transfer", rateType: "percentage", rate: 0.0075 },
  ],
};

export function getRuleSet(version?: string): TaxRuleSet {
  if (!version || version === DEFAULT_RULE_SET_2026.version) {
    return DEFAULT_RULE_SET_2026;
  }
  return DEFAULT_RULE_SET_2026;
}
