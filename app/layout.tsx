import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { APP_LOGO_SRC } from "@/lib/constants";
import { ThemeProvider } from "@/lib/ThemeContext";
import { NavigationProvider } from "@/lib/NavigationContext";
import GlobalSpinner from "@/components/GlobalSpinner";

const glacial = localFont({
  src: [
    {
      path: "./fonts/GlacialIndifference-Regular.woff",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/GlacialIndifference-Bold.woff",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-glacial",
  display: "swap",
});

const siteTitle = "CashOS - Smart Nigerian Tax Manager";
const siteDescription =
  "Estimate your Nigerian taxes (CGT, CIT, PIT, VAT) with CashOS. Your personal AI tax assistant.";

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  keywords: ["Nigerian tax", "FIRS", "CashOS", "tax calculator", "freelancer tax", "SME tax", "Nigeria"],
  authors: [{ name: "CashOS" }],
  icons: {
    icon: APP_LOGO_SRC,
    shortcut: APP_LOGO_SRC,
    apple: APP_LOGO_SRC,
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
      <body className={`${glacial.variable} antialiased`}>
        <ThemeProvider>
          <NavigationProvider>
            <GlobalSpinner />
            <AppShell>{children}</AppShell>
          </NavigationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

