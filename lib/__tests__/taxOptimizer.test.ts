/**
 * Unit tests for Tax Optimizer
 */

import { describe, it, expect } from "vitest";
import { generateOptimizations } from "../taxOptimizer";
import { UserProfile, TaxInputs, TaxResult } from "./types";

describe("generateOptimizations", () => {
    describe("Freelancer optimizations", () => {
        it("should suggest pension contributions when not maximized", () => {
            const profile: UserProfile = {
                fullName: "John Doe",
                taxpayerType: "freelancer",
                taxYear: 2024,
                stateOfResidence: "Lagos",
                isVATRegistered: false,
                currency: "NGN",
            };

            const inputs: TaxInputs = {
                grossRevenue: 5000000,
                allowableExpenses: 1000000,
                pensionContributions: 0, // No pension
            };

            const result: TaxResult = {
                taxpayerType: "freelancer",
                taxYear: 2024,
                taxableIncome: 2800000,
                totalTaxDue: 400000,
                effectiveRate: 0.14,
                bands: [],
                notes: [],
            };

            const optimizations = generateOptimizations(profile, inputs, result);

            expect(optimizations.suggestions.length).toBeGreaterThan(0);

            const pensionSuggestion = optimizations.suggestions.find(s => s.type === "pension");
            expect(pensionSuggestion).toBeDefined();
            expect(pensionSuggestion?.potentialSavings).toBeGreaterThan(0);
        });

        it("should suggest expense documentation when expense ratio is low", () => {
            const profile: UserProfile = {
                fullName: "Jane Doe",
                taxpayerType: "freelancer",
                taxYear: 2024,
                stateOfResidence: "Abuja",
                isVATRegistered: false,
                currency: "NGN",
            };

            const inputs: TaxInputs = {
                grossRevenue: 10000000,
                allowableExpenses: 500000, // Only 5% expense ratio
            };

            const result: TaxResult = {
                taxpayerType: "freelancer",
                taxYear: 2024,
                taxableIncome: 7500000,
                totalTaxDue: 1500000,
                effectiveRate: 0.20,
                bands: [],
                notes: [],
            };

            const optimizations = generateOptimizations(profile, inputs, result);

            const expenseSuggestion = optimizations.suggestions.find(s => s.type === "expense_documentation");
            expect(expenseSuggestion).toBeDefined();
            expect(expenseSuggestion?.priority).toBe("high");
        });

        it("should suggest VAT registration for high-revenue freelancers", () => {
            const profile: UserProfile = {
                fullName: "High Earner",
                taxpayerType: "freelancer",
                taxYear: 2024,
                stateOfResidence: "Lagos",
                isVATRegistered: false,
                currency: "NGN",
            };

            const inputs: TaxInputs = {
                grossRevenue: 30000000, // Above ₦25M threshold
                allowableExpenses: 5000000,
            };

            const result: TaxResult = {
                taxpayerType: "freelancer",
                taxYear: 2024,
                taxableIncome: 20000000,
                totalTaxDue: 4000000,
                effectiveRate: 0.20,
                bands: [],
                notes: [],
            };

            const optimizations = generateOptimizations(profile, inputs, result);

            const vatSuggestion = optimizations.suggestions.find(s => s.type === "vat_registration");
            expect(vatSuggestion).toBeDefined();
            expect(vatSuggestion?.priority).toBe("high");
        });

        it("should not suggest VAT registration if already registered", () => {
            const profile: UserProfile = {
                fullName: "VAT Registered",
                taxpayerType: "freelancer",
                taxYear: 2024,
                stateOfResidence: "Lagos",
                isVATRegistered: true,
                currency: "NGN",
            };

            const inputs: TaxInputs = {
                grossRevenue: 30000000,
                allowableExpenses: 5000000,
            };

            const result: TaxResult = {
                taxpayerType: "freelancer",
                taxYear: 2024,
                taxableIncome: 20000000,
                totalTaxDue: 4000000,
                effectiveRate: 0.20,
                bands: [],
                notes: [],
            };

            const optimizations = generateOptimizations(profile, inputs, result);

            const vatSuggestion = optimizations.suggestions.find(s => s.type === "vat_registration");
            expect(vatSuggestion).toBeUndefined();
        });
    });

    describe("Company optimizations", () => {
        it("should suggest capital allowance for companies without it", () => {
            const profile: UserProfile = {
                fullName: "Corp Owner",
                businessName: "Test Corp Ltd",
                taxpayerType: "company",
                taxYear: 2024,
                stateOfResidence: "Lagos",
                isVATRegistered: true,
                currency: "NGN",
            };

            const inputs: TaxInputs = {
                grossRevenue: 50000000,
                allowableExpenses: 10000000,
                turnover: 50000000,
                capitalAllowance: 0, // No capital allowance claimed
            };

            const result: TaxResult = {
                taxpayerType: "company",
                taxYear: 2024,
                taxableIncome: 30000000,
                totalTaxDue: 6000000,
                effectiveRate: 0.20,
                bands: [],
                notes: [],
            };

            const optimizations = generateOptimizations(profile, inputs, result);

            const capitalSuggestion = optimizations.suggestions.find(s => s.type === "capital_allowance");
            expect(capitalSuggestion).toBeDefined();
        });

        it("should highlight small company advantage", () => {
            const profile: UserProfile = {
                fullName: "Small Corp Owner",
                businessName: "Small Corp Ltd",
                taxpayerType: "company",
                taxYear: 2024,
                stateOfResidence: "Lagos",
                isVATRegistered: false,
                currency: "NGN",
            };

            const inputs: TaxInputs = {
                grossRevenue: 20000000, // Under ₦25M
                allowableExpenses: 5000000,
                turnover: 20000000,
            };

            const result: TaxResult = {
                taxpayerType: "company",
                taxYear: 2024,
                taxableIncome: 15000000,
                totalTaxDue: 0, // 0% for small companies
                effectiveRate: 0,
                bands: [],
                notes: [],
            };

            const optimizations = generateOptimizations(profile, inputs, result);

            const structureSuggestion = optimizations.suggestions.find(s => s.type === "company_structure");
            expect(structureSuggestion).toBeDefined();
        });
    });

    describe("Priority ordering", () => {
        it("should sort suggestions by priority (high first)", () => {
            const profile: UserProfile = {
                fullName: "Test User",
                taxpayerType: "freelancer",
                taxYear: 2024,
                stateOfResidence: "Lagos",
                isVATRegistered: false,
                currency: "NGN",
            };

            const inputs: TaxInputs = {
                grossRevenue: 30000000,
                allowableExpenses: 500000, // Low expense ratio - high priority
                pensionContributions: 0,
            };

            const result: TaxResult = {
                taxpayerType: "freelancer",
                taxYear: 2024,
                taxableIncome: 25000000,
                totalTaxDue: 5000000,
                effectiveRate: 0.20,
                bands: [],
                notes: [],
            };

            const optimizations = generateOptimizations(profile, inputs, result);

            // First suggestion should be high priority
            if (optimizations.suggestions.length > 0) {
                expect(optimizations.suggestions[0].priority).toBe("high");
            }
        });
    });
});
