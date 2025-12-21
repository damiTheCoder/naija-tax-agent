/**
 * Transaction Bridge Module
 * Connects chat interface, workspace, and dashboard with the double-entry accounting engine
 * 
 * Flow: User Input → Parse → Classify → Journal Entry → Ledger → Workspace → Dashboard
 */

import { RawTransaction, StatementDraft } from "./types";
import {
  JournalEntry,
  JournalLine,
  LedgerAccount,
  LedgerEntry,
  TransactionType,
  TransactionInput,
  TransactionInterpretation,
  PaymentMethod,
  CHART_OF_ACCOUNTS,
  getAccount,
  validateJournalEntry,
  generateJournalId,
  getNormalBalance,
  AccountType,
} from "./doubleEntry";

// ============================================================================
// ACCOUNTING ENGINE STATE
// ============================================================================

export interface AccountingState {
  journalEntries: JournalEntry[];
  ledgerAccounts: Map<string, LedgerAccount>;
  lastUpdated: string;
}

class AccountingEngine {
  private state: AccountingState;
  private listeners: Set<(state: AccountingState) => void> = new Set();

  constructor() {
    this.state = {
      journalEntries: [],
      ledgerAccounts: new Map(),
      lastUpdated: new Date().toISOString(),
    };
    this.initializeLedger();
  }

  private initializeLedger() {
    // Initialize ledger accounts from chart of accounts
    CHART_OF_ACCOUNTS.forEach((account) => {
      this.state.ledgerAccounts.set(account.code, {
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        normalBalance: account.normalBalance,
        openingBalance: 0,
        entries: [],
        closingBalance: 0,
      });
    });
  }

