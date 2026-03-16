import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  GoogleWorkspaceClient,
  type CalendarListItem,
  type GmailMessageSummary,
} from "@/lib/personalAssistant/googleWorkspaceClient";
import { PersonalAssistantLanguageService } from "@/lib/personalAssistant/languageService";

const scheduleMeetingSchema = z.object({
  title: z.string().min(2),
  start_iso: z.string().min(10),
  end_iso: z.string().min(10),
  timezone: z.string().default("UTC"),
  description: z.string().optional(),
  location: z.string().optional(),
  attendees: z.array(z.string().email()).default([]),
  include_meet_link: z.boolean().default(true),
});

const createDocSchema = z.object({
  title: z.string().min(2),
  content: z.string().optional(),
  share_with: z.array(z.string().email()).default([]),
});

const editDocSchema = z.object({
  document_id: z.string().min(8),
  mode: z.enum(["append", "replace"]).default("append"),
  content: z.string().min(1),
});

const readInboxSchema = z.object({
  query: z.string().default("is:unread newer_than:7d"),
  max_results: z.number().int().min(1).max(25).default(10),
});

const draftReplySchema = z.object({
  intent: z.string().min(5),
  tone: z.enum(["professional", "friendly", "concise"]).default("professional"),
  message_id: z.string().optional(),
  recipient: z.string().email().optional(),
});

const sendEmailSchema = z.object({
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).default([]),
  subject: z.string().min(1),
  body_text: z.string().min(1),
  thread_id: z.string().optional(),
  in_reply_to: z.string().optional(),
});

const generateBriefSchema = z.object({
  date_iso: z.string().optional(),
  inbox_query: z.string().default("is:unread newer_than:1d"),
  max_emails: z.number().int().min(1).max(25).default(10),
  include_calendar: z.boolean().default(true),
});

const sendBriefEmailSchema = z.object({
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).default([]),
  subject: z.string().optional(),
  date_iso: z.string().optional(),
  inbox_query: z.string().default("is:unread newer_than:1d"),
  max_emails: z.number().int().min(1).max(25).default(10),
  include_calendar: z.boolean().default(true),
});

function text(content: string) {
  return [{ type: "text" as const, text: content }];
}

function markdownToDocText(markdown?: string): string {
  if (!markdown) {
    return "";
  }

  return markdown
    .replace(/^#{1,6}\s?/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\r\n/g, "\n")
    .trim();
}

function toDateLabel(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toDayRange(dateIso?: string): { start: string; end: string; label: string } {
  const date = dateIso ? new Date(dateIso) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date provided. Use ISO format like 2026-03-07.");
  }

  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59));

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label: toDateLabel(start),
  };
}

function formatError(prefix: string, error: unknown): string {
  if (error instanceof Error && error.message) {
    return `${prefix}: ${error.message}`;
  }

  return `${prefix}: Unknown error`;
}

function requireAuth(client: GoogleWorkspaceClient): void {
  if (!client.hasAuth()) {
    throw new Error(
      "Google credentials are not configured. Set GOOGLE_ACCESS_TOKEN or refresh credentials in your env."
    );
  }
}

