/**
 * Stamp Duties Calculator for Nigeria
 * 
 * Stamp duties are charged on various instruments/documents
 * Legal Basis: Stamp Duties Act Cap S8 LFN 2004
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

export interface StampDutyRate {
    documentType: StampDutyDocumentType;
    description: string;
    rateType: 'fixed' | 'percentage' | 'tiered';
    fixedAmount?: number;
    percentageRate?: number;
    threshold?: number;         // Minimum amount before duty applies
}

export interface StampDutyInput {
    documentType: StampDutyDocumentType;
    transactionValue: number;
    isElectronic?: boolean;     // Electronic transfers have flat rate
}

export interface StampDutyResult {
    documentType: StampDutyDocumentType;
    documentDescription: string;
    transactionValue: number;
    rate: string;
    stampDuty: number;
    note: string;
}

// Stamp duty rates for various documents
export const STAMP_DUTY_RATES: StampDutyRate[] = [
    {
        documentType: 'agreement',
        description: 'Agreement or Memorandum of Agreement',
        rateType: 'fixed',
        fixedAmount: 500,
    },
    {
        documentType: 'lease',
        description: 'Lease Agreement',
        rateType: 'percentage',
        percentageRate: 0.0078,  // 0.78%
    },
    {
        documentType: 'deed',
        description: 'Deed of Assignment (Property)',
        rateType: 'percentage',
        percentageRate: 0.015,   // 1.5%
    },
    {
        documentType: 'mortgage',
        description: 'Mortgage Deed',
        rateType: 'percentage',
        percentageRate: 0.015,   // 1.5%
    },
    {
        documentType: 'share_transfer',
        description: 'Share Transfer Form',
        rateType: 'percentage',
        percentageRate: 0.0075,  // 0.75%
    },
    {
        documentType: 'power_of_attorney',
        description: 'Power of Attorney',
        rateType: 'fixed',
        fixedAmount: 2000,
    },
    {
        documentType: 'receipt',
        description: 'Receipt (above N4 threshold)',
        rateType: 'fixed',
        fixedAmount: 1,         // N1 for first N1000, then N0.50 per N1000
        threshold: 4,
    },
    {
        documentType: 'insurance_policy',
        description: 'Insurance Policy',
        rateType: 'percentage',
        percentageRate: 0.0025,  // 0.25%
    },
    {
        documentType: 'bank_transfer',
        description: 'Electronic Bank Transfer',
        rateType: 'fixed',
        fixedAmount: 50,        // N50 flat rate for transfers >= N10,000
        threshold: 10000,
    },
    {
        documentType: 'other',
        description: 'Other Documents',
        rateType: 'fixed',
        fixedAmount: 500,
    },
];

/**
 * Get stamp duty rate info for a document type
 */
export function getStampDutyRate(documentType: StampDutyDocumentType): StampDutyRate | undefined {
    return STAMP_DUTY_RATES.find(r => r.documentType === documentType);
}

/**
 * Calculate stamp duty for a document
 */
export function calculateStampDuty(input: StampDutyInput): StampDutyResult {
    const rateInfo = getStampDutyRate(input.documentType);

    if (!rateInfo) {
        return {
            documentType: input.documentType,
            documentDescription: 'Unknown Document',
            transactionValue: input.transactionValue,
            rate: 'N/A',
            stampDuty: 0,
            note: 'Document type not found',
        };
    }

    let stampDuty = 0;
    let rate = '';

    // Check threshold
    if (rateInfo.threshold && input.transactionValue < rateInfo.threshold) {
        return {
            documentType: input.documentType,
            documentDescription: rateInfo.description,
            transactionValue: input.transactionValue,
            rate: 'Below threshold',
            stampDuty: 0,
            note: `No duty - transaction below ₦${rateInfo.threshold.toLocaleString()} threshold`,
        };
    }

    switch (rateInfo.rateType) {
        case 'fixed':
            stampDuty = rateInfo.fixedAmount || 0;
            rate = `₦${stampDuty.toLocaleString()} flat`;
            break;

        case 'percentage':
            const percentRate = rateInfo.percentageRate || 0;
            stampDuty = input.transactionValue * percentRate;
            rate = `${(percentRate * 100).toFixed(2)}%`;
            break;

        case 'tiered':
            // Implement tiered calculation if needed
            stampDuty = 0;
            rate = 'Tiered';
            break;
    }

    return {
        documentType: input.documentType,
        documentDescription: rateInfo.description,
        transactionValue: input.transactionValue,
        rate,
        stampDuty,
        note: `Stamp duty calculated per Stamp Duties Act`,
    };
}

/**
 * Calculate stamp duties for multiple documents
 */
export function calculateTotalStampDuty(inputs: StampDutyInput[]): {
    documents: StampDutyResult[];
    totalDuty: number;
} {
    const documents = inputs.map(calculateStampDuty);
    const totalDuty = documents.reduce((sum, d) => sum + d.stampDuty, 0);

    return {
        documents,
        totalDuty,
    };
}
