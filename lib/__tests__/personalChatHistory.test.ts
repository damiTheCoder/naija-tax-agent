import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  clearSelectedChatHistory,
  consumeSelectedChatHistory,
  createChatConversation,
  deleteChatConversation,
  getSelectedChatHistory,
  loadChatConversations,
  renameChatConversation,
  saveChatConversationMessages,
  selectChatConversation,
  type ChatConversationMessage,
} from "@/lib/personalChatHistory";

const CHAT_CONVERSATIONS_KEY = "quantum-chat-conversations-v2";
const CHAT_HISTORY_KEY = "quantum-personal-chat-history";

const originalWindow = (globalThis as { window?: unknown }).window;

const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
};

const createMockWindow = () => {
  const storage = createMemoryStorage();
  const listeners = new Map<string, Set<EventListener>>();
  const win = {
    localStorage: storage,
    addEventListener(type: string, listener: EventListener) {
      if (!listeners.has(type)) listeners.set(type, new Set<EventListener>());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event: Event) {
      listeners.get(event.type)?.forEach((listener) => listener(event));
      return true;
    },
  };
  return win;
};

const makeMessages = (seed: string): ChatConversationMessage[] => [
  {
    id: `${seed}-u`,
    role: "user",
    content: `User prompt ${seed}`,
    timestamp: Date.now(),
  },
  {
    id: `${seed}-a`,
    role: "assistant",
    content: `Assistant reply ${seed}`,
    timestamp: Date.now() + 1,
  },
];

describe("personal chat history routing + restore", () => {
  beforeEach(() => {
    const mockWindow = createMockWindow();
    (globalThis as unknown as { window: typeof mockWindow }).window = mockWindow;
    clearSelectedChatHistory();
    vi.useRealTimers();
  });

  afterEach(() => {
    if (originalWindow) {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
  });

  test("loads all conversations globally and preserves route metadata", () => {
    const accountingConversation = createChatConversation({
      module: "accounting",
      route: "/accounting",
      title: "Accounting thread",
    });
    saveChatConversationMessages({
      conversationId: accountingConversation.id,
      module: "accounting",
      route: "/accounting",
      messages: makeMessages("acct"),
    });

    const taxConversation = createChatConversation({
      module: "tax",
      route: "/tax/workspace",
      title: "Tax thread",
    });
    saveChatConversationMessages({
      conversationId: taxConversation.id,
      module: "tax",
      route: "/tax/workspace",
      messages: makeMessages("tax"),
    });

    const all = loadChatConversations();
    expect(all.length).toBe(2);
    expect(all.some((item) => item.route === "/accounting")).toBe(true);
    expect(all.some((item) => item.route === "/tax/workspace")).toBe(true);

    // Validate persistence mirrors summary key used by history UI.
    expect(window.localStorage.getItem(CHAT_CONVERSATIONS_KEY)).toBeTruthy();
    expect(window.localStorage.getItem(CHAT_HISTORY_KEY)).toBeTruthy();
  });

  test("selected conversation is consumed only on matching route", () => {
    const conversation = createChatConversation({
      module: "tax",
      route: "/tax/workspace",
      title: "Tax workspace thread",
    });
    saveChatConversationMessages({
      conversationId: conversation.id,
      module: "tax",
      route: "/tax/workspace",
      messages: makeMessages("route"),
    });

    selectChatConversation(conversation.id);
    const selected = getSelectedChatHistory();
    expect(selected?.conversationId).toBe(conversation.id);
    expect(selected?.route).toBe("/tax/workspace");

    // Wrong route should not consume the pending selection.
    const wrongRoute = consumeSelectedChatHistory({ pathname: "/accounting" });
    expect(wrongRoute).toBeNull();
    expect(getSelectedChatHistory()?.conversationId).toBe(conversation.id);

    // Matching route consumes and clears selection.
    const matched = consumeSelectedChatHistory({ pathname: "/tax/workspace" });
    expect(matched?.conversationId).toBe(conversation.id);
    expect(getSelectedChatHistory()).toBeNull();
  });

  test("can rename and delete a conversation", () => {
    const conversation = createChatConversation({
      module: "accounting",
      route: "/accounting",
      title: "Original title",
    });
    saveChatConversationMessages({
      conversationId: conversation.id,
      module: "accounting",
      route: "/accounting",
      messages: makeMessages("rename"),
    });

    const renamed = renameChatConversation({
      conversationId: conversation.id,
      title: "Renamed chat title",
    });
    expect(renamed?.title).toContain("Renamed chat title");

    const afterRename = loadChatConversations();
    expect(afterRename.find((item) => item.id === conversation.id)?.title).toContain("Renamed chat title");

    selectChatConversation(conversation.id);
    expect(getSelectedChatHistory()?.conversationId).toBe(conversation.id);

    const deleted = deleteChatConversation(conversation.id);
    expect(deleted).toBe(true);
    expect(loadChatConversations().find((item) => item.id === conversation.id)).toBeUndefined();
    expect(getSelectedChatHistory()).toBeNull();
  });
});
