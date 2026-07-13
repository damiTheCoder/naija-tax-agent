import { describe, expect, it } from "vitest";
import { postJournalEntry } from "@/lib/pocketbase/accounting";
import { createBusinessWithDefaults } from "@/lib/pocketbase/businessProvisioning";
import type { AppSession } from "@/lib/pocketbase/session";

type RecordData = {
  id: string;
  [key: string]: unknown;
};

class MemoryCollection {
  constructor(
    private readonly name: string,
    private readonly db: Map<string, RecordData[]>,
  ) {}

  async create(data: Record<string, unknown>): Promise<RecordData> {
    const records = this.db.get(this.name) ?? [];
    const record = {
      id: `${this.name}_${records.length + 1}`,
      ...data,
    };
    records.push(record);
    this.db.set(this.name, records);
    return record;
  }

  async getOne(id: string): Promise<RecordData> {
    const record = (this.db.get(this.name) ?? []).find((item) => item.id === id);
    if (!record) throw new Error(`${this.name} record not found`);
    return record;
  }

  async getFirstListItem(filter: string): Promise<RecordData> {
    const record = (this.db.get(this.name) ?? []).find((item) => matchesFilter(item, filter));
    if (!record) throw new Error(`${this.name} record not found`);
    return record;
  }

  async getFullList(options?: { filter?: string }): Promise<RecordData[]> {
    const records = this.db.get(this.name) ?? [];
    if (!options?.filter) return records;
    return records.filter((item) => matchesFilter(item, options.filter || ""));
  }
}

class MemoryPocketBase {
  readonly db = new Map<string, RecordData[]>();

  collection(name: string): MemoryCollection {
    return new MemoryCollection(name, this.db);
  }
}

function matchesFilter(record: RecordData, filter: string): boolean {
  const clauses = filter
    .split("&&")
    .map((clause) => clause.trim())
    .filter(Boolean);

  return clauses.every((clause) => {
    const match = clause.match(/^([a-zA-Z0-9_]+)="([^"]*)"$/);
    if (!match) return false;
    return String(record[match[1]] ?? "") === match[2];
  });
}

function makeSession(overrides: Partial<AppSession> = {}): AppSession {
  return {
    userId: "user_1",
    email: "owner@example.com",
    name: "Owner",
    role: "user",
    status: "active",
    sessionVersion: 1,
    iat: 1,
    exp: 9999999999,
    ...overrides,
  };
}

describe("PocketBase business provisioning", () => {
  it("creates a business, owner membership, default accounts, and audit log", async () => {
    const pb = new MemoryPocketBase();
    const result = await createBusinessWithDefaults(pb as never, makeSession(), {
      legalName: "Bace Ventures Ltd",
    });

    expect(result.business.legal_name).toBe("Bace Ventures Ltd");
    expect(result.membership.role).toBe("owner");
    expect(result.membership.status).toBe("active");
    expect(result.accounts).toHaveLength(8);
    expect(pb.db.get("audit_logs")).toHaveLength(1);
    expect(pb.db.get("audit_logs")?.[0].action).toBe("business.created");
  });
});

describe("PocketBase journal posting", () => {
  it("posts a balanced journal entry and audit log", async () => {
    const pb = new MemoryPocketBase();
    const session = makeSession();
    const { business, accounts } = await createBusinessWithDefaults(pb as never, session, {
      legalName: "Bace Ventures Ltd",
    });

    const result = await postJournalEntry(pb as never, session, {
      businessId: business.id,
      entryDate: "2026-07-12",
      memo: "Owner contribution",
      lines: [
        { accountId: accounts[0].id, debitMinor: 500000 },
        { accountId: accounts[4].id, creditMinor: 500000 },
      ],
    });

    expect(result.journalEntry.status).toBe("posted");
    expect(result.journalEntry.total_debit_minor).toBe(500000);
    expect(result.journalEntry.total_credit_minor).toBe(500000);
    expect(result.journalLines).toHaveLength(2);
    expect(pb.db.get("audit_logs")?.some((item) => item.action === "journal_entry.posted")).toBe(true);
  });

  it("rejects unbalanced journal entries", async () => {
    const pb = new MemoryPocketBase();
    const session = makeSession();
    const { business, accounts } = await createBusinessWithDefaults(pb as never, session, {
      legalName: "Bace Ventures Ltd",
    });

    await expect(
      postJournalEntry(pb as never, session, {
        businessId: business.id,
        entryDate: "2026-07-12",
        lines: [
          { accountId: accounts[0].id, debitMinor: 500000 },
          { accountId: accounts[4].id, creditMinor: 400000 },
        ],
      }),
    ).rejects.toThrow("total debit must equal total credit");
  });
});
