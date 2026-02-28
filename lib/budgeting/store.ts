import { DEFAULT_BUDGET_TEMPLATES, DEFAULT_DEPARTMENTS } from "@/lib/budgeting/templates";
import type {
  Budget,
  BudgetScenario,
  BudgetingSettings,
  BudgetingState,
  BudgetTemplate,
} from "@/lib/budgeting/types";

export const BUDGETING_STORAGE_KEY = "quantum::budgeting::state";
export const BUDGETING_UPDATED_EVENT = "quantum:budgeting:updated";

const STATE_VERSION = 1;

const nowIso = () => new Date().toISOString();

const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;

const defaultSettings: BudgetingSettings = {
  currency: "NGN",
  taxJurisdiction: "Nigeria",
  fiscalYearStartMonth: 1,
  defaultDepartments: DEFAULT_DEPARTMENTS,
  alertThresholdPercent: 85,
};

const defaultBudget = (): Budget => {
  const now = new Date();
  const year = now.getFullYear();
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  return {
    id: "budget-default-annual",
    name: `${year} Operating Budget`,
    period: "yearly",
    startDate,
    endDate,
    totalAmount: 12_000_000,
    categories: [
      { id: createId("cat"), category: "Payroll", amount: 4_200_000, accountCodes: ["5500"], department: "People" },
      { id: createId("cat"), category: "Operations", amount: 3_000_000, accountCodes: ["5600", "5610", "5820"], department: "Operations" },
      { id: createId("cat"), category: "Marketing", amount: 2_000_000, accountCodes: ["6000"], department: "Marketing" },
      { id: createId("cat"), category: "Admin", amount: 1_000_000, accountCodes: ["6030", "6010"], department: "Finance" },
      { id: createId("cat"), category: "Contingency", amount: 1_800_000, accountCodes: [], department: "Finance" },
    ],
    departments: [
      { id: createId("dep"), department: "Marketing", amount: 2_000_000 },
      { id: createId("dep"), department: "Operations", amount: 3_800_000 },
      { id: createId("dep"), department: "People", amount: 4_200_000 },
      { id: createId("dep"), department: "Finance", amount: 2_000_000 },
    ],
    linkedAccountCodes: ["5000", "5010", "5500", "5600", "5610", "5820", "6000", "6030"],
    notes: "Auto-seeded starter budget. Edit or replace as needed.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
};

const defaultState = (): BudgetingState => ({
  version: STATE_VERSION,
  budgets: [defaultBudget()],
  templates: DEFAULT_BUDGET_TEMPLATES,
  scenarios: [],
  settings: defaultSettings,
  lastUpdated: nowIso(),
});

const normalizeState = (raw: Partial<BudgetingState> | null | undefined): BudgetingState => {
  const fallback = defaultState();
  if (!raw) return fallback;

  return {
    version: STATE_VERSION,
    budgets: Array.isArray(raw.budgets) && raw.budgets.length > 0 ? raw.budgets : fallback.budgets,
    templates: Array.isArray(raw.templates) && raw.templates.length > 0 ? raw.templates : DEFAULT_BUDGET_TEMPLATES,
    scenarios: Array.isArray(raw.scenarios) ? raw.scenarios : [],
    settings: {
      ...defaultSettings,
      ...(raw.settings || {}),
      defaultDepartments:
        raw.settings?.defaultDepartments && raw.settings.defaultDepartments.length > 0
          ? raw.settings.defaultDepartments
          : defaultSettings.defaultDepartments,
    },
    lastUpdated: raw.lastUpdated || nowIso(),
  };
};

export const loadBudgetingState = (): BudgetingState => {
  if (typeof window === "undefined") return defaultState();

  const raw = window.localStorage.getItem(BUDGETING_STORAGE_KEY);
  if (!raw) {
    const seeded = defaultState();
    window.localStorage.setItem(BUDGETING_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<BudgetingState>;
    return normalizeState(parsed);
  } catch {
    const seeded = defaultState();
    window.localStorage.setItem(BUDGETING_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
};

export const saveBudgetingState = (state: BudgetingState): BudgetingState => {
  const normalized: BudgetingState = {
    ...normalizeState(state),
    lastUpdated: nowIso(),
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(BUDGETING_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new Event(BUDGETING_UPDATED_EVENT));
  }

  return normalized;
};

export const listBudgets = (): Budget[] => loadBudgetingState().budgets;

export const getBudgetById = (budgetId: string): Budget | undefined => {
  return loadBudgetingState().budgets.find((budget) => budget.id === budgetId);
};

export const upsertBudget = (budget: Budget): Budget => {
  const state = loadBudgetingState();
  const exists = state.budgets.some((item) => item.id === budget.id);
  const updatedBudget: Budget = {
    ...budget,
    updatedAt: nowIso(),
    createdAt: budget.createdAt || nowIso(),
  };

  const budgets = exists
    ? state.budgets.map((item) => (item.id === budget.id ? updatedBudget : item))
    : [updatedBudget, ...state.budgets];

  saveBudgetingState({ ...state, budgets });
  return updatedBudget;
};

export const deleteBudget = (budgetId: string): boolean => {
  const state = loadBudgetingState();
  const next = state.budgets.filter((budget) => budget.id !== budgetId);
  if (next.length === state.budgets.length) return false;
  saveBudgetingState({ ...state, budgets: next });
  return true;
};

export const listTemplates = (): BudgetTemplate[] => loadBudgetingState().templates;

export const createBudgetFromTemplate = (
  templateId: string,
  options?: {
    name?: string;
    startDate?: string;
    endDate?: string;
    totalAmount?: number;
  }
): Budget | null => {
  const state = loadBudgetingState();
  const template = state.templates.find((item) => item.id === templateId);
  if (!template) return null;

  const now = new Date();
  const year = now.getFullYear();

  const startDate = options?.startDate || `${year}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const endDate =
    options?.endDate ||
    (template.period === "monthly"
      ? `${year}-${String(now.getMonth() + 1).padStart(2, "0")}-28`
      : template.period === "quarterly"
        ? `${year}-12-31`
        : `${year}-12-31`);

  const totalAmount = Math.max(0, options?.totalAmount ?? template.defaultAmount);

  const budget: Budget = {
    id: createId("budget"),
    name: options?.name || template.name,
    period: template.period,
    startDate,
    endDate,
    totalAmount,
    categories: template.categories.map((category) => ({
      id: createId("cat"),
      category: category.category,
      amount: Math.round(totalAmount * category.share),
      accountCodes: category.accountCodes || [],
      department: category.department,
    })),
    departments: [],
    linkedAccountCodes: Array.from(
      new Set(template.categories.flatMap((category) => category.accountCodes || []))
    ),
    notes: `Created from ${template.name} template`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  upsertBudget(budget);
  return budget;
};

export const listScenarios = (): BudgetScenario[] => loadBudgetingState().scenarios;

export const upsertScenario = (scenario: BudgetScenario): BudgetScenario => {
  const state = loadBudgetingState();
  const exists = state.scenarios.some((item) => item.id === scenario.id);
  const updatedScenario: BudgetScenario = {
    ...scenario,
    updatedAt: nowIso(),
    createdAt: scenario.createdAt || nowIso(),
  };

  const scenarios = exists
    ? state.scenarios.map((item) => (item.id === scenario.id ? updatedScenario : item))
    : [updatedScenario, ...state.scenarios];

  saveBudgetingState({ ...state, scenarios });
  return updatedScenario;
};

export const deleteScenario = (scenarioId: string): boolean => {
  const state = loadBudgetingState();
  const next = state.scenarios.filter((item) => item.id !== scenarioId);
  if (next.length === state.scenarios.length) return false;
  saveBudgetingState({ ...state, scenarios: next });
  return true;
};

export const updateBudgetingSettings = (patch: Partial<BudgetingSettings>): BudgetingSettings => {
  const state = loadBudgetingState();
  const nextSettings: BudgetingSettings = {
    ...state.settings,
    ...patch,
  };

  saveBudgetingState({ ...state, settings: nextSettings });
  return nextSettings;
};

export const subscribeBudgetingUpdates = (callback: () => void): (() => void) => {
  if (typeof window === "undefined") return () => undefined;

  const onStorage = (event: StorageEvent) => {
    if (event.key === BUDGETING_STORAGE_KEY) {
      callback();
    }
  };

  const onUpdate = () => callback();

  window.addEventListener("storage", onStorage);
  window.addEventListener(BUDGETING_UPDATED_EVENT, onUpdate);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(BUDGETING_UPDATED_EVENT, onUpdate);
  };
};
