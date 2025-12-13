import { RawTransaction, StatementDraft, TransactionType } from "./types";

const CATEGORY_MAP: Record<string, TransactionType> = {
  sales: "income",
  subscription: "income",
  interest: "income",
  cogs: "expense",
  payroll: "expense",
  rent: "expense",
  utilities: "expense",
  equipment: "asset",
  loan: "liability",
  equity: "equity",
};

export function normaliseCategory(category: string): TransactionType {
  const key = category.toLowerCase();
  return CATEGORY_MAP[key] || "other";
}

export function generateStatementDraft(transactions: RawTransaction[]): StatementDraft {
  let revenue = 0;
  let costOfSales = 0;
  let operatingExpenses = 0;
  let otherIncome = 0;
  let assets = 0;
  let liabilities = 0;
  let equity = 0;
  let cashFromOperations = 0;
  let cashFromInvesting = 0;
  let cashFromFinancing = 0;

  transactions.forEach((tx) => {
    switch (tx.type) {
      case "income":
        revenue += tx.amount;
        cashFromOperations += tx.amount;
        break;
      case "expense":
        if (tx.category.toLowerCase().includes("cog")) {
          costOfSales += Math.abs(tx.amount);
        } else {
          operatingExpenses += Math.abs(tx.amount);
        }
        cashFromOperations -= Math.abs(tx.amount);
        break;
      case "asset":
        assets += Math.abs(tx.amount);
        cashFromInvesting -= Math.abs(tx.amount);
        break;
      case "liability":
        liabilities += Math.abs(tx.amount);
        cashFromFinancing += Math.abs(tx.amount);
        break;
      case "equity":
        equity += Math.abs(tx.amount);
        cashFromFinancing += Math.abs(tx.amount);
        break;
      default:
        otherIncome += tx.amount;
        break;
    }
  });

  const grossProfit = revenue - costOfSales;
  const operatingIncome = grossProfit - operatingExpenses;
  const netIncome = operatingIncome + otherIncome;

  if (equity === 0) {
    equity = netIncome + (assets - liabilities - netIncome);
  }

  return {
    revenue,
    costOfSales,
    grossProfit,
    operatingExpenses,
    operatingIncome,
    otherIncome,
    netIncome,
    assets,
    liabilities,
    equity,
    cashFromOperations,
    cashFromInvesting,
    cashFromFinancing,
  };
}

export function buildTransactionsFromFiles(files: File[]): RawTransaction[] {
  const baseDate = new Date();
  return files.map((file, index) => {
    const amount = Math.round((Math.random() * 900_000 + 50_000) * (index % 2 === 0 ? 1 : -1));
    const cat = index % 3 === 0 ? "sales" : index % 3 === 1 ? "cogs" : "payroll";
    const type = normaliseCategory(cat);
    const date = new Date(baseDate.getTime() - index * 86400000);
    return {
      id: `${file.name}-${index}`,
      date: date.toISOString().split("T")[0],
      description: `${cat.toUpperCase()} extracted from ${file.name}`,
      category: cat,
      amount: amount,
      type,
      sourceDocument: file.name,
    };
  });
}
