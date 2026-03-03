import { NextRequest, NextResponse } from "next/server";
import { chatConversationRepo } from "@/lib/chat/server";

export const runtime = "nodejs";

type UpdateConversationBody = {
  entityId?: string;
  title?: string;
  module?: string;
  route?: string;
  metadata?: Record<string, unknown>;
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const entityId = readEntityId(request);
    const conversation = await chatConversationRepo.get(entityId, id);
    if (!conversation) {
      return NextResponse.json(
        {
          success: false,
          error: "Conversation not found",
        },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, entityId, conversation });
  } catch (error) {
    console.error("[Chat Conversation API] GET Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch conversation",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as UpdateConversationBody;
    const entityId = readEntityId(request, body.entityId);

    const conversation = await chatConversationRepo.update({
      entityId,
      conversationId: id,
      title: body.title,
      module: body.module,
      route: body.route,
      metadata: body.metadata,
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
    });
  } catch (error) {
    console.error("[Chat Conversation API] PATCH Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update conversation",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const entityId = readEntityId(request);
    const deleted = await chatConversationRepo.delete(entityId, id);
    if (!deleted) {
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
      conversationId: id,
      deleted: true,
    });
  } catch (error) {
    console.error("[Chat Conversation API] DELETE Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete conversation",
      },
      { status: 500 }
    );
  }
}
