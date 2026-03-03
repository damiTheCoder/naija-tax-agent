"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Bill = {
  id: string;
  billNo: string;
  date: string;
  dueDate?: string | null;
  total: number;
  status: string;
  approvalStatus: string;
  currency: string;
  vendor?: {
    name?: string;
  } | null;
  payments?: Array<{ amount: number }>;
};

const ENTITY_ID = "entity-default";

function formatMoney(value: number, currency = "NGN"): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [vendorName, setVendorName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const loadBills = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounting/bills?entityId=${encodeURIComponent(ENTITY_ID)}`);
      const data = (await res.json()) as { success?: boolean; bills?: Bill[]; error?: string };
      if (!res.ok || data.success !== true) throw new Error(data.error || "Failed to load bills");
      setBills(Array.isArray(data.bills) ? data.bills : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bills");
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBills();
  }, []);

  const stats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let paid = 0;
    for (const bill of bills) {
      if (bill.approvalStatus === "pending_approval") pending += 1;
      if (bill.approvalStatus === "approved") approved += 1;
      if (bill.approvalStatus === "paid") paid += 1;
    }
    return { pending, approved, paid };
  }, [bills]);

  const createBill = async (event: FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!vendorName.trim() || !description.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Vendor, description, and positive amount are required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/accounting/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: ENTITY_ID,
          vendorName: vendorName.trim(),
          date,
          currency: "NGN",
          lines: [{ description: description.trim(), quantity: 1, unitPrice: numericAmount }],
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || data.success !== true) throw new Error(data.error || "Failed to create bill");

      setVendorName("");
      setDescription("");
      setAmount("");
      await loadBills();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create bill");
    } finally {
      setSaving(false);
    }
  };

  const postAction = async (billId: string, action: "submit" | "approve" | "pay" | "void") => {
    setBusyId(billId);
    setError(null);
    try {
      const endpoint =
        action === "void"
          ? `/api/accounting/bills/${encodeURIComponent(billId)}?entityId=${encodeURIComponent(ENTITY_ID)}&actorRole=owner`
          : `/api/accounting/bills/${encodeURIComponent(billId)}/${action}`;

      const res = await fetch(endpoint, {
        method: action === "void" ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "void" ? undefined : JSON.stringify({ entityId: ENTITY_ID, actorRole: "owner" }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || data.success !== true) throw new Error(data.error || `Failed to ${action} bill`);
      await loadBills();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} bill`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Bills (Accounts Payable)</h1>
        <p className="mt-1 text-sm text-slate-600">Draft, submit, approve, pay, and void bills with journal posting.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-3 text-sm">
            <p className="text-slate-500">Pending approval</p>
            <p className="text-xl font-semibold text-slate-900">{stats.pending}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 text-sm">
            <p className="text-slate-500">Approved</p>
            <p className="text-xl font-semibold text-slate-900">{stats.approved}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 text-sm">
            <p className="text-slate-500">Paid</p>
            <p className="text-xl font-semibold text-slate-900">{stats.paid}</p>
          </div>
        </div>

        <form onSubmit={createBill} className="mt-4 grid gap-3 md:grid-cols-5">
          <input
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            placeholder="Vendor"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            required
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Line description"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            required
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            type="number"
            min="0"
            step="0.01"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            required
          />
          <input
            value={date}
            onChange={(e) => setDate(e.target.value)}
            type="date"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            required
          />
          <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving ? "Saving..." : "Create Bill"}
          </button>
        </form>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Bill</th>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-slate-500">Loading bills...</td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-slate-500">No bills yet.</td>
                </tr>
              ) : (
                bills.map((bill) => {
                  const running = busyId === bill.id;
                  const canSubmit = bill.approvalStatus === "draft" || bill.approvalStatus === "rejected";
                  const canApprove = bill.approvalStatus === "pending_approval";
                  const canPay = bill.approvalStatus === "approved";

                  return (
                    <tr key={bill.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-900">{bill.billNo}</p>
                        <p className="text-xs text-slate-500">{new Date(bill.date).toLocaleDateString("en-NG")}</p>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{bill.vendor?.name || "-"}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-900">{bill.approvalStatus}</p>
                        <p className="text-xs text-slate-500">{bill.status}</p>
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900">{formatMoney(bill.total, bill.currency || "NGN")}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => void postAction(bill.id, "submit")}
                            disabled={!canSubmit || running}
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                          >
                            Submit
                          </button>
                          <button
                            onClick={() => void postAction(bill.id, "approve")}
                            disabled={!canApprove || running}
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => void postAction(bill.id, "pay")}
                            disabled={!canPay || running}
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                          >
                            Pay
                          </button>
                          <button
                            onClick={() => void postAction(bill.id, "void")}
                            disabled={bill.approvalStatus === "voided" || running}
                            className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 disabled:opacity-50"
                          >
                            Void
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
