import { NextRequest, NextResponse } from "next/server";
import { chatConversationRepo } from "@/lib/chat/server";

export const runtime = "nodejs";

type CreateConversationBody = {
  id?: string;
  entityId?: string;
  module?: string;
  route?: string;
  title?: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
};

const readEntityId = (request: NextRequest): string => {
  const { searchParams } = new URL(request.url);
  const fromQuery = searchParams.get("entityId");
  return (fromQuery || request.headers.get("x-ql-entity-id") || "entity-default").trim() || "entity-default";
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = readEntityId(request);
    const module = searchParams.get("module") || undefined;
    const route = searchParams.get("route") || undefined;
    const cursor = searchParams.get("cursor") || undefined;
    const limit = Number(searchParams.get("limit") || 25);

    const result = await chatConversationRepo.list({
      entityId,
      module,
      route,
      cursor,
      limit,
    });

    return NextResponse.json({
      success: true,
      entityId,
      conversations: result.conversations,
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    console.error("[Chat Conversations API] GET Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list conversations",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as CreateConversationBody;
    const entityId = (body.entityId || readEntityId(request) || "entity-default").trim() || "entity-default";

    const conversation = await chatConversationRepo.create({
      id: body.id,
      entityId,
      module: body.module || "general",
      route: body.route || "/dashboard",
      title: body.title,
      createdBy: body.createdBy,
      metadata: body.metadata,
    });

    return NextResponse.json({
      success: true,
      entityId,
      conversation,
    });
  } catch (error) {
    console.error("[Chat Conversations API] POST Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create conversation",
      },
      { status: 500 }
    );
  }
}
