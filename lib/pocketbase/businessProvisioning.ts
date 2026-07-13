import PocketBase from "pocketbase";
import { AppSession } from "@/lib/pocketbase/session";

type PocketBaseRecord = {
  id: string;
  [key: string]: unknown;
};

export type CreateBusinessInput = {
  legalName: string;
  tradingName?: string;
  businessType?: string;
  industry?: string;
  registrationNumber?: string;
  taxIdentificationNumber?: string;
  country?: string;
  state?: string;
  address?: string;
  currency?: string;
  timezone?: string;
  fiscalYearStartMonth?: number;
};

const DEFAULT_CHART_OF_ACCOUNTS = [
  { code: "1000", name: "Cash", accountType: "asset", normalBalance: "debit" },
  { code: "1010", name: "Bank", accountType: "asset", normalBalance: "debit" },
  { code: "1100", name: "Accounts Receivable", accountType: "asset", normalBalance: "debit" },
  { code: "2000", name: "Accounts Payable", accountType: "liability", normalBalance: "credit" },
  { code: "3000", name: "Owner's Equity", accountType: "equity", normalBalance: "credit" },
  { code: "4000", name: "Sales Revenue", accountType: "revenue", normalBalance: "credit" },
  { code: "5000", name: "Cost of Sales", accountType: "expense", normalBalance: "debit" },
  { code: "6000", name: "Operating Expenses", accountType: "expense", normalBalance: "debit" },
] as const;

function normalizeMonth(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(12, Math.trunc(value)));
}

export async function createBusinessWithDefaults(
  pb: PocketBase,
  session: AppSession,
  input: CreateBusinessInput,
): Promise<{ business: PocketBaseRecord; membership: PocketBaseRecord; accounts: PocketBaseRecord[] }> {
  const legalName = input.legalName?.trim();
  if (!legalName) {
    throw new Error("legalName is required.");
  }

  const business = (await pb.collection("businesses").create({
    owner: session.userId,
    legal_name: legalName,
    trading_name: input.tradingName?.trim() || legalName,
    business_type: input.businessType || "limited_company",
    industry: input.industry?.trim() || "",
    registration_number: input.registrationNumber?.trim() || "",
    tax_identification_number: input.taxIdentificationNumber?.trim() || "",
    country: input.country?.trim() || "Nigeria",
    state: input.state?.trim() || "",
    address: input.address?.trim() || "",
    currency: input.currency || "NGN",
    timezone: input.timezone?.trim() || "Africa/Lagos",
    fiscal_year_start_month: normalizeMonth(input.fiscalYearStartMonth),
    status: "active",
    onboarding_status: "in_progress",
    settings: {},
  })) as PocketBaseRecord;

  const membership = (await pb.collection("business_members").create({
    business: business.id,
    user: session.userId,
    role: "owner",
    permissions: ["*"],
    status: "active",
    invited_by: session.userId,
    joined_at: new Date().toISOString(),
  })) as PocketBaseRecord;

  const accounts = await Promise.all(
    DEFAULT_CHART_OF_ACCOUNTS.map(async (account) => {
      return (await pb.collection("chart_of_accounts").create({
        business: business.id,
        code: account.code,
        name: account.name,
        account_type: account.accountType,
        normal_balance: account.normalBalance,
        is_system_account: true,
        is_active: true,
        description: "",
      })) as PocketBaseRecord;
    }),
  );

  await pb.collection("audit_logs").create({
    business: business.id,
    user: session.userId,
    action: "business.created",
    entity_collection: "businesses",
    entity_record_id: business.id,
    old_values: null,
    new_values: { business, accountCount: accounts.length },
    created_at: new Date().toISOString(),
  });

  return { business, membership, accounts };
}
