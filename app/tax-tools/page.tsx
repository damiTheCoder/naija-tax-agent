"use client";

import Link from "next/link";
import { TAX_NAV_ITEMS } from "@/lib/navigation";
import { NavIconBadge } from "@/components/NavIconBadge";

export default function TaxToolsLanding() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <div className="text-center space-y-3">
        <p className="text-sm uppercase tracking-wide text-[var(--muted)]">Quick Tax Tools</p>
        <h1 className="text-3xl font-bold">Specialised Nigerian Tax Calculators</h1>
        <p className="text-[var(--muted)] max-w-2xl mx-auto">
          Choose a calculator to focus on a specific tax. Each experience keeps the friendly NaijaTaxAgent
          styling and walks you through what&apos;s required for Withholding Tax, VAT, or Capital Gains Tax.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {TAX_NAV_ITEMS.filter((item) => item.href.startsWith("/tax-tools")).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border border-[var(--border)] bg-white shadow-sm p-5 flex flex-col gap-3 hover:border-[var(--primary)] transition"
          >
            <div className="flex items-center gap-3 text-lg font-semibold">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--background)] text-gray-700">
                <NavIconBadge icon={item.icon} />
              </span>
              {item.label}
            </div>
            <p className="text-sm text-[var(--muted)]">{item.description}</p>
            <span className="text-sm font-medium text-[var(--primary)]">Open calculator →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
