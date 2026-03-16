import { NextRequest, NextResponse } from "next/server";
import { accountingEngine } from "@/lib/accounting/transactionBridge";

/**
 * Reports API
 * 
 * Generates financial reports (P&L, Balance Sheet, Cashflow).
 * Called by the cashos_get_report tool.
 */

type ReportType = "pl" | "pnl" | "profit_loss" | "balance_sheet" | "cashflow" | "trial_balance" | "summary";

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(request.url);
        const reportType = (searchParams.get("type") || "summary").toLowerCase() as ReportType;
        const period = searchParams.get("period") || "current";

        // Generate statements using the accounting engine
        const statements = accountingEngine.generateStatements();
        const state = accountingEngine.getState();

        // Calculate net profit from statements
        const revenue = statements.revenue || 0;
        const costOfSales = statements.costOfSales || 0;
        const operatingExpenses = statements.operatingExpenses || 0;
        const grossProfit = revenue - costOfSales;
        const netProfit = grossProfit - operatingExpenses;

        let report: Record<string, unknown>;

        switch (reportType) {
            case "pl":
            case "pnl":
            case "profit_loss":
                report = {
                    type: "Profit & Loss Statement",
                    period,
                    revenue: revenue,
                    costOfSales: costOfSales,
                    grossProfit: grossProfit,
                    operatingExpenses: operatingExpenses,
                    netProfit: netProfit,
                };
                break;

            case "balance_sheet":
                report = {
                    type: "Statement of Financial Position",
                    period,
                    assets: statements.assets || 0,
                    liabilities: statements.liabilities || 0,
                    equity: statements.equity || 0,
                };
                break;

            case "cashflow":
                // Calculate simple cashflow from journal entries
                let totalInflows = 0;
                let totalOutflows = 0;

                state.journalEntries.forEach(entry => {
                    entry.lines.forEach(line => {
                        // Inflows: debits to cash/bank accounts
                        if (line.accountCode.startsWith("1") && line.debit > 0) {
                            totalInflows += line.debit;
                        }
                        // Outflows: credits from cash/bank accounts
                        if (line.accountCode.startsWith("1") && line.credit > 0) {
                            totalOutflows += line.credit;
                        }
                    });
                });

                report = {
                    type: "Cash Flow Statement",
                    period,
                    operatingActivities: {
                        inflows: totalInflows,
                        outflows: totalOutflows,
                        net: totalInflows - totalOutflows,
                    },
                    netCashChange: totalInflows - totalOutflows,
                };
                break;

            case "trial_balance":
                // Build trial balance from journal entries
                const balances: Record<string, { name: string; debit: number; credit: number }> = {};

                state.journalEntries.forEach(entry => {
                    entry.lines.forEach(line => {
                        if (!balances[line.accountCode]) {
                            balances[line.accountCode] = {
                                name: line.accountName,
                                debit: 0,
                                credit: 0,
                            };
                        }
                        balances[line.accountCode].debit += line.debit || 0;
                        balances[line.accountCode].credit += line.credit || 0;
                    });
                });

                const trialBalance = Object.entries(balances)
                    .filter(([_, bal]) => bal.debit !== bal.credit)
                    .map(([code, bal]) => ({
                        code,
                        name: bal.name,
                        debit: bal.debit > bal.credit ? bal.debit - bal.credit : 0,
                        credit: bal.credit > bal.debit ? bal.credit - bal.debit : 0,
                    }))
                    .sort((a, b) => a.code.localeCompare(b.code));

                const totalDebits = trialBalance.reduce((sum, a) => sum + a.debit, 0);
                const totalCredits = trialBalance.reduce((sum, a) => sum + a.credit, 0);

                report = {
                    type: "Trial Balance",
                    period,
                    accounts: trialBalance,
                    totalDebits,
                    totalCredits,
                    balanced: Math.abs(totalDebits - totalCredits) < 0.01,
                };
                break;

            case "summary":
            default:
                report = {
                    type: "Financial Summary",
                    period,
                    overview: {
                        revenue: revenue,
                        expenses: costOfSales + operatingExpenses,
                        netProfit: netProfit,
                        assets: statements.assets || 0,
                        liabilities: statements.liabilities || 0,
                    },
                    transactionCount: state.journalEntries.length,
                    lastUpdated: state.lastUpdated,
                };
        }

        return NextResponse.json({
            success: true,
            report,
        });

    } catch (error) {
        console.error("[Reports API] Error:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Failed to generate report",
        }, { status: 500 });
    }
}
