"use client";

export const CHAT_HISTORY_KEY = "quantum-personal-chat-history";
const LEGACY_CHAT_HISTORY_KEY = "quantum-chat-history";
export const PERSONAL_CHAT_HISTORY_KEY = CHAT_HISTORY_KEY;
const CHAT_CONVERSATIONS_KEY = "quantum-chat-conversations-v2";

export const CHAT_HISTORY_UPDATED_EVENT = "chat-history-updated";
export const PERSONAL_CHAT_HISTORY_UPDATED_EVENT = CHAT_HISTORY_UPDATED_EVENT;

export const CHAT_HISTORY_SELECTED_EVENT = "chat-history-selected";
const CHAT_HISTORY_SELECTED_KEY = "quantum-chat-history-selected";

const MAX_HISTORY_ITEMS = 50;
const MAX_MESSAGES_PER_CONVERSATION = 250;

export interface ChatConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatConversation {
  id: string;
  title: string;
  preview: string;
  module: string;
  route: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatConversationMessage[];
}

export interface ChatHistoryEntry {
  id: string;
  title: string;
  preview: string;
  prompt: string;
  response?: string;
  timestamp: number;
  module: string;
  route: string;
  conversationId?: string;
}

export type PersonalChatHistoryEntry = ChatHistoryEntry;

interface AddChatHistoryParams {
  module: string;
  route?: string;
  prompt: string;
  response?: string;
}

interface ConversationFilters {
  module?: string;
  route?: string;
}

function normalizeModule(module: string | undefined): string {
  const cleaned = (module || "general").toLowerCase().trim();
  return cleaned || "general";
}

function routeForModule(module: string): string {
  switch (module) {
    case "personal":
      return "/personal";
    case "accounting":
      return "/accounting";
    case "tax":
      return "/tax-tools";
    case "cashflow":
      return "/cashflow-intelligence";
    case "reconciliation":
      return "/accounting/reconciliation";
    case "wallet":
      return "/wallet";
    case "supersheet":
      return "/supersheet";
    case "dashboard":
      return "/dashboard";
    default:
      return "/dashboard";
  }
}

function normalizeRoute(route: string | undefined, module: string): string {
  const cleaned = (route || "").trim();
  if (!cleaned) return routeForModule(module);
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
}

function sanitizePrompt(prompt: string): string {
  const collapsed = prompt.replace(/\s+/g, " ").trim();
  if (!collapsed) return "";

  const quoteChars = `"'“”‘’\``;
  let cleaned = collapsed;

  while (cleaned.length > 1 && quoteChars.includes(cleaned[0]) && quoteChars.includes(cleaned[cleaned.length - 1])) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  cleaned = cleaned.replace(/^[\"'“”‘’`]+/, "").replace(/[\"'“”‘’`]+$/, "").trim();
  return cleaned || collapsed;
}

function toTitle(prompt: string): string {
  if (!prompt) return "Untitled chat";
  return prompt.length > 80 ? `${prompt.slice(0, 80)}...` : prompt;
}

function safeParseArray(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isMessage(value: unknown): value is ChatConversationMessage {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ChatConversationMessage>;
  return (
    (item.role === "user" || item.role === "assistant") &&
    typeof item.content === "string" &&
    typeof item.timestamp === "number"
  );
}

function normalizeMessage(value: ChatConversationMessage): ChatConversationMessage {
  return {
    id: typeof value.id === "string" && value.id ? value.id : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: value.role,
    content: String(value.content || "").trim(),
    timestamp: Number.isFinite(value.timestamp) ? value.timestamp : Date.now(),
  };
}

function isConversation(value: unknown): value is ChatConversation {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ChatConversation>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.preview === "string" &&
    typeof item.module === "string" &&
    typeof item.route === "string" &&
    typeof item.createdAt === "number" &&
    typeof item.updatedAt === "number" &&
    Array.isArray(item.messages)
  );
}

function normalizeConversation(value: ChatConversation): ChatConversation {
  const moduleId = normalizeModule(value.module);
  const route = normalizeRoute(value.route, moduleId);
  const normalizedMessages = (Array.isArray(value.messages) ? value.messages : [])
    .filter(isMessage)
    .map(normalizeMessage)
    .filter((msg) => msg.content.length > 0)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_MESSAGES_PER_CONVERSATION);

  const firstUser = normalizedMessages.find((msg) => msg.role === "user")?.content || "";
  const explicitTitle = sanitizePrompt(value.title || "");
  const title = toTitle(explicitTitle || sanitizePrompt(firstUser) || "Untitled chat");
  const lastMessage = normalizedMessages[normalizedMessages.length - 1]?.content || title;
  const preview = (lastMessage || title).slice(0, 120);

  return {
    id: value.id,
    title,
    preview,
    module: moduleId,
    route,
    createdAt: Number.isFinite(value.createdAt) ? value.createdAt : Date.now(),
    updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : Date.now(),
    messages: normalizedMessages,
  };
}

function buildHistoryEntryFromConversation(conversation: ChatConversation): ChatHistoryEntry {
  const messages = conversation.messages;
  const lastUser = [...messages].reverse().find((msg) => msg.role === "user");
  const lastAssistant = [...messages].reverse().find((msg) => msg.role === "assistant");

  const prompt = sanitizePrompt(lastUser?.content || conversation.title || conversation.preview || "");

  return {
    id: conversation.id,
    conversationId: conversation.id,
    title: conversation.title,
    preview: conversation.preview,
    prompt,
    response: lastAssistant?.content,
    timestamp: conversation.updatedAt,
    module: conversation.module,
    route: conversation.route,
  };
}

function summariesFromConversations(conversations: ChatConversation[]): ChatHistoryEntry[] {
  return conversations
    .map(buildHistoryEntryFromConversation)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_HISTORY_ITEMS);
}

