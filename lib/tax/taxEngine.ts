/**
 * Tax Engine Module
 * Connects chat interface with Nigerian tax computation logic
 * 
 * Flow: User Input/Upload → Parse → Identify Tax Type → Compute → Store → Report
 */

import { TaxInputs, TaxResult, UserProfile, TaxpayerType } from "../types";
import { calculateTaxForNigeria } from "../taxRules/ng";
import { calculateWHT, WHTInput, WHTResult, getAvailableWHTTypes } from "../taxRules/wht";
import { calculateCGT, CGTInput, CGTResult, calculateTotalCGT } from "../taxRules/cgt";
import { calculateStampDuty, StampDutyInput, StampDutyResult } from "../taxRules/stampDuty";
import { 
  calculatePoliceLevy, 
  calculateNASENILevy, 
  calculateTertiaryEducationTax,
  calculateNSITF,
  calculateITF,
  calculatePension,
  PoliceLevyResult,
  NASENILevyResult,
} from "../taxRules/levies";
import { getClientVATRate } from "../taxRules/liveRatesClient";

// ============================================================================
// TAX TRANSACTION TYPES
// ============================================================================

export type TaxTransactionType = 
  | "income"           // PIT/CIT applicable
  | "expense"          // Deductible
  | "sale"             // VAT applicable
  | "purchase"         // Input VAT
  | "service-payment"  // WHT applicable
  | "rent-payment"     // WHT applicable
  | "dividend"         // WHT applicable
  | "royalty"          // WHT applicable
  | "asset-disposal"   // CGT applicable
  | "contract-payment" // WHT applicable
  | "bank-transfer"    // Stamp duty applicable
  | "property-sale"    // CGT + Stamp duty
  | "share-transfer"   // CGT + Stamp duty
  | "other";

export interface TaxTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TaxTransactionType;
  category: string;
  counterparty?: string;
  isResident?: boolean;
  metadata?: Record<string, unknown>;
}

export interface TaxComputationResult {
  transactionId: string;
  transactionDescription: string;
  amount: number;
  taxesApplied: Array<{
    taxType: string;
    rate: number;
    taxAmount: number;
    note: string;
  }>;
  totalTax: number;
  netAmount: number;
}

export interface TaxScheduleEntry {
  id: string;
  taxType: "VAT" | "WHT" | "CIT" | "PIT" | "CGT" | "STAMP_DUTY" | "TET" | "POLICE_LEVY" | "NASENI" | "OTHER";
  period: string;  // e.g., "2025-Q1", "2025"
  grossAmount: number;
  taxAmount: number;
  dueDate: string;
  status: "pending" | "filed" | "paid";
  transactions: string[];  // Transaction IDs
}

// ============================================================================
// TAX ENGINE STATE
// ============================================================================

export interface TaxEngineState {
  profile: UserProfile;
  transactions: TaxTransaction[];
  computations: TaxComputationResult[];
  schedules: TaxScheduleEntry[];
  lastUpdated: string;
}

// ============================================================================
// TAX TYPE DETECTION
// ============================================================================

interface TaxTypeDetection {
  transactionType: TaxTransactionType;
  applicableTaxes: Array<{
    taxType: string;
    reason: string;
  }>;
  assumptions: string[];
  questionsNeeded: string[];
}

