/**
 * Nigerian Accounting Standards & Compliance
 * Based on: FIRS regulations, CAMA 2020, IFRS for SMEs, SAS (Statements of Accounting Standards)
 */

// ============================================================================
// CHART OF ACCOUNTS - Nigerian Standard Format
// ============================================================================

export type AccountClass = 
  | "asset" 
  | "liability" 
  | "equity" 
  | "revenue" 
  | "expense";

export type AccountSubClass = 
  // Assets
  | "current-asset"
  | "non-current-asset"
  | "fixed-asset"
  // Liabilities
  | "current-liability"
  | "non-current-liability"
  // Equity
  | "share-capital"
  | "retained-earnings"
  | "reserves"
  // Revenue
  | "operating-revenue"
  | "other-income"
  // Expenses
  | "cost-of-sales"
  | "operating-expense"
  | "administrative-expense"
  | "finance-cost"
  | "tax-expense";

export interface ChartOfAccount {
  code: string;
  name: string;
  class: AccountClass;
  subClass: AccountSubClass;
  description: string;
  firsCategory?: string; // FIRS reporting category
  taxDeductible?: boolean;
  vatApplicable?: boolean;
  whtApplicable?: boolean;
  whtRate?: number;
}

// Nigerian Standard Chart of Accounts (simplified)
export const CHART_OF_ACCOUNTS: ChartOfAccount[] = [
  // ===== ASSETS (1000-1999) =====
  // Current Assets (1000-1499)
  { code: "1000", name: "Cash and Cash Equivalents", class: "asset", subClass: "current-asset", description: "Cash in hand and bank balances", firsCategory: "current-assets" },
  { code: "1010", name: "Petty Cash", class: "asset", subClass: "current-asset", description: "Small cash fund for minor expenses", firsCategory: "current-assets" },
  { code: "1020", name: "Bank - Current Account", class: "asset", subClass: "current-asset", description: "Main operating bank account", firsCategory: "current-assets" },
  { code: "1030", name: "Bank - Savings Account", class: "asset", subClass: "current-asset", description: "Interest-bearing savings account", firsCategory: "current-assets" },
  { code: "1100", name: "Accounts Receivable", class: "asset", subClass: "current-asset", description: "Trade debtors - amounts owed by customers", firsCategory: "current-assets", whtApplicable: true },
  { code: "1110", name: "Allowance for Doubtful Debts", class: "asset", subClass: "current-asset", description: "Provision for bad debts (contra)", firsCategory: "current-assets", taxDeductible: true },
  { code: "1200", name: "Inventory - Raw Materials", class: "asset", subClass: "current-asset", description: "Materials for production", firsCategory: "current-assets" },
  { code: "1210", name: "Inventory - Work in Progress", class: "asset", subClass: "current-asset", description: "Partially completed goods", firsCategory: "current-assets" },
  { code: "1220", name: "Inventory - Finished Goods", class: "asset", subClass: "current-asset", description: "Completed goods ready for sale", firsCategory: "current-assets" },
  { code: "1300", name: "Prepaid Expenses", class: "asset", subClass: "current-asset", description: "Expenses paid in advance", firsCategory: "current-assets" },
  { code: "1310", name: "Prepaid Rent", class: "asset", subClass: "current-asset", description: "Rent paid in advance", firsCategory: "current-assets" },
  { code: "1320", name: "Prepaid Insurance", class: "asset", subClass: "current-asset", description: "Insurance premiums paid in advance", firsCategory: "current-assets" },
  { code: "1400", name: "VAT Input (Recoverable)", class: "asset", subClass: "current-asset", description: "VAT paid on purchases - recoverable", firsCategory: "current-assets", vatApplicable: true },
  { code: "1410", name: "WHT Receivable", class: "asset", subClass: "current-asset", description: "Withholding tax credits receivable", firsCategory: "current-assets" },
  
  // Fixed Assets (1500-1999)
  { code: "1500", name: "Land", class: "asset", subClass: "fixed-asset", description: "Land owned by the business", firsCategory: "fixed-assets" },
  { code: "1510", name: "Buildings", class: "asset", subClass: "fixed-asset", description: "Office/factory buildings", firsCategory: "fixed-assets", taxDeductible: true },
  { code: "1511", name: "Accumulated Depreciation - Buildings", class: "asset", subClass: "fixed-asset", description: "Depreciation on buildings (contra)", firsCategory: "fixed-assets" },
  { code: "1520", name: "Plant and Machinery", class: "asset", subClass: "fixed-asset", description: "Production equipment", firsCategory: "fixed-assets", taxDeductible: true },
  { code: "1521", name: "Accumulated Depreciation - Plant", class: "asset", subClass: "fixed-asset", description: "Depreciation on plant (contra)", firsCategory: "fixed-assets" },
  { code: "1530", name: "Motor Vehicles", class: "asset", subClass: "fixed-asset", description: "Company vehicles", firsCategory: "fixed-assets", taxDeductible: true },
  { code: "1531", name: "Accumulated Depreciation - Vehicles", class: "asset", subClass: "fixed-asset", description: "Depreciation on vehicles (contra)", firsCategory: "fixed-assets" },
  { code: "1540", name: "Office Equipment", class: "asset", subClass: "fixed-asset", description: "Computers, furniture, etc.", firsCategory: "fixed-assets", taxDeductible: true },
  { code: "1541", name: "Accumulated Depreciation - Equipment", class: "asset", subClass: "fixed-asset", description: "Depreciation on equipment (contra)", firsCategory: "fixed-assets" },
  { code: "1600", name: "Intangible Assets", class: "asset", subClass: "non-current-asset", description: "Software, patents, goodwill", firsCategory: "intangible-assets" },
  
  // ===== LIABILITIES (2000-2999) =====
  // Current Liabilities (2000-2499)
  { code: "2000", name: "Accounts Payable", class: "liability", subClass: "current-liability", description: "Trade creditors - amounts owed to suppliers", firsCategory: "current-liabilities" },
  { code: "2100", name: "Accrued Expenses", class: "liability", subClass: "current-liability", description: "Expenses incurred but not yet paid", firsCategory: "current-liabilities" },
  { code: "2110", name: "Accrued Salaries", class: "liability", subClass: "current-liability", description: "Salaries owed to employees", firsCategory: "current-liabilities" },
  { code: "2200", name: "VAT Output (Payable)", class: "liability", subClass: "current-liability", description: "VAT collected on sales - payable to FIRS", firsCategory: "current-liabilities", vatApplicable: true },
  { code: "2210", name: "PAYE Payable", class: "liability", subClass: "current-liability", description: "Employee income tax withheld", firsCategory: "current-liabilities" },
  { code: "2220", name: "WHT Payable", class: "liability", subClass: "current-liability", description: "Withholding tax on payments", firsCategory: "current-liabilities", whtApplicable: true },
  { code: "2230", name: "Pension Contributions Payable", class: "liability", subClass: "current-liability", description: "Employee pension contributions", firsCategory: "current-liabilities" },
  { code: "2240", name: "NHF Contributions Payable", class: "liability", subClass: "current-liability", description: "National Housing Fund contributions", firsCategory: "current-liabilities" },
  { code: "2250", name: "NSITF Payable", class: "liability", subClass: "current-liability", description: "Nigeria Social Insurance Trust Fund", firsCategory: "current-liabilities" },
  { code: "2260", name: "ITF Payable", class: "liability", subClass: "current-liability", description: "Industrial Training Fund levy", firsCategory: "current-liabilities" },
  { code: "2300", name: "Short-term Loans", class: "liability", subClass: "current-liability", description: "Bank overdrafts and short-term borrowings", firsCategory: "current-liabilities" },
  { code: "2400", name: "Deferred Revenue", class: "liability", subClass: "current-liability", description: "Revenue received in advance", firsCategory: "current-liabilities" },
  
  // Non-Current Liabilities (2500-2999)
  { code: "2500", name: "Long-term Loans", class: "liability", subClass: "non-current-liability", description: "Bank loans payable beyond 12 months", firsCategory: "non-current-liabilities" },
  { code: "2600", name: "Deferred Tax Liability", class: "liability", subClass: "non-current-liability", description: "Tax payable in future periods", firsCategory: "non-current-liabilities" },
  
  // ===== EQUITY (3000-3999) =====
  { code: "3000", name: "Share Capital", class: "equity", subClass: "share-capital", description: "Issued and paid-up share capital", firsCategory: "equity" },
  { code: "3100", name: "Share Premium", class: "equity", subClass: "reserves", description: "Amount received above par value", firsCategory: "equity" },
  { code: "3200", name: "Retained Earnings", class: "equity", subClass: "retained-earnings", description: "Accumulated profits/losses", firsCategory: "equity" },
  { code: "3300", name: "Revaluation Reserve", class: "equity", subClass: "reserves", description: "Asset revaluation surplus", firsCategory: "equity" },
  { code: "3400", name: "Dividends", class: "equity", subClass: "retained-earnings", description: "Dividends declared (contra)", firsCategory: "equity" },
  
  // ===== REVENUE (4000-4999) =====
  { code: "4000", name: "Sales Revenue", class: "revenue", subClass: "operating-revenue", description: "Revenue from main business activities", firsCategory: "revenue", vatApplicable: true },
  { code: "4010", name: "Service Revenue", class: "revenue", subClass: "operating-revenue", description: "Revenue from services rendered", firsCategory: "revenue", vatApplicable: true, whtApplicable: true, whtRate: 5 },
  { code: "4020", name: "Contract Revenue", class: "revenue", subClass: "operating-revenue", description: "Revenue from contracts", firsCategory: "revenue", vatApplicable: true, whtApplicable: true, whtRate: 5 },
  { code: "4100", name: "Sales Returns and Allowances", class: "revenue", subClass: "operating-revenue", description: "Returns and discounts (contra)", firsCategory: "revenue" },
  { code: "4200", name: "Interest Income", class: "revenue", subClass: "other-income", description: "Interest earned on deposits", firsCategory: "other-income", whtApplicable: true, whtRate: 10 },
  { code: "4210", name: "Dividend Income", class: "revenue", subClass: "other-income", description: "Dividends received", firsCategory: "other-income" },
  { code: "4220", name: "Rental Income", class: "revenue", subClass: "other-income", description: "Income from property rentals", firsCategory: "other-income", whtApplicable: true, whtRate: 10 },
  { code: "4300", name: "Gain on Asset Disposal", class: "revenue", subClass: "other-income", description: "Profit on sale of fixed assets", firsCategory: "other-income" },
  { code: "4400", name: "Foreign Exchange Gain", class: "revenue", subClass: "other-income", description: "Gain from currency fluctuations", firsCategory: "other-income" },
  
  // ===== EXPENSES (5000-6999) =====
  // Cost of Sales (5000-5499)
  { code: "5000", name: "Cost of Goods Sold", class: "expense", subClass: "cost-of-sales", description: "Direct cost of goods sold", firsCategory: "cost-of-sales", taxDeductible: true },
  { code: "5010", name: "Raw Materials Used", class: "expense", subClass: "cost-of-sales", description: "Direct materials consumed", firsCategory: "cost-of-sales", taxDeductible: true },
  { code: "5020", name: "Direct Labour", class: "expense", subClass: "cost-of-sales", description: "Production staff wages", firsCategory: "cost-of-sales", taxDeductible: true },
  { code: "5030", name: "Manufacturing Overhead", class: "expense", subClass: "cost-of-sales", description: "Indirect production costs", firsCategory: "cost-of-sales", taxDeductible: true },
  { code: "5040", name: "Freight-In", class: "expense", subClass: "cost-of-sales", description: "Cost of bringing goods to warehouse", firsCategory: "cost-of-sales", taxDeductible: true },
  
  // Operating Expenses (5500-5999)
  { code: "5500", name: "Salaries and Wages", class: "expense", subClass: "operating-expense", description: "Employee compensation", firsCategory: "operating-expenses", taxDeductible: true },
  { code: "5510", name: "Staff Welfare", class: "expense", subClass: "operating-expense", description: "Employee benefits and welfare", firsCategory: "operating-expenses", taxDeductible: true },
  { code: "5520", name: "Pension Contribution - Employer", class: "expense", subClass: "operating-expense", description: "Employer pension contribution", firsCategory: "operating-expenses", taxDeductible: true },
  { code: "5530", name: "NSITF Contribution", class: "expense", subClass: "operating-expense", description: "Social insurance contribution", firsCategory: "operating-expenses", taxDeductible: true },
  { code: "5540", name: "ITF Contribution", class: "expense", subClass: "operating-expense", description: "Industrial training fund levy", firsCategory: "operating-expenses", taxDeductible: true },
  { code: "5600", name: "Rent Expense", class: "expense", subClass: "operating-expense", description: "Office/premises rent", firsCategory: "operating-expenses", taxDeductible: true, whtApplicable: true, whtRate: 10 },
  { code: "5610", name: "Utilities", class: "expense", subClass: "operating-expense", description: "Electricity, water, etc.", firsCategory: "operating-expenses", taxDeductible: true },
  { code: "5620", name: "Telephone and Internet", class: "expense", subClass: "operating-expense", description: "Communication costs", firsCategory: "operating-expenses", taxDeductible: true },
  { code: "5700", name: "Depreciation Expense", class: "expense", subClass: "operating-expense", description: "Annual depreciation charge", firsCategory: "operating-expenses", taxDeductible: true },
  { code: "5710", name: "Amortization Expense", class: "expense", subClass: "operating-expense", description: "Amortization of intangibles", firsCategory: "operating-expenses", taxDeductible: true },
  { code: "5800", name: "Insurance Expense", class: "expense", subClass: "operating-expense", description: "Business insurance premiums", firsCategory: "operating-expenses", taxDeductible: true },
  { code: "5810", name: "Repairs and Maintenance", class: "expense", subClass: "operating-expense", description: "Equipment and building repairs", firsCategory: "operating-expenses", taxDeductible: true },
  { code: "5820", name: "Office Supplies", class: "expense", subClass: "operating-expense", description: "Stationery and consumables", firsCategory: "operating-expenses", taxDeductible: true },
  { code: "5900", name: "Professional Fees", class: "expense", subClass: "operating-expense", description: "Legal, audit, consulting fees", firsCategory: "operating-expenses", taxDeductible: true, whtApplicable: true, whtRate: 10 },
  { code: "5910", name: "Audit Fees", class: "expense", subClass: "operating-expense", description: "External audit fees", firsCategory: "operating-expenses", taxDeductible: true, whtApplicable: true, whtRate: 10 },
  { code: "5920", name: "Legal Fees", class: "expense", subClass: "operating-expense", description: "Legal and company secretarial", firsCategory: "operating-expenses", taxDeductible: true, whtApplicable: true, whtRate: 10 },
  
  // Administrative Expenses (6000-6499)
  { code: "6000", name: "Advertising and Marketing", class: "expense", subClass: "administrative-expense", description: "Promotion and advertising costs", firsCategory: "administrative-expenses", taxDeductible: true },
  { code: "6010", name: "Travel and Entertainment", class: "expense", subClass: "administrative-expense", description: "Business travel and meals", firsCategory: "administrative-expenses", taxDeductible: true },
  { code: "6020", name: "Training and Development", class: "expense", subClass: "administrative-expense", description: "Staff training costs", firsCategory: "administrative-expenses", taxDeductible: true },
  { code: "6030", name: "Bank Charges", class: "expense", subClass: "administrative-expense", description: "Bank fees and commissions", firsCategory: "administrative-expenses", taxDeductible: true },
  { code: "6040", name: "Bad Debts Written Off", class: "expense", subClass: "administrative-expense", description: "Irrecoverable debts", firsCategory: "administrative-expenses", taxDeductible: true },
  { code: "6050", name: "Donations and CSR", class: "expense", subClass: "administrative-expense", description: "Charitable donations", firsCategory: "administrative-expenses", taxDeductible: true },
  { code: "6060", name: "Fines and Penalties", class: "expense", subClass: "administrative-expense", description: "Regulatory fines", firsCategory: "administrative-expenses", taxDeductible: false },
  
  // Finance Costs (6500-6999)
  { code: "6500", name: "Interest Expense", class: "expense", subClass: "finance-cost", description: "Interest on loans and borrowings", firsCategory: "finance-costs", taxDeductible: true },
  { code: "6510", name: "Bank Loan Interest", class: "expense", subClass: "finance-cost", description: "Interest on bank facilities", firsCategory: "finance-costs", taxDeductible: true },
  { code: "6600", name: "Foreign Exchange Loss", class: "expense", subClass: "finance-cost", description: "Loss from currency fluctuations", firsCategory: "finance-costs", taxDeductible: true },
  
  // Tax Expenses (7000-7999)
  { code: "7000", name: "Company Income Tax", class: "expense", subClass: "tax-expense", description: "Current year CIT provision", firsCategory: "tax-expense", taxDeductible: false },
  { code: "7010", name: "Tertiary Education Tax", class: "expense", subClass: "tax-expense", description: "TET @ 3% of assessable profit", firsCategory: "tax-expense", taxDeductible: false },
  { code: "7020", name: "Deferred Tax Expense", class: "expense", subClass: "tax-expense", description: "Deferred tax movement", firsCategory: "tax-expense", taxDeductible: false },
];

