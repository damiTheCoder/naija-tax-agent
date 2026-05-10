"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type UserItem = {
  id: string;
  email?: string;
  name?: string;
  fullName?: string;
  role?: string;
  status?: string;
  sessionVersion?: number;
  created?: string;
  updated?: string;
};

type ComplaintItem = {
  id: string;
  subject?: string;
  status?: string;
  priority?: string;
  created?: string;
};

type UsageEventItem = {
  id: string;
  eventType?: string;
  module?: string;
  path?: string;
  created?: string;
};

type UserSummary = {
  totalComplaints: number;
  openComplaints: number;
  totalUsageEvents: number;
};

type UserResponse = {
  success: boolean;
  item?: UserItem;
  recentComplaints?: ComplaintItem[];
  recentUsage?: UsageEventItem[];
  summary?: UserSummary;
  error?: string;
};

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params.id;
  const router = useRouter();

  const [user, setUser] = useState<UserItem | null>(null);
  const [recentComplaints, setRecentComplaints] = useState<ComplaintItem[]>([]);
  const [recentUsage, setRecentUsage] = useState<UsageEventItem[]>([]);
  const [summary, setSummary] = useState<UserSummary>({
    totalComplaints: 0,
    openComplaints: 0,
    totalUsageEvents: 0,
  });
  const [role, setRole] = useState("user");
  const [status, setStatus] = useState("active");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    const response = await fetch(`/api/admin/users/${userId}`, { cache: "no-store" });
    if (response.status === 401) {
      router.replace(`/auth/login?next=${encodeURIComponent(`/admin/users/${userId}`)}`);
      return;
    }

    const data = (await response.json()) as UserResponse;
    if (!response.ok || !data.success || !data.item) {
      throw new Error(data.error || "Failed to load user");
    }

    setUser(data.item);
    setRole(data.item.role || "user");
    setStatus(data.item.status || "active");
    setName(data.item.name || data.item.fullName || "");
    setRecentComplaints(data.recentComplaints || []);
    setRecentUsage(data.recentUsage || []);
    setSummary(
      data.summary || {
        totalComplaints: 0,
        openComplaints: 0,
        totalUsageEvents: 0,
      },
    );
  }, [router, userId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        await loadUser();
      } catch (err) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : "Failed to load user";
        setError(msg);
      } finally {
        if (active) setLoading(false);
      }
    };

    if (userId) {
      void load();
    }
    return () => {
      active = false;
    };
  }, [loadUser, userId]);

  const runMutation = async (payload: Record<string, unknown>, successMessage: string) => {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      router.replace(`/auth/login?next=${encodeURIComponent(`/admin/users/${userId}`)}`);
      return;
    }

    const data = (await response.json()) as UserResponse;
    if (!response.ok || !data.success || !data.item) {
      throw new Error(data.error || "Failed to update user");
    }

    setUser(data.item);
    setRole(data.item.role || "user");
    setStatus(data.item.status || "active");
    setName(data.item.name || data.item.fullName || "");
    setMessage(successMessage);
    await loadUser();
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await runMutation({ role, status, name, reason }, "User account updated.");
      setReason("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update user";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAction = async (
    action: "suspend" | "reactivate" | "disable" | "force-sign-out",
  ) => {
    setBusyAction(action);
    setError(null);
    setMessage(null);
    try {
      if (action === "disable" && !confirm("Disable this account? The user will not be able to sign in.")) {
        return;
      }
      if (action === "force-sign-out" && !confirm("Invalidate all active sessions for this user?")) {
        return;
      }

      const payload =
        action === "force-sign-out"
          ? { forceSignOut: true, reason }
          : { status: action === "reactivate" ? "active" : action, reason };

      await runMutation(
        payload,
        action === "force-sign-out"
          ? "All active sessions invalidated."
          : `User ${action === "reactivate" ? "reactivated" : action + "d"}.`,
      );
      setReason("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to run user action";
      setError(msg);
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading user...</div>;
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        {error || "User not found."}
      </div>
    );
  }

  const displayName = user.name || user.fullName || "Unnamed user";

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">User Operations</h1>
            <p className="mt-1 text-sm text-slate-600">{user.email || user.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={user.status} />
            <RoleBadge role={user.role} />
            <button
              type="button"
              onClick={() => router.push("/admin/users")}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Back
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <MetricCard label="Open Complaints" value={String(summary.openComplaints)} />
          <MetricCard label="Total Complaints" value={String(summary.totalComplaints)} />
          <MetricCard label="Usage Events" value={String(summary.totalUsageEvents)} />
          <MetricCard label="Session Version" value={String(user.sessionVersion || 1)} />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Account Controls</h2>
            <p className="mt-1 text-sm text-slate-600">
              Update identity, role, and account status. Forced sign-out invalidates every existing session.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Display name</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#8fff00] focus:outline-none focus:ring-2 focus:ring-[#8fff00]/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Role</label>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#8fff00] focus:outline-none focus:ring-2 focus:ring-[#8fff00]/20"
              >
                <option value="user">User</option>
                <option value="read_only">Read only</option>
                <option value="support_agent">Support agent</option>
                <option value="support_admin">Support admin</option>
                <option value="super_admin">Super admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Status</label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#8fff00] focus:outline-none focus:ring-2 focus:ring-[#8fff00]/20"
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Admin reason</label>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Why are you changing this account?"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#8fff00] focus:outline-none focus:ring-2 focus:ring-[#8fff00]/20"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-[#8fff00] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6fcc00] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => void handleQuickAction("suspend")}
              disabled={busyAction !== null}
              className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-60"
            >
              {busyAction === "suspend" ? "Suspending..." : "Suspend"}
            </button>
            <button
              type="button"
              onClick={() => void handleQuickAction("reactivate")}
              disabled={busyAction !== null}
              className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
            >
              {busyAction === "reactivate" ? "Reactivating..." : "Reactivate"}
            </button>
            <button
              type="button"
              onClick={() => void handleQuickAction("force-sign-out")}
              disabled={busyAction !== null}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {busyAction === "force-sign-out" ? "Invalidating..." : "Force sign-out"}
            </button>
            <button
              type="button"
              onClick={() => void handleQuickAction("disable")}
              disabled={busyAction !== null}
              className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
            >
              {busyAction === "disable" ? "Disabling..." : "Disable"}
            </button>
          </div>

          <div className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600 md:grid-cols-2">
            <InfoCell label="Name" value={displayName} />
            <InfoCell label="Email" value={user.email || "—"} />
            <InfoCell label="Created" value={user.created ? new Date(user.created).toLocaleString() : "—"} />
            <InfoCell label="Last update" value={user.updated ? new Date(user.updated).toLocaleString() : "—"} />
          </div>

          {message ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Recent Complaints</h2>
                <p className="mt-1 text-sm text-slate-600">Use complaint history to understand what support already investigated.</p>
              </div>
              <Link href="/admin/complaints" className="text-sm font-medium text-[#446b00] hover:text-[#446b00]">
                Open queue
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {recentComplaints.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                  No complaints recorded for this user.
                </p>
              ) : (
                recentComplaints.map((item) => (
                  <Link
                    key={item.id}
                    href={`/admin/complaints/${item.id}`}
                    className="block rounded-lg border border-slate-200 px-4 py-3 hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.subject || "Untitled complaint"}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.created ? new Date(item.created).toLocaleString() : "Unknown time"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge status={item.status} />
                        <PriorityBadge priority={item.priority} />
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">Recent Activity</h2>
            <p className="mt-1 text-sm text-slate-600">Recent route usage and events linked to this account.</p>

            <div className="mt-4 space-y-3">
              {recentUsage.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                  No tracked usage events yet.
                </p>
              ) : (
                recentUsage.map((item) => (
                  <article key={item.id} className="rounded-lg border border-slate-200 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{item.eventType || "event"}</p>
                      <p className="text-xs text-slate-500">
                        {item.created ? new Date(item.created).toLocaleString() : "Unknown time"}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {[item.module, item.path].filter(Boolean).join(" · ") || "No path/module context"}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const label = formatLabel(status || "active");
  const tone = {
    active: "border-emerald-200 bg-emerald-50 text-emerald-700",
    suspended: "border-amber-200 bg-amber-50 text-amber-800",
    disabled: "border-rose-200 bg-rose-50 text-rose-700",
    new: "border-blue-200 bg-blue-50 text-blue-700",
    triaged: "border-indigo-200 bg-indigo-50 text-indigo-700",
    investigating: "border-amber-200 bg-amber-50 text-amber-800",
    waiting_user: "border-orange-200 bg-orange-50 text-orange-700",
    resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    closed: "border-slate-200 bg-slate-100 text-slate-700",
  }[status || "active"] || "border-slate-200 bg-slate-100 text-slate-700";

  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{label}</span>;
}

function RoleBadge({ role }: { role?: string }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
      {formatLabel(role || "user")}
    </span>
  );
}

function PriorityBadge({ priority }: { priority?: string }) {
  const label = `${formatLabel(priority || "medium")} priority`;
  const tone = {
    low: "border-slate-200 bg-slate-100 text-slate-700",
    medium: "border-blue-200 bg-blue-50 text-blue-700",
    high: "border-amber-200 bg-amber-50 text-amber-800",
    urgent: "border-rose-200 bg-rose-50 text-rose-700",
  }[priority || "medium"] || "border-blue-200 bg-blue-50 text-blue-700";

  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{label}</span>;
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
