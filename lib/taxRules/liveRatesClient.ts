"use client";

import { VAT_RATE } from "./config";
import type { TaxRuleMetadata } from "../types";

type TaxRulesApiResponse = {
  metadata?: TaxRuleMetadata;
  overrides?: {
    vatRate?: number;
  } | null;
  baseConfig?: {
    vatRate?: number;
  } | null;
};

let cachedVatRate = VAT_RATE;
let cachedMetadata: TaxRuleMetadata = {
  version: "base",
  source: "config.ts",
  lastUpdated: null,
  remoteUrl: undefined,
};

let lastHydrated: number | null = null;
let hydratePromise: Promise<void> | null = null;

async function hydrate(force = false): Promise<void> {
  if (typeof window === "undefined") return;
  if (!force) {
    const recentlyHydrated = lastHydrated && Date.now() - lastHydrated < 60_000;
    if (recentlyHydrated) return;
    if (hydratePromise) return hydratePromise;
  }

  hydratePromise = fetch("/api/tax-rules")
    .then(async (response) => {
      if (!response.ok) return;

      const payload = (await response.json()) as TaxRulesApiResponse;
      if (payload.metadata) {
        cachedMetadata = payload.metadata;
      }

      const overrideRate = payload.overrides?.vatRate;
      if (typeof overrideRate === "number") {
        cachedVatRate = overrideRate;
      } else if (typeof payload.baseConfig?.vatRate === "number") {
        cachedVatRate = payload.baseConfig.vatRate;
      } else {
        cachedVatRate = VAT_RATE;
      }

      lastHydrated = Date.now();
    })
    .catch(() => {
      // Ignore network failures; fall back to config defaults
      cachedVatRate = VAT_RATE;
    })
    .finally(() => {
      hydratePromise = null;
    });

  await hydratePromise;
}

if (typeof window !== "undefined") {
  void hydrate();
}

export function getClientVATRate(): number {
  return cachedVatRate;
}

export function getClientTaxRuleMetadata(): TaxRuleMetadata {
  return { ...cachedMetadata };
}

export async function refreshClientTaxRules(force = false): Promise<void> {
  await hydrate(force);
}
