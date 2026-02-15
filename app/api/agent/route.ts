import { NextRequest, NextResponse } from "next/server";
import { retrieveKnowledge, buildContextSnippet } from "@/lib/agent/rag";
import type { KnowledgeEntry } from "@/lib/agent/knowledge";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}



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

    const systemPrompt = `You are NaijaTaxAgent AI, a subject-matter guide for the Nigerian tax calculator.
Help users understand Nigerian tax rules (VAT, WHT, CIT, Personal Income Tax) with expertise and clarity.
Be professional yet friendly and conversational in your approach.
Use the provided context to explain calculations, reference relevant modules, and provide actionable advice.
Maintain a helpful, advisory tone—as if you are a personal tax consultant.

Context: 
${context}`;

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ answer: fallbackAnswer(userQuestion, entries) });
    }

    // Initialize Gemini
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    // Call Gemini
    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + "\n\n" + messages.map(m => `${m.role}: ${m.content}`).join("\n") }] }
      ],
      generationConfig: {
        temperature: 0.2,
      }
    });

    const answer = result.response.text() || "No response";
    return NextResponse.json({ answer: formatResponse(answer, entries) });
  } catch (error) {
    console.error("Tax assistant error", error);
    return NextResponse.json({ error: "Unable to generate response" }, { status: 500 });
  }
}
