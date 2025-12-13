import fs from "fs";
import path from "path";
import {
    PIT_BANDS,
    PITBand,
    CRA_FIXED_AMOUNT,
    CRA_PERCENTAGE_OF_GROSS,
    CRA_ADDITIONAL_PERCENTAGE,
    CIT_CONFIG,
    CITConfig,
    VAT_RATE,
    MINIMUM_TAX_RATE,
} from "./config";
import { TaxRuleMetadata } from "../types";

export interface TaxRuleOverrides {
    pitBands?: PITBand[];
    craFixedAmount?: number;
    craPercentageOfGross?: number;
    craAdditionalPercentage?: number;
    citConfig?: Partial<CITConfig>;
    vatRate?: number;
    minimumTaxRate?: number;
    version?: string;
    source?: string;
    lastUpdated?: string;
    remoteUrl?: string;
}

interface LiveRateState {
    overrides: TaxRuleOverrides | null;
    metadata: TaxRuleMetadata;
}

const OVERRIDE_FILE = path.join(process.cwd(), "data", "taxRulesOverrides.json");

const state: LiveRateState = {
    overrides: null,
    metadata: {
        version: "base",
        source: "config.ts",
        lastUpdated: null,
        remoteUrl: process.env.TAX_RULES_REMOTE_URL || undefined,
    },
};

function ensureOverridesLoaded() {
    if (state.overrides !== null) {
        return;
    }

    try {
        if (fs.existsSync(OVERRIDE_FILE)) {
            const raw = fs.readFileSync(OVERRIDE_FILE, "utf-8");
            const parsed = JSON.parse(raw) as TaxRuleOverrides;
            if (parsed && Object.keys(parsed).length > 0) {
                applyTaxRuleOverrides(parsed, { persist: false, source: parsed.source || "file" });
            }
        }
    } catch (error) {
        console.warn("Could not load tax rule overrides", error);
    }
}

function persistOverrides() {
    if (!state.overrides) {
        return;
    }

    try {
        fs.mkdirSync(path.dirname(OVERRIDE_FILE), { recursive: true });
        fs.writeFileSync(OVERRIDE_FILE, JSON.stringify(state.overrides, null, 2));
    } catch (error) {
        console.warn("Could not persist tax rule overrides", error);
    }
}

interface ApplyOptions {
    persist?: boolean;
    source?: string;
}

export function applyTaxRuleOverrides(overrides: TaxRuleOverrides, options: ApplyOptions = {}): void {
    const cleaned: TaxRuleOverrides = { ...overrides };

    if (cleaned.pitBands) {
        cleaned.pitBands = cleaned.pitBands
            .filter((band) => band && typeof band.rate === "number")
            .map((band) => ({
                ...band,
                upperLimit: typeof band.upperLimit === "number" ? band.upperLimit : Infinity,
                rate: band.rate,
            }));
    }

    state.overrides = cleaned;
    state.metadata = {
        version: cleaned.version || `override-${new Date().toISOString()}`,
        source: options.source || cleaned.source || "override",
        lastUpdated: cleaned.lastUpdated || new Date().toISOString(),
        remoteUrl: cleaned.remoteUrl || process.env.TAX_RULES_REMOTE_URL,
    };

    if (options.persist !== false) {
        persistOverrides();
    }
}

export function getPitBands(): PITBand[] {
    ensureOverridesLoaded();
    return state.overrides?.pitBands && state.overrides.pitBands.length > 0
        ? state.overrides.pitBands
        : PIT_BANDS;
}

export function getCRAParameters(): {
    fixedAmount: number;
    percentageOfGross: number;
    additionalPercentage: number;
} {
    ensureOverridesLoaded();
    return {
        fixedAmount: state.overrides?.craFixedAmount ?? CRA_FIXED_AMOUNT,
        percentageOfGross: state.overrides?.craPercentageOfGross ?? CRA_PERCENTAGE_OF_GROSS,
        additionalPercentage: state.overrides?.craAdditionalPercentage ?? CRA_ADDITIONAL_PERCENTAGE,
    };
}

export function getCITConfig(): CITConfig {
    ensureOverridesLoaded();
    if (!state.overrides?.citConfig) {
        return CIT_CONFIG;
    }

    return {
        smallCompanyThreshold: state.overrides.citConfig.smallCompanyThreshold ?? CIT_CONFIG.smallCompanyThreshold,
        smallCompanyRate: state.overrides.citConfig.smallCompanyRate ?? CIT_CONFIG.smallCompanyRate,
        mediumCompanyThreshold: state.overrides.citConfig.mediumCompanyThreshold ?? CIT_CONFIG.mediumCompanyThreshold,
        mediumCompanyRate: state.overrides.citConfig.mediumCompanyRate ?? CIT_CONFIG.mediumCompanyRate,
        largeCompanyRate: state.overrides.citConfig.largeCompanyRate ?? CIT_CONFIG.largeCompanyRate,
    };
}

export function getVATRate(): number {
    ensureOverridesLoaded();
    return state.overrides?.vatRate ?? VAT_RATE;
}

export function getMinimumTaxRate(): number {
    ensureOverridesLoaded();
    return state.overrides?.minimumTaxRate ?? MINIMUM_TAX_RATE;
}

export function getTaxRuleMetadata(): TaxRuleMetadata {
    ensureOverridesLoaded();
    return state.metadata;
}

export function getOverrideSnapshot(): TaxRuleOverrides | null {
    ensureOverridesLoaded();
    return state.overrides ? { ...state.overrides } : null;
}

export async function refreshOverridesFromRemote(): Promise<void> {
    const remoteUrl = process.env.TAX_RULES_REMOTE_URL;
    if (!remoteUrl) {
        return;
    }

    try {
        const response = await fetch(remoteUrl);
        if (!response.ok) {
            throw new Error(`Unable to fetch remote tax rules: ${response.status}`);
        }
        const data = await response.json() as TaxRuleOverrides;
        applyTaxRuleOverrides(data, { source: remoteUrl });
    } catch (error) {
        console.warn("Remote tax rule refresh failed", error);
    }
}
