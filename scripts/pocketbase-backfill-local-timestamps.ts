import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

type TableSpec = {
  tableName: string;
  fallbackColumns?: string[];
};

type SqlRow = {
  rowid: number;
  id: string;
  created?: string;
  updated?: string;
  [key: string]: unknown;
};

type Repair = {
  rowid: number;
  created?: string;
  updated?: string;
};

export const DEFAULT_DB_PATH = path.join(process.cwd(), ".pocketbase", "pb_data", "data.db");
const DEFAULT_STEP_MS = 1000;

const TABLE_SPECS: TableSpec[] = [
  { tableName: "usage_events" },
  { tableName: "complaints", fallbackColumns: ["resolvedAt"] },
  { tableName: "complaint_messages" },
  { tableName: "admin_audit_logs", fallbackColumns: ["createdAt"] },
];

export type RepairRunResult = {
  tableName: string;
  repairedRows: number;
  blankCreated: number;
  blankUpdated: number;
  skipped: boolean;
  reason?: string;
};

export function getLocalPocketBaseDataDbPath(): string {
  const configured = process.env.POCKETBASE_DATA_DB_PATH?.trim();
  return configured ? path.resolve(configured) : DEFAULT_DB_PATH;
}

function sqliteQuery<T>(dbPath: string, sql: string): T {
  const output = execFileSync("sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 16,
  }).trim();

  return (output ? JSON.parse(output) : []) as T;
}

