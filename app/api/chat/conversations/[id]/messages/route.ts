import { NextRequest, NextResponse } from "next/server";
import { chatConversationRepo } from "@/lib/chat/server";

export const runtime = "nodejs";

type PutMessagesBody = {
  entityId?: string;
  messages?: Array<{
    id?: string;
    role: "user" | "assistant";
    content: string;
    timestamp?: number;
    metadata?: Record<string, unknown>;
  }>;
};

const readEntityId = (request: NextRequest, fallback?: string): string => {
  const { searchParams } = new URL(request.url);
  return (
    (searchParams.get("entityId") ||
      fallback ||
      request.headers.get("x-ql-entity-id") ||
      "entity-default")
      .trim() || "entity-default"
  );
};

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as PutMessagesBody;
    const entityId = readEntityId(request, body.entityId);
    const conversation = await chatConversationRepo.replaceMessages({
      entityId,
      conversationId: id,
      messages: Array.isArray(body.messages) ? body.messages : [],
    });

    if (!conversation) {
      return NextResponse.json(
        {
          success: false,
          error: "Conversation not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      entityId,
      conversation,
      messageCount: conversation.messages.length,
    });
  } catch (error) {
    console.error("[Chat Messages API] PUT Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to replace chat messages",
      },
      { status: 500 }
    );
  }
}
