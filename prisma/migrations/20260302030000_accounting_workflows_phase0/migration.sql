-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "tin" TEXT,
    "pensionPin" TEXT,
    "nhfNumber" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "basicSalary" REAL NOT NULL DEFAULT 0,
    "housingAllowance" REAL NOT NULL DEFAULT 0,
    "transportAllowance" REAL NOT NULL DEFAULT 0,
    "otherAllowances" REAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalGross" REAL NOT NULL DEFAULT 0,
    "totalNet" REAL NOT NULL DEFAULT 0,
    "totalTax" REAL NOT NULL DEFAULT 0,
    "totalPension" REAL NOT NULL DEFAULT 0,
    "totalNHF" REAL NOT NULL DEFAULT 0,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PayrollRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayrollEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "grossSalary" REAL NOT NULL,
    "netSalary" REAL NOT NULL,
    "taxAmount" REAL NOT NULL,
    "pensionAmount" REAL NOT NULL,
    "nhfAmount" REAL NOT NULL,
    "otherDeductions" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    CONSTRAINT "PayrollEntry_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayrollEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccountingJournal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "sourceDocType" TEXT,
    "sourceDocId" TEXT,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "narration" TEXT NOT NULL,
    "reference" TEXT,
    "baseCurrency" TEXT NOT NULL DEFAULT 'NGN',
    "sourceCurrency" TEXT NOT NULL DEFAULT 'NGN',
    "exchangeRate" REAL NOT NULL DEFAULT 1,
    "approvalStatus" TEXT NOT NULL DEFAULT 'approved',
    "approvalRequestId" TEXT,
    "trackingClassId" TEXT,
    "trackingLocationId" TEXT,
    "journalHash" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AccountingJournal_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountingJournal_trackingClassId_fkey" FOREIGN KEY ("trackingClassId") REFERENCES "TrackingClass" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AccountingJournal_trackingLocationId_fkey" FOREIGN KEY ("trackingLocationId") REFERENCES "TrackingLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccountingJournalLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journalId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "debit" REAL NOT NULL DEFAULT 0,
    "credit" REAL NOT NULL DEFAULT 0,
    "memo" TEXT,
    "sourceAmount" REAL,
    "baseAmount" REAL,
    "trackingClassId" TEXT,
    "trackingLocationId" TEXT,
    "metadata" TEXT,
    CONSTRAINT "AccountingJournalLine_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "AccountingJournal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountingJournalLine_trackingClassId_fkey" FOREIGN KEY ("trackingClassId") REFERENCES "TrackingClass" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AccountingJournalLine_trackingLocationId_fkey" FOREIGN KEY ("trackingLocationId") REFERENCES "TrackingLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "managerThreshold" REAL NOT NULL DEFAULT 500000,
    "ownerThreshold" REAL NOT NULL DEFAULT 500000,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApprovalPolicy_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requiredRole" TEXT NOT NULL DEFAULT 'manager',
    "requestedBy" TEXT NOT NULL DEFAULT 'system',
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedBy" TEXT,
    "decidedAt" DATETIME,
    "decisionNote" TEXT,
    "amount" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "journalId" TEXT,
    "billId" TEXT,
    "metadata" TEXT,
    CONSTRAINT "ApprovalRequest_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "AccountingJournal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PeriodLock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "lockedBy" TEXT NOT NULL,
    "lockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PeriodLock_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecurringTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'monthly',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "nextRunAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "payload" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecurringTemplate_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecurringRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "journalId" TEXT,
    "runAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL,
    "error" TEXT,
    "metadata" TEXT,
    CONSTRAINT "RecurringRun_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringRun_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RecurringTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringRun_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "AccountingJournal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExchangeRate_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackingClass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrackingClass_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackingLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrackingLocation_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccountingMigrationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "imported" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "conflicts" INTEGER NOT NULL DEFAULT 0,
    "report" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountingMigrationRun_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActionExecutionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "journalId" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "deepLink" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActionExecutionLog_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AuditLog" ("action", "actor", "createdAt", "entityId", "id", "metadata", "resourceId", "resourceType") SELECT "action", "actor", "createdAt", "entityId", "id", "metadata", "resourceId", "resourceType" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
