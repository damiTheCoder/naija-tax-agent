'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { InventorySummary, Location, RestockSuggestion, TopSellerItem } from '@/lib/inventory/types';
import { Package, TrendingUp, AlertTriangle, Clock, ChevronRight, BarChart3, ArrowRightLeft, ShoppingCart, Lightbulb, LineChart } from 'lucide-react';

export default function InventoryDashboard() {
    const [summary, setSummary] = useState<InventorySummary | null>(null);
    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<string>('');
    const [restockAlerts, setRestockAlerts] = useState<RestockSuggestion[]>([]);
    const [topSellers, setTopSellers] = useState<TopSellerItem[]>([]);
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

            const [summaryRes, restockRes, sellersRes] = await Promise.all([
                fetch(`/api/inventory/analytics?type=summary${locationParam}`),
                fetch(`/api/inventory/analytics?type=restock${locationParam}`),
                fetch(`/api/inventory/analytics?type=top-sellers${locationParam}`),
            ]);

            setSummary(await summaryRes.json());
            setRestockAlerts((await restockRes.json()).slice(0, 5));
            setTopSellers((await sellersRes.json()).slice(0, 5));
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
            maximumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <div className="space-y-6 pb-32">
            <main className="px-3 space-y-4">
                {/* Header with Location Filter */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <p className="text-xs font-medium text-gray-600 mb-0.5">Inventory</p>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
                    </div>
                    <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="px-4 py-2 rounded-xl bg-white text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Locations</option>
                        {locations.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                                {loc.name} {loc.type === 'WAREHOUSE' ? '📦' : '🏪'}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Summary Cards */}
                {loading ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="rounded-2xl  p-4 animate-pulse shadow-sm">
                                <div className="h-8 w-8 rounded-lg bg-gray-200 dark:bg-gray-700 mb-3"></div>
                                <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                                <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            </div>
                        ))}
                    </div>
                ) : summary && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <SummaryCard icon={<Package className="w-4 h-4" />} label="Total Products" value={summary.totalProducts.toString()} color="blue" />
                        <SummaryCard icon={<TrendingUp className="w-4 h-4" />} label="Stock Value" value={formatCurrency(summary.totalStockValue)} color="green" />
                        <SummaryCard icon={<AlertTriangle className="w-4 h-4" />} label="Low Stock" value={summary.lowStockCount.toString()} color="amber" highlight={summary.lowStockCount > 0} />
                        <SummaryCard icon={<Clock className="w-4 h-4" />} label="Pending" value={(summary.pendingPOCount + summary.inTransitTransferCount).toString()} subtitle={`${summary.pendingPOCount} POs • ${summary.inTransitTransferCount} transfers`} color="purple" />
                    </div>
                )}

                {/* Restock Alerts */}
                {restockAlerts.length > 0 && (
                    <div className="rounded-2xl  overflow-hidden shadow-sm">
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Restock Alerts</h3>
                                        <p className="text-xs text-gray-600">{restockAlerts.length} items need attention</p>
                                    </div>
                                </div>
                                <Link href="/inventory/insights" className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                                    View all <ChevronRight className="w-3 h-3" />
                                </Link>
                            </div>
                        </div>
                        <div className="divide-y divide-gray-200 dark:divide-gray-700/50">
                            {restockAlerts.map((alert) => (
                                <div key={`${alert.productId}-${alert.locationId}`} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-2 h-2 rounded-full ${alert.urgency === 'critical' ? 'bg-red-500' : alert.urgency === 'soon' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">{alert.productName}</p>
                                            <p className="text-xs text-gray-600">{alert.locationName} • {alert.onHand} left</p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${alert.urgency === 'critical' ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400' :
                                        alert.urgency === 'soon' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400' :
                                            'bg-gray-100 dark:bg-gray-700 text-gray-900'
                                        }`}>
                                        {alert.urgency}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Top Sellers */}
                {topSellers.length > 0 && (
                    <div className="rounded-2xl  overflow-hidden shadow-sm">
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/50">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                                    <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Top Sellers</h3>
                                    <p className="text-xs text-gray-600">Last 30 days</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 space-y-3">
                            {topSellers.map((item, idx) => (
                                <div key={item.productId} className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center">
                                        {idx + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.productName}</p>
                                        <p className="text-xs text-gray-600">{item.qtySold} units sold</p>
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(item.revenue)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Quick Actions */}
                <div className="rounded-2xl overflow-hidden">
                    <div className="py-2">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Quick Actions</h3>
                        <p className="text-xs text-gray-600">Navigate to inventory sections</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <QuickActionCard href="/inventory/products" icon={<Package className="w-5 h-5" />} title="Products" subtitle="Manage catalog" color="blue" />
                        <QuickActionCard href="/inventory/stock" icon={<BarChart3 className="w-5 h-5" />} title="Stock Levels" subtitle="Check inventory" color="green" />
                        <QuickActionCard href="/inventory/purchase-orders" icon={<ShoppingCart className="w-5 h-5" />} title="Purchase Orders" subtitle="Create & receive" color="purple" />
                        <QuickActionCard href="/inventory/transfers" icon={<ArrowRightLeft className="w-5 h-5" />} title="Transfers" subtitle="Move stock" color="amber" />
                        <QuickActionCard href="/inventory/insights" icon={<Lightbulb className="w-5 h-5" />} title="Insights" subtitle="Analytics" color="rose" />
                        <QuickActionCard href="/inventory/charts" icon={<LineChart className="w-5 h-5" />} title="Charts" subtitle="Visualize trends" color="cyan" />
                    </div>
                </div>
            </main>
        </div>
    );
}

function SummaryCard({
    icon,
    label,
    value,
    subtitle,
    color,
    highlight = false,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    subtitle?: string;
    color: 'blue' | 'green' | 'amber' | 'purple';
    highlight?: boolean;
}) {
    const colors = {
        blue: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
        green: 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400',
        amber: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
        purple: 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400',
    };

    return (
        <div
            className={`rounded-2xl border ${highlight ? 'border-amber-400 dark:border-amber-600' : 'border-gray-200 dark:border-gray-700/50'} p-4 shadow-sm`}
           
        >
            <div className={`w-8 h-8 rounded-lg ${colors[color]} flex items-center justify-center mb-3`}>
                {icon}
            </div>
            <p className="text-xs text-gray-900 mb-1">{label}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
            {subtitle && <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>}
        </div>
    );
}

function QuickActionCard({
    href,
    icon,
    title,
    subtitle,
    color,
}: {
    href: string;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    color: 'blue' | 'green' | 'amber' | 'purple' | 'rose' | 'cyan';
}) {
    const colors = {
        blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50',
        green: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 group-hover:bg-green-100 dark:group-hover:bg-green-900/50',
        amber: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50',
        purple: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50',
        rose: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 group-hover:bg-rose-100 dark:group-hover:bg-rose-900/50',
        cyan: 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900/50',
    };

    return (
        <Link
            href={href}
            className="group rounded-2xl  p-4 hover:border-blue-400 dark:hover:border-blue-600 transition-all shadow-sm"
           
        >
            <div className={`w-10 h-10 rounded-xl ${colors[color]} flex items-center justify-center mb-3 transition-colors`}>
                {icon}
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {title}
            </h3>
            <p className="text-xs text-gray-600">{subtitle}</p>
        </Link>
    );
}
