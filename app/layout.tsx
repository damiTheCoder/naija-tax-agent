import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NaijaTaxAgent - Nigerian Tax Calculator",
  description: "Estimate your Nigerian taxes and generate a printable computation sheet for FIRS or SBIRS review.",
  keywords: ["Nigerian tax", "FIRS", "SBIRS", "tax calculator", "freelancer tax", "SME tax", "Nigeria"],
  authors: [{ name: "NaijaTaxAgent" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="bg-[#1a365d] text-white py-4 px-6 shadow-lg">
            <div className="max-w-4xl mx-auto flex items-center gap-3">
              <div className="text-2xl">🇳🇬</div>
              <div>
                <h1 className="text-xl font-bold">NaijaTaxAgent</h1>
                <p className="text-sm text-blue-200">Nigerian Tax Estimation Tool</p>
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 py-8 px-4">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-[#1a365d] text-white py-4 px-6 text-center text-sm">
            <p className="text-blue-200">
              © {new Date().getFullYear()} NaijaTaxAgent. This tool provides estimates only — not official tax advice.
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
