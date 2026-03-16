"use client";

import { useState } from "react";
import { useTheme } from "@/lib/ThemeContext";
import { useConnectedApps } from "@/lib/ConnectedAppsContext";
import Image from "next/image";
import { Search } from "lucide-react";

export default function ConnectedAppsPage() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const { apps, toggleApp: toggleConnection } = useConnectedApps();
    const [searchQuery, setSearchQuery] = useState("");

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const matchesSearch = (value: string) => value.toLowerCase().includes(normalizedQuery);

    const connectedApps = apps.filter(
        (a) =>
            a.status === "connected" &&
            (!normalizedQuery ||
                matchesSearch(a.name) ||
                matchesSearch(a.type) ||
                matchesSearch(a.description))
    );

    const availableApps = apps.filter(
        (a) =>
            a.status === "disconnected" &&
            (!normalizedQuery ||
                matchesSearch(a.name) ||
                matchesSearch(a.type) ||
                matchesSearch(a.description))
    );

    return (
        <div className="space-y-8 pb-8 sm:pb-10 px-1 sm:px-0">
            {/* Page Header */}
            <div>
                <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                    Connected Apps
                </h1>
                <p className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    Manage your linked banks, investment platforms, and financial services
                </p>
            </div>

            {/* Search */}
            <div
                className={`h-9 rounded-full px-3 flex items-center gap-2 overflow-hidden transition-colors ${isDark
                        ? "bg-gray-800/90"
                        : "bg-gray-100 shadow-[0_1px_6px_rgba(15,23,42,0.06)]"
                    }`}
            >
                <Search className={`w-4 h-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search apps by name, type, or description"
                    className={`flex-1 h-full bg-transparent !border-0 !rounded-none !shadow-none !ring-0 !outline-none !p-0 !m-0 text-sm ${isDark ? "text-gray-200 placeholder:text-gray-500" : "text-gray-700 placeholder:text-gray-400"}`}
                    style={{ border: "none", boxShadow: "none" }}
                />
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
                  rounded-2xl p-5 transition-all
                  ${isDark
                                        ? "bg-gray-800/70 hover:bg-gray-800/90"
                                        : "bg-gray-100 hover:bg-gray-200/70"
                                    }
                `}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white text-sm font-bold overflow-hidden"
                                            style={{ background: app.logo ? "transparent" : app.accent }}
                                        >
                                            {app.logo ? (
                                                <Image
                                                    src={app.logo}
                                                    alt={`${app.name} logo`}
                                                    width={32}
                                                    height={32}
                                                    className="w-8 h-8 object-contain rounded-full"
                                                />
                                            ) : (
                                                app.initial
                                            )}
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
                  rounded-2xl p-5 transition-all
                  ${isDark
                                        ? "bg-gray-800/50 hover:bg-gray-800/70"
                                        : "bg-gray-100/80 hover:bg-gray-200/60"
                                    }
                `}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white text-sm font-bold opacity-70 overflow-hidden"
                                            style={{ background: app.logo ? "transparent" : app.accent }}
                                        >
                                            {app.logo ? (
                                                <Image
                                                    src={app.logo}
                                                    alt={`${app.name} logo`}
                                                    width={32}
                                                    height={32}
                                                    className="w-8 h-8 object-contain rounded-full"
                                                />
                                            ) : (
                                                app.initial
                                            )}
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

            {connectedApps.length === 0 && availableApps.length === 0 && (
                <div className={`rounded-2xl p-5 text-sm ${isDark ? "bg-gray-800/60 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
                    No apps matched your search.
                </div>
            )}
        </div>
    );
}
