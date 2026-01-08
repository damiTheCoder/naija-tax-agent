/**
 * Nigerian Tax Configuration
 * 
 * IMPORTANT: These rates and thresholds are based on 2026 Nigerian Tax Reform Acts.
 * They MUST be verified with FIRS/SIRS or a qualified tax professional.
 * 
 * Last updated: January 2026
 */

// Personal Income Tax (PIT) Progressive Bands - 2026 Reform
// 0% up to N800k, progressive to 25%
export interface PITBand {
    label: string;
    upperLimit: number; // NGN - use Infinity for the highest band
    rate: number;       // Decimal (e.g., 0.07 = 7%)
}

export const PIT_BANDS: PITBand[] = [
    { label: "First ₦800,000", upperLimit: 800000, rate: 0.00 }, // Exempt
    { label: "Next ₦2,200,000", upperLimit: 3000000, rate: 0.15 },
    { label: "Next ₦9,000,000", upperLimit: 12000000, rate: 0.18 },
    { label: "Next ₦13,000,000", upperLimit: 25000000, rate: 0.21 },
    { label: "Next ₦25,000,000", upperLimit: 50000000, rate: 0.23 },
    { label: "Above ₦50,000,000", upperLimit: Infinity, rate: 0.25 },
];

// Consolidated Relief Allowance (CRA) - Modified/Removed in 2026?
// For backward compatibility, keeping structure but might need adjustment
export const CRA_FIXED_AMOUNT = 200000; // ₦200,000
export const CRA_PERCENTAGE_OF_GROSS = 0.01; // 1%
export const CRA_ADDITIONAL_PERCENTAGE = 0.20; // 20%

// Company Income Tax (CIT) for SMEs - 2026
// Small (Turnover < 50M): Exempt
// Large (Turnover >= 50M): 30%
export interface CITConfig {
    smallCompanyThreshold: number;
    smallCompanyRate: number;
    mediumCompanyThreshold: number; // Consolidated to Large in 2026
    mediumCompanyRate: number;
    largeCompanyRate: number;
}

export const CIT_CONFIG: CITConfig = {
    smallCompanyThreshold: 50000000,   // ₦50 million
    smallCompanyRate: 0,               // 0%
    mediumCompanyThreshold: 50000000,  // Consolidated
    mediumCompanyRate: 0.30,           // 30%
    largeCompanyRate: 0.30,            // 30%
};

// Value Added Tax (VAT) - Unchanged 2026
export const VAT_RATE = 0.075; // 7.5%

// Development Levy (Replaces previous levies)
export const DEVELOPMENT_LEVY_RATE = 0.04; // 4%

// Minimum Tax - Abolished in 2026
export const MINIMUM_TAX_RATE = 0;

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
