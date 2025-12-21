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
  },
  // ============================================================================
  // ACCOUNTING KNOWLEDGE
  // ============================================================================
  {
    id: "chart-of-accounts",
    topic: "Nigerian Chart of Accounts",
    summary: "Standard Nigerian chart of accounts following FIRS and IFRS for SMEs structure",
    details:
      "The chart of accounts is organized by class: Assets (1000-1999), Liabilities (2000-2999), Equity (3000-3999), Revenue (4000-4999), Expenses (5000-6999), Tax (7000-7999). Each account has a code, name, class, subClass, FIRS category, and tax properties (taxDeductible, vatApplicable, whtApplicable, whtRate). This follows Nigerian accounting standards and IFRS for SMEs.",
    sources: ["lib/accounting/standards.ts"],
    keywords: ["chart", "accounts", "coa", "ledger", "account code", "ifrs", "firs"],
  },
  {
    id: "transaction-classification",
    topic: "AI Transaction Classification",
    summary: "Dual rule-based + AI system for classifying financial transactions",
    details:
      "The classification system uses a hybrid approach: first, rule-based pattern matching against known categories and keywords. If confidence is below threshold (default 0.75), the AI engine is invoked for intelligent classification. Classifications include transaction type (income/expense/asset/liability/equity/other), account code, WHT applicability, and VAT status. Results are tagged with source (rule/ai/hybrid) and confidence score.",
    sources: ["lib/accounting/aiEngine.ts", "lib/accounting/statementEngine.ts"],
    keywords: ["classify", "classification", "ai", "machine learning", "pattern", "transaction"],
  },
  {
    id: "journal-entries",
    topic: "Double-Entry Journal Generation",
    summary: "Automatic journal entry generation following Nigerian accounting standards",
    details:
      "Journal entries are automatically generated using double-entry accounting principles. For income: debit cash/receivables, credit revenue. For expenses: debit expense, credit cash/payables. WHT and VAT are automatically calculated when applicable. Each entry includes date, description, debit/credit accounts, amounts, and audit trail (source, confidence, verification status).",
    sources: ["lib/accounting/aiEngine.ts", "lib/accounting/types.ts"],
    keywords: ["journal", "entry", "double-entry", "debit", "credit", "posting"],
  },
  {
    id: "firs-compliance",
    topic: "FIRS Compliance Requirements",
    summary: "Federal Inland Revenue Service tax compliance rules and requirements",
    details:
      "FIRS compliance includes: VAT registration for turnover > ₦25M, monthly VAT returns (due 21st), WHT deduction on qualifying payments (rent 10%, professional fees 10%, contracts 5%), CIT filing (within 6 months of year-end), annual returns. Companies above ₦120M turnover require statutory audit (CAMA 2020). The system tracks compliance status and generates alerts for overdue obligations.",
    sources: ["lib/accounting/standards.ts", "lib/accounting/aiEngine.ts"],
    keywords: ["firs", "compliance", "filing", "returns", "deadline", "obligation"],
  },
  {
    id: "wht-rates",
    topic: "Withholding Tax Rates",
    summary: "FIRS-approved WHT rates for different transaction types",
    details:
      "WHT rates by transaction type: Dividends (10%), Interest (10%), Royalties (10%), Rent (10%), Commission (10%), Professional/consultancy fees (10%), Technical/management fees (10%), Contracts (5%), Director fees (10%). Non-resident rates may differ per double taxation agreements. WHT must be remitted to FIRS within 30 days of deduction.",
    sources: ["lib/accounting/standards.ts", "lib/taxRules/wht.ts"],
    keywords: ["wht", "withholding", "rate", "deduction", "remittance"],
  },
  {
    id: "depreciation-rates",
    topic: "FIRS-Approved Depreciation Rates",
    summary: "Capital allowance rates for fixed assets as approved by FIRS",
    details:
      "FIRS depreciation rates: Buildings (5% straight-line), Plant & Machinery (20% reducing balance), Motor Vehicles (25% reducing balance), Furniture & Fittings (20% reducing balance), Computers (25% reducing balance), Office Equipment (20% reducing balance). Initial allowance may apply in year of acquisition. Capital allowances are deductible from assessable profit for CIT purposes.",
    sources: ["lib/accounting/standards.ts"],
    keywords: ["depreciation", "capital allowance", "fixed asset", "reducing balance", "straight-line"],
  },
  {
    id: "pension-compliance",
    topic: "Pension Contribution Requirements",
    summary: "PENCOM pension contribution rules for employers and employees",
    details:
      "Under the Pension Reform Act, employers must contribute minimum 10% of employee basic salary, while employees contribute 8%. Contributions are remitted to licensed Pension Fund Administrators (PFAs). Employer contributions are tax-deductible. Non-compliance attracts penalties of 2% monthly on outstanding amounts. The system calculates pension provisions and tracks remittance status.",
    sources: ["lib/accounting/standards.ts"],
    keywords: ["pension", "pencom", "pfa", "contribution", "employee", "employer"],
  },
  {
    id: "statutory-levies",
    topic: "Nigerian Statutory Levies",
    summary: "ITF, NSITF, NHF, and other mandatory contributions",
    details:
      "ITF (Industrial Training Fund): 1% of annual payroll for companies with 5+ employees or ₦50M+ turnover. NSITF (Nigeria Social Insurance Trust Fund): 1% of monthly payroll. NHF (National Housing Fund): 2.5% of employee basic salary. These are mandatory and non-compliance attracts penalties. The system tracks levy obligations and calculates amounts based on payroll data.",
    sources: ["lib/accounting/standards.ts", "lib/taxRules/levies.ts"],
    keywords: ["itf", "nsitf", "nhf", "levy", "payroll", "statutory"],
  },
  {
    id: "cama-requirements",
    topic: "CAMA 2020 Requirements",
    summary: "Companies and Allied Matters Act compliance for Nigerian companies",
    details:
      "CAMA 2020 requirements include: Annual returns filing with CAC, statutory audit for companies above exemption threshold (turnover ≥ ₦120M or net assets ≥ ₦60M), proper books of account, directors' report, and financial statements. Small companies may be exempt from statutory audit but must still file annual returns. The system flags compliance issues based on company size.",
    sources: ["lib/accounting/standards.ts"],
    keywords: ["cama", "cac", "annual returns", "audit", "directors", "company"],
  },
  {
    id: "financial-statements",
    topic: "Financial Statement Generation",
    summary: "AI-enhanced financial statement preparation following Nigerian standards",
    details:
      "The system generates Income Statement (revenue, cost of sales, gross profit, operating expenses, net income), Balance Sheet (assets, liabilities, equity), and Cash Flow Statement (operating, investing, financing activities) from classified transactions. AI enhancement improves classification accuracy and identifies anomalies. Statements follow IFRS for SMEs presentation format.",
    sources: ["lib/accounting/statementEngine.ts", "lib/accounting/aiEngine.ts"],
    keywords: ["income statement", "balance sheet", "cash flow", "financial statement", "profit and loss"],
  },
  {
    id: "tax-implications",
    topic: "Transaction Tax Implications",
    summary: "Automatic calculation of tax implications for transactions",
    details:
      "Each transaction is analyzed for tax implications: VAT (7.5% on applicable transactions), WHT (varies by transaction type), CIT impact (30%/20%/0% based on company size), and TET (3% of assessable profit). The system calculates tax amounts, identifies deductibility, and generates tax liability estimates. Recommendations are provided for tax optimization.",
    sources: ["lib/accounting/aiEngine.ts", "lib/accounting/standards.ts"],
    keywords: ["tax", "implication", "vat", "wht", "cit", "deductible"],
  },
];
