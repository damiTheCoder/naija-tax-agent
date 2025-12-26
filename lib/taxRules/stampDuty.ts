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
    transactionValue: number;
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
    let formula = "";
    let citation = "SDA Schedule";

    switch (input.documentType) {
        case 'agreement':
            ruleKey = "STAMP_AGREEMENT_FIXED";
            label = "Fixed Duty on Agreement";
            stampDuty = evaluateFormula(rulebook.rules[ruleKey].formula, {});
            formula = `Fixed: ${stampDuty.toLocaleString()}`;
            break;

        case 'deed':
            ruleKey = "STAMP_DEED_RATE";
            label = "Ad Valorem Duty on Deed (1.5%)";
            const deedRate = evaluateFormula(rulebook.rules[ruleKey].formula, {});
            stampDuty = input.transactionValue * deedRate;
            formula = `${input.transactionValue.toLocaleString()} * ${deedRate}`;
            break;

        case 'mortgage':
            ruleKey = "STAMP_MORTGAGE_RATE";
            label = "Ad Valorem Duty on Mortgage (0.375%)";
            const mortgageRate = evaluateFormula(rulebook.rules[ruleKey].formula, {});
            stampDuty = input.transactionValue * mortgageRate;
            formula = `${input.transactionValue.toLocaleString()} * ${mortgageRate}`;
            break;

        default:
            // Fallback for other types using fixed 500
            stampDuty = 500;
            label = "General Fixed duty";
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
        transactionValue: input.transactionValue,
        stampDuty,
        reconciliationReport,
        note: `Stamp duty calculated per rulebook ${rulebook.metadata.version}`
    };
}
