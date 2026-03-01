import type { JournalSyncInput, TaxEngineSettingsV2 } from "./types";
import { taxSettingsRepo, taxTransactionRepo } from "./repositories";

export async function postTaxForJournalEntry(params: {
  entityId: string;
  journal: JournalSyncInput;
  settings?: TaxEngineSettingsV2;
  source?: "live_posting" | "backfill";
}) {
  const entityId = params.entityId || "entity-default";
  if (params.settings) {
    await taxSettingsRepo.save(entityId, params.settings);
  }
  return taxTransactionRepo.upsertJournalTransactions({
    entityId,
    journals: [params.journal],
    source: params.source || "live_posting",
  });
}

