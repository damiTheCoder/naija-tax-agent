import { config as loadEnv } from "dotenv";
import PocketBase from "pocketbase";
import {
  getPocketBaseSuperuserEmail,
  getPocketBaseSuperuserPassword,
  getPocketBaseUrl,
} from "@/lib/pocketbase/config";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const LEGACY_COLLECTIONS = [
  "ACCOUNTS",
  "AUTH_COLLECTION",
  "AUTH_COLLECTIONS",
  "BUSINESSES",
  "Journal_Entries",
  "Transactions",
] as const;

async function main(): Promise<void> {
  const pb = new PocketBase(getPocketBaseUrl());
  pb.autoCancellation(false);
  await pb.collection("_superusers").authWithPassword(
    getPocketBaseSuperuserEmail(),
    getPocketBaseSuperuserPassword(),
  );

  const collections = await pb.collections.getFullList({ requestKey: null });
  const byName = new Map(collections.map((collection) => [collection.name, collection]));
  const existing = LEGACY_COLLECTIONS.map((name) => byName.get(name)).filter(Boolean);

  if (existing.length === 0) {
    console.log("[pb:clean:legacy] no legacy collections found");
    return;
  }

  for (const collection of existing) {
    if (!collection) continue;
    const result = await pb.collection(collection.name).getList(1, 1, {
      requestKey: null,
    });
    if (result.totalItems > 0) {
      throw new Error(
        `Refusing to delete legacy collection "${collection.name}" because it has ${result.totalItems} record(s). Migrate the data first.`,
      );
    }
  }

  for (const collection of existing) {
    if (!collection) continue;
    await pb.collections.delete(collection.id);
    console.log(`[pb:clean:legacy] deleted empty legacy collection "${collection.name}"`);
  }
}

main().catch((error) => {
  console.error("[pb:clean:legacy] failed:", error);
  process.exit(1);
});
