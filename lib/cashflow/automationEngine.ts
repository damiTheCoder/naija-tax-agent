/**
 * Cashflow Automation Engine
 * Manages investment and savings automation rules
 */

import { TBILLS_RATES, SAVINGS_RATE, calculateTBillsAnnualReturn, calculateSavingsReturn } from './investmentCalculator';

// =============================================================================
// TYPES
// =============================================================================

export interface AutomationRule {
    id: string;
    name: string;
    type: 'tbills' | 'savings' | 'money-market';
    percentOfInflow: number;
    tenor?: '91-day' | '182-day' | '364-day';
    isActive: boolean;
    createdAt: string;
    lastTriggeredAt?: string;
}

export interface AutomationState {
    rules: AutomationRule[];
    totalAllocated: number; // Total % allocated across all rules
    projectedMonthlyReturn: number;
    projectedAnnualReturn: number;
    lastUpdated: string;
}

export interface EmbeddedFinanceProduct {
    id: string;
    name: string;
    category: 'savings' | 'investment' | 'loans' | 'stocks' | 'banking';
    description: string;
    logoUrl: string;
    color: string; // Primary brand color for styling
    annualRate?: number; // For savings/investment products
    externalUrl: string;
}

// =============================================================================
// EMBEDDED FINANCE PRODUCTS
// =============================================================================

export const EMBEDDED_FINANCE_PRODUCTS: EmbeddedFinanceProduct[] = [
    {
        id: 'piggyvest',
        name: 'Piggyvest',
        category: 'savings',
        description: 'Save & Invest',
        logoUrl: '/Piggyvest.png',
        color: '#1e3c72',
        annualRate: 13.0,
        externalUrl: 'https://piggyvest.com',
    },
    {
        id: 'cowrywise',
        name: 'Cowrywise',
        category: 'investment',
        description: 'Wealth Management',
        logoUrl: '/Cowrywise.png',
        color: '#6c5ce7',
        annualRate: 15.0,
        externalUrl: 'https://cowrywise.com',
    },
    {
        id: 'risevest',
        name: 'Risevest',
        category: 'investment',
        description: 'Dollar Investments',
        logoUrl: '/Rise.png',
        color: '#0f9d58',
        annualRate: 12.0,
        externalUrl: 'https://risevest.com',
    },
    {
        id: 'bamboo',
        name: 'Bamboo',
        category: 'stocks',
        description: 'US Stocks',
        logoUrl: '/Bamboo.png',
        color: '#6366f1',
        annualRate: undefined,
        externalUrl: 'https://investbamboo.com',
    },
    {
        id: 'kuda',
        name: 'Kuda',
        category: 'banking',
        description: 'Digital Banking',
        logoUrl: '/Kuda.png',
        color: '#40196d',
        annualRate: 4.0,
        externalUrl: 'https://kuda.com',
    },
    {
        id: 'fairmoney',
        name: 'FairMoney',
        category: 'loans',
        description: 'Quick Loans',
        logoUrl: '/fairmoney.png',
        color: '#00c853',
        externalUrl: 'https://fairmoney.io',
    },
];

// =============================================================================
// AUTOMATION ENGINE CLASS
// =============================================================================

const STORAGE_KEY = 'insight::cashflow-automations';

class CashflowAutomationEngine {
    private state: AutomationState;
    private listeners: Set<(state: AutomationState) => void> = new Set();

    constructor() {
        this.state = {
            rules: [],
            totalAllocated: 0,
            projectedMonthlyReturn: 0,
            projectedAnnualReturn: 0,
            lastUpdated: new Date().toISOString(),
        };
    }

