import type {
  ComplianceTransaction,
  TaxClassification,
  TaxRuleSet,
  TaxType,
} from "./types";
import { loadClassifications, saveClassifications } from "./store";
import { recordAuditLog } from "./audit";

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const keywordMatch = (value: unknown, keywords: string[]) => {
  const text = typeof value === "string" ? value : "";
  if (!text) return false;
  return keywords.some((keyword) => text.includes(keyword));
};

const classifyVat = (tx: ComplianceTransaction): TaxClassification | null => {
  const desc = typeof tx.description === "string" ? tx.description.toLowerCase() : "";
  const type = typeof tx.type === "string" ? tx.type : "";
  const metadata = tx.metadata || {};
  if (metadata.vatExempt) {
    return {
      id: makeId("cls"),
      entityId: tx.entityId,
      transactionId: tx.id,
      taxType: "VAT",
      category: "exempt",
      confidence: 0.9,
      status: "auto",
      reason: "Marked VAT-exempt in metadata",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { source: "metadata" },
    };
  }

  if (metadata.vatZeroRated) {
    return {
      id: makeId("cls"),
      entityId: tx.entityId,
      transactionId: tx.id,
      taxType: "VAT",
      category: "zero",
      confidence: 0.9,
      status: "auto",
      reason: "Marked zero-rated in metadata",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { source: "metadata" },
    };
  }

  if (type.includes("sale") || keywordMatch(desc, ["sale", "invoice", "revenue", "service income"])) {
    return {
      id: makeId("cls"),
      entityId: tx.entityId,
      transactionId: tx.id,
      taxType: "VAT",
      category: "output",
      confidence: 0.75,
      status: "auto",
      reason: "Detected sale/revenue for output VAT",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  if (type.includes("purchase") || type.includes("expense") || keywordMatch(desc, ["purchase", "expense", "supplier", "vendor"])) {
    return {
      id: makeId("cls"),
      entityId: tx.entityId,
      transactionId: tx.id,
      taxType: "VAT",
      category: "input",
      confidence: 0.72,
      status: "auto",
      reason: "Detected purchase/expense for input VAT",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return null;
};

const classifyWhtCategory = (tx: ComplianceTransaction): string | null => {
  const desc = typeof tx.description === "string" ? tx.description.toLowerCase() : "";
  if (keywordMatch(desc, ["consult", "professional", "advisory", "audit", "legal"])) return "professional_services";
  if (keywordMatch(desc, ["rent", "lease"])) return "rent";
  if (keywordMatch(desc, ["contract", "construction", "project"])) return "contract";
  if (keywordMatch(desc, ["dividend"])) return "dividend";
  if (keywordMatch(desc, ["interest", "loan interest"])) return "interest";
  if (keywordMatch(desc, ["royalty", "license"])) return "royalty";
  return null;
};

const classifyWht = (tx: ComplianceTransaction): TaxClassification | null => {
  const category = classifyWhtCategory(tx);
  if (!category) return null;
  return {
    id: makeId("cls"),
    entityId: tx.entityId,
    transactionId: tx.id,
    taxType: "WHT",
    category,
    confidence: 0.74,
    status: "auto",
    reason: "Matched WHT category by description",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

const classifyCgt = (tx: ComplianceTransaction): TaxClassification | null => {
  const desc = typeof tx.description === "string" ? tx.description.toLowerCase() : "";
  if (tx.type.includes("asset") || keywordMatch(desc, ["asset disposal", "share sale", "property sale", "sale of asset"])) {
    return {
      id: makeId("cls"),
      entityId: tx.entityId,
      transactionId: tx.id,
      taxType: "CGT",
      category: "asset_disposal",
      confidence: 0.78,
      status: "auto",
      reason: "Detected asset disposal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  return null;
};

const classifyStamp = (tx: ComplianceTransaction): TaxClassification | null => {
  const desc = typeof tx.description === "string" ? tx.description.toLowerCase() : "";
  const docType = tx.documentType || (tx.metadata?.documentType as string | undefined);
  const inferred = docType || (keywordMatch(desc, ["agreement"]) ? "agreement" : keywordMatch(desc, ["deed"]) ? "deed" : keywordMatch(desc, ["mortgage"]) ? "mortgage" : null);
  if (!inferred) return null;
  return {
    id: makeId("cls"),
    entityId: tx.entityId,
    transactionId: tx.id,
    taxType: "STAMP",
    category: inferred,
    confidence: 0.7,
    status: "auto",
    reason: "Detected stamp duty document type",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: { documentType: inferred },
  };
};

const classifyCitAdjustments = (tx: ComplianceTransaction): TaxClassification | null => {
  const desc = tx.description.toLowerCase();
  if (keywordMatch(desc, ["entertainment", "penalty", "fine"])) {
    return {
      id: makeId("cls"),
      entityId: tx.entityId,
      transactionId: tx.id,
      taxType: "CIT",
      category: "disallowable",
      confidence: 0.8,
      status: "auto",
      reason: "Disallowable expense detected",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  if (keywordMatch(desc, ["capital allowance", "depreciation", "capital expenditure"])) {
    return {
      id: makeId("cls"),
      entityId: tx.entityId,
      transactionId: tx.id,
      taxType: "CIT",
      category: "capital_allowance",
      confidence: 0.7,
      status: "auto",
      reason: "Capital allowance adjustment detected",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  return null;
};

export function classifyTransactions(
  transactions: ComplianceTransaction[],
  ruleSet: TaxRuleSet,
  taxTypes?: TaxType[]
): TaxClassification[] {
  const resolvedTypes = taxTypes && taxTypes.length > 0 ? taxTypes : ["VAT", "WHT", "CIT", "CGT", "STAMP"];
  const results: TaxClassification[] = [];

  transactions.forEach((tx) => {
    if (resolvedTypes.includes("VAT")) {
      const vat = classifyVat(tx);
      if (vat) results.push(vat);
    }
    if (resolvedTypes.includes("WHT")) {
      const wht = classifyWht(tx);
      if (wht) results.push(wht);
    }
    if (resolvedTypes.includes("CGT")) {
      const cgt = classifyCgt(tx);
      if (cgt) results.push(cgt);
    }
    if (resolvedTypes.includes("STAMP")) {
      const stamp = classifyStamp(tx);
      if (stamp) results.push(stamp);
    }
    if (resolvedTypes.includes("CIT")) {
      const cit = classifyCitAdjustments(tx);
      if (cit) results.push(cit);
    }
  });

  return results.map((classification) => ({
    ...classification,
    metadata: {
      ...(classification.metadata || {}),
      ruleSetVersion: ruleSet.version,
    },
  }));
}

export function applyClassificationRules(
  entityId: string,
  transactions: ComplianceTransaction[],
  ruleSet: TaxRuleSet,
  taxTypes?: TaxType[]
): TaxClassification[] {
  const generated = classifyTransactions(transactions, ruleSet, taxTypes);
  const existing = loadClassifications().filter((item) => item.entityId !== entityId);
  saveClassifications([...generated, ...existing]);

  recordAuditLog({
    entityId,
    actor: "system",
    action: "classification.applied",
    resourceType: "tax_classification",
    metadata: {
      count: generated.length,
      ruleSetVersion: ruleSet.version,
    },
  });

  return generated;
}

export function applyManualClassification(
  entityId: string,
  classification: Omit<TaxClassification, "id" | "createdAt" | "updatedAt" | "status" | "confidence"> & {
    confidence?: number;
  }
): TaxClassification {
  const now = new Date().toISOString();
  const manual: TaxClassification = {
    id: makeId("cls"),
    entityId,
    transactionId: classification.transactionId,
    taxType: classification.taxType,
    category: classification.category,
    ruleId: classification.ruleId,
    confidence: classification.confidence ?? 0.95,
    status: "manual",
    reason: classification.reason,
    metadata: classification.metadata,
    createdAt: now,
    updatedAt: now,
  };

  const existing = loadClassifications();
  saveClassifications([manual, ...existing]);

  recordAuditLog({
    entityId,
    actor: "user",
    action: "classification.manual_override",
    resourceType: "tax_classification",
    resourceId: manual.id,
    metadata: {
      transactionId: manual.transactionId,
      taxType: manual.taxType,
      category: manual.category,
    },
  });

  return manual;
}
