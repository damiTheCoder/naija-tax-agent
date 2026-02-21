import { accountingEngine } from "@/lib/accounting/transactionBridge";
import { mapJournalEntriesToCompliance } from "./adapters";
import type { TaxType } from "./types";
import { runTaxComputation, generateSchedule, listIssues, reconcileTax } from "./engine";
import { applyClassificationRules } from "./classification";
import { getRuleSet } from "./rulesets";
import { generateFilingPack } from "./filingPack";
import { recordAuditLog } from "./audit";

export async function run_tax_computation(entityId: string, period?: string, taxTypes?: TaxType[]) {
  if (!entityId) {
    return { success: false, message: "Missing entity_id." };
  }
  accountingEngine.load();
  const entries = accountingEngine.getState().journalEntries;
  const transactions = mapJournalEntriesToCompliance(entityId, entries);
  if (transactions.length === 0) {
    return { success: false, message: "No accounting transactions found for computation." };
  }

  const result = runTaxComputation({ entityId, period, taxTypes, transactions });
  return {
    success: true,
    message: `Computed ${result.schedules.length} schedules for ${result.period}.`,
    data: result,
  };
}

export async function apply_classification_rules(entityId: string, period?: string) {
  if (!entityId) {
    return { success: false, message: "Missing entity_id." };
  }
  accountingEngine.load();
  const entries = accountingEngine.getState().journalEntries;
  const transactions = mapJournalEntriesToCompliance(entityId, entries);
  if (transactions.length === 0) {
    return { success: false, message: "No transactions available for classification." };
  }
  const ruleSet = getRuleSet();
  const classifications = applyClassificationRules(entityId, transactions, ruleSet);
  return {
    success: true,
    message: `Applied ${classifications.length} classifications${period ? ` for ${period}` : ""}.`,
    data: classifications,
  };
}

export async function generate_schedule(entityId: string, period: string, taxType: TaxType) {
  if (!entityId || !period || !taxType) {
    return { success: false, message: "entity_id, period, and tax_type are required." };
  }
  const schedule = generateSchedule({ entityId, period, taxType });
  if (!schedule) {
    return { success: false, message: "Schedule not found. Run computation first." };
  }
  return { success: true, message: `Loaded ${taxType} schedule for ${period}.`, data: schedule };
}

export async function list_issues(entityId: string, period: string) {
  if (!entityId || !period) {
    return { success: false, message: "entity_id and period are required." };
  }
  const issues = listIssues(entityId, period);
  return { success: true, message: `Found ${issues.length} issue(s).`, data: issues };
}

export async function generate_filing_pack(
  entityId: string,
  period: string,
  taxType: TaxType,
  format: "pdf" | "csv" | "xlsx"
) {
  if (!entityId || !period || !taxType) {
    return { success: false, message: "entity_id, period, and tax_type are required." };
  }
  const schedule = generateSchedule({ entityId, period, taxType });
  if (!schedule) {
    return { success: false, message: "Schedule not found. Run computation first." };
  }
  if (format === "xlsx") {
    recordAuditLog({
      entityId,
      actor: "system",
      action: "filing_pack.requested",
      resourceType: "tax_filing_package",
      metadata: { period, taxType, format },
    });
    return { success: false, message: "XLSX export is not implemented yet. Use PDF or CSV." };
  }

  const pack = await generateFilingPack({ entityId, schedule, format });
  return { success: true, message: `Generated ${format.toUpperCase()} filing pack.`, data: pack };
}

export async function reconcile_tax(entityId: string, period: string, taxType: TaxType) {
  if (!entityId || !period || !taxType) {
    return { success: false, message: "entity_id, period, and tax_type are required." };
  }
  const report = reconcileTax(entityId, period, taxType);
  if (!report) {
    return { success: false, message: "No schedule found to reconcile." };
  }
  return { success: true, message: `Reconciliation ${report.status} for ${taxType}.`, data: report };
}
