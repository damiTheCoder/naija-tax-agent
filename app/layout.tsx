import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Taxy - Smart Nigerian Tax Manager",
  description: "Estimate your Nigerian taxes (CGT, CIT, PIT, VAT) with Taxy. Your personal AI tax assistant.",
  keywords: ["Nigerian tax", "FIRS", "Taxy", "tax calculator", "freelancer tax", "SME tax", "Nigeria"],
  authors: [{ name: "Taxy" }],
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
