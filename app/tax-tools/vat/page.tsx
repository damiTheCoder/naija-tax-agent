"use client";

import { useState } from "react";
import { VAT_RATE } from "@/lib/taxRules/config";

const formatCurrency = (amount: number) =>
  `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function VatCalculatorPage() {
  const [sales, setSales] = useState("");
  const [inputVat, setInputVat] = useState("");

  const taxableSales = parseFloat(sales.replace(/,/g, "")) || 0;
  const inputCredits = parseFloat(inputVat.replace(/,/g, "")) || 0;
  const outputVat = taxableSales > 0 ? taxableSales * VAT_RATE : 0;
  const netVat = outputVat - inputCredits;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-6">
      <div className="space-y-2 text-center">
        <p className="text-sm uppercase tracking-wide text-[var(--muted)]">Tax Tool</p>
        <h1 className="text-3xl font-bold">Value Added Tax Calculator</h1>
        <p className="text-[var(--muted)]">Quickly estimate output VAT on sales and offset input VAT credits to determine your net position.</p>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Taxable Sales (₦)</label>
          <input type="number" min={0} value={sales} onChange={(e) => setSales(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Input VAT Credits (₦)</label>
          <input type="number" min={0} value={inputVat} onChange={(e) => setInputVat(e.target.value)} placeholder="0.00" />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
          <div className="text-sm text-[var(--muted)]">Output VAT ({(VAT_RATE * 100).toFixed(1)}%)</div>
          <div className="text-3xl font-semibold mt-2">{formatCurrency(outputVat)}</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
          <div className="text-sm text-[var(--muted)]">Input VAT</div>
          <div className="text-3xl font-semibold mt-2">{formatCurrency(inputCredits)}</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
          <div className="text-sm text-[var(--muted)]">Net VAT Position</div>
          <div className={`text-3xl font-semibold mt-2 ${netVat < 0 ? "text-red-500" : "text-[var(--foreground)]"}`}>
            {formatCurrency(Math.abs(netVat))}
            {netVat < 0 ? " (Refund)" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
