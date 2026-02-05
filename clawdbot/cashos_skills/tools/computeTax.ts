/**
 * CashOS Compute Tax Tool for Clawdbot
 * 
 * Computes Nigerian taxes (VAT, WHT, CIT, etc.).
 * Calls the CashOS /api/tax/compute endpoint.
 */

const CASHOS_BASE_URL = process.env.CASHOS_BASE_URL || "http://localhost:3000";

type TaxType = "vat" | "wht" | "cit" | "paye" | "cgt" | "all";

interface ComputeTaxInput {
    taxType?: TaxType;
    year?: number;
    turnover?: number;
}

interface TaxResult {
    success: boolean;
    result?: Record<string, unknown>;
    error?: string;
}

/**
 * Compute Nigerian taxes from CashOS
 */
export async function cashos_compute_tax(input: ComputeTaxInput = {}): Promise<TaxResult> {
    try {
        const response = await fetch(`${CASHOS_BASE_URL}/api/tax/compute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                taxType: input.taxType || "all",
                year: input.year,
                turnover: input.turnover,
            }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            return { success: false, error: data.error || "Failed to compute tax" };
        }

        return { success: true, result: data };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
}

export const toolDefinition = {
    name: "cashos_compute_tax",
    description: "Compute Nigerian taxes (VAT at 7.5%, WHT at 10%, CIT based on company size).",
    parameters: {
        type: "object",
        properties: {
            taxType: {
                type: "string",
                enum: ["vat", "wht", "cit", "paye", "cgt", "all"],
                description: "Type of tax to compute",
            },
            year: { type: "number", description: "Tax year" },
            turnover: { type: "number", description: "Company turnover for CIT calculation" },
        },
        required: [],
    },
    handler: cashos_compute_tax,
};

export default cashos_compute_tax;
