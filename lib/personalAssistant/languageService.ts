import OpenAI from "openai";
import type { CalendarListItem, GmailMessageSummary } from "@/lib/personalAssistant/googleWorkspaceClient";

export interface DraftReplyInput {
  intent: string;
  tone: "professional" | "friendly" | "concise";
  recipient?: string;
  originalMessage?: GmailMessageSummary | null;
}

export interface DraftReplyResult {
  subject: string;
  body: string;
  usedModel: boolean;
}

export interface GenerateBriefInput {
  dateLabel: string;
  events: CalendarListItem[];
  emails: GmailMessageSummary[];
}

export class PersonalAssistantLanguageService {
  private readonly client?: OpenAI;
  private readonly model: string;

  constructor(config?: { apiKey?: string; model?: string }) {
    this.model = config?.model || process.env.PERSONAL_ASSISTANT_MODEL || "gpt-4.1-mini";

    if (config?.apiKey || process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({
        apiKey: config?.apiKey || process.env.OPENAI_API_KEY,
      });
    }
  }

  async draftReply(input: DraftReplyInput): Promise<DraftReplyResult> {
    const fallback = this.buildFallbackReply(input);

    if (!this.client) {
      return {
        ...fallback,
        usedModel: false,
      };
    }

    const prompt = [
      "You are a reliable executive assistant.",
      "Draft an email reply in JSON with keys: subject, body.",
      "Constraints: clear, accurate, no placeholders, under 170 words.",
      `Tone: ${input.tone}`,
      `Intent: ${input.intent}`,
      `Recipient: ${input.recipient || input.originalMessage?.from || "Unknown"}`,
      input.originalMessage
        ? `Original subject: ${input.originalMessage.subject}\nOriginal snippet: ${input.originalMessage.snippet}`
        : "No original message content provided.",
    ].join("\n\n");

    try {
      const response = await this.client.responses.create({
        model: this.model,
        input: prompt,
      });

      const outputText = this.getOutputText(response);
      const parsed = this.tryParseReply(outputText);

      return {
        subject: parsed.subject || fallback.subject,
        body: parsed.body || fallback.body,
        usedModel: true,
      };
    } catch {
      return {
        ...fallback,
        usedModel: false,
      };
    }
  }

  async generateBrief(input: GenerateBriefInput): Promise<{ markdown: string; usedModel: boolean }> {
    const fallback = this.buildFallbackBrief(input);

    if (!this.client) {
      return {
        markdown: fallback,
        usedModel: false,
      };
    }

    const prompt = [
      "You are an operations chief-of-staff assistant.",
      "Write a concise daily brief in markdown.",
      "Sections: Priority Actions, Meetings, Email Follow-ups.",
      "Limit to 220 words.",
      `Date: ${input.dateLabel}`,
      `Meetings JSON: ${JSON.stringify(input.events.slice(0, 10))}`,
      `Emails JSON: ${JSON.stringify(input.emails.slice(0, 15))}`,
    ].join("\n\n");

    try {
      const response = await this.client.responses.create({
        model: this.model,
        input: prompt,
      });

      const outputText = this.getOutputText(response).trim();
      if (!outputText) {
        return {
          markdown: fallback,
          usedModel: false,
        };
      }

      return {
        markdown: outputText,
        usedModel: true,
      };
    } catch {
      return {
        markdown: fallback,
        usedModel: false,
      };
    }
  }

  private getOutputText(response: unknown): string {
    if (!response || typeof response !== "object") {
      return "";
    }

    const maybeText = (response as { output_text?: unknown }).output_text;
    return typeof maybeText === "string" ? maybeText : "";
  }

  private tryParseReply(text: string): { subject: string; body: string } {
    const trimmed = text.trim();

    if (!trimmed) {
      return { subject: "", body: "" };
    }

    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return { subject: "", body: trimmed };
    }

    try {
      const parsed = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as {
        subject?: unknown;
        body?: unknown;
      };

      return {
        subject: typeof parsed.subject === "string" ? parsed.subject.trim() : "",
        body: typeof parsed.body === "string" ? parsed.body.trim() : "",
      };
    } catch {
      return { subject: "", body: trimmed };
    }
  }

  private buildFallbackReply(input: DraftReplyInput): { subject: string; body: string } {
    const subjectSource = input.originalMessage?.subject || "Your message";
    const subject = `Re: ${subjectSource}`;

    const greetingName = input.recipient?.split("@")[0] || "there";
    const body = [
      `Hi ${greetingName},`,
      "",
      `${input.intent.trim()}`,
      "",
      "Thanks,",
      "Personal Assistant",
    ].join("\n");

    return { subject, body };
  }

  private buildFallbackBrief(input: GenerateBriefInput): string {
    const topEvents = input.events.slice(0, 5);
    const topEmails = input.emails.slice(0, 5);

    const meetingsBlock =
      topEvents.length === 0
        ? "- No meetings scheduled."
        : topEvents
            .map((event) => `- ${event.startIso || "Time TBD"}: ${event.title}`)
            .join("\n");

    const emailsBlock =
      topEmails.length === 0
        ? "- No priority emails found."
        : topEmails.map((mail) => `- ${mail.from}: ${mail.subject}`).join("\n");

    return [
      `## Daily Brief (${input.dateLabel})`,
      "",
      "### Priority Actions",
      "- Review top unread messages and confirm today\'s commitments.",
      "- Block focus time for high-priority tasks.",
      "",
      "### Meetings",
      meetingsBlock,
      "",
      "### Email Follow-ups",
      emailsBlock,
    ].join("\n");
  }
}
