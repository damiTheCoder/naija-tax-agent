"use client";

import { useTheme } from "@/lib/ThemeContext";
import { useConnectedApps } from "@/lib/ConnectedAppsContext";

export default function ConnectedAppsPage() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const { apps, toggleApp: toggleConnection } = useConnectedApps();

    const connectedApps = apps.filter((a) => a.status === "connected");
    const availableApps = apps.filter((a) => a.status === "disconnected");

    return (
        <div className="space-y-8 pb-16">
            {/* Page Header */}
            <div>
                <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                    Connected Apps
                </h1>
                <p className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    Manage your linked banks, investment platforms, and financial services
                </p>
            </div>

            {/* Connected Apps Section */}
            {connectedApps.length > 0 && (
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                            Active Connections
                            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${isDark ? "bg-emerald-900/40 text-emerald-400" : "bg-emerald-100 text-emerald-700"}`}>
                                {connectedApps.length}
                            </span>
                        </h2>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {connectedApps.map((app) => (
                            <div
                                key={app.id}
                                className={`
                  rounded-2xl border p-5 transition-all
                  ${isDark
                                        ? "border-gray-700 bg-gray-900/50 hover:border-gray-600"
                                        : "border-gray-200 bg-white hover:border-gray-300"
                                    }
                `}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                                            style={{ background: app.accent }}
                                        >
                                            {app.initial}
                                        </div>
                                        <div>
                                            <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                                                {app.name}
                                            </h3>
                                            <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>{app.type}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => toggleConnection(app.id)}
                                        className={`
                      relative w-11 h-6 rounded-full transition-colors flex-shrink-0
                      ${isDark ? "bg-emerald-600" : "bg-emerald-500"}
                    `}
                                    >
                                        <div className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform" />
                                    </button>
                                </div>
                                <p className={`text-xs leading-relaxed mb-3 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                                    {app.description}
                                </p>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <span className={`text-[11px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                                            Synced {app.lastSync}
                                        </span>
                                    </div>
                                    {app.impact && (
                                        <span className={`text-[11px] font-semibold ${app.impact.startsWith("+") ? "text-emerald-500"
                                            : app.impact.startsWith("-") ? (isDark ? "text-red-400" : "text-red-600")
                                                : (isDark ? "text-gray-400" : "text-gray-500")
                                            }`}>
                                            {app.impact}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Available Apps Section */}
            {availableApps.length > 0 && (
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                            Available to Connect
                        </h2>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {availableApps.map((app) => (
                            <div
                                key={app.id}
                                className={`
                  rounded-2xl border p-5 transition-all
                  ${isDark
                                        ? "border-gray-800 bg-gray-900/30 hover:border-gray-700"
                                        : "border-gray-200 bg-gray-50/50 hover:border-gray-300"
                                    }
                `}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold opacity-60"
                                            style={{ background: app.accent }}
                                        >
                                            {app.initial}
                                        </div>
                                        <div>
                                            <h3 className={`text-sm font-semibold ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                                                {app.name}
                                            </h3>
                                            <p className={`text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>{app.type}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => toggleConnection(app.id)}
                                        className={`
                      relative w-11 h-6 rounded-full transition-colors flex-shrink-0
                      ${isDark ? "bg-gray-700" : "bg-gray-300"}
                    `}
                                    >
                                        <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform" />
                                    </button>
                                </div>
                                <p className={`text-xs leading-relaxed ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                                    {app.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
