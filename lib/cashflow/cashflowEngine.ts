/**
 * =============================================================================
 * ANCHOR CASHFLOW INTELLIGENCE ENGINE
 * =============================================================================
 *
 * Core calculation engine for the Cash Intelligence & Automatic Reserve System.
 * Transforms accounting data into actionable cashflow insights.
 *
 * Data Sources:
 * - Journal entries from the accounting module
 * - Financial statements (StatementDraft)
 * - Trial balance data
 */

import { JournalEntry, CHART_OF_ACCOUNTS } from "../accounting/doubleEntry";
import { AccountingState } from "../accounting/transactionBridge";
import { StatementDraft } from "../accounting/types";
import {
    CashPosition,
    CashflowMetrics,
    CashflowTrend,
    ForecastScenario,
    ForecastPeriod,
    SafeToSaveConfig,
    SafeToSaveResult,
    CashflowState,
    DEFAULT_CASHFLOW_STATE,
    DEFAULT_SAFE_TO_SAVE_CONFIG,
    ScenarioType,
} from "./types";

// =============================================================================
// CASH POSITION CALCULATIONS
// =============================================================================

/**
 * Calculate the current cash position from accounting state
 */
export function calculateCashPosition(state: AccountingState): CashPosition {
    const now = new Date().toISOString();
    const ledgerAccounts = state.ledgerAccounts;

    // Get cash accounts (1000-1099 range typically)
    let cashBalance = 0;
    let receivables = 0;
    let payables = 0;

    // ledgerAccounts is a Map<string, LedgerAccount>
    if (ledgerAccounts && ledgerAccounts.size > 0) {
        ledgerAccounts.forEach((account, code) => {
            const balance = account.closingBalance || 0;

            // Cash accounts (1000-1099)
            if (code.startsWith("10")) {
                cashBalance += balance;
            }
            // Receivables (1100-1199)
            else if (code.startsWith("11")) {
                receivables += balance;
            }
            // Payables - Current Liabilities (2000-2199)
            else if (code.startsWith("20") || code.startsWith("21")) {
                // Liabilities have credit normal balance, so positive = owed
                payables += Math.abs(balance);
            }
        });
    }

    const netPosition = cashBalance + receivables - payables;
    const availableCash = cashBalance;

    // Determine period from journal entries
    const entries = state.journalEntries || [];
    const dates = entries.map((e) => new Date(e.date).getTime()).filter((d) => !isNaN(d));
    const minDate = dates.length ? new Date(Math.min(...dates)).toISOString().split("T")[0] : now.split("T")[0];
    const maxDate = dates.length ? new Date(Math.max(...dates)).toISOString().split("T")[0] : now.split("T")[0];

    return {
        cashBalance,
        receivables,
        payables,
        netPosition,
        availableCash,
        calculatedAt: now,
        period: {
            start: minDate,
            end: maxDate,
        },
    };
}

// =============================================================================
// CASHFLOW METRICS CALCULATIONS
// =============================================================================

/**
 * Calculate burn rate (average daily expenses) from journal entries
 */
export function calculateBurnRate(entries: JournalEntry[], days: number): number {
    if (entries.length === 0 || days <= 0) return 0;

    // Sum all expense debits (expense accounts have debit normal balance)
    let totalExpenses = 0;

    for (const entry of entries) {
        for (const line of entry.lines) {
            const account = CHART_OF_ACCOUNTS.find((a) => a.code === line.accountCode);
            if (account?.type === "expense" && line.debit > 0) {
                totalExpenses += line.debit;
            }
        }
    }

    return totalExpenses / days;
}

/**
 * Calculate surplus rate (average daily income) from journal entries
 */
export function calculateSurplusRate(entries: JournalEntry[], days: number): number {
    if (entries.length === 0 || days <= 0) return 0;

    // Sum all income credits (income accounts have credit normal balance)
    let totalIncome = 0;

    for (const entry of entries) {
        for (const line of entry.lines) {
            const account = CHART_OF_ACCOUNTS.find((a) => a.code === line.accountCode);
            if (account?.type === "income" && line.credit > 0) {
                totalIncome += line.credit;
            }
        }
    }

    return totalIncome / days;
}

