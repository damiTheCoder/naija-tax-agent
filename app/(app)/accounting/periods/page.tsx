"use client";

import { FormEvent, useEffect, useState } from "react";

type PeriodLock = {
  period: string;
  locked: boolean;
  lockedBy?: string;
  lockedAt?: string;
  reason?: string;
};

const ENTITY_ID = "entity-default";

function currentPeriod(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

export default function PeriodLocksPage() {
  const [locks, setLocks] = useState<PeriodLock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState(currentPeriod());
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounting/period-locks?entityId=${encodeURIComponent(ENTITY_ID)}`);
      const data = (await res.json()) as { success?: boolean; locks?: PeriodLock[]; error?: string };
      if (!res.ok || data.success !== true) throw new Error(data.error || "Failed to fetch period locks");
      setLocks(Array.isArray(data.locks) ? data.locks : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch period locks");
      setLocks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const lockPeriod = async (event: FormEvent) => {
    event.preventDefault();
    if (!period.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounting/period-locks/${encodeURIComponent(period)}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: ENTITY_ID,
          actor: "owner",
          actorRole: "owner",
          reason: reason.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || data.success !== true) throw new Error(data.error || "Failed to lock period");
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to lock period");
    } finally {
      setSaving(false);
    }
  };

  const unlockPeriod = async (key: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/accounting/period-locks/${encodeURIComponent(key)}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: ENTITY_ID,
          actor: "owner",
          actorRole: "owner",
          reason: "manual unlock",
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || data.success !== true) throw new Error(data.error || "Failed to unlock period");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlock period");
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Period Locks</h1>
        <p className="mt-1 text-sm text-slate-600">Close books by locking posting periods.</p>

        <form onSubmit={lockPeriod} className="mt-4 grid gap-3 md:grid-cols-4">
          <input
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="YYYY-MM"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            required
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 md:col-span-2"
          />
          <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving ? "Locking..." : "Lock Period"}
          </button>
        </form>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Locked By</th>
                <th className="px-3 py-2">Locked At</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-slate-500">Loading locks...</td>
                </tr>
              ) : locks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-slate-500">No locked periods.</td>
                </tr>
              ) : (
                locks.map((lock) => (
                  <tr key={lock.period} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">{lock.period}</td>
                    <td className="px-3 py-2 text-slate-700">{lock.lockedBy || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {lock.lockedAt ? new Date(lock.lockedAt).toLocaleString("en-NG") : "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{lock.reason || "-"}</td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => void unlockPeriod(lock.period)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs">
                        Unlock
                      </button>
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
