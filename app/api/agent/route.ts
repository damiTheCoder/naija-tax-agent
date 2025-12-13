import { NextRequest, NextResponse } from "next/server";
import { retrieveKnowledge, buildContextSnippet } from "@/lib/agent/rag";
import type { KnowledgeEntry } from "@/lib/agent/knowledge";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_BASE_URL = process.env.OPENAI_API_BASE || "https://api.openai.com/v1";

function formatResponse(text: string, entries: KnowledgeEntry[]): string {
  const sourceList = entries.map((entry) => `${entry.topic} → ${entry.sources.join(", ")}`).join("; ");
  return `${text}\n\nSources: ${sourceList}`;
}

function fallbackAnswer(question: string, entries: KnowledgeEntry[]) {
  const summary = entries
    .map((entry) => `• ${entry.topic}: ${entry.summary}`)
    .join("\n");
  return formatResponse(
    `I do not have external AI access right now, but here is what this software documents about "${question}".\n${summary}`,
    entries,
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    if (messages.length === 0) {
      return NextResponse.json({ error: "messages array required" }, { status: 400 });
    }

    const entries = retrieveKnowledge(messages);
    const context = buildContextSnippet(entries);
    const userQuestion = messages[messages.length - 1]?.content || "";

    const systemPrompt = `You are NaijaTaxAgent AI, a subject-matter guide for the Nigerian tax calculator.\n` +
      `Explain calculations using the provided context, reference relevant modules, and keep answers concise.\n` +
      `Context: \n${context}`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ answer: fallbackAnswer(userQuestion, entries) });
    }

    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((msg) => ({ role: msg.role, content: msg.content })),
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const fallbackText = fallbackAnswer(userQuestion, entries);
      return NextResponse.json({ answer: fallbackText });
    }

    const completion = await response.json();
    const answer = completion?.choices?.[0]?.message?.content || "No response";
    return NextResponse.json({ answer: formatResponse(answer, entries) });
  } catch (error) {
    console.error("Tax assistant error", error);
    return NextResponse.json({ error: "Unable to generate response" }, { status: 500 });
  }
}