/**
 * Calculate runway in days based on available cash and burn rate
 */
export function calculateRunway(availableCash: number, burnRate: number): number {
    if (burnRate <= 0) return Infinity;
    if (availableCash <= 0) return 0;
    return Math.floor(availableCash / burnRate);
}

/**
 * Calculate comprehensive cashflow metrics
 */
export function calculateCashflowMetrics(
    state: AccountingState,
    periodDays: number = 30
): CashflowMetrics {
    const entries = state.journalEntries;

    // Filter entries to the analysis period
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);
    const recentEntries = entries.filter(
        (e) => new Date(e.date) >= cutoffDate
    );

    const actualDays = periodDays;
    const burnRate = calculateBurnRate(recentEntries, actualDays);
    const surplusRate = calculateSurplusRate(recentEntries, actualDays);
    const netCashflowRate = surplusRate - burnRate;

    const position = calculateCashPosition(state);
    const runwayDays = calculateRunway(position.availableCash, burnRate);

    // Calculate weekly and monthly projections
    const weeklyNetCashflow = netCashflowRate * 7;
    const monthlyNetCashflow = netCashflowRate * 30;

    // Determine status
    let status: "healthy" | "caution" | "critical";
    if (runwayDays > 90 && netCashflowRate >= 0) {
        status = "healthy";
    } else if (runwayDays > 30 || netCashflowRate >= 0) {
        status = "caution";
    } else {
        status = "critical";
    }

    return {
        burnRate,
        surplusRate,
        netCashflowRate,
        runwayDays: runwayDays === Infinity ? 999 : runwayDays,
        weeklyNetCashflow,
        monthlyNetCashflow,
        periodDays: actualDays,
        status,
    };
}

// =============================================================================
// TREND ANALYSIS
// =============================================================================

/**
 * Calculate weekly cashflow trends
 */
export function calculateWeeklyTrends(
    entries: JournalEntry[],
    weeks: number = 12
): CashflowTrend[] {
    const trends: CashflowTrend[] = [];
    const now = new Date();

    for (let w = weeks - 1; w >= 0; w--) {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - w * 7);
        weekEnd.setHours(23, 59, 59, 999);

        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);

        const weekEntries = entries.filter((e) => {
            const date = new Date(e.date);
            return date >= weekStart && date <= weekEnd;
        });

        let inflows = 0;
        let outflows = 0;

        for (const entry of weekEntries) {
            for (const line of entry.lines) {
                const account = CHART_OF_ACCOUNTS.find((a) => a.code === line.accountCode);
                if (account?.type === "income" && line.credit > 0) {
                    inflows += line.credit;
                }
                if (account?.type === "expense" && line.debit > 0) {
                    outflows += line.debit;
                }
            }
        }

        trends.push({
            label: `Week ${weeks - w}`,
            startDate: weekStart.toISOString().split("T")[0],
            endDate: weekEnd.toISOString().split("T")[0],
            inflows,
            outflows,
            net: inflows - outflows,
            openingBalance: 0, // Would need running balance tracking
            closingBalance: 0,
        });
    }

    return trends;
}

/**
 * Calculate monthly cashflow trends
 */
export function calculateMonthlyTrends(
    entries: JournalEntry[],
    months: number = 12
): CashflowTrend[] {
    const trends: CashflowTrend[] = [];
    const now = new Date();

    for (let m = months - 1; m >= 0; m--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);

        const monthEntries = entries.filter((e) => {
            const date = new Date(e.date);
            return date >= monthStart && date <= monthEnd;
        });

        let inflows = 0;
        let outflows = 0;

        for (const entry of monthEntries) {
            for (const line of entry.lines) {
                const account = CHART_OF_ACCOUNTS.find((a) => a.code === line.accountCode);
                if (account?.type === "income" && line.credit > 0) {
                    inflows += line.credit;
                }
                if (account?.type === "expense" && line.debit > 0) {
                    outflows += line.debit;
                }
            }
        }

        const monthLabel = monthStart.toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
        });

        trends.push({
            label: monthLabel,
            startDate: monthStart.toISOString().split("T")[0],
            endDate: monthEnd.toISOString().split("T")[0],
            inflows,
            outflows,
            net: inflows - outflows,
            openingBalance: 0,
            closingBalance: 0,
        });
    }

    return trends;
}

