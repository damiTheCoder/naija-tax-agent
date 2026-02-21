import type { JournalEntry } from "@/lib/accounting/doubleEntry";
import type { ComplianceTransaction } from "./types";

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
  return "general";
};

const computeEntryAmount = (entry: JournalEntry): number => {
  const totalDebits = entry.totalDebits || entry.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredits = entry.totalCredits || entry.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
  return Math.max(totalDebits, totalCredits);
};

export function mapJournalEntriesToCompliance(
  entityId: string,
  entries: JournalEntry[]
): ComplianceTransaction[] {
  return entries
    .filter((entry) => entry.status === "posted")
    .map((entry) => {
      const amount = computeEntryAmount(entry);
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
          assumptions: entry.assumptions,
        },
      };
    });
}
