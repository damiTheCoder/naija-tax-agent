import { existsSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import PocketBase from "pocketbase";
import {
  POCKETBASE_ADMIN_AUDIT_COLLECTION,
  POCKETBASE_COMPLAINT_MESSAGES_COLLECTION,
  POCKETBASE_COMPLAINTS_COLLECTION,
  POCKETBASE_USAGE_EVENTS_COLLECTION,
  POCKETBASE_USER_COLLECTION,
  getPocketBaseSuperuserEmail,
  getPocketBaseSuperuserPassword,
  getPocketBaseUrl,
} from "@/lib/pocketbase/config";
import {
  getLocalPocketBaseDataDbPath,
  runLocalTimestampRepair,
} from "@/scripts/pocketbase-backfill-local-timestamps";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

type CollectionSpec = {
  name: string;
  type: "auth" | "base" | "view";
  fields: Array<Record<string, unknown>>;
  indexes?: string[];
  viewQuery?: string;
  listRule?: string | null;
  viewRule?: string | null;
  createRule?: string | null;
  updateRule?: string | null;
  deleteRule?: string | null;
  authRule?: string | null;
  manageRule?: string | null;
};

const BUSINESS_ROLES = ["owner", "admin", "accountant", "staff", "auditor", "viewer"];
const CURRENCIES = ["NGN", "USD", "GBP", "EUR"];

function shouldAutoRepairLocalTimestamps(pocketBaseUrl: string): boolean {
  if (process.env.POCKETBASE_AUTO_REPAIR_LOCAL_TIMESTAMPS === "0") {
    return false;
  }

  try {
    const url = new URL(pocketBaseUrl);
    const isLoopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    return isLoopback && existsSync(getLocalPocketBaseDataDbPath());
  } catch {
    return false;
  }
}

function timestampFields(): Array<Record<string, unknown>> {
  return [
    {
      name: "created",
      type: "autodate",
      onCreate: true,
      onUpdate: false,
    },
    {
      name: "updated",
      type: "autodate",
      onCreate: true,
      onUpdate: true,
    },
  ];
}

function textField(name: string, options: Record<string, unknown> = {}): Record<string, unknown> {
  return { name, type: "text", ...options };
}

function editorField(name: string, options: Record<string, unknown> = {}): Record<string, unknown> {
  return { name, type: "editor", ...options };
}

function emailField(name: string, options: Record<string, unknown> = {}): Record<string, unknown> {
  return { name, type: "email", ...options };
}

function numberField(name: string, options: Record<string, unknown> = {}): Record<string, unknown> {
  return { name, type: "number", ...options };
}

function boolField(name: string, options: Record<string, unknown> = {}): Record<string, unknown> {
  return { name, type: "bool", ...options };
}

function dateField(name: string, options: Record<string, unknown> = {}): Record<string, unknown> {
  return { name, type: "date", ...options };
}

function jsonField(name: string, options: Record<string, unknown> = {}): Record<string, unknown> {
  return { name, type: "json", ...options };
}

function fileField(name: string, options: Record<string, unknown> = {}): Record<string, unknown> {
  return { name, type: "file", maxSelect: 1, ...options };
}

function selectField(
  name: string,
  values: string[],
  options: Record<string, unknown> = {},
): Record<string, unknown> {
  return { name, type: "select", maxSelect: 1, values, ...options };
}

function relationField(
  name: string,
  collectionId: string,
  options: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    name,
    type: "relation",
    collectionId,
    cascadeDelete: false,
    minSelect: 0,
    maxSelect: 1,
    ...options,
  };
}

function requiredRelationField(name: string, collectionId: string): Record<string, unknown> {
  return relationField(name, collectionId, { required: true, minSelect: 1, maxSelect: 1 });
}

function baseCollection(
  name: string,
  fields: Array<Record<string, unknown>>,
  indexes: string[] = [],
  rules: Partial<CollectionSpec> = {},
): CollectionSpec {
  const authenticated = "@request.auth.id != ''";
  const hasBusinessRelation = fields.some(
    (field) => field.type === "relation" && field.name === "business" && field.collectionId === "businesses",
  );
  const defaultReadRule = hasBusinessRelation ? businessReadRule() : authenticated;
  const defaultWriteRule = hasBusinessRelation ? businessWriteRule() : authenticated;
  return {
    name,
    type: "base",
    fields: [...fields, ...timestampFields()],
    indexes,
    listRule: defaultReadRule,
    viewRule: defaultReadRule,
    createRule: defaultWriteRule,
    updateRule: defaultWriteRule,
    deleteRule: "@request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
    ...rules,
  };
}

function businessRelation(): Record<string, unknown> {
  return requiredRelationField("business", "businesses");
}

function businessReadRule(): string {
  return [
    "@request.auth.id != ''",
    "&&",
    "(",
    "business.owner = @request.auth.id",
    "|| business.business_members_via_business.user = @request.auth.id",
    "|| @request.auth.role = 'support_admin'",
    "|| @request.auth.role = 'super_admin'",
    ")",
  ].join(" ");
}

function businessWriteRule(): string {
  return [
    "@request.auth.id != ''",
    "&&",
    "(",
    "business.owner = @request.auth.id",
    "|| business.business_members_via_business.user = @request.auth.id",
    "|| @request.auth.role = 'super_admin'",
    ")",
  ].join(" ");
}

function businessAdminRule(): string {
  return [
    "@request.auth.id != ''",
    "&&",
    "(",
    "business.owner = @request.auth.id",
    "|| @request.auth.role = 'super_admin'",
    ")",
  ].join(" ");
}

function viewCollection(name: string, viewQuery: string, columns: string[]): CollectionSpec {
  const selectList = columns.map((column) => `q.${column} AS ${column}`).join(", ");
  return {
    name,
    type: "view",
    fields: [],
    indexes: [],
    viewQuery: `SELECT ${selectList} FROM (${viewQuery}) q`,
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
  };
}

async function resolveFields(
  pb: PocketBase,
  fields: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  const collectionIdCache = new Map<string, string>();
  const resolved: Array<Record<string, unknown>> = [];

  for (const field of fields) {
    if (field.type !== "relation" || typeof field.collectionId !== "string") {
      resolved.push(field);
      continue;
    }

    const target = field.collectionId;
    try {
      let collectionId = collectionIdCache.get(target);
      if (!collectionId) {
        const collection = await findCollectionByName(pb, target);
        if (!collection) {
          throw new Error(`Missing relation collection "${target}"`);
        }
        collectionId = collection.id;
        collectionIdCache.set(target, collectionId);
      }

      resolved.push({
        ...field,
        collectionId,
      });
    } catch {
      resolved.push(field);
    }
  }

  return resolved;
}

