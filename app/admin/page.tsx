"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type OverviewMetrics = {
  usersTotal: number;
  activeUsers: number;
  complaintsTotal: number;
  openComplaints: number;
  resolvedComplaints: number;
  eventsToday: number;
};

type ComplaintItem = {
  id: string;
  subject?: string;
  status?: string;
  priority?: string;
  created?: string;
  expand?: {
    user?: { email?: string; name?: string; fullName?: string };
  };
};

type OverviewResponse = {
  success: boolean;
  metrics: OverviewMetrics;
  recentComplaints: ComplaintItem[];
  error?: string;
};

const EMPTY_METRICS: OverviewMetrics = {
  usersTotal: 0,
  activeUsers: 0,
  complaintsTotal: 0,
  openComplaints: 0,
  resolvedComplaints: 0,
  eventsToday: 0,
};

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<OverviewMetrics>(EMPTY_METRICS);
  const [recentComplaints, setRecentComplaints] = useState<ComplaintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/admin/overview", { cache: "no-store" });
        const data = (await response.json()) as OverviewResponse;
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to load overview");
        }
        if (!active) return;
        setMetrics(data.metrics);
        setRecentComplaints(data.recentComplaints || []);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Failed to load overview";
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading admin overview...</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Total Users" value={metrics.usersTotal.toLocaleString()} />
        <MetricCard label="Active Users" value={metrics.activeUsers.toLocaleString()} />
        <MetricCard label="Total Complaints" value={metrics.complaintsTotal.toLocaleString()} />
        <MetricCard label="Open Complaints" value={metrics.openComplaints.toLocaleString()} />
        <MetricCard label="Resolved Complaints" value={metrics.resolvedComplaints.toLocaleString()} />
        <MetricCard label="Events (24h)" value={metrics.eventsToday.toLocaleString()} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Recent Complaints</h2>
          <Link href="/admin/complaints" className="text-sm font-medium text-[#2264ff] hover:text-[#1a50cc]">
            View all
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {recentComplaints.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">No complaints yet.</p>
          ) : (
            recentComplaints.map((item) => (
              <Link
                key={item.id}
                href={`/admin/complaints/${item.id}`}
                className="block px-5 py-4 hover:bg-slate-50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">{item.subject || "Untitled complaint"}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase text-slate-700">
                    {item.status || "new"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {(item.expand?.user?.name || item.expand?.user?.fullName || item.expand?.user?.email || "Unknown user")}
                  {" · "}
                  {item.created ? new Date(item.created).toLocaleString() : ""}
                </p>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </article>
  );
}
