import fs from "fs";
import path from "path";

export type Jurisdiction = "Federal" | "Lagos" | "Ogun" | "Rivers" | "Kano" | "Other";
export type RoundingMethod = "bankers" | "nearest_naira" | "floor" | "ceil" | "two_decimal";
export type RuleType = "constant" | "expression" | "progressive_bands" | "min_tax";

export interface TaxBand {
    label: string;
    threshold: number; // The width of the band
    rate: number;
}

export interface TaxRule {
    type: RuleType;
    formula: string;
    description?: string;
    citation_id?: string;
    rounding?: RoundingMethod;
    caps?: {
        max_amount?: number;
        max_percentage_of?: string; // key of another rule or input
    };
    bands?: TaxBand[];
}

export interface LegalCitation {
    id: string;
    law: string;
    section: string;
    document_url?: string;
    text: string;
}

export interface RuleBookMetadata {
    tax_year: string;
    jurisdiction: Jurisdiction;
    version: string;
    effective_date: string;
    expiry_date?: string;
    legal_reference?: string;
}

export interface TaxRuleBook {
    metadata: RuleBookMetadata;
    citations?: LegalCitation[];
    rules: Record<string, TaxRule>;
}

export interface ReconciliationRow {
    step_id: string;
    label: string;
    value: number;
    formula?: string;
    rule_key?: string;
    citation?: string;
    law_ref?: string;
    notes?: string;
}

export interface EnhancedTaxResult {
    totalTaxDue: number;
    taxableIncome: number;
    reconciliationReport: ReconciliationRow[];
    metadata: RuleBookMetadata;
}

/**
 * Loads a rulebook from the filesystem based on year and jurisdiction.
 */
export function loadRuleBook(year: string, jurisdiction: Jurisdiction = "Federal"): TaxRuleBook {
    const fileName = `ng_${jurisdiction.toLowerCase()}_${year}.json`;
    const filePath = path.join(process.cwd(), "data", "rules", fileName);

    if (!fs.existsSync(filePath)) {
        throw new Error(`CRITICAL: Tax rulebook missing for ${jurisdiction} in ${year}. Expected at ${filePath}`);
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as TaxRuleBook;
}

/**
 * Simple expression evaluator for the tax engine.
 * Supports basic math and variable substitution.
 */
export function evaluateFormula(formula: string, context: Record<string, number>): number {
    // Replace variables with their values
    let processed = formula;
    for (const [key, value] of Object.entries(context)) {
        // Use regex to avoid partial matches (e.g., 'income' matching 'gross_income')
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        processed = processed.replace(regex, value.toString());
    }

    try {
        // Safety check: only allow numbers, math operators, and parentheses
        if (/[^0-9+\-*/().\s]/.test(processed)) {
            throw new Error(`Unsafe characters in evaluated formula: ${processed}`);
        }
        // eslint-disable-next-line no-new-func
        return new Function(`return ${processed}`)();
    } catch (error) {
        console.error(`Failed to evaluate formula: ${formula} (processed: ${processed})`, error);
        return 0;
    }
}

/**
 * Applies progressive tax bands to a given income.
 */
export function calculateProgressiveTax(income: number, bands: TaxBand[]): { total: number; breakdown: ReconciliationRow[] } {
    let remaining = income;
    let total = 0;
    const breakdown: ReconciliationRow[] = [];

    for (const band of bands) {
        if (remaining <= 0) break;
        const incomeInBand = Math.min(remaining, band.threshold);
        const taxInBand = incomeInBand * band.rate;
        total += taxInBand;

        breakdown.push({
            step_id: `BAND_${band.label.replace(/\s+/g, '_')}`,
            label: `Tax at ${band.label} (${(band.rate * 100).toFixed(0)}%)`,
            value: taxInBand,
            formula: `${incomeInBand.toLocaleString()} * ${band.rate}`,
            notes: `Income in band: ${incomeInBand}`
        });

        remaining -= incomeInBand;
    }

    return { total, breakdown };
}
