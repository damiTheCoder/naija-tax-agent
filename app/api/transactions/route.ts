import { NextRequest, NextResponse } from "next/server";
import { accountingEngine, parseTransactionFromChat } from "@/lib/accounting/transactionBridge";
import { type RawTransaction, type TransactionType } from "@/lib/accounting/types";
import { CHART_OF_ACCOUNTS } from "@/lib/accounting/standards";
import {
  accountingFeatureFlags,
  accountingJournalRepo,
  accountingWorkflowService,
  generateDeterministicId,
} from "@/lib/accounting/server";

export const runtime = "nodejs";

interface TransactionRequest {
  entityId?: string;
  description: string;
  amount?: number;
  date?: string;
  type?: "income" | "expense" | "transfer" | "auto";
  sourceCurrency?: string;
  baseCurrency?: string;
  exchangeRate?: number;
  trackingClassId?: string;
  trackingLocationId?: string;
  taxMode?: "inclusive" | "exclusive" | "category_default";
  vatApplicable?: boolean;
  vatRate?: number;
  whtApplicable?: boolean;
  whtRate?: number;
  taxCategory?: string;
  vatCategory?: "input" | "output" | "exempt" | "zero";
  reference?: string;
  journalId?: string;
  externalId?: string;
}

const ACCOUNT_NAME_BY_CODE = new Map(CHART_OF_ACCOUNTS.map((account) => [account.code, account.name]));

const toTodayIsoDate = (): string => new Date().toISOString().slice(0, 10);

const normalizeEntityId = (entityId?: string): string => {
  const raw = String(entityId || "entity-default").trim();
  return raw || "entity-default";
};

const toTypeFromParsed = (parsedType?: string, requested?: TransactionRequest["type"]): TransactionType => {
  if (requested && requested !== "auto") {
    if (requested === "income") return "income";
    if (requested === "expense") return "expense";
    return "other";
  }

  const normalized = String(parsedType || "").toLowerCase();
  if (normalized === "sale" || normalized === "receipt") return "income";
  if (normalized === "purchase" || normalized === "expense" || normalized === "payment") return "expense";
  if (normalized === "transfer") return "other";
  return "expense";
};

const defaultAccountsForType = (type: TransactionType): { debitCode: string; creditCode: string } => {
  if (type === "income") {
    return { debitCode: "1020", creditCode: "4000" };
  }
  return { debitCode: "5000", creditCode: "1020" };
};

const accountName = (code: string): string => ACCOUNT_NAME_BY_CODE.get(code) || `Account ${code}`;

const toNumericAmount = (value: unknown): number => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.abs(amount);
};

const buildJournalLinesForPrimary = (params: {
  amount: number;
  type: TransactionType;
  debitCode?: string;
  creditCode?: string;
}) => {
  const defaults = defaultAccountsForType(params.type);
  const debitCode = params.debitCode || defaults.debitCode;
  const creditCode = params.creditCode || defaults.creditCode;

  return [
    {
      accountCode: debitCode,
      accountName: accountName(debitCode),
      debit: params.amount,
      credit: 0,
    },
    {
      accountCode: creditCode,
      accountName: accountName(creditCode),
      debit: 0,
      credit: params.amount,
    },
  ];
};

const toJournalIdSeed = (entityId: string, date: string, description: string, amount: number): string =>
  generateDeterministicId("jnl-tx", [entityId, date, description.toLowerCase().trim(), amount.toFixed(2)]);

