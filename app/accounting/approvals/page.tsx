"use client";

import { useEffect, useState } from "react";

type ApprovalRequest = {
  id: string;
  status: string;
  requiredRole: string;
  amount: number;
  currency: string;
  requestedBy: string;
  requestedAt: string;
  billId?: string | null;
  resourceId: string;
  bill?: {
    billNo?: string;
    approvalStatus?: string;
  } | null;
};

const ENTITY_ID = "entity-default";

function formatMoney(value: number, currency = "NGN"): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ entityId: ENTITY_ID, status: "pending", limit: "200" });
      const res = await fetch(`/api/accounting/approvals?${qs.toString()}`);
      const data = (await res.json()) as { success?: boolean; approvals?: ApprovalRequest[]; error?: string };
      if (!res.ok || data.success !== true) throw new Error(data.error || "Failed to load approvals");
      setItems(Array.isArray(data.approvals) ? data.approvals : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load approvals");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const approveBill = async (billId: string) => {
    setBusyId(billId);
    setError(null);
    try {
      const res = await fetch(`/api/accounting/bills/${encodeURIComponent(billId)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: ENTITY_ID, actorRole: "owner" }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || data.success !== true) throw new Error(data.error || "Failed to approve bill");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve bill");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Approval Queue</h1>
        <p className="mt-1 text-sm text-slate-600">Owner/manager approvals for AP workflows.</p>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Bill</th>
                <th className="px-3 py-2">Requested</th>
                <th className="px-3 py-2">Required Role</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-slate-500">Loading approval requests...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-slate-500">No pending approvals.</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-900">{item.bill?.billNo || item.resourceId}</p>
                      <p className="text-xs text-slate-500">{item.status}</p>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {new Date(item.requestedAt).toLocaleString("en-NG")}
                      <p className="text-xs text-slate-500">by {item.requestedBy}</p>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{item.requiredRole}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{formatMoney(item.amount, item.currency || "NGN")}</td>
                    <td className="px-3 py-2">
                      {item.billId ? (
                        <button
                          onClick={() => void approveBill(item.billId as string)}
                          disabled={busyId === item.billId}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                        >
                          {busyId === item.billId ? "Approving..." : "Approve"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">No bill linked</span>
                      )}
                    </td>
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
