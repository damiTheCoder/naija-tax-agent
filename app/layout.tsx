import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

import HeaderNav from "@/components/HeaderNav";

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
      <body className={`${inter.variable} antialiased bg-gray-50 text-gray-900`}>
        <div className="min-h-screen flex flex-col">
          <HeaderNav />

          {/* Main content */}
          <main className="flex-1 py-6 px-4">
            <div className="max-w-4xl mx-auto w-full">{children}</div>
          </main>

          {/* Footer */}
          <footer className="bg-gray-50 py-6 px-6 text-center text-sm text-gray-500">
            <p>
              © {new Date().getFullYear()} Taxy. Smart Tax for Nigerians.
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