export function createPersonalAssistantMcpServer() {
  const googleClient = new GoogleWorkspaceClient({
    accessToken: process.env.GOOGLE_ACCESS_TOKEN,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  });

  const languageService = new PersonalAssistantLanguageService({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.PERSONAL_ASSISTANT_MODEL,
  });

  const server = new McpServer({
    name: "personal-assistant-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "schedule_meeting",
    {
      title: "Schedule Meeting",
      description:
        "Use this when you need to create a Google Calendar event, invite attendees, and optionally attach a Google Meet link.",
      inputSchema: scheduleMeetingSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    async (args) => {
      try {
        requireAuth(googleClient);

        const start = new Date(args.start_iso);
        const end = new Date(args.end_iso);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          throw new Error("start_iso and end_iso must be valid ISO date-time strings.");
        }

        if (end <= start) {
          throw new Error("end_iso must be later than start_iso.");
        }

        const created = await googleClient.createCalendarEvent({
          title: args.title,
          startIso: args.start_iso,
          endIso: args.end_iso,
          timezone: args.timezone,
          description: args.description,
          attendees: args.attendees,
          location: args.location,
          includeMeetLink: args.include_meet_link,
        });

        return {
          content: text(`Meeting created: ${created.title || args.title}.`),
          structuredContent: {
            eventId: created.id,
            htmlLink: created.htmlLink,
            meetingLink: created.meetingLink,
            title: created.title || args.title,
            startIso: created.startIso || args.start_iso,
            endIso: created.endIso || args.end_iso,
            attendees: args.attendees,
          },
        };
      } catch (error) {
        return {
          content: text(formatError("Failed to schedule meeting", error)),
          structuredContent: {
            ok: false,
          },
        };
      }
    }
  );

  server.registerTool(
    "create_doc",
    {
      title: "Create Document",
      description: "Use this when you need to create a Google Doc with initial content and optional sharing.",
      inputSchema: createDocSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    async (args) => {
      try {
        requireAuth(googleClient);

        const doc = await googleClient.createDocument({
          title: args.title,
          content: markdownToDocText(args.content),
          shareWith: args.share_with,
        });

        return {
          content: text(`Document created: ${args.title}.`),
          structuredContent: {
            documentId: doc.documentId,
            url: doc.url,
            sharedWith: args.share_with,
          },
        };
      } catch (error) {
        return {
          content: text(formatError("Failed to create doc", error)),
          structuredContent: {
            ok: false,
          },
        };
      }
    }
  );

  server.registerTool(
    "edit_doc",
    {
      title: "Edit Document",
      description: "Use this when you need to append or replace content in an existing Google Doc.",
      inputSchema: editDocSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    async (args) => {
      try {
        requireAuth(googleClient);

        const content = markdownToDocText(args.content);
        if (args.mode === "replace") {
          await googleClient.replaceDocumentText(args.document_id, content);
        } else {
          const appendPayload = content.startsWith("\n") ? content : `\n${content}`;
          await googleClient.appendDocumentText(args.document_id, appendPayload);
        }

        return {
          content: text(`Document ${args.mode === "replace" ? "replaced" : "updated"} successfully.`),
          structuredContent: {
            documentId: args.document_id,
            mode: args.mode,
            updated: true,
          },
        };
      } catch (error) {
        return {
          content: text(formatError("Failed to edit doc", error)),
          structuredContent: {
            ok: false,
          },
        };
      }
    }
  );

  server.registerTool(
    "read_inbox",
    {
      title: "Read Inbox",
      description: "Use this when you need a list of recent Gmail messages to triage or summarize.",
      inputSchema: readInboxSchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        requireAuth(googleClient);
        const messages = await googleClient.listInbox(args.query, args.max_results);

        return {
          content: text(`Fetched ${messages.length} email(s) from Gmail.`),
          structuredContent: {
            count: messages.length,
            messages,
          },
        };
      } catch (error) {
        return {
          content: text(formatError("Failed to read inbox", error)),
          structuredContent: {
            ok: false,
            messages: [] as GmailMessageSummary[],
          },
        };
      }
    }
  );

  server.registerTool(
    "draft_email_reply",
    {
      title: "Draft Email Reply",
      description:
        "Use this when you need a reply draft based on message context, recipient, and intent before sending.",
      inputSchema: draftReplySchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        let originalMessage: GmailMessageSummary | null = null;
        if (args.message_id) {
          requireAuth(googleClient);
          originalMessage = await googleClient.getMessageMetadata(args.message_id);
        }

        const draft = await languageService.draftReply({
          intent: args.intent,
          tone: args.tone,
          recipient: args.recipient,
          originalMessage,
        });

        return {
          content: text("Draft reply prepared."),
          structuredContent: {
            subject: draft.subject,
            body: draft.body,
            usedModel: draft.usedModel,
            originalMessage,
          },
        };
      } catch (error) {
        return {
          content: text(formatError("Failed to draft reply", error)),
          structuredContent: {
            ok: false,
          },
        };
      }
    }
  );

  server.registerTool(
    "send_email",
    {
      title: "Send Email",
      description: "Use this when the reply is approved and should be sent through Gmail.",
      inputSchema: sendEmailSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    async (args) => {
      try {
        requireAuth(googleClient);

        const sent = await googleClient.sendEmail({
          to: args.to,
          cc: args.cc,
          subject: args.subject,
          bodyText: args.body_text,
          threadId: args.thread_id,
          inReplyTo: args.in_reply_to,
        });

        return {
          content: text("Email sent successfully."),
          structuredContent: {
            id: sent.id,
            threadId: sent.threadId,
            recipients: args.to,
          },
        };
      } catch (error) {
        return {
          content: text(formatError("Failed to send email", error)),
          structuredContent: {
            ok: false,
          },
        };
      }
    }
  );

  server.registerTool(
    "generate_brief",
    {
      title: "Generate Daily Brief",
      description:
        "Use this when you need a concise summary of today\'s meetings and priority inbox items with recommended actions.",
      inputSchema: generateBriefSchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async (args) => {
      try {
        requireAuth(googleClient);

        const day = toDayRange(args.date_iso);
        const emails = await googleClient.listInbox(args.inbox_query, args.max_emails);

        let events: CalendarListItem[] = [];
        if (args.include_calendar) {
          events = await googleClient.listCalendarEvents({
            timeMinIso: day.start,
            timeMaxIso: day.end,
            maxResults: 20,
          });
        }

        const brief = await languageService.generateBrief({
          dateLabel: day.label,
          events,
          emails,
        });

        return {
          content: text(`Daily brief generated for ${day.label}.`),
          structuredContent: {
            date: day.label,
            meetings: events,
            emails,
            briefMarkdown: brief.markdown,
            usedModel: brief.usedModel,
          },
        };
      } catch (error) {
        return {
          content: text(formatError("Failed to generate brief", error)),
          structuredContent: {
            ok: false,
          },
        };
      }
    }
  );

  server.registerTool(
    "send_brief_email",
    {
      title: "Send Brief Email",
      description: "Use this when you want the generated daily brief emailed directly to recipients.",
      inputSchema: sendBriefEmailSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    async (args) => {
      try {
        requireAuth(googleClient);

        const day = toDayRange(args.date_iso);
        const emails = await googleClient.listInbox(args.inbox_query, args.max_emails);

        let events: CalendarListItem[] = [];
        if (args.include_calendar) {
          events = await googleClient.listCalendarEvents({
            timeMinIso: day.start,
            timeMaxIso: day.end,
            maxResults: 20,
          });
        }

        const brief = await languageService.generateBrief({
          dateLabel: day.label,
          events,
          emails,
        });

        const subject = args.subject || `Daily Brief - ${day.label}`;
        const sent = await googleClient.sendEmail({
          to: args.to,
          cc: args.cc,
          subject,
          bodyText: brief.markdown,
        });

        return {
          content: text(`Daily brief sent to ${args.to.join(", ")}.`),
          structuredContent: {
            date: day.label,
            recipients: args.to,
            subject,
            gmailMessageId: sent.id,
            briefMarkdown: brief.markdown,
            usedModel: brief.usedModel,
          },
        };
      } catch (error) {
        return {
          content: text(formatError("Failed to send brief email", error)),
          structuredContent: {
            ok: false,
          },
        };
      }
    }
  );

  return server;
}