async function findCollectionByName(
  pb: PocketBase,
  name: string,
): Promise<({ id: string; name?: string } & Record<string, unknown>) | null> {
  try {
    return await pb.collections.getFirstListItem(`name="${name.replace(/"/g, '\\"')}"`);
  } catch {
    const collections = await pb.collections.getFullList({ requestKey: null });
    return (
      collections.find((collection) => collection.name.toLowerCase() === name.toLowerCase()) ??
      null
    );
  }
}

function usersCollectionSpec(): CollectionSpec {
  return {
    name: POCKETBASE_USER_COLLECTION,
    type: "auth",
    fields: [
      {
        name: "name",
        type: "text",
        required: false,
        presentable: true,
      },
      textField("full_name", { presentable: true }),
      textField("phone"),
      fileField("avatar"),
      {
        name: "role",
        type: "select",
        required: false,
        presentable: true,
        maxSelect: 1,
        values: ["user", "read_only", "support_agent", "support_admin", "super_admin"],
      },
      selectField("platform_role", ["user", "support", "admin"]),
      {
        name: "status",
        type: "select",
        required: false,
        presentable: true,
        maxSelect: 1,
        values: ["active", "suspended", "disabled"],
      },
      {
        name: "organization",
        type: "text",
      },
      boolField("onboarding_completed"),
      dateField("last_login_at"),
      {
        name: "lastSeenAt",
        type: "date",
      },
      {
        name: "sessionVersion",
        type: "number",
      },
      ...timestampFields(),
    ],
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_users_role ON users (role)",
      "CREATE INDEX IF NOT EXISTS idx_users_status ON users (status)",
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "id = @request.auth.id || @request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
    createRule: "",
    updateRule: "@request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
    deleteRule: "@request.auth.role = 'super_admin'",
    authRule: "status = 'active' || status = ''",
    manageRule: "id = @request.auth.id || @request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
  };
}

function complaintsCollectionSpec(): CollectionSpec {
  return {
    name: POCKETBASE_COMPLAINTS_COLLECTION,
    type: "base",
    fields: [
      {
        name: "user",
        type: "relation",
        required: true,
        collectionId: POCKETBASE_USER_COLLECTION,
        cascadeDelete: false,
        minSelect: 1,
        maxSelect: 1,
      },
      { name: "subject", type: "text", required: true },
      { name: "description", type: "editor", required: true },
      {
        name: "status",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["new", "triaged", "investigating", "waiting_user", "resolved", "closed"],
      },
      {
        name: "priority",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["low", "medium", "high", "urgent"],
      },
      { name: "category", type: "text" },
      { name: "source", type: "text" },
      {
        name: "assignee",
        type: "relation",
        collectionId: POCKETBASE_USER_COLLECTION,
        cascadeDelete: false,
        minSelect: 0,
        maxSelect: 1,
      },
      { name: "resolution", type: "editor" },
      { name: "resolvedAt", type: "date" },
      {
        name: "updatedBy",
        type: "relation",
        collectionId: POCKETBASE_USER_COLLECTION,
        cascadeDelete: false,
        minSelect: 0,
        maxSelect: 1,
      },
      ...timestampFields(),
    ],
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints (status)",
      "CREATE INDEX IF NOT EXISTS idx_complaints_priority ON complaints (priority)",
      "CREATE INDEX IF NOT EXISTS idx_complaints_user ON complaints (user)",
      "CREATE INDEX IF NOT EXISTS idx_complaints_assignee ON complaints (assignee)",
    ],
    listRule: "@request.auth.role != ''",
    viewRule: "@request.auth.role != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.role = 'support_agent' || @request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
    deleteRule: "@request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
  };
}

function complaintMessagesCollectionSpec(): CollectionSpec {
  return {
    name: POCKETBASE_COMPLAINT_MESSAGES_COLLECTION,
    type: "base",
    fields: [
      {
        name: "complaint",
        type: "relation",
        required: true,
        collectionId: POCKETBASE_COMPLAINTS_COLLECTION,
        cascadeDelete: true,
        minSelect: 1,
        maxSelect: 1,
      },
      {
        name: "sender",
        type: "relation",
        required: true,
        collectionId: POCKETBASE_USER_COLLECTION,
        cascadeDelete: false,
        minSelect: 1,
        maxSelect: 1,
      },
      { name: "message", type: "editor", required: true },
      { name: "internalNote", type: "bool" },
      ...timestampFields(),
    ],
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_complaint_messages_complaint ON complaint_messages (complaint)",
    ],
    listRule: "@request.auth.role != ''",
    viewRule: "@request.auth.role != ''",
    createRule: "@request.auth.role = 'support_agent' || @request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
    updateRule: "@request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
    deleteRule: "@request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
  };
}

function usageEventsCollectionSpec(): CollectionSpec {
  return {
    name: POCKETBASE_USAGE_EVENTS_COLLECTION,
    type: "base",
    fields: [
      {
        name: "user",
        type: "relation",
        required: false,
        collectionId: POCKETBASE_USER_COLLECTION,
        cascadeDelete: false,
        minSelect: 0,
        maxSelect: 1,
      },
      relationField("business", "businesses"),
      { name: "eventType", type: "text", required: true },
      { name: "event_type", type: "text" },
      { name: "quantity", type: "number" },
      { name: "module", type: "text" },
      { name: "path", type: "text" },
      { name: "ipAddress", type: "text" },
      { name: "userAgent", type: "text" },
      { name: "metadata", type: "json" },
      { name: "occurred_at", type: "date" },
      ...timestampFields(),
    ],
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_usage_events_event_type ON usage_events (eventType)",
      "CREATE INDEX IF NOT EXISTS idx_usage_events_event_type_snake ON usage_events (event_type)",
      "CREATE INDEX IF NOT EXISTS idx_usage_events_business ON usage_events (business)",
      "CREATE INDEX IF NOT EXISTS idx_usage_events_module ON usage_events (module)",
    ],
    listRule: "@request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
    viewRule: "@request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
    createRule: "",
    updateRule: "@request.auth.role = 'super_admin'",
    deleteRule: "@request.auth.role = 'super_admin'",
  };
}

function adminAuditCollectionSpec(): CollectionSpec {
  return {
    name: POCKETBASE_ADMIN_AUDIT_COLLECTION,
    type: "base",
    fields: [
      {
        name: "actor",
        type: "relation",
        required: true,
        collectionId: POCKETBASE_USER_COLLECTION,
        cascadeDelete: false,
        minSelect: 1,
        maxSelect: 1,
      },
      { name: "action", type: "text", required: true },
      { name: "targetType", type: "text", required: true },
      { name: "targetId", type: "text", required: true },
      { name: "reason", type: "text" },
      { name: "metadata", type: "json" },
      { name: "createdAt", type: "date" },
      ...timestampFields(),
    ],
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit_logs (actor)",
      "CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_logs (action)",
      "CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs (createdAt)",
    ],
    listRule: "@request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
    viewRule: "@request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
    createRule: "@request.auth.role = 'support_agent' || @request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
    updateRule: "@request.auth.role = 'super_admin'",
    deleteRule: "@request.auth.role = 'super_admin'",
  };
}

