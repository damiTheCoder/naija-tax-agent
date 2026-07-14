"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/lib/ThemeContext";
import { NavigationProvider } from "@/lib/NavigationContext";
import { WorkspaceProvider } from "@/lib/WorkspaceContext";
import { ConnectedAppsProvider } from "@/lib/ConnectedAppsContext";
import GlobalSpinner from "@/components/GlobalSpinner";
import TemporaryLoginReminder from "@/components/TemporaryLoginReminder";
import { ModeProvider } from "@/lib/ModeContext";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ModeProvider>
        <WorkspaceProvider>
          <NavigationProvider>
            <ConnectedAppsProvider>
              <GlobalSpinner />
              <TemporaryLoginReminder />
              {children}
            </ConnectedAppsProvider>
          </NavigationProvider>
        </WorkspaceProvider>
      </ModeProvider>
    </ThemeProvider>
  );
}
