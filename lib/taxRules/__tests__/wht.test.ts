/**
 * Unit tests for WHT Calculator
 */

import { describe, it, expect } from "vitest";
import { calculateSingleWHT, calculateWHT, getWHTRate, getAvailableWHTTypes } from "../wht";

describe("WHT Calculator", () => {
    describe("getWHTRate", () => {
        it("should return rate for valid payment type", () => {
            const rate = getWHTRate("dividends");
            expect(rate).toBeDefined();
            expect(rate?.residentRate).toBe(0.10);
            expect(rate?.nonResidentRate).toBe(0.10);
        });

        it("should return undefined for invalid payment type", () => {
            const rate = getWHTRate("invalid_type");
            expect(rate).toBeUndefined();
        });
    });

    describe("getAvailableWHTTypes", () => {
        it("should return all WHT payment types", () => {
            const types = getAvailableWHTTypes();
            expect(types.length).toBeGreaterThan(0);
            expect(types.some(t => t.paymentType === "dividends")).toBe(true);
            expect(types.some(t => t.paymentType === "rent")).toBe(true);
            expect(types.some(t => t.paymentType === "professional_fees_company")).toBe(true);
        });
    });

    describe("calculateSingleWHT", () => {
        it("should calculate WHT correctly for resident dividends", () => {
            const result = calculateSingleWHT({
                paymentType: "dividends",
                amount: 1000000,
                isResident: true,
            });

            expect(result).not.toBeNull();
            expect(result!.rate).toBe(0.10);
            expect(result!.whtAmount).toBe(100000);
            expect(result!.netAmount).toBe(900000);
        });

        it("should calculate higher rate for non-resident professional fees", () => {
            const residentResult = calculateSingleWHT({
                paymentType: "professional_fees_company",
                amount: 1000000,
                isResident: true,
            });

            const nonResidentResult = calculateSingleWHT({
                paymentType: "professional_fees_company",
                amount: 1000000,
                isResident: false,
            });

            expect(residentResult!.rate).toBe(0.10);
            expect(nonResidentResult!.rate).toBe(0.15);
            expect(nonResidentResult!.whtAmount).toBeGreaterThan(residentResult!.whtAmount);
        });

        it("should return null for invalid payment type", () => {
            const result = calculateSingleWHT({
                paymentType: "invalid",
                amount: 1000000,
                isResident: true,
            });

            expect(result).toBeNull();
        });
    });

    describe("calculateWHT (batch)", () => {
        it("should calculate WHT for multiple payments", () => {
            const result = calculateWHT([
                { paymentType: "dividends", amount: 500000, isResident: true },
                { paymentType: "rent", amount: 300000, isResident: true },
                { paymentType: "interest", amount: 200000, isResident: true },
            ]);

            expect(result.calculations.length).toBe(3);
            expect(result.totalGrossAmount).toBe(1000000);
            expect(result.totalWHTDeducted).toBe(100000); // 10% of 1,000,000
            expect(result.totalNetAmount).toBe(900000);
        });

        it("should skip invalid payment types in batch", () => {
            const result = calculateWHT([
                { paymentType: "dividends", amount: 500000, isResident: true },
                { paymentType: "invalid_type", amount: 300000, isResident: true },
            ]);

            expect(result.calculations.length).toBe(1);
            expect(result.totalGrossAmount).toBe(500000);
        });

        it("should handle empty array", () => {
            const result = calculateWHT([]);

            expect(result.calculations.length).toBe(0);
            expect(result.totalGrossAmount).toBe(0);
            expect(result.totalWHTDeducted).toBe(0);
            expect(result.totalNetAmount).toBe(0);
        });
    });
});
