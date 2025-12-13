export type KnowledgeEntry = {
  id: string;
  topic: string;
  summary: string;
  details: string;
  sources: string[];
  keywords: string[];
};

export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    id: "pit-core",
    topic: "Personal Income Tax",
    summary: "Explains how freelancers are assessed using CRA, reliefs, progressive PIT bands, and minimum tax rules",
    details:
      "Freelancer flows subtract allowable expenses, apply CRA (higher of ₦200k or 1% of gross plus 20% of gross), subtract other reliefs, then run income through PIT_BANDS defined in lib/taxRules/config.ts. If computed tax falls below 1% of gross revenue, the minimum tax rule is enforced.",
    sources: ["lib/taxRules/ng.ts", "lib/taxRules/config.ts"],
    keywords: ["cra", "freelancer", "pit", "relief", "minimum", "personal"],
  },
  {
    id: "cit-core",
    topic: "Company Income Tax & Levies",
    summary: "Describes SME thresholds, CIT rates, and supporting levies (TET, NASENI, ITF, NSITF, Police)",
    details:
      "Companies provide turnover, COGS, operating expenses, and allowances. Taxable profit runs through CIT_CONFIG thresholds (0% small ≤₦25M, 20% medium ≤₦100M, 30% large). Levies are computed separately in lib/taxRules/levies.ts, including police trust fund (0.005% net profit), NASENI (0.25% for listed industries), NSITF (1% payroll), and ITF (1% of payroll if ≥5 employees or ₦50M turnover).",
    sources: ["lib/taxRules/ng.ts", "lib/taxRules/levies.ts"],
    keywords: ["company", "cit", "levy", "naseni", "nsitf", "itf", "police"],
  },
  {
    id: "vat-wht",
    topic: "VAT & Withholding Tax",
    summary: "How VAT is calculated (output minus input) and how WHT credits/certificates reduce payable tax",
    details:
      "VAT is 7.5% of gross revenue when the user is registered and we optionally deduct input VAT derived from purchases or provided values (app/page.tsx & lib/taxRules/ng.ts). Withholding tax credits can offset computed tax; we now require supporting certificates captured in Step 2, and validation issues arise when credits lack documentation.",
    sources: ["lib/taxRules/ng.ts", "lib/taxRules/validators.ts", "app/page.tsx"],
    keywords: ["vat", "withholding", "certificate", "credit", "wht"],
  },
  {
    id: "cgt-tet-stamp",
    topic: "CGT, TET, Stamp Duty",
    summary: "Ancillary calculators for capital gains, tertiary education tax, and stamp duties",
    details:
      "CGT applies at 10% on chargeable gains (lib/taxRules/cgt.ts). TET is 3% on assessable profits for companies (lib/taxRules/tet.ts). Stamp duties depend on document type with fixed/percentage rates as defined in lib/taxRules/stampDuty.ts.",
    sources: ["lib/taxRules/cgt.ts", "lib/taxRules/tet.ts", "lib/taxRules/stampDuty.ts"],
    keywords: ["cgt", "tet", "stamp", "duty", "capital"],
  },
  {
    id: "pdf-audit",
    topic: "Audit Trail & PDF",
    summary: "PDF output includes rule metadata, band breakdown, VAT, levies, and certificate references",
    details:
      "lib/pdfGenerator.ts builds a jsPDF document summarizing taxpayer profile, financial inputs, band breakdown, VAT, CGT, TET, stamp duties, levies, validation issues, calculation trace, and statutory references. It now embeds the taxRuleMetadata source/version and lists withholding certificates when provided.",
    sources: ["lib/pdfGenerator.ts"],
    keywords: ["pdf", "trace", "metadata", "statutory", "certificate"],
  },
  {
    id: "live-rates",
    topic: "Live Rule Overrides",
    summary: "Explains TAX_RULES overrides and version metadata",
    details:
      "lib/taxRules/liveRates.ts allows overriding PIT bands, CRA parameters, CIT thresholds, VAT rate, and minimum tax via data/taxRulesOverrides.json or a remote TAX_RULES_REMOTE_URL. The API route at app/api/tax-rules exposes GET/POST endpoints to read or update overrides, so practitioners always know which circular is applied (metadata used across app/page.tsx and pdf).",
    sources: ["lib/taxRules/liveRates.ts", "app/api/tax-rules/route.ts"],
    keywords: ["override", "live", "metadata", "tax rules", "remote"],
  }
];
