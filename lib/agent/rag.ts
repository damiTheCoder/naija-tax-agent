import { KNOWLEDGE_BASE, KnowledgeEntry } from "./knowledge";

interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function keywordScore(content: string, entry: KnowledgeEntry): number {
  const haystack = normalize(content);
  let score = 0;
  for (const keyword of entry.keywords) {
    if (haystack.includes(keyword)) {
      score += 2;
    }
  }
  const topic = normalize(entry.topic);
  if (haystack.includes(topic)) {
    score += 3;
  }
  return score;
}

export function retrieveKnowledge(messages: ConversationMessage[], limit = 3): KnowledgeEntry[] {
  const lastUser = [...messages].reverse().find((msg) => msg.role === "user");
  const content = lastUser?.content || "";
  const scored = KNOWLEDGE_BASE.map((entry) => ({ entry, score: keywordScore(content, entry) }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((item) => item.score > 0).slice(0, limit).map((item) => item.entry);
  if (top.length === 0) {
    return KNOWLEDGE_BASE.slice(0, limit);
  }
  return top;
}

export function buildContextSnippet(entries: KnowledgeEntry[]): string {
  return entries
    .map((entry) => `Topic: ${entry.topic}\nSummary: ${entry.summary}\nDetails: ${entry.details}\nSources: ${entry.sources.join(", ")}`)
    .join("\n\n");
}
