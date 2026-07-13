import { NextRequest, NextResponse } from "next/server";
import { createPocketBaseAdminClient } from "@/lib/pocketbase/adminClient";
import { requireSession, unauthorizedResponse } from "@/lib/pocketbase/auth";
import { postJournalEntry, type PostJournalEntryInput } from "@/lib/pocketbase/accounting";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  try {
    const body = (await request.json()) as PostJournalEntryInput;
    const pb = await createPocketBaseAdminClient();
    const result = await postJournalEntry(pb, session, body);

    return NextResponse.json({
      success: true,
      item: result.journalEntry,
      lines: result.journalLines,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to post journal entry.";
    const status =
      message.includes("permission") || message.includes("access")
        ? 403
        : message.includes("required") || message.includes("balanced") || message.includes("amount")
          ? 400
          : 500;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}