function businessesCollectionSpec(): CollectionSpec {
  return baseCollection(
    "businesses",
    [
      requiredRelationField("owner", POCKETBASE_USER_COLLECTION),
      textField("legal_name", { required: true, presentable: true }),
      textField("trading_name", { presentable: true }),
      selectField("business_type", ["sole_proprietorship", "partnership", "limited_company", "ngo", "other"]),
      textField("industry"),
      textField("registration_number"),
      textField("tax_identification_number"),
      textField("country"),
      textField("state"),
      textField("address"),
      selectField("currency", CURRENCIES),
      textField("timezone"),
      numberField("fiscal_year_start_month"),
      fileField("logo"),
      selectField("status", ["active", "suspended", "closed"]),
      selectField("onboarding_status", ["not_started", "in_progress", "completed"]),
      jsonField("settings"),
    ],
    [
      "CREATE INDEX IF NOT EXISTS idx_businesses_owner ON businesses (owner)",
      "CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses (status)",
    ],
    {
      listRule: "@request.auth.id != '' && (owner = @request.auth.id || business_members_via_business.user = @request.auth.id || @request.auth.role = 'support_admin' || @request.auth.role = 'super_admin')",
      viewRule: "@request.auth.id != '' && (owner = @request.auth.id || business_members_via_business.user = @request.auth.id || @request.auth.role = 'support_admin' || @request.auth.role = 'super_admin')",
      createRule: "@request.auth.id != ''",
      updateRule: "owner = @request.auth.id || @request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
      deleteRule: "owner = @request.auth.id || @request.auth.role = 'super_admin'",
    },
  );
}

function businessMembersCollectionSpec(): CollectionSpec {
  return baseCollection(
    "business_members",
    [
      businessRelation(),
      requiredRelationField("user", POCKETBASE_USER_COLLECTION),
      selectField("role", BUSINESS_ROLES, { required: true }),
      jsonField("permissions"),
      selectField("status", ["invited", "active", "suspended"], { required: true }),
      relationField("invited_by", POCKETBASE_USER_COLLECTION),
      dateField("joined_at"),
    ],
    [
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_business_members_business_user ON business_members (business, user)",
      "CREATE INDEX IF NOT EXISTS idx_business_members_user ON business_members (user)",
      "CREATE INDEX IF NOT EXISTS idx_business_members_status ON business_members (status)",
    ],
    {
      listRule: "@request.auth.id != '' && (user = @request.auth.id || business.owner = @request.auth.id || @request.auth.role = 'support_admin' || @request.auth.role = 'super_admin')",
      viewRule: "@request.auth.id != '' && (user = @request.auth.id || business.owner = @request.auth.id || @request.auth.role = 'support_admin' || @request.auth.role = 'super_admin')",
      createRule: "@request.auth.id != '' && (business.owner = @request.auth.id || @request.auth.role = 'super_admin')",
      updateRule: "@request.auth.id != '' && (business.owner = @request.auth.id || @request.auth.role = 'super_admin')",
      deleteRule: "@request.auth.id != '' && (business.owner = @request.auth.id || @request.auth.role = 'super_admin')",
    },
  );
}

function businessInvitesCollectionSpec(): CollectionSpec {
  return baseCollection(
    "business_invites",
    [
      businessRelation(),
      emailField("email", { required: true }),
      selectField("role", BUSINESS_ROLES, { required: true }),
      textField("token_hash", { required: true }),
      relationField("invited_by", POCKETBASE_USER_COLLECTION),
      dateField("expires_at"),
      dateField("accepted_at"),
      selectField("status", ["pending", "accepted", "expired", "cancelled"], { required: true }),
    ],
    [
      "CREATE INDEX IF NOT EXISTS idx_business_invites_business ON business_invites (business)",
      "CREATE INDEX IF NOT EXISTS idx_business_invites_email ON business_invites (email)",
      "CREATE INDEX IF NOT EXISTS idx_business_invites_status ON business_invites (status)",
    ],
  );
}

function chartOfAccountsCollectionSpec(): CollectionSpec {
  return baseCollection(
    "chart_of_accounts",
    [
      businessRelation(),
      textField("code", { required: true, presentable: true }),
      textField("name", { required: true, presentable: true }),
      selectField("account_type", ["asset", "liability", "equity", "revenue", "expense"], { required: true }),
      textField("account_subtype"),
      relationField("parent_account", "chart_of_accounts"),
      selectField("normal_balance", ["debit", "credit"], { required: true }),
      boolField("is_system_account"),
      boolField("is_active"),
      textField("description"),
    ],
    [
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_chart_of_accounts_business_code ON chart_of_accounts (business, code)",
      "CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_type ON chart_of_accounts (account_type)",
    ],
  );
}

function financialAccountsCollectionSpec(): CollectionSpec {
  return baseCollection(
    "financial_accounts",
    [
      businessRelation(),
      textField("name", { required: true, presentable: true }),
      selectField("account_type", ["bank", "cash", "mobile_money", "pos", "card", "savings", "investment"], { required: true }),
      textField("institution_name"),
      textField("account_number_masked"),
      selectField("currency", CURRENCIES),
      relationField("ledger_account", "chart_of_accounts"),
      numberField("opening_balance_minor"),
      numberField("current_balance_minor"),
      numberField("available_balance_minor"),
      boolField("is_connected"),
      boolField("is_active"),
    ],
    [
      "CREATE INDEX IF NOT EXISTS idx_financial_accounts_business ON financial_accounts (business)",
      "CREATE INDEX IF NOT EXISTS idx_financial_accounts_type ON financial_accounts (account_type)",
    ],
  );
}

function bankConnectionsCollectionSpec(): CollectionSpec {
  return baseCollection(
    "bank_connections",
    [
      businessRelation(),
      relationField("financial_account", "financial_accounts"),
      selectField("provider", ["mono", "manual", "other"], { required: true }),
      textField("provider_account_id"),
      textField("institution_code"),
      selectField("connection_status", ["pending", "connected", "expired", "failed", "disconnected"]),
      dateField("consent_expires_at"),
      dateField("last_synced_at"),
      textField("sync_cursor"),
      jsonField("metadata"),
    ],
    [
      "CREATE INDEX IF NOT EXISTS idx_bank_connections_business ON bank_connections (business)",
      "CREATE INDEX IF NOT EXISTS idx_bank_connections_status ON bank_connections (connection_status)",
    ],
  );
}

