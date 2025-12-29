/**
 * =============================================================================
 * ANCHOR CASHFLOW INTELLIGENCE - TYPE DEFINITIONS
 * =============================================================================
 *
 * Core TypeScript interfaces for the Cash Intelligence & Automatic Reserve System.
 * These types support the four-layer Anchor architecture:
 * 1. Accounting Foundation (uses existing accounting types)
 * 2. Cashflow Intelligence
 * 3. Modelling & Decision Engine
 * 4. Automated Allocation
 */

import { JournalEntry } from "../accounting/doubleEntry";
import { StatementDraft } from "../accounting/types";

// =============================================================================
// CASH POSITION TYPES
// =============================================================================

/**
 * Real-time snapshot of cash position
 */
export interface CashPosition {
    /** Total cash in hand and bank */
    cashBalance: number;
    /** Amounts owed to the business */
    receivables: number;
    /** Amounts owed by the business */
    payables: number;
    /** Cash + Receivables - Payables */
    netPosition: number;
    /** Available cash (excluding receivables) */
    availableCash: number;
    /** Timestamp of calculation */
    calculatedAt: string;
    /** Period this snapshot covers */
    period: {
        start: string;
        end: string;
    };
}

// =============================================================================
// CASHFLOW METRICS TYPES
// =============================================================================

/**
 * Key cashflow performance indicators
 */
export interface CashflowMetrics {
    /** Average daily cash outflow (expenses) */
    burnRate: number;
    /** Average daily cash inflow (income) */
    surplusRate: number;
    /** Net daily cashflow (surplus - burn) */
    netCashflowRate: number;
    /** Days of runway at current burn rate */
    runwayDays: number;
    /** Weekly net cashflow */
    weeklyNetCashflow: number;
    /** Monthly net cashflow */
    monthlyNetCashflow: number;
    /** Period analyzed */
    periodDays: number;
    /** Status indicator */
    status: "healthy" | "caution" | "critical";
}

/**
 * Trend data point for visualizations
 */
export interface CashflowTrend {
    /** Period label (e.g., "Week 1", "Jan 2024") */
    label: string;
    /** Period start date */
    startDate: string;
    /** Period end date */
    endDate: string;
    /** Total inflows */
    inflows: number;
    /** Total outflows */
    outflows: number;
    /** Net cashflow */
    net: number;
    /** Opening balance */
    openingBalance: number;
    /** Closing balance */
    closingBalance: number;
}

// =============================================================================
// FORECASTING TYPES
// =============================================================================

export type ScenarioType = "conservative" | "base" | "optimistic";

/**
 * Forecast scenario projection
 */
export interface ForecastScenario {
    type: ScenarioType;
    /** Description of assumptions */
    description: string;
    /** Projected cashflow for next N periods */
    projections: ForecastPeriod[];
    /** Risk level of this scenario */
    riskLevel: "low" | "medium" | "high";
    /** Probability weight (0-1) */
    probability: number;
}

export interface ForecastPeriod {
    /** Period label */
    label: string;
    /** Projected inflows */
    projectedInflows: number;
    /** Projected outflows */
    projectedOutflows: number;
    /** Projected net */
    projectedNet: number;
    /** Projected ending balance */
    projectedBalance: number;
}

// =============================================================================
// SAFE-TO-SAVE CALCULATION
// =============================================================================

/**
 * Configuration for Safe-to-Save calculation
 */
export interface SafeToSaveConfig {
    /** Minimum cash buffer to maintain (in currency) */
    minimumBuffer: number;
    /** Number of days of runway to maintain */
    safetyRunwayDays: number;
    /** Known upcoming obligations */
    upcomingObligations: UpcomingObligation[];
    /** Risk tolerance level */
    riskTolerance: "conservative" | "moderate" | "aggressive";
}

export interface UpcomingObligation {
    id: string;
    description: string;
    amount: number;
    dueDate: string;
    isRecurring: boolean;
    frequency?: "weekly" | "monthly" | "quarterly" | "annually";
}

/**
 * Result of Safe-to-Save calculation
 */
export interface SafeToSaveResult {
    /** Amount safe to allocate */
    safeToSave: number;
    /** Breakdown of calculation */
    breakdown: {
        currentCash: number;
        requiredReserve: number;
        upcomingObligations: number;
        safetyBuffer: number;
    };
    /** Recommendation level */
    recommendation: "save" | "hold" | "caution";
    /** Explanation for non-technical users */
    explanation: string;
    /** Timestamp */
    calculatedAt: string;
}

// =============================================================================
// ALLOCATION TYPES
// =============================================================================

export type AllocationBucketType =
    | "operating"
    | "tax_reserve"
    | "emergency"
    | "growth"
    | "investment";

/**
 * An allocation bucket (virtual reserve)
 */
