import PocketBase from "pocketbase";
import { escapeFilterValue } from "@/lib/pocketbase/filters";
import { AppSession } from "@/lib/pocketbase/session";
import { requireBusinessWriteAccess } from "@/lib/pocketbase/businessAccess";

export type JournalLineInput = {
  accountId: string;
  description?: string;
  debitMinor?: number;
  creditMinor?: number;
  contactId?: string;
  transactionId?: string;
  taxCodeId?: string;
  invoiceId?: string;
  billId?: string;
};

export type PostJournalEntryInput = {
  businessId: string;
  entryDate: string;
  entryNumber?: string;
  reference?: string;
  memo?: string;
  sourceType?: "manual" | "bank" | "invoice" | "expense" | "bill" | "ai" | "opening_balance" | "adjustment";
  sourceRecordId?: string;
  currency?: string;
  idempotencyKey?: string;
  lines: JournalLineInput[];
};

type PocketBaseRecord = {
  id: string;
  [key: string]: unknown;
};

function asMinorUnit(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.trunc(value);
}

function requireId(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function makeEntryNumber(): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/\D/g, "").slice(0, 14);
  return `JE-${stamp}`;
}

async function assertAccountsBelongToBusiness(
  pb: PocketBase,
  businessId: string,
  accountIds: string[],
): Promise<void> {
  const uniqueIds = Array.from(new Set(accountIds));
  await Promise.all(
    uniqueIds.map(async (accountId) => {
      const account = (await pb.collection("chart_of_accounts").getOne(accountId, {
        requestKey: null,
      })) as PocketBaseRecord;
      if (account.business !== businessId) {
        throw new Error(`Account ${accountId} does not belong to this business.`);
      }
    }),
  );
}

export async function postJournalEntry(
  pb: PocketBase,
  session: AppSession,
  input: PostJournalEntryInput,
): Promise<{ journalEntry: PocketBaseRecord; journalLines: PocketBaseRecord[] }> {
  const businessId = requireId(input.businessId, "businessId");
  await requireBusinessWriteAccess(pb, session, businessId);

  if (!Array.isArray(input.lines) || input.lines.length < 2) {
    throw new Error("A journal entry requires at least two lines.");
  }

  const normalizedLines = input.lines.map((line, index) => {
    const accountId = requireId(line.accountId, `lines[${index}].accountId`);
    const debitMinor = asMinorUnit(line.debitMinor);
    const creditMinor = asMinorUnit(line.creditMinor);

    if (debitMinor < 0 || creditMinor < 0) {
      throw new Error("Journal line amounts cannot be negative.");
    }
    if ((debitMinor > 0 && creditMinor > 0) || (debitMinor === 0 && creditMinor === 0)) {
      throw new Error("Each journal line must contain either a debit or a credit amount.");
    }

    return {
      ...line,
      accountId,
      debitMinor,
      creditMinor,
    };
  });

  const totalDebitMinor = normalizedLines.reduce((sum, line) => sum + line.debitMinor, 0);
  const totalCreditMinor = normalizedLines.reduce((sum, line) => sum + line.creditMinor, 0);

  if (totalDebitMinor !== totalCreditMinor) {
    throw new Error("Journal entry is not balanced: total debit must equal total credit.");
  }

  await assertAccountsBelongToBusiness(
    pb,
    businessId,
    normalizedLines.map((line) => line.accountId),
  );

  if (input.idempotencyKey) {
    try {
      const existing = (await pb.collection("journal_entries").getFirstListItem(
        `idempotency_key="${escapeFilterValue(input.idempotencyKey)}"`,
        { requestKey: null },
      )) as PocketBaseRecord;
      const lines = (await pb.collection("journal_lines").getFullList({
        filter: `journal_entry="${escapeFilterValue(existing.id)}"`,
        requestKey: null,
      })) as PocketBaseRecord[];
      return { journalEntry: existing, journalLines: lines };
    } catch {
      // No existing idempotent entry; continue with creation.
    }
  }

  const journalEntry = (await pb.collection("journal_entries").create({
    business: businessId,
    entry_number: input.entryNumber?.trim() || makeEntryNumber(),
    entry_date: requireId(input.entryDate, "entryDate"),
    reference: input.reference?.trim() || "",
    memo: input.memo?.trim() || "",
    source_type: input.sourceType || "manual",
    source_record_id: input.sourceRecordId?.trim() || "",
    status: "posted",
    currency: input.currency || "NGN",
    total_debit_minor: totalDebitMinor,
    total_credit_minor: totalCreditMinor,
    created_by: session.userId,
    posted_by: session.userId,
    posted_at: new Date().toISOString(),
    idempotency_key: input.idempotencyKey?.trim() || "",
  })) as PocketBaseRecord;

  const journalLines = await Promise.all(
    normalizedLines.map(async (line) => {
      return (await pb.collection("journal_lines").create({
        business: businessId,
        journal_entry: journalEntry.id,
        account: line.accountId,
        description: line.description?.trim() || "",
        debit_minor: line.debitMinor,
        credit_minor: line.creditMinor,
        contact: line.contactId || "",
        transaction: line.transactionId || "",
        tax_code: line.taxCodeId || "",
        invoice: line.invoiceId || "",
        bill: line.billId || "",
      })) as PocketBaseRecord;
    }),
  );

  await pb.collection("audit_logs").create({
    business: businessId,
    user: session.userId,
    action: "journal_entry.posted",
    entity_collection: "journal_entries",
    entity_record_id: journalEntry.id,
    old_values: null,
    new_values: {
      journalEntry,
      lineCount: journalLines.length,
      totalDebitMinor,
      totalCreditMinor,
    },
    created_at: new Date().toISOString(),
  });

  return { journalEntry, journalLines };
}
