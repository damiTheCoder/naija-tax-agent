/**
 * Withholding Tax (WHT) Configuration for Nigeria
 * 
 * Based on Nigerian Withholding Tax regulations.
 * Rates vary by payment type and resident/non-resident status.
 */

export interface WHTRate {
    paymentType: string;
    description: string;
    residentRate: number;    // Rate for Nigerian residents
    nonResidentRate: number; // Rate for non-residents
}

export const WHT_RATES: WHTRate[] = [
    {
        paymentType: "dividends",
        description: "Dividends & distributions",
        residentRate: 0.10,    // 10%
        nonResidentRate: 0.10, // 10%
    },
    {
        paymentType: "interest",
        description: "Interest payments",
        residentRate: 0.10,    // 10%
        nonResidentRate: 0.10, // 10%
    },
    {
        paymentType: "royalties",
        description: "Royalties & licensing fees",
        residentRate: 0.10,    // 10%
        nonResidentRate: 0.10, // 10%
    },
    {
        paymentType: "rent",
        description: "Rent payments",
        residentRate: 0.10,    // 10%
        nonResidentRate: 0.10, // 10%
    },
    {
        paymentType: "professional_fees_individual",
        description: "Professional fees (individuals)",
        residentRate: 0.05,    // 5%
        nonResidentRate: 0.10, // 10%
    },
    {
        paymentType: "professional_fees_company",
        description: "Professional fees (companies)",
        residentRate: 0.10,    // 10%
        nonResidentRate: 0.15, // 15%
    },
    {
        paymentType: "consultancy",
        description: "Consultancy & management fees",
        residentRate: 0.10,    // 10%
        nonResidentRate: 0.10, // 10%
    },
    {
        paymentType: "technical_services",
        description: "Technical service fees",
        residentRate: 0.10,    // 10%
        nonResidentRate: 0.10, // 10%
    },
    {
        paymentType: "commissions",
        description: "Commissions & bonuses",
        residentRate: 0.10,    // 10%
        nonResidentRate: 0.10, // 10%
    },
    {
        paymentType: "construction",
        description: "Construction & building services",
        residentRate: 0.05,    // 5%
        nonResidentRate: 0.05, // 5%
    },
    {
        paymentType: "contracts",
        description: "Contract supplies & services",
        residentRate: 0.05,    // 5%
        nonResidentRate: 0.05, // 5%
    },
];

// WHT exemption threshold for certain payment types
export const WHT_THRESHOLD = 0; // No threshold for WHT in Nigeria (applies to all amounts)
