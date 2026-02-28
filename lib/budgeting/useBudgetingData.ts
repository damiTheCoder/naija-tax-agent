"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { accountingEngine } from "@/lib/accounting/transactionBridge";
import {
  buildBudgetAlerts,
  buildMonthlyBudgetSeries,
  computeAllBudgetPerformance,
  computeDashboardTotals,
  computeRunwayForecast,
  extractBudgetImpacts,
} from "@/lib/budgeting/engine";
import {
  createBudgetFromTemplate,
  deleteBudget,
  deleteScenario,
  listBudgets,
  listScenarios,
  listTemplates,
  loadBudgetingState,
  subscribeBudgetingUpdates,
  updateBudgetingSettings,
  upsertBudget,
  upsertScenario,
} from "@/lib/budgeting/store";
import type { Budget, BudgetScenario, BudgetingSettings, BudgetTemplate } from "@/lib/budgeting/types";
import type { JournalEntry, LedgerAccount } from "@/lib/accounting/doubleEntry";

type BudgetingSnapshot = {
  budgets: Budget[];
  scenarios: BudgetScenario[];
  templates: BudgetTemplate[];
  settings: BudgetingSettings;
};

export function useBudgetingData() {
  const [snapshot, setSnapshot] = useState<BudgetingSnapshot>({
    budgets: [],
    scenarios: [],
    templates: [],
    settings: {
      currency: "NGN",
      taxJurisdiction: "Nigeria",
      fiscalYearStartMonth: 1,
      defaultDepartments: [],
      alertThresholdPercent: 85,
    },
  });
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<Map<string, LedgerAccount>>(new Map());
  const [isReady, setIsReady] = useState(false);
  const mountedRef = useRef(false);

  const refreshSnapshot = useCallback(() => {
    const state = loadBudgetingState();
    if (!mountedRef.current) return;

    setSnapshot({
      budgets: state.budgets,
      scenarios: state.scenarios,
      templates: state.templates,
      settings: state.settings,
    });
  }, []);

  const refreshAccounting = useCallback(() => {
    accountingEngine.load();
    const state = accountingEngine.getState();
    if (!mountedRef.current) return;

    setJournalEntries(state.journalEntries.filter((entry) => entry.status === "posted"));
    setLedgerAccounts(new Map(state.ledgerAccounts));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refreshSnapshot();
    refreshAccounting();
    setIsReady(true);

    const unsubscribeBudgeting = subscribeBudgetingUpdates(() => {
      refreshSnapshot();
    });

    const unsubscribeAccounting = accountingEngine.subscribe(() => {
      refreshAccounting();
    });

    return () => {
      mountedRef.current = false;
      unsubscribeBudgeting();
      unsubscribeAccounting();
    };
  }, [refreshAccounting, refreshSnapshot]);

  const impacts = useMemo(() => extractBudgetImpacts(journalEntries), [journalEntries]);

  const performanceRows = useMemo(
    () => computeAllBudgetPerformance(snapshot.budgets, impacts),
    [snapshot.budgets, impacts]
  );

  const totals = useMemo(() => computeDashboardTotals(performanceRows), [performanceRows]);

  const monthlySeries = useMemo(
    () => buildMonthlyBudgetSeries(snapshot.budgets, impacts, 12),
    [snapshot.budgets, impacts]
  );

  const forecast = useMemo(() => computeRunwayForecast(impacts, ledgerAccounts), [impacts, ledgerAccounts]);

  const alerts = useMemo(
    () => buildBudgetAlerts(performanceRows, forecast.runway, snapshot.settings.alertThresholdPercent),
    [performanceRows, forecast.runway, snapshot.settings.alertThresholdPercent]
  );

  const saveBudget = useCallback((budget: Budget) => {
    upsertBudget(budget);
    refreshSnapshot();
  }, [refreshSnapshot]);

  const removeBudget = useCallback((budgetId: string) => {
    deleteBudget(budgetId);
    refreshSnapshot();
  }, [refreshSnapshot]);

  const saveScenario = useCallback((scenario: BudgetScenario) => {
    upsertScenario(scenario);
    refreshSnapshot();
  }, [refreshSnapshot]);

  const removeScenario = useCallback((scenarioId: string) => {
    deleteScenario(scenarioId);
    refreshSnapshot();
  }, [refreshSnapshot]);

  const createFromTemplate = useCallback((templateId: string, totalAmount?: number, name?: string) => {
    createBudgetFromTemplate(templateId, { totalAmount, name });
    refreshSnapshot();
  }, [refreshSnapshot]);

  const saveSettings = useCallback((patch: Partial<BudgetingSettings>) => {
    updateBudgetingSettings(patch);
    refreshSnapshot();
  }, [refreshSnapshot]);

  return {
    isReady,
    budgets: snapshot.budgets,
    scenarios: snapshot.scenarios,
    templates: snapshot.templates,
    settings: snapshot.settings,
    journalEntries,
    impacts,
    performanceRows,
    totals,
    monthlySeries,
    forecast,
    alerts,
    saveBudget,
    removeBudget,
    saveScenario,
    removeScenario,
    createFromTemplate,
    saveSettings,
    refresh: () => {
      refreshSnapshot();
      refreshAccounting();
    },
    listBudgets,
    listScenarios,
    listTemplates,
  };
}