function bankSyncRunsCollectionSpec(): CollectionSpec {
  return baseCollection(
    "bank_sync_runs",
    [
      requiredRelationField("bank_connection", "bank_connections"),
      dateField("started_at"),
      dateField("completed_at"),
      selectField("status", ["running", "completed", "failed"], { required: true }),
      numberField("transactions_found"),
      numberField("transactions_created"),
      textField("error_message"),
      jsonField("provider_response"),
    ],
    [
      "CREATE INDEX IF NOT EXISTS idx_bank_sync_runs_connection ON bank_sync_runs (bank_connection)",
      "CREATE INDEX IF NOT EXISTS idx_bank_sync_runs_status ON bank_sync_runs (status)",
    ],
  );
}

function transactionsCollectionSpec(): CollectionSpec {
  return baseCollection(
    "transactions",
    [
      businessRelation(),
      relationField("financial_account", "financial_accounts"),
      textField("external_id"),
      dateField("transaction_date"),
      dateField("value_date"),
      textField("description", { required: true, presentable: true }),
      textField("merchant_name"),
      numberField("amount_minor", { required: true }),
      selectField("direction", ["credit", "debit"], { required: true }),
      selectField("currency", CURRENCIES),
      selectField("source", ["bank", "manual", "pos", "inventory", "invoice", "expense"], { required: true }),
      selectField("status", ["pending", "posted", "categorized", "reconciled", "ignored"], { required: true }),
      relationField("suggested_account", "chart_of_accounts"),
      relationField("confirmed_account", "chart_of_accounts"),
      numberField("categorization_confidence"),
      relationField("journal_entry", "journal_entries"),
      jsonField("raw_data"),
      dateField("imported_at"),
    ],
    [
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_business_source_external ON transactions (business, source, external_id)",
      "CREATE INDEX IF NOT EXISTS idx_transactions_business_date ON transactions (business, transaction_date)",
      "CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions (status)",
    ],
  );
}

function journalEntriesCollectionSpec(): CollectionSpec {
  return baseCollection(
    "journal_entries",
    [
      businessRelation(),
      textField("entry_number", { required: true, presentable: true }),
      dateField("entry_date", { required: true }),
      textField("reference"),
      textField("memo"),
      selectField("source_type", ["manual", "bank", "invoice", "expense", "bill", "ai", "opening_balance", "adjustment"], { required: true }),
      textField("source_record_id"),
      selectField("status", ["draft", "pending_approval", "posted", "reversed", "void"], { required: true }),
      selectField("currency", CURRENCIES),
      numberField("total_debit_minor"),
      numberField("total_credit_minor"),
      relationField("created_by", POCKETBASE_USER_COLLECTION),
      relationField("approved_by", POCKETBASE_USER_COLLECTION),
      relationField("posted_by", POCKETBASE_USER_COLLECTION),
      dateField("posted_at"),
      relationField("reversal_of", "journal_entries"),
      textField("idempotency_key"),
    ],
    [
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_business_number ON journal_entries (business, entry_number)",
      "CREATE INDEX IF NOT EXISTS idx_journal_entries_business_date ON journal_entries (business, entry_date)",
      "CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries (status)",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_idempotency ON journal_entries (idempotency_key)",
    ],
    {
      createRule: "@request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
      updateRule: "@request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
      deleteRule: "@request.auth.role = 'super_admin'",
    },
  );
}

function contactsCollectionSpec(): CollectionSpec {
  return baseCollection(
    "contacts",
    [
      businessRelation(),
      selectField("contact_type", ["customer", "vendor", "both"], { required: true }),
      textField("name", { required: true, presentable: true }),
      textField("company_name"),
      emailField("email"),
      textField("phone"),
      textField("address"),
      textField("tax_id"),
      relationField("receivable_account", "chart_of_accounts"),
      relationField("payable_account", "chart_of_accounts"),
      numberField("opening_balance_minor"),
      boolField("is_active"),
    ],
    [
      "CREATE INDEX IF NOT EXISTS idx_contacts_business ON contacts (business)",
      "CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts (contact_type)",
    ],
  );
}

function taxCodesCollectionSpec(): CollectionSpec {
  return baseCollection(
    "tax_codes",
    [
      relationField("business", "businesses"),
      textField("name", { required: true, presentable: true }),
      textField("code", { required: true }),
      selectField("tax_type", ["vat", "wht", "cit", "payroll", "other"], { required: true }),
      numberField("rate_basis_points"),
      relationField("sales_tax_account", "chart_of_accounts"),
      relationField("purchase_tax_account", "chart_of_accounts"),
      boolField("recoverable"),
      boolField("is_active"),
    ],
    [
      "CREATE INDEX IF NOT EXISTS idx_tax_codes_business ON tax_codes (business)",
      "CREATE INDEX IF NOT EXISTS idx_tax_codes_code ON tax_codes (code)",
    ],
  );
}

function productsServicesCollectionSpec(): CollectionSpec {
  return baseCollection(
    "products_services",
    [
      businessRelation(),
      textField("name", { required: true, presentable: true }),
      textField("sku"),
      selectField("item_type", ["product", "service"], { required: true }),
      textField("description"),
      numberField("selling_price_minor"),
      numberField("cost_price_minor"),
      relationField("income_account", "chart_of_accounts"),
      relationField("expense_account", "chart_of_accounts"),
      relationField("tax_code", "tax_codes"),
      boolField("track_inventory"),
      numberField("quantity_on_hand"),
      boolField("is_active"),
    ],
    [
      "CREATE INDEX IF NOT EXISTS idx_products_services_business ON products_services (business)",
      "CREATE INDEX IF NOT EXISTS idx_products_services_sku ON products_services (business, sku)",
    ],
  );
}

function invoicesCollectionSpec(): CollectionSpec {
  return baseCollection(
    "invoices",
    [
      businessRelation(),
      relationField("customer", "contacts"),
      textField("invoice_number", { required: true, presentable: true }),
      dateField("issue_date"),
      dateField("due_date"),
      selectField("status", ["draft", "sent", "partially_paid", "paid", "overdue", "void"], { required: true }),
      selectField("currency", CURRENCIES),
      numberField("subtotal_minor"),
      numberField("discount_minor"),
      numberField("tax_minor"),
      numberField("total_minor"),
      numberField("amount_paid_minor"),
      numberField("balance_due_minor"),
      textField("notes"),
      textField("terms"),
      fileField("pdf_file"),
      relationField("journal_entry", "journal_entries"),
      relationField("created_by", POCKETBASE_USER_COLLECTION),
    ],
    [
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_business_number ON invoices (business, invoice_number)",
      "CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices (customer)",
      "CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status)",
    ],
  );
}

function invoiceItemsCollectionSpec(): CollectionSpec {
  return baseCollection(
    "invoice_items",
    [
      requiredRelationField("invoice", "invoices"),
      relationField("product_service", "products_services"),
      textField("description"),
      numberField("quantity"),
      numberField("unit_price_minor"),
      numberField("discount_minor"),
      numberField("tax_rate_basis_points"),
      numberField("tax_minor"),
      numberField("line_total_minor"),
      relationField("income_account", "chart_of_accounts"),
    ],
    ["CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items (invoice)"],
  );
}