// =============================================================================
// FORECASTING
// =============================================================================

/**
 * Generate forecast scenario based on historical data
 */
export function generateForecast(
    state: AccountingState,
    type: ScenarioType,
    periodsAhead: number = 3
): ForecastScenario {
    const metrics = calculateCashflowMetrics(state, 90); // Use 90-day historical
    const position = calculateCashPosition(state);

    // Adjustment factors based on scenario type
    const factors: Record<ScenarioType, { income: number; expense: number; prob: number }> = {
        conservative: { income: 0.8, expense: 1.2, prob: 0.3 },
        base: { income: 1.0, expense: 1.0, prob: 0.5 },
        optimistic: { income: 1.2, expense: 0.9, prob: 0.2 },
    };

    const factor = factors[type];
    const projections: ForecastPeriod[] = [];
    let runningBalance = position.availableCash;

    for (let p = 1; p <= periodsAhead; p++) {
        const projectedInflows = metrics.surplusRate * 30 * factor.income;
        const projectedOutflows = metrics.burnRate * 30 * factor.expense;
        const projectedNet = projectedInflows - projectedOutflows;
        runningBalance += projectedNet;

        projections.push({
            label: `Month ${p}`,
            projectedInflows,
            projectedOutflows,
            projectedNet,
            projectedBalance: Math.max(0, runningBalance),
        });
    }

    const descriptions: Record<ScenarioType, string> = {
        conservative: "Revenue down 20%, expenses up 20% - stress test",
        base: "Trends continue as current rates",
        optimistic: "Revenue up 20%, expenses down 10% - growth scenario",
    };

    const riskLevels: Record<ScenarioType, "low" | "medium" | "high"> = {
        conservative: "high",
        base: "medium",
        optimistic: "low",
    };

    return {
        type,
        description: descriptions[type],
        projections,
        riskLevel: riskLevels[type],
        probability: factor.prob,
    };
}

// =============================================================================
// SAFE-TO-SAVE CALCULATION
// =============================================================================

/**
 * Calculate the amount that is safe to allocate to reserves
 *
 * Formula:
 * Safe-to-Save = Available Cash - Required Reserve - Upcoming Obligations - Safety Buffer
 */
export function calculateSafeToSave(
    position: CashPosition,
    metrics: CashflowMetrics,
    config: SafeToSaveConfig = DEFAULT_SAFE_TO_SAVE_CONFIG
): SafeToSaveResult {
    const now = new Date();

    // Calculate required reserve (based on safety runway)
    const requiredReserve = metrics.burnRate * config.safetyRunwayDays;

    // Sum upcoming obligations within safety window
    const obligationWindow = new Date();
    obligationWindow.setDate(obligationWindow.getDate() + config.safetyRunwayDays);

    const upcomingObligationsTotal = config.upcomingObligations
        .filter((o) => new Date(o.dueDate) <= obligationWindow)
        .reduce((sum, o) => sum + o.amount, 0);

    // Apply safety buffer
    const safetyBuffer = config.minimumBuffer;

    // Calculate safe-to-save
    const safeToSave = Math.max(
        0,
        position.availableCash - requiredReserve - upcomingObligationsTotal - safetyBuffer
    );

    // Determine recommendation
    let recommendation: "save" | "hold" | "caution";
    let explanation: string;

    if (safeToSave > position.availableCash * 0.3) {
        recommendation = "save";
        explanation = `You have ₦${safeToSave.toLocaleString()} that can safely be allocated to reserves. This maintains your ${config.safetyRunwayDays}-day runway and covers upcoming obligations.`;
    } else if (safeToSave > 0) {
        recommendation = "hold";
        explanation = `A smaller amount of ₦${safeToSave.toLocaleString()} is available for allocation. Consider building up your cash position first.`;
    } else {
        recommendation = "caution";
        explanation = `Current cash levels don't allow for safe allocation. Focus on maintaining operations and improving cashflow.`;
    }

    return {
        safeToSave,
        breakdown: {
            currentCash: position.availableCash,
            requiredReserve,
            upcomingObligations: upcomingObligationsTotal,
            safetyBuffer,
        },
        recommendation,
        explanation,
        calculatedAt: now.toISOString(),
    };
}

