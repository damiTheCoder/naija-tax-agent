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

type CollectionSpec = {
  name: string;
  type: "auth" | "base";
  fields: Array<Record<string, unknown>>;
  indexes?: string[];
  listRule?: string | null;
  viewRule?: string | null;
  createRule?: string | null;
  updateRule?: string | null;
  deleteRule?: string | null;
  authRule?: string | null;
  manageRule?: string | null;
};

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
        const collection = await pb.collections.getFirstListItem(
          `name="${target.replace(/"/g, '\\"')}"`,
          { requestKey: null },
        );
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
      {
        name: "role",
        type: "select",
        required: true,
        presentable: true,
        maxSelect: 1,
        values: ["user", "read_only", "support_agent", "support_admin", "super_admin"],
      },
      {
        name: "status",
        type: "select",
        required: true,
        presentable: true,
        maxSelect: 1,
        values: ["active", "suspended", "disabled"],
      },
      {
        name: "organization",
        type: "text",
      },
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
    updateRule: "id = @request.auth.id || @request.auth.role = 'support_admin' || @request.auth.role = 'super_admin'",
    deleteRule: "@request.auth.role = 'super_admin'",
    authRule: "status = 'active'",
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
      { name: "eventType", type: "text", required: true },
      { name: "module", type: "text" },
      { name: "path", type: "text" },
      { name: "ipAddress", type: "text" },
      { name: "userAgent", type: "text" },
      { name: "metadata", type: "json" },
      ...timestampFields(),
    ],
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_usage_events_event_type ON usage_events (eventType)",
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

async function ensureCollection(pb: PocketBase, spec: CollectionSpec): Promise<void> {
  const fields = await resolveFields(pb, spec.fields);
  let existing: ({ id: string } & Record<string, unknown>) | null = null;
  try {
    existing = await pb.collections.getFirstListItem(`name="${spec.name}"`);
  } catch {
    existing = null;
  }

  if (!existing) {
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

    if (spec.type === "auth") {
      createPayload.authRule = spec.authRule;
      createPayload.manageRule = spec.manageRule;
    }

    await pb.collections.create(createPayload);
    console.log(`[pb:init] created collection "${spec.name}"`);
    return;
  }

  const patch: Record<string, unknown> = {
    fields,
    indexes: spec.indexes || [],
    listRule: spec.listRule,
    viewRule: spec.viewRule,
    createRule: spec.createRule,
    updateRule: spec.updateRule,
    deleteRule: spec.deleteRule,
  };

  if (spec.type === "auth") {
    patch.authRule = spec.authRule;
    patch.manageRule = spec.manageRule;
  }

  await pb.collections.update(existing.id, patch);
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
  const pb = new PocketBase(getPocketBaseUrl());
  await pb.collection("_superusers").authWithPassword(
    getPocketBaseSuperuserEmail(),
    getPocketBaseSuperuserPassword(),
  );

  await ensureCollection(pb, usersCollectionSpec());
  await ensureCollection(pb, complaintsCollectionSpec());
  await ensureCollection(pb, complaintMessagesCollectionSpec());
  await ensureCollection(pb, usageEventsCollectionSpec());
  await ensureCollection(pb, adminAuditCollectionSpec());
  await ensureDefaultSuperAdmin(pb);

  console.log("[pb:init] complete");
}

main().catch((error) => {
  console.error("[pb:init] failed:", error);
  process.exit(1);
});
