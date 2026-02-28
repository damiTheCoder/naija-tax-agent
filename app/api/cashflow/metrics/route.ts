import { NextRequest, NextResponse } from "next/server";
import { accountingEngine } from "@/lib/accounting/transactionBridge";

/**
 * Cashflow Metrics API for Clawdbot
 * 
 * Returns cashflow analysis based on accounting data.
 * Called by the cashos_get_cashflow tool.
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(request.url);
        const metric = searchParams.get("metric") || "all";

        // Get data from accounting engine
        const statements = accountingEngine.generateStatements();
        const state = accountingEngine.getState();

        // Calculate basic cashflow metrics
        const revenue = statements.revenue || 0;
        const expenses = (statements.costOfSales || 0) + (statements.operatingExpenses || 0);
        const netCashflow = revenue - expenses;

        // Calculate cash balance from cash/bank accounts
        let cashBalance = 0;
        const cashAccountCodes = ["1000", "1010", "1020"]; // Cash, Petty Cash, Bank
        state.ledgerAccounts.forEach((account, code) => {
            if (cashAccountCodes.includes(code)) {
                // Get balance from account
                const entries = state.journalEntries.filter(e =>
                    e.lines.some(l => l.accountCode === code)
                );
                entries.forEach(entry => {
                    entry.lines.forEach(line => {
                        if (line.accountCode === code) {
                            cashBalance += (line.debit || 0) - (line.credit || 0);
                        }
                    });
                });
            }
        });

        // Estimate burn rate (assuming 30-day period)
        const daysOfData = Math.max(state.journalEntries.length, 1);
        const dailyBurnRate = expenses / Math.max(daysOfData, 30);
        const netDailyBurnRate = Math.max(0, (expenses - revenue) / Math.max(daysOfData, 30));
        const runwayDays = cashBalance <= 0 ? 0 : netDailyBurnRate > 0 ? Math.round(cashBalance / netDailyBurnRate) : 999;

        let result: Record<string, unknown> = {
            asOf: new Date().toISOString(),
        };

        switch (metric) {
            case "position":
                result = {
                    ...result,
                    cashPosition: {
                        cashBalance: Math.round(cashBalance),
                        transactionCount: state.journalEntries.length,
                    },
                };
                break;

            case "burnrate":
                result = {
                    ...result,
                    burnRate: {
                        dailyBurn: Math.round(dailyBurnRate),
                        weeklyBurn: Math.round(dailyBurnRate * 7),
                        monthlyBurn: Math.round(dailyBurnRate * 30),
                        currency: "NGN",
                    },
                };
                break;

            case "runway":
                result = {
                    ...result,
                    runway: {
                        daysRemaining: runwayDays === 999 ? "Sustainable" : runwayDays,
                        cashBalance: Math.round(cashBalance),
                        dailyBurn: Math.round(dailyBurnRate),
                        runwayStatus: runwayDays > 90 ? "healthy" :
                            runwayDays > 30 ? "caution" : "critical",
                    },
                };
                break;

            case "safetosave":
                // Simple safe-to-save calculation: Cash - (3 months expenses)
                const reserveNeeded = dailyBurnRate * 90;
                const safeToSave = Math.max(0, cashBalance - reserveNeeded);

                result = {
                    ...result,
                    safeToSave: {
                        amount: Math.round(safeToSave),
                        recommendation: safeToSave > 0
                            ? `You can safely save ₦${Math.round(safeToSave).toLocaleString()}`
                            : "Build up more cash reserves before saving",
                    },
                };
                break;

            case "all":
            default:
                const reserve = dailyBurnRate * 90;
                const safe = Math.max(0, cashBalance - reserve);

                result = {
                    ...result,
                    summary: {
                        cashBalance: Math.round(cashBalance),
                        dailyBurnRate: Math.round(dailyBurnRate),
                        runwayDays: runwayDays === 999 ? "Sustainable" : runwayDays,
                        runwayStatus: runwayDays > 90 ? "healthy" :
                            runwayDays > 30 ? "caution" : "critical",
                        safeToSave: Math.round(safe),
                    },
                    details: {
                        totalRevenue: Math.round(revenue),
                        totalExpenses: Math.round(expenses),
                        netCashflow: Math.round(netCashflow),
                        transactionCount: state.journalEntries.length,
                    },
                };
        }

        return NextResponse.json({
            success: true,
            ...result,
        });

    } catch (error) {
        console.error("[Cashflow Metrics API] Error:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to get cashflow metrics",
        }, { status: 500 });
    }
}
