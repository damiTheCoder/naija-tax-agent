import { NextRequest, NextResponse } from "next/server";
import { createPocketBaseAdminClient } from "@/lib/pocketbase/adminClient";
import { POCKETBASE_USAGE_EVENTS_COLLECTION } from "@/lib/pocketbase/config";
import { getServerSession } from "@/lib/pocketbase/session";

type UsagePayload = {
  eventType?: string;
  module?: string;
  path?: string;
  metadata?: Record<string, unknown>;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_USAGE_TRACKING !== "true") {
      return NextResponse.json({ success: true, skipped: true });
    }

    const session = await getServerSession();
    const payload = (await request.json()) as UsagePayload;
    if (!payload.eventType) {
      return NextResponse.json({ success: false, error: "eventType is required." }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "";
    const userAgent = request.headers.get("user-agent") || "";

    const pb = await createPocketBaseAdminClient();
    await pb.collection(POCKETBASE_USAGE_EVENTS_COLLECTION).create({
      user: session?.userId || null,
      eventType: payload.eventType,
      module: payload.module || "unknown",
      path: payload.path || "",
      metadata: payload.metadata || {},
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Usage tracking should never break user actions.
    const message = error instanceof Error ? error.message : "Failed to track event";
    return NextResponse.json({ success: false, error: message }, { status: 200 });
  }
}
