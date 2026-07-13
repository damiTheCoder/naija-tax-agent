import { config as loadEnv } from "dotenv";
import PocketBase from "pocketbase";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

type Check = {
  name: string;
  ok: boolean;
  detail: string;
};

const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_BASE_URL",
  "POCKETBASE_URL",
  "NEXT_PUBLIC_POCKETBASE_URL",
  "POCKETBASE_SUPERUSER_EMAIL",
  "POCKETBASE_SUPERUSER_PASSWORD",
  "AUTH_SESSION_SECRET",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
] as const;

const REQUIRED_COLLECTIONS = [
  "users",
  "businesses",
  "business_members",
  "chart_of_accounts",
  "financial_accounts",
  "transactions",
  "journal_entries",
  "journal_lines",
  "audit_logs",
  "support_tickets",
  "support_messages",
  "usage_events",
  "v_trial_balance",
  "v_profit_and_loss",
  "v_balance_sheet",
  "v_cash_flow",
  "v_dashboard_metrics",
] as const;

function env(name: string): string {
  return process.env[name]?.trim() || "";
}

function isLoopbackUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.includes("change-this") ||
    lower.includes("replace-with") ||
    lower.includes("example.com") ||
    lower.includes("your_") ||
    lower.includes("your-")
  );
}

function baseEnvChecks(): Check[] {
  const checks: Check[] = [];

  for (const name of REQUIRED_ENV_VARS) {
    const value = env(name);
    checks.push({
      name: `env:${name}`,
      ok: Boolean(value),
      detail: value ? "set" : "missing",
    });
  }

  const sessionSecret = env("AUTH_SESSION_SECRET");
  checks.push({
    name: "auth:session_secret_strength",
    ok: sessionSecret.length >= 32 && !isPlaceholder(sessionSecret),
    detail:
      sessionSecret.length >= 32 && !isPlaceholder(sessionSecret)
        ? "session secret length ok"
        : "AUTH_SESSION_SECRET must be a non-placeholder secret of at least 32 characters",
  });

  const superuserPassword = env("POCKETBASE_SUPERUSER_PASSWORD");
  checks.push({
    name: "pocketbase:superuser_password_strength",
    ok: superuserPassword.length >= 24 && !isPlaceholder(superuserPassword),
    detail:
      superuserPassword.length >= 24 && !isPlaceholder(superuserPassword)
        ? "superuser password length ok"
        : "POCKETBASE_SUPERUSER_PASSWORD must be a non-placeholder secret of at least 24 characters",
  });

  for (const name of ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"]) {
    const value = env(name);
    checks.push({
      name: `oauth:${name}`,
      ok: Boolean(value) && !isPlaceholder(value),
      detail: value && !isPlaceholder(value) ? "set" : `${name} must be set for Google login`,
    });
  }

  for (const name of ["NEXT_PUBLIC_BASE_URL", "POCKETBASE_URL", "NEXT_PUBLIC_POCKETBASE_URL"]) {
    const value = env(name);
    checks.push({
      name: `url:${name}`,
      ok: Boolean(value) && !isLoopbackUrl(value),
      detail: value
        ? isLoopbackUrl(value)
          ? "must not point to localhost/127.0.0.1 in production"
          : "production URL ok"
        : "missing",
    });
  }

  return checks;
}

async function pocketBaseChecks(): Promise<Check[]> {
  const checks: Check[] = [];
  const url = env("POCKETBASE_URL");
  const email = env("POCKETBASE_SUPERUSER_EMAIL");
  const password = env("POCKETBASE_SUPERUSER_PASSWORD");

  if (!url || !email || !password) {
    return [
      {
        name: "pocketbase:connection",
        ok: false,
        detail: "PocketBase URL/email/password are required before connection checks can run",
      },
    ];
  }

  try {
    const pb = new PocketBase(url);
    pb.autoCancellation(false);
    await pb.collection("_superusers").authWithPassword(email, password);
    checks.push({ name: "pocketbase:superuser_auth", ok: true, detail: "authenticated" });

    const collections = await pb.collections.getFullList({ requestKey: null });
    const existing = new Set(collections.map((collection) => collection.name));
    const missing = REQUIRED_COLLECTIONS.filter((name) => !existing.has(name));
    checks.push({
      name: "pocketbase:required_collections",
      ok: missing.length === 0,
      detail: missing.length === 0 ? "all required collections exist" : `missing: ${missing.join(", ")}`,
    });

    const legacyCollections = ["ACCOUNTS", "AUTH_COLLECTION", "BUSINESSES", "Journal_Entries", "Transactions"].filter(
      (name) => existing.has(name),
    );
    checks.push({
      name: "pocketbase:legacy_collections",
      ok: legacyCollections.length === 0,
      detail:
        legacyCollections.length === 0
          ? "no legacy collections detected"
          : `legacy collections still exist: ${legacyCollections.join(", ")}`,
    });

    const methods = await pb.collection("users").listAuthMethods({ requestKey: null });
    const hasGoogleProvider = methods.oauth2.providers.some((provider) => provider.name.toLowerCase() === "google");
    checks.push({
      name: "pocketbase:google_oauth",
      ok: methods.oauth2.enabled && hasGoogleProvider,
      detail:
        methods.oauth2.enabled && hasGoogleProvider
          ? "Google OAuth enabled on users collection"
          : "run `npm run pb:oauth:google` after setting GOOGLE_OAUTH_CLIENT_ID/SECRET",
    });
  } catch (error) {
    checks.push({
      name: "pocketbase:connection",
      ok: false,
      detail: error instanceof Error ? error.message : "PocketBase connection failed",
    });
  }

  return checks;
}

async function main(): Promise<void> {
  const checks = [...baseEnvChecks(), ...(await pocketBaseChecks())];
  const failed = checks.filter((check) => !check.ok);

  for (const check of checks) {
    const prefix = check.ok ? "OK" : "FAIL";
    console.log(`[${prefix}] ${check.name}: ${check.detail}`);
  }

  if (failed.length > 0) {
    console.error(`\nProduction readiness failed (${failed.length} issue${failed.length === 1 ? "" : "s"}).`);
    process.exit(1);
  }

  console.log("\nProduction readiness checks passed.");
}

main().catch((error) => {
  console.error("Production readiness check crashed:", error);
  process.exit(1);
});
