"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ComplaintRow = {
  id: string;
  subject?: string;
  status?: string;
  priority?: string;
  created?: string;
  expand?: {
    user?: { email?: string; name?: string; fullName?: string };
    assignee?: { email?: string; name?: string; fullName?: string };
  };
};

type ComplaintsResponse = {
  success: boolean;
  items: ComplaintRow[];
  totalItems: number;
  totalPages: number;
  page: number;
  perPage: number;
  error?: string;
};

export default function AdminComplaintsPage() {
  const [items, setItems] = useState<ComplaintRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("perPage", "50");
    if (query.trim()) params.set("query", query.trim());
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    return params.toString();
  }, [query, status, priority]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/complaints?${searchParams}`, { cache: "no-store" });
        const data = (await response.json()) as ComplaintsResponse;
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to load complaints");
        }
        if (!active) return;
        setItems(data.items || []);
        setTotal(data.totalItems || 0);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Failed to load complaints";
        setError(message);
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
        <h1 className="text-lg font-semibold text-slate-900">Complaint Queue</h1>
        <p className="mt-1 text-sm text-slate-600">
          Triage user issues, assign owners, and resolve tickets with full auditability.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search subject/description"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
          >
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="triaged">Triaged</option>
            <option value="investigating">Investigating</option>
            <option value="waiting_user">Waiting user</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
          >
            <option value="">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <p className="text-sm text-slate-600">
            {loading ? "Loading complaints..." : `${total.toLocaleString()} complaints`}
          </p>
        </div>

        {error ? (
          <p className="px-4 py-6 text-sm text-rose-700">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900">{item.subject || "Untitled complaint"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.expand?.user?.name || item.expand?.user?.fullName || item.expand?.user?.email || "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.status || "new"}</td>
                    <td className="px-4 py-3 text-slate-700">{item.priority || "medium"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.created ? new Date(item.created).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/complaints/${item.id}`} className="font-medium text-[#1e3a8a] hover:text-[#1e3a8a]">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      No complaints found.
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
