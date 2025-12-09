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

export interface TaxInputs {
    grossRevenue: number;          // total business income for the year
    allowableExpenses: number;     // deductible business expenses
    pensionContributions?: number;
    nhfContributions?: number;
    lifeInsurancePremiums?: number;
    otherReliefs?: number;
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
    inputVAT?: number;         // VAT paid on purchases (optional for V1)
    netVATPayable: number;
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
