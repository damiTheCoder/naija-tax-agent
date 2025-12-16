import { RawTransaction } from "./types";
import { generateStatementDraft } from "./statementEngine";

export type AutomationStatus = "idle" | "connecting" | "syncing" | "live";

export interface AutomationUpdate {
  status: AutomationStatus;
  message: string;
  generatedTransactions?: RawTransaction[];
}

export interface AutomationClient {
  connectBank: (bankName: string) => Promise<AutomationUpdate>;
  runSync: (existingTransactions: RawTransaction[], bankName: string) => Promise<AutomationUpdate>;
}

export interface WorkspaceFilePreview {
  slug: string;
  title: string;
  subtitle: string;
  meta: string;
  badge: "Live" | "Draft";
}

export interface TrialBalanceRow {
  account: string;
  debit: number;
  credit: number;
}

const CATEGORY_POOL = [
  { category: "sales", type: "income" as const, description: "POS settlements" },
  { category: "subscription", type: "income" as const, description: "SaaS renewals" },
  { category: "payroll", type: "expense" as const, description: "Payroll batch" },
  { category: "rent", type: "expense" as const, description: "Office rent" },
  { category: "equipment", type: "asset" as const, description: "Capex upgrade" },
  { category: "loan", type: "liability" as const, description: "Loan drawdown" },
];

const formatCurrency = (value: number) => `₦${Math.abs(value).toLocaleString("en-NG")}`;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export const BANK_PROVIDERS = ["Zenith Bank Business", "GTBank Corporate", "AccessMore Pro"];

export function createAITransactions(count: number, bankName: string): RawTransaction[] {
  const baseTimestamp = Date.now();
  return Array.from({ length: count }).map((_, index) => {
    const template = CATEGORY_POOL[index % CATEGORY_POOL.length];
    const amount = randomBetween(50_000, 700_000);
    const signedAmount = template.type === "expense" || template.type === "asset" ? -amount : amount;
    const date = new Date(Date.now() - index * 86_400_000).toISOString().split("T")[0];
    return {
      id: `auto-${baseTimestamp}-${index}`,
      date,
      description: `${template.description} • ${bankName}`,
      category: template.category,
      amount: signedAmount,
      type: template.type,
      sourceDocument: "Bank feed",
    } satisfies RawTransaction;
  });
}

export const mockAutomationClient: AutomationClient = {
  async connectBank(bankName: string) {
    await delay(900);
    return {
      status: "syncing",
      message: `Connected to ${bankName}. Pulling 90 days of history and staging drafts.`,
    };
  },
  async runSync(existingTransactions: RawTransaction[], bankName: string) {
    await delay(1200);
    const generatedTransactions = createAITransactions(4 + (existingTransactions.length % 4), bankName);
    return {
      status: "live",
      message: `Classified ${generatedTransactions.length} new entries from ${bankName}.`,
      generatedTransactions,
    };
  },
};

export function deriveWorkspaceFiles(transactions: RawTransaction[]): WorkspaceFilePreview[] {
  const statement = generateStatementDraft(transactions);
  const totals = transactions.length;
  const lastTransaction = transactions[transactions.length - 1];
  const lastUpdatedLabel = lastTransaction
    ? new Date(lastTransaction.date).toLocaleDateString("en-NG", { month: "short", day: "numeric" })
    : "Awaiting sync";

  const accountSet = new Set(transactions.map((tx) => tx.category.toLowerCase()));
  const ledgerPreview = accountSet.size
    ? `${Array.from(accountSet).slice(0, 3).join(", ")}${accountSet.size > 3 ? " +" : ""}`
    : "Accounts auto-create once the feed runs";

  const badge: "Live" | "Draft" = totals ? "Live" : "Draft";

  return [
    {
      slug: "journals",
      title: "Journals",
      subtitle: totals ? `${totals.toLocaleString()} AI-tagged entries` : "No entries yet",
      meta: `Last update ${lastUpdatedLabel}`,
      badge,
    },
    {
      slug: "chart",
      title: "Chart of accounts",
      subtitle: accountSet.size ? `${accountSet.size} active accounts` : "Accounts spin up automatically",
      meta: ledgerPreview,
      badge,
    },
    {
      slug: "financials",
      title: "Financial statements",
      subtitle: totals ? `Net income ${formatCurrency(statement.netIncome)}` : "Awaiting journals",
      meta: `Assets ${formatCurrency(statement.assets)} · Liabilities ${formatCurrency(statement.liabilities)}`,
      badge,
    },
    {
      slug: "ledgers",
      title: "Ledgers & schedules",
      subtitle: totals ? "Ledgers ready for audit trace" : "Auto-build once feed streams",
      meta: ledgerPreview,
      badge,
    },
  ];
}

export function deriveTrialBalancePreview(transactions: RawTransaction[]): TrialBalanceRow[] {
  if (transactions.length === 0) {
    return [
      { account: "Sales", debit: 0, credit: 0 },
      { account: "Payroll", debit: 0, credit: 0 },
      { account: "Rent", debit: 0, credit: 0 },
    ];
  }

  const summary = new Map<string, TrialBalanceRow>();

  transactions.forEach((tx) => {
    const key = tx.category || tx.type;
    if (!summary.has(key)) {
      summary.set(key, { account: key, debit: 0, credit: 0 });
    }
    const row = summary.get(key)!;
    const amount = Math.abs(tx.amount);
    if (tx.type === "expense" || tx.type === "asset") {
      row.debit += amount;
    } else {
      row.credit += amount;
    }
  });

  return Array.from(summary.values())
    .filter((row) => row.debit > 0 || row.credit > 0)
    .sort((a, b) => b.debit + b.credit - (a.debit + a.credit))
    .slice(0, 6);
}
