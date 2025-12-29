import { NextRequest, NextResponse } from "next/server";

/**
 * Bank Connection API - Connect Endpoint
 * 
 * Initiates a connection to a bank via Open Banking API.
 * In production, this would integrate with providers like:
 * - Mono (Nigeria) - https://mono.co
 * - Okra - https://okra.ng
 * - Stitch (Africa) - https://stitch.money
 * 
 * Flow:
 * 1. Frontend calls POST /api/bank-connections/connect with bankCode
 * 2. Backend returns widget URL or OAuth redirect URL
 * 3. User completes authentication on bank's side
 * 4. Bank redirects to /api/bank-connections/callback with auth code
 */

// Types for Open Banking integration
export interface ConnectRequest {
    bankCode: string;
    returnUrl?: string;
    customerId?: string;
}

export interface ConnectResponse {
    success: boolean;
    connectionId?: string;
    widgetUrl?: string;
    redirectUrl?: string;
    message?: string;
}

// Mock bank configurations - replace with actual provider configs
const BANK_CONFIG: Record<string, { provider: string; supported: boolean }> = {
    zenith: { provider: "mono", supported: true },
    gtbank: { provider: "mono", supported: true },
    access: { provider: "mono", supported: true },
    firstbank: { provider: "okra", supported: true },
    uba: { provider: "okra", supported: true },
    stanbic: { provider: "manual", supported: true },
    fcmb: { provider: "manual", supported: true },
    fidelity: { provider: "manual", supported: true },
};

export async function POST(request: NextRequest) {
    try {
        const body: ConnectRequest = await request.json();
        const { bankCode, returnUrl } = body;

        if (!bankCode) {
            return NextResponse.json(
                { success: false, message: "Bank code is required" },
                { status: 400 }
            );
        }

        const bankConfig = BANK_CONFIG[bankCode];
        if (!bankConfig || !bankConfig.supported) {
            return NextResponse.json(
                { success: false, message: "Bank not supported" },
                { status: 400 }
            );
        }

        // Generate a unique connection ID
        const connectionId = `conn_${bankCode}_${Date.now()}`;

        /**
         * PRODUCTION IMPLEMENTATION:
         * 
         * For Mono:
         * const mono = new MonoClient(process.env.MONO_SECRET_KEY);
         * const widgetSession = await mono.createWidgetSession({
         *   customer: customerId,
         *   scope: "auth",
         *   reauth_token: null,
         * });
         * return { widgetUrl: `https://connect.mono.co/?key=${process.env.MONO_PUBLIC_KEY}&session=${widgetSession.id}` };
         * 
         * For Okra:
         * const okra = new OkraClient(process.env.OKRA_SECRET_KEY);
         * const widgetUrl = okra.buildWidgetUrl({
         *   name: "Your App",
         *   env: process.env.NODE_ENV === "production" ? "production" : "sandbox",
         *   app_id: process.env.OKRA_APP_ID,
         *   key: process.env.OKRA_PUBLIC_KEY,
         *   products: ["auth", "transactions", "balance"],
         *   callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/bank-connections/callback`,
         * });
         */

        // For demo: return mock widget URL
        const callbackUrl = returnUrl || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/accounting/banks`;

        const response: ConnectResponse = {
            success: true,
            connectionId,
            // In production, this would be the actual widget URL from Mono/Okra
            widgetUrl: `/api/bank-connections/demo-widget?connectionId=${connectionId}&bank=${bankCode}&callback=${encodeURIComponent(callbackUrl)}`,
            message: `Initiating connection to ${bankCode}`,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error("Bank connection error:", error);
        return NextResponse.json(
            { success: false, message: "Failed to initiate bank connection" },
            { status: 500 }
        );
    }
}

// GET - Health check
export async function GET() {
    return NextResponse.json({
        status: "ok",
        supportedProviders: ["mono", "okra", "manual"],
        supportedBanks: Object.keys(BANK_CONFIG).filter(k => BANK_CONFIG[k].supported),
    });
}
