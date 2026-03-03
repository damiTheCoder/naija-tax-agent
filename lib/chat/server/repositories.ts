import { prisma } from "@/lib/server/prisma";
import type {
  ChatConversationRecord,
  ChatMessageRecord,
  CreateChatConversationInput,
  ListChatConversationsInput,
  ListChatConversationsResult,
  ReplaceChatMessagesInput,
  UpdateChatConversationInput,
} from "./types";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

const normalizeModule = (value: string | undefined): string => {
  const cleaned = String(value || "general").trim().toLowerCase();
  return cleaned || "general";
};

const normalizeRoute = (route: string | undefined, module: string): string => {
  const cleaned = String(route || "").trim();
  if (cleaned) return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  if (module === "accounting") return "/accounting";
  if (module === "tax") return "/tax/workspace";
  if (module === "cashflow") return "/cashflow-intelligence";
  if (module === "wallet") return "/wallet";
  if (module === "supersheet") return "/supersheet";
  if (module === "personal") return "/personal";
  return "/dashboard";
};

const sanitizeText = (value: string | undefined): string =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const toTitle = (value: string | undefined): string => {
  const cleaned = sanitizeText(value);
  if (!cleaned) return "New chat";
  return cleaned.length > 120 ? `${cleaned.slice(0, 120)}...` : cleaned;
};

const safeJsonStringify = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

const safeJsonParse = <T>(value: string | null | undefined): T | undefined => {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};

const ensureEntity = async (entityId: string) => {
  const now = new Date();
  await prisma.entity.upsert({
    where: { id: entityId },
    update: { updatedAt: now },
    create: {
      id: entityId,
      name: entityId === "entity-default" ? "Default Entity" : entityId,
      currency: "NGN",
      type: "BUSINESS",
      updatedAt: now,
    },
  });
};

const toMessageRecord = (value: {
  id: string;
  role: string;
  content: string;
  sequence: number;
  metadata: string | null;
  createdAt: Date;
}): ChatMessageRecord => ({
  id: value.id,
  role: value.role === "assistant" ? "assistant" : "user",
  content: value.content,
  sequence: value.sequence,
  createdAt: value.createdAt.toISOString(),
  metadata: safeJsonParse<Record<string, unknown>>(value.metadata),
});

const toConversationRecord = (value: {
  id: string;
  entityId: string;
  module: string;
  route: string;
  title: string;
  preview: string;
  createdBy: string | null;
  metadata: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    sequence: number;
    metadata: string | null;
    createdAt: Date;
  }>;
}): ChatConversationRecord => ({
  id: value.id,
  entityId: value.entityId,
  module: normalizeModule(value.module),
  route: normalizeRoute(value.route, normalizeModule(value.module)),
  title: toTitle(value.title),
  preview: sanitizeText(value.preview).slice(0, 160),
  createdBy: value.createdBy || undefined,
  metadata: safeJsonParse<Record<string, unknown>>(value.metadata),
  archivedAt: value.archivedAt ? value.archivedAt.toISOString() : null,
  createdAt: value.createdAt.toISOString(),
  updatedAt: value.updatedAt.toISOString(),
  messages: value.messages.map(toMessageRecord),
});