export interface AllocationBucket {
    id: string;
    type: AllocationBucketType;
    name: string;
    description: string;
    /** Current balance in this bucket */
    balance: number;
    /** Target balance (optional goal) */
    targetBalance?: number;
    /** Color for UI */
    color: string;
    /** Icon name */
    icon: string;
    /** Whether this bucket is active */
    isActive: boolean;
    /** Order for display */
    order: number;
}

/**
 * User-defined allocation rule
 */
export interface AllocationRule {
    id: string;
    bucketId: string;
    /** Percentage of Safe-to-Save to allocate (0-100) */
    percentage: number;
    /** Priority order (lower = higher priority) */
    priority: number;
    /** Whether rule is active */
    isActive: boolean;
    /** Optional cap on allocation */
    maxAmount?: number;
    /** Stop allocating once target is reached */
    stopAtTarget: boolean;
}

/**
 * Result of an allocation operation
 */
export interface AllocationResult {
    id: string;
    timestamp: string;
    totalAllocated: number;
    allocations: {
        bucketId: string;
        bucketName: string;
        amount: number;
        newBalance: number;
    }[];
    safeToSaveUsed: number;
    remainingCash: number;
}

/**
 * Historical allocation record
 */
export interface AllocationHistory {
    id: string;
    timestamp: string;
    type: "allocation" | "withdrawal" | "adjustment";
    bucketId: string;
    bucketName: string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    notes?: string;
    triggeredBy: "manual" | "rule";
}

// =============================================================================
// ENGINE STATE
// =============================================================================

/**
 * Complete state of the cashflow intelligence system
 */
export interface CashflowState {
    /** Current cash position */
    position: CashPosition | null;
    /** Current metrics */
    metrics: CashflowMetrics | null;
    /** Weekly trends (last 12 weeks) */
    weeklyTrends: CashflowTrend[];
    /** Monthly trends (last 12 months) */
    monthlyTrends: CashflowTrend[];
    /** Forecast scenarios */
    forecasts: ForecastScenario[];
    /** Safe-to-save calculation */
    safeToSave: SafeToSaveResult | null;
    /** Allocation buckets */
    buckets: AllocationBucket[];
    /** Allocation rules */
    rules: AllocationRule[];
    /** Allocation history */
    history: AllocationHistory[];
    /** Last updated timestamp */
    lastUpdated: string | null;
    /** Configuration */
    config: CashflowConfig;
}

/**
 * User configuration for the cashflow system
 */
export interface CashflowConfig {
    /** Safe-to-save configuration */
    safeToSave: SafeToSaveConfig;
    /** Currency symbol */
    currency: string;
    /** Fiscal year end (MM-DD) */
    fiscalYearEnd: string;
    /** Whether to show forecasts */
    showForecasts: boolean;
    /** Default trend period in weeks */
    defaultTrendWeeks: number;
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

export const DEFAULT_BUCKETS: AllocationBucket[] = [
    {
        id: "operating",
        type: "operating",
        name: "Operating Reserve",
        description: "Day-to-day business operations buffer",
        balance: 0,
        color: "#3B82F6", // blue
        icon: "building",
        isActive: true,
        order: 1,
    },
    {
        id: "tax_reserve",
        type: "tax_reserve",
        name: "Tax Reserve",
        description: "Set aside for upcoming tax obligations",
        balance: 0,
        color: "#8B5CF6", // purple
        icon: "receipt",
        isActive: true,
        order: 2,
    },
    {
        id: "emergency",
        type: "emergency",
        name: "Emergency Fund",
        description: "Safety net for unexpected situations",
        balance: 0,
        color: "#EF4444", // red
        icon: "shield",
        isActive: true,
        order: 3,
    },
    {
        id: "growth",
        type: "growth",
        name: "Growth Fund",
        description: "Capital for business expansion",
        balance: 0,
        color: "#10B981", // green
        icon: "trending-up",
        isActive: true,
        order: 4,
    },
    {
        id: "investment",
        type: "investment",
        name: "Investment Bucket",
        description: "Low-risk investment opportunities",
        balance: 0,
        color: "#F59E0B", // amber
        icon: "chart",
        isActive: false,
        order: 5,
    },
];

export const DEFAULT_SAFE_TO_SAVE_CONFIG: SafeToSaveConfig = {
    minimumBuffer: 500000, // ₦500,000 minimum
    safetyRunwayDays: 30, // 1 month runway
    upcomingObligations: [],
    riskTolerance: "conservative",
};

export const DEFAULT_CASHFLOW_CONFIG: CashflowConfig = {
    safeToSave: DEFAULT_SAFE_TO_SAVE_CONFIG,
    currency: "₦",
    fiscalYearEnd: "12-31",
    showForecasts: true,
    defaultTrendWeeks: 12,
};

export const DEFAULT_CASHFLOW_STATE: CashflowState = {
    position: null,
    metrics: null,
    weeklyTrends: [],
    monthlyTrends: [],
    forecasts: [],
    safeToSave: null,
    buckets: DEFAULT_BUCKETS,
    rules: [],
    history: [],
    lastUpdated: null,
    config: DEFAULT_CASHFLOW_CONFIG,
};
