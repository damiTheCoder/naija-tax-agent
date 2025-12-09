/**
 * Nigerian Tax Configuration
 * 
 * IMPORTANT: These rates and thresholds are ILLUSTRATIVE and based on
 * simplified interpretations of Nigerian tax law. They MUST be verified
 * with FIRS/SBIRS or a qualified tax professional before production use.
 * 
 * Last updated: December 2024
 */

// Personal Income Tax (PIT) Progressive Bands
// Based on Nigerian Personal Income Tax Act (PITA)
export interface PITBand {
    label: string;
    upperLimit: number; // NGN - use Infinity for the highest band
    rate: number;       // Decimal (e.g., 0.07 = 7%)
}

export const PIT_BANDS: PITBand[] = [
    { label: "First ₦300,000", upperLimit: 300000, rate: 0.07 },
    { label: "Next ₦300,000", upperLimit: 600000, rate: 0.11 },
    { label: "Next ₦500,000", upperLimit: 1100000, rate: 0.15 },
    { label: "Next ₦500,000", upperLimit: 1600000, rate: 0.19 },
    { label: "Next ₦1,600,000", upperLimit: 3200000, rate: 0.21 },
    { label: "Above ₦3,200,000", upperLimit: Infinity, rate: 0.24 },
];

// Consolidated Relief Allowance (CRA)
// Higher of ₦200,000 or 1% of gross income PLUS 20% of gross income
export const CRA_FIXED_AMOUNT = 200000; // ₦200,000
export const CRA_PERCENTAGE_OF_GROSS = 0.01; // 1%
export const CRA_ADDITIONAL_PERCENTAGE = 0.20; // 20%

// Company Income Tax (CIT) for SMEs
// Based on Finance Act provisions for small and medium companies
export interface CITConfig {
    // Small companies: Turnover ≤ ₦25 million = 0% CIT
    smallCompanyThreshold: number;
    smallCompanyRate: number;
    // Medium companies: Turnover > ₦25 million but ≤ ₦100 million = 20% CIT
    mediumCompanyThreshold: number;
    mediumCompanyRate: number;
    // Large companies: Turnover > ₦100 million = 30% CIT
    largeCompanyRate: number;
}

export const CIT_CONFIG: CITConfig = {
    smallCompanyThreshold: 25000000,   // ₦25 million
    smallCompanyRate: 0,               // 0%
    mediumCompanyThreshold: 100000000, // ₦100 million
    mediumCompanyRate: 0.20,           // 20%
    largeCompanyRate: 0.30,            // 30%
};

// Value Added Tax (VAT)
export const VAT_RATE = 0.075; // 7.5%

// Minimum Tax
// Applies when computed tax is less than minimum tax
export const MINIMUM_TAX_RATE = 0.01; // 1% of gross income

// Nigerian States for residence selection
export const NIGERIAN_STATES = [
    "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
    "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
    "FCT (Abuja)", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
    "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
    "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

// Default tax year
export const DEFAULT_TAX_YEAR = new Date().getFullYear();
