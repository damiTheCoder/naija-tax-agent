import type { ReactNode } from "react";
import AppProviders from "@/components/AppProviders";
import AppShell from "@/components/AppShell";

export default function AppRouteLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