function saveChatConversationsInternal(conversations: ChatConversation[]): void {
  if (typeof window === "undefined") return;
  const normalized = conversations
    .filter(isConversation)
    .map(normalizeConversation)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_HISTORY_ITEMS);

  window.localStorage.setItem(CHAT_CONVERSATIONS_KEY, JSON.stringify(normalized));
  window.localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(summariesFromConversations(normalized)));
  window.dispatchEvent(new CustomEvent(CHAT_HISTORY_UPDATED_EVENT));
}

function migrateLegacyHistoryToConversations(): ChatConversation[] {
  if (typeof window === "undefined") return [];

  const legacyCandidates = [
    ...safeParseArray(window.localStorage.getItem(CHAT_HISTORY_KEY)),
    ...safeParseArray(window.localStorage.getItem(LEGACY_CHAT_HISTORY_KEY)),
  ];

  const migrated: ChatConversation[] = [];
  for (const item of legacyCandidates) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Partial<ChatHistoryEntry>;
    const moduleId = normalizeModule(entry.module);
    const route = normalizeRoute(entry.route, moduleId);
    const prompt = sanitizePrompt(String(entry.prompt || entry.preview || entry.title || ""));
    if (!prompt) continue;
    const timestamp = Number.isFinite(entry.timestamp as number) ? (entry.timestamp as number) : Date.now();

    const messages: ChatConversationMessage[] = [
      {
        id: `legacy-u-${timestamp}`,
        role: "user",
        content: prompt,
        timestamp,
      },
    ];

    if (typeof entry.response === "string" && entry.response.trim()) {
      messages.push({
        id: `legacy-a-${timestamp}`,
        role: "assistant",
        content: entry.response.trim(),
        timestamp: timestamp + 1,
      });
    }

    migrated.push(
      normalizeConversation({
        id: typeof entry.id === "string" && entry.id ? entry.id : `conv-${timestamp}-${Math.random().toString(36).slice(2, 7)}`,
        title: toTitle(prompt),
        preview: prompt,
        module: moduleId,
        route,
        createdAt: timestamp,
        updatedAt: timestamp,
        messages,
      })
    );
  }

  return migrated.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_HISTORY_ITEMS);
}

