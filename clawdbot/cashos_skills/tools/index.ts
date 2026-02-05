/**
 * CashOS Skills - Tool Index
 * 
 * Export all CashOS tools for Clawdbot integration.
 */

export { default as cashos_record_transaction, toolDefinition as recordTransactionDef } from './recordTransaction';
export { default as cashos_get_report, toolDefinition as getReportDef } from './getReport';
export { default as cashos_compute_tax, toolDefinition as computeTaxDef } from './computeTax';
export { default as cashos_get_cashflow, toolDefinition as getCashflowDef } from './getCashflow';
export { default as cashos_validate_transaction, toolDefinition as validateTransactionDef } from './validateTransaction';

// Export all tool definitions for Clawdbot registration
export const allTools = [
    require('./recordTransaction').toolDefinition,
    require('./getReport').toolDefinition,
    require('./computeTax').toolDefinition,
    require('./getCashflow').toolDefinition,
    require('./validateTransaction').toolDefinition,
];
