/**
 * =============================================================================
 * ANCHOR ALLOCATION ENGINE
 * =============================================================================
 *
 * Manages allocation of surplus cash into designated reserve buckets.
 * Supports manual allocation with user-defined rules.
 */

import {
    AllocationBucket,
    AllocationRule,
    AllocationResult,
    AllocationHistory,
    SafeToSaveResult,
    DEFAULT_BUCKETS,
} from "./types";
import { cashflowEngine } from "./cashflowEngine";

// =============================================================================
// ALLOCATION CALCULATIONS
// =============================================================================

/**
 * Calculate allocation amounts based on rules and safe-to-save amount
 */
export function calculateAllocation(
    safeToSave: number,
    buckets: AllocationBucket[],
    rules: AllocationRule[]
): { bucketId: string; amount: number }[] {
    if (safeToSave <= 0) return [];

    const allocations: { bucketId: string; amount: number }[] = [];
    let remaining = safeToSave;

    // Sort rules by priority
    const sortedRules = [...rules]
        .filter((r) => r.isActive)
        .sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
        if (remaining <= 0) break;

        const bucket = buckets.find((b) => b.id === rule.bucketId);
        if (!bucket || !bucket.isActive) continue;

        // Calculate allocation amount
        let amount = (safeToSave * rule.percentage) / 100;

        // Apply max amount cap if set
        if (rule.maxAmount && amount > rule.maxAmount) {
            amount = rule.maxAmount;
        }

        // Stop at target if configured
        if (rule.stopAtTarget && bucket.targetBalance) {
            const spaceToTarget = bucket.targetBalance - bucket.balance;
            if (spaceToTarget <= 0) continue;
            amount = Math.min(amount, spaceToTarget);
        }

        // Don't exceed remaining
        amount = Math.min(amount, remaining);

        if (amount > 0) {
            allocations.push({ bucketId: bucket.id, amount });
            remaining -= amount;
        }
    }

    return allocations;
}

/**
 * Execute allocation - updates bucket balances and records history
 */
export function executeAllocation(
    safeToSave: SafeToSaveResult,
    buckets: AllocationBucket[],
    rules: AllocationRule[],
    notes?: string
): AllocationResult {
    const timestamp = new Date().toISOString();
    const allocations = calculateAllocation(safeToSave.safeToSave, buckets, rules);

    const result: AllocationResult = {
        id: `alloc-${Date.now()}`,
        timestamp,
        totalAllocated: 0,
        allocations: [],
        safeToSaveUsed: safeToSave.safeToSave,
        remainingCash: safeToSave.breakdown.currentCash,
    };

    for (const alloc of allocations) {
        const bucket = buckets.find((b) => b.id === alloc.bucketId);
        if (!bucket) continue;

        const balanceBefore = bucket.balance;
        const newBalance = balanceBefore + alloc.amount;

        // Update bucket in engine
        cashflowEngine.updateBucketBalance(alloc.bucketId, alloc.amount);

        // Add history entry
        const historyEntry: Omit<AllocationHistory, "id"> = {
            timestamp,
            type: "allocation",
            bucketId: bucket.id,
            bucketName: bucket.name,
            amount: alloc.amount,
            balanceBefore,
            balanceAfter: newBalance,
            notes,
            triggeredBy: "manual",
        };
        cashflowEngine.addHistoryEntry(historyEntry);

        result.allocations.push({
            bucketId: bucket.id,
            bucketName: bucket.name,
            amount: alloc.amount,
            newBalance,
        });
        result.totalAllocated += alloc.amount;
    }

    result.remainingCash -= result.totalAllocated;

    return result;
}

/**
 * Withdraw from a bucket
 */
export function withdrawFromBucket(
    bucketId: string,
    amount: number,
    notes?: string
): boolean {
    const state = cashflowEngine.getState();
    const bucket = state.buckets.find((b) => b.id === bucketId);

    if (!bucket || amount > bucket.balance) {
        return false;
    }

    const balanceBefore = bucket.balance;
    cashflowEngine.updateBucketBalance(bucketId, -amount);

    const historyEntry: Omit<AllocationHistory, "id"> = {
        timestamp: new Date().toISOString(),
        type: "withdrawal",
        bucketId: bucket.id,
        bucketName: bucket.name,
        amount: -amount,
        balanceBefore,
        balanceAfter: balanceBefore - amount,
        notes,
        triggeredBy: "manual",
    };
    cashflowEngine.addHistoryEntry(historyEntry);

    return true;
}

/**
 * Create default allocation rules
 */
export function createDefaultRules(): AllocationRule[] {
    return [
        {
            id: "rule-operating",
            bucketId: "operating",
            percentage: 30,
            priority: 1,
            isActive: true,
            stopAtTarget: false,
        },
        {
            id: "rule-tax",
            bucketId: "tax_reserve",
            percentage: 25,
            priority: 2,
            isActive: true,
            stopAtTarget: false,
        },
        {
            id: "rule-emergency",
            bucketId: "emergency",
            percentage: 25,
            priority: 3,
            isActive: true,
            stopAtTarget: true,
        },
        {
            id: "rule-growth",
            bucketId: "growth",
            percentage: 20,
            priority: 4,
            isActive: true,
            stopAtTarget: false,
        },
    ];
}

/**
 * Get allocation summary for display
 */
export function getAllocationSummary(buckets: AllocationBucket[]): {
    totalAllocated: number;
    byBucket: { name: string; balance: number; percentage: number; color: string }[];
} {
    const totalAllocated = buckets.reduce((sum, b) => sum + b.balance, 0);

    const byBucket = buckets
        .filter((b) => b.isActive)
        .map((b) => ({
            name: b.name,
            balance: b.balance,
            percentage: totalAllocated > 0 ? (b.balance / totalAllocated) * 100 : 0,
            color: b.color,
        }));

    return { totalAllocated, byBucket };
}

// Functions are exported inline above