const buildAndLogTransactionReceipt = async (params: {
  entityId: string;
  journalId: string;
  description: string;
}) => {
  try {
    const receipt = accountingWorkflowService.buildActionReceipt({
      actionType: "accounting.postTransaction",
      entityId: params.entityId,
      resourceType: "journal",
      resourceId: params.journalId,
      journalId: params.journalId,
      status: "success",
      deepLink: `/accounting/workspace?journalId=${encodeURIComponent(params.journalId)}`,
    });
    await accountingWorkflowService.recordAction({
      receipt,
      actionType: "accounting.postTransaction",
      message: `Transaction posted: ${params.description}`,
      metadata: { journalId: params.journalId },
    });
    return receipt;
  } catch {
    return null;
  }
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: TransactionRequest = await request.json();
    const entityId = normalizeEntityId(body.entityId);

    if (!body.description || typeof body.description !== "string") {
      return NextResponse.json({ success: false, error: "Transaction description is required" }, { status: 400 });
    }

    const description = body.description.trim();
    const parsed = parseTransactionFromChat(description);

    if (!parsed || parsed.confidence < 0.3) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not parse transaction",
          suggestion: "Please try rephrasing, e.g., 'Sold goods for ₦5000 cash' or 'Paid rent ₦100000'",
        },
        { status: 400 }
      );
    }

    const amount = body.amount && body.amount > 0 ? Number(body.amount) : Number(parsed.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid amount required",
          suggestion: "Include amount in description or provide amount parameter",
        },
        { status: 400 }
      );
    }

    const date = body.date || toTodayIsoDate();
    const transactionType = toTypeFromParsed(parsed.parsedType, body.type);
    const rawTx: RawTransaction = {
      id: `api-${Date.now()}`,
      date,
      description,
      amount,
      category: parsed.category || "general",
      type: transactionType,
      taxMode: body.taxMode,
      vatApplicable: typeof body.vatApplicable === "boolean" ? body.vatApplicable : undefined,
      vatRate: Number.isFinite(Number(body.vatRate)) ? Number(body.vatRate) : undefined,
      whtApplicable: typeof body.whtApplicable === "boolean" ? body.whtApplicable : undefined,
      whtRate: Number.isFinite(Number(body.whtRate)) ? Number(body.whtRate) : undefined,
      taxCategory: body.taxCategory,
      vatCategory: body.vatCategory,
    };

    const shouldPrimaryPrisma = accountingFeatureFlags.prismaPrimary();
    const shouldDualWrite = accountingFeatureFlags.prismaDualWrite();

    let prismaJournal: Awaited<ReturnType<typeof accountingJournalRepo.postJournal>> | null = null;
    let localResult: ReturnType<typeof accountingEngine.processTransactionEnhanced> | null = null;
    let prismaSyncError: string | null = null;

    if (shouldPrimaryPrisma) {
      const journalLines = buildJournalLinesForPrimary({
        amount,
        type: transactionType,
        debitCode: parsed.debitAccount,
        creditCode: parsed.creditAccount,
      });

      prismaJournal = await accountingJournalRepo.postJournal({
        entityId,
        journalId: typeof body.journalId === "string" && body.journalId.trim() ? body.journalId : toJournalIdSeed(entityId, date, description, amount),
        date,
        narration: description,
        reference: typeof body.reference === "string" ? body.reference : undefined,
        sourceDocType: "transaction_api",
        sourceDocId: typeof body.externalId === "string" && body.externalId.trim() ? body.externalId : rawTx.id,
        sourceCurrency: typeof body.sourceCurrency === "string" ? body.sourceCurrency : "NGN",
        baseCurrency: typeof body.baseCurrency === "string" ? body.baseCurrency : "NGN",
        exchangeRate: Number.isFinite(Number(body.exchangeRate)) ? Number(body.exchangeRate) : 1,
        lines: journalLines,
        trackingClassId: body.trackingClassId,
        trackingLocationId: body.trackingLocationId,
        approvalStatus: "approved",
        status: "posted",
        metadata: {
          source: "api.transactions",
          parsedType: parsed.parsedType,
          category: rawTx.category,
          vatApplicable: rawTx.vatApplicable,
          vatRate: rawTx.vatRate,
          whtApplicable: rawTx.whtApplicable,
          whtRate: rawTx.whtRate,
          taxCategory: rawTx.taxCategory,
          vatCategory: rawTx.vatCategory,
        },
        syncTax: true,
      });

      if (shouldDualWrite) {
        try {
          localResult = accountingEngine.processTransactionEnhanced(rawTx);
        } catch {
          // Intentionally swallow local mirror failures when Prisma is primary.
        }
      }
      const receipt = await buildAndLogTransactionReceipt({
        entityId,
        journalId: prismaJournal.id,
        description,
      });

      return NextResponse.json({
        success: true,
        source: "prisma",
        entityId,
        message: `Transaction recorded: ${description}`,
        journalEntry: {
          id: prismaJournal.id,
          date: prismaJournal.date.toISOString().slice(0, 10),
          narration: prismaJournal.narration,
          lines: prismaJournal.lines,
          sourceCurrency: prismaJournal.sourceCurrency,
          baseCurrency: prismaJournal.baseCurrency,
          exchangeRate: prismaJournal.exchangeRate,
        },
        analysis: {
          debitAccount: {
            code: parsed.debitAccount || journalLines[0].accountCode,
            name: accountName(parsed.debitAccount || journalLines[0].accountCode),
            confidence: parsed.confidence,
          },
          creditAccount: {
            code: parsed.creditAccount || journalLines[1].accountCode,
            name: accountName(parsed.creditAccount || journalLines[1].accountCode),
            confidence: parsed.confidence,
          },
          confidence: parsed.confidence,
        },
        response: `Posted to journal ${prismaJournal.id}.`,
        receipt,
        dualWrite: {
          enabled: shouldDualWrite,
          localMirrorPosted: Boolean(localResult),
        },
      });
    }

    localResult = accountingEngine.processTransactionEnhanced(rawTx);

    if (shouldDualWrite) {
      try {
        prismaJournal = await accountingJournalRepo.postJournal({
          entityId,
          journalId: typeof body.journalId === "string" && body.journalId.trim() ? body.journalId : toJournalIdSeed(entityId, date, description, amount),
          date,
          narration: localResult.journalEntry.narration,
          reference: typeof body.reference === "string" ? body.reference : localResult.journalEntry.reference,
          sourceDocType: "transaction_api",
          sourceDocId: typeof body.externalId === "string" && body.externalId.trim() ? body.externalId : rawTx.id,
          sourceCurrency: typeof body.sourceCurrency === "string" ? body.sourceCurrency : "NGN",
          baseCurrency: typeof body.baseCurrency === "string" ? body.baseCurrency : "NGN",
          exchangeRate: Number.isFinite(Number(body.exchangeRate)) ? Number(body.exchangeRate) : 1,
          lines: localResult.journalEntry.lines,
          trackingClassId: body.trackingClassId,
          trackingLocationId: body.trackingLocationId,
          approvalStatus: "approved",
          status: "posted",
          metadata: {
            source: "api.transactions",
            parsedType: parsed.parsedType,
            category: rawTx.category,
            vatApplicable: rawTx.vatApplicable,
            vatRate: rawTx.vatRate,
            whtApplicable: rawTx.whtApplicable,
            whtRate: rawTx.whtRate,
            taxCategory: rawTx.taxCategory,
            vatCategory: rawTx.vatCategory,
          },
          syncTax: true,
        });
      } catch (error) {
        prismaSyncError = error instanceof Error ? error.message : "Prisma sync failed";
      }
    }

    const receipt =
      shouldDualWrite && prismaJournal?.id
        ? await buildAndLogTransactionReceipt({
            entityId,
            journalId: prismaJournal.id,
            description,
          })
        : null;

    return NextResponse.json({
      success: true,
      source: "local",
      entityId,
      message: `Transaction recorded: ${description}`,
      journalEntry: {
        id: localResult.journalEntry.id,
        date: localResult.journalEntry.date,
        narration: localResult.journalEntry.narration,
        lines: localResult.journalEntry.lines,
      },
      analysis: {
        debitAccount: localResult.analysis.debitAccount,
        creditAccount: localResult.analysis.creditAccount,
        confidence: (localResult.analysis.debitAccount.confidence + localResult.analysis.creditAccount.confidence) / 2,
      },
      response: localResult.chatResponse,
      receipt,
      prismaSync: {
        enabled: shouldDualWrite,
        success: shouldDualWrite ? !prismaSyncError : false,
        error: prismaSyncError,
        journalId: prismaJournal?.id,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to record transaction",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = normalizeEntityId(searchParams.get("entityId") || undefined);
    const limit = Math.max(1, Math.min(200, Math.round(toNumericAmount(searchParams.get("limit")) || 10)));

    if (accountingFeatureFlags.prismaPrimary()) {
      const journals = await accountingJournalRepo.list(entityId, limit);
      const transactions = journals.map((journal) => ({
        id: journal.id,
        date: journal.date.toISOString().slice(0, 10),
        narration: journal.narration,
        amount: journal.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0),
        lines: journal.lines,
        sourceCurrency: journal.sourceCurrency,
        baseCurrency: journal.baseCurrency,
        exchangeRate: journal.exchangeRate,
        approvalStatus: journal.approvalStatus,
      }));

      return NextResponse.json({
        success: true,
        source: "prisma",
        transactions,
        count: transactions.length,
        totalEntries: transactions.length,
      });
    }

    const state = accountingEngine.getState();
    const recentEntries = state.journalEntries
      .slice(-limit)
      .reverse()
      .map((entry) => ({
        id: entry.id,
        date: entry.date,
        narration: entry.narration,
        amount: entry.lines.reduce((sum, line) => sum + (line.debit || 0), 0),
        lines: entry.lines,
      }));

    return NextResponse.json({
      success: true,
      source: "local",
      transactions: recentEntries,
      count: recentEntries.length,
      totalEntries: state.journalEntries.length,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve transactions",
      },
      { status: 500 }
    );
  }
}