function detectTaxType(description: string, amount: number, category?: string): TaxTypeDetection {
  const desc = description.toLowerCase();
  const cat = (category || "").toLowerCase();
  
  const applicableTaxes: Array<{ taxType: string; reason: string }> = [];
  const assumptions: string[] = [];
  const questionsNeeded: string[] = [];
  let transactionType: TaxTransactionType = "other";

  // Sales/Revenue detection
  if (desc.includes("sale") || desc.includes("revenue") || desc.includes("invoice") || cat === "sales") {
    transactionType = "sale";
    applicableTaxes.push({ taxType: "VAT", reason: "Sale of goods/services" });
    assumptions.push("Applied 7.5% VAT on sale");
  }
  // Service payments (WHT applicable)
  else if (desc.includes("professional") || desc.includes("consultancy") || desc.includes("legal") || 
           desc.includes("accounting") || desc.includes("technical") || cat === "professional-fees") {
    transactionType = "service-payment";
    applicableTaxes.push({ taxType: "WHT", reason: "Professional/technical services - 10% WHT" });
    assumptions.push("Applied 10% WHT for professional services");
  }
  // Rent payments
  else if (desc.includes("rent") || cat === "rent") {
    transactionType = "rent-payment";
    applicableTaxes.push({ taxType: "WHT", reason: "Rent payment - 10% WHT" });
    assumptions.push("Applied 10% WHT on rent");
  }
  // Dividend payments
  else if (desc.includes("dividend")) {
    transactionType = "dividend";
    applicableTaxes.push({ taxType: "WHT", reason: "Dividend payment - 10% WHT" });
    assumptions.push("Applied 10% WHT on dividend");
  }
  // Royalty payments
  else if (desc.includes("royalty") || desc.includes("license fee")) {
    transactionType = "royalty";
    applicableTaxes.push({ taxType: "WHT", reason: "Royalty payment - 10% WHT" });
    assumptions.push("Applied 10% WHT on royalty");
  }
  // Contract payments
  else if (desc.includes("contract") || desc.includes("contractor")) {
    transactionType = "contract-payment";
    applicableTaxes.push({ taxType: "WHT", reason: "Contract payment - 5% WHT" });
    assumptions.push("Applied 5% WHT on contract");
  }
  // Asset disposal / Capital gains
  else if (desc.includes("sold") || desc.includes("disposal") || desc.includes("capital gain")) {
    transactionType = "asset-disposal";
    applicableTaxes.push({ taxType: "CGT", reason: "Asset disposal - 10% CGT" });
    assumptions.push("Applied 10% CGT on gain");
    questionsNeeded.push("What was the acquisition cost of the asset?");
  }
  // Property transactions
  else if (desc.includes("property") || desc.includes("land") || desc.includes("building")) {
    if (desc.includes("sold") || desc.includes("sale")) {
      transactionType = "property-sale";
      applicableTaxes.push({ taxType: "CGT", reason: "Property sale - 10% CGT" });
      applicableTaxes.push({ taxType: "STAMP_DUTY", reason: "Property deed - 1.5% Stamp Duty" });
    }
  }
  // Share transactions
  else if (desc.includes("share") || desc.includes("stock") || desc.includes("equity")) {
    if (desc.includes("sold") || desc.includes("transfer")) {
      transactionType = "share-transfer";
      applicableTaxes.push({ taxType: "CGT", reason: "Share disposal - 10% CGT" });
      applicableTaxes.push({ taxType: "STAMP_DUTY", reason: "Share transfer - 0.75% Stamp Duty" });
    }
  }
  // Bank transfers (stamp duty)
  else if (desc.includes("transfer") && (desc.includes("bank") || amount >= 10000)) {
    transactionType = "bank-transfer";
    if (amount >= 10000) {
      applicableTaxes.push({ taxType: "STAMP_DUTY", reason: "Electronic transfer ≥₦10,000 - ₦50 Stamp Duty" });
    }
  }
  // Purchases
  else if (desc.includes("purchase") || desc.includes("bought") || cat === "purchases") {
    transactionType = "purchase";
    applicableTaxes.push({ taxType: "VAT", reason: "Input VAT on purchase" });
    assumptions.push("Recording input VAT for offset");
  }
  // General expenses
  else if (cat === "expense" || desc.includes("expense") || amount < 0) {
    transactionType = "expense";
    assumptions.push("Recorded as deductible expense");
  }
  // General income
  else if (cat === "income" || amount > 0) {
    transactionType = "income";
    applicableTaxes.push({ taxType: "PIT/CIT", reason: "Taxable income" });
  }

  return {
    transactionType,
    applicableTaxes,
    assumptions,
    questionsNeeded,
  };
}

// ============================================================================
// TAX COMPUTATION
// ============================================================================

