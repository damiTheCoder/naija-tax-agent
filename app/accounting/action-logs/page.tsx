"use client";

import { useEffect, useState } from "react";

type ActionLog = {
  id: string;
  actionId: string;
  actionType: string;
  resourceType?: string | null;
  resourceId?: string | null;
  journalId?: string | null;
  status: string;
  message?: string | null;
  deepLink?: string | null;
  createdAt: string;
};

type HealthCheck = {
  check: string;
  ok: boolean;
  detail: string;
};

const ENTITY_ID = "entity-default";

export default function ActionLogsPage() {
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [healthStatus, setHealthStatus] = useState<string>("checking");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const [logsRes, healthRes] = await Promise.all([
        fetch(`/api/accounting/action-executions?entityId=${encodeURIComponent(ENTITY_ID)}&limit=100`),
        fetch("/api/accounting/health"),
      ]);

      const logsJson = (await logsRes.json()) as { success?: boolean; actions?: ActionLog[]; error?: string };
      const healthJson = (await healthRes.json()) as {
        success?: boolean;
        status?: string;
        checks?: HealthCheck[];
        remediation?: string | null;
      };

      if (!logsRes.ok || logsJson.success !== true) {
        throw new Error(logsJson.error || "Failed to load action logs");
      }

      setLogs(Array.isArray(logsJson.actions) ? logsJson.actions : []);
      setChecks(Array.isArray(healthJson.checks) ? healthJson.checks : []);
      setHealthStatus(typeof healthJson.status === "string" ? healthJson.status : healthRes.ok ? "healthy" : "degraded");

      if (!healthRes.ok && healthJson.remediation) {
        setError(healthJson.remediation);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load action logs");
      setLogs([]);
      setChecks([]);
      setHealthStatus("degraded");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Execution & Action Logs</h1>
            <p className="mt-1 text-sm text-slate-600">Verifiable receipts for AI/accounting actions.</p>
          </div>
          <button
            onClick={() => void load()}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-900">
            Accounting Health: <span className={healthStatus === "healthy" ? "text-emerald-600" : "text-amber-600"}>{healthStatus}</span>
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {checks.length === 0 ? (
              <p className="text-xs text-slate-500">No health checks available yet.</p>
            ) : (
              checks.map((item) => (
                <div key={item.check} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                  <p className="font-medium text-slate-900">{item.check}</p>
                  <p className={item.ok ? "text-emerald-600" : "text-amber-600"}>{item.detail}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-amber-700">{error}</p> : null}

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Resource</th>
                <th className="px-3 py-2">Journal</th>
                <th className="px-3 py-2">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-slate-500">Loading logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-slate-500">No action logs yet.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700">{new Date(log.createdAt).toLocaleString("en-NG")}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-900">{log.actionType}</p>
                      <p className="text-xs text-slate-500">{log.message || "-"}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span className={log.status === "success" ? "text-emerald-600" : "text-red-600"}>{log.status}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{log.resourceType || "-"} {log.resourceId ? `#${log.resourceId}` : ""}</td>
                    <td className="px-3 py-2 text-slate-700">{log.journalId || "-"}</td>
                    <td className="px-3 py-2">
                      <p className="font-mono text-xs text-slate-700">{log.actionId}</p>
                      {log.deepLink ? (
                        <a href={log.deepLink} className="text-xs text-blue-600 underline">Open</a>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
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
