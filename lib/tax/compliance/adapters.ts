import type { JournalEntry } from "@/lib/accounting/doubleEntry";
import type { ComplianceTransaction } from "./types";

const TAX_ACCOUNT_CODES = new Set(["1400", "1410", "2200", "2210", "2220", "7000", "7010"]);
const PAYROLL_ACCOUNT_CODES = new Set(["5500", "5510", "5520", "5530", "5540", "2210", "2230", "2240", "2250", "2260"]);

type EntryLineContext = {
  accountCodes: string[];
  debitAccountCodes: string[];
  creditAccountCodes: string[];
  vatOutputAmount: number;
  vatInputAmount: number;
  whtPayableAmount: number;
  whtReceivableAmount: number;
  payeAmount: number;
};

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const getLineContext = (entry: JournalEntry): EntryLineContext => {
  const accountCodes: string[] = [];
  const debitAccountCodes: string[] = [];
  const creditAccountCodes: string[] = [];
  let vatOutputAmount = 0;
  let vatInputAmount = 0;
  let whtPayableAmount = 0;
  let whtReceivableAmount = 0;
  let payeAmount = 0;

  entry.lines.forEach((line) => {
    const code = (line.accountCode || "").trim();
    if (!code) return;
    accountCodes.push(code);
    if ((line.debit || 0) > 0) debitAccountCodes.push(code);
    if ((line.credit || 0) > 0) creditAccountCodes.push(code);

    if (code === "2200") vatOutputAmount += Math.max(0, (line.credit || 0) - (line.debit || 0));
    if (code === "1400") vatInputAmount += Math.max(0, (line.debit || 0) - (line.credit || 0));
    if (code === "2220") whtPayableAmount += Math.max(0, (line.credit || 0) - (line.debit || 0));
    if (code === "1410") whtReceivableAmount += Math.max(0, (line.debit || 0) - (line.credit || 0));
    if (code === "2210") payeAmount += Math.max(0, (line.credit || 0) - (line.debit || 0));
  });

  return {
    accountCodes: unique(accountCodes),
    debitAccountCodes: unique(debitAccountCodes),
    creditAccountCodes: unique(creditAccountCodes),
    vatOutputAmount,
    vatInputAmount,
    whtPayableAmount,
    whtReceivableAmount,
    payeAmount,
  };
};

const inferTransactionTypeFromLines = (entry: JournalEntry): string => {
  const context = getLineContext(entry);
  const hasPayroll = context.accountCodes.some((code) => PAYROLL_ACCOUNT_CODES.has(code));
  if (hasPayroll) return "payroll";

  const hasRevenueCredit = context.creditAccountCodes.some((code) => code.startsWith("4"));
  if (hasRevenueCredit) return "sale";

  const hasExpenseDebit = context.debitAccountCodes.some(
    (code) => code.startsWith("5") || code.startsWith("6") || code.startsWith("7")
  );
  if (hasExpenseDebit) return "expense";

  const hasInventoryDebit = context.debitAccountCodes.some((code) => code.startsWith("12") || code === "5000" || code === "5010");
  if (hasInventoryDebit) return "purchase";

  const hasAssetDebit = context.debitAccountCodes.some((code) => code.startsWith("15"));
  const hasAssetCredit = context.creditAccountCodes.some((code) => code.startsWith("15"));
  if (hasAssetCredit) return "asset_disposal";
  if (hasAssetDebit) return "asset_purchase";

  return "general";
};

const mapTransactionType = (entry: JournalEntry): string => {
  const type = entry.transactionType || "general";
  if (type === "sale" || type === "sale-return") return "sale";
  if (type === "purchase" || type === "purchase-return") return "purchase";
  if (type === "expense") return "expense";
  if (type === "asset-disposal") return "asset_disposal";
  if (type === "asset-purchase") return "asset_purchase";
  if (type === "receipt") return "sale";
  if (type === "payment") return "expense";
  if (type === "loan-received") return "financing";
  if (type === "loan-repayment") return "financing";
  if (type === "owner-investment") return "equity";
  if (type === "owner-drawing") return "equity";
  return inferTransactionTypeFromLines(entry);
};

const computeEntryAmount = (entry: JournalEntry): number => {
  const nonTaxLines = entry.lines.filter((line) => !TAX_ACCOUNT_CODES.has((line.accountCode || "").trim()));
  const sourceLines = nonTaxLines.length > 0 ? nonTaxLines : entry.lines;
  const totalDebits = sourceLines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredits = sourceLines.reduce((sum, line) => sum + (line.credit || 0), 0);
  return Math.max(totalDebits, totalCredits, 0);
};

export function mapJournalEntriesToCompliance(
  entityId: string,
  entries: JournalEntry[]
): ComplianceTransaction[] {
  return entries
    .filter((entry) => entry.status === "posted")
    .map((entry) => {
      const amount = computeEntryAmount(entry);
      const lineContext = getLineContext(entry);
      const inferredType = inferTransactionTypeFromLines(entry);
      return {
        id: entry.id,
        entityId,
        date: entry.date || entry.createdAt,
        description: entry.narration || entry.reference || "Journal entry",
        amount,
        currency: "NGN",
        type: mapTransactionType(entry),
        source: entry.source || "accounting",
        metadata: {
          transactionType: entry.transactionType,
          inferredType,
          accountCodes: lineContext.accountCodes,
          debitAccountCodes: lineContext.debitAccountCodes,
          creditAccountCodes: lineContext.creditAccountCodes,
          vatOutputAmount: lineContext.vatOutputAmount,
          vatInputAmount: lineContext.vatInputAmount,
          whtPayableAmount: lineContext.whtPayableAmount,
          whtReceivableAmount: lineContext.whtReceivableAmount,
          payeAmount: lineContext.payeAmount,
          assumptions: entry.assumptions,
        },
      };
    });
}