function computeTaxForTransaction(
  tx: TaxTransaction,
  profile: UserProfile
): TaxComputationResult {
  const taxesApplied: TaxComputationResult["taxesApplied"] = [];
  let totalTax = 0;
  const amount = Math.abs(tx.amount);

  switch (tx.type) {
    case "sale": {
      // VAT on sales
      const vatRate = getClientVATRate();
      const vatAmount = amount * vatRate;
      taxesApplied.push({
        taxType: "VAT",
        rate: vatRate,
        taxAmount: vatAmount,
        note: `Output VAT @ ${(vatRate * 100).toFixed(1)}%`,
      });
      totalTax += vatAmount;
      break;
    }

    case "service-payment":
    case "rent-payment":
    case "dividend":
    case "royalty":
    case "contract-payment": {
      // WHT on payments
      let whtRate = 0.10; // Default 10%
      let whtNote = "WHT @ 10%";
      
      if (tx.type === "contract-payment") {
        whtRate = 0.05;
        whtNote = "WHT on contracts @ 5%";
      } else if (tx.type === "dividend") {
        whtRate = 0.10;
        whtNote = "WHT on dividend @ 10%";
      } else if (tx.type === "rent-payment") {
        whtRate = 0.10;
        whtNote = "WHT on rent @ 10%";
      }

      const whtAmount = amount * whtRate;
      taxesApplied.push({
        taxType: "WHT",
        rate: whtRate,
        taxAmount: whtAmount,
        note: whtNote,
      });
      totalTax += whtAmount;
      break;
    }

    case "asset-disposal":
    case "property-sale":
    case "share-transfer": {
      // CGT on gains (assuming 100% gain for now - user should provide cost)
      const cgtRate = 0.10;
      const estimatedGain = amount * 0.3; // Assume 30% gain
      const cgtAmount = estimatedGain * cgtRate;
      taxesApplied.push({
        taxType: "CGT",
        rate: cgtRate,
        taxAmount: cgtAmount,
        note: `CGT @ 10% on estimated gain (₦${estimatedGain.toLocaleString()})`,
      });
      totalTax += cgtAmount;

      // Stamp duty for property/shares
      if (tx.type === "property-sale") {
        const stampDutyRate = 0.015;
        const stampDuty = amount * stampDutyRate;
        taxesApplied.push({
          taxType: "STAMP_DUTY",
          rate: stampDutyRate,
          taxAmount: stampDuty,
          note: "Stamp duty on property deed @ 1.5%",
        });
        totalTax += stampDuty;
      } else if (tx.type === "share-transfer") {
        const stampDutyRate = 0.0075;
        const stampDuty = amount * stampDutyRate;
        taxesApplied.push({
          taxType: "STAMP_DUTY",
          rate: stampDutyRate,
          taxAmount: stampDuty,
          note: "Stamp duty on share transfer @ 0.75%",
        });
        totalTax += stampDuty;
      }
      break;
    }

    case "bank-transfer": {
      // Flat stamp duty on electronic transfers >= N10,000
      if (amount >= 10000) {
        taxesApplied.push({
          taxType: "STAMP_DUTY",
          rate: 0,
          taxAmount: 50,
          note: "Electronic transfer stamp duty (flat ₦50)",
        });
        totalTax += 50;
      }
      break;
    }

    case "purchase": {
      // Input VAT (credit, not tax payable)
      const vatRate = getClientVATRate();
      const inputVat = amount * vatRate;
      taxesApplied.push({
        taxType: "INPUT_VAT",
        rate: vatRate,
        taxAmount: -inputVat, // Negative because it's a credit
        note: `Input VAT credit @ ${(vatRate * 100).toFixed(1)}%`,
      });
      totalTax -= inputVat; // Credit
      break;
    }

    default:
      // No specific tax treatment
      break;
  }

  return {
    transactionId: tx.id,
    transactionDescription: tx.description,
    amount,
    taxesApplied,
    totalTax: Math.max(0, totalTax),
    netAmount: amount - Math.max(0, totalTax),
  };
}

// ============================================================================
// TAX ENGINE CLASS
// ============================================================================

class TaxEngine {
  private state: TaxEngineState;
  private listeners: Set<(state: TaxEngineState) => void> = new Set();

  constructor() {
    this.state = {
      profile: {
        fullName: "",
        taxpayerType: "freelancer",
        taxYear: new Date().getFullYear(),
        stateOfResidence: "Lagos",
        isVATRegistered: false,
        currency: "NGN",
      },
      transactions: [],
      computations: [],
      schedules: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  // Subscribe to state changes
  subscribe(listener: (state: TaxEngineState) => void): () => void {
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
    window.localStorage.setItem("insight::tax-engine", JSON.stringify(this.state));
  }

  // Load from localStorage
  load() {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("insight::tax-engine");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.state = {
          ...this.state,
          ...parsed,
          profile: { ...this.state.profile, ...parsed.profile },
        };
      } catch {
        // Ignore malformed cache
      }
    }
  }

  getState(): TaxEngineState {
    return this.state;
  }

