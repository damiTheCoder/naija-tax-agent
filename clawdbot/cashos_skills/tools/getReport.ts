/**
 * CashOS Get Report Tool for Clawdbot
 * 
 * Generates financial reports from CashOS.
 * Calls the CashOS /api/reports endpoint.
 */

const CASHOS_BASE_URL = process.env.CASHOS_BASE_URL || "http://localhost:3000";

type ReportType = "pl" | "balance_sheet" | "cashflow" | "trial_balance" | "summary";

interface GetReportInput {
    type: ReportType;
    period?: string;
}

interface ReportResult {
    success: boolean;
    report?: Record<string, unknown>;
    error?: string;
}

/**
 * Generate a financial report from CashOS
 */
export async function cashos_get_report(input: GetReportInput): Promise<ReportResult> {
    try {
        const params = new URLSearchParams({
            type: input.type,
            ...(input.period && { period: input.period }),
        });

        const response = await fetch(`${CASHOS_BASE_URL}/api/reports?${params}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            return { success: false, error: data.error || "Failed to generate report" };
        }

        return { success: true, report: data.report };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
}

export const toolDefinition = {
    name: "cashos_get_report",
    description: "Generate financial reports (P&L, Balance Sheet, Cash Flow) from CashOS.",
    parameters: {
        type: "object",
        properties: {
            type: {
                type: "string",
                enum: ["pl", "balance_sheet", "cashflow", "trial_balance", "summary"],
                description: "Type of financial report",
            },
            period: { type: "string", description: "Report period" },
        },
        required: ["type"],
    },
    handler: cashos_get_report,
};

export default cashos_get_report;
