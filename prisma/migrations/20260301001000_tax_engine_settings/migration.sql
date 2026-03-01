-- Tax engine settings for ledger-first VAT/WHT configuration
CREATE TABLE "TaxEngineSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "filingCadenceVat" TEXT NOT NULL DEFAULT 'monthly',
    "filingCadenceWht" TEXT NOT NULL DEFAULT 'monthly',
    "filingDueDay" INTEGER NOT NULL DEFAULT 21,
    "defaultVatModeByCategory" TEXT,
    "categoryTaxMatrix" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TaxEngineSetting_entityId_key" ON "TaxEngineSetting" ("entityId");
