"use client";

import { FormEvent, useEffect, useState } from "react";

type ExchangeRate = {
  id: string;
  date: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  source: string;
};

const ENTITY_ID = "entity-default";

export default function FxPage() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("NGN");
  const [rate, setRate] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ entityId: ENTITY_ID, limit: "200" });
      const res = await fetch(`/api/accounting/exchange-rates?${qs.toString()}`);
      const data = (await res.json()) as { success?: boolean; rates?: ExchangeRate[]; error?: string };
      if (!res.ok || data.success !== true) throw new Error(data.error || "Failed to load rates");
      setRates(Array.isArray(data.rates) ? data.rates : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rates");
      setRates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createRate = async (event: FormEvent) => {
    event.preventDefault();
    const numericRate = Number(rate);
    if (!Number.isFinite(numericRate) || numericRate <= 0) {
      setError("Rate must be greater than zero.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/accounting/exchange-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: ENTITY_ID,
          actorRole: "owner",
          date,
          fromCurrency,
          toCurrency,
          rate: numericRate,
          source: "manual",
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || data.success !== true) throw new Error(data.error || "Failed to save rate");
      setRate("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save rate");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Exchange Rates</h1>
        <p className="mt-1 text-sm text-slate-600">Basic FX maintenance for NGN-primary reporting.</p>

        <form onSubmit={createRate} className="mt-4 grid gap-3 md:grid-cols-5">
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" required />
          <input value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value.toUpperCase())} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" required />
          <input value={toCurrency} onChange={(e) => setToCurrency(e.target.value.toUpperCase())} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" required />
          <input value={rate} onChange={(e) => setRate(e.target.value)} type="number" min="0" step="0.0001" placeholder="Rate" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" required />
          <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving ? "Saving..." : "Save Rate"}
          </button>
        </form>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Pair</th>
                <th className="px-3 py-2">Rate</th>
                <th className="px-3 py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-slate-500">Loading rates...</td>
                </tr>
              ) : rates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-slate-500">No rates available.</td>
                </tr>
              ) : (
                rates.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700">{new Date(row.date).toLocaleDateString("en-NG")}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{row.fromCurrency}/{row.toCurrency}</td>
                    <td className="px-3 py-2 text-slate-700">{row.rate}</td>
                    <td className="px-3 py-2 text-slate-700">{row.source}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
