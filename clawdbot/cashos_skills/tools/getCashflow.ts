/**
 * CashOS Get Cashflow Tool for Clawdbot
 * 
 * Gets cashflow metrics (burn rate, runway, safe-to-save).
 * Calls the CashOS /api/cashflow/metrics endpoint.
 */

const CASHOS_BASE_URL = process.env.CASHOS_BASE_URL || "http://localhost:3000";

type MetricType = "position" | "burnrate" | "runway" | "trends" | "safetosave" | "forecast" | "all";

interface GetCashflowInput {
    metric?: MetricType;
    period?: number;
}

interface CashflowResult {
    success: boolean;
    metrics?: Record<string, unknown>;
    error?: string;
}

/**
 * Get cashflow metrics from CashOS
 */
export async function cashos_get_cashflow(input: GetCashflowInput = {}): Promise<CashflowResult> {
    try {
        const params = new URLSearchParams({
            ...(input.metric && { metric: input.metric }),
            ...(input.period && { period: input.period.toString() }),
        });

        const response = await fetch(`${CASHOS_BASE_URL}/api/cashflow/metrics?${params}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            return { success: false, error: data.error || "Failed to get cashflow metrics" };
        }

        return { success: true, metrics: data };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
}

export const toolDefinition = {
    name: "cashos_get_cashflow",
    description: "Get cashflow metrics: burn rate, runway (days of cash), safe-to-save recommendations.",
    parameters: {
        type: "object",
        properties: {
            metric: {
                type: "string",
                enum: ["position", "burnrate", "runway", "trends", "safetosave", "forecast", "all"],
                description: "Specific metric to retrieve",
            },
            period: { type: "number", description: "Days to analyze (default: 30)" },
        },
        required: [],
    },
    handler: cashos_get_cashflow,
};

export default cashos_get_cashflow;
