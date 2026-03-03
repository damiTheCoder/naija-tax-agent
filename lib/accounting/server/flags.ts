const truthy = new Set(["1", "true", "yes", "on"]);

const readFlag = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  return truthy.has(value.trim().toLowerCase());
};

export const accountingFeatureFlags = {
  prismaDualWrite(): boolean {
    return readFlag(process.env.ACCOUNTING_PRISMA_DUAL_WRITE, true);
  },
  prismaPrimary(): boolean {
    return readFlag(process.env.ACCOUNTING_PRISMA_PRIMARY, false);
  },
  apEnabled(): boolean {
    return readFlag(process.env.ACCOUNTING_AP_ENABLED, true);
  },
  periodLockEnabled(): boolean {
    return readFlag(process.env.ACCOUNTING_PERIOD_LOCK_ENABLED, true);
  },
  recurringEnabled(): boolean {
    return readFlag(process.env.ACCOUNTING_RECURRING_ENABLED, true);
  },
  fxBasicEnabled(): boolean {
    return readFlag(process.env.ACCOUNTING_FX_BASIC_ENABLED, true);
  },
  dimensionsEnabled(): boolean {
    return readFlag(process.env.ACCOUNTING_DIMENSIONS_ENABLED, true);
  },
};