    // Load from localStorage
    load(): void {
        if (typeof window === 'undefined') return;
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.state = {
                    ...this.state,
                    ...parsed,
                    rules: parsed.rules || [],
                };
            } catch {
                // Ignore malformed data
            }
        }
    }

    // Save to localStorage
    private persist(): void {
        if (typeof window === 'undefined') return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    }

    // Subscribe to state changes
    subscribe(listener: (state: AutomationState) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        this.state.lastUpdated = new Date().toISOString();
        this.listeners.forEach(listener => listener(this.state));
        this.persist();
    }

    // Get current state
    getState(): AutomationState {
        return this.state;
    }

    // Add a new automation rule
    addRule(rule: Omit<AutomationRule, 'id' | 'createdAt'>): AutomationRule {
        const newRule: AutomationRule = {
            ...rule,
            id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            createdAt: new Date().toISOString(),
        };

        this.state.rules.push(newRule);
        this.recalculateTotals();
        this.notify();
        return newRule;
    }

    // Update a rule
    updateRule(id: string, updates: Partial<AutomationRule>): void {
        const index = this.state.rules.findIndex(r => r.id === id);
        if (index !== -1) {
            this.state.rules[index] = { ...this.state.rules[index], ...updates };
            this.recalculateTotals();
            this.notify();
        }
    }

    // Delete a rule
    deleteRule(id: string): void {
        this.state.rules = this.state.rules.filter(r => r.id !== id);
        this.recalculateTotals();
        this.notify();
    }

    // Toggle rule active state
    toggleRule(id: string): void {
        const rule = this.state.rules.find(r => r.id === id);
        if (rule) {
            rule.isActive = !rule.isActive;
            this.recalculateTotals();
            this.notify();
        }
    }

    // Calculate projected returns based on monthly inflow
    calculateProjectedReturns(monthlyInflow: number): {
        monthlyReturn: number;
        annualReturn: number;
        byRule: { ruleId: string; monthlyReturn: number; annualReturn: number }[];
    } {
        const byRule: { ruleId: string; monthlyReturn: number; annualReturn: number }[] = [];
        let totalMonthly = 0;
        let totalAnnual = 0;

        for (const rule of this.state.rules.filter(r => r.isActive)) {
            const monthlyInvestment = (monthlyInflow * rule.percentOfInflow) / 100;
            let annualReturn = 0;

            if (rule.type === 'tbills' && rule.tenor) {
                const result = calculateTBillsAnnualReturn(monthlyInvestment, rule.tenor);
                annualReturn = result.totalReturn;
            } else if (rule.type === 'savings') {
                const result = calculateSavingsReturn(monthlyInvestment, 12);
                annualReturn = result.interestEarned;
            } else if (rule.type === 'money-market') {
                // Assume ~12% for money market
                annualReturn = monthlyInvestment * 12 * 0.12 * 0.5; // Average 6-month exposure
            }

            const monthlyReturn = annualReturn / 12;
            byRule.push({ ruleId: rule.id, monthlyReturn, annualReturn });
            totalMonthly += monthlyReturn;
            totalAnnual += annualReturn;
        }

        return {
            monthlyReturn: Math.round(totalMonthly),
            annualReturn: Math.round(totalAnnual),
            byRule,
        };
    }

    // Recalculate totals
    private recalculateTotals(): void {
        const activeRules = this.state.rules.filter(r => r.isActive);
        this.state.totalAllocated = activeRules.reduce((sum, r) => sum + r.percentOfInflow, 0);
    }

    // Reset all rules
    reset(): void {
        this.state = {
            rules: [],
            totalAllocated: 0,
            projectedMonthlyReturn: 0,
            projectedAnnualReturn: 0,
            lastUpdated: new Date().toISOString(),
        };
        this.notify();
    }

    // Parse natural language for automation
    parseAutomationFromChat(message: string): Partial<AutomationRule> | null {
        const msg = message.toLowerCase();

        // Pattern: "invest X% in tbills" or "save X% of inflow"
        const percentMatch = msg.match(/(\d+(?:\.\d+)?)\s*%/);
        if (!percentMatch) return null;

        const percent = parseFloat(percentMatch[1]);
        if (percent <= 0 || percent > 100) return null;

        let type: AutomationRule['type'] = 'savings';
        let tenor: AutomationRule['tenor'] | undefined;
        let name = '';

        if (msg.includes('tbill') || msg.includes('t-bill') || msg.includes('treasury')) {
            type = 'tbills';
            if (msg.includes('91') || msg.includes('3 month')) {
                tenor = '91-day';
                name = `Invest ${percent}% in 91-day T-Bills`;
            } else if (msg.includes('182') || msg.includes('6 month')) {
                tenor = '182-day';
                name = `Invest ${percent}% in 182-day T-Bills`;
            } else {
                tenor = '364-day';
                name = `Invest ${percent}% in 364-day T-Bills`;
            }
        } else if (msg.includes('money market') || msg.includes('mmf')) {
            type = 'money-market';
            name = `Invest ${percent}% in Money Market`;
        } else if (msg.includes('save') || msg.includes('saving')) {
            type = 'savings';
            name = `Save ${percent}% of inflow`;
        } else {
            // Default to savings
            type = 'savings';
            name = `Save ${percent}% automatically`;
        }

        return {
            name,
            type,
            percentOfInflow: percent,
            tenor,
            isActive: true,
        };
    }
}