const parseCursorDate = (cursor: string | undefined): Date | null => {
  if (!cursor) return null;
  const parsed = new Date(cursor);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const buildPreview = (messages: Array<{ role: "user" | "assistant"; content: string }>, title: string): string => {
  const last = [...messages].reverse().find((message) => sanitizeText(message.content).length > 0);
  if (last) return sanitizeText(last.content).slice(0, 160);
  return sanitizeText(title).slice(0, 160) || "New chat";
};

const normalizeMessageInput = (
  messages: ReplaceChatMessagesInput["messages"]
): Array<{
  id: string;
  role: "user" | "assistant";
  content: string;
  sequence: number;
  createdAt: Date;
  metadata: string | null;
}> => {
  const now = Date.now();
  return (Array.isArray(messages) ? messages : [])
    .map((message, index) => {
      const role = message.role === "assistant" ? "assistant" : "user";
      const content = sanitizeText(message.content);
      if (!content) return null;
      const timestamp = Number.isFinite(message.timestamp) ? Number(message.timestamp) : now + index;
      return {
        id:
          typeof message.id === "string" && message.id.trim()
            ? message.id.trim()
            : `msg-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
        role: role as "user" | "assistant",
        content,
        sequence: index + 1,
        createdAt: new Date(timestamp),
        metadata: safeJsonStringify(message.metadata),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
};

export interface ChatConversationRepo {
  list(input: ListChatConversationsInput): Promise<ListChatConversationsResult>;
  get(entityId: string, conversationId: string): Promise<ChatConversationRecord | null>;
  create(input: CreateChatConversationInput): Promise<ChatConversationRecord>;
  update(input: UpdateChatConversationInput): Promise<ChatConversationRecord | null>;
  delete(entityId: string, conversationId: string): Promise<boolean>;
  replaceMessages(input: ReplaceChatMessagesInput): Promise<ChatConversationRecord | null>;
}

export const chatConversationRepo: ChatConversationRepo = {
  async list(input) {
    const entityId = sanitizeText(input.entityId) || "entity-default";
    const module = input.module ? normalizeModule(input.module) : undefined;
    const route = input.route ? normalizeRoute(input.route, module || "general") : undefined;
    const take = Math.max(1, Math.min(MAX_LIMIT, Math.round(input.limit || DEFAULT_LIMIT)));
    const cursorDate = parseCursorDate(input.cursor);

    const rows = await prisma.chatConversation.findMany({
      where: {
        entityId,
        archivedAt: null,
        ...(module ? { module } : {}),
        ...(route ? { route } : {}),
        ...(cursorDate ? { updatedAt: { lt: cursorDate } } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: take + 1,
      include: {
        messages: {
          orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    const hasNext = rows.length > take;
    const page = hasNext ? rows.slice(0, take) : rows;
    const nextCursor = hasNext ? page[page.length - 1]?.updatedAt.toISOString() || null : null;

    return {
      conversations: page.map(toConversationRecord),
      nextCursor,
    };
  },

  async get(entityId, conversationId) {
    const row = await prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        entityId: sanitizeText(entityId) || "entity-default",
        archivedAt: null,
      },
      include: {
        messages: {
          orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
        },
      },
    });
    return row ? toConversationRecord(row) : null;
  },

  async create(input) {
    const entityId = sanitizeText(input.entityId) || "entity-default";
    await ensureEntity(entityId);

    const module = normalizeModule(input.module);
    const route = normalizeRoute(input.route, module);
    const title = toTitle(input.title);
    const preview = sanitizeText(input.title).slice(0, 160) || title;

    const row = await prisma.chatConversation.upsert({
      where: { id: input.id || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
      update: {
        entityId,
        module,
        route,
        title,
        preview,
        createdBy: input.createdBy || null,
        metadata: safeJsonStringify(input.metadata),
        archivedAt: null,
      },
      create: {
        id: input.id || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        entityId,
        module,
        route,
        title,
        preview,
        createdBy: input.createdBy || null,
        metadata: safeJsonStringify(input.metadata),
      },
      include: {
        messages: {
          orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    return toConversationRecord(row);
  },

  async update(input) {
    const existing = await prisma.chatConversation.findFirst({
      where: {
        id: input.conversationId,
        entityId: sanitizeText(input.entityId) || "entity-default",
        archivedAt: null,
      },
      include: {
        messages: {
          orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
        },
      },
    });
    if (!existing) return null;

    const nextTitle = input.title ? toTitle(input.title) : existing.title;
    const module = input.module ? normalizeModule(input.module) : normalizeModule(existing.module);
    const route = input.route ? normalizeRoute(input.route, module) : normalizeRoute(existing.route, module);

    const updated = await prisma.chatConversation.update({
      where: { id: existing.id },
      data: {
        title: nextTitle,
        module,
        route,
        metadata: input.metadata ? safeJsonStringify(input.metadata) : existing.metadata,
        preview:
          existing.preview && sanitizeText(existing.preview).length > 0
            ? sanitizeText(existing.preview).slice(0, 160)
            : sanitizeText(nextTitle).slice(0, 160),
        archivedAt: null,
      },
      include: {
        messages: {
          orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
        },
      },
    });
    return toConversationRecord(updated);
  },

  async delete(entityId, conversationId) {
    const existing = await prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        entityId: sanitizeText(entityId) || "entity-default",
        archivedAt: null,
      },
      select: { id: true },
    });
    if (!existing) return false;

    await prisma.chatConversation.update({
      where: { id: existing.id },
      data: { archivedAt: new Date() },
    });
    return true;
  },

  async replaceMessages(input) {
    const entityId = sanitizeText(input.entityId) || "entity-default";
    const existing = await prisma.chatConversation.findFirst({
      where: {
        id: input.conversationId,
        entityId,
        archivedAt: null,
      },
      include: {
        messages: true,
      },
    });
    if (!existing) return null;

    const normalized = normalizeMessageInput(input.messages);
    const derivedTitle = toTitle(
      existing.title === "New chat" || existing.title === "Untitled chat"
        ? normalized.find((item) => item.role === "user")?.content || existing.title
        : existing.title
    );
    const preview = buildPreview(
      normalized.map((item) => ({ role: item.role, content: item.content })),
      derivedTitle
    );

    await prisma.$transaction([
      prisma.chatMessage.deleteMany({
        where: { conversationId: existing.id },
      }),
      ...(normalized.length > 0
        ? [
            prisma.chatMessage.createMany({
              data: normalized.map((message) => ({
                id: message.id,
                conversationId: existing.id,
                role: message.role,
                content: message.content,
                sequence: message.sequence,
                metadata: message.metadata,
                createdAt: message.createdAt,
              })),
            }),
          ]
        : []),
      prisma.chatConversation.update({
        where: { id: existing.id },
        data: {
          title: derivedTitle,
          preview,
          updatedAt: new Date(),
          archivedAt: null,
        },
      }),
    ]);

    const refreshed = await prisma.chatConversation.findUnique({
      where: { id: existing.id },
      include: {
        messages: {
          orderBy: [{ sequence: "asc" }, { createdAt: "asc" }],
        },
      },
    });
    return refreshed ? toConversationRecord(refreshed) : null;
  },
};
