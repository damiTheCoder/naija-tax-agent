"use client";

import { useState } from "react";
import { CGTInput } from "@/lib/types";
import { CGT_RATE } from "@/lib/taxRules/cgt";

const formatCurrency = (amount: number) =>
  `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CgtCalculatorPage() {
  const [disposals, setDisposals] = useState<CGTInput[]>([]);
  const [newDisposal, setNewDisposal] = useState({
    assetType: "real_estate" as CGTInput["assetType"],
    assetDescription: "",
    acquisitionCost: "",
    disposalProceeds: "",
  });
  const [result, setResult] = useState<{ totalGain: number; totalCGT: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addDisposal = () => {
    const acquisitionCost = parseFloat(newDisposal.acquisitionCost.replace(/,/g, "")) || 0;
    const disposalProceeds = parseFloat(newDisposal.disposalProceeds.replace(/,/g, "")) || 0;
    if (acquisitionCost <= 0 || disposalProceeds <= 0) {
      setError("Provide valid acquisition cost and disposal proceeds.");
      return;
    }
    const disposal: CGTInput = {
      assetType: newDisposal.assetType,
      assetDescription: newDisposal.assetDescription || "Asset disposal",
      acquisitionDate: "2020-01-01",
      acquisitionCost,
      disposalDate: new Date().toISOString().split("T")[0],
      disposalProceeds,
    };
    setDisposals((prev) => [...prev, disposal]);
    setNewDisposal((prev) => ({ ...prev, assetDescription: "", acquisitionCost: "", disposalProceeds: "" }));
    setError(null);
  };

  const removeDisposal = (index: number) => {
    setDisposals((prev) => prev.filter((_, i) => i !== index));
  };

  const calculateCgt = async () => {
    if (disposals.length === 0) {
      setError("Add at least one disposal before calculating.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/cgt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disposals }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Unable to compute CGT");
      }
      const data = await response.json();
      setResult({ totalGain: data.totalGain, totalCGT: data.totalCGT });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to compute CGT. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-6">
      <div className="space-y-2 text-center">
        <p className="text-sm uppercase tracking-wide text-[var(--muted)]">Tax Tool</p>
        <h1 className="text-3xl font-bold">Capital Gains Tax Calculator</h1>
        <p className="text-[var(--muted)]">
          Capture asset disposals and compute chargeable gains at Nigeria&apos;s flat CGT rate of {(CGT_RATE * 100).toFixed(0)}%.
        </p>
      </div>

      <div className="card space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg">{error}</div>}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Asset Type</label>
            <select value={newDisposal.assetType} onChange={(e) => setNewDisposal((prev) => ({ ...prev, assetType: e.target.value as CGTInput["assetType"] }))}>
              <option value="real_estate">Real Estate</option>
              <option value="shares">Shares</option>
              <option value="business_assets">Business Assets</option>
              <option value="other">Other Assets</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <input type="text" value={newDisposal.assetDescription} onChange={(e) => setNewDisposal((prev) => ({ ...prev, assetDescription: e.target.value }))} placeholder="e.g. Sale of land in Lagos" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Acquisition Cost (₦)</label>
            <input type="number" min={0} value={newDisposal.acquisitionCost} onChange={(e) => setNewDisposal((prev) => ({ ...prev, acquisitionCost: e.target.value }))} placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Disposal Proceeds (₦)</label>
            <input type="number" min={0} value={newDisposal.disposalProceeds} onChange={(e) => setNewDisposal((prev) => ({ ...prev, disposalProceeds: e.target.value }))} placeholder="0.00" />
          </div>
        </div>

        <div className="flex justify-end">
          <button type="button" className="btn btn-secondary" onClick={addDisposal}>
            + Add Disposal
          </button>
        </div>

        {disposals.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-[var(--muted)]">Added Disposals ({disposals.length})</div>
            {disposals.map((disposal, index) => (
              <div key={index} className="flex items-center justify-between bg-[var(--background)] p-3 rounded-lg border">
                <div>
                  <div className="font-medium capitalize">{disposal.assetType.replace("_", " ")}</div>
                  <div className="text-sm text-[var(--muted)]">
                    {disposal.assetDescription} • Cost {formatCurrency(disposal.acquisitionCost)} • Proceeds {formatCurrency(disposal.disposalProceeds)}
                  </div>
                </div>
                <button className="text-red-500 text-sm" onClick={() => removeDisposal(index)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button className="btn btn-primary" onClick={calculateCgt} disabled={loading}>
          {loading ? "Calculating..." : "Compute CGT"}
        </button>
      </div>

      {result && (
        <div className="card space-y-4">
          <h2 className="text-xl font-bold">Results</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--background)]">
              <div className="text-[var(--muted)]">Total Chargeable Gain</div>
              <div className="text-2xl font-semibold mt-1">{formatCurrency(result.totalGain)}</div>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--background)]">
              <div className="text-[var(--muted)]">CGT Payable (10%)</div>
              <div className="text-2xl font-semibold mt-1 text-red-500">{formatCurrency(result.totalCGT)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
