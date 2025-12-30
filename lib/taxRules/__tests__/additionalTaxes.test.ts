/**
 * Unit tests for CGT, TET, Stamp Duty, and Levies Calculators
 */

import { describe, it, expect } from "vitest";
import { calculateCGT, calculateTotalCGT, CGT_RATE } from "../cgt";
import { calculateTET, TET_RATE } from "../tet";
import { calculateStampDuty } from "../stampDuty";
import {
    calculatePoliceLevy,
    calculateNASENILevy,
    calculateNSITF,
    calculateITF,
    calculateAllCompanyLevies,
    POLICE_LEVY_RATE,
    NASENI_LEVY_RATE,
    NSITF_RATE,
    ITF_RATE
} from "../levies";

describe("Capital Gains Tax (CGT)", () => {
    it("should calculate CGT at 10% on gains", () => {
        const result = calculateCGT({
            assetType: "real_estate",
            assetDescription: "Property in Lagos",
            acquisitionDate: "2020-01-01",
            acquisitionCost: 50000000,
            disposalDate: "2024-01-01",
            disposalProceeds: 80000000,
        });

        expect(result.chargeableGain).toBe(30000000);
        expect(result.cgtPayable).toBe(3000000);
        expect(result.cgtRate).toBe(0.10);
    });

    it("should account for improvement costs and selling expenses", () => {
        const result = calculateCGT({
            assetType: "real_estate",
            assetDescription: "Property",
            acquisitionDate: "2020-01-01",
            acquisitionCost: 50000000,
            improvementCosts: 10000000,
            disposalDate: "2024-01-01",
            disposalProceeds: 80000000,
            sellingExpenses: 2000000,
        });

        // Gain = (80M - 2M expenses) - (50M + 10M improvements) = 18M
        expect(result.chargeableGain).toBe(18000000);
        expect(result.cgtPayable).toBe(1800000);
    });

    it("should return zero CGT on losses", () => {
        const result = calculateCGT({
            assetType: "shares",
            assetDescription: "Company shares",
            acquisitionDate: "2022-01-01",
            acquisitionCost: 10000000,
            disposalDate: "2024-01-01",
            disposalProceeds: 5000000,
        });

        expect(result.chargeableGain).toBe(0);
        expect(result.cgtPayable).toBe(0);
    });

    it("should calculate total CGT for multiple disposals", () => {
        const result = calculateTotalCGT([
            {
                assetType: "real_estate",
                assetDescription: "Property 1",
                acquisitionDate: "2020-01-01",
                acquisitionCost: 20000000,
                disposalDate: "2024-01-01",
                disposalProceeds: 30000000,
            },
            {
                assetType: "shares",
                assetDescription: "Shares",
                acquisitionDate: "2021-01-01",
                acquisitionCost: 5000000,
                disposalDate: "2024-01-01",
                disposalProceeds: 8000000,
            },
        ]);

        expect(result.disposals.length).toBe(2);
        expect(result.totalGain).toBe(13000000);
        expect(result.totalCGT).toBe(1300000);
    });
});

describe("Tertiary Education Tax (TET)", () => {
    it("should calculate TET at 3% for companies", () => {
        const result = calculateTET({
            assessableProfit: 100000000,
            isCompany: true,
        });

        expect(result.tetPayable).toBe(3000000);
        expect(result.tetRate).toBe(0.03);
        expect(result.isApplicable).toBe(true);
    });

    it("should not apply TET to individuals", () => {
        const result = calculateTET({
            assessableProfit: 50000000,
            isCompany: false,
        });

        expect(result.tetPayable).toBe(0);
        expect(result.isApplicable).toBe(false);
    });
});

