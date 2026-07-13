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

const GOOGLE_PROVIDER = {
  name: "google",
  displayName: "Google",
  authURL: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenURL: "https://oauth2.googleapis.com/token",
  userInfoURL: "https://openidconnect.googleapis.com/v1/userinfo",
  pkce: true,
};

type OAuth2ProviderConfig = typeof GOOGLE_PROVIDER & {
  clientId: string;
  clientSecret: string;
  extra?: Record<string, unknown>;
};

type AuthCollection = {
  id: string;
  oauth2?: {
    enabled?: boolean;
    mappedFields?: Record<string, string>;
    providers?: OAuth2ProviderConfig[];
  };
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env.local or your deployment environment.`);
  }
  return value;
}

async function main() {
  const clientId = requiredEnv("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = requiredEnv("GOOGLE_OAUTH_CLIENT_SECRET");

  const pb = new PocketBase(getPocketBaseUrl());
  pb.autoCancellation(false);

  await pb.collection("_superusers").authWithPassword(
    getPocketBaseSuperuserEmail(),
    getPocketBaseSuperuserPassword(),
  );

  const usersCollection = (await pb.collections.getOne(POCKETBASE_USER_COLLECTION, {
    requestKey: null,
  })) as AuthCollection;

  const currentOauth2 = usersCollection.oauth2 || {};
  const nextGoogleProvider: OAuth2ProviderConfig = {
    ...GOOGLE_PROVIDER,
    clientId,
    clientSecret,
    extra: {
      prompt: "select_account",
    },
  };

  await pb.collections.update(
    usersCollection.id,
    {
      oauth2: {
        ...currentOauth2,
        enabled: true,
        mappedFields: {
          id: "",
          name: "name",
          username: "",
          avatarURL: "avatar",
          ...currentOauth2.mappedFields,
          email: "email",
        },
        providers: [nextGoogleProvider],
      },
    },
    { requestKey: null },
  );

  const publicUrl = (process.env.NEXT_PUBLIC_POCKETBASE_URL || getPocketBaseUrl()).replace(/\/+$/, "");
  console.log("[pb:oauth:google] Google OAuth is enabled for the users collection.");
  console.log(`[pb:oauth:google] Add this authorized redirect URI in Google Cloud: ${publicUrl}/api/oauth2-redirect`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Failed to configure Google OAuth.";
  console.error(`[pb:oauth:google] ${message}`);
  process.exit(1);
});
