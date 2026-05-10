import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { APP_LOGO_ROUNDED_SRC } from "@/lib/constants";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const glacial = localFont({
  variable: "--font-glacial",
  display: "swap",
  src: [
    {
      path: "../public/fonts/GlacialIndifference-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/GlacialIndifference-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
});

const siteTitle = "Bace";
const siteDescription =
  "Your Financial operating system, automate your accouting, know your projections, estimate your tax liabilities.";

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  keywords: ["Nigerian tax", "FIRS", "Bace", "tax calculator", "freelancer tax", "SME tax", "Nigeria"],
  authors: [{ name: "Bace" }],
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
      </head>
      <body className={`${glacial.variable} ${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