describe("Stamp Duties", () => {
    it("should calculate percentage-based stamp duty on property deeds", () => {
        const result = calculateStampDuty({
            documentType: "deed",
            transactionValue: 100000000,
        });

        // 1.5% of 100M = 1.5M
        expect(result.stampDuty).toBe(1500000);
        expect(result.documentType).toBe("deed");
    });

    it("should calculate fixed stamp duty for agreements", () => {
        const result = calculateStampDuty({
            documentType: "agreement",
            transactionValue: 50000000,
        });

        expect(result.stampDuty).toBe(500);
        expect(result.documentType).toBe("agreement");
    });

    it("should calculate stamp duty for bank transfers", () => {
        const result = calculateStampDuty({
            documentType: "bank_transfer",
            transactionValue: 50000,
        });
        // Falls back to default fixed duty of 500
        expect(result.stampDuty).toBe(500);
    });

    it("should calculate stamp duty for mortgages", () => {
        const result = calculateStampDuty({
            documentType: "mortgage",
            transactionValue: 100000000,
        });

        // 0.375% of 100M = 375,000
        expect(result.stampDuty).toBe(375000);
        expect(result.documentType).toBe("mortgage");
    });
});

describe("Company Levies", () => {
    describe("Police Trust Fund Levy", () => {
        it("should calculate at 0.005% of net profit for companies", () => {
            const result = calculatePoliceLevy({
                netProfit: 100000000,
                isCompany: true,
            });

            expect(result.levyPayable).toBe(5000);
            expect(result.rate).toBe(POLICE_LEVY_RATE);
        });

        it("should not apply to individuals", () => {
            const result = calculatePoliceLevy({
                netProfit: 100000000,
                isCompany: false,
            });

            expect(result.levyPayable).toBe(0);
            expect(result.isApplicable).toBe(false);
        });
    });

    describe("NASENI Levy", () => {
        it("should calculate at 0.25% for applicable industries", () => {
            const result = calculateNASENILevy({
                profitBeforeTax: 100000000,
                industry: "banking",
                isCompany: true,
            });

            expect(result.levyPayable).toBe(250000);
            expect(result.isApplicable).toBe(true);
        });

        it("should not apply to non-applicable industries", () => {
            const result = calculateNASENILevy({
                profitBeforeTax: 100000000,
                industry: "retail",
                isCompany: true,
            });

            expect(result.levyPayable).toBe(0);
            expect(result.isApplicable).toBe(false);
        });
    });

    describe("NSITF", () => {
        it("should calculate at 1% of payroll", () => {
            const result = calculateNSITF({
                monthlyPayroll: 5000000,
                numberOfMonths: 12,
            });

            expect(result.totalPayroll).toBe(60000000);
            expect(result.contributionPayable).toBe(600000);
            expect(result.rate).toBe(NSITF_RATE);
        });
    });

    describe("ITF", () => {
        it("should apply to companies with 5+ employees", () => {
            const result = calculateITF({
                annualPayroll: 60000000,
                numberOfEmployees: 10,
                annualTurnover: 20000000,
            });

            expect(result.levyPayable).toBe(600000);
            expect(result.isApplicable).toBe(true);
        });

        it("should apply to companies with N50m+ turnover", () => {
            const result = calculateITF({
                annualPayroll: 30000000,
                numberOfEmployees: 3,
                annualTurnover: 100000000,
            });

            expect(result.levyPayable).toBe(300000);
            expect(result.isApplicable).toBe(true);
        });

        it("should not apply to small companies", () => {
            const result = calculateITF({
                annualPayroll: 10000000,
                numberOfEmployees: 2,
                annualTurnover: 20000000,
            });

            expect(result.levyPayable).toBe(0);
            expect(result.isApplicable).toBe(false);
        });
    });

    describe("Consolidated Levies", () => {
        it("should calculate all applicable levies", () => {
            const result = calculateAllCompanyLevies({
                netProfit: 100000000,
                profitBeforeTax: 120000000,
                industry: "banking",
                monthlyPayroll: 5000000,
                numberOfEmployees: 50,
                annualTurnover: 500000000,
            });

            expect(result.policeLevy.levyPayable).toBe(5000);
            expect(result.naseniLevy.levyPayable).toBe(300000);
            expect(result.nsitf.contributionPayable).toBe(600000);
            expect(result.itf.levyPayable).toBe(600000);
            expect(result.totalLevies).toBe(1505000);
        });
    });
});