CREATE INDEX "AuditLog_entityId_action_idx" ON "AuditLog"("entityId", "action");
CREATE TABLE "new_Bill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "vendorId" TEXT,
    "billNo" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvalStatus" TEXT NOT NULL DEFAULT 'draft',
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "approvedBy" TEXT,
    "rejectedAt" DATETIME,
    "rejectionReason" TEXT,
    "voidedAt" DATETIME,
    "voidReason" TEXT,
    "trackingClassId" TEXT,
    "trackingLocationId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "taxTotal" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Bill_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bill_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Bill_trackingClassId_fkey" FOREIGN KEY ("trackingClassId") REFERENCES "TrackingClass" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Bill_trackingLocationId_fkey" FOREIGN KEY ("trackingLocationId") REFERENCES "TrackingLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Bill" ("billNo", "createdAt", "currency", "date", "dueDate", "entityId", "id", "status", "subtotal", "taxTotal", "total", "updatedAt", "vendorId") SELECT "billNo", "createdAt", "currency", "date", "dueDate", "entityId", "id", "status", "subtotal", "taxTotal", "total", "updatedAt", "vendorId" FROM "Bill";
DROP TABLE "Bill";
ALTER TABLE "new_Bill" RENAME TO "Bill";
CREATE INDEX "Bill_entityId_date_idx" ON "Bill"("entityId", "date");
CREATE INDEX "Bill_billNo_idx" ON "Bill"("billNo");
CREATE TABLE "new_BillLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "trackingClassId" TEXT,
    "trackingLocationId" TEXT,
    "metadata" TEXT,
    CONSTRAINT "BillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BillLine_trackingClassId_fkey" FOREIGN KEY ("trackingClassId") REFERENCES "TrackingClass" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BillLine_trackingLocationId_fkey" FOREIGN KEY ("trackingLocationId") REFERENCES "TrackingLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BillLine" ("billId", "description", "id", "metadata", "quantity", "taxAmount", "taxRate", "total", "unitPrice") SELECT "billId", "description", "id", "metadata", "quantity", "taxAmount", "taxRate", "total", "unitPrice" FROM "BillLine";
DROP TABLE "BillLine";
ALTER TABLE "new_BillLine" RENAME TO "BillLine";
CREATE TABLE "new_ChartOfAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'expense',
    "category" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChartOfAccount_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ChartOfAccount" ("category", "code", "createdAt", "description", "entityId", "id", "name", "type") SELECT "category", "code", "createdAt", "description", "entityId", "id", "name", "type" FROM "ChartOfAccount";
