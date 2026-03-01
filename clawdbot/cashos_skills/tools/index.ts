/**
 * CashOS Skills - Tool Index
 * 
 * Export all CashOS tools for Clawdbot integration.
 */

import { toolDefinition as recordTransactionDefinition } from "./recordTransaction";
import { toolDefinition as getReportDefinition } from "./getReport";
import { toolDefinition as computeTaxDefinition } from "./computeTax";
import { toolDefinition as getCashflowDefinition } from "./getCashflow";
import { toolDefinition as validateTransactionDefinition } from "./validateTransaction";

export { default as cashos_record_transaction, toolDefinition as recordTransactionDef } from './recordTransaction';
export { default as cashos_get_report, toolDefinition as getReportDef } from './getReport';
export { default as cashos_compute_tax, toolDefinition as computeTaxDef } from './computeTax';
export { default as cashos_get_cashflow, toolDefinition as getCashflowDef } from './getCashflow';
export { default as cashos_validate_transaction, toolDefinition as validateTransactionDef } from './validateTransaction';

// Export all tool definitions for Clawdbot registration
export const allTools = [
    recordTransactionDefinition,
    getReportDefinition,
    computeTaxDefinition,
    getCashflowDefinition,
    validateTransactionDefinition,
];
