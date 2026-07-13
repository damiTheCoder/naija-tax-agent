import { config as loadEnv } from "dotenv";
import PocketBase from "pocketbase";
import {
  POCKETBASE_USER_COLLECTION,
  getPocketBaseSuperuserEmail,
  getPocketBaseSuperuserPassword,
  getPocketBaseUrl,
} from "@/lib/pocketbase/config";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

type PocketBaseField = {
  name?: string;
  required?: boolean;
  [key: string]: unknown;
};

type PocketBaseCollection = {
  id: string;
  name: string;
  fields?: PocketBaseField[];
  updateRule?: string;
  authRule?: string;
};

type UserRecord = {
  id: string;
  role?: string;
  status?: string;
  sessionVersion?: number | string | null;
};

async function main() {
  const pb = new PocketBase(getPocketBaseUrl());
  pb.autoCancellation(false);

  await pb.collection("_superusers").authWithPassword(
    getPocketBaseSuperuserEmail(),
    getPocketBaseSuperuserPassword(),
  );

  const collection = (await pb.collections.getOne(POCKETBASE_USER_COLLECTION, {
    requestKey: null,
  })) as PocketBaseCollection;

  const fields = (collection.fields || []).map((field) => {
    if (field.name === "role" || field.name === "status") {
      return { ...field, required: false };
    }
    return field;
  });

  await pb.collections.update(
    collection.id,
    {
      fields,
      updateRule: "@request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
      authRule: "status = 'active' || status = ''",
    },
    { requestKey: null },
  );

  const users = (await pb.collection(POCKETBASE_USER_COLLECTION).getFullList({
    requestKey: null,
  })) as UserRecord[];

  let backfilled = 0;
  for (const user of users) {
    const patch: Partial<UserRecord> = {};
    if (!user.role) patch.role = "user";
    if (!user.status) patch.status = "active";
    if (!user.sessionVersion) patch.sessionVersion = 1;

    if (Object.keys(patch).length > 0) {
      await pb.collection(POCKETBASE_USER_COLLECTION).update(user.id, patch, { requestKey: null });
      backfilled += 1;
    }
  }

  console.log("[pb:auth:repair] users collection is OAuth-safe.");
  console.log(`[pb:auth:repair] Backfilled ${backfilled} existing user record(s).`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Failed to repair users auth collection.";
  console.error(`[pb:auth:repair] ${message}`);
  process.exit(1);
});