  // Subscribe to state changes
  subscribe(listener: (state: AccountingState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.state.lastUpdated = new Date().toISOString();
    this.listeners.forEach((listener) => listener(this.state));
    this.persist();
  }

  // Persist to localStorage
  private persist() {
    if (typeof window === "undefined") return;
    const serializable = {
      journalEntries: this.state.journalEntries,
      ledgerAccounts: Array.from(this.state.ledgerAccounts.entries()),
      lastUpdated: this.state.lastUpdated,
    };
    window.localStorage.setItem("insight::accounting-engine", JSON.stringify(serializable));
  }

  // Load from localStorage
  load() {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("insight::accounting-engine");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.state.journalEntries = parsed.journalEntries || [];
        if (parsed.ledgerAccounts) {
          this.state.ledgerAccounts = new Map(parsed.ledgerAccounts);
        }
        this.state.lastUpdated = parsed.lastUpdated || new Date().toISOString();
      } catch {
        // Ignore malformed cache
      }
    }
  }

  getState(): AccountingState {
    return this.state;
  }

  /**
   * Process a raw transaction and create journal entries
   */
  processTransaction(rawTx: RawTransaction): {
    journalEntry: JournalEntry;
    interpretation: TransactionInterpretation;
    chatResponse: string;
  } {
    // Step 1: Interpret the transaction
    const interpretation = this.interpretTransaction(rawTx);

    // Step 2: Create journal entry
    const journalEntry = this.createJournalEntry(rawTx, interpretation);

    // Step 3: Post to ledger
    this.postToLedger(journalEntry);

    // Step 4: Add to state
    this.state.journalEntries.push(journalEntry);
    this.notify();

    // Step 5: Generate chat response
    const chatResponse = this.generateChatResponse(journalEntry, interpretation);

    return { journalEntry, interpretation, chatResponse };
  }

  /**
   * Interpret a raw transaction to understand its accounting treatment
   */
  private interpretTransaction(rawTx: RawTransaction): TransactionInterpretation {
    const category = rawTx.category?.toLowerCase() || "";
    const description = rawTx.description.toLowerCase();
    const amount = Math.abs(rawTx.amount);

    // Determine transaction type
    let transactionType: TransactionType = "other";
    let isCredit = false;
    let paymentMethod: PaymentMethod = "bank";
    let vatApplicable = false;
    let whtApplicable = false;
    let hasInventoryImpact = false;
    const assumptions: string[] = [];
    const questionsNeeded: string[] = [];

    // Detect transaction type from category and description
    if (category === "sales" || rawTx.type === "income") {
      transactionType = "sale";
      vatApplicable = true;
      assumptions.push("Applied 7.5% VAT on sale");
      if (description.includes("credit") || description.includes("invoice")) {
        isCredit = true;
        assumptions.push("Recorded as credit sale (accounts receivable)");
      }
      // Check if this is a sale with inventory (perpetual inventory system)
      if (description.includes("goods") || description.includes("product") || description.includes("inventory")) {
        hasInventoryImpact = true;
        assumptions.push("Recording COGS (assumed 60% of sale price)");
      }
    } else if (description.includes("sales return") || description.includes("sale return") || description.includes("returned goods")) {
      transactionType = "sale-return";
      vatApplicable = true;
      assumptions.push("Reversing sale with VAT adjustment");
    } else if (description.includes("purchase return") || description.includes("returned to supplier")) {
      transactionType = "purchase-return";
      vatApplicable = true;
      assumptions.push("Reversing purchase with VAT adjustment");
    } else if (category === "purchases" || description.includes("purchase")) {
      transactionType = "purchase";
      vatApplicable = true;
      hasInventoryImpact = true;
      assumptions.push("Applied 7.5% VAT on purchase");
      if (description.includes("credit")) {
        isCredit = true;
        assumptions.push("Recorded as credit purchase (accounts payable)");
      }
    } else if (category === "expense" || rawTx.type === "expense") {
      transactionType = "expense";
      // Check for WHT applicable expenses
      if (
        description.includes("rent") ||
        description.includes("professional") ||
        description.includes("consultancy") ||
        description.includes("legal")
      ) {
        whtApplicable = true;
        assumptions.push("Applied 10% WHT on payment");
      }
    } else if (category === "asset" || description.includes("equipment") || description.includes("machinery") || description.includes("vehicle")) {
      transactionType = "asset-purchase";
      assumptions.push("Capitalizing as fixed asset");
    } else if (description.includes("depreciation")) {
      transactionType = "depreciation";
      assumptions.push("Recording depreciation expense");
    } else if (description.includes("loan") && description.includes("received")) {
      transactionType = "loan-received";
    } else if (description.includes("loan") && (description.includes("repay") || description.includes("payment"))) {
      transactionType = "loan-repayment";
      assumptions.push("Splitting principal and interest (assumed 20% interest portion)");
    } else if (description.includes("capital") || description.includes("investment")) {
      transactionType = "owner-investment";
    } else if (description.includes("drawing") || description.includes("withdrawal")) {
      transactionType = "owner-drawing";
    } else if (description.includes("transfer")) {
      transactionType = "transfer";
    } else if (description.includes("receipt") || description.includes("received from")) {
      transactionType = "receipt";
      assumptions.push("Recording cash receipt from debtor");
    } else if (description.includes("payment to") || description.includes("paid to")) {
      transactionType = "payment";
      assumptions.push("Recording payment to creditor");
    }

    // Detect payment method
    if (description.includes("cash")) {
      paymentMethod = "cash";
    } else if (description.includes("pos") || description.includes("card")) {
      paymentMethod = "pos";
    } else if (description.includes("transfer") || description.includes("bank")) {
      paymentMethod = "bank";
    } else if (description.includes("cheque") || description.includes("check")) {
      paymentMethod = "cheque";
    }

    // Calculate amounts
    const vatRate = vatApplicable ? 0.075 : 0;
    const whtRate = whtApplicable ? 0.1 : 0;
    const vatAmount = amount * vatRate;
    const whtAmount = amount * whtRate;
    const netAmount = amount - whtAmount;

    return {
      transactionType,
      description: rawTx.description,
      amount,
      netAmount,
      vatAmount,
      whtAmount,
      paymentMethod,
      isCredit,
      hasTax: vatApplicable || whtApplicable,
      hasInventoryImpact,
      assumptions,
      questionsNeeded,
    };
  }

  /**
   * Create a proper double-entry journal entry from a transaction
   */
  private createJournalEntry(
    rawTx: RawTransaction,
    interpretation: TransactionInterpretation
  ): JournalEntry {
    const lines: JournalLine[] = [];
    const { transactionType, amount, vatAmount, whtAmount, paymentMethod, isCredit } = interpretation;

    // Get cash/bank account based on payment method
    const cashAccount = paymentMethod === "cash" ? "1000" : "1020";
    const cashAccountName = paymentMethod === "cash" ? "Cash" : "Bank";

    // Build journal entries based on transaction type
    switch (transactionType) {
      case "sale": {
        // DR: Cash/Bank or Accounts Receivable
        // CR: Sales
        // CR: Output VAT Payable (if applicable)
        // If inventory: DR COGS, CR Inventory
        const totalAmount = amount + vatAmount;
        
        if (isCredit) {
          lines.push({
            accountCode: "1100",
            accountName: "Accounts Receivable",
            debit: totalAmount,
            credit: 0,
            memo: `Sale to customer - Invoice`,
          });
        } else {
          lines.push({
            accountCode: cashAccount,
            accountName: cashAccountName,
            debit: totalAmount,
            credit: 0,
            memo: `Cash/Bank sale`,
          });
        }

        lines.push({
          accountCode: "4000",
          accountName: "Sales",
          debit: 0,
          credit: amount,
        });

        if (vatAmount > 0) {
          lines.push({
            accountCode: "2200",
            accountName: "Output VAT Payable",
            debit: 0,
            credit: vatAmount,
          });
        }

        // Record COGS if inventory is involved (perpetual inventory system)
        if (interpretation.hasInventoryImpact) {
          const costOfGoods = interpretation.costOfGoods || amount * 0.6; // Default 60% COGS ratio
          lines.push({
            accountCode: "5000",
            accountName: "Cost of Goods Sold",
            debit: costOfGoods,
            credit: 0,
            memo: "Cost of goods sold",
          });
          lines.push({
            accountCode: "1200",
            accountName: "Inventory",
            debit: 0,
            credit: costOfGoods,
            memo: "Inventory reduction",
          });
        }
        break;
      }

      case "sale-return": {
        // Reverse of sale:
        // DR: Sales Returns
        // DR: Output VAT Payable
        // CR: Cash/Bank or Accounts Receivable
        const totalAmount = amount + vatAmount;
        
        lines.push({
          accountCode: "4100",
          accountName: "Sales Returns",
          debit: amount,
          credit: 0,
        });

        if (vatAmount > 0) {
          lines.push({
            accountCode: "2200",
            accountName: "Output VAT Payable",
            debit: vatAmount,
            credit: 0,
          });
        }

        lines.push({
          accountCode: isCredit ? "1100" : cashAccount,
          accountName: isCredit ? "Accounts Receivable" : cashAccountName,
          debit: 0,
          credit: totalAmount,
          memo: "Refund for returned goods",
        });
        break;
      }

      case "purchase-return": {
        // Reverse of purchase:
        // DR: Cash/Bank or Accounts Payable
        // CR: Purchases Returns
        // CR: Input VAT Receivable
        const totalAmount = amount + vatAmount;

        lines.push({
          accountCode: isCredit ? "2000" : cashAccount,
          accountName: isCredit ? "Accounts Payable" : cashAccountName,
          debit: totalAmount,
          credit: 0,
          memo: "Refund for returned purchase",
        });

        lines.push({
          accountCode: "5020",
          accountName: "Purchases Returns",
          debit: 0,
          credit: amount,
        });

        if (vatAmount > 0) {
          lines.push({
            accountCode: "1400",
            accountName: "Input VAT Receivable",
            debit: 0,
            credit: vatAmount,
          });
        }
        break;
      }

      case "purchase": {
        // DR: Purchases/Inventory
        // DR: Input VAT Receivable (if applicable)
        // CR: Cash/Bank or Accounts Payable
        const totalAmount = amount + vatAmount;

        lines.push({
          accountCode: "5010",
          accountName: "Purchases",
          debit: amount,
          credit: 0,
        });

        if (vatAmount > 0) {
          lines.push({
            accountCode: "1400",
            accountName: "Input VAT Receivable",
            debit: vatAmount,
            credit: 0,
          });
        }

        if (isCredit) {
          lines.push({
            accountCode: "2000",
            accountName: "Accounts Payable",
            debit: 0,
            credit: totalAmount,
            memo: `Credit purchase`,
          });
        } else {
          lines.push({
            accountCode: cashAccount,
            accountName: cashAccountName,
            debit: 0,
            credit: totalAmount,
          });
        }
        break;
      }

      case "expense": {
        // DR: Expense account
        // CR: Cash/Bank
        // CR: WHT Payable (if applicable)
        const expenseCode = this.mapCategoryToExpenseAccount(rawTx.category || "");
        const expenseAccount = getAccount(expenseCode);

        lines.push({
          accountCode: expenseCode,
          accountName: expenseAccount?.name || "Operating Expense",
          debit: amount,
          credit: 0,
        });

        if (whtAmount > 0) {
          lines.push({
            accountCode: "2220",
            accountName: "WHT Payable",
            debit: 0,
            credit: whtAmount,
          });
          lines.push({
            accountCode: cashAccount,
            accountName: cashAccountName,
            debit: 0,
            credit: amount - whtAmount,
          });
        } else {
          lines.push({
            accountCode: cashAccount,
            accountName: cashAccountName,
            debit: 0,
            credit: amount,
          });
        }
        break;
      }

      case "asset-purchase": {
        // DR: Fixed Asset
        // CR: Cash/Bank
        lines.push({
          accountCode: "1540",
          accountName: "Office Equipment",
          debit: amount,
          credit: 0,
        });
        lines.push({
          accountCode: cashAccount,
          accountName: cashAccountName,
          debit: 0,
          credit: amount,
        });
        break;
      }

      case "loan-received": {
        // DR: Cash/Bank
        // CR: Short-term Loan
        lines.push({
          accountCode: cashAccount,
          accountName: cashAccountName,
          debit: amount,
          credit: 0,
        });
        lines.push({
          accountCode: "2300",
          accountName: "Short-term Loans",
          debit: 0,
          credit: amount,
        });
        break;
      }

      case "owner-investment": {
        // DR: Cash/Bank
        // CR: Owner's Capital
        lines.push({
          accountCode: cashAccount,
          accountName: cashAccountName,
          debit: amount,
          credit: 0,
        });
        lines.push({
          accountCode: "3000",
          accountName: "Owner's Capital",
          debit: 0,
          credit: amount,
        });
        break;
      }

      case "owner-drawing": {
        // DR: Drawings
        // CR: Cash/Bank
        lines.push({
          accountCode: "3200",
          accountName: "Drawings",
          debit: amount,
          credit: 0,
        });
        lines.push({
          accountCode: cashAccount,
          accountName: cashAccountName,
          debit: 0,
          credit: amount,
        });
        break;
      }

      case "loan-repayment": {
        // DR: Short-term Loans (principal portion)
        // DR: Interest Expense (interest portion)
        // CR: Cash/Bank
        const interestPortion = amount * 0.2; // Assume 20% is interest
        const principalPortion = amount - interestPortion;

        lines.push({
          accountCode: "2300",
          accountName: "Short-term Loans",
          debit: principalPortion,
          credit: 0,
          memo: "Principal repayment",
        });
        lines.push({
          accountCode: "6500",
          accountName: "Interest Expense",
          debit: interestPortion,
          credit: 0,
          memo: "Interest on loan",
        });
        lines.push({
          accountCode: cashAccount,
          accountName: cashAccountName,
          debit: 0,
          credit: amount,
        });
        break;
      }

      case "depreciation": {
        // DR: Depreciation Expense
        // CR: Accumulated Depreciation
        lines.push({
          accountCode: "5700",
          accountName: "Depreciation Expense",
          debit: amount,
          credit: 0,
        });
        lines.push({
          accountCode: "1541",
          accountName: "Accumulated Depreciation - Equipment",
          debit: 0,
          credit: amount,
        });
        break;
      }

      case "receipt": {
        // DR: Cash/Bank
        // CR: Accounts Receivable
        lines.push({
          accountCode: cashAccount,
          accountName: cashAccountName,
          debit: amount,
          credit: 0,
          memo: "Receipt from debtor",
        });
        lines.push({
          accountCode: "1100",
          accountName: "Accounts Receivable",
          debit: 0,
          credit: amount,
        });
        break;
      }

      case "payment": {
        // DR: Accounts Payable
        // CR: Cash/Bank
        lines.push({
          accountCode: "2000",
          accountName: "Accounts Payable",
          debit: amount,
          credit: 0,
          memo: "Payment to creditor",
        });
        lines.push({
          accountCode: cashAccount,
          accountName: cashAccountName,
          debit: 0,
          credit: amount,
        });
        break;
      }

      case "transfer": {
        // DR: Destination account (Bank)
        // CR: Source account (Cash)
        lines.push({
          accountCode: "1020",
          accountName: "Bank",
          debit: amount,
          credit: 0,
          memo: "Transfer in",
        });
        lines.push({
          accountCode: "1000",
          accountName: "Cash",
          debit: 0,
          credit: amount,
          memo: "Transfer out",
        });
        break;
      }

      default: {
        // Generic: Income = CR Revenue, DR Cash
        // Expense = DR Expense, CR Cash
        if (rawTx.type === "income") {
          lines.push({
            accountCode: cashAccount,
            accountName: cashAccountName,
            debit: amount,
            credit: 0,
          });
          lines.push({
            accountCode: "4500",
            accountName: "Other Income",
            debit: 0,
            credit: amount,
          });
        } else {
          lines.push({
            accountCode: "5820",
            accountName: "Office Supplies",
            debit: amount,
            credit: 0,
          });
          lines.push({
            accountCode: cashAccount,
            accountName: cashAccountName,
            debit: 0,
            credit: amount,
          });
        }
      }
    }

    const validation = validateJournalEntry(lines);

    return {
      id: generateJournalId(),
      date: rawTx.date || new Date().toISOString().split("T")[0],
      narration: rawTx.description,
      reference: rawTx.id,
      lines,
      isBalanced: validation.isBalanced,
      totalDebits: validation.totalDebits,
      totalCredits: validation.totalCredits,
      transactionType,
      createdAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
      status: "posted",
    };
  }

  private mapCategoryToExpenseAccount(category: string): string {
    const categoryMap: Record<string, string> = {
      salary: "5500",
      salaries: "5500",
      wages: "5500",
      rent: "5600",
      utilities: "5610",
      telephone: "5620",
      internet: "5620",
      insurance: "5800",
      repairs: "5810",
      maintenance: "5810",
      office: "5820",
      supplies: "5820",
      professional: "5900",
      audit: "5910",
      legal: "5920",
      advertising: "6000",
      marketing: "6000",
      travel: "6010",
      entertainment: "6010",
      training: "6020",
      bank: "6030",
      transport: "6070",
    };
    return categoryMap[category.toLowerCase()] || "5820";
  }

  /**
   * Post a journal entry to the general ledger
   */
  private postToLedger(journalEntry: JournalEntry) {
    journalEntry.lines.forEach((line) => {
      const ledgerAccount = this.state.ledgerAccounts.get(line.accountCode);
      if (!ledgerAccount) return;

      const previousBalance = ledgerAccount.closingBalance;
      const isDebitNormal = ledgerAccount.normalBalance === "debit";

      // Calculate new balance
      let newBalance: number;
      if (isDebitNormal) {
        newBalance = previousBalance + line.debit - line.credit;
      } else {
        newBalance = previousBalance + line.credit - line.debit;
      }

      ledgerAccount.entries.push({
        date: journalEntry.date,
        journalId: journalEntry.id,
        narration: journalEntry.narration,
        debit: line.debit,
        credit: line.credit,
        balance: newBalance,
        reference: journalEntry.reference,
      });

      ledgerAccount.closingBalance = newBalance;
    });
  }

  /**
   * Generate a chat-friendly response for a journal entry
   */
  private generateChatResponse(
    journalEntry: JournalEntry,
    interpretation: TransactionInterpretation
  ): string {
    const { transactionType, amount, assumptions } = interpretation;
    const formattedAmount = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);

    let response = `📝 **Journal Entry Created** (${journalEntry.id})\n\n`;
    response += `**${journalEntry.narration}** - ${formattedAmount}\n\n`;
    response += `| Account | Debit | Credit |\n|---------|-------|--------|\n`;

    journalEntry.lines.forEach((line) => {
      const debit = line.debit > 0 ? `₦${line.debit.toLocaleString()}` : "-";
      const credit = line.credit > 0 ? `₦${line.credit.toLocaleString()}` : "-";
      response += `| ${line.accountName} | ${debit} | ${credit} |\n`;
    });

    if (assumptions.length > 0) {
      response += `\n**Assumptions Made:**\n`;
      assumptions.forEach((a) => (response += `• ${a}\n`));
    }

    response += `\n✅ Entry balanced and posted to ledger.`;

    return response;
  }

  /**
   * Generate Trial Balance
   */
  generateTrialBalance(): { accounts: Array<{ code: string; name: string; debit: number; credit: number }>; totals: { debit: number; credit: number } } {
    const accounts: Array<{ code: string; name: string; debit: number; credit: number }> = [];
    let totalDebit = 0;
    let totalCredit = 0;

    this.state.ledgerAccounts.forEach((account) => {
      if (account.closingBalance === 0 && account.entries.length === 0) return;

      const isDebitNormal = account.normalBalance === "debit";
      const debit = isDebitNormal && account.closingBalance > 0 ? account.closingBalance : 0;
      const credit = !isDebitNormal && account.closingBalance > 0 ? account.closingBalance : 0;

      if (debit > 0 || credit > 0) {
        accounts.push({
          code: account.accountCode,
          name: account.accountName,
          debit,
          credit,
        });
        totalDebit += debit;
        totalCredit += credit;
      }
    });

    return {
      accounts: accounts.sort((a, b) => a.code.localeCompare(b.code)),
      totals: { debit: totalDebit, credit: totalCredit },
    };
  }

  /**
   * Generate Financial Statements
   */
  generateStatements(): StatementDraft {
    let revenue = 0;
    let costOfSales = 0;
    let operatingExpenses = 0;
    let assets = 0;
    let liabilities = 0;
    let equity = 0;

    this.state.ledgerAccounts.forEach((account) => {
      const balance = account.closingBalance;
      if (balance === 0) return;

      switch (account.accountType) {
        case "income":
          revenue += balance;
          break;
        case "expense":
          if (account.accountCode.startsWith("50")) {
            costOfSales += balance;
          } else {
            operatingExpenses += balance;
          }
          break;
        case "asset":
          assets += balance;
          break;
        case "liability":
          liabilities += balance;
          break;
        case "equity":
          equity += balance;
          break;
      }
    });

    const grossProfit = revenue - costOfSales;
    const netIncome = grossProfit - operatingExpenses;

    return {
      revenue,
      costOfSales,
      grossProfit,
      operatingExpenses,
      operatingIncome: grossProfit - operatingExpenses,
      otherIncome: 0,
      netIncome,
      assets,
      liabilities,
      equity: equity + netIncome,
      cashFromOperations: netIncome,
      cashFromInvesting: 0,
      cashFromFinancing: 0,
      items: [],
      period: {
        start: new Date(new Date().getFullYear(), 0, 1).toISOString(),
        end: new Date().toISOString(),
      },
      analysisSource: "rule" as const,
      analysisConfidence: 1.0,
    };
  }

  /**
   * Get workspace file data for display
   */
  getWorkspaceData(): {
    journalCount: number;
    accounts: number;
    trialBalance: { accounts: Array<{ code: string; name: string; debit: number; credit: number }>; totals: { debit: number; credit: number } };
    statements: StatementDraft;
  } {
    return {
      journalCount: this.state.journalEntries.length,
      accounts: this.state.ledgerAccounts.size,
      trialBalance: this.generateTrialBalance(),
      statements: this.generateStatements(),
    };
  }

  /**
   * Clear all data
   */
  reset() {
    this.state = {
      journalEntries: [],
      ledgerAccounts: new Map(),
      lastUpdated: new Date().toISOString(),
    };
    this.initializeLedger();
    this.notify();
  }

  /**
   * Create year-end closing entries
   * Close all income and expense accounts to Retained Earnings
   */
  createClosingEntries(): JournalEntry[] {
    const closingEntries: JournalEntry[] = [];
    const lines: JournalLine[] = [];
    let totalIncome = 0;
    let totalExpenses = 0;

    // Close income accounts (debit income, credit income summary/retained earnings)
    this.state.ledgerAccounts.forEach((account) => {
      if (account.accountType === "income" && account.closingBalance > 0) {
        totalIncome += account.closingBalance;
        lines.push({
          accountCode: account.accountCode,
          accountName: account.accountName,
          debit: account.closingBalance,
          credit: 0,
          memo: "Closing entry - income",
        });
      }
    });

    // Close expense accounts (credit expense, debit income summary/retained earnings)
    this.state.ledgerAccounts.forEach((account) => {
      if (account.accountType === "expense" && account.closingBalance > 0) {
        totalExpenses += account.closingBalance;
        lines.push({
          accountCode: account.accountCode,
          accountName: account.accountName,
          debit: 0,
          credit: account.closingBalance,
          memo: "Closing entry - expense",
        });
      }
    });

    // Net income to Retained Earnings
    const netIncome = totalIncome - totalExpenses;
    if (netIncome !== 0) {
      lines.push({
        accountCode: "3100",
        accountName: "Retained Earnings",
        debit: netIncome < 0 ? Math.abs(netIncome) : 0,
        credit: netIncome > 0 ? netIncome : 0,
        memo: `Net ${netIncome > 0 ? "income" : "loss"} for the period`,
      });
    }

    if (lines.length > 0) {
      const closingEntry: JournalEntry = {
        id: generateJournalId(),
        date: new Date().toISOString().split("T")[0],
        narration: "Year-end closing entries",
        lines,
        isBalanced: true,
        totalDebits: totalIncome + (netIncome < 0 ? Math.abs(netIncome) : 0),
        totalCredits: totalExpenses + (netIncome > 0 ? netIncome : 0),
        transactionType: "closing",
        createdAt: new Date().toISOString(),
        postedAt: new Date().toISOString(),
        status: "posted",
      };

      this.postToLedger(closingEntry);
      this.state.journalEntries.push(closingEntry);
      closingEntries.push(closingEntry);
      this.notify();
    }

    return closingEntries;
  }

  /**
   * Record monthly depreciation for all fixed assets
   */
  recordDepreciation(assetType: string, amount: number): JournalEntry {
    const assetAccounts: Record<string, { asset: string; accDep: string; name: string }> = {
      buildings: { asset: "1510", accDep: "1511", name: "Buildings" },
      plant: { asset: "1520", accDep: "1521", name: "Plant and Machinery" },
      vehicles: { asset: "1530", accDep: "1531", name: "Motor Vehicles" },
      equipment: { asset: "1540", accDep: "1541", name: "Office Equipment" },
      furniture: { asset: "1550", accDep: "1551", name: "Furniture and Fittings" },
      computers: { asset: "1560", accDep: "1561", name: "Computer Equipment" },
    };

    const config = assetAccounts[assetType.toLowerCase()] || assetAccounts.equipment;

    const lines: JournalLine[] = [
      {
        accountCode: "5700",
        accountName: "Depreciation Expense",
        debit: amount,
        credit: 0,
      },
      {
        accountCode: config.accDep,
        accountName: `Accumulated Depreciation - ${config.name}`,
        debit: 0,
        credit: amount,
      },
    ];

    const entry: JournalEntry = {
      id: generateJournalId(),
      date: new Date().toISOString().split("T")[0],
      narration: `Monthly depreciation - ${config.name}`,
      lines,
      isBalanced: true,
      totalDebits: amount,
      totalCredits: amount,
      transactionType: "depreciation",
      createdAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
      status: "posted",
    };

    this.postToLedger(entry);
    this.state.journalEntries.push(entry);
    this.notify();

    return entry;
  }

  /**
   * Create an adjustment entry (for corrections, accruals, prepayments)
   */
  createAdjustmentEntry(
    description: string,
    entries: Array<{ accountCode: string; accountName: string; debit: number; credit: number }>
  ): JournalEntry {
    const lines: JournalLine[] = entries.map((e) => ({
      ...e,
      memo: "Adjustment entry",
    }));

    const validation = validateJournalEntry(lines);

    const entry: JournalEntry = {
      id: generateJournalId(),
      date: new Date().toISOString().split("T")[0],
      narration: description,
      lines,
      isBalanced: validation.isBalanced,
      totalDebits: validation.totalDebits,
      totalCredits: validation.totalCredits,
      transactionType: "adjustment",
      createdAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
      status: "posted",
    };

    if (validation.isBalanced) {
      this.postToLedger(entry);
      this.state.journalEntries.push(entry);
      this.notify();
    }

    return entry;
  }

  /**
   * Get account balance by code
   */
  getAccountBalance(accountCode: string): number {
    const account = this.state.ledgerAccounts.get(accountCode);
    return account?.closingBalance || 0;
  }

  /**
   * Get all journal entries for a specific account
   */
  getAccountHistory(accountCode: string): LedgerEntry[] {
    const account = this.state.ledgerAccounts.get(accountCode);
    return account?.entries || [];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const accountingEngine = new AccountingEngine();

// ============================================================================
// HELPER HOOKS & FUNCTIONS
// ============================================================================

/**
 * Parse a chat message to extract transaction details
 */
export function parseTransactionFromChat(message: string): Partial<TransactionInput> | null {
  const amountMatch = message.match(/₦?\s*([\d,]+(?:\.\d{2})?)/);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  
  // Detect keywords
  const lowerMessage = message.toLowerCase();
  let category = "other";
  let paymentMethod: PaymentMethod = "bank";

  if (lowerMessage.includes("sale") || lowerMessage.includes("sold")) {
    category = "sales";
  } else if (lowerMessage.includes("purchase") || lowerMessage.includes("bought")) {
    category = "purchases";
  } else if (lowerMessage.includes("rent")) {
    category = "rent";
  } else if (lowerMessage.includes("salary") || lowerMessage.includes("payroll")) {
    category = "salary";
  } else if (lowerMessage.includes("expense")) {
    category = "expense";
  }

  if (lowerMessage.includes("cash")) {
    paymentMethod = "cash";
  } else if (lowerMessage.includes("transfer")) {
    paymentMethod = "transfer";
  } else if (lowerMessage.includes("pos") || lowerMessage.includes("card")) {
    paymentMethod = "pos";
  }

  return {
    description: message.substring(0, 100),
    amount,
    category,
    paymentMethod,
  };
}

/**
 * Convert workspace data to dashboard metrics
 */
export function calculateDashboardMetrics(statements: StatementDraft): {
  revenue: number;
  expenses: number;
  netIncome: number;
  profitMargin: number;
  currentRatio: number;
} {
  return {
    revenue: statements.revenue,
    expenses: statements.costOfSales + statements.operatingExpenses,
    netIncome: statements.netIncome,
    profitMargin: statements.revenue > 0 ? (statements.netIncome / statements.revenue) * 100 : 0,
    currentRatio: statements.liabilities > 0 ? statements.assets / statements.liabilities : 0,
  };
}
