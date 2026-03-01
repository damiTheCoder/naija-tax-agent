"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ExperienceMode = "enterprise" | "user";

interface ModeContextValue {
  mode: ExperienceMode;
  setMode: (nextMode: ExperienceMode) => void;
  toggleMode: () => void;
  mounted: boolean;
}

const ModeContext = createContext<ModeContextValue | undefined>(undefined);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ExperienceMode>(() => {
    if (typeof window === "undefined") return "enterprise";
    const stored = localStorage.getItem("quantum-ledger-mode") as ExperienceMode | null;
    if (stored === "user" || stored === "enterprise") {
      return stored;
    }
    return "enterprise";
  });
  const mounted = true;

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("quantum-ledger-mode", mode);
  }, [mode]);

  const toggleMode = () => {
    setMode((prev) => (prev === "enterprise" ? "user" : "enterprise"));
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
