"use client";

export const CHAT_HISTORY_KEY = "quantum-personal-chat-history";
const LEGACY_CHAT_HISTORY_KEY = "quantum-chat-history";
export const PERSONAL_CHAT_HISTORY_KEY = CHAT_HISTORY_KEY;

export const CHAT_HISTORY_UPDATED_EVENT = "chat-history-updated";
export const PERSONAL_CHAT_HISTORY_UPDATED_EVENT = CHAT_HISTORY_UPDATED_EVENT;

export const CHAT_HISTORY_SELECTED_EVENT = "chat-history-selected";
const CHAT_HISTORY_SELECTED_KEY = "quantum-chat-history-selected";

const MAX_HISTORY_ITEMS = 30;

export interface ChatHistoryEntry {
  id: string;
  title: string;
  preview: string;
  prompt: string;
  response?: string;
  timestamp: number;
  module: string;
  route: string;
}

export type PersonalChatHistoryEntry = ChatHistoryEntry;

interface AddChatHistoryParams {
  module: string;
  route?: string;
  prompt: string;
  response?: string;
}

function isChatHistoryEntry(value: unknown): value is ChatHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ChatHistoryEntry>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.preview === "string" &&
    typeof item.timestamp === "number"
  );
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

  // Remove wrapping quotes repeatedly to normalize prompts like ""hello"".
  while (cleaned.length > 1 && quoteChars.includes(cleaned[0]) && quoteChars.includes(cleaned[cleaned.length - 1])) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Remove dangling leading/trailing quotes if present.
  cleaned = cleaned.replace(/^[\"'“”‘’`]+/, "").replace(/[\"'“”‘’`]+$/, "").trim();

  return cleaned || collapsed;
}

function toTitle(prompt: string): string {
  if (!prompt) return "Untitled chat";
  return prompt;
}

function saveChatHistory(history: ChatHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
  window.dispatchEvent(new CustomEvent(CHAT_HISTORY_UPDATED_EVENT));
}

function migrateLegacyHistory(): ChatHistoryEntry[] {
  if (typeof window === "undefined") return [];

  const legacyRaw = window.localStorage.getItem(LEGACY_CHAT_HISTORY_KEY);
  if (!legacyRaw) return [];

  try {
    const parsed = JSON.parse(legacyRaw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isChatHistoryEntry)
      .map((item) => {
        const moduleId = normalizeModule(item.module || "personal");
        const prompt = sanitizePrompt(item.prompt || item.preview || item.title);
        return {
          ...item,
          prompt,
          title: toTitle(prompt),
          preview: prompt.length > 90 ? `${prompt.slice(0, 90)}...` : prompt,
          module: moduleId,
          route: normalizeRoute(item.route, moduleId),
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

export function loadChatHistory(): ChatHistoryEntry[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(CHAT_HISTORY_KEY);
  if (!raw) {
    const migrated = migrateLegacyHistory();
    if (migrated.length > 0) saveChatHistory(migrated);
    return migrated;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isChatHistoryEntry)
      .map((item) => {
        const moduleId = normalizeModule(item.module || "personal");
        const prompt = sanitizePrompt(item.prompt || item.preview || item.title);
        return {
          ...item,
          prompt,
          title: toTitle(prompt),
          preview: prompt.length > 90 ? `${prompt.slice(0, 90)}...` : prompt,
          module: moduleId,
          route: normalizeRoute(item.route, moduleId),
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
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
  const history = loadChatHistory();
  const title = toTitle(prompt);
  const preview = prompt.length > 90 ? `${prompt.slice(0, 90)}...` : prompt;

  const existingIndex = history.findIndex(
    (item) => item.module === moduleId && item.title.toLowerCase() === title.toLowerCase()
  );

  const existing = existingIndex >= 0 ? history.splice(existingIndex, 1)[0] : null;
  const nextEntry: ChatHistoryEntry = {
    id: existing?.id || `chat-${Date.now()}`,
    title,
    preview,
    prompt,
    response: params.response?.trim() || existing?.response,
    timestamp: Date.now(),
    module: moduleId,
    route,
  };

  const nextHistory = [nextEntry, ...history].slice(0, MAX_HISTORY_ITEMS);
  saveChatHistory(nextHistory);
  return nextEntry;
}

export function addPersonalChatHistory(prompt: string): void {
  addChatHistoryEntry({ module: "personal", route: "/personal", prompt });
}

export function selectChatHistoryEntry(entry: ChatHistoryEntry): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHAT_HISTORY_SELECTED_KEY, JSON.stringify(entry));
  window.dispatchEvent(new CustomEvent(CHAT_HISTORY_SELECTED_EVENT));
}

export function getSelectedChatHistory(): ChatHistoryEntry | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CHAT_HISTORY_SELECTED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isChatHistoryEntry(parsed)) return null;

    const moduleId = normalizeModule(parsed.module || "general");
    return {
      ...parsed,
      prompt: sanitizePrompt(parsed.prompt || parsed.preview || parsed.title),
      title: toTitle(sanitizePrompt(parsed.prompt || parsed.preview || parsed.title)),
      preview: sanitizePrompt(parsed.prompt || parsed.preview || parsed.title),
      module: moduleId,
      route: normalizeRoute(parsed.route, moduleId),
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
