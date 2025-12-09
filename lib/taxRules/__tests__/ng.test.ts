/**
 * Unit tests for Nigerian Tax Calculator
 */

import { describe, it, expect } from "vitest";
import { calculateTaxForNigeria } from "../ng";
import { UserProfile, TaxInputs } from "../../types";

describe("calculateTaxForNigeria", () => {
    describe("Freelancer (PIT)", () => {
        it("should calculate positive tax for freelancer with significant income", () => {
            const profile: UserProfile = {
                fullName: "John Doe",
                taxpayerType: "freelancer",
                taxYear: 2024,
                stateOfResidence: "Lagos",
                isVATRegistered: false,
                currency: "NGN",
            };

            const inputs: TaxInputs = {
                grossRevenue: 5000000, // ₦5 million
                allowableExpenses: 1000000, // ₦1 million
                pensionContributions: 200000,
            };

            const result = calculateTaxForNigeria(profile, inputs);

            expect(result.taxpayerType).toBe("freelancer");
            expect(result.taxYear).toBe(2024);
            expect(result.taxableIncome).toBeGreaterThan(0);
            expect(result.totalTaxDue).toBeGreaterThan(0);
            expect(result.effectiveRate).toBeGreaterThan(0);
            expect(result.bands.length).toBeGreaterThan(0);
            expect(result.vat).toBeUndefined();
        });

        it("should calculate tax close to zero for very small income", () => {
            const profile: UserProfile = {
                fullName: "Jane Doe",
                taxpayerType: "freelancer",
                taxYear: 2024,
                stateOfResidence: "FCT (Abuja)",
                isVATRegistered: false,
                currency: "NGN",
            };

            const inputs: TaxInputs = {
                grossRevenue: 200000, // ₦200,000 - below CRA threshold
                allowableExpenses: 50000,
            };

            const result = calculateTaxForNigeria(profile, inputs);

            // With CRA of at least ₦200,000 + 20% = ₦240,000, taxable income should be 0
            expect(result.taxableIncome).toBe(0);
            // But minimum tax may apply (1% of gross)
            expect(result.totalTaxDue).toBeLessThanOrEqual(inputs.grossRevenue * 0.01);
        });

        it("should include VAT when registered", () => {
            const profile: UserProfile = {
                fullName: "VAT Freelancer",
                taxpayerType: "freelancer",
                taxYear: 2024,
                stateOfResidence: "Rivers",
                isVATRegistered: true,
                currency: "NGN",
            };

            const inputs: TaxInputs = {
                grossRevenue: 3000000,
                allowableExpenses: 500000,
            };

            const result = calculateTaxForNigeria(profile, inputs);

            expect(result.vat).toBeDefined();
            expect(result.vat?.vatRate).toBe(0.075);
            expect(result.vat?.outputVAT).toBe(3000000 * 0.075);
            expect(result.vat?.netVATPayable).toBe(3000000 * 0.075);
        });

        it("should apply reliefs correctly", () => {
            const profile: UserProfile = {
                fullName: "Relief Test",
                taxpayerType: "freelancer",
                taxYear: 2024,
                stateOfResidence: "Ogun",
                isVATRegistered: false,
                currency: "NGN",
            };

            const inputsWithoutReliefs: TaxInputs = {
                grossRevenue: 4000000,
                allowableExpenses: 500000,
            };

            const inputsWithReliefs: TaxInputs = {
                grossRevenue: 4000000,
                allowableExpenses: 500000,
                pensionContributions: 300000,
                nhfContributions: 100000,
                lifeInsurancePremiums: 50000,
            };

            const resultWithout = calculateTaxForNigeria(profile, inputsWithoutReliefs);
            const resultWith = calculateTaxForNigeria(profile, inputsWithReliefs);

            expect(resultWith.taxableIncome).toBeLessThan(resultWithout.taxableIncome);
            expect(resultWith.totalTaxDue).toBeLessThan(resultWithout.totalTaxDue);
        });
    });

    describe("Company (CIT)", () => {
        it("should calculate 0% CIT for small company under ₦25M threshold", () => {
            const profile: UserProfile = {
                fullName: "Small Corp",
                businessName: "Small Corp Ltd",
                taxpayerType: "company",
                taxYear: 2024,
                stateOfResidence: "Lagos",
                isVATRegistered: false,
                currency: "NGN",
            };

            const inputs: TaxInputs = {
                grossRevenue: 20000000, // ₦20 million - under ₦25M threshold
                allowableExpenses: 5000000,
                turnover: 20000000,
                costOfSales: 8000000,
                operatingExpenses: 3000000,
            };

            const result = calculateTaxForNigeria(profile, inputs);

            expect(result.taxpayerType).toBe("company");
            expect(result.totalTaxDue).toBe(0);
            expect(result.bands.length).toBe(1);
            expect(result.bands[0].rate).toBe(0);
        });

        it("should calculate 20% CIT for medium company", () => {
            const profile: UserProfile = {
                fullName: "Medium Corp",
                businessName: "Medium Corp Ltd",
                taxpayerType: "company",
                taxYear: 2024,
                stateOfResidence: "Lagos",
                isVATRegistered: true,
                currency: "NGN",
            };

            const inputs: TaxInputs = {
                grossRevenue: 50000000, // ₦50 million
                allowableExpenses: 10000000,
                turnover: 50000000,
                costOfSales: 20000000,
                operatingExpenses: 10000000,
            };

            const result = calculateTaxForNigeria(profile, inputs);

            expect(result.taxpayerType).toBe("company");
            expect(result.bands[0].rate).toBe(0.20);
            expect(result.totalTaxDue).toBeGreaterThan(0);
            expect(result.vat).toBeDefined();
        });

        it("should calculate 30% CIT for large company", () => {
            const profile: UserProfile = {
                fullName: "Large Corp",
                businessName: "Large Corp Plc",
                taxpayerType: "company",
                taxYear: 2024,
                stateOfResidence: "Lagos",
                isVATRegistered: true,
                currency: "NGN",
            };

            const inputs: TaxInputs = {
                grossRevenue: 150000000, // ₦150 million
                allowableExpenses: 30000000,
                turnover: 150000000,
                costOfSales: 60000000,
                operatingExpenses: 30000000,
                capitalAllowance: 10000000,
            };

            const result = calculateTaxForNigeria(profile, inputs);

            expect(result.taxpayerType).toBe("company");
            expect(result.bands[0].rate).toBe(0.30);
            expect(result.totalTaxDue).toBeGreaterThan(0);
        });
    });

    describe("Edge Cases", () => {
        it("should handle zero income gracefully", () => {
            const profile: UserProfile = {
                fullName: "Zero Income",
                taxpayerType: "freelancer",
                taxYear: 2024,
                stateOfResidence: "Kano",
                isVATRegistered: false,
                currency: "NGN",
            };

            const inputs: TaxInputs = {
                grossRevenue: 0,
                allowableExpenses: 0,
            };

            const result = calculateTaxForNigeria(profile, inputs);

            expect(result.taxableIncome).toBe(0);
            expect(result.totalTaxDue).toBe(0);
            expect(result.effectiveRate).toBe(0);
        });

        it("should not produce negative taxable income", () => {
            const profile: UserProfile = {
                fullName: "Loss Maker",
                taxpayerType: "freelancer",
                taxYear: 2024,
                stateOfResidence: "Kaduna",
                isVATRegistered: false,
                currency: "NGN",
            };

            const inputs: TaxInputs = {
                grossRevenue: 500000,
                allowableExpenses: 800000, // Expenses exceed revenue
            };

            const result = calculateTaxForNigeria(profile, inputs);

            expect(result.taxableIncome).toBeGreaterThanOrEqual(0);
        });
    });
});
