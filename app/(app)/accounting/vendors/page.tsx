"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Vendor = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  type?: string | null;
  taxId?: string | null;
  address?: string | null;
  createdAt?: string;
};

const ENTITY_ID = "entity-default";

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const loadVendors = async (searchTerm = "") => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ entityId: ENTITY_ID });
      if (searchTerm.trim()) qs.set("search", searchTerm.trim());
      const res = await fetch(`/api/accounting/vendors?${qs.toString()}`);
      const data = (await res.json()) as { success?: boolean; vendors?: Vendor[]; error?: string };
      if (!res.ok || data.success !== true) {
        throw new Error(data.error || "Failed to load vendors");
      }
      setVendors(Array.isArray(data.vendors) ? data.vendors : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vendors");
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVendors();
  }, []);

  const filteredCount = useMemo(() => vendors.length, [vendors]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/accounting/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: ENTITY_ID,
          actorRole: "owner",
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || data.success !== true) {
        throw new Error(data.error || "Failed to create vendor");
      }
      setName("");
      setEmail("");
      setPhone("");
      await loadVendors(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create vendor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Vendors</h1>
        <p className="mt-1 text-sm text-slate-600">Supplier master list for AP workflow.</p>

        <form onSubmit={handleCreate} className="mt-4 grid gap-3 md:grid-cols-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Vendor name"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            required
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Add Vendor"}
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 md:max-w-xs"
          />
          <button
            type="button"
            onClick={() => void loadVendors(search)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700"
          >
            Refresh
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-500">{filteredCount} vendor(s)</p>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-3 text-slate-500" colSpan={4}>
                    Loading vendors...
                  </td>
                </tr>
              ) : vendors.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-slate-500" colSpan={4}>
                    No vendors yet.
                  </td>
                </tr>
              ) : (
                vendors.map((vendor) => (
                  <tr key={vendor.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">{vendor.name}</td>
                    <td className="px-3 py-2 text-slate-600">{vendor.email || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{vendor.phone || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{vendor.type || "corporate"}</td>
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
