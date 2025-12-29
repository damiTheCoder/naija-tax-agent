import { NextRequest, NextResponse } from "next/server";

/**
 * Bank Connection API - Callback Endpoint
 * 
 * Handles OAuth callback from bank after user authentication.
 * 
 * Flow:
 * 1. User completes authentication on bank's widget/OAuth
 * 2. Bank redirects here with auth code/token
 * 3. We exchange code for access token (Mono/Okra)
 * 4. Store connection details in database
 * 5. Redirect user back to bank connections page
 */

export interface CallbackQuery {
    code?: string;           // OAuth authorization code
    connectionId?: string;   // Our connection ID
    account_id?: string;     // Mono account ID
    record_id?: string;      // Okra record ID
    error?: string;          // Error from provider
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;

    const code = searchParams.get("code");
    const connectionId = searchParams.get("connectionId");
    const accountId = searchParams.get("account_id");
    const recordId = searchParams.get("record_id");
    const error = searchParams.get("error");

    // Handle errors
    if (error) {
        console.error("Bank connection error:", error);
        return NextResponse.redirect(
            new URL(`/accounting/banks?error=${encodeURIComponent(error)}`, request.url)
        );
    }

    try {
        /**
         * PRODUCTION IMPLEMENTATION:
         * 
         * For Mono (when receiving code from widget):
         * const mono = new MonoClient(process.env.MONO_SECRET_KEY);
         * const accountData = await mono.getAccountId(code);
         * // Store: accountData.id, connection status, etc.
         * 
         * For Okra:
         * const okra = new OkraClient(process.env.OKRA_SECRET_KEY);
         * const authData = await okra.getAuth(recordId);
         * // Store: authData.customer, authData.bank, etc.
         * 
         * Database storage:
         * await db.bankConnections.create({
         *   userId: session.user.id,
         *   bankCode: bankCode,
         *   providerAccountId: accountData.id,
         *   accessToken: encrypted(accountData.token),
         *   status: "connected",
         *   connectedAt: new Date(),
         * });
         */

        // For demo: just redirect back with success
        const successUrl = new URL("/accounting/banks", request.url);
        successUrl.searchParams.set("connected", "true");
        if (connectionId) {
            successUrl.searchParams.set("connectionId", connectionId);
        }
        if (accountId) {
            successUrl.searchParams.set("accountId", accountId);
        }

        return NextResponse.redirect(successUrl);
    } catch (err) {
        console.error("Callback processing error:", err);
        return NextResponse.redirect(
            new URL("/accounting/banks?error=callback_failed", request.url)
        );
    }
}

// POST - Alternative callback for providers that use POST
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        /**
         * PRODUCTION: Handle webhook-style callbacks
         * 
         * Mono sends webhooks for:
         * - mono.events.account_connected
         * - mono.events.account_updated
         * - mono.events.reauthorisation_required
         * 
         * Okra sends webhooks for:
         * - CALLBACK_SUCCESSFUL
         * - TRANSACTIONS_UPDATED
         */

        console.log("Received POST callback:", body);

        return NextResponse.json({
            success: true,
            message: "Callback received"
        });
    } catch (error) {
        console.error("POST callback error:", error);
        return NextResponse.json(
            { success: false, message: "Callback processing failed" },
            { status: 500 }
        );
    }
}
