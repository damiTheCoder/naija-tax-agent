import { NextRequest, NextResponse } from "next/server";

/**
 * Clawdbot Chat Gateway
 * 
 * Main endpoint for Clawdbot AI integration.
 * Forwards user messages to Clawdbot daemon and returns AI responses.
 */

const CLAWDBOT_API_URL = process.env.CLAWDBOT_API_URL || "http://localhost:8080";
const CLAWDBOT_API_KEY = process.env.CLAWDBOT_API_KEY || "";

interface ChatRequest {
    message: string;
    userId?: string;
    context?: {
        module?: string;
        companyId?: string;
        [key: string]: unknown;
    };
}

interface ClawdbotResponse {
    reply: string;
    actions?: Array<{
        tool: string;
        result: unknown;
    }>;
    error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body: ChatRequest = await request.json();

        if (!body.message || typeof body.message !== "string") {
            return NextResponse.json(
                { error: "Message is required" },
                { status: 400 }
            );
        }

        // Build context for Clawdbot
        const clawdbotPayload = {
            message: body.message,
            user_id: body.userId || "default_user",
            context: {
                app: "cashos",
                module: body.context?.module || "general",
                company_id: body.context?.companyId,
                cashos_base_url: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
                ...body.context,
            },
        };

        // Call Clawdbot API
        const clawdbotResponse = await fetch(`${CLAWDBOT_API_URL}/api/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(CLAWDBOT_API_KEY && { Authorization: `Bearer ${CLAWDBOT_API_KEY}` }),
            },
            body: JSON.stringify(clawdbotPayload),
        });

        if (!clawdbotResponse.ok) {
            console.error("[Clawdbot] API error:", clawdbotResponse.status, clawdbotResponse.statusText);

            // Fallback: Return helpful message when Clawdbot is unavailable
            return NextResponse.json({
                reply: "I'm having trouble connecting to my AI brain right now. Please check that Clawdbot is running (`clawdbot daemon start`) and try again.",
                actions: [],
                fallback: true,
            });
        }

        const data: ClawdbotResponse = await clawdbotResponse.json();

        return NextResponse.json({
            reply: data.reply || "I didn't get a response. Please try again.",
            actions: data.actions || [],
        });

    } catch (error) {
        console.error("[Clawdbot] Chat error:", error);

        return NextResponse.json({
            reply: "Sorry, I encountered an error processing your request. Please ensure Clawdbot is running and try again.",
            actions: [],
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
}

// Health check endpoint
export async function GET(): Promise<NextResponse> {
    try {
        const healthCheck = await fetch(`${CLAWDBOT_API_URL}/health`, {
            method: "GET",
            headers: {
                ...(CLAWDBOT_API_KEY && { Authorization: `Bearer ${CLAWDBOT_API_KEY}` }),
            },
        });

        if (healthCheck.ok) {
            return NextResponse.json({ status: "connected", clawdbot: "running" });
        }

        return NextResponse.json({ status: "disconnected", clawdbot: "not_running" }, { status: 503 });
    } catch {
        return NextResponse.json({ status: "disconnected", clawdbot: "unreachable" }, { status: 503 });
    }
}