function sqliteExec(dbPath: string, sql: string): void {
  execFileSync("sqlite3", ["-cmd", ".timeout 5000", dbPath, sql], {
    stdio: "pipe",
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 16,
  });
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseTimestamp(value: unknown): number | null {
  if (!isNonEmptyString(value)) {
    return null;
  }

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTimestamp(timestampMs: number): string {
  return new Date(timestampMs).toISOString().replace("T", " ");
}

function getAnchorTimestamp(row: SqlRow, fallbackColumns: string[]): number | null {
  const direct = parseTimestamp(row.created) ?? parseTimestamp(row.updated);
  if (direct !== null) {
    return direct;
  }

  for (const column of fallbackColumns) {
    const parsed = parseTimestamp(row[column]);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function interpolateMissingAnchors(anchorMs: Array<number | null>): number[] {
  const repaired = [...anchorMs];
  const stepMs = DEFAULT_STEP_MS;

  const firstKnownIndex = repaired.findIndex((value) => value !== null);
  if (firstKnownIndex === -1) {
    const base = Date.now();
    return repaired.map((_, index) => base - (repaired.length - index - 1) * stepMs);
  }

  for (let index = firstKnownIndex - 1; index >= 0; index -= 1) {
    repaired[index] = (repaired[index + 1] as number) - stepMs;
  }

  let currentIndex = firstKnownIndex;
  while (currentIndex < repaired.length) {
    if (repaired[currentIndex] === null) {
      currentIndex += 1;
      continue;
    }

    let gapStart = currentIndex + 1;
    while (gapStart < repaired.length && repaired[gapStart] !== null) {
      currentIndex = gapStart;
      gapStart += 1;
    }

    if (gapStart >= repaired.length) {
      break;
    }

    let gapEnd = gapStart;
    while (gapEnd < repaired.length && repaired[gapEnd] === null) {
      gapEnd += 1;
    }

    if (gapEnd >= repaired.length) {
      for (let index = gapStart; index < repaired.length; index += 1) {
        repaired[index] = (repaired[index - 1] as number) + stepMs;
      }
      break;
    }

    const previous = repaired[currentIndex] as number;
    const next = repaired[gapEnd] as number;
    const gapSize = gapEnd - currentIndex;

    for (let offset = 1; offset < gapSize; offset += 1) {
      repaired[currentIndex + offset] = Math.round(previous + ((next - previous) * offset) / gapSize);
    }

    currentIndex = gapEnd;
  }

  return repaired.map((value) => value as number);
}

function planRepairs(rows: SqlRow[], fallbackColumns: string[]): Repair[] {
  const anchors = rows.map((row) => getAnchorTimestamp(row, fallbackColumns));
  const repairedAnchors = interpolateMissingAnchors(anchors);

  return rows
    .map((row, index) => {
      const targetCreated = parseTimestamp(row.created) ?? repairedAnchors[index];
      const targetUpdated = parseTimestamp(row.updated) ?? targetCreated;

      const nextCreated = formatTimestamp(targetCreated);
      const nextUpdated = formatTimestamp(Math.max(targetCreated, targetUpdated));

      const patch: Repair = { rowid: row.rowid };
      let changed = false;

      if (!isNonEmptyString(row.created)) {
        patch.created = nextCreated;
        changed = true;
      }

      if (!isNonEmptyString(row.updated)) {
        patch.updated = nextUpdated;
        changed = true;
      }

      return changed ? patch : null;
    })
    .filter((patch): patch is Repair => Boolean(patch));
}

function buildSelectSql(spec: TableSpec): string {
  const extraColumns = (spec.fallbackColumns || []).map((column) => `, "${column}"`);
  return `SELECT rowid, id, created, updated${extraColumns.join("")} FROM "${spec.tableName}" ORDER BY rowid ASC;`;
}

function buildUpdateSql(tableName: string, repairs: Repair[]): string {
  const statements = repairs.map((repair) => {
    const sets: string[] = [];
    if (repair.created) {
      sets.push(`"created"='${escapeSqlString(repair.created)}'`);
    }
    if (repair.updated) {
      sets.push(`"updated"='${escapeSqlString(repair.updated)}'`);
    }

    return `UPDATE "${tableName}" SET ${sets.join(", ")} WHERE rowid = ${repair.rowid};`;
  });

  return ["BEGIN IMMEDIATE;", ...statements, "COMMIT;"].join("\n");
}

function countBlankRows(dbPath: string, tableName: string): { blankCreated: number; blankUpdated: number } {
  const result = sqliteQuery<Array<{ blankCreated: number; blankUpdated: number }>>(
    dbPath,
    `SELECT
      SUM(CASE WHEN created = '' THEN 1 ELSE 0 END) AS blankCreated,
      SUM(CASE WHEN updated = '' THEN 1 ELSE 0 END) AS blankUpdated
    FROM "${tableName}";`,
  );

  return {
    blankCreated: Number(result[0]?.blankCreated || 0),
    blankUpdated: Number(result[0]?.blankUpdated || 0),
  };
}

export function repairLocalPocketBaseTimestamps(dbPath = getLocalPocketBaseDataDbPath()): RepairRunResult[] {
  if (!existsSync(dbPath)) {
    throw new Error(`PocketBase SQLite file not found: ${dbPath}`);
  }
  const results: RepairRunResult[] = [];

  for (const spec of TABLE_SPECS) {
    const rows = sqliteQuery<SqlRow[]>(dbPath, buildSelectSql(spec));
    if (rows.length === 0) {
      results.push({
        tableName: spec.tableName,
        repairedRows: 0,
        blankCreated: 0,
        blankUpdated: 0,
        skipped: true,
        reason: "no records",
      });
      continue;
    }

    const repairs = planRepairs(rows, spec.fallbackColumns || []);
    if (repairs.length === 0) {
      const counts = countBlankRows(dbPath, spec.tableName);
      results.push({
        tableName: spec.tableName,
        repairedRows: 0,
        blankCreated: counts.blankCreated,
        blankUpdated: counts.blankUpdated,
        skipped: true,
        reason: "already clean",
      });
      continue;
    }

    sqliteExec(dbPath, buildUpdateSql(spec.tableName, repairs));
    const counts = countBlankRows(dbPath, spec.tableName);
    results.push({
      tableName: spec.tableName,
      repairedRows: repairs.length,
      blankCreated: counts.blankCreated,
      blankUpdated: counts.blankUpdated,
      skipped: false,
    });
  }

  return results;
}

export function runLocalTimestampRepair(): RepairRunResult[] {
  const dbPath = getLocalPocketBaseDataDbPath();
  console.log(`[pb:repair] using database ${dbPath}`);

  const results = repairLocalPocketBaseTimestamps(dbPath);
  for (const result of results) {
    if (result.skipped) {
      console.log(
        `[pb:repair] ${result.tableName}: ${result.reason} (blank created=${result.blankCreated}, blank updated=${result.blankUpdated})`,
      );
      continue;
    }

    console.log(
      `[pb:repair] ${result.tableName}: repaired ${result.repairedRows} rows (blank created=${result.blankCreated}, blank updated=${result.blankUpdated})`,
    );
  }

  return results;
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectExecution()) {
  try {
    runLocalTimestampRepair();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown timestamp repair failure";
    console.error(`[pb:repair] ${message}`);
    process.exit(1);
  }
}
