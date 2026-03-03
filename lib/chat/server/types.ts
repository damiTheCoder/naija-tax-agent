export interface ChatMessageRecord {
  id: string;
  role: "user" | "assistant";
  content: string;
  sequence: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface ChatConversationRecord {
  id: string;
  entityId: string;
  module: string;
  route: string;
  title: string;
  preview: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessageRecord[];
}

export interface ListChatConversationsInput {
  entityId: string;
  module?: string;
  route?: string;
  limit?: number;
  cursor?: string;
}

export interface ListChatConversationsResult {
  conversations: ChatConversationRecord[];
  nextCursor: string | null;
}

export interface CreateChatConversationInput {
  entityId: string;
  module: string;
  route: string;
  title?: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
  id?: string;
}

export interface UpdateChatConversationInput {
  entityId: string;
  conversationId: string;
  title?: string;
  module?: string;
  route?: string;
  metadata?: Record<string, unknown>;
}

export interface ReplaceChatMessagesInput {
  entityId: string;
  conversationId: string;
  messages: Array<{
    id?: string;
    role: "user" | "assistant";
    content: string;
    timestamp?: number;
    metadata?: Record<string, unknown>;
  }>;
}