// ============================================================================
// FIRS WHT RATES BY TRANSACTION TYPE
// ============================================================================

export interface WHTRate {
  transactionType: string;
  residentRate: number;
  nonResidentRate: number;
  description: string;
}

export const FIRS_WHT_RATES: WHTRate[] = [
  { transactionType: "dividends", residentRate: 10, nonResidentRate: 10, description: "Dividend payments" },
  { transactionType: "interest", residentRate: 10, nonResidentRate: 10, description: "Interest payments" },
  { transactionType: "royalties", residentRate: 10, nonResidentRate: 10, description: "Royalty payments" },
  { transactionType: "rent", residentRate: 10, nonResidentRate: 10, description: "Rental payments" },
  { transactionType: "commission", residentRate: 10, nonResidentRate: 10, description: "Commission payments" },
  { transactionType: "professional-fees", residentRate: 10, nonResidentRate: 10, description: "Professional/consultancy fees" },
  { transactionType: "technical-fees", residentRate: 10, nonResidentRate: 10, description: "Technical/management fees" },
  { transactionType: "contracts", residentRate: 5, nonResidentRate: 5, description: "Contract payments" },
  { transactionType: "director-fees", residentRate: 10, nonResidentRate: 10, description: "Directors fees" },
];

// ============================================================================
// DEPRECIATION RATES (FIRS APPROVED)
// ============================================================================

