import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const STORAGE_FILE = path.join(process.cwd(), "data", "taxRemittanceAudit.json");
const MAX_RECORDS = 1000;

interface RemittanceAuditRecord {
  id: string;
  paymentReference: string;
  taxpayerName: string;
  businessName?: string;
  taxType: string;
  period: string;
  dueDate: string;
  taxAmount: number;
  scheduleId: string;
  source: string;
  createdAt: string;
}

type CreateRemittanceBody = Omit<RemittanceAuditRecord, "id" | "createdAt">;

async function readAuditRecords(): Promise<RemittanceAuditRecord[]> {
  try {
    const raw = await fs.readFile(STORAGE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as RemittanceAuditRecord[];
  } catch {
    return [];
  }
}

async function writeAuditRecords(records: RemittanceAuditRecord[]): Promise<void> {
  await fs.mkdir(path.dirname(STORAGE_FILE), { recursive: true });
  await fs.writeFile(STORAGE_FILE, JSON.stringify(records.slice(0, MAX_RECORDS), null, 2), "utf-8");
}

function validateCreateBody(body: Partial<CreateRemittanceBody>): string | null {
  if (!body.paymentReference || typeof body.paymentReference !== "string") return "paymentReference is required";
  if (!body.taxpayerName || typeof body.taxpayerName !== "string") return "taxpayerName is required";
  if (!body.taxType || typeof body.taxType !== "string") return "taxType is required";
  if (!body.period || typeof body.period !== "string") return "period is required";
  if (!body.dueDate || typeof body.dueDate !== "string") return "dueDate is required";
  if (typeof body.taxAmount !== "number" || Number.isNaN(body.taxAmount)) return "taxAmount must be a valid number";
  if (!body.scheduleId || typeof body.scheduleId !== "string") return "scheduleId is required";
  if (!body.source || typeof body.source !== "string") return "source is required";
  return null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number.parseInt(searchParams.get("limit") || "30", 10);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 200)) : 30;

    const records = await readAuditRecords();
    const sorted = records
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      records: sorted,
      total: records.length,
    });
  } catch (error) {
    console.error("[Tax Remittance API] GET Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch remittance audit history",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Partial<CreateRemittanceBody>;
    const validationError = validateCreateBody(body);
    if (validationError) {
      return NextResponse.json(
        {
          success: false,
          error: validationError,
        },
        { status: 400 }
      );
    }

    const record: RemittanceAuditRecord = {
      id: `REM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      paymentReference: body.paymentReference as string,
      taxpayerName: body.taxpayerName as string,
      businessName: body.businessName,
      taxType: body.taxType as string,
      period: body.period as string,
      dueDate: body.dueDate as string,
      taxAmount: body.taxAmount as number,
      scheduleId: body.scheduleId as string,
      source: body.source as string,
      createdAt: new Date().toISOString(),
    };

    const existing = await readAuditRecords();
    const next = [record, ...existing];
    await writeAuditRecords(next);

    return NextResponse.json({
      success: true,
      record,
    });
  } catch (error) {
    console.error("[Tax Remittance API] POST Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to persist remittance audit record",
      },
      { status: 500 }
    );
  }
}