DROP TABLE "ChartOfAccount";
ALTER TABLE "new_ChartOfAccount" RENAME TO "ChartOfAccount";
CREATE UNIQUE INDEX "ChartOfAccount_entityId_code_key" ON "ChartOfAccount"("entityId", "code");
CREATE TABLE "new_ComplianceDeadline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComplianceDeadline_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ComplianceDeadline_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TaxPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ComplianceDeadline" ("createdAt", "dueDate", "entityId", "id", "periodId", "status", "taxType") SELECT "createdAt", "dueDate", "entityId", "id", "periodId", "status", "taxType" FROM "ComplianceDeadline";
DROP TABLE "ComplianceDeadline";
ALTER TABLE "new_ComplianceDeadline" RENAME TO "ComplianceDeadline";
CREATE INDEX "ComplianceDeadline_entityId_taxType_idx" ON "ComplianceDeadline"("entityId", "taxType");
CREATE TABLE "new_ComplianceStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'draft',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ComplianceStatus_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ComplianceStatus_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TaxPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ComplianceStatus" ("entityId", "id", "periodId", "stage", "taxType", "updatedAt") SELECT "entityId", "id", "periodId", "stage", "taxType", "updatedAt" FROM "ComplianceStatus";
DROP TABLE "ComplianceStatus";
ALTER TABLE "new_ComplianceStatus" RENAME TO "ComplianceStatus";
CREATE INDEX "ComplianceStatus_entityId_taxType_idx" ON "ComplianceStatus"("entityId", "taxType");
CREATE TABLE "new_Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Customer_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Customer" ("address", "createdAt", "email", "entityId", "id", "name", "phone", "taxId") SELECT "address", "createdAt", "email", "entityId", "id", "name", "phone", "taxId" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE INDEX "Customer_entityId_name_idx" ON "Customer"("entityId", "name");
CREATE TABLE "new_Invoice" (
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
    CONSTRAINT "Invoice_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("createdAt", "currency", "customerId", "date", "dueDate", "entityId", "id", "invoiceNo", "status", "subtotal", "taxTotal", "total", "updatedAt") SELECT "createdAt", "currency", "customerId", "date", "dueDate", "entityId", "id", "invoiceNo", "status", "subtotal", "taxTotal", "total", "updatedAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_entityId_date_idx" ON "Invoice"("entityId", "date");
CREATE INDEX "Invoice_invoiceNo_idx" ON "Invoice"("invoiceNo");
CREATE TABLE "new_InvoiceLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "metadata" TEXT,
    CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceLine" ("description", "id", "invoiceId", "metadata", "quantity", "taxAmount", "taxRate", "total", "unitPrice") SELECT "description", "id", "invoiceId", "metadata", "quantity", "taxAmount", "taxRate", "total", "unitPrice" FROM "InvoiceLine";
DROP TABLE "InvoiceLine";
ALTER TABLE "new_InvoiceLine" RENAME TO "InvoiceLine";
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "billId" TEXT,
    "date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'bank_transfer',
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "billId", "createdAt", "date", "entityId", "id", "invoiceId", "metadata", "method", "reference", "status") SELECT "amount", "billId", "createdAt", "date", "entityId", "id", "invoiceId", "metadata", "method", "reference", "status" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE INDEX "Payment_entityId_date_idx" ON "Payment"("entityId", "date");
CREATE TABLE "new_TaxCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxCategory_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TaxCategory" ("createdAt", "description", "entityId", "id", "name", "taxType") SELECT "createdAt", "description", "entityId", "id", "name", "taxType" FROM "TaxCategory";
DROP TABLE "TaxCategory";
ALTER TABLE "new_TaxCategory" RENAME TO "TaxCategory";
CREATE INDEX "TaxCategory_entityId_taxType_idx" ON "TaxCategory"("entityId", "taxType");
CREATE TABLE "new_TaxClassification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "categoryId" TEXT,
    "ruleId" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0.6,
    "status" TEXT NOT NULL DEFAULT 'auto',
    "reason" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaxClassification_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaxClassification_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaxClassification_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TaxCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaxClassification_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TaxRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TaxClassification" ("categoryId", "confidence", "createdAt", "entityId", "id", "metadata", "reason", "ruleId", "status", "taxType", "transactionId", "updatedAt") SELECT "categoryId", "confidence", "createdAt", "entityId", "id", "metadata", "reason", "ruleId", "status", "taxType", "transactionId", "updatedAt" FROM "TaxClassification";
DROP TABLE "TaxClassification";
ALTER TABLE "new_TaxClassification" RENAME TO "TaxClassification";
CREATE INDEX "TaxClassification_entityId_taxType_idx" ON "TaxClassification"("entityId", "taxType");
CREATE INDEX "TaxClassification_transactionId_taxType_idx" ON "TaxClassification"("transactionId", "taxType");
CREATE TABLE "new_TaxFilingPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'pdf',
    "fileUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "metadata" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxFilingPackage_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaxFilingPackage_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TaxPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TaxFilingPackage" ("entityId", "fileUrl", "format", "generatedAt", "id", "metadata", "periodId", "status", "taxType") SELECT "entityId", "fileUrl", "format", "generatedAt", "id", "metadata", "periodId", "status", "taxType" FROM "TaxFilingPackage";
