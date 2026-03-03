import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { APP_LOGO_ROUNDED_SRC } from "@/lib/constants";
import { ThemeProvider } from "@/lib/ThemeContext";
import { NavigationProvider } from "@/lib/NavigationContext";
import { WorkspaceProvider } from "@/lib/WorkspaceContext";
import { ConnectedAppsProvider } from "@/lib/ConnectedAppsContext";
import GlobalSpinner from "@/components/GlobalSpinner";
import { ModeProvider } from "@/lib/ModeContext";

const siteTitle = "Quantum Ledger";
const siteDescription =
  "Your Financial operating system, automate your accouting, know your projections, estimate your tax liabilities.";

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

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        {/* Preconnect to font CDNs for faster loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.cdnfonts.com" crossOrigin="anonymous" />
        {/* Non-blocking font stylesheets (moved from globals.css @import) */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.cdnfonts.com/css/glacial-indifference-2"
        />
      </head>
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
