"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type UserRow = {
  id: string;
  email?: string;
  name?: string;
  fullName?: string;
  role?: string;
  status?: string;
  created?: string;
};

type UsersResponse = {
  success: boolean;
  items: UserRow[];
  totalItems: number;
  totalPages: number;
  page: number;
  perPage: number;
  error?: string;
};

export default function AdminUsersPage() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("perPage", "50");
    if (query.trim()) params.set("query", query.trim());
    if (role) params.set("role", role);
    if (status) params.set("status", status);
    return params.toString();
  }, [query, role, status]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/users?${searchParams}`, { cache: "no-store" });
        const data = (await response.json()) as UsersResponse;
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to load users");
        }
        if (!active) return;
        setItems(data.items || []);
        setTotal(data.totalItems || 0);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Failed to load users";
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
        <h1 className="text-lg font-semibold text-slate-900">User Management</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review user accounts, assign roles, and update account status.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or email"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#9080ee] focus:outline-none focus:ring-2 focus:ring-[#9080ee]/20"
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#9080ee] focus:outline-none focus:ring-2 focus:ring-[#9080ee]/20"
          >
            <option value="">All roles</option>
            <option value="user">User</option>
            <option value="read_only">Read only</option>
            <option value="support_agent">Support agent</option>
            <option value="support_admin">Support admin</option>
            <option value="super_admin">Super admin</option>
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#9080ee] focus:outline-none focus:ring-2 focus:ring-[#9080ee]/20"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <p className="text-sm text-slate-600">
            {loading ? "Loading users..." : `${total.toLocaleString()} users`}
          </p>
        </div>

        {error ? (
          <p className="px-4 py-6 text-sm text-rose-700">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900">{item.name || item.fullName || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{item.email || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{item.role || "user"}</td>
                    <td className="px-4 py-3 text-slate-700">{item.status || "active"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.created ? new Date(item.created).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/users/${item.id}`} className="font-medium text-[#4a3880] hover:text-[#4a3880]">
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      No users found.
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
