import { StatementDraft, TaxDraftPayload } from "./types";

export function statementToTaxDraft(statement: StatementDraft): TaxDraftPayload {
  return {
    profile: {
      taxpayerType: "company",
      taxYear: new Date().getFullYear(),
    },
    inputs: {
      grossRevenue: statement.revenue,
      allowableExpenses: statement.operatingExpenses,
      turnover: statement.revenue,
      costOfSales: statement.costOfSales,
      operatingExpenses: statement.operatingExpenses,
    },
    statement,
  };
}