export interface DepreciationRate {
  assetClass: string;
  rate: number;
  method: "straight-line" | "reducing-balance";
  description: string;
}

export const FIRS_DEPRECIATION_RATES: DepreciationRate[] = [
  { assetClass: "buildings", rate: 5, method: "straight-line", description: "Buildings and structures" },
  { assetClass: "plant-machinery", rate: 20, method: "reducing-balance", description: "Plant and machinery" },
  { assetClass: "motor-vehicles", rate: 25, method: "reducing-balance", description: "Motor vehicles" },
  { assetClass: "furniture-fittings", rate: 20, method: "reducing-balance", description: "Furniture and fittings" },
  { assetClass: "computers", rate: 25, method: "reducing-balance", description: "Computer equipment" },
  { assetClass: "office-equipment", rate: 20, method: "reducing-balance", description: "Office equipment" },
];

// ============================================================================
// COMPLIANCE RULES
// ============================================================================

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  category: "FIRS" | "CAMA" | "IFRS" | "PENCOM" | "ITF" | "NSITF";
  severity: "error" | "warning" | "info";
  validate: (data: Record<string, unknown>) => ComplianceResult;
}

export interface ComplianceResult {
  passed: boolean;
  message: string;
  details?: string;
  recommendation?: string;
}

// Core compliance checks
export const COMPLIANCE_RULES: ComplianceRule[] = [
  {
    id: "firs-vat-threshold",
    name: "VAT Registration Threshold",
    description: "Companies with turnover above ₦25M must register for VAT",
    category: "FIRS",
    severity: "error",
    validate: (data) => {
      const turnover = (data.turnover as number) || 0;
      const isVatRegistered = data.isVatRegistered as boolean;
      if (turnover > 25_000_000 && !isVatRegistered) {
        return {
          passed: false,
          message: "VAT registration required",
          details: `Turnover of ₦${turnover.toLocaleString()} exceeds ₦25M threshold`,
          recommendation: "Register for VAT with FIRS immediately to avoid penalties",
        };
      }
      return { passed: true, message: "VAT compliance OK" };
    },
  },
  {
    id: "firs-wht-deduction",
    name: "WHT Deduction Requirement",
    description: "WHT must be deducted on qualifying payments",
    category: "FIRS",
    severity: "error",
    validate: (data) => {
      const hasQualifyingPayments = data.hasQualifyingPayments as boolean;
      const whtDeducted = data.whtDeducted as boolean;
      if (hasQualifyingPayments && !whtDeducted) {
        return {
          passed: false,
          message: "WHT not deducted on qualifying payments",
          recommendation: "Ensure WHT is deducted on rent, professional fees, contracts, etc.",
        };
      }
      return { passed: true, message: "WHT compliance OK" };
    },
  },
  {
    id: "pencom-contribution",
    name: "Pension Contribution",
    description: "Employers must contribute 10% of employee basic salary to pension",
    category: "PENCOM",
    severity: "error",
    validate: (data) => {
      const hasEmployees = (data.employeeCount as number) > 0;
      const pensionContributed = data.pensionContributed as boolean;
      if (hasEmployees && !pensionContributed) {
        return {
          passed: false,
          message: "Pension contributions not made",
          details: "Employer contribution: 10%, Employee: 8% of basic salary",
          recommendation: "Ensure monthly pension contributions are remitted to PFAs",
        };
      }
      return { passed: true, message: "Pension compliance OK" };
    },
  },
  {
    id: "itf-contribution",
    name: "ITF Contribution",
    description: "Companies with 5+ employees or ₦50M+ turnover must contribute 1% of payroll",
    category: "ITF",
    severity: "warning",
    validate: (data) => {
      const employeeCount = (data.employeeCount as number) || 0;
      const turnover = (data.turnover as number) || 0;
      const itfContributed = data.itfContributed as boolean;
      if ((employeeCount >= 5 || turnover >= 50_000_000) && !itfContributed) {
        return {
          passed: false,
          message: "ITF contribution required",
          details: "1% of annual payroll to Industrial Training Fund",
          recommendation: "Register with ITF and make quarterly contributions",
        };
      }
      return { passed: true, message: "ITF compliance OK" };
    },
  },
  {
    id: "nsitf-contribution",
    name: "NSITF Contribution",
    description: "Employers must contribute 1% of payroll to NSITF",
    category: "NSITF",
    severity: "warning",
    validate: (data) => {
      const hasEmployees = (data.employeeCount as number) > 0;
      const nsitfContributed = data.nsitfContributed as boolean;
      if (hasEmployees && !nsitfContributed) {
        return {
          passed: false,
          message: "NSITF contribution required",
          details: "1% of monthly payroll",
          recommendation: "Register with NSITF and make monthly contributions",
        };
      }
      return { passed: true, message: "NSITF compliance OK" };
    },
  },
  {
    id: "cama-audit",
    name: "Statutory Audit Requirement",
    description: "Companies above exemption threshold must have audited accounts",
    category: "CAMA",
    severity: "error",
    validate: (data) => {
      const turnover = (data.turnover as number) || 0;
      const hasAuditedAccounts = data.hasAuditedAccounts as boolean;
      // CAMA 2020 exemption: Small companies (turnover < ₦120M, net assets < ₦60M)
      if (turnover >= 120_000_000 && !hasAuditedAccounts) {
        return {
          passed: false,
          message: "Statutory audit required",
          details: "Companies with turnover ≥ ₦120M require audited financial statements",
          recommendation: "Engage a registered auditor for annual audit",
        };
      }
      return { passed: true, message: "Audit compliance OK" };
    },
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getAccountByCode(code: string): ChartOfAccount | undefined {
  return CHART_OF_ACCOUNTS.find(acc => acc.code === code);
}

export function getAccountsByClass(accountClass: AccountClass): ChartOfAccount[] {
  return CHART_OF_ACCOUNTS.filter(acc => acc.class === accountClass);
}

export function getAccountsBySubClass(subClass: AccountSubClass): ChartOfAccount[] {
  return CHART_OF_ACCOUNTS.filter(acc => acc.subClass === subClass);
}

export function getTaxDeductibleAccounts(): ChartOfAccount[] {
  return CHART_OF_ACCOUNTS.filter(acc => acc.taxDeductible === true);
}

export function getWHTApplicableAccounts(): ChartOfAccount[] {
  return CHART_OF_ACCOUNTS.filter(acc => acc.whtApplicable === true);
}

export function getWHTRate(transactionType: string): WHTRate | undefined {
  return FIRS_WHT_RATES.find(rate => rate.transactionType === transactionType);
}

export function getDepreciationRate(assetClass: string): DepreciationRate | undefined {
  return FIRS_DEPRECIATION_RATES.find(rate => rate.assetClass === assetClass);
}

export function runComplianceChecks(data: Record<string, unknown>): ComplianceResult[] {
  return COMPLIANCE_RULES.map(rule => ({
    ...rule.validate(data),
    ruleId: rule.id,
    ruleName: rule.name,
    category: rule.category,
    severity: rule.severity,
  }));
}
