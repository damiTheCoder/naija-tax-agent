
import { NextResponse } from "next/server";
import { validateJournalEntry } from "@/lib/ai/accountingAuditor";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { entry, description } = body;

        if (!entry || !description) {
            return NextResponse.json(
                { error: "Missing entry or description" },
                { status: 400 }
            );
        }

        const result = await validateJournalEntry(entry, description);

        return NextResponse.json(result);
    } catch (error) {
        console.error("AI Audit Error:", error);
        return NextResponse.json(
            { error: "Failed to audit entry" },
            { status: 500 }
        );
    }
}
