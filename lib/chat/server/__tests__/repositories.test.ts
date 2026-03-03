import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@/lib/server/prisma";
import { chatConversationRepo } from "@/lib/chat/server";

const ENTITY_ID = "entity-test-chat";

const cleanup = async () => {
  await prisma.chatConversation.deleteMany({ where: { entityId: ENTITY_ID } });
  await prisma.entity.deleteMany({ where: { id: ENTITY_ID } });
};

beforeEach(async () => {
  await cleanup();
});

describe("chat conversation repository", () => {
  test("create/list/get/update/delete lifecycle works", async () => {
    const created = await chatConversationRepo.create({
      entityId: ENTITY_ID,
      module: "accounting",
      route: "/accounting",
      title: "Post office rent",
      id: "conv-chat-001",
    });

    expect(created.id).toBe("conv-chat-001");
    expect(created.title).toContain("Post office rent");

    const listed = await chatConversationRepo.list({
      entityId: ENTITY_ID,
      module: "accounting",
      limit: 10,
    });
    expect(listed.conversations.length).toBe(1);
    expect(listed.conversations[0].id).toBe(created.id);

    const fetched = await chatConversationRepo.get(ENTITY_ID, created.id);
    expect(fetched?.id).toBe(created.id);

    const renamed = await chatConversationRepo.update({
      entityId: ENTITY_ID,
      conversationId: created.id,
      title: "Renamed thread",
    });
    expect(renamed?.title).toContain("Renamed thread");

    const deleted = await chatConversationRepo.delete(ENTITY_ID, created.id);
    expect(deleted).toBe(true);

    const afterDelete = await chatConversationRepo.get(ENTITY_ID, created.id);
    expect(afterDelete).toBeNull();
  });

  test("message snapshot upsert preserves order and content", async () => {
    const conversation = await chatConversationRepo.create({
      entityId: ENTITY_ID,
      module: "tax",
      route: "/tax/workspace",
      title: "VAT help",
      id: "conv-chat-002",
    });

    const saved = await chatConversationRepo.replaceMessages({
      entityId: ENTITY_ID,
      conversationId: conversation.id,
      messages: [
        {
          id: "m1",
          role: "user",
          content: "Record VAT purchase",
          timestamp: Date.UTC(2026, 2, 1, 10, 0, 0),
        },
        {
          id: "m2",
          role: "assistant",
          content: "Posted successfully with receipt.",
          timestamp: Date.UTC(2026, 2, 1, 10, 0, 1),
        },
      ],
    });

    expect(saved).not.toBeNull();
    expect(saved?.messages.length).toBe(2);
    expect(saved?.messages[0].id).toBe("m1");
    expect(saved?.messages[1].id).toBe("m2");
    expect(saved?.preview.toLowerCase()).toContain("receipt");
  });
});