export function loadChatConversations(filters?: ConversationFilters): ChatConversation[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(CHAT_CONVERSATIONS_KEY);
  let conversations = safeParseArray(raw).filter(isConversation).map((item) => normalizeConversation(item as ChatConversation));

  if (!conversations.length) {
    conversations = migrateLegacyHistoryToConversations();
    if (conversations.length > 0) {
      saveChatConversationsInternal(conversations);
    }
  }

  if (filters?.module) {
    const moduleId = normalizeModule(filters.module);
    conversations = conversations.filter((item) => item.module === moduleId);
  }

  if (filters?.route) {
    const normalizedRoute = normalizeRoute(filters.route, filters.module ? normalizeModule(filters.module) : "general");
    conversations = conversations.filter((item) => item.route === normalizedRoute);
  }

  return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getChatConversation(conversationId: string): ChatConversation | null {
  if (typeof window === "undefined") return null;
  const conversations = loadChatConversations();
  return conversations.find((item) => item.id === conversationId) || null;
}

export function createChatConversation(params: {
  module: string;
  route?: string;
  title?: string;
}): ChatConversation {
  const moduleId = normalizeModule(params.module);
  const route = normalizeRoute(params.route, moduleId);
  const now = Date.now();
  const baseTitle = sanitizePrompt(params.title || "") || "New chat";

  const conversation: ChatConversation = {
    id: `conv-${now}-${Math.random().toString(36).slice(2, 7)}`,
    title: toTitle(baseTitle),
    preview: baseTitle,
    module: moduleId,
    route,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };

  const conversations = loadChatConversations();
  saveChatConversationsInternal([conversation, ...conversations]);
  return conversation;
}

export function saveChatConversationMessages(params: {
  conversationId: string;
  module?: string;
  route?: string;
  title?: string;
  messages: ChatConversationMessage[];
}): ChatConversation | null {
  if (typeof window === "undefined") return null;

  const conversations = loadChatConversations();
  const index = conversations.findIndex((item) => item.id === params.conversationId);
  if (index < 0) return null;

  const existing = conversations[index];
  const normalizedMessages = (Array.isArray(params.messages) ? params.messages : [])
    .filter(isMessage)
    .map(normalizeMessage)
    .filter((msg) => msg.content.length > 0)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_MESSAGES_PER_CONVERSATION);

  const firstUser = normalizedMessages.find((msg) => msg.role === "user")?.content;
  const explicitTitle = sanitizePrompt(params.title || "");
  const shouldRefreshAutoTitle =
    existing.messages.length === 0 ||
    existing.title === "New chat" ||
    existing.title === "Untitled chat";
  const derivedTitle =
    explicitTitle ||
    (shouldRefreshAutoTitle ? sanitizePrompt(firstUser || existing.title || "") : sanitizePrompt(existing.title || "")) ||
    "New chat";
  const latestContent = normalizedMessages[normalizedMessages.length - 1]?.content || existing.preview || derivedTitle;

  const updated: ChatConversation = normalizeConversation({
    ...existing,
    module: normalizeModule(params.module || existing.module),
    route: normalizeRoute(params.route || existing.route, params.module || existing.module),
    title: toTitle(derivedTitle),
    preview: latestContent.length > 120 ? `${latestContent.slice(0, 120)}...` : latestContent,
    messages: normalizedMessages,
    updatedAt: Date.now(),
  });

  const next = [...conversations];
  next.splice(index, 1);
  saveChatConversationsInternal([updated, ...next]);
  return updated;
}

export function renameChatConversation(params: {
  conversationId: string;
  title: string;
}): ChatConversation | null {
  if (typeof window === "undefined") return null;
  const nextTitle = sanitizePrompt(params.title || "");
  if (!nextTitle) return null;

  const conversations = loadChatConversations();
  const index = conversations.findIndex((item) => item.id === params.conversationId);
  if (index < 0) return null;

  const existing = conversations[index];
  const updated = normalizeConversation({
    ...existing,
    title: toTitle(nextTitle),
    preview: existing.preview || nextTitle,
    updatedAt: Date.now(),
  });

  const next = [...conversations];
  next.splice(index, 1);
  saveChatConversationsInternal([updated, ...next]);
  return updated;
}

export function deleteChatConversation(conversationId: string): boolean {
  if (typeof window === "undefined") return false;
  const conversations = loadChatConversations();
  const next = conversations.filter((item) => item.id !== conversationId);
  if (next.length === conversations.length) return false;

  saveChatConversationsInternal(next);
  const selected = getSelectedChatHistory();
  if (selected?.conversationId === conversationId) {
    clearSelectedChatHistory();
  }
  return true;
}

export function loadChatHistory(): ChatHistoryEntry[] {
  const conversations = loadChatConversations();
  return summariesFromConversations(conversations);
}

export function loadPersonalChatHistory(): PersonalChatHistoryEntry[] {
  return loadChatHistory().filter((item) => item.module === "personal");
}

