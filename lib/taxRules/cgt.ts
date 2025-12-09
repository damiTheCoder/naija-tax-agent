/**
 * Capital Gains Tax (CGT) Calculator for Nigeria
 * 
 * CGT Rate: 10% on chargeable gains from disposal of assets
 * Legal Basis: Capital Gains Tax Act Cap C1 LFN 2004
 */

export interface CGTInput {
    assetType: 'real_estate' | 'shares' | 'business_assets' | 'other';
    assetDescription: string;
    acquisitionDate: string;      // ISO date
    acquisitionCost: number;
    improvementCosts?: number;    // Capital improvements
    disposalDate: string;         // ISO date
    disposalProceeds: number;
    sellingExpenses?: number;     // Legal fees, agent fees, etc.
}

export interface CGTResult {
    acquisitionCost: number;
    improvementCosts: number;
    totalCost: number;
    disposalProceeds: number;
    sellingExpenses: number;
    chargeableGain: number;
    cgtRate: number;
    cgtPayable: number;
    isExempt: boolean;
    exemptionReason?: string;
}

// CGT Rate - 10% flat rate
export const CGT_RATE = 0.10;

// Exempt assets under Nigerian CGT Act
export const CGT_EXEMPTIONS = [
    'Decorations awarded for valour or gallant conduct',
    'Life insurance policy proceeds',
    'Government securities',
    'Gains from Nigerian government stocks',
    'Ecclesiastical, charitable or educational institutions assets',
    'Approved pension fund assets',
    'Trade union assets',
];

/**
 * Calculate Capital Gains Tax
 */
export function calculateCGT(input: CGTInput): CGTResult {
    const improvementCosts = input.improvementCosts || 0;
    const sellingExpenses = input.sellingExpenses || 0;

    const totalCost = input.acquisitionCost + improvementCosts;
    const netProceeds = input.disposalProceeds - sellingExpenses;

    // Calculate gain (can be negative if loss)
    const gain = netProceeds - totalCost;

    // Only positive gains are taxable
    const chargeableGain = Math.max(0, gain);

    // Calculate CGT
    const cgtPayable = chargeableGain * CGT_RATE;

    return {
        acquisitionCost: input.acquisitionCost,
        improvementCosts,
        totalCost,
        disposalProceeds: input.disposalProceeds,
        sellingExpenses,
        chargeableGain,
        cgtRate: CGT_RATE,
        cgtPayable,
        isExempt: false,
        exemptionReason: undefined,
    };
}

/**
 * Calculate CGT for multiple disposals
 */
export function calculateTotalCGT(inputs: CGTInput[]): {
    disposals: CGTResult[];
    totalGain: number;
    totalCGT: number;
} {
    const disposals = inputs.map(calculateCGT);
    const totalGain = disposals.reduce((sum, d) => sum + d.chargeableGain, 0);
    const totalCGT = disposals.reduce((sum, d) => sum + d.cgtPayable, 0);

    return {
        disposals,
        totalGain,
        totalCGT,
    };
}
