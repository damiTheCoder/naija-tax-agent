import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

import Image from "next/image";

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
          {/* Mobile App Header */}
          <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 transition-all duration-300">
            <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-md ring-1 ring-gray-100">
                  <Image
                    src="/logo.png"
                    alt="Taxy Logo"
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-gray-900">Taxy</h1>
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                </div>
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 py-6 px-4">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-gray-100 py-6 px-6 text-center text-sm text-gray-500">
            <p>
              © {new Date().getFullYear()} Taxy. Smart Tax for Nigerians.
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
