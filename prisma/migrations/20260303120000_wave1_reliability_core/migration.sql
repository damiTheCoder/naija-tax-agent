-- Wave 1 reliability core: chat persistence + tax sync observability

CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "createdBy" TEXT,
    "metadata" TEXT,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatConversation_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "TaxSyncRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'apply',
    "journalCount" INTEGER NOT NULL DEFAULT 0,
    "upsertedTransactions" INTEGER NOT NULL DEFAULT 0,
    "prunedTransactions" INTEGER NOT NULL DEFAULT 0,
    "duplicatesPruned" INTEGER NOT NULL DEFAULT 0,
    "staleRowsRemoved" INTEGER NOT NULL DEFAULT 0,
    "impactedPeriods" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "error" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxSyncRun_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ChatMessage_conversationId_sequence_key" ON "ChatMessage"("conversationId", "sequence");
CREATE INDEX "ChatConversation_entityId_updatedAt_idx" ON "ChatConversation"("entityId", "updatedAt" DESC);
CREATE INDEX "ChatConversation_entityId_module_updatedAt_idx" ON "ChatConversation"("entityId", "module", "updatedAt" DESC);
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");
CREATE INDEX "TaxSyncRun_entityId_createdAt_idx" ON "TaxSyncRun"("entityId", "createdAt");
CREATE INDEX "TaxSyncRun_entityId_status_idx" ON "TaxSyncRun"("entityId", "status");