function billsCollectionSpec(): CollectionSpec {
  return baseCollection(
    "bills",
    [
      businessRelation(),
      relationField("vendor", "contacts"),
      textField("bill_number", { presentable: true }),
      dateField("bill_date"),
      dateField("due_date"),
      selectField("status", ["draft", "approved", "partially_paid", "paid", "overdue", "void"]),
      numberField("subtotal_minor"),
      numberField("tax_minor"),
      numberField("total_minor"),
      numberField("amount_paid_minor"),
      numberField("balance_due_minor"),
      fileField("attachment"),
      relationField("journal_entry", "journal_entries"),
    ],
    [
      "CREATE INDEX IF NOT EXISTS idx_bills_business ON bills (business)",
      "CREATE INDEX IF NOT EXISTS idx_bills_vendor ON bills (vendor)",
      "CREATE INDEX IF NOT EXISTS idx_bills_status ON bills (status)",
    ],
  );
}

function paymentsCollectionSpec(): CollectionSpec {
  return baseCollection(
    "payments",
    [
      businessRelation(),
      relationField("invoice", "invoices"),
      relationField("bill", "bills"),
      relationField("contact", "contacts"),
      relationField("transaction", "transactions"),
      relationField("financial_account", "financial_accounts"),
      dateField("payment_date"),
      numberField("amount_minor"),
      selectField("payment_method", ["cash", "bank_transfer", "card", "pos", "mobile_money", "other"]),
      textField("reference"),
      selectField("status", ["pending", "completed", "failed", "reversed"]),
      relationField("journal_entry", "journal_entries"),
    ],
    [
      "CREATE INDEX IF NOT EXISTS idx_payments_business ON payments (business)",
      "CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments (invoice)",
      "CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments (bill)",
    ],
  );
}

function expensesCollectionSpec(): CollectionSpec {
  return baseCollection(
    "expenses",
    [
      businessRelation(),
      relationField("vendor", "contacts"),
      dateField("expense_date"),
      textField("description", { required: true, presentable: true }),
      numberField("amount_minor", { required: true }),
      numberField("tax_minor"),
      relationField("expense_account", "chart_of_accounts"),
      relationField("payment_account", "financial_accounts"),
      fileField("receipt"),
      selectField("status", ["draft", "approved", "posted", "rejected"], { required: true }),
      relationField("created_by", POCKETBASE_USER_COLLECTION),
      relationField("approved_by", POCKETBASE_USER_COLLECTION),
      relationField("journal_entry", "journal_entries"),
    ],
    [
      "CREATE INDEX IF NOT EXISTS idx_expenses_business ON expenses (business)",
      "CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses (status)",
    ],
  );
}

function attachmentsCollectionSpec(): CollectionSpec {
  return baseCollection(
    "attachments",
    [
      businessRelation(),
      relationField("uploaded_by", POCKETBASE_USER_COLLECTION),
      fileField("file", { required: true, protected: true }),
      selectField("document_type", ["receipt", "invoice", "bank_statement", "tax_document", "contract", "other"]),
      relationField("transaction", "transactions"),
      relationField("journal_entry", "journal_entries"),
      relationField("invoice", "invoices"),
      relationField("bill", "bills"),
      selectField("ocr_status", ["pending", "processing", "completed", "failed"]),
      jsonField("extracted_data"),
      textField("processing_error"),
    ],
    [
      "CREATE INDEX IF NOT EXISTS idx_attachments_business ON attachments (business)",
      "CREATE INDEX IF NOT EXISTS idx_attachments_document_type ON attachments (document_type)",
    ],
  );
}

function aiThreadsCollectionSpec(): CollectionSpec {
  return baseCollection(
    "ai_threads",
    [
      businessRelation(),
      requiredRelationField("user", POCKETBASE_USER_COLLECTION),
      textField("title", { required: true, presentable: true }),
      selectField("context_type", ["general", "accounting", "tax", "invoice", "forecast", "report"], { required: true }),
      boolField("is_archived"),
      dateField("last_message_at"),
    ],
    [
      "CREATE INDEX IF NOT EXISTS idx_ai_threads_business ON ai_threads (business)",
      "CREATE INDEX IF NOT EXISTS idx_ai_threads_user ON ai_threads (user)",
    ],
  );
}

function aiMessagesCollectionSpec(): CollectionSpec {
  return baseCollection(
    "ai_messages",
    [
      requiredRelationField("thread", "ai_threads"),
      businessRelation(),
      relationField("user", POCKETBASE_USER_COLLECTION),
      selectField("sender_type", ["user", "assistant", "system", "tool"], { required: true }),
      editorField("content", { required: true }),
      jsonField("structured_content"),
      selectField("status", ["processing", "completed", "failed"], { required: true }),
      textField("model_name"),
      numberField("prompt_tokens"),
      numberField("completion_tokens"),
      textField("error_message"),
    ],
    [
      "CREATE INDEX IF NOT EXISTS idx_ai_messages_thread ON ai_messages (thread)",
      "CREATE INDEX IF NOT EXISTS idx_ai_messages_business ON ai_messages (business)",
    ],
  );
}

function aiActionsCollectionSpec(): CollectionSpec {
  return baseCollection(
    "ai_actions",
    [
      businessRelation(),
      relationField("thread", "ai_threads"),
      relationField("message", "ai_messages"),
      relationField("requested_by", POCKETBASE_USER_COLLECTION),
      selectField("action_type", ["create_transaction", "create_journal_entry", "create_invoice", "categorize_transaction", "prepare_report", "calculate_tax", "create_budget"], { required: true }),
      jsonField("payload"),
      selectField("status", ["proposed", "awaiting_approval", "approved", "executing", "completed", "failed", "cancelled"], { required: true }),
      relationField("approved_by", POCKETBASE_USER_COLLECTION),
      dateField("approved_at"),
      textField("result_collection"),
      textField("result_record_id"),
      textField("error_message"),
      textField("idempotency_key"),
    ],
    [
      "CREATE INDEX IF NOT EXISTS idx_ai_actions_business ON ai_actions (business)",
      "CREATE INDEX IF NOT EXISTS idx_ai_actions_status ON ai_actions (status)",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_actions_idempotency ON ai_actions (idempotency_key)",
    ],
  );
}

function journalLinesCollectionSpec(): CollectionSpec {
  return baseCollection(
    "journal_lines",
    [
      businessRelation(),
      requiredRelationField("journal_entry", "journal_entries"),
      requiredRelationField("account", "chart_of_accounts"),
      textField("description"),
      numberField("debit_minor"),
      numberField("credit_minor"),
      relationField("contact", "contacts"),
      relationField("transaction", "transactions"),
      relationField("tax_code", "tax_codes"),
      relationField("invoice", "invoices"),
      relationField("bill", "bills"),
    ],
    [
      "CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines (journal_entry)",
      "CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines (account)",
      "CREATE INDEX IF NOT EXISTS idx_journal_lines_business ON journal_lines (business)",
    ],
    {
      createRule: "@request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
      updateRule: "@request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
      deleteRule: "@request.auth.role = 'super_admin'",
    },
  );
}

