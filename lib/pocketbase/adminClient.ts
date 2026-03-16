import PocketBase from "pocketbase";
import {
  getPocketBaseSuperuserEmail,
  getPocketBaseSuperuserPassword,
  getPocketBaseUrl,
} from "@/lib/pocketbase/config";

const ADMIN_TOKEN_CACHE_TTL_MS = 10 * 60 * 1000;

let cachedAdminToken: string | null = null;
let cachedAdminTokenExpiresAt = 0;
let adminTokenPromise: Promise<string> | null = null;

async function fetchAdminToken(): Promise<string> {
  const pb = new PocketBase(getPocketBaseUrl());
  pb.autoCancellation(false);

  const email = getPocketBaseSuperuserEmail();
  const password = getPocketBaseSuperuserPassword();

  await pb.collection("_superusers").authWithPassword(email, password);

  if (!pb.authStore.token) {
    throw new Error("PocketBase superuser authentication did not return a token.");
  }

  cachedAdminToken = pb.authStore.token;
  cachedAdminTokenExpiresAt = Date.now() + ADMIN_TOKEN_CACHE_TTL_MS;

  return cachedAdminToken;
}

async function getAdminToken(): Promise<string> {
  if (cachedAdminToken && Date.now() < cachedAdminTokenExpiresAt) {
    return cachedAdminToken;
  }

  if (!adminTokenPromise) {
    adminTokenPromise = fetchAdminToken().finally(() => {
      adminTokenPromise = null;
    });
  }

  return adminTokenPromise;
}

export async function createPocketBaseAdminClient(): Promise<PocketBase> {
  const pb = new PocketBase(getPocketBaseUrl());
  pb.autoCancellation(false);
  pb.authStore.save(await getAdminToken(), null);
  return pb;
}