// =============================================================================
// ENGINE STATE MANAGEMENT
// =============================================================================

const STORAGE_KEY = "insight::cashflow-state";

/**
 * Main cashflow engine class with state management
 */
class CashflowEngine {
    private state: CashflowState;
    private subscribers: Set<(state: CashflowState) => void>;

    constructor() {
        this.state = { ...DEFAULT_CASHFLOW_STATE };
        this.subscribers = new Set();
    }

    /**
     * Load persisted state from localStorage
     */
    load(): void {
        if (typeof window === "undefined") return;

        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.state = {
                    ...DEFAULT_CASHFLOW_STATE,
                    ...parsed,
                    config: {
                        ...DEFAULT_CASHFLOW_STATE.config,
                        ...(parsed.config || {}),
                    },
                };
            } catch (e) {
                console.error("[CashflowEngine] Failed to load state:", e);
            }
        }
    }

    /**
     * Save current state to localStorage
     */
    private persist(): void {
        if (typeof window === "undefined") return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    }

    /**
     * Notify all subscribers of state change
     */
    private notify(): void {
        this.subscribers.forEach((cb) => cb(this.state));
    }

    /**
     * Subscribe to state changes
     */
    subscribe(callback: (state: CashflowState) => void): () => void {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    /**
     * Get current state
     */
    getState(): CashflowState {
        return this.state;
    }

    /**
     * Refresh all calculations from accounting data
     */
    refresh(accountingState: AccountingState): void {
        const position = calculateCashPosition(accountingState);
        const metrics = calculateCashflowMetrics(accountingState);
        const weeklyTrends = calculateWeeklyTrends(accountingState.journalEntries, 12);
        const monthlyTrends = calculateMonthlyTrends(accountingState.journalEntries, 12);

        const forecasts: ForecastScenario[] = [
            generateForecast(accountingState, "conservative"),
            generateForecast(accountingState, "base"),
            generateForecast(accountingState, "optimistic"),
        ];

        const safeToSave = calculateSafeToSave(position, metrics, this.state.config.safeToSave);

        this.state = {
            ...this.state,
            position,
            metrics,
            weeklyTrends,
            monthlyTrends,
            forecasts,
            safeToSave,
            lastUpdated: new Date().toISOString(),
        };

        this.persist();
        this.notify();
    }

    /**
     * Update bucket balance
     */
    updateBucketBalance(bucketId: string, amount: number): void {
        this.state.buckets = this.state.buckets.map((b) =>
            b.id === bucketId ? { ...b, balance: b.balance + amount } : b
        );
        this.persist();
        this.notify();
    }

    /**
     * Add allocation history entry
     */
    addHistoryEntry(entry: Omit<import("./types").AllocationHistory, "id">): void {
        const newEntry = {
            ...entry,
            id: `alloc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
        this.state.history = [newEntry, ...this.state.history].slice(0, 100);
        this.persist();
        this.notify();
    }

    /**
     * Update allocation rules
     */
    updateRules(rules: import("./types").AllocationRule[]): void {
        this.state.rules = rules;
        this.persist();
        this.notify();
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<import("./types").CashflowConfig>): void {
        this.state.config = { ...this.state.config, ...config };
        this.persist();
        this.notify();
    }

    /**
     * Clear all data
     */
    reset(): void {
        this.state = { ...DEFAULT_CASHFLOW_STATE };
        this.persist();
        this.notify();
    }
}

// Singleton instance
export const cashflowEngine = new CashflowEngine();

// Functions are exported inline above
