"use client";

import { useEffect, useMemo, useState } from "react";

type UsageEvent = {
  id: string;
  eventType?: string;
  module?: string;
  path?: string;
  ipAddress?: string;
  userAgent?: string;
  created?: string;
  expand?: {
    user?: { email?: string; name?: string; fullName?: string };
  };
};

type UsageResponse = {
  success: boolean;
  items: UsageEvent[];
  totalItems: number;
  error?: string;
};

export default function AdminUsagePage() {
  const [items, setItems] = useState<UsageEvent[]>([]);
  const [query, setQuery] = useState("");
  const [eventType, setEventType] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("perPage", "80");
    if (query.trim()) params.set("query", query.trim());
    if (eventType.trim()) params.set("eventType", eventType.trim());
    if (moduleName.trim()) params.set("module", moduleName.trim());
    return params.toString();
  }, [query, eventType, moduleName]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/usage?${searchParams}`, { cache: "no-store" });
        const data = (await response.json()) as UsageResponse;
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to load usage events");
        }
        if (!active) return;
        setItems(data.items || []);
        setTotal(data.totalItems || 0);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load usage events");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [searchParams]);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-slate-900">Usage Events</h1>
        <p className="mt-1 text-sm text-slate-600">
          Monitor route activity, module usage, and event traces across the app.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search path, IP, or user-agent"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
          />
          <input
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
            placeholder="Event type (e.g. page_view)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
          />
          <input
            value={moduleName}
            onChange={(event) => setModuleName(event.target.value)}
            placeholder="Module (e.g. accounting)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <p className="text-sm text-slate-600">
            {loading ? "Loading usage..." : `${total.toLocaleString()} events`}
          </p>
        </div>

        {error ? (
          <p className="px-4 py-6 text-sm text-rose-700">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Path</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">
                      {item.created ? new Date(item.created).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-900">{item.eventType || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{item.module || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{item.path || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.expand?.user?.name || item.expand?.user?.fullName || item.expand?.user?.email || "Anonymous"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.ipAddress || "—"}</td>
                  </tr>
                ))}
                {items.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      No usage events found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
