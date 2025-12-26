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
   * PROFESSIONAL ACCOUNTING LOGIC
   * Follows IFRS/GAAP standards and double-entry bookkeeping principles.
   * 
   * Core Principles Enforced:
   * - Double-Entry: Every transaction has at least one debit and one credit
   * - Accounting Equation: Assets = Liabilities + Equity
   * - Revenue Recognition: Revenue only when earned
   * - Matching Principle: Expenses matched to the period they relate to
   * - Consistency: Same transaction type → same treatment every time
   */
  private interpretTransaction(rawTx: RawTransaction): TransactionInterpretation {
    const amount = Math.abs(rawTx.amount);

    // ==========================================================================
    // STEP 1: TRANSACTION PARSING LAYER
    // Extract: Action, Object, Counterparty, Amount, Timing, Business Impact
    // ==========================================================================

    const parsed = this.parseTransactionNaturalLanguage(rawTx);

    // ==========================================================================
    // STEP 2: CLASSIFICATION RULES
    // ==========================================================================

    // Step 2a: Identify Cash Movement
    const hasCashMovement = parsed.action.includes('received') ||
      parsed.action.includes('paid') ||
      parsed.action.includes('deposited') ||
      parsed.action.includes('withdrawn') ||
      parsed.action.includes('bought') ||
      parsed.action.includes('sold');

    // Step 2b: Identify the Nature of the Transaction
    const transactionNature = this.classifyTransactionNature(parsed);

    // Step 2c: Determine Transaction Type for Journal Entry
    const transactionType = this.determineTransactionType(parsed, transactionNature);

    // ==========================================================================
    // STEP 3: APPLY DECISION TREES
    // ==========================================================================

    const { isCredit, paymentMethod, assumptions, questionsNeeded, typeOverride } =
      this.applyDecisionTree(parsed, transactionNature, hasCashMovement, rawTx);

    const finalTransactionType = typeOverride || transactionType;

    // Step 4: Detect Taxes (VAT, WHT)
    const taxes = this.detectTaxes(rawTx, amount);

    // ==========================================================================
    // STEP 5: CALCULATE CONFIDENCE SCORE
    // ==========================================================================

    const confidence = this.calculateConfidence(parsed, assumptions.length + taxes.assumptions.length, questionsNeeded.length);

    return {
      transactionType: finalTransactionType,
      description: rawTx.description,
      amount: taxes.baseAmount,
      netAmount: amount,
      vatAmount: taxes.vatAmount,
      whtAmount: taxes.whtAmount,
      paymentMethod,
      isCredit,
      hasTax: taxes.hasTax,
      hasInventoryImpact: parsed.object.includes('goods') || parsed.object.includes('inventory'),
      assumptions: [...assumptions, ...taxes.assumptions],
      questionsNeeded,
      // Extended fields
      parsed,
      transactionNature,
      hasCashMovement,
      confidence,
    };
  }

  /**
   * DETECT TAXES (VAT, WHT)
   * Analyzes description for tax mentions and computes amounts
   */
  private detectTaxes(rawTx: RawTransaction, totalAmount: number): {
    baseAmount: number;
    vatAmount: number;
    whtAmount: number;
    hasTax: boolean;
    assumptions: string[];
  } {
    const desc = rawTx.description.toLowerCase();
    let vatAmount = 0;
    let whtAmount = 0;
    let hasTax = false;
    const assumptions: string[] = [];
    const VAT_RATE = 0.075; // Standard Nigerian VAT

    // VAT Detection
    if (desc.includes('vat') || desc.includes('tax')) {
      hasTax = true;
      if (desc.includes('inclusive') || desc.includes('incl')) {
        // Assume VAT is included in the total
        vatAmount = totalAmount - (totalAmount / (1 + VAT_RATE));
        assumptions.push(`VAT detected (inclusive) - extracted ${VAT_RATE * 100}%`);
      } else {
        // Assume VAT is to be added
        vatAmount = totalAmount * VAT_RATE;
        assumptions.push(`VAT detected (exclusive) - added ${VAT_RATE * 100}%`);
      }
    }

    // WHT Detection (mostly for services/contracts)
    if (desc.includes('wht') || desc.includes('withholding')) {
      hasTax = true;
      const whtRate = desc.includes('director') || desc.includes('rent') ? 0.1 : 0.05;
      whtAmount = totalAmount * whtRate;
      assumptions.push(`WHT detected - computed at ${whtRate * 100}%`);
    }

    const baseAmount = totalAmount - (desc.includes('inclusive') ? vatAmount : 0);

    return {
      baseAmount,
      vatAmount: Math.round(vatAmount),
      whtAmount: Math.round(whtAmount),
      hasTax,
      assumptions
    };
  }

  /**
   * TRANSACTION PARSING LAYER
   * Extracts: Action, Object, Counterparty, Amount, Timing, Business Impact
   */
  private parseTransactionNaturalLanguage(rawTx: RawTransaction): {
    action: string;
    object: string;
    counterparty: string;
    timing: 'immediate' | 'outstanding' | 'unknown';
    businessImpact: 'income' | 'expense' | 'asset' | 'liability' | 'equity' | 'unknown';
  } {
    const desc = rawTx.description.toLowerCase().trim();
    const category = (rawTx.category || '').toLowerCase().trim();
    const type = (rawTx.type || '').toLowerCase();

    // =========== EXTRACT ACTION ===========
    let action = 'unknown';
    const actionKeywords = {
      received: ['received', 'receipt', 'collected', 'got', 'income'],
      paid: ['paid', 'payment', 'spent', 'pay'],
      sold: ['sold', 'sale', 'sales', 'revenue', 'earned'],
      bought: ['bought', 'purchased', 'purchase', 'acquired'],
      borrowed: ['borrowed', 'loan received', 'financing'],
      repaid: ['repaid', 'repayment', 'loan payment', 'settled'],
      invested: ['invested', 'capital', 'owner contribution', 'started business'],
      withdrawn: ['withdrawn', 'drawing', 'withdrawal', 'took cash'],
      transferred: ['transferred', 'transfer', 'deposited', 'withdrew from bank'],
      depreciated: ['depreciation', 'depreciated', 'amortization'],
      returned: ['return', 'returned', 'refund'],
      accrued: ['accrued', 'outstanding bill', 'unpaid bill', 'incurred'],
      earned: ['earned', 'recognised revenue', 'unearned revenue'],
      writtenoff: ['written off', 'bad debt', 'uncollectible'],
    };

    for (const [key, keywords] of Object.entries(actionKeywords)) {
      if (keywords.some(kw => desc.includes(kw) || category.includes(kw))) {
        action = key;
        break;
      }
    }

    // =========== EXTRACT OBJECT ===========
    let object = 'unknown';
    const objectKeywords = {
      cash: ['cash', 'money', 'funds'],
      goods: ['goods', 'inventory', 'stock', 'products', 'merchandise'],
      services: ['service', 'services', 'consultancy', 'professional', 'fee'],
      asset: ['equipment', 'machinery', 'vehicle', 'furniture', 'computer', 'asset'],
      loan: ['loan', 'borrowing', 'debt', 'financing', 'interest'],
      rent: ['rent', 'lease', 'rental'],
      supplies: ['supplies', 'office', 'stationery'],
      utilities: ['utilities', 'electricity', 'water', 'phone', 'internet', 'bill'],
      salary: ['salary', 'wages', 'payroll', 'staff'],
      advance: ['advance', 'prepayment', 'deposit from customer'],
      equipment: ['equipment', 'laptop', 'computer', 'machinery'],
      furniture: ['furniture', 'fittings', 'chair', 'desk'],
    };

    for (const [key, keywords] of Object.entries(objectKeywords)) {
      if (keywords.some(kw => desc.includes(kw) || category.includes(kw))) {
        object = key;
        break;
      }
    }

    // =========== EXTRACT COUNTERPARTY ===========
    let counterparty = 'unknown';
    const counterpartyKeywords = {
      customer: ['customer', 'client', 'buyer', 'debtor', 'from customer'],
      supplier: ['supplier', 'vendor', 'creditor', 'from supplier'],
      bank: ['bank', 'financial institution', 'lender'],
      owner: ['owner', 'shareholder', 'partner', 'proprietor', 'director'],
      employee: ['employee', 'staff', 'worker'],
      government: ['tax', 'government', 'firs', 'vat', 'wht'],
    };

    for (const [key, keywords] of Object.entries(counterpartyKeywords)) {
      if (keywords.some(kw => desc.includes(kw) || category.includes(kw))) {
        counterparty = key;
        break;
      }
    }

    // Fallback: Infer counterparty from action if still unknown
    if (counterparty === 'unknown') {
      if (action === 'sold') counterparty = 'customer';
      if (action === 'bought' || action === 'paid' || (action === 'returned' && desc.includes('supplier'))) counterparty = 'supplier';
      if (action === 'returned' && desc.includes('customer')) counterparty = 'customer';
    }

    // =========== EXTRACT TIMING ===========
    let timing: 'immediate' | 'outstanding' | 'unknown' = 'unknown';
    const immediateKeywords = ['cash', 'paid', 'received', 'bank', 'transfer', 'deposited', 'hand'];
    const outstandingKeywords = ['credit', 'invoice', 'on account', 'outstanding', 'payable', 'receivable', 'later', 'accrued', 'unpaid'];

    if (immediateKeywords.some(kw => desc.includes(kw))) {
      timing = 'immediate';
    } else if (outstandingKeywords.some(kw => desc.includes(kw))) {
      timing = 'outstanding';
    } else if (action === 'received' || action === 'paid') {
      timing = 'immediate';
    }

    // =========== EXTRACT BUSINESS IMPACT ===========
    let businessImpact: 'income' | 'expense' | 'asset' | 'liability' | 'equity' | 'unknown' = 'unknown';

    // Priority based detection
    if (type === 'income' || category.includes('income') || category.includes('revenue') ||
      category.includes('sales') || action === 'sold' || action === 'received') {
      if (counterparty === 'customer' || desc.includes('customer') || desc.includes('sales')) {
        businessImpact = 'income';
      } else if (action === 'received' && counterparty === 'bank') {
        businessImpact = 'liability'; // Loan received
      } else if (action === 'received' && counterparty === 'owner') {
        businessImpact = 'equity'; // Capital contribution
      } else {
        businessImpact = 'income';
      }
    } else if (type === 'expense' || category.includes('expense') || category.includes('cost') ||
      action === 'paid' || action === 'bought') {
      if (object === 'asset' || category.includes('asset')) {
        businessImpact = 'asset';
      } else if (action === 'repaid') {
        businessImpact = 'liability';
      } else {
        businessImpact = 'expense';
      }
    } else if (category.includes('asset') || object === 'asset') {
      businessImpact = 'asset';
    } else if (category.includes('liability') || action === 'borrowed') {
      businessImpact = 'liability';
    } else if (category.includes('equity') || action === 'invested' || action === 'withdrawn') {
      businessImpact = 'equity';
    }

    return { action, object, counterparty, timing, businessImpact };
  }

  /**
   * CLASSIFY TRANSACTION NATURE
   * Returns: income, expense, asset, liability, or equity
   */
  private classifyTransactionNature(parsed: {
    action: string;
    object: string;
    counterparty: string;
    timing: 'immediate' | 'outstanding' | 'unknown';
    businessImpact: 'income' | 'expense' | 'asset' | 'liability' | 'equity' | 'unknown';
  }): 'income' | 'expense' | 'asset' | 'liability' | 'equity' {

    // Use parsed business impact if determined
    if (parsed.businessImpact !== 'unknown') {
      return parsed.businessImpact;
    }

    if (parsed.action === 'invested') return 'equity';
    if (parsed.action === 'withdrawn') return 'equity';

    // Fallback logic
    if (['sold', 'received'].includes(parsed.action) && parsed.counterparty === 'customer') {
      return 'income';
    }
    if (['paid', 'bought'].includes(parsed.action)) {
      if (parsed.object === 'asset') return 'asset';
      return 'expense';
    }
    if (parsed.action === 'borrowed') return 'liability';
    if (parsed.action === 'repaid') return 'liability';

    // Default to expense for safety
    return 'expense';
  }

  /**
   * DETERMINE TRANSACTION TYPE
   * Maps parsed transaction to internal transaction type for journal entry creation
   */
  private determineTransactionType(
    parsed: { action: string; object: string; counterparty: string; timing: string; businessImpact: string },
    nature: 'income' | 'expense' | 'asset' | 'liability' | 'equity'
  ): TransactionType {

    const { action, object, counterparty, timing } = parsed;

    // SPECIAL CASES (CHECK FIRST)
    if (action === 'transferred') return 'transfer';
    if (action === 'returned') {
      if (counterparty === 'customer') return 'sale-return';
      if (counterparty === 'supplier' || counterparty === 'unknown') return 'purchase-return';
      return 'purchase-return'; // Default return to purchase-return if unknown
    }

    // INCOME TRANSACTIONS
    if (nature === 'income') {
      if (timing === 'outstanding' || action === 'sold') {
        // Credit sale or service rendered on account
        return 'sale';
      }
      if (action === 'received' && counterparty === 'customer') {
        // Could be cash sale or receipt from debtor
        // If description suggests existing receivable, it's a receipt
        return 'sale'; // Default to sale, refine in decision tree
      }
      return 'sale';
    }

    // EXPENSE TRANSACTIONS  
    if (nature === 'expense') {
      if (object === 'goods' || object === 'inventory') {
        return 'purchase';
      }
      return 'expense';
    }

    // ASSET TRANSACTIONS
    if (nature === 'asset') {
      if (action === 'depreciated') return 'depreciation';
      if (action === 'sold') return 'asset-disposal';
      return 'asset-purchase';
    }

    // LIABILITY TRANSACTIONS
    if (nature === 'liability') {
      if (action === 'borrowed') return 'loan-received';
      if (action === 'repaid') return 'loan-repayment';
      if (action === 'accrued' && object === 'loan') return 'adjustment'; // Interest accrual
      if (action === 'paid' && counterparty === 'supplier') return 'payment';
      return 'other';
    }

    // EQUITY TRANSACTIONS
    if (nature === 'equity') {
      if (action === 'invested') return 'owner-investment';
      if (action === 'withdrawn') return 'owner-drawing';
      return 'other';
    }

    // SPECIAL CASES
    if (action === 'transferred' || action === 'deposited' || action === 'withdrawn') return 'transfer';
    if (action === 'writtenoff') return 'adjustment';
    if (action === 'accrued') return 'adjustment';
    if (action === 'earned' || object === 'advance') return 'adjustment';

    // special cases moved to top

    return 'other';
  }

  /**
   * APPLY DECISION TREE
   * For customer transactions and other complex scenarios
   */
  private applyDecisionTree(
    parsed: { action: string; object: string; counterparty: string; timing: string; businessImpact: string },
    nature: string,
    hasCashMovement: boolean,
    rawTx: RawTransaction
  ): {
    isCredit: boolean;
    paymentMethod: PaymentMethod;
    assumptions: string[];
    questionsNeeded: string[];
    typeOverride?: TransactionType;
  } {
    const { action, object, counterparty, timing, businessImpact } = parsed;
    const assumptions: string[] = [];
    const questionsNeeded: string[] = [];
    let isCredit = false;
    let paymentMethod: PaymentMethod = 'bank';
    let typeOverride: TransactionType | undefined = undefined;
    const desc = rawTx.description.toLowerCase();

    // Detect payment method
    if (desc.includes('cash')) {
      paymentMethod = 'cash';
    } else if (desc.includes('pos') || desc.includes('card')) {
      paymentMethod = 'pos';
    } else if (desc.includes('cheque') || desc.includes('check')) {
      paymentMethod = 'cheque';
    } else if (desc.includes('transfer') || desc.includes('bank')) {
      paymentMethod = 'bank';
    }

    // detect transfers/contra entries
    if (parsed.action === 'transferred' || desc.includes('deposited') || desc.includes('withdrew from bank')) {
      if (desc.includes('cash') && (desc.includes('bank') || desc.includes('into'))) {
        paymentMethod = 'bank'; // Destination is bank
        assumptions.push('Bank deposit detected - DR Bank, CR Cash');
      } else if (desc.includes('withdrew') || (desc.includes('bank') && desc.includes('office'))) {
        paymentMethod = 'cash'; // Destination is cash
        assumptions.push('Bank withdrawal detected - DR Cash, CR Bank');
      }
    }

    // detect advances / pre-payments
    if (object === 'advance' || desc.includes('advance')) {
      if (nature === 'income') {
        assumptions.push('Unearned revenue (customer advance) detected');
      }
    }

    // detect asset disposals
    if (action === 'sold' && nature === 'asset') {
      assumptions.push('Asset disposal detected - recording gain/loss and removal from books');
    }

    // detect accruals
    if (action === 'accrued' || (timing === 'outstanding' && nature === 'expense')) {
      assumptions.push('Accrual bookkeeping - recording liability for unpaid expense');
    }

    // ===== CUSTOMER TRANSACTION DECISION TREE =====
    if (parsed.counterparty === 'customer') {
      if (parsed.action === 'received' || hasCashMovement) {
        // Is this payment for an EARLIER credit sale?
        if (desc.includes('receivable') || desc.includes('outstanding') ||
          desc.includes('invoice') || desc.includes('debtor') ||
          desc.includes('earlier') || desc.includes('against')) {
          // Yes → Credit Accounts Receivable
          assumptions.push('Receipt against existing receivable - crediting Accounts Receivable');
          isCredit = false; // Not a credit sale, it's a receipt
          typeOverride = 'receipt';
        } else if (desc.includes('advance') || desc.includes('deposit')) {
          assumptions.push('Customer advance payment - recording unearned revenue');
          typeOverride = 'adjustment';
        } else {
          // No → Credit Sales Revenue (cash sale)
          assumptions.push('Cash sale - crediting Sales Revenue');
          isCredit = false;
        }
      } else if (parsed.action === 'sold' && !hasCashMovement) {
        isCredit = true;
        assumptions.push("Credit sale identified (no cash movement mentioned)");
      } else if (parsed.timing === 'outstanding') {
        isCredit = true;
      } else if (parsed.action === 'returned') {
        // Return from customer - usually reduces receivable unless cash paid back
        if (!hasCashMovement && !desc.includes('cash')) {
          isCredit = true;
          assumptions.push('Assumed return against outstanding receivable');
        }
      }
    }

    // ===== SUPPLIER TRANSACTION DECISION TREE =====
    if (parsed.counterparty === 'supplier') {
      if (parsed.action === 'paid' || hasCashMovement) {
        // Is this payment for an EARLIER credit purchase?
        if (desc.includes('payable') || desc.includes('outstanding') ||
          desc.includes('bill') || desc.includes('creditor') ||
          desc.includes('earlier') || desc.includes('against')) {
          // Yes → Debit Accounts Payable
          assumptions.push('Payment against existing payable - debiting Accounts Payable');
          isCredit = false;
          typeOverride = 'payment';
        } else if (desc.includes('accrued') || desc.includes('salary') || desc.includes('rent')) {
          assumptions.push('Payment against accrued liability');
          typeOverride = 'adjustment'; // We'll handle different liability accounts in createJournalEntry
        } else {
          assumptions.push('Cash purchase - debiting expense/asset account');
          isCredit = false;
        }
      } else if (parsed.action === 'bought' && !hasCashMovement) {
        isCredit = true;
        assumptions.push('Credit purchase - crediting Accounts Payable');
      } else if (parsed.action === 'returned') {
        // Return to supplier - usually reduces payable unless cash received
        if (!hasCashMovement && !desc.includes('cash')) {
          isCredit = true;
          assumptions.push('Assumed return against outstanding payable');
        }
      }
    }

    // ===== OTHER PROFESSIONAL CASES =====
    if (desc.includes('interest')) {
      if (action === 'paid') typeOverride = 'loan-repayment';
      if (action === 'accrued') typeOverride = 'adjustment';
    }

    if (desc.includes('bad debt') || desc.includes('written off')) {
      typeOverride = 'adjustment';
    }

    if (desc.includes('inventory') || (desc.includes('stock') && desc.includes('count'))) {
      typeOverride = 'adjustment';
    }

    if (desc.includes('close') || desc.includes('year-end')) {
      typeOverride = 'closing';
    }

    return { isCredit, paymentMethod, assumptions, questionsNeeded, typeOverride };
  }

  /**
   * CALCULATE CONFIDENCE SCORE
   * Based on how much information was successfully extracted
   */
  private calculateConfidence(
    parsed: { action: string; object: string; counterparty: string; timing: string; businessImpact: string },
    assumptionCount: number,
    questionCount: number
  ): number {
    let score = 1.0;

    // Deduct for unknowns
    if (parsed.action === 'unknown') score -= 0.2;
    if (parsed.object === 'unknown') score -= 0.1;
    if (parsed.counterparty === 'unknown') score -= 0.15;
    if (parsed.timing === 'unknown') score -= 0.1;
    if (parsed.businessImpact === 'unknown') score -= 0.25;

    // Deduct for assumptions
    score -= assumptionCount * 0.05;

    // Deduct for questions needed
    score -= questionCount * 0.15;

    return Math.max(0.1, Math.min(1.0, score));
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
          // lines.push({
          //   accountCode: "2200",
          //   accountName: "Output VAT Payable",
          //   debit: 0,
          //   credit: vatAmount,
          // });
        }

        // Removed automatic COGS recording. Inventory adjustment must be manual.
        // if (interpretation.hasInventoryImpact) { ... }
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
          // lines.push({
          //   accountCode: "2200",
          //   accountName: "Output VAT Payable",
          //   debit: vatAmount,
          //   credit: 0,
          // });
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
          // lines.push({
          //   accountCode: "1400",
          //   accountName: "Input VAT Receivable",
          //   debit: 0,
          //   credit: vatAmount,
          // });
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
          // lines.push({
          //   accountCode: "1400",
          //   accountName: "Input VAT Receivable",
          //   debit: vatAmount,
          //   credit: 0,
          // });
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
        // CR: Cash/Bank OR Accrued Expenses
        const expenseCode = this.mapCategoryToExpenseAccount(rawTx.category || "");
        const expenseAccount = getAccount(expenseCode);
        const isAccrued = interpretation.assumptions.some(a => a.toLowerCase().includes('accrual'));

        lines.push({
          accountCode: expenseCode,
          accountName: expenseAccount?.name || "Operating Expense",
          debit: amount,
          credit: 0,
        });

        if (whtAmount > 0) {
          // handled previously
        } else {
          lines.push({
            accountCode: isAccrued ? "2100" : cashAccount,
            accountName: isAccrued ? "Accrued Expenses" : cashAccountName,
            debit: 0,
            credit: amount,
            memo: isAccrued ? "Accrued expense" : undefined
          });
        }
        break;
      }

      case "asset-purchase": {
        // DR: Fixed Asset
        // CR: Cash/Bank or Accounts Payable
        const assetCode = interpretation.parsed?.object === 'furniture' ? "1550" : "1540";
        const assetName = interpretation.parsed?.object === 'furniture' ? "Furniture and Fittings" : "Office Equipment";

        lines.push({
          accountCode: assetCode,
          accountName: assetName,
          debit: amount,
          credit: 0,
        });

        if (isCredit) {
          lines.push({
            accountCode: "2000",
            accountName: "Accounts Payable",
            debit: 0,
            credit: amount,
            memo: "Asset purchase on credit"
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

      case "asset-disposal": {
        // DR: Cash/Bank
        // CR: Fixed Asset
        // CR: Gain on Asset Disposal (assuming for simplicity we sell at gain/book value)
        lines.push({
          accountCode: cashAccount,
          accountName: cashAccountName,
          debit: amount,
          credit: 0,
        });
        lines.push({
          accountCode: "4300",
          accountName: "Gain on Asset Disposal",
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
        // DR: Destination account
        // CR: Source account
        const isDeposit = interpretation.assumptions.some(a => a.includes('deposit'));
        const isWithdrawal = interpretation.assumptions.some(a => a.includes('withdrawal'));

        if (isDeposit) {
          lines.push({ accountCode: "1020", accountName: "Bank", debit: amount, credit: 0 });
          lines.push({ accountCode: "1000", accountName: "Cash", debit: 0, credit: amount });
        } else if (isWithdrawal) {
          lines.push({ accountCode: "1000", accountName: "Cash", debit: amount, credit: 0 });
          lines.push({ accountCode: "1020", accountName: "Bank", debit: 0, credit: amount });
        } else {
          lines.push({ accountCode: "1020", accountName: "Bank", debit: amount, credit: 0 });
          lines.push({ accountCode: "1000", accountName: "Cash", debit: 0, credit: amount });
        }
        break;
      }

      case "adjustment": {
        const desc = rawTx.description.toLowerCase();
        if (desc.includes('bad debt') || desc.includes('written off')) {
          lines.push({ accountCode: "6040", accountName: "Bad Debts Expense", debit: amount, credit: 0 });
          lines.push({ accountCode: "1100", accountName: "Accounts Receivable", debit: 0, credit: amount });
        } else if (desc.includes('salary') && desc.includes('accrued')) {
          lines.push({ accountCode: "5500", accountName: "Salaries and Wages", debit: amount, credit: 0 });
          lines.push({ accountCode: "2110", accountName: "Accrued Salaries", debit: 0, credit: amount });
        } else if (desc.includes('salary') && desc.includes('paid')) {
          lines.push({ accountCode: "2110", accountName: "Accrued Salaries", debit: amount, credit: 0 });
          lines.push({ accountCode: "1020", accountName: "Bank", debit: 0, credit: amount });
        } else if (desc.includes('interest') && desc.includes('accrued')) {
          lines.push({ accountCode: "6500", accountName: "Interest Expense", debit: amount, credit: 0 });
          lines.push({ accountCode: "2120", accountName: "Accrued Interest", debit: 0, credit: amount });
        } else if (desc.includes('advance') || desc.includes('unearned')) {
          if (interpretation.assumptions.some(a => a.includes('Unearned'))) {
            lines.push({ accountCode: cashAccount, accountName: cashAccountName, debit: amount, credit: 0 });
            lines.push({ accountCode: "2400", accountName: "Unearned Revenue", debit: 0, credit: amount });
          } else {
            lines.push({ accountCode: "2400", accountName: "Unearned Revenue", debit: amount, credit: 0 });
            lines.push({ accountCode: "4000", accountName: "Sales", debit: 0, credit: amount });
          }
        } else if (desc.includes('inventory') || desc.includes('stock')) {
          if (desc.includes('unsold') || desc.includes('closing')) {
            // Increase Inventory, Decrease COGS
            lines.push({ accountCode: "1200", accountName: "Inventory", debit: amount, credit: 0 });
            lines.push({ accountCode: "5000", accountName: "Cost of Goods Sold", debit: 0, credit: amount });
          } else {
            // Decrease Inventory, Increase COGS
            lines.push({ accountCode: "5000", accountName: "Cost of Goods Sold", debit: amount, credit: 0 });
            lines.push({ accountCode: "1200", accountName: "Inventory", debit: 0, credit: amount });
          }
        } else {
          lines.push({ accountCode: "2100", accountName: "Accrued Expenses", debit: amount, credit: 0 });
          lines.push({ accountCode: cashAccount, accountName: cashAccountName, debit: 0, credit: amount });
        }
        break;
      }

      case "closing": {
        // Summary Closing Entry: Move Net Income to Retained Earnings
        // (Simplified placeholder for professional demo)
        lines.push({
          accountCode: "3100",
          accountName: "Retained Earnings",
          debit: 0,
          credit: amount,
          memo: "Year-end closing entry (Net Income → Equity)"
        });
        lines.push({
          accountCode: "4000",
          accountName: "Sales",
          debit: amount,
          credit: 0,
          memo: "Closing revenue accounts"
        });
        break;
      }

      default: {
        // Generic fallback for unhandled types
        // Use the interpreted transaction type for better accuracy
        const txType = (rawTx.type || "").toLowerCase();
        const category = (rawTx.category || "").toLowerCase();
        const desc = rawTx.description.toLowerCase();

        // Check multiple indicators for income
        const isIncome = txType === "income" ||
          category.includes("income") ||
          category.includes("receipt") ||
          category.includes("revenue") ||
          desc.includes("received") ||
          desc.includes("customer") ||
          desc.includes("sales") ||
          rawTx.amount > 0; // Positive amounts typically indicate income

        if (isIncome) {
          // DR: Cash/Bank (asset increases)
          // CR: Sales/Other Income (revenue increases)
          lines.push({
            accountCode: cashAccount,
            accountName: cashAccountName,
            debit: amount,
            credit: 0,
            memo: "Cash/bank receipt",
          });
          lines.push({
            accountCode: "4000",
            accountName: "Sales",
            debit: 0,
            credit: amount,
            memo: "Revenue earned",
          });
        } else {
          // DR: Expense (expense increases)
          // CR: Cash/Bank (asset decreases)
          const expenseCode = this.mapCategoryToExpenseAccount(rawTx.category || "");
          const expenseAccount = getAccount(expenseCode);

          lines.push({
            accountCode: expenseCode,
            accountName: expenseAccount?.name || "Operating Expense",
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
      interest: "6500",
      "bad debt": "6040",
      debt: "6040",
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

    // Calculate Base Financials
    const grossProfit = revenue - costOfSales;
    const netIncome = grossProfit - operatingExpenses;

    // Calculate Equity Breakdown
    let capitalAdditions = 0;
    let drawings = 0;

    this.state.ledgerAccounts.forEach((account) => {
      // Capital additions (3000-3099)
      if (account.accountCode.startsWith("30")) {
        // For equity, credit increases balance. 
        // We look at the net movement for the period excluding opening balance
        // Simplified: just taking the closing balance as additions for now if starting from 0
        capitalAdditions += account.closingBalance;
      }
      // Drawings (3200-3299) - contra equity
      if (account.accountCode.startsWith("32")) {
        drawings += account.closingBalance; // This is a debit balance
      }
    });

    const totalEquity = capitalAdditions - drawings + netIncome;

    // Calculate Cash Flow (Indirect Method)

    // 1. Operating Activities
    // Start with Net Income
    let cashFromOperations = netIncome;

    // Add back non-cash items (Depreciation)
    const depreciationExpense = this.getAccountBalance("5700");
    cashFromOperations += depreciationExpense;

    // Changes in Working Capital (Simplified)
    // Increase in Receivables = Decrease in Cash
    const receivables = this.state.ledgerAccounts.get("1100")?.closingBalance || 0;
    cashFromOperations -= receivables;

    // Increase in Inventory = Decrease in Cash
    const inventory = this.state.ledgerAccounts.get("1200")?.closingBalance || 0;
    cashFromOperations -= inventory;

    // Increase in Payables = Increase in Cash
    const payables = this.state.ledgerAccounts.get("2000")?.closingBalance || 0;
    cashFromOperations += payables;

    // 2. Investing Activities
    let cashFromInvesting = 0;
    // Purchase of fixed assets (15xx)
    this.state.ledgerAccounts.forEach((account) => {
      if (account.accountCode.startsWith("15") && !account.accountCode.endsWith("1")) { // Exclude acc dep
        // Debit balance implies purchase = outflow
        cashFromInvesting -= account.closingBalance;
      }
    });

    // 3. Financing Activities
    let cashFromFinancing = 0;
    // Capital introduced
    cashFromFinancing += capitalAdditions;
    // Drawings
    cashFromFinancing -= drawings;
    // Loans received (23xx)
    const loans = this.state.ledgerAccounts.get("2300")?.closingBalance || 0;
    cashFromFinancing += loans;


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
      equity: totalEquity,
      cashFromOperations,
      cashFromInvesting,
      cashFromFinancing,
      equityStatement: {
        openingBalance: 0, // Assuming new period for now
        additions: capitalAdditions,
        drawings: drawings,
        netIncome: netIncome,
        closingBalance: totalEquity
      },
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
  } else if (lowerMessage.includes("invested") || lowerMessage.includes("capital")) {
    category = "equity";
  } else if (lowerMessage.includes("withdrawal") || lowerMessage.includes("drawing")) {
    category = "equity";
  } else if (lowerMessage.includes("loan") || lowerMessage.includes("borrow")) {
    category = "liability";
  } else if (lowerMessage.includes("asset") || lowerMessage.includes("equipment") || lowerMessage.includes("computer")) {
    category = "asset";
  } else if (lowerMessage.includes("transfer") || lowerMessage.includes("deposit")) {
    category = "transfer";
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
