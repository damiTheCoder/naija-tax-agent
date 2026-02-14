import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { APP_LOGO_SRC, APP_LOGO_ROUNDED_SRC } from "@/lib/constants";
import { ThemeProvider } from "@/lib/ThemeContext";
import { NavigationProvider } from "@/lib/NavigationContext";
import { WorkspaceProvider } from "@/lib/WorkspaceContext";
import { ConnectedAppsProvider } from "@/lib/ConnectedAppsContext";
import GlobalSpinner from "@/components/GlobalSpinner";
import { ModeProvider } from "@/lib/ModeContext";

const siteTitle = "Quantum Ledger - Smart Nigerian Tax Manager";
const siteDescription =
  "Estimate your Nigerian taxes (CGT, CIT, PIT, VAT) with Quantum Ledger. Your personal AI tax assistant.";

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  keywords: ["Nigerian tax", "FIRS", "Quantum Ledger", "tax calculator", "freelancer tax", "SME tax", "Nigeria"],
  authors: [{ name: "Quantum Ledger" }],
  icons: {
    icon: APP_LOGO_ROUNDED_SRC,
    shortcut: APP_LOGO_ROUNDED_SRC,
    apple: APP_LOGO_ROUNDED_SRC,
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <ThemeProvider>
          <ModeProvider>
            <WorkspaceProvider>
              <NavigationProvider>
                <ConnectedAppsProvider>
                  <GlobalSpinner />
                  <AppShell>{children}</AppShell>
                </ConnectedAppsProvider>
              </NavigationProvider>
            </WorkspaceProvider>
          </ModeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
