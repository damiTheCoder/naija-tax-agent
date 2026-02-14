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
  const [mode, setMode] = useState<ExperienceMode>("enterprise");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("quantum-ledger-mode") as ExperienceMode | null;
    if (stored === "user" || stored === "enterprise") {
      setMode(stored);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("quantum-ledger-mode", mode);
  }, [mode, mounted]);

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
