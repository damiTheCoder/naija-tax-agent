'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, LineChart, MapPin, TrendingUp, Package, AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import type { Location, InventorySummary } from '@/lib/inventory/types';

export default function ChartsPage() {
    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedLocation, setSelectedLocation] = useState('');
    const [summary, setSummary] = useState<InventorySummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLocations();
    }, []);

    useEffect(() => {
        fetchData();
    }, [selectedLocation]);

    async function fetchLocations() {
        try {
            const res = await fetch('/api/inventory/locations');
            const data = await res.json();
            setLocations(data);
        } catch (error) {
            console.error('Error fetching locations:', error);
        }
    }

    async function fetchData() {
        setLoading(true);
        try {
            const locationParam = selectedLocation ? `&locationId=${selectedLocation}` : '';
            const res = await fetch(`/api/inventory/analytics?type=summary${locationParam}`);
            setSummary(await res.json());
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const healthyCount = (summary?.totalProducts || 0) - (summary?.lowStockCount || 0);
    const healthPercent = summary && summary.totalProducts > 0
        ? Math.round((healthyCount / summary.totalProducts) * 100)
        : 0;

    return (
        <div className="space-y-6 pb-32">
            <main className="px-3 space-y-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <Link href="/inventory" className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mb-1">
                            <ArrowLeft className="w-3 h-3" /> Dashboard
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Charts</h1>
                        <p className="text-xs text-gray-600">Visualize inventory trends</p>
                    </div>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                            value={selectedLocation}
                            onChange={(e) => setSelectedLocation(e.target.value)}
                            className="pl-10 pr-8 py-2 rounded-xl bg-white dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                        >
                            <option value="">All Locations</option>
                            {locations.map((loc) => (
                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="p-8 text-center">
                        <div className="animate-pulse text-gray-600">Loading charts...</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Stock Value */}
                        <div className="rounded-2xl bg-white overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/50 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                                        <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Stock Value Overview</h3>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="text-center mb-6">
                                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                                        {formatCurrency(summary?.totalStockValue || 0)}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1">Total Stock Value</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 rounded-xl bg-white text-center bg-white">
                                        <Package className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">{summary?.totalProducts || 0}</p>
                                        <p className="text-xs text-gray-600">Products</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-white text-center bg-white">
                                        <MapPin className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">{locations.length}</p>
                                        <p className="text-xs text-gray-600">Locations</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stock Health */}
                        <div className="rounded-2xl bg-white overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/50 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                                        <Package className="w-4 h-4 text-green-600 dark:text-green-400" />
                                    </div>
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Stock Health</h3>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/30 text-center">
                                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{healthyCount}</p>
                                        <p className="text-xs text-gray-900 mt-1">Healthy Stock</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-center">
                                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary?.lowStockCount || 0}</p>
                                        <p className="text-xs text-gray-900 mt-1">Low Stock</p>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div>
                                    <div className="flex justify-between text-xs text-gray-600 mb-2">
                                        <span>Stock Health</span>
                                        <span className={healthPercent >= 80 ? 'text-green-600 dark:text-green-400' : healthPercent >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}>
                                            {healthPercent}%
                                        </span>
                                    </div>
                                    <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${healthPercent >= 80 ? 'bg-green-500' : healthPercent >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                                }`}
                                            style={{ width: `${healthPercent}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Pending Actions */}
                        <div className="rounded-2xl bg-white overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/50 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                                        <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Pending Actions</h3>
                                </div>
                            </div>
                            <div className="p-4 space-y-3">
                                <Link
                                    href="/inventory/purchase-orders?status=PENDING"
                                    className="flex items-center justify-between p-4 rounded-xl bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                                            <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">Pending Purchase Orders</p>
                                            <p className="text-xs text-gray-600">Awaiting receipt</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{summary?.pendingPOCount || 0}</span>
                                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                                    </div>
                                </Link>

                                <Link
                                    href="/inventory/transfers?status=IN_TRANSIT"
                                    className="flex items-center justify-between p-4 rounded-xl bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                                            <AlertTriangle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">In-Transit Transfers</p>
                                            <p className="text-xs text-gray-600">Awaiting delivery</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{summary?.inTransitTransferCount || 0}</span>
                                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
                                    </div>
                                </Link>
                            </div>
                        </div>

                        {/* Coming Soon */}
                        <div className="rounded-2xl bg-white overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/50 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center">
                                        <LineChart className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                                    </div>
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">More Charts Coming</h3>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="text-center text-gray-400 dark:text-gray-500">
                                    <LineChart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p className="text-sm font-medium mb-2 text-gray-900 dark:text-white">Advanced Analytics</p>
                                    <ul className="text-xs space-y-1">
                                        <li>📈 Sales vs Stock trends</li>
                                        <li>📊 Inventory turnover</li>
                                        <li>⚠️ Stockouts over time</li>
                                        <li>💰 Cash tied by category</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