function auditLogsCollectionSpec(): CollectionSpec {
  return baseCollection(
    "audit_logs",
    [
      relationField("business", "businesses"),
      relationField("user", POCKETBASE_USER_COLLECTION),
      textField("action", { required: true }),
      textField("entity_collection", { required: true }),
      textField("entity_record_id", { required: true }),
      jsonField("old_values"),
      jsonField("new_values"),
      textField("ip_address"),
      textField("user_agent"),
      dateField("created_at"),
    ],
    [
      "CREATE INDEX IF NOT EXISTS idx_audit_logs_business ON audit_logs (business)",
      "CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user)",
      "CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_collection, entity_record_id)",
    ],
    {
      listRule: "@request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
      viewRule: "@request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.role = 'super_admin'",
      deleteRule: "@request.auth.role = 'super_admin'",
    },
  );
}

function supportTicketsCollectionSpec(): CollectionSpec {
  return baseCollection(
    "support_tickets",
    [
      relationField("business", "businesses"),
      relationField("created_by", POCKETBASE_USER_COLLECTION),
      relationField("assigned_to", POCKETBASE_USER_COLLECTION),
      textField("subject", { required: true, presentable: true }),
      selectField("category", ["account", "billing", "banking", "accounting", "tax", "technical", "other"]),
      selectField("priority", ["low", "medium", "high", "urgent"]),
      selectField("status", ["open", "in_progress", "waiting", "resolved", "closed"], { required: true }),
      dateField("resolved_at"),
    ],
    [
      "CREATE INDEX IF NOT EXISTS idx_support_tickets_business ON support_tickets (business)",
      "CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets (status)",
      "CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by ON support_tickets (created_by)",
    ],
  );
}

function supportMessagesCollectionSpec(): CollectionSpec {
  return baseCollection(
    "support_messages",
    [
      requiredRelationField("ticket", "support_tickets"),
      relationField("sender", POCKETBASE_USER_COLLECTION),
      editorField("message", { required: true }),
      fileField("attachments", { maxSelect: 10 }),
      boolField("is_internal"),
    ],
    ["CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages (ticket)"],
  );
}

function baceBackendCollectionSpecs(): CollectionSpec[] {
  return [
    businessesCollectionSpec(),
    businessMembersCollectionSpec(),
    businessInvitesCollectionSpec(),
    chartOfAccountsCollectionSpec(),
    financialAccountsCollectionSpec(),
    bankConnectionsCollectionSpec(),
    bankSyncRunsCollectionSpec(),
    journalEntriesCollectionSpec(),
    contactsCollectionSpec(),
    taxCodesCollectionSpec(),
    productsServicesCollectionSpec(),
    invoicesCollectionSpec(),
    invoiceItemsCollectionSpec(),
    billsCollectionSpec(),
    transactionsCollectionSpec(),
    paymentsCollectionSpec(),
    expensesCollectionSpec(),
    attachmentsCollectionSpec(),
    aiThreadsCollectionSpec(),
    aiMessagesCollectionSpec(),
    aiActionsCollectionSpec(),
    journalLinesCollectionSpec(),
    auditLogsCollectionSpec(),
    supportTicketsCollectionSpec(),
    supportMessagesCollectionSpec(),
  ];
}