  // Update profile
  updateProfile(profile: Partial<UserProfile>) {
    this.state.profile = { ...this.state.profile, ...profile };
    this.notify();
  }

  // Process a transaction and compute applicable taxes
  processTransaction(tx: Omit<TaxTransaction, "id">): {
    transaction: TaxTransaction;
    computation: TaxComputationResult;
    detection: TaxTypeDetection;
    chatResponse: string;
  } {
    // Detect tax type if not provided
    const detection = detectTaxType(tx.description, tx.amount, tx.category);
    
    // Create transaction with ID
    const transaction: TaxTransaction = {
      ...tx,
      id: `TX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: tx.type || detection.transactionType,
    };

    // Compute taxes
    const computation = computeTaxForTransaction(transaction, this.state.profile);

    // Store
    this.state.transactions.push(transaction);
    this.state.computations.push(computation);
    this.updateSchedules(computation);
    this.notify();

    // Generate chat response
    const chatResponse = this.generateChatResponse(transaction, computation, detection);

    return { transaction, computation, detection, chatResponse };
  }

  // Update tax schedules based on computation
  private updateSchedules(computation: TaxComputationResult) {
    const currentYear = new Date().getFullYear();
    const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
    const period = `${currentYear}-${currentQuarter}`;

    for (const tax of computation.taxesApplied) {
      if (tax.taxAmount <= 0) continue; // Skip credits
      
      const taxType = tax.taxType as TaxScheduleEntry["taxType"];
      let schedule = this.state.schedules.find(
        s => s.taxType === taxType && s.period === period
      );

      if (!schedule) {
        schedule = {
          id: `SCH-${taxType}-${period}`,
          taxType,
          period,
          grossAmount: 0,
          taxAmount: 0,
          dueDate: this.getDueDate(taxType, period),
          status: "pending",
          transactions: [],
        };
        this.state.schedules.push(schedule);
      }

      schedule.grossAmount += computation.amount;
      schedule.taxAmount += tax.taxAmount;
      schedule.transactions.push(computation.transactionId);
    }
  }

  private getDueDate(taxType: string, period: string): string {
    const [year, quarter] = period.split("-");
    const q = parseInt(quarter.replace("Q", ""));
    
    // VAT due 21st of following month
    if (taxType === "VAT") {
      const month = q * 3;
      return `${year}-${String(month + 1).padStart(2, "0")}-21`;
    }
    // WHT due 21st of following month
    if (taxType === "WHT") {
      const month = q * 3;
      return `${year}-${String(month + 1).padStart(2, "0")}-21`;
    }
    // CIT/PIT due 6 months after year end
    if (taxType === "CIT" || taxType === "PIT") {
      return `${parseInt(year) + 1}-06-30`;
    }
    // CGT due 30 days after disposal
    if (taxType === "CGT") {
      const today = new Date();
      today.setDate(today.getDate() + 30);
      return today.toISOString().split("T")[0];
    }
    
    return `${year}-12-31`;
  }

  // Generate chat response
  private generateChatResponse(
    tx: TaxTransaction,
    computation: TaxComputationResult,
    detection: TaxTypeDetection
  ): string {
    const parts: string[] = [];
    
    parts.push(`📝 Recorded: **${tx.description}** for ₦${Math.abs(tx.amount).toLocaleString()}`);
    parts.push("");

    if (computation.taxesApplied.length > 0) {
      parts.push("**Taxes Applied:**");
      for (const tax of computation.taxesApplied) {
        const icon = tax.taxAmount < 0 ? "💚" : "🏷️";
        parts.push(`${icon} ${tax.note}: ₦${Math.abs(tax.taxAmount).toLocaleString()}`);
      }
      parts.push("");
      parts.push(`**Total Tax:** ₦${computation.totalTax.toLocaleString()}`);
      parts.push(`**Net Amount:** ₦${computation.netAmount.toLocaleString()}`);
    } else {
      parts.push("No immediate tax applies to this transaction.");
    }

    if (detection.assumptions.length > 0) {
      parts.push("");
      parts.push("*Assumptions:*");
      detection.assumptions.forEach(a => parts.push(`• ${a}`));
    }

    if (detection.questionsNeeded.length > 0) {
      parts.push("");
      parts.push("*Need more info:*");
      detection.questionsNeeded.forEach(q => parts.push(`❓ ${q}`));
    }

    return parts.join("\n");
  }

  // Get tax summary for dashboard
  getTaxSummary(): {
    totalVAT: number;
    totalWHT: number;
    totalCGT: number;
    totalStampDuty: number;
    totalOtherTaxes: number;
    grandTotal: number;
    inputVATCredit: number;
    netVATPayable: number;
  } {
    let totalVAT = 0;
    let totalWHT = 0;
    let totalCGT = 0;
    let totalStampDuty = 0;
    let totalOtherTaxes = 0;
    let inputVATCredit = 0;

    for (const comp of this.state.computations) {
      for (const tax of comp.taxesApplied) {
        switch (tax.taxType) {
          case "VAT":
            totalVAT += tax.taxAmount;
            break;
          case "INPUT_VAT":
            inputVATCredit += Math.abs(tax.taxAmount);
            break;
          case "WHT":
            totalWHT += tax.taxAmount;
            break;
          case "CGT":
            totalCGT += tax.taxAmount;
            break;
          case "STAMP_DUTY":
            totalStampDuty += tax.taxAmount;
            break;
          default:
            totalOtherTaxes += tax.taxAmount;
        }
      }
    }

    return {
      totalVAT,
      totalWHT,
      totalCGT,
      totalStampDuty,
      totalOtherTaxes,
      grandTotal: totalVAT + totalWHT + totalCGT + totalStampDuty + totalOtherTaxes,
      inputVATCredit,
      netVATPayable: totalVAT - inputVATCredit,
    };
  }

  // Get yearly tax report
  getYearlyReport(year: number): {
    year: number;
    transactions: TaxTransaction[];
    computations: TaxComputationResult[];
    schedules: TaxScheduleEntry[];
    summary: ReturnType<TaxEngine["getTaxSummary"]>;
  } {
    const transactions = this.state.transactions.filter(
      tx => new Date(tx.date).getFullYear() === year
    );
    const txIds = new Set(transactions.map(tx => tx.id));
    const computations = this.state.computations.filter(
      c => txIds.has(c.transactionId)
    );
    const schedules = this.state.schedules.filter(
      s => s.period.startsWith(String(year))
    );

    // Calculate summary for the year
    let totalVAT = 0, totalWHT = 0, totalCGT = 0, totalStampDuty = 0, totalOtherTaxes = 0, inputVATCredit = 0;
    
    for (const comp of computations) {
      for (const tax of comp.taxesApplied) {
        switch (tax.taxType) {
          case "VAT": totalVAT += tax.taxAmount; break;
          case "INPUT_VAT": inputVATCredit += Math.abs(tax.taxAmount); break;
          case "WHT": totalWHT += tax.taxAmount; break;
          case "CGT": totalCGT += tax.taxAmount; break;
          case "STAMP_DUTY": totalStampDuty += tax.taxAmount; break;
          default: totalOtherTaxes += tax.taxAmount;
        }
      }
    }

    return {
      year,
      transactions,
      computations,
      schedules,
      summary: {
        totalVAT,
        totalWHT,
        totalCGT,
        totalStampDuty,
        totalOtherTaxes,
        grandTotal: totalVAT + totalWHT + totalCGT + totalStampDuty + totalOtherTaxes,
        inputVATCredit,
        netVATPayable: totalVAT - inputVATCredit,
      },
    };
  }

  // Parse natural language transaction
  parseTransactionFromChat(message: string): Partial<TaxTransaction> | null {
    const lower = message.toLowerCase();
    
    // Common patterns
    const amountMatch = message.match(/₦?\s*([0-9,]+(?:\.[0-9]+)?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : 0;
    
    if (amount <= 0) return null;

    // Date detection
    let date = new Date().toISOString().split("T")[0];
    const dateMatch = message.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dateMatch) {
      const [, d, m, y] = dateMatch;
      const year = y.length === 2 ? `20${y}` : y;
      date = `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    // Detect transaction type
    const detection = detectTaxType(message, amount);

    return {
      date,
      description: message.slice(0, 100),
      amount,
      type: detection.transactionType,
      category: detection.transactionType,
    };
  }

  // Clear all data
  reset() {
    this.state = {
      profile: this.state.profile,
      transactions: [],
      computations: [],
      schedules: [],
      lastUpdated: new Date().toISOString(),
    };
    this.notify();
  }
}

// Export singleton instance
export const taxEngine = new TaxEngine();

// Export helper functions
export { detectTaxType, computeTaxForTransaction };
