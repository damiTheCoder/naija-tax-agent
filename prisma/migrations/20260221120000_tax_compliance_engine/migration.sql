-- Tax Compliance Engine tables
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'BUSINESS',
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "type" TEXT NOT NULL DEFAULT 'general',
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "metadata" JSON,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Transaction_entityId_date_idx" ON "Transaction" ("entityId", "date");

CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "customerId" TEXT,
    "invoiceNo" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "taxTotal" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Invoice_entityId_date_idx" ON "Invoice" ("entityId", "date");
CREATE INDEX "Invoice_invoiceNo_idx" ON "Invoice" ("invoiceNo");

CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "metadata" JSON,
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Bill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "vendorId" TEXT,
    "billNo" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "taxTotal" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Bill_entityId_date_idx" ON "Bill" ("entityId", "date");
CREATE INDEX "Bill_billNo_idx" ON "Bill" ("billNo");

CREATE TABLE "BillLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "metadata" JSON,
    FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "billId" TEXT,
    "date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'bank_transfer',
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "metadata" JSON,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Payment_entityId_date_idx" ON "Payment" ("entityId", "date");

CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'corporate',
    "taxId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Vendor_entityId_name_idx" ON "Vendor" ("entityId", "name");

CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Customer_entityId_name_idx" ON "Customer" ("entityId", "name");

CREATE TABLE "ChartOfAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'expense',
    "category" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ChartOfAccount_entityId_code_key" ON "ChartOfAccount" ("entityId", "code");

CREATE TABLE "TaxRuleSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL DEFAULT 'internal',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaxRuleSet_entityId_version_idx" ON "TaxRuleSet" ("entityId", "version");

CREATE TABLE "TaxCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaxCategory_entityId_taxType_idx" ON "TaxCategory" ("entityId", "taxType");

CREATE TABLE "TaxRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "categoryId" TEXT,
    "taxType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" REAL NOT NULL DEFAULT 0,
    "rateType" TEXT NOT NULL DEFAULT 'percentage',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSON,
    "isActive" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("ruleSetId") REFERENCES "TaxRuleSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("categoryId") REFERENCES "TaxCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "TaxRule_ruleSetId_taxType_idx" ON "TaxRule" ("ruleSetId", "taxType");

CREATE TABLE "TaxClassification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "categoryId" TEXT,
    "ruleId" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0.6,
    "status" TEXT NOT NULL DEFAULT 'auto',
    "reason" TEXT,
    "metadata" JSON,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("categoryId") REFERENCES "TaxCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("ruleId") REFERENCES "TaxRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "TaxClassification_entityId_taxType_idx" ON "TaxClassification" ("entityId", "taxType");
CREATE INDEX "TaxClassification_transactionId_taxType_idx" ON "TaxClassification" ("transactionId", "taxType");

CREATE TABLE "TaxLedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "transactionId" TEXT,
    "taxType" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "ruleId" TEXT,
    "categoryId" TEXT,
    "periodId" TEXT,
    "baseAmount" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "direction" TEXT NOT NULL DEFAULT 'payable',
    "ledger" TEXT NOT NULL DEFAULT 'output',
    "metadata" JSON,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("ruleSetId") REFERENCES "TaxRuleSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("ruleId") REFERENCES "TaxRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("categoryId") REFERENCES "TaxCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("periodId") REFERENCES "TaxPeriod" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "TaxLedgerEntry_entityId_taxType_idx" ON "TaxLedgerEntry" ("entityId", "taxType");
CREATE INDEX "TaxLedgerEntry_periodId_taxType_idx" ON "TaxLedgerEntry" ("periodId", "taxType");

CREATE TABLE "TaxPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaxPeriod_entityId_period_idx" ON "TaxPeriod" ("entityId", "period");

CREATE TABLE "TaxSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalBase" REAL NOT NULL DEFAULT 0,
    "totalTax" REAL NOT NULL DEFAULT 0,
    "carryForward" REAL NOT NULL DEFAULT 0,
    "metadata" JSON,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("periodId") REFERENCES "TaxPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("ruleSetId") REFERENCES "TaxRuleSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaxSchedule_entityId_taxType_idx" ON "TaxSchedule" ("entityId", "taxType");

CREATE TABLE "ComplianceDeadline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("periodId") REFERENCES "TaxPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ComplianceDeadline_entityId_taxType_idx" ON "ComplianceDeadline" ("entityId", "taxType");

CREATE TABLE "ComplianceStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'draft',
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("periodId") REFERENCES "TaxPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ComplianceStatus_entityId_taxType_idx" ON "ComplianceStatus" ("entityId", "taxType");

CREATE TABLE "TaxFilingPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'pdf',
    "fileUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "metadata" JSON,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("periodId") REFERENCES "TaxPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaxFilingPackage_entityId_taxType_idx" ON "TaxFilingPackage" ("entityId", "taxType");

CREATE TABLE "TaxPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "paidAt" DATETIME,
    "method" TEXT NOT NULL DEFAULT 'bank_transfer',
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSON,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("periodId") REFERENCES "TaxPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaxPayment_entityId_taxType_idx" ON "TaxPayment" ("entityId", "taxType");

CREATE TABLE "TaxReconciliation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "summary" JSON,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("periodId") REFERENCES "TaxPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaxReconciliation_entityId_taxType_idx" ON "TaxReconciliation" ("entityId", "taxType");

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSON,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AuditLog_entityId_action_idx" ON "AuditLog" ("entityId", "action");