function financialViewCollectionSpecs(): CollectionSpec[] {
  return [
    viewCollection(
      "v_trial_balance",
      `
      SELECT
        MIN(jl.id) AS id,
        jl.business,
        jl.account,
        coa.code AS account_code,
        coa.name AS account_name,
        coa.account_type,
        COALESCE(SUM(jl.debit_minor), 0) AS total_debit_minor,
        COALESCE(SUM(jl.credit_minor), 0) AS total_credit_minor,
        COALESCE(SUM(jl.debit_minor), 0) - COALESCE(SUM(jl.credit_minor), 0) AS balance_minor
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry
      JOIN chart_of_accounts coa ON coa.id = jl.account
      WHERE je.status = 'posted'
      GROUP BY jl.business, jl.account
      `,
      [
        "id",
        "business",
        "account",
        "account_code",
        "account_name",
        "account_type",
        "total_debit_minor",
        "total_credit_minor",
        "balance_minor",
      ],
    ),
    viewCollection(
      "v_profit_and_loss",
      `
      SELECT
        MIN(jl.id) AS id,
        jl.business,
        coa.account_type,
        jl.account,
        coa.code AS account_code,
        coa.name AS account_name,
        COALESCE(SUM(jl.credit_minor), 0) AS credit_minor,
        COALESCE(SUM(jl.debit_minor), 0) AS debit_minor,
        CASE
          WHEN coa.account_type = 'revenue' THEN COALESCE(SUM(jl.credit_minor), 0) - COALESCE(SUM(jl.debit_minor), 0)
          ELSE COALESCE(SUM(jl.debit_minor), 0) - COALESCE(SUM(jl.credit_minor), 0)
        END AS amount_minor
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry
      JOIN chart_of_accounts coa ON coa.id = jl.account
      WHERE je.status = 'posted'
        AND coa.account_type IN ('revenue', 'expense')
      GROUP BY jl.business, coa.account_type, jl.account
      `,
      [
        "id",
        "business",
        "account_type",
        "account",
        "account_code",
        "account_name",
        "credit_minor",
        "debit_minor",
        "amount_minor",
      ],
    ),
    viewCollection(
      "v_balance_sheet",
      `
      SELECT
        MIN(jl.id) AS id,
        jl.business,
        coa.account_type,
        jl.account,
        coa.code AS account_code,
        coa.name AS account_name,
        CASE
          WHEN coa.account_type = 'asset' THEN COALESCE(SUM(jl.debit_minor), 0) - COALESCE(SUM(jl.credit_minor), 0)
          ELSE COALESCE(SUM(jl.credit_minor), 0) - COALESCE(SUM(jl.debit_minor), 0)
        END AS balance_minor
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry
      JOIN chart_of_accounts coa ON coa.id = jl.account
      WHERE je.status = 'posted'
        AND coa.account_type IN ('asset', 'liability', 'equity')
      GROUP BY jl.business, coa.account_type, jl.account
      `,
      [
        "id",
        "business",
        "account_type",
        "account",
        "account_code",
        "account_name",
        "balance_minor",
      ],
    ),
    viewCollection(
      "v_cash_flow",
      `
      SELECT
        MIN(id) AS id,
        business,
        substr(transaction_date, 1, 7) AS period,
        direction,
        COALESCE(SUM(amount_minor), 0) AS amount_minor,
        COUNT(*) AS transaction_count
      FROM transactions
      WHERE status IN ('posted', 'categorized', 'reconciled')
        AND transaction_date != ''
      GROUP BY business, substr(transaction_date, 1, 7), direction
      `,
      ["id", "business", "period", "direction", "amount_minor", "transaction_count"],
    ),
    viewCollection(
      "v_general_ledger",
      `
      SELECT
        jl.id,
        jl.business,
        je.entry_number,
        je.entry_date,
        je.reference,
        je.memo,
        jl.account,
        coa.code AS account_code,
        coa.name AS account_name,
        jl.description,
        jl.debit_minor,
        jl.credit_minor,
        jl."transaction" AS transaction_record,
        jl.invoice,
        jl.bill
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry
      JOIN chart_of_accounts coa ON coa.id = jl.account
      WHERE je.status = 'posted'
      `,
      [
        "id",
        "business",
        "entry_number",
        "entry_date",
        "reference",
        "memo",
        "account",
        "account_code",
        "account_name",
        "description",
        "debit_minor",
        "credit_minor",
        "transaction_record",
        "invoice",
        "bill",
      ],
    ),
    viewCollection(
      "v_account_balances",
      `
      SELECT
        MIN(jl.id) AS id,
        jl.business,
        jl.account,
        coa.code AS account_code,
        coa.name AS account_name,
        coa.account_type,
        coa.normal_balance,
        COALESCE(SUM(jl.debit_minor), 0) AS debit_minor,
        COALESCE(SUM(jl.credit_minor), 0) AS credit_minor,
        CASE
          WHEN coa.normal_balance = 'debit' THEN COALESCE(SUM(jl.debit_minor), 0) - COALESCE(SUM(jl.credit_minor), 0)
          ELSE COALESCE(SUM(jl.credit_minor), 0) - COALESCE(SUM(jl.debit_minor), 0)
        END AS balance_minor
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry
      JOIN chart_of_accounts coa ON coa.id = jl.account
      WHERE je.status = 'posted'
      GROUP BY jl.business, jl.account
      `,
      [
        "id",
        "business",
        "account",
        "account_code",
        "account_name",
        "account_type",
        "normal_balance",
        "debit_minor",
        "credit_minor",
        "balance_minor",
      ],
    ),
    viewCollection(
      "v_monthly_revenue",
      `
      SELECT
        MIN(jl.id) AS id,
        jl.business,
        substr(je.entry_date, 1, 7) AS period,
        COALESCE(SUM(jl.credit_minor), 0) - COALESCE(SUM(jl.debit_minor), 0) AS revenue_minor
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry
      JOIN chart_of_accounts coa ON coa.id = jl.account
      WHERE je.status = 'posted'
        AND coa.account_type = 'revenue'
        AND je.entry_date != ''
      GROUP BY jl.business, substr(je.entry_date, 1, 7)
      `,
      ["id", "business", "period", "revenue_minor"],
    ),
    viewCollection(
      "v_expense_breakdown",
      `
      SELECT
        MIN(jl.id) AS id,
        jl.business,
        jl.account,
        coa.code AS account_code,
        coa.name AS account_name,
        COALESCE(SUM(jl.debit_minor), 0) - COALESCE(SUM(jl.credit_minor), 0) AS expense_minor
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry
      JOIN chart_of_accounts coa ON coa.id = jl.account
      WHERE je.status = 'posted'
        AND coa.account_type = 'expense'
      GROUP BY jl.business, jl.account
      `,
      ["id", "business", "account", "account_code", "account_name", "expense_minor"],
    ),
    viewCollection(
      "v_aged_receivables",
      `
      SELECT
        id,
        business,
        customer,
        invoice_number,
        issue_date,
        due_date,
        status,
        total_minor,
        amount_paid_minor,
        balance_due_minor,
        CAST(julianday('now') - julianday(NULLIF(due_date, '')) AS INTEGER) AS days_overdue
      FROM invoices
      WHERE status NOT IN ('paid', 'void')
        AND balance_due_minor > 0
      `,
      [
        "id",
        "business",
        "customer",
        "invoice_number",
        "issue_date",
        "due_date",
        "status",
        "total_minor",
        "amount_paid_minor",
        "balance_due_minor",
        "days_overdue",
      ],
    ),
    viewCollection(
      "v_aged_payables",
      `
      SELECT
        id,
        business,
        vendor,
        bill_number,
        bill_date,
        due_date,
        status,
        total_minor,
        amount_paid_minor,
        balance_due_minor,
        CAST(julianday('now') - julianday(NULLIF(due_date, '')) AS INTEGER) AS days_overdue
      FROM bills
      WHERE status NOT IN ('paid', 'void')
        AND balance_due_minor > 0
      `,
      [
        "id",
        "business",
        "vendor",
        "bill_number",
        "bill_date",
        "due_date",
        "status",
        "total_minor",
        "amount_paid_minor",
        "balance_due_minor",
        "days_overdue",
      ],
    ),
    viewCollection(
      "v_tax_summary",
      `
      SELECT
        MIN(jl.id) AS id,
        jl.business,
        jl.tax_code,
        tc.code AS tax_code_text,
        tc.name AS tax_name,
        tc.tax_type,
        COALESCE(SUM(jl.debit_minor), 0) AS debit_minor,
        COALESCE(SUM(jl.credit_minor), 0) AS credit_minor,
        COALESCE(SUM(jl.credit_minor), 0) - COALESCE(SUM(jl.debit_minor), 0) AS net_tax_minor
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry
      JOIN tax_codes tc ON tc.id = jl.tax_code
      WHERE je.status = 'posted'
        AND jl.tax_code != ''
      GROUP BY jl.business, jl.tax_code
      `,
      [
        "id",
        "business",
        "tax_code",
        "tax_code_text",
        "tax_name",
        "tax_type",
        "debit_minor",
        "credit_minor",
        "net_tax_minor",
      ],
    ),
    viewCollection(
      "v_dashboard_metrics",
      `
      SELECT
        businesses.id AS id,
        businesses.id AS business,
        COALESCE(revenue.revenue_minor, 0) AS revenue_minor,
        COALESCE(expenses.expense_minor, 0) AS expense_minor,
        COALESCE(revenue.revenue_minor, 0) - COALESCE(expenses.expense_minor, 0) AS net_income_minor,
        COALESCE(receivables.receivable_minor, 0) AS receivable_minor,
        COALESCE(payables.payable_minor, 0) AS payable_minor,
        COALESCE(bank.cash_minor, 0) AS cash_minor
      FROM businesses
      LEFT JOIN (
        SELECT jl.business, COALESCE(SUM(jl.credit_minor), 0) - COALESCE(SUM(jl.debit_minor), 0) AS revenue_minor
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.journal_entry
        JOIN chart_of_accounts coa ON coa.id = jl.account
        WHERE je.status = 'posted' AND coa.account_type = 'revenue'
        GROUP BY jl.business
      ) revenue ON revenue.business = businesses.id
      LEFT JOIN (
        SELECT jl.business, COALESCE(SUM(jl.debit_minor), 0) - COALESCE(SUM(jl.credit_minor), 0) AS expense_minor
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.journal_entry
        JOIN chart_of_accounts coa ON coa.id = jl.account
        WHERE je.status = 'posted' AND coa.account_type = 'expense'
        GROUP BY jl.business
      ) expenses ON expenses.business = businesses.id
      LEFT JOIN (
        SELECT business, COALESCE(SUM(balance_due_minor), 0) AS receivable_minor
        FROM invoices
        WHERE status NOT IN ('paid', 'void')
        GROUP BY business
      ) receivables ON receivables.business = businesses.id
      LEFT JOIN (
        SELECT business, COALESCE(SUM(balance_due_minor), 0) AS payable_minor
        FROM bills
        WHERE status NOT IN ('paid', 'void')
        GROUP BY business
      ) payables ON payables.business = businesses.id
      LEFT JOIN (
        SELECT business, COALESCE(SUM(current_balance_minor), 0) AS cash_minor
        FROM financial_accounts
        WHERE is_active = TRUE
        GROUP BY business
      ) bank ON bank.business = businesses.id
      `,
      [
        "id",
        "business",
        "revenue_minor",
        "expense_minor",
        "net_income_minor",
        "receivable_minor",
        "payable_minor",
        "cash_minor",
      ],
    ),
  ];
}

