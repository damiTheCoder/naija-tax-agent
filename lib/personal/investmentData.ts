import { ConnectedApp } from "@/lib/ConnectedAppsContext";

export interface PortfolioMetrics {
    totalValue: number;
    cumulativeReturn: number;
    averageRoi: number;
    monthlyInflow: number;
}

export interface PlatformInvestment {
    id: string;
    name: string;
    balance: number;
    returnValue: number;
    roi: number;
    color: string;
    icon: string;
}

// Simulated data based on SYSTEM_PROMPT in action.ts
const SIMULATED_DATA: Record<string, { balance: number; returns: number; roi: number }> = {
    "risevest": { balance: 9400000, returns: 1128000, roi: 12.0 },
    "bamboo": { balance: 3100000, returns: 465000, roi: 15.0 },
    "cowrywise": { balance: 850000, returns: 127500, roi: 15.0 },
    "piggyvest": { balance: 1200000, returns: 156000, roi: 13.0 },
    "carbon": { balance: 1800000, returns: 180000, roi: 10.0 },
    "zenith": { balance: 8450000, returns: 0, roi: 0 },
    "gtb": { balance: 4230000, returns: 846000, roi: 20.0 }, // Treasury Bills
};

export function getPortfolioMetrics(connectedApps: ConnectedApp[]): PortfolioMetrics {
    const connectedIds = connectedApps.filter(app => app.status === "connected").map(app => app.id);

    let totalValue = 0;
    let totalReturns = 0;
    let weightedRoiSum = 0;

    connectedIds.forEach(id => {
        const data = SIMULATED_DATA[id];
        if (data) {
            totalValue += data.balance;
            totalReturns += data.returns;
            weightedRoiSum += (data.roi * data.balance);
        }
    });

    return {
        totalValue,
        cumulativeReturn: totalReturns,
        averageRoi: totalValue > 0 ? weightedRoiSum / totalValue : 0,
        monthlyInflow: 8450000 + 4230000, // Based on Zenith + GTB in prompt
    };
}

export function getPlatformInvestments(connectedApps: ConnectedApp[]): PlatformInvestment[] {
    return connectedApps
        .filter(app => app.status === "connected" && (app.type === "Investment" || app.type === "Savings" || app.type === "DeFi Wallet"))
        .map(app => {
            const data = SIMULATED_DATA[app.id] || { balance: 0, returns: 0, roi: 0 };
            return {
                id: app.id,
                name: app.name,
                balance: data.balance,
                returnValue: data.returns,
                roi: data.roi,
                color: app.accent,
                icon: app.initial,
            };
        });
}

export function getAssetAllocation(connectedApps: ConnectedApp[]) {
    return getPlatformInvestments(connectedApps).map(inv => ({
        name: inv.name,
        value: inv.balance,
        color: inv.color
    }));
}

export function getMonthlyPerformance() {
    return [
        { month: "Sep", returns: 420000, inflow: 1200000 },
        { month: "Oct", returns: 380000, inflow: 1100000 },
        { month: "Nov", returns: 510000, inflow: 1400000 },
        { month: "Dec", returns: 720000, inflow: 2100000 },
        { month: "Jan", returns: 680000, inflow: 1800000 },
        { month: "Feb", returns: 840000, inflow: 2500000 },
    ];
}

export function formatNaira(amount: number): string {
    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}
