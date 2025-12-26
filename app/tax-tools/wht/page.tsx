"use client";

import { useState } from "react";
import { WHTInput, WHTResult } from "@/lib/types";
import { WHT_RATES } from "@/lib/taxRules/whtConfig";

const formatCurrency = (amount: number) =>
  `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatPercent = (rate: number) => `${(rate * 100).toFixed(1)}%`;

export default function WhtCalculatorPage() {
  const [whtPayments, setWhtPayments] = useState<WHTInput[]>([]);
  const [newPayment, setNewPayment] = useState({ paymentType: WHT_RATES[0]?.paymentType || "dividends", amount: "", isResident: true });
  const [whtResult, setWhtResult] = useState<WHTResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addPayment = () => {
    const amount = parseFloat(newPayment.amount.replace(/,/g, "")) || 0;
    if (amount <= 0) {
      setError("Enter a valid payment amount");
      return;
    }
    const payment: WHTInput = {
      paymentType: newPayment.paymentType,
      amount,
      isResident: newPayment.isResident,
    };
    setWhtPayments((prev) => [...prev, payment]);
    setNewPayment((prev) => ({ ...prev, amount: "" }));
    setError(null);
  };

  const removePayment = (index: number) => {
    setWhtPayments((prev) => prev.filter((_, i) => i !== index));
  };

  const calculateWht = async () => {
    if (whtPayments.length === 0) {
      setError("Add at least one payment before calculating.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/wht", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payments: whtPayments }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Unable to compute WHT");
      }
      const data: WHTResult = await response.json();
      setWhtResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to compute WHT. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-6">
      <div className="space-y-2 text-center">
        <p className="text-sm uppercase tracking-wide text-[var(--muted)]">Tax Tool</p>
        <h1 className="text-3xl font-bold">Withholding Tax Calculator</h1>
        <p className="text-[var(--muted)]">Track payments subject to WHT and see total deductions with resident vs non-resident rates.</p>
      </div>

      <div className="card space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-2">Payment Type</label>
            <select value={newPayment.paymentType} onChange={(e) => setNewPayment((prev) => ({ ...prev, paymentType: e.target.value }))}>
              {WHT_RATES.map((rate) => (
                <option key={rate.paymentType} value={rate.paymentType}>
                  {rate.description}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Amount</label>
            <input
              type="number"
              value={newPayment.amount}
              onChange={(e) => setNewPayment((prev) => ({ ...prev, amount: e.target.value }))}
              placeholder="0.00"
              min={0}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Residency</label>
            <select
              value={newPayment.isResident ? "resident" : "non-resident"}
              onChange={(e) => setNewPayment((prev) => ({ ...prev, isResident: e.target.value === "resident" }))}
            >
              <option value="resident">Resident</option>
              <option value="non-resident">Non-Resident</option>
            </select>
          </div>
          <button type="button" className="btn btn-secondary" onClick={addPayment}>
            + Add Payment
          </button>
        </div>

        {whtPayments.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-[var(--muted)]">Added Payments ({whtPayments.length})</div>
            {whtPayments.map((payment, index) => {
              const rateInfo = WHT_RATES.find((rate) => rate.paymentType === payment.paymentType);
              const rate = payment.isResident ? rateInfo?.residentRate : rateInfo?.nonResidentRate;
              return (
                <div key={index} className="flex items-center justify-between bg-[var(--background)] p-3 rounded-lg border">
                  <div>
                    <div className="font-medium">{rateInfo?.description || payment.paymentType}</div>
                    <div className="text-sm text-[var(--muted)]">
                      {formatCurrency(payment.amount)} • {payment.isResident ? "Resident" : "Non-resident"} • {rate ? formatPercent(rate) : ""} WHT
                    </div>
                  </div>
                  <button className="text-red-500 text-sm" onClick={() => removePayment(index)}>
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end">
          <button className="btn btn-primary" onClick={calculateWht} disabled={loading}>
            {loading ? "Calculating..." : "Compute WHT"}
          </button>
        </div>
      </div>

      {whtResult && (
        <div className="card space-y-4">
          <h2 className="text-xl font-bold">Results</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Payment</th>
                  <th>Gross Amount</th>
                  <th>Rate</th>
                  <th>WHT Deducted</th>
                  <th>Net Amount</th>
                </tr>
              </thead>
              <tbody>
                {whtResult.calculations?.map((calc, index) => (
                  <tr key={index}>
                    <td>
                      {calc.paymentDescription}
                      <span className="text-xs text-[var(--muted)] ml-1">({calc.isResident ? "Resident" : "Non-resident"})</span>
                    </td>
                    <td>{formatCurrency(calc.grossAmount)}</td>
                    <td>{formatPercent(calc.rate)}</td>
                    <td className="text-red-600">{formatCurrency(calc.whtAmount)}</td>
                    <td>{formatCurrency(calc.netAmount)}</td>
                  </tr>
                ))}
                <tr className="font-semibold bg-[var(--background)]">
                  <td>Totals</td>
                  <td>{formatCurrency(whtResult.totalGrossAmount)}</td>
                  <td>-</td>
                  <td className="text-red-600">{formatCurrency(whtResult.totalWHTDeducted)}</td>
                  <td>{formatCurrency(whtResult.totalNetAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
