# Atom Ledger Tax Compliance Engine - Technical Design

## Goals
- Deterministic, explainable tax computation with versioned rule sets.
- Transaction classification pipeline with persisted decisions.
- Materialized schedules for VAT, WHT, CIT, CGT, and Stamp Duties.
- Filing & payments workflow with compliance status tracking.
- Audit logs and reconciliation reports.
- Tax Workspace UX supporting overview, issues, schedules, filings, audit.
- Tax Agent Chat function calls with guardrails + logging.

## Architecture Overview
**Event-sourced tax ledger**
1. **Source transactions** are immutable (from accounting, invoices, bills).
2. **Rule set** chosen by period and entity (versioned and effective-dated).
3. **Classification** converts transactions → tax categories (persisted).
4. **Ledger entries** are computed deterministically from (transaction + rule + classification).
5. **Schedules** are materialized from ledger entries per period & tax type.
6. **Compliance status** and **filing packages** reference schedules.

### Determinism & Explainability
- Every computed tax amount references `rule_set_id`, `rule_id`, `transaction_id`.
- Ledger entries store calculation metadata for audit trails.
- Reconciliation reports link totals back to ledger entries.

## Data Model (Prisma)
- Core accounting entities: `Entity`, `Transaction`, `Invoice`, `InvoiceLine`, `Bill`, `BillLine`, `Payment`, `Vendor`, `Customer`, `ChartOfAccount`.
- Tax rules: `TaxRuleSet`, `TaxRule`, `TaxCategory`.
- Classification: `TaxClassification`.
- Computed data: `TaxLedgerEntry`, `TaxPeriod`, `TaxSchedule`.
- Compliance: `ComplianceDeadline`, `ComplianceStatus`, `TaxFilingPackage`, `TaxPayment`, `TaxReconciliation`, `AuditLog`.

## Computation Engine Modules
- `lib/tax/compliance/engine.ts`
  - `runTaxComputation(entityId, period, taxTypes)`
  - `generateSchedule(entityId, period, taxType)`
  - VAT, WHT, CIT, CGT, Stamp calculations
- `lib/tax/compliance/classification.ts`
  - rule-based classification
- `lib/tax/compliance/issues.ts`
  - unclassified, missing metadata, mismatches
- `lib/tax/compliance/filingPack.ts`
  - pdf/csv generation metadata + exports
- `lib/tax/compliance/audit.ts`
  - audit log events

## Computation Rules (Summary)
- **VAT**: output VAT – input VAT, with carry-forward credit.
- **WHT**: rate table by vendor type/category, remittance by vendor.
- **CIT**: accounting profit → taxable profit reconciliation.
- **CGT**: asset disposal schedule with proceeds vs cost basis.
- **Stamp**: document type mapping, fixed/ad valorem.

## UI/UX
Tax Workspace tabs:
- **Overview**: due dates, status, payable deltas, quick actions.
- **Issues**: unclassified, missing data, reconciliation mismatches.
- **Schedules**: drilldown + export.
- **Filing & Payments**: workflow status + payment tracking.
- **Audit & Documents**: rule set versions, logs, filing packs.

## Agent Tooling
Functions exposed to chat (safe guardrails + audit logging):
- `run_tax_computation`
- `generate_schedule`
- `list_issues`
- `apply_classification_rules`
- `generate_filing_pack`
- `reconcile_tax`

## Testing
Acceptance tests are provided in `lib/tax/compliance/__tests__/engine.test.ts`:
- VAT input > output results in carry-forward credit and 0 payable.
- Schedule totals equal sum of ledger entries.
- CIT reconciliation equation holds.
- Computations always reference rule_set_id.
- Manual overrides create audit log entries.

## Rollout
1. Run Prisma migration.
2. Seed default rule set (`2026.1`).
3. Use tax workspace to view schedules and filings.
4. Agent chat can execute deterministic compliance functions.
