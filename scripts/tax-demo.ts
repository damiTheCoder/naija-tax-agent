import fs from "fs";
import path from "path";
import { runTaxComputation } from "../lib/tax/compliance/engine";
import type { ComplianceTransaction } from "../lib/tax/compliance/types";

const dataPath = path.join(__dirname, "..", "data", "tax", "demo-transactions.json");
const raw = fs.readFileSync(dataPath, "utf-8");
const transactions = JSON.parse(raw) as ComplianceTransaction[];

const result = runTaxComputation({
  entityId: "entity-default",
  period: "2026-Q1",
  transactions,
});

console.log("Tax Compliance Demo Run");
console.log("Period:", result.period);
console.log("Rule Set:", result.ruleSetId);
console.log("Schedules:");
result.schedules.forEach((schedule) => {
  console.log(`- ${schedule.taxType}: NGN ${schedule.totalTax.toLocaleString()}`);
});
console.log("Issues:", result.issues.length);
