import { describe, expect, test, beforeEach } from "vitest";
import { runTaxComputation } from "../engine";
import { applyManualClassification } from "../classification";
import { resetComplianceStore, loadAuditLogs } from "../store";
import type { ComplianceTransaction } from "../types";

const entityId = "entity-test";

const makeTx = (overrides: Partial<ComplianceTransaction>): ComplianceTransaction => ({
  id: overrides.id || `tx-${Math.random().toString(36).slice(2, 6)}`,
  entityId,
  date: overrides.date || "2026-01-15",
  description: overrides.description || "General transaction",
  amount: overrides.amount ?? 1000,
  currency: "NGN",
  type: overrides.type || "sale",
  metadata: overrides.metadata || {},
});

beforeEach(() => {
  resetComplianceStore();
});

test("VAT input > output results in carry-forward credit and 0 payable", () => {
  const transactions = [
    makeTx({ id: "sale-1", amount: 1000000, type: "sale" }),
    makeTx({ id: "purchase-1", amount: 3000000, type: "purchase" }),
  ];

  const result = runTaxComputation({ entityId, period: "2026-Q1", transactions });
  const vatSchedule = result.schedules.find((schedule) => schedule.taxType === "VAT");
  expect(vatSchedule).toBeTruthy();
  expect(vatSchedule?.totalTax).toBe(0);
  expect(vatSchedule?.carryForward).toBeGreaterThan(0);
});

test("Schedule totals equal sum of ledger entries", () => {
  const transactions = [
    makeTx({ id: "sale-2", amount: 2000000, type: "sale" }),
    makeTx({ id: "consult-1", amount: 500000, type: "expense", description: "Consulting fee" }),
  ];
  const result = runTaxComputation({ entityId, period: "2026-Q1", transactions });

  result.schedules.forEach((schedule) => {
    const ledgerTotal = result.ledgerEntries
      .filter((entry) => entry.taxType === schedule.taxType)
      .reduce((sum, entry) => sum + entry.taxAmount, 0);
    expect(Math.abs(ledgerTotal - schedule.totalTax)).toBeLessThan(0.01);
  });
});

test("CIT reconciliation matches accounting profit adjustments", () => {
  const transactions = [
    makeTx({ id: "sale-3", amount: 10000000, type: "sale", description: "Sales revenue" }),
    makeTx({ id: "expense-1", amount: 2000000, type: "expense", description: "Operations expense" }),
    makeTx({ id: "ent-1", amount: 1000000, type: "expense", description: "Entertainment" }),
  ];

  const result = runTaxComputation({ entityId, period: "2026-Q1", transactions });
  const citSchedule = result.schedules.find((schedule) => schedule.taxType === "CIT");
  expect(citSchedule).toBeTruthy();
  const reconciliation = result.ledgerEntries.find((entry) => entry.taxType === "CIT")?.metadata as {
    accountingProfit: number;
    disallowable: number;
    nonTaxable: number;
    capitalAllowance: number;
    lossCarryForward: number;
    taxableProfit: number;
  };

  expect(reconciliation).toBeTruthy();
  const expectedTaxable =
    reconciliation.accountingProfit +
    reconciliation.disallowable -
    reconciliation.nonTaxable -
    reconciliation.capitalAllowance -
    reconciliation.lossCarryForward;
  expect(reconciliation.taxableProfit).toBeCloseTo(Math.max(0, expectedTaxable));
});

test("All ledger entries reference rule_set_id", () => {
  const transactions = [makeTx({ id: "sale-4", amount: 1500000 })];
  const result = runTaxComputation({ entityId, period: "2026-Q1", transactions });
  result.ledgerEntries.forEach((entry) => {
    expect(entry.ruleSetId).toBeTruthy();
  });
});

test("Manual overrides create audit log entries", () => {
  applyManualClassification(entityId, {
    entityId,
    transactionId: "manual-1",
    taxType: "VAT",
    category: "output",
    reason: "Manual override test",
  });

  const logs = loadAuditLogs();
  expect(logs.some((log) => log.action === "classification.manual_override")).toBe(true);
});