DROP TABLE "TaxFilingPackage";
ALTER TABLE "new_TaxFilingPackage" RENAME TO "TaxFilingPackage";
CREATE INDEX "TaxFilingPackage_entityId_taxType_idx" ON "TaxFilingPackage"("entityId", "taxType");
CREATE TABLE "new_TaxLedgerEntry" (
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
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxLedgerEntry_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaxLedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaxLedgerEntry_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "TaxRuleSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaxLedgerEntry_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TaxRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaxLedgerEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TaxCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaxLedgerEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TaxPeriod" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TaxLedgerEntry" ("baseAmount", "categoryId", "createdAt", "direction", "entityId", "id", "ledger", "metadata", "periodId", "ruleId", "ruleSetId", "taxAmount", "taxType", "transactionId") SELECT "baseAmount", "categoryId", "createdAt", "direction", "entityId", "id", "ledger", "metadata", "periodId", "ruleId", "ruleSetId", "taxAmount", "taxType", "transactionId" FROM "TaxLedgerEntry";
DROP TABLE "TaxLedgerEntry";
ALTER TABLE "new_TaxLedgerEntry" RENAME TO "TaxLedgerEntry";
CREATE INDEX "TaxLedgerEntry_entityId_taxType_idx" ON "TaxLedgerEntry"("entityId", "taxType");
CREATE INDEX "TaxLedgerEntry_periodId_taxType_idx" ON "TaxLedgerEntry"("periodId", "taxType");
CREATE TABLE "new_TaxPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "paidAt" DATETIME,
    "method" TEXT NOT NULL DEFAULT 'bank_transfer',
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxPayment_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaxPayment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TaxPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TaxPayment" ("amount", "createdAt", "entityId", "id", "metadata", "method", "paidAt", "periodId", "reference", "status", "taxType") SELECT "amount", "createdAt", "entityId", "id", "metadata", "method", "paidAt", "periodId", "reference", "status", "taxType" FROM "TaxPayment";
DROP TABLE "TaxPayment";
ALTER TABLE "new_TaxPayment" RENAME TO "TaxPayment";
CREATE INDEX "TaxPayment_entityId_taxType_idx" ON "TaxPayment"("entityId", "taxType");
CREATE TABLE "new_TaxPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaxPeriod_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TaxPeriod" ("createdAt", "endDate", "entityId", "id", "period", "startDate", "status", "updatedAt") SELECT "createdAt", "endDate", "entityId", "id", "period", "startDate", "status", "updatedAt" FROM "TaxPeriod";
DROP TABLE "TaxPeriod";
ALTER TABLE "new_TaxPeriod" RENAME TO "TaxPeriod";
CREATE INDEX "TaxPeriod_entityId_period_idx" ON "TaxPeriod"("entityId", "period");
CREATE TABLE "new_TaxReconciliation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxReconciliation_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaxReconciliation_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TaxPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TaxReconciliation" ("createdAt", "entityId", "id", "periodId", "status", "summary", "taxType") SELECT "createdAt", "entityId", "id", "periodId", "status", "summary", "taxType" FROM "TaxReconciliation";
DROP TABLE "TaxReconciliation";
ALTER TABLE "new_TaxReconciliation" RENAME TO "TaxReconciliation";
CREATE INDEX "TaxReconciliation_entityId_taxType_idx" ON "TaxReconciliation"("entityId", "taxType");
CREATE TABLE "new_TaxRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "categoryId" TEXT,
    "taxType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" REAL NOT NULL DEFAULT 0,
    "rateType" TEXT NOT NULL DEFAULT 'percentage',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "conditions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxRule_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaxRule_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "TaxRuleSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaxRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TaxCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TaxRule" ("categoryId", "conditions", "createdAt", "entityId", "id", "isActive", "name", "priority", "rate", "rateType", "ruleSetId", "taxType") SELECT "categoryId", "conditions", "createdAt", "entityId", "id", "isActive", "name", "priority", "rate", "rateType", "ruleSetId", "taxType" FROM "TaxRule";
DROP TABLE "TaxRule";
ALTER TABLE "new_TaxRule" RENAME TO "TaxRule";
CREATE INDEX "TaxRule_ruleSetId_taxType_idx" ON "TaxRule"("ruleSetId", "taxType");
CREATE TABLE "new_TaxRuleSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL DEFAULT 'internal',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxRuleSet_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TaxRuleSet" ("createdAt", "effectiveFrom", "effectiveTo", "entityId", "id", "source", "status", "version") SELECT "createdAt", "effectiveFrom", "effectiveTo", "entityId", "id", "source", "status", "version" FROM "TaxRuleSet";
DROP TABLE "TaxRuleSet";
ALTER TABLE "new_TaxRuleSet" RENAME TO "TaxRuleSet";
CREATE INDEX "TaxRuleSet_entityId_version_idx" ON "TaxRuleSet"("entityId", "version");
CREATE TABLE "new_TaxSchedule" (
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
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaxSchedule_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaxSchedule_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "TaxPeriod" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaxSchedule_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "TaxRuleSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TaxSchedule" ("carryForward", "createdAt", "dueDate", "entityId", "id", "metadata", "periodId", "ruleSetId", "status", "taxType", "totalBase", "totalTax", "updatedAt") SELECT "carryForward", "createdAt", "dueDate", "entityId", "id", "metadata", "periodId", "ruleSetId", "status", "taxType", "totalBase", "totalTax", "updatedAt" FROM "TaxSchedule";
DROP TABLE "TaxSchedule";
ALTER TABLE "new_TaxSchedule" RENAME TO "TaxSchedule";
CREATE INDEX "TaxSchedule_entityId_taxType_idx" ON "TaxSchedule"("entityId", "taxType");
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "type" TEXT NOT NULL DEFAULT 'general',
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amount", "createdAt", "currency", "date", "description", "entityId", "id", "metadata", "source", "status", "type", "updatedAt") SELECT "amount", "createdAt", "currency", "date", "description", "entityId", "id", "metadata", "source", "status", "type", "updatedAt" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_entityId_date_idx" ON "Transaction"("entityId", "date");
CREATE TABLE "new_Vendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'corporate',
    "taxId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vendor_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Vendor" ("address", "createdAt", "email", "entityId", "id", "name", "phone", "taxId", "type") SELECT "address", "createdAt", "email", "entityId", "id", "name", "phone", "taxId", "type" FROM "Vendor";
DROP TABLE "Vendor";
ALTER TABLE "new_Vendor" RENAME TO "Vendor";
CREATE INDEX "Vendor_entityId_name_idx" ON "Vendor"("entityId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_companyId_month_year_key" ON "PayrollRun"("companyId", "month", "year");

-- CreateIndex
CREATE INDEX "AccountingJournal_entityId_date_idx" ON "AccountingJournal"("entityId", "date");

-- CreateIndex
CREATE INDEX "AccountingJournal_entityId_status_idx" ON "AccountingJournal"("entityId", "status");

-- CreateIndex
CREATE INDEX "AccountingJournal_entityId_sourceDocType_sourceDocId_idx" ON "AccountingJournal"("entityId", "sourceDocType", "sourceDocId");

-- CreateIndex
CREATE INDEX "AccountingJournal_entityId_journalHash_idx" ON "AccountingJournal"("entityId", "journalHash");

-- CreateIndex
CREATE INDEX "AccountingJournalLine_journalId_idx" ON "AccountingJournalLine"("journalId");

-- CreateIndex
CREATE INDEX "AccountingJournalLine_accountCode_idx" ON "AccountingJournalLine"("accountCode");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalPolicy_entityId_key" ON "ApprovalPolicy"("entityId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_entityId_status_idx" ON "ApprovalRequest"("entityId", "status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_resourceType_resourceId_idx" ON "ApprovalRequest"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "PeriodLock_entityId_period_idx" ON "PeriodLock"("entityId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodLock_entityId_period_key" ON "PeriodLock"("entityId", "period");

-- CreateIndex
CREATE INDEX "RecurringTemplate_entityId_status_nextRunAt_idx" ON "RecurringTemplate"("entityId", "status", "nextRunAt");

-- CreateIndex
CREATE INDEX "RecurringRun_entityId_runAt_idx" ON "RecurringRun"("entityId", "runAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringRun_entityId_templateId_periodKey_key" ON "RecurringRun"("entityId", "templateId", "periodKey");

-- CreateIndex
CREATE INDEX "ExchangeRate_entityId_date_idx" ON "ExchangeRate"("entityId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_entityId_date_fromCurrency_toCurrency_key" ON "ExchangeRate"("entityId", "date", "fromCurrency", "toCurrency");

-- CreateIndex
CREATE INDEX "TrackingClass_entityId_isActive_idx" ON "TrackingClass"("entityId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingClass_entityId_name_key" ON "TrackingClass"("entityId", "name");

-- CreateIndex
CREATE INDEX "TrackingLocation_entityId_isActive_idx" ON "TrackingLocation"("entityId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingLocation_entityId_name_key" ON "TrackingLocation"("entityId", "name");

-- CreateIndex
CREATE INDEX "AccountingMigrationRun_entityId_createdAt_idx" ON "AccountingMigrationRun"("entityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingMigrationRun_entityId_clientId_key" ON "AccountingMigrationRun"("entityId", "clientId");

-- CreateIndex
CREATE INDEX "ActionExecutionLog_entityId_createdAt_idx" ON "ActionExecutionLog"("entityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActionExecutionLog_entityId_actionId_key" ON "ActionExecutionLog"("entityId", "actionId");

