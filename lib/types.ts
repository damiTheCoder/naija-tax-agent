/**
 * NaijaTaxAgent - Type Definitions
 * Core TypeScript interfaces for tax calculation
 */

export type TaxpayerType = "freelancer" | "company";

export interface UserProfile {
    fullName: string;
    businessName?: string;
    taxpayerType: TaxpayerType;
    taxYear: number;
    stateOfResidence: string; // e.g. "Lagos"
    isVATRegistered: boolean;
    currency: "NGN";
}

export interface IncomeEntry {
    periodLabel: string;           // e.g. "Jan 2024" or "Q1"
    revenue: number;
    expenses: number;
}

export interface PayrollEntry {
    month: string;                 // ISO month label
    grossPayroll: number;
    employeeCount: number;
}

export interface WithholdingCertificate {
    id: string;
    payerName: string;
    certificateNumber: string;
    issueDate: string;
    amount: number;
    fileName?: string;
    fileData?: string;             // base64 for quick reference (client-side usage)
}

export interface TaxInputs {
    grossRevenue: number;          // total business income for the year
    allowableExpenses: number;     // deductible business expenses
    pensionContributions?: number;
    nhfContributions?: number;
    lifeInsurancePremiums?: number;
    otherReliefs?: number;
    incomeEntries?: IncomeEntry[]; // optional detailed income log
    payrollEntries?: PayrollEntry[]; // optional detailed payroll log
    vatTaxablePurchases?: number;  // purchases on which VAT was paid
    inputVATPaid?: number;         // manually supplied input VAT
    withholdingTaxCredits?: number;
    withholdingCertificates?: WithholdingCertificate[];
    priorYearLosses?: number;
    investmentAllowance?: number;
    ruralInvestmentAllowance?: number;
    pioneerStatusRelief?: number;
    // For companies/SMEs, we also allow:
    turnover?: number;
    costOfSales?: number;
    operatingExpenses?: number;
    capitalAllowance?: number;
}

export interface TaxBandBreakdown {
    bandLabel: string;
    rate: number;      // e.g. 0.15 for 15%
    baseAmount: number;
    taxAmount: number;
}

export interface VATSummary {
    vatRate: number;           // e.g. 0.075
    outputVAT: number;         // VAT collected on sales
    inputVAT?: number;         // VAT paid on purchases
    netVATPayable: number;     // positive = payable, negative = refundable
}

export interface TaxResult {
    taxpayerType: TaxpayerType;
    taxYear: number;
    taxableIncome: number;
    totalTaxDue: number;          // PIT or CIT depending on type
    effectiveRate: number;        // totalTaxDue / taxableIncome
    bands: TaxBandBreakdown[];
    vat?: VATSummary;
    notes: string[];              // extra textual notes
    taxBeforeCredits: number;
    taxCreditsApplied: number;
    validationIssues: ValidationIssue[];
    statutoryReferences: StatutoryReference[];
    calculationTrace: CalculationTraceEntry[];
    taxRuleMetadata: TaxRuleMetadata;
    reconciliationReport?: any[]; // Using any[] temporarily, will use ReconciliationRow from rulebook.ts
}

// API request/response types
export interface CalculateTaxRequest {
    profile: UserProfile;
    inputs: TaxInputs;
}

export interface GeneratePdfRequest {
    profile: UserProfile;
    inputs: TaxInputs;
    result: TaxResult;
}

// Tax Optimization Suggestions
export type OptimizationType =
    | "pension"
    | "nhf"
    | "life_insurance"
    | "vat_registration"
    | "capital_allowance"
    | "expense_documentation"
    | "company_structure";

export interface TaxOptimizationSuggestion {
    type: OptimizationType;
    title: string;
    description: string;
    potentialSavings?: number;      // Estimated tax savings in NGN
    priority: "high" | "medium" | "low";
    applicableTo: TaxpayerType[];
}

export interface TaxOptimizationResult {
    suggestions: TaxOptimizationSuggestion[];
    totalPotentialSavings: number;
}

export type ValidationSeverity = "info" | "warning" | "error";

export interface ValidationIssue {
    id: string;
    field: string;
    severity: ValidationSeverity;
    message: string;
}

export interface StatutoryReference {
    title: string;
    citation: string;
    description: string;
}

export interface CalculationTraceEntry {
    step: string;
    detail: string;
    amount?: number;
}

export interface TaxRuleMetadata {
    version: string;
    source: string;
    lastUpdated?: string | null;
    remoteUrl?: string;
}

// Re-export WHT types for convenience
export type { WHTInput, WHTCalculation, WHTResult } from "./taxRules/wht";
export type { WHTRate } from "./taxRules/whtConfig";

// Re-export CGT types
export type { CGTInput, CGTResult } from "./taxRules/cgt";

// Re-export TET types
export type { TETInput, TETResult } from "./taxRules/tet";

// Re-export Stamp Duty types
export type {
    StampDutyDocumentType,
    StampDutyInput,
    StampDutyResult
} from "./taxRules/stampDuty";

// Re-export Levies types
export type {
    PoliceLevy,
    PoliceLevyResult,
    NASENILevy,
    NASENILevyResult,
    NSITFInput,
    NSITFResult,
    ITFInput,
    ITFResult,
    CompanyLeviesInput,
    CompanyLeviesResult
} from "./taxRules/levies";
