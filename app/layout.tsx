import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { APP_LOGO_SRC } from "@/lib/constants";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const siteTitle = "Insight - Smart Nigerian Tax Manager";
const siteDescription =
  "Estimate your Nigerian taxes (CGT, CIT, PIT, VAT) with Insight. Your personal AI tax assistant.";

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  keywords: ["Nigerian tax", "FIRS", "Insight", "tax calculator", "freelancer tax", "SME tax", "Nigeria"],
  authors: [{ name: "Insight" }],
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
      <body className={`${inter.variable} antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