// Singleton instance
export const automationEngine = new CashflowAutomationEngine();

// =============================================================================
// CHAT RESPONSE HELPERS
// =============================================================================

export function generateAutomationResponse(rule: AutomationRule, monthlyInflow: number): string {
    const monthlyAmount = (monthlyInflow * rule.percentOfInflow) / 100;
    let rate = SAVINGS_RATE;

    if (rule.type === 'tbills' && rule.tenor) {
        rate = TBILLS_RATES.find(t => t.id === rule.tenor)?.rate || 20.65;
    } else if (rule.type === 'money-market') {
        rate = 12.0;
    }

    const annualReturn = monthlyAmount * 12 * (rate / 100) * 0.5; // Average exposure

    return `✅ **Automation Created!**

**${rule.name}**
- Monthly allocation: ₦${monthlyAmount.toLocaleString()}
- Investment type: ${rule.type === 'tbills' ? `T-Bills (${rule.tenor})` : rule.type === 'money-market' ? 'Money Market Fund' : 'Savings'}
- Expected rate: ${rate.toFixed(2)}% p.a.
- Projected 12-month return: ₦${Math.round(annualReturn).toLocaleString()}

This automation will run on each cash inflow.`;
}

export function generateReturnsSummary(
    rules: AutomationRule[],
    monthlyInflow: number
): string {
    if (rules.length === 0) {
        return "You don't have any investment automations set up yet. Try saying something like \"Invest 5% of my inflow in T-Bills\" or \"Save 10% automatically\".";
    }

    const activeRules = rules.filter(r => r.isActive);
    if (activeRules.length === 0) {
        return "All your automations are currently paused. Toggle them on to start investing automatically.";
    }

    let totalMonthly = 0;
    let totalAnnual = 0;
    const breakdown: string[] = [];

    for (const rule of activeRules) {
        const monthlyAmount = (monthlyInflow * rule.percentOfInflow) / 100;
        let rate = SAVINGS_RATE;

        if (rule.type === 'tbills' && rule.tenor) {
            rate = TBILLS_RATES.find(t => t.id === rule.tenor)?.rate || 20.65;
        }

        const annualReturn = monthlyAmount * 12 * (rate / 100) * 0.5;
        totalAnnual += annualReturn;
        totalMonthly += annualReturn / 12;

        breakdown.push(`- **${rule.name}**: ₦${Math.round(monthlyAmount).toLocaleString()}/mo → ₦${Math.round(annualReturn).toLocaleString()}/yr`);
    }

    return `📊 **Your Investment Returns**

${breakdown.join('\n')}

**Total Projected Returns:**
- Monthly: ~₦${Math.round(totalMonthly).toLocaleString()}
- Annual: ~₦${Math.round(totalAnnual).toLocaleString()}

_Based on current Nigerian rates and your ₦${monthlyInflow.toLocaleString()} monthly inflow._`;
}
