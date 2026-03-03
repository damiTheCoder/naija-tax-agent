"use client";

import { FormEvent, useEffect, useState } from "react";

type RecurringTemplate = {
  id: string;
  name: string;
  resourceType: string;
  frequency: string;
  nextRunAt: string;
  status: string;
};

const ENTITY_ID = "entity-default";

export default function RecurringPage() {
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [resourceType, setResourceType] = useState<"bill" | "journal">("bill");
  const [frequency, setFrequency] = useState<"monthly" | "quarterly">("monthly");
  const [amount, setAmount] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounting/recurring-templates?entityId=${encodeURIComponent(ENTITY_ID)}`);
      const data = (await res.json()) as { success?: boolean; templates?: RecurringTemplate[]; error?: string };
      if (!res.ok || data.success !== true) throw new Error(data.error || "Failed to load recurring templates");
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recurring templates");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createTemplate = async (event: FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!name.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const payload =
        resourceType === "bill"
          ? {
              bill: {
                vendorName: "Recurring Vendor",
                lines: [{ description: name.trim(), quantity: 1, unitPrice: Number.isFinite(numericAmount) ? numericAmount : 0 }],
              },
            }
          : {
              journal: {
                narration: name.trim(),
                lines: [
                  { accountCode: "5000", accountName: "Operating Expenses", debit: Number.isFinite(numericAmount) ? numericAmount : 0, credit: 0 },
                  { accountCode: "1020", accountName: "Bank - Current Account", debit: 0, credit: Number.isFinite(numericAmount) ? numericAmount : 0 },
                ],
              },
            };

      const res = await fetch("/api/accounting/recurring-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: ENTITY_ID,
          actorRole: "owner",
          name: name.trim(),
          resourceType,
          frequency,
          startDate: new Date().toISOString().slice(0, 10),
          payload,
          createdBy: "owner",
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || data.success !== true) throw new Error(data.error || "Failed to create recurring template");

      setName("");
      setAmount("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create recurring template");
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/accounting/recurring-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: ENTITY_ID, actorRole: "owner" }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || data.success !== true) throw new Error(data.error || "Failed to run recurring generation");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run recurring generation");
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Recurring Transactions</h1>
        <p className="mt-1 text-sm text-slate-600">Template and auto-generate monthly/quarterly bills or journals.</p>

        <form onSubmit={createTemplate} className="mt-4 grid gap-3 md:grid-cols-5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            required
          />
          <select
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value as "bill" | "journal")}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="bill">Bill</option>
            <option value="journal">Journal</option>
          </select>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as "monthly" | "quarterly")}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving ? "Saving..." : "Create Template"}
          </button>
        </form>

        <div className="mt-3">
          <button onClick={() => void runNow()} disabled={running} className="rounded-xl border border-slate-300 px-4 py-2 text-sm">
            {running ? "Running..." : "Run Due Templates Now"}
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Template</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Frequency</th>
                <th className="px-3 py-2">Next Run</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-slate-500">Loading templates...</td>
                </tr>
              ) : templates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-slate-500">No recurring templates.</td>
                </tr>
              ) : (
                templates.map((template) => (
                  <tr key={template.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">{template.name}</td>
                    <td className="px-3 py-2 text-slate-700">{template.resourceType}</td>
                    <td className="px-3 py-2 text-slate-700">{template.frequency}</td>
                    <td className="px-3 py-2 text-slate-700">{new Date(template.nextRunAt).toLocaleDateString("en-NG")}</td>
                    <td className="px-3 py-2 text-slate-700">{template.status}</td>
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
