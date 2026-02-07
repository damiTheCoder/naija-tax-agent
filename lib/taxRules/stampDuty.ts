import {
    loadRuleBook,
    evaluateFormula,
    ReconciliationRow
} from "./rulebook";

/**
 * Stamp Duties Calculator for Nigeria (V2 - Rulebook Driven)
 */

export type StampDutyDocumentType =
    | 'agreement'           // General agreements
    | 'lease'               // Lease agreements
    | 'deed'                // Deeds of assignment
    | 'mortgage'            // Mortgage documents
    | 'share_transfer'      // Share transfer forms
    | 'power_of_attorney'   // Power of attorney
    | 'receipt'             // Receipts above threshold
    | 'insurance_policy'    // Insurance policies
    | 'bank_transfer'       // Electronic bank transfers
    | 'other';

export interface StampDutyInput {
    documentType: StampDutyDocumentType;
    transactionValue: number;
    taxYear?: number;
    jurisdiction?: string;
}

export interface StampDutyResult {
    documentType: StampDutyDocumentType;
    documentDescription: string;
    transactionValue: number;
    rate: string;
    stampDuty: number;
    reconciliationReport: ReconciliationRow[];
    note: string;
}

/**
 * Calculate stamp duty for a document using the rulebook
 */
export function calculateStampDuty(input: StampDutyInput): StampDutyResult {
    const year = (input.taxYear || 2024).toString();
    const jurisdiction = (input.jurisdiction || "Federal") as any;
    const rulebook = loadRuleBook(year, jurisdiction);
    const reconciliationReport: ReconciliationRow[] = [];

    let stampDuty = 0;
    let ruleKey = "";
    let label = "";
    let rateDescription = "";
    let formula = "";
    let citation = "SDA Schedule";

    switch (input.documentType) {
        case 'agreement':
            ruleKey = "STAMP_AGREEMENT_FIXED";
            label = "Fixed Duty on Agreement";
            rateDescription = "Fixed";
            stampDuty = evaluateFormula(rulebook.rules[ruleKey].formula, {});
            formula = `Fixed: ${(stampDuty || 0).toLocaleString()}`;
            break;

        case 'deed':
            ruleKey = "STAMP_DEED_RATE";
            label = "Ad Valorem Duty on Deed";
            rateDescription = "1.5%";
            const deedRate = evaluateFormula(rulebook.rules[ruleKey].formula, {});
            stampDuty = input.transactionValue * deedRate;
            formula = `${(input.transactionValue || 0).toLocaleString()} * ${deedRate}`;
            break;

        case 'mortgage':
            ruleKey = "STAMP_MORTGAGE_RATE";
            label = "Ad Valorem Duty on Mortgage";
            rateDescription = "0.375%";
            const mortgageRate = evaluateFormula(rulebook.rules[ruleKey].formula, {});
            stampDuty = input.transactionValue * mortgageRate;
            formula = `${(input.transactionValue || 0).toLocaleString()} * ${mortgageRate}`;
            break;

        default:
            // Fallback for other types using fixed 500
            stampDuty = 500;
            label = "General Fixed Duty";
            rateDescription = "Fixed";
            formula = "500";
    }


    const row: ReconciliationRow = {
        step_id: `STAMP_${input.documentType.toUpperCase()}`,
        label: label,
        value: stampDuty,
        formula: formula,
        rule_key: ruleKey,
        citation: citation
    };
    reconciliationReport.push(row);

    return {
        documentType: input.documentType,
        documentDescription: label,
        transactionValue: input.transactionValue,
        rate: rateDescription,
        stampDuty,
        reconciliationReport,
        note: `Stamp duty calculated per rulebook ${rulebook.metadata.version}`
    };
}

export const STAMP_DUTY_RATES = {
    agreement: { label: "General Agreement", rate: "Fixed ₦1,000", type: "fixed" },
    lease: { label: "Lease Agreement", rate: "6% of Rent", type: "ad_valorem" },
    deed: { label: "Deed of Assignment", rate: "1.5%", type: "ad_valorem" },
    mortgage: { label: "Mortgage", rate: "0.375%", type: "ad_valorem" },
    share_transfer: { label: "Share Transfer", rate: "0.75%", type: "ad_valorem" },
    power_of_attorney: { label: "Power of Attorney", rate: "Fixed", type: "fixed" },
    receipt: { label: "Receipt > ₦10k", rate: "₦50", type: "fixed" },
    insurance_policy: { label: "Insurance Policy", rate: "0.75%", type: "ad_valorem" },
    bank_transfer: { label: "Bank Transfer > ₦10k", rate: "₦50", type: "fixed" },
    other: { label: "Other Instruments", rate: "Fixed/Agreed", type: "mixed" }
};

export function calculateTotalStampDuty(documents: StampDutyInput[]): { documents: StampDutyResult[], totalDuty: number } {
    const results = documents.map(doc => calculateStampDuty(doc));
    const totalDuty = results.reduce((sum, res) => sum + res.stampDuty, 0);
    return {
        documents: results,
        totalDuty
    };
}
