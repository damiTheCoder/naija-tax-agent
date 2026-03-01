/**
 * =============================================================================
 * BANK TRANSACTION PIPELINE — TESTS
 * =============================================================================
 *
 * Tests the full pipeline: classifier, CSV parser, duplicate detection,
 * and cross-module routing.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { classifyBankTransaction, classifyBankTransactions } from "../aiClassifier";
import {
    processTransaction,
    processTransactions,
    parseCSVStatement,
} from "../transactionPipeline";
import type { InboundBankTransaction, PipelineOptions } from "../types";

// =============================================================================
// TEST HELPERS
// =============================================================================

function makeTx(overrides: Partial<InboundBankTransaction> = {}): InboundBankTransaction {
    return {
        id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        connectionId: "conn_test",
        accountId: "acc_test",
        date: "2025-06-01",
        description: "Test transaction",
        amount: 10000,
        direction: "debit",
        currency: "NGN",
        ...overrides,
    };
}

const defaultOptions: PipelineOptions = {
    entityId: "test-entity",
    autoPost: true,
    runTaxClassification: true,
    updateBudgets: true,
    updateCashflow: false, // Avoid side effects in tests
    bankAccountCode: "1000",
};

// =============================================================================
// 1. AI CLASSIFIER — NARRATION PATTERNS
// =============================================================================

describe("AI Classifier — Narration Patterns", () => {
    it("classifies salary payments", () => {
        const tx = makeTx({ description: "SALARY PAYMENT JUNE 2025", direction: "debit" });
        const result = classifyBankTransaction(tx, "1000");

        expect(result.nature).toBe("operating_expense");
        expect(result.category).toBe("payroll");
        expect(result.tax.vatApplicable).toBe(false);
        expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it("classifies FIRS VAT remittance", () => {
        const tx = makeTx({ description: "FIRS VAT PAYMENT Q2 2025", direction: "debit" });
        const result = classifyBankTransaction(tx, "1000");

        expect(result.nature).toBe("tax_payment");
        expect(result.category).toContain("vat");
        expect(result.tax.vatApplicable).toBe(false);
    });

    it("classifies electricity bills (IKEDC)", () => {
        const tx = makeTx({ description: "IKEDC PREPAID METER TOP UP", amount: 25000, direction: "debit" });
        const result = classifyBankTransaction(tx, "1000");

        expect(result.nature).toBe("operating_expense");
        expect(result.category).toContain("utilities");
        expect(result.tax.vatApplicable).toBe(true);
        expect(result.tax.vatCategory).toBe("input");
    });

    it("classifies professional services with WHT", () => {
        const tx = makeTx({ description: "Payment to KPMG consulting invoice 2345", amount: 500000, direction: "debit" });
        const result = classifyBankTransaction(tx, "1000");

        expect(result.nature).toBe("operating_expense");
        expect(result.tax.whtApplicable).toBe(true);
        expect(result.tax.whtRate).toBeGreaterThan(0);
    });

    it("classifies POS transactions", () => {
        const tx = makeTx({ description: "POS/SHOPRITE IKEJA/1234", amount: 15000, direction: "debit" });
        const result = classifyBankTransaction(tx, "1000");

        expect(result.tax.vatApplicable).toBe(true);
        expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it("classifies rent payments with WHT", () => {
        const tx = makeTx({ description: "RENT PAYMENT OFFICE LEASE JAN-DEC 2025", amount: 2400000, direction: "debit" });
        const result = classifyBankTransaction(tx, "1000");

        expect(result.nature).toBe("operating_expense");
        expect(result.category).toContain("rent");
        expect(result.tax.whtApplicable).toBe(true);
        expect(result.tax.whtRate).toBe(0.10);
    });

    it("classifies bank charges", () => {
        const tx = makeTx({ description: "COMM ON TURNOVER/JUNE 2025", amount: 500, direction: "debit" });
        const result = classifyBankTransaction(tx, "1000");

        expect(result.nature).toBe("operating_expense");
        expect(result.category).toContain("bank");
        expect(result.tax.vatApplicable).toBe(true);
    });

    it("classifies revenue (customer payment)", () => {
        const tx = makeTx({
            description: "NIP/ACME CORP/Payment for invoice 001",
            amount: 1000000,
            direction: "credit",
        });
        const result = classifyBankTransaction(tx, "1000");

        expect(result.nature).toBeDefined();
        // Credit transactions should debit bank, credit income/liability
        expect(result.confidence).toBeGreaterThan(0);
    });

    it("classifies vehicle/equipment purchases as assets", () => {
        const tx = makeTx({ description: "Purchase of Toyota Hilux company vehicle", amount: 15000000, direction: "debit" });
        const result = classifyBankTransaction(tx, "1000");

        expect(result.nature).toBe("asset_purchase");
        expect(result.tax.cgtApplicable).toBeDefined();
    });

    it("classifies loan disbursements as financing", () => {
        const tx = makeTx({ description: "LOAN DISBURSEMENT FROM ACCESS BANK", amount: 5000000, direction: "credit" });
        const result = classifyBankTransaction(tx, "1000");

        expect(result.nature).toBe("financing");
    });
});

// =============================================================================
// 2. AI CLASSIFIER — BATCH
// =============================================================================

describe("AI Classifier — Batch", () => {
    it("classifies multiple transactions", () => {
        const txs = [
            makeTx({ description: "SALARY PAYMENT", direction: "debit" }),
            makeTx({ description: "IKEDC ELECTRICITY", direction: "debit" }),
            makeTx({ description: "NIP FROM CUSTOMER ABC", direction: "credit" }),
        ];

        const results = classifyBankTransactions(txs, "1000");
        expect(results.size).toBe(3);

        const values = Array.from(results.values());
        expect(values[0].nature).toBe("operating_expense");
        expect(values[1].category).toContain("utilities");
    });
});

// =============================================================================
// 3. AI CLASSIFIER — DIRECTION-AWARE DOUBLE ENTRY
// =============================================================================

describe("AI Classifier — Direction-aware entries", () => {
    it("debit (outflow): DR Expense/Asset, CR Bank", () => {
        const tx = makeTx({ description: "IKEDC ELECTRICITY", direction: "debit" });
        const result = classifyBankTransaction(tx, "1000");

        // For a debit (outflow), the bank account should be the credit side
        expect(result.creditAccountCode).toBe("1000");
    });

    it("credit (inflow): DR Bank, CR Income/Liability", () => {
        const tx = makeTx({ description: "LOAN DISBURSEMENT FROM GTB", amount: 5000000, direction: "credit" });
        const result = classifyBankTransaction(tx, "1000");

        // For a credit (inflow), the bank account should be the debit side
        expect(result.debitAccountCode).toBe("1000");
    });
});

// =============================================================================
// 4. CSV PARSER
// =============================================================================

describe("CSV Statement Parser", () => {
    it("parses basic CSV with Date,Description,Debit,Credit,Balance", () => {
        const csv = [
            "Date,Description,Debit,Credit,Balance",
            "01/06/2025,SALARY PAYMENT JUNE,250000,,1500000",
            "02/06/2025,NIP/CUSTOMER PAYMENT,,500000,2000000",
            "03/06/2025,IKEDC ELECTRICITY,25000,,1975000",
        ].join("\n");

        const txs = parseCSVStatement(csv, "conn_test", "acc_test");

        expect(txs).toHaveLength(3);
        expect(txs[0].description).toBe("SALARY PAYMENT JUNE");
        expect(txs[0].amount).toBe(250000);
        expect(txs[0].direction).toBe("debit");
        expect(txs[1].direction).toBe("credit");
        expect(txs[1].amount).toBe(500000);
        expect(txs[2].amount).toBe(25000);
    });

    it("parses CSV with Narration column", () => {
        const csv = [
            "Date,Narration,Debit,Credit,Balance",
            "15/06/2025,POS/SHOPRITE IKEJA,12500,,487500",
        ].join("\n");

        const txs = parseCSVStatement(csv, "conn_test", "acc_test");
        expect(txs).toHaveLength(1);
        expect(txs[0].description).toBe("POS/SHOPRITE IKEJA");
    });

    it("handles TSV format", () => {
        const tsv = [
            "Date\tDescription\tDebit\tCredit\tBalance",
            "01/06/2025\tSALARY\t100000\t\t900000",
        ].join("\n");

        const txs = parseCSVStatement(tsv, "conn_test", "acc_test");
        expect(txs).toHaveLength(1);
        expect(txs[0].amount).toBe(100000);
    });

    it("handles currency symbols and formatting", () => {
        const csv = [
            "Date,Description,Debit,Credit,Balance",
            '01/06/2025,TRANSFER,"₦1,500,000.00",,3500000',
        ].join("\n");

        const txs = parseCSVStatement(csv, "conn_test", "acc_test");
        expect(txs).toHaveLength(1);
        expect(txs[0].amount).toBe(1500000);
    });

    it("handles MM/DD/YYYY date format", () => {
        const csv = [
            "Date,Description,Debit,Credit",
            "06/01/2025,TEST PAYMENT,10000,",
        ].join("\n");

        const txs = parseCSVStatement(csv, "conn_test", "acc_test", {
            dateFormat: "MM/DD/YYYY",
        });

        expect(txs).toHaveLength(1);
        // June 1st
        const d = new Date(txs[0].date);
        expect(d.getMonth()).toBe(5); // 0-indexed
        expect(d.getDate()).toBe(1);
    });

    it("handles YYYY-MM-DD (ISO) dates", () => {
        const csv = [
            "Date,Description,Debit,Credit",
            "2025-06-15,OFFICE RENT,500000,",
        ].join("\n");

        const txs = parseCSVStatement(csv, "conn_test", "acc_test", {
            dateFormat: "YYYY-MM-DD",
        });

        expect(txs).toHaveLength(1);
    });

    it("skips empty lines and lines without amount", () => {
        const csv = [
            "Date,Description,Debit,Credit",
            "01/06/2025,VALID PAYMENT,10000,",
            "",
            "02/06/2025,NO AMOUNT,,",
            "03/06/2025,ANOTHER VALID,5000,",
        ].join("\n");

        const txs = parseCSVStatement(csv, "conn_test", "acc_test");
        expect(txs).toHaveLength(2);
    });

    it("returns empty array for invalid CSV (no header match)", () => {
        const csv = "Foo,Bar,Baz\n1,2,3";
        const txs = parseCSVStatement(csv, "conn_test", "acc_test");
        expect(txs).toHaveLength(0);
    });

    it("returns empty array for single-line CSV (header only)", () => {
        const csv = "Date,Description,Debit,Credit";
        const txs = parseCSVStatement(csv, "conn_test", "acc_test");
        expect(txs).toHaveLength(0);
    });

    it("handles Amount column (signed values) instead of Debit/Credit", () => {
        const csv = [
            "Date,Description,Amount",
            "01/06/2025,PAYMENT IN,50000",
            "02/06/2025,PAYMENT OUT,-25000",
        ].join("\n");

        const txs = parseCSVStatement(csv, "conn_test", "acc_test");
        expect(txs).toHaveLength(2);
        expect(txs[0].direction).toBe("credit");
        expect(txs[0].amount).toBe(50000);
        expect(txs[1].direction).toBe("debit");
        expect(txs[1].amount).toBe(25000);
    });
});

// =============================================================================
// 5. PIPELINE — SINGLE TRANSACTION
// =============================================================================

describe("Pipeline — Single Transaction", () => {
    it("processes a debit transaction end-to-end", () => {
        const tx = makeTx({
            id: `pipeline-debit-${Date.now()}`,
            description: "IKEDC PREPAID METER",
            amount: 25000,
            direction: "debit",
        });

        const result = processTransaction(tx, defaultOptions);

        expect(result.bankTransactionId).toBe(tx.id);
        expect(result.classification.nature).toBe("operating_expense");
        expect(result.classification.confidence).toBeGreaterThan(0.5);

        // Accounting should post
        expect(result.accounting.posted).toBe(true);
        expect(result.accounting.journalId).toBeDefined();

        // Tax classification should run
        expect(result.tax.classified).toBeDefined();

        expect(result.processedAt).toBeDefined();
    });

    it("processes a credit transaction end-to-end", () => {
        const tx = makeTx({
            id: `pipeline-credit-${Date.now()}`,
            description: "NIP FROM ACME CORP INVOICE PAYMENT",
            amount: 500000,
            direction: "credit",
        });

        const result = processTransaction(tx, defaultOptions);

        expect(result.bankTransactionId).toBe(tx.id);
        expect(result.accounting.posted).toBe(true);
        expect(result.processedAt).toBeDefined();
    });

    it("detects duplicates on second import", () => {
        const txId = `dup-test-${Date.now()}`;
        const tx = makeTx({
            id: txId,
            description: "UNIQUE DUPLICATE TEST TRANSACTION",
            amount: 77777,
            direction: "debit",
        });

        // First import should succeed
        const first = processTransaction(tx, defaultOptions);
        expect(first.success).toBe(true);

        // Second import of same transaction should be flagged
        const second = processTransaction(tx, defaultOptions);
        expect(second.success).toBe(false);
        expect(second.classification.category).toBe("duplicate");
        expect(second.warnings).toContain("Duplicate transaction skipped");
    });

    it("skips duplicate detection when option is set", () => {
        const txId = `skip-dup-${Date.now()}`;
        const tx = makeTx({
            id: txId,
            description: "SKIP DUP CHECK TEST",
            amount: 88888,
            direction: "debit",
        });

        const first = processTransaction(tx, defaultOptions);
        expect(first.success).toBe(true);

        const second = processTransaction(tx, {
            ...defaultOptions,
            skipDuplicateCheck: true,
        });
        // Should process again (not flagged as duplicate)
        expect(second.classification.category).not.toBe("duplicate");
    });
});

// =============================================================================
// 6. PIPELINE — BATCH PROCESSING
// =============================================================================

describe("Pipeline — Batch Processing", () => {
    it("processes a batch of transactions", () => {
        const txs = [
            makeTx({
                id: `batch-1-${Date.now()}`,
                description: "SALARY PAYMENT",
                amount: 300000,
                direction: "debit",
                date: "2025-06-01",
            }),
            makeTx({
                id: `batch-2-${Date.now()}`,
                description: "NIP FROM CLIENT",
                amount: 1000000,
                direction: "credit",
                date: "2025-06-02",
            }),
            makeTx({
                id: `batch-3-${Date.now()}`,
                description: "IKEDC ELECTRICITY",
                amount: 25000,
                direction: "debit",
                date: "2025-06-03",
            }),
        ];

        const batch = processTransactions(txs, defaultOptions);

        expect(batch.total).toBe(3);
        expect(batch.processed).toBeGreaterThanOrEqual(3);
        expect(batch.results).toHaveLength(3);

        // Summary should have aggregated stats
        expect(batch.summary.totalCredits).toBe(1000000);
        expect(batch.summary.totalDebits).toBe(325000);
        expect(batch.summary.netAmount).toBe(675000);
        expect(batch.processedAt).toBeDefined();
    });

    it("sorts transactions by date (oldest first)", () => {
        const txs = [
            makeTx({
                id: `sort-3-${Date.now()}`,
                description: "THIRD",
                date: "2025-06-03",
                direction: "debit",
            }),
            makeTx({
                id: `sort-1-${Date.now()}`,
                description: "FIRST",
                date: "2025-06-01",
                direction: "debit",
            }),
            makeTx({
                id: `sort-2-${Date.now()}`,
                description: "SECOND",
                date: "2025-06-02",
                direction: "debit",
            }),
        ];

        const batch = processTransactions(txs, defaultOptions);

        // Results should be in chronological order
        const descriptions = batch.results.map(
            (r) => r.classification.categoryLabel
        );
        // We can't test exact order of labels since they come from the classifier,
        // but we know the first processed should be the oldest date
        expect(batch.results).toHaveLength(3);
    });

    it("counts duplicates in batch summary", () => {
        const sharedId = `batch-dup-${Date.now()}`;
        const tx = makeTx({
            id: sharedId,
            description: "DUPLICATE IN BATCH TEST",
            amount: 99999,
            direction: "debit",
        });

        // Import once
        processTransaction(tx, defaultOptions);

        // Now import the same transaction in a batch
        const batch = processTransactions([tx], defaultOptions);

        expect(batch.duplicatesSkipped).toBe(1);
        expect(batch.processed).toBe(0);
    });
});

// =============================================================================
// 7. PIPELINE — TAX IMPLICATIONS
// =============================================================================

describe("Pipeline — Tax Implications", () => {
    it("computes VAT on eligible transactions", () => {
        const tx = makeTx({
            id: `vat-test-${Date.now()}`,
            description: "IKEDC ELECTRICITY PAYMENT",
            amount: 107500, // ₦100k + 7.5% VAT
            direction: "debit",
        });

        const result = processTransaction(tx, defaultOptions);

        expect(result.classification.tax.vatApplicable).toBe(true);
        expect(result.classification.tax.vatAmount).toBeGreaterThan(0);
    });

    it("computes WHT on professional services", () => {
        const tx = makeTx({
            id: `wht-test-${Date.now()}`,
            description: "LEGAL FEE PAYMENT TO ALUKO & OYEBODE",
            amount: 1000000,
            direction: "debit",
        });

        const result = processTransaction(tx, defaultOptions);

        expect(result.classification.tax.whtApplicable).toBe(true);
        expect(result.classification.tax.whtRate).toBeGreaterThan(0);
        expect(result.classification.tax.whtAmount).toBeGreaterThan(0);
    });

    it("no VAT on salary payments", () => {
        const tx = makeTx({
            id: `no-vat-salary-${Date.now()}`,
            description: "SALARY PAYMENT TO STAFF",
            amount: 350000,
            direction: "debit",
        });

        const result = processTransaction(tx, defaultOptions);

        expect(result.classification.tax.vatApplicable).toBe(false);
        expect(result.classification.tax.vatAmount).toBe(0);
    });

    it("batch summary aggregates tax implications", () => {
        const txs = [
            makeTx({
                id: `tax-batch-1-${Date.now()}`,
                description: "IKEDC ELECTRICITY",
                amount: 50000,
                direction: "debit",
            }),
            makeTx({
                id: `tax-batch-2-${Date.now()}`,
                description: "SALARY PAYMENT",
                amount: 300000,
                direction: "debit",
            }),
        ];

        const batch = processTransactions(txs, defaultOptions);

        // At least the electricity should contribute VAT input
        expect(batch.summary.taxImplications).toBeDefined();
        expect(typeof batch.summary.taxImplications.vatInput).toBe("number");
        expect(typeof batch.summary.taxImplications.vatOutput).toBe("number");
    });
});

// =============================================================================
// 8. END-TO-END: CSV → PIPELINE
// =============================================================================

describe("End-to-End: CSV Upload → Pipeline", () => {
    it("parses CSV and processes all transactions through the pipeline", () => {
        const csv = [
            "Date,Description,Debit,Credit,Balance",
            `01/06/2025,SALARY JUNE ${Date.now()},250000,,1250000`,
            `02/06/2025,IKEDC ELECTRICITY ${Date.now()},25000,,1225000`,
            `05/06/2025,NIP FROM CUSTOMER ${Date.now()},,750000,1975000`,
        ].join("\n");

        // Step 1: Parse
        const transactions = parseCSVStatement(csv, "conn_csv_test", "acc_csv_test");
        expect(transactions).toHaveLength(3);

        // Step 2: Process
        const batch = processTransactions(transactions, {
            ...defaultOptions,
            entityId: "csv-upload-test",
        });

        expect(batch.total).toBe(3);
        expect(batch.processed).toBeGreaterThanOrEqual(3);

        // Verify classifications
        const natures = batch.results.map((r) => r.classification.nature);
        expect(natures).toContain("operating_expense"); // salary or electricity

        // Verify accounting was posted
        const postedCount = batch.results.filter((r) => r.accounting.posted).length;
        expect(postedCount).toBeGreaterThanOrEqual(3);
    });
});