export function addChatHistoryEntry(params: AddChatHistoryParams): ChatHistoryEntry | null {
  if (typeof window === "undefined") return null;

  const prompt = sanitizePrompt(params.prompt);
  if (!prompt) return null;

  const moduleId = normalizeModule(params.module);
  const route = normalizeRoute(params.route, moduleId);
  const response = typeof params.response === "string" ? params.response.trim() : "";
  const now = Date.now();
  const conversations = loadChatConversations();

  const existingIndex = conversations.findIndex(
    (conversation) =>
      conversation.module === moduleId &&
      conversation.route === route &&
      conversation.title.toLowerCase() === toTitle(prompt).toLowerCase()
  );

  if (existingIndex >= 0) {
    const target = conversations[existingIndex];
    const messages = [...target.messages];
    const lastMessage = messages[messages.length - 1];

    if (!response) {
      if (!(lastMessage && lastMessage.role === "user" && sanitizePrompt(lastMessage.content) === prompt)) {
        messages.push({
          id: `msg-u-${now}-${Math.random().toString(36).slice(2, 6)}`,
          role: "user",
          content: prompt,
          timestamp: now,
        });
      }
    } else {
      if (!(lastMessage && lastMessage.role === "user" && sanitizePrompt(lastMessage.content) === prompt)) {
        messages.push({
          id: `msg-u-${now}-${Math.random().toString(36).slice(2, 6)}`,
          role: "user",
          content: prompt,
          timestamp: now,
        });
      }
      messages.push({
        id: `msg-a-${now}-${Math.random().toString(36).slice(2, 6)}`,
        role: "assistant",
        content: response,
        timestamp: now + 1,
      });
    }

    const updated = saveChatConversationMessages({
      conversationId: target.id,
      module: moduleId,
      route,
      title: toTitle(prompt),
      messages,
    });

    return updated ? buildHistoryEntryFromConversation(updated) : null;
  }

  const conversation = createChatConversation({
    module: moduleId,
    route,
    title: toTitle(prompt),
  });

  const initialMessages: ChatConversationMessage[] = [
    {
      id: `msg-u-${now}-${Math.random().toString(36).slice(2, 6)}`,
      role: "user",
      content: prompt,
      timestamp: now,
    },
  ];

  if (response) {
    initialMessages.push({
      id: `msg-a-${now}-${Math.random().toString(36).slice(2, 6)}`,
      role: "assistant",
      content: response,
      timestamp: now + 1,
    });
  }

  const saved = saveChatConversationMessages({
    conversationId: conversation.id,
    module: moduleId,
    route,
    title: toTitle(prompt),
    messages: initialMessages,
  });

  return saved ? buildHistoryEntryFromConversation(saved) : null;
}

export function addPersonalChatHistory(prompt: string): void {
  addChatHistoryEntry({ module: "personal", route: "/personal", prompt });
}

export function selectChatHistoryEntry(entry: ChatHistoryEntry): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHAT_HISTORY_SELECTED_KEY, JSON.stringify(entry));
  window.dispatchEvent(new CustomEvent(CHAT_HISTORY_SELECTED_EVENT));
}

export function selectChatConversation(conversationId: string): void {
  const conversation = getChatConversation(conversationId);
  if (!conversation) return;
  selectChatHistoryEntry(buildHistoryEntryFromConversation(conversation));
}

export function getSelectedChatHistory(): ChatHistoryEntry | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CHAT_HISTORY_SELECTED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;

    const item = parsed as Partial<ChatHistoryEntry>;
    const moduleId = normalizeModule(item.module || "general");
    const prompt = sanitizePrompt(String(item.prompt || item.preview || item.title || ""));
    const title = toTitle(prompt || String(item.title || "Untitled chat"));

    return {
      id: typeof item.id === "string" && item.id ? item.id : `selected-${Date.now()}`,
      conversationId: typeof item.conversationId === "string" && item.conversationId ? item.conversationId : undefined,
      title,
      preview: String(item.preview || prompt || title),
      prompt,
      response: typeof item.response === "string" ? item.response : undefined,
      timestamp: Number.isFinite(item.timestamp as number) ? (item.timestamp as number) : Date.now(),
      module: moduleId,
      route: normalizeRoute(item.route, moduleId),
    };
  } catch {
    return null;
  }
}

export function clearSelectedChatHistory(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CHAT_HISTORY_SELECTED_KEY);
}

function routeMatches(targetRoute: string, pathname: string): boolean {
  if (!targetRoute || !pathname) return false;
  const normalize = (value: string) => value.replace(/\/+$/, "") || "/";
  return normalize(pathname) === normalize(targetRoute);
}

export function consumeSelectedChatHistory(match?: { module?: string; pathname?: string }): ChatHistoryEntry | null {
  const selected = getSelectedChatHistory();
  if (!selected) return null;

  if (match?.module && selected.module !== normalizeModule(match.module)) {
    return null;
  }

  if (match?.pathname && !routeMatches(selected.route, match.pathname)) {
    return null;
  }

  clearSelectedChatHistory();
  return selected;
}

export function formatHistoryTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}
