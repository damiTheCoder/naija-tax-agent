import { calculateTaxForNigeria } from "../taxRules/ng";
import { UserProfile, TaxInputs } from "../types";
import { calculateStampDuty } from "../taxRules/stampDuty";

describe("Tax Engine V2 - Rulebook Driven", () => {
    const profile: UserProfile = {
        fullName: "John Doe",
        taxpayerType: "freelancer",
        taxYear: 2024,
        stateOfResidence: "Federal",
        isVATRegistered: false,
        currency: "NGN",
    };

    test("Worked Example Case: ₦10M Revenue, ₦2M Expenses, ₦500k Pension", () => {
        const inputs: TaxInputs = {
            grossRevenue: 10000000,
            allowableExpenses: 2000000,
            pensionContributions: 500000,
        };

        const result = calculateTaxForNigeria(profile, inputs);

        // Worked Example from Pseudocode:
        // Net Income = 8M
        // CRA = 1.8M
        // Reliefs = 1.8M + 500k = 2.3M
        // Taxable Income = 8M - 2.3M = 5.7M
        // PIT Total = 1,160,000

        expect(result.taxableIncome).toBe(5700000);
        expect(result.totalTaxDue).toBe(1160000);
        expect(result.reconciliationReport).toBeDefined();

        const craRow = result.reconciliationReport?.find(r => r.step_id === "CRA");
        expect(craRow?.value).toBe(1800000);
    });

    test("Minimum Tax Trigger (1% of Gross)", () => {
        const inputs: TaxInputs = {
            grossRevenue: 1000000,
            allowableExpenses: 950000,
        };

        const result = calculateTaxForNigeria(profile, inputs);
        expect(result.totalTaxDue).toBe(10000);
        expect(result.notes).toContain("Minimum tax rule applied (1% of gross revenue).");
    });

    test("CIT - Medium Company (20%)", () => {
        const citProfile: UserProfile = { ...profile, taxpayerType: "company" };
        const inputs: TaxInputs = { grossRevenue: 50000000, allowableExpenses: 10000000 };
        const result = calculateTaxForNigeria(citProfile, inputs);
        expect(result.totalTaxDue).toBe(8000000);
    });

    test("CIT - Minimum Tax (0.5% of Turnover)", () => {
        const citProfile: UserProfile = { ...profile, taxpayerType: "company" };
        const inputs: TaxInputs = {
            grossRevenue: 30000000, // 30M (Above small threshold)
            allowableExpenses: 29990000 // Very low profit
        };
        const result = calculateTaxForNigeria(citProfile, inputs);
        // Profit = 10k. CIT @ 20% = 2k.
        // Min Tax = 0.5% of 30M = 150k.
        expect(result.totalTaxDue).toBe(150000);
    });

    test("VAT - Input Tax Credit", () => {
        const vatProfile: UserProfile = { ...profile, isVATRegistered: true };
        const inputs: TaxInputs = {
            grossRevenue: 10000000,
            inputVATPaid: 200000
        };
        const result = calculateTaxForNigeria(vatProfile, inputs);
        // Output = 750k. Input = 200k. Net = 550k.
        expect(result.vat?.netVATPayable).toBe(550000);
    });
});

describe("Stamp Duty Engine V2", () => {
    test("Ad Valorem Deed (1.5%)", () => {
        const result = calculateStampDuty({
            documentType: 'deed',
            transactionValue: 10000000
        });
        expect(result.stampDuty).toBe(150000);
    });

    test("Ad Valorem Mortgage (0.375%)", () => {
        const result = calculateStampDuty({
            documentType: 'mortgage',
            transactionValue: 10000000
        });
        expect(result.stampDuty).toBe(37500);
    });

    test("Agreement (Fixed 500)", () => {
        const result = calculateStampDuty({
            documentType: 'agreement',
            transactionValue: 0
        });
        expect(result.stampDuty).toBe(500);
    });
});
