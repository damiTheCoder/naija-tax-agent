"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface ConnectedApp {
    id: string;
    name: string;
    type: string;
    description: string;
    status: "connected" | "disconnected";
    accent: string;
    initial: string;
    logo?: string;
    lastSync?: string;
    impact?: string;
}

function isConnectedApp(value: unknown): value is ConnectedApp {
    if (!value || typeof value !== "object") return false;
    const app = value as Partial<ConnectedApp>;
    return (
        typeof app.id === "string" &&
        typeof app.name === "string" &&
        typeof app.type === "string" &&
        typeof app.description === "string" &&
        (app.status === "connected" || app.status === "disconnected") &&
        typeof app.accent === "string" &&
        typeof app.initial === "string"
    );
}

function mergeWithDefaults(storedApps: ConnectedApp[]): ConnectedApp[] {
    const defaultById = new Map(DEFAULT_APPS.map((app) => [app.id, app]));
    const merged = storedApps.map((storedApp) => {
        const defaultApp = defaultById.get(storedApp.id);
        return defaultApp ? { ...defaultApp, ...storedApp, logo: storedApp.logo || defaultApp.logo } : storedApp;
    });
    const existingIds = new Set(merged.map((app) => app.id));
    const missingDefaults = DEFAULT_APPS.filter((app) => !existingIds.has(app.id));
    return [...merged, ...missingDefaults];
}

const DEFAULT_APPS: ConnectedApp[] = [
    {
        id: "zenith",
        name: "Zenith Business",
        type: "Bank Feed",
        description: "Current & savings account feed, real-time transaction streaming",
        status: "connected",
        accent: "#2563eb",
        initial: "Z",
        logo: "/connected-apps/zenith.svg",
        lastSync: "2 minutes ago",
        impact: "+₦4.8M inflow",
    },
    {
        id: "gtb",
        name: "GTB Treasury",
        type: "Bank Feed",
        description: "FX account, treasury bills, and fixed deposit tracking",
        status: "connected",
        accent: "#e63946",
        initial: "G",
        logo: "/connected-apps/gtb.svg",
        lastSync: "18 minutes ago",
        impact: "+₦2.3M FX",
    },
    {
        id: "risevest",
        name: "RiseVest",
        type: "Investment",
        description: "Dollar investments, fixed income, and real estate funds",
        status: "connected",
        accent: "#0ead69",
        initial: "R",
        logo: "/connected-apps/risevest-alt.png",
        lastSync: "1 hour ago",
        impact: "₦9.4M deployed",
    },
    {
        id: "wave",
        name: "Wave Payroll",
        type: "Payroll",
        description: "Employee payroll processing, tax deductions, and compliance",
        status: "connected",
        accent: "#a162f7",
        initial: "W",
        logo: "/connected-apps/wave.png",
        lastSync: "3 hours ago",
        impact: "-₦3.4M forecast",
    },
    {
        id: "quickinvoice",
        name: "QuickInvoice",
        type: "Revenue",
        description: "Invoice generation, tracking, and automated payment reminders",
        status: "connected",
        accent: "#f97316",
        initial: "Q",
        logo: "/connected-apps/quickinvoice.svg",
        lastSync: "9 minutes ago",
        impact: "₦2.1M collectible",
    },
    {
        id: "carbon",
        name: "Carbon DeFi",
        type: "DeFi Wallet",
        description: "DeFi staking, yield farming, and crypto portfolio",
        status: "connected",
        accent: "#1d4ed8",
        initial: "C",
        logo: "/connected-apps/carbon.png",
        lastSync: "30 minutes ago",
        impact: "₦1.8M staked",
    },
    {
        id: "piggyvest",
        name: "Piggyvest",
        type: "Savings",
        description: "Automated savings, target savings, and flex naira",
        status: "disconnected",
        accent: "#2563eb",
        initial: "P",
        logo: "/connected-apps/piggyvest.png",
    },
    {
        id: "cowrywise",
        name: "Cowrywise",
        type: "Wealth Management",
        description: "Mutual funds, US stocks, and automated wealth plans",
        status: "disconnected",
        accent: "#0ea5e9",
        initial: "C",
        logo: "/connected-apps/cowrywise.png",
    },
    {
        id: "kuda",
        name: "Kuda Bank",
        type: "Bank Feed",
        description: "Personal banking, spending insights, and free transfers",
        status: "disconnected",
        accent: "#7c3aed",
        initial: "K",
        logo: "/connected-apps/kuda.png",
    },
    {
        id: "bamboo",
        name: "Bamboo",
        type: "Investment",
        description: "US stock trading, ETFs, and fractional shares",
        status: "disconnected",
        accent: "#059669",
        initial: "B",
        logo: "/connected-apps/bamboo.png",
    },
    {
        id: "fairmoney",
        name: "FairMoney",
        type: "Banking & Loans",
        description: "Digital banking, instant loans, and bill payments",
        status: "disconnected",
        accent: "#10b981",
        initial: "F",
        logo: "/connected-apps/fairmoney.png",
    },
    {
        id: "ikeja-electric",
        name: "Ikeja Electric",
        type: "Utility",
        description: "Electricity billing, prepaid meter management, and auto top-up",
        status: "disconnected",
        accent: "#eab308",
        initial: "IE",
        logo: "/connected-apps/ikeja-electric.png",
    },
];

interface ConnectedAppsContextType {
    apps: ConnectedApp[];
    toggleApp: (id: string) => void;
    getConnectedApps: () => ConnectedApp[];
}

const ConnectedAppsContext = createContext<ConnectedAppsContextType | undefined>(undefined);

export function ConnectedAppsProvider({ children }: { children: React.ReactNode }) {
    const [apps, setApps] = useState<ConnectedApp[]>(() => {
        if (typeof window === "undefined") {
            return DEFAULT_APPS;
        }
        try {
            const stored = localStorage.getItem("quantum-connected-apps");
            if (!stored) return DEFAULT_APPS;
            const parsed = JSON.parse(stored) as unknown;
            if (!Array.isArray(parsed)) return DEFAULT_APPS;
            return mergeWithDefaults(parsed.filter(isConnectedApp));
        } catch (e) {
            console.error("Failed to parse connected apps", e);
            return DEFAULT_APPS;
        }
    });

    // Save to localStorage on change
    useEffect(() => {
        localStorage.setItem("quantum-connected-apps", JSON.stringify(apps));
    }, [apps]);

    const toggleApp = (id: string) => {
        setApps((prev) =>
            prev.map((app) =>
                app.id === id
                    ? {
                        ...app,
                        status: app.status === "connected" ? "disconnected" : "connected",
                        lastSync: app.status === "disconnected" ? "Just now" : undefined,
                        impact: app.status === "disconnected" ? "Syncing..." : undefined,
                    }
                    : app
            )
        );
    };

    const getConnectedApps = () => apps.filter((app) => app.status === "connected");

    return (
        <ConnectedAppsContext.Provider value={{ apps, toggleApp, getConnectedApps }}>
            {children}
        </ConnectedAppsContext.Provider>
    );
}

export function useConnectedApps() {
    const context = useContext(ConnectedAppsContext);
    if (context === undefined) {
        throw new Error("useConnectedApps must be used within a ConnectedAppsProvider");
    }
    return context;
}