async function ensureCollection(pb: PocketBase, spec: CollectionSpec): Promise<void> {
  const existing = await findCollectionByName(pb, spec.name);

  if (!existing) {
    const fields = await resolveFields(
      pb,
      spec.fields.filter(
        (field) => !(field.type === "relation" && field.collectionId === spec.name),
      ),
    );
    const createPayload: Record<string, unknown> = {
      name: spec.name,
      type: spec.type,
      fields,
      indexes: spec.indexes || [],
      listRule: spec.listRule,
      viewRule: spec.viewRule,
      createRule: spec.createRule,
      updateRule: spec.updateRule,
      deleteRule: spec.deleteRule,
    };

    if (spec.type === "view") {
      createPayload.viewQuery = spec.viewQuery;
    }

    if (spec.type === "auth") {
      createPayload.authRule = spec.authRule;
      createPayload.manageRule = spec.manageRule;
    }

    try {
      await pb.collections.create(createPayload);
    } catch (error) {
      console.error(`[pb:init] failed to create collection "${spec.name}"`, JSON.stringify(error, null, 2));
      throw error;
    }
    console.log(`[pb:init] created collection "${spec.name}"`);
    return;
  }

  const fields = await resolveFields(pb, spec.fields);
  const patch: Record<string, unknown> = {
    name: spec.name,
    fields,
    indexes: spec.indexes || [],
    listRule: spec.listRule,
    viewRule: spec.viewRule,
    createRule: spec.createRule,
    updateRule: spec.updateRule,
    deleteRule: spec.deleteRule,
  };

  if (spec.type === "view") {
    patch.viewQuery = spec.viewQuery;
  }

  if (spec.type === "auth") {
    patch.authRule = spec.authRule;
    patch.manageRule = spec.manageRule;
  }

  try {
    await pb.collections.update(existing.id, patch);
  } catch (error) {
    console.error(`[pb:init] failed to update collection "${spec.name}"`, JSON.stringify(error, null, 2));
    throw error;
  }
  console.log(`[pb:init] updated rules/indexes for "${spec.name}"`);
}

async function ensureDefaultSuperAdmin(pb: PocketBase): Promise<void> {
  const defaultAdminEmail = process.env.POCKETBASE_DEFAULT_ADMIN_EMAIL;
  const defaultAdminPassword = process.env.POCKETBASE_DEFAULT_ADMIN_PASSWORD;
  const defaultAdminName = process.env.POCKETBASE_DEFAULT_ADMIN_NAME || "Platform Admin";
  if (!defaultAdminEmail || !defaultAdminPassword) {
    console.log("[pb:init] skipping default admin seed (POCKETBASE_DEFAULT_ADMIN_EMAIL/PASSWORD not set)");
    return;
  }

  let existing: ({ id: string } & Record<string, unknown>) | null = null;
  try {
    existing = await pb
      .collection(POCKETBASE_USER_COLLECTION)
      .getFirstListItem(`email="${defaultAdminEmail.replace(/"/g, '\\"')}"`);
  } catch {
    existing = null;
  }

  if (existing) {
    await pb.collection(POCKETBASE_USER_COLLECTION).update(existing.id, {
      password: defaultAdminPassword,
      passwordConfirm: defaultAdminPassword,
      role: "super_admin",
      status: "active",
      name: defaultAdminName,
      sessionVersion:
        typeof existing.sessionVersion === "number" && existing.sessionVersion > 0
          ? existing.sessionVersion
          : 1,
    });
    console.log(`[pb:init] updated default admin user "${defaultAdminEmail}"`);
    return;
  }

  await pb.collection(POCKETBASE_USER_COLLECTION).create({
    email: defaultAdminEmail,
    password: defaultAdminPassword,
    passwordConfirm: defaultAdminPassword,
    name: defaultAdminName,
    role: "super_admin",
    status: "active",
    sessionVersion: 1,
    verified: true,
  });
  console.log(`[pb:init] created default admin user "${defaultAdminEmail}"`);
}

async function main() {
  const pocketBaseUrl = getPocketBaseUrl();
  const pb = new PocketBase(pocketBaseUrl);
  await pb.collection("_superusers").authWithPassword(
    getPocketBaseSuperuserEmail(),
    getPocketBaseSuperuserPassword(),
  );

	await ensureCollection(pb, usersCollectionSpec());
	for (const spec of baceBackendCollectionSpecs()) {
	  await ensureCollection(pb, spec);
	}
  for (const spec of financialViewCollectionSpecs()) {
    await ensureCollection(pb, spec);
  }
	await ensureCollection(pb, complaintsCollectionSpec());
	await ensureCollection(pb, complaintMessagesCollectionSpec());
	await ensureCollection(pb, usageEventsCollectionSpec());
  await ensureCollection(pb, adminAuditCollectionSpec());
  await ensureDefaultSuperAdmin(pb);

  if (shouldAutoRepairLocalTimestamps(pocketBaseUrl)) {
    console.log("[pb:init] repairing local PocketBase timestamps");
    runLocalTimestampRepair();
  }

  console.log("[pb:init] complete");
}

main().catch((error) => {
  console.error("[pb:init] failed:", error);
  process.exit(1);
});
