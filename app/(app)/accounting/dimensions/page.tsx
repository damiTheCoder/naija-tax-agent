"use client";

import { FormEvent, useEffect, useState } from "react";

type TrackingClass = {
  id: string;
  name: string;
  code?: string | null;
  isActive?: boolean;
};

type TrackingLocation = {
  id: string;
  name: string;
  code?: string | null;
  isActive?: boolean;
};

const ENTITY_ID = "entity-default";

export default function DimensionsPage() {
  const [classes, setClasses] = useState<TrackingClass[]>([]);
  const [locations, setLocations] = useState<TrackingLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [className, setClassName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationCode, setLocationCode] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [classRes, locationRes] = await Promise.all([
        fetch(`/api/accounting/dimensions/classes?entityId=${encodeURIComponent(ENTITY_ID)}`),
        fetch(`/api/accounting/dimensions/locations?entityId=${encodeURIComponent(ENTITY_ID)}`),
      ]);

      const classJson = (await classRes.json()) as { success?: boolean; classes?: TrackingClass[]; error?: string };
      const locationJson = (await locationRes.json()) as { success?: boolean; locations?: TrackingLocation[]; error?: string };

      if (!classRes.ok || classJson.success !== true) throw new Error(classJson.error || "Failed to load classes");
      if (!locationRes.ok || locationJson.success !== true) throw new Error(locationJson.error || "Failed to load locations");

      setClasses(Array.isArray(classJson.classes) ? classJson.classes : []);
      setLocations(Array.isArray(locationJson.locations) ? locationJson.locations : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dimensions");
      setClasses([]);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createClass = async (event: FormEvent) => {
    event.preventDefault();
    if (!className.trim()) return;
    setError(null);
    try {
      const res = await fetch("/api/accounting/dimensions/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: ENTITY_ID,
          actorRole: "owner",
          name: className.trim(),
          code: classCode.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || data.success !== true) throw new Error(data.error || "Failed to create class");
      setClassName("");
      setClassCode("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create class");
    }
  };

  const createLocation = async (event: FormEvent) => {
    event.preventDefault();
    if (!locationName.trim()) return;
    setError(null);
    try {
      const res = await fetch("/api/accounting/dimensions/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: ENTITY_ID,
          actorRole: "owner",
          name: locationName.trim(),
          code: locationCode.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || data.success !== true) throw new Error(data.error || "Failed to create location");
      setLocationName("");
      setLocationCode("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create location");
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Dimensions</h1>
        <p className="mt-1 text-sm text-slate-600">Class and location tracking for branch and departmental reporting.</p>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 p-4">
            <h2 className="text-lg font-semibold text-slate-900">Classes</h2>
            <form onSubmit={createClass} className="mt-3 grid gap-2 sm:grid-cols-3">
              <input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Class name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" required />
              <input value={classCode} onChange={(e) => setClassCode(e.target.value)} placeholder="Code" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button type="submit" className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white sm:col-span-3">Add Class</button>
            </form>

            <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-slate-200">
              {loading ? (
                <p className="p-3 text-sm text-slate-500">Loading classes...</p>
              ) : classes.length === 0 ? (
                <p className="p-3 text-sm text-slate-500">No classes yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {classes.map((item) => (
                    <li key={item.id} className="flex items-center justify-between px-3 py-2">
                      <span className="font-medium text-slate-900">{item.name}</span>
                      <span className="text-slate-600">{item.code || "-"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <h2 className="text-lg font-semibold text-slate-900">Locations</h2>
            <form onSubmit={createLocation} className="mt-3 grid gap-2 sm:grid-cols-3">
              <input value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Location name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" required />
              <input value={locationCode} onChange={(e) => setLocationCode(e.target.value)} placeholder="Code" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button type="submit" className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white sm:col-span-3">Add Location</button>
            </form>

            <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-slate-200">
              {loading ? (
                <p className="p-3 text-sm text-slate-500">Loading locations...</p>
              ) : locations.length === 0 ? (
                <p className="p-3 text-sm text-slate-500">No locations yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {locations.map((item) => (
                    <li key={item.id} className="flex items-center justify-between px-3 py-2">
                      <span className="font-medium text-slate-900">{item.name}</span>
                      <span className="text-slate-600">{item.code || "-"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
