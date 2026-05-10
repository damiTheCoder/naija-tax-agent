"use client";

import { createContext, useContext, useSyncExternalStore, ReactNode } from "react";

export type ExperienceMode = "enterprise" | "user";

interface ModeContextValue {
  mode: ExperienceMode;
  setMode: (nextMode: ExperienceMode) => void;
  toggleMode: () => void;
  mounted: boolean;
}

const ModeContext = createContext<ModeContextValue | undefined>(undefined);
const MODE_STORAGE_KEY = "quantum-ledger-mode";
const MODE_CHANGE_EVENT = "quantum-ledger-mode-change";
const noopSubscribe = () => () => {};

function readModeSnapshot(): ExperienceMode {
  if (typeof window === "undefined") return "enterprise";
  const stored = window.localStorage.getItem(MODE_STORAGE_KEY) as ExperienceMode | null;
  return stored === "user" || stored === "enterprise" ? stored : "enterprise";
}

function getServerModeSnapshot(): ExperienceMode {
  return "enterprise";
}

function subscribeToMode(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== MODE_STORAGE_KEY) return;
    onStoreChange();
  };

  const handleModeChange = () => onStoreChange();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(MODE_CHANGE_EVENT, handleModeChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(MODE_CHANGE_EVENT, handleModeChange);
  };
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore<ExperienceMode>(subscribeToMode, readModeSnapshot, getServerModeSnapshot);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const setMode = (nextMode: ExperienceMode) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MODE_STORAGE_KEY, nextMode);
    window.dispatchEvent(new Event(MODE_CHANGE_EVENT));
  };

  const toggleMode = () => {
    setMode(mode === "enterprise" ? "user" : "enterprise");
  };

  return (
    <ModeContext.Provider value={{ mode, setMode, toggleMode, mounted }}>
      <div suppressHydrationWarning>{children}</div>
    </ModeContext.Provider>
  );
}

export function useMode() {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error("useMode must be used within a ModeProvider");
  }
  return context;
}
