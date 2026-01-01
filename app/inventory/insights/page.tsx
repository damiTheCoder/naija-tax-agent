'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Lightbulb, AlertTriangle, TrendingUp, DollarSign, Clock, MapPin } from 'lucide-react';
import type { TopSellerItem, TopProfitItem, SlowMoverItem, RestockSuggestion, Location } from '@/lib/inventory/types';

export default function InsightsPage() {
    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedLocation, setSelectedLocation] = useState('');
    const [topSellers, setTopSellers] = useState<TopSellerItem[]>([]);
    const [topProfit, setTopProfit] = useState<TopProfitItem[]>([]);
    const [slowMovers, setSlowMovers] = useState<SlowMoverItem[]>([]);
    const [restockSuggestions, setRestockSuggestions] = useState<RestockSuggestion[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLocations();
    }, []);

    useEffect(() => {
        fetchInsights();
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

    async function fetchInsights() {
        setLoading(true);
        try {
            const locationParam = selectedLocation ? `&locationId=${selectedLocation}` : '';

            const [sellersRes, profitRes, slowRes, restockRes] = await Promise.all([
                fetch(`/api/inventory/analytics?type=top-sellers${locationParam}`),
                fetch(`/api/inventory/analytics?type=top-profit${locationParam}`),
                fetch(`/api/inventory/analytics?type=slow-movers${locationParam}`),
                fetch(`/api/inventory/analytics?type=restock${locationParam}`),
            ]);

            setTopSellers(await sellersRes.json());
            setTopProfit(await profitRes.json());
            setSlowMovers(await slowRes.json());
            setRestockSuggestions(await restockRes.json());
        } catch (error) {
            console.error('Error fetching insights:', error);
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

    return (
        <div className="space-y-6 pb-32">
            <main className="px-3 space-y-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <Link href="/inventory" className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mb-1">
                            <ArrowLeft className="w-3 h-3" /> Dashboard
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Insights</h1>
                        <p className="text-xs text-gray-600">Analytics and recommendations</p>
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
                        <div className="animate-pulse text-gray-600">Loading insights...</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Restock Suggestions */}
                        <div className="rounded-2xl bg-white overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/50 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Restock Suggestions</h3>
                                        <p className="text-xs text-gray-600">{restockSuggestions.length} items need attention</p>
                                    </div>
                                </div>
                            </div>
                            {restockSuggestions.length === 0 ? (
                                <div className="p-6 text-center text-sm text-gray-600">
                                    All stock levels are healthy! 🎉
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-200 dark:divide-gray-700/50 max-h-[300px] overflow-y-auto">
                                    {restockSuggestions.map((item) => (
                                        <div key={`${item.productId}-${item.locationId}`} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3">
                                                    <span className={`w-2 h-2 rounded-full mt-1.5 ${item.urgency === 'critical' ? 'bg-red-500' :
                                                            item.urgency === 'soon' ? 'bg-amber-500' : 'bg-gray-400'
                                                        }`} />
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{item.productName}</p>
                                                        <p className="text-xs text-gray-600">{item.locationName}</p>
                                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{item.message}</p>
                                                    </div>
                                                </div>
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full flex-shrink-0 ${item.urgency === 'critical' ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400' :
                                                        item.urgency === 'soon' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400' :
                                                            'bg-gray-100 dark:bg-gray-700 text-gray-900'
                                                    }`}>
                                                    {item.urgency}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Top Sellers */}
                        <div className="rounded-2xl bg-white overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/50 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                                        <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Top Sellers</h3>
                                        <p className="text-xs text-gray-600">Last 30 days by revenue</p>
                                    </div>
                                </div>
                            </div>
                            {topSellers.length === 0 ? (
                                <div className="p-6 text-center text-sm text-gray-600">
                                    No sales data yet
                                </div>
                            ) : (
                                <div className="p-4 space-y-3">
                                    {topSellers.slice(0, 5).map((item, idx) => (
                                        <div key={item.productId} className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center">
                                                {idx + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.productName}</p>
                                                <p className="text-xs text-gray-600">{item.qtySold} units sold</p>
                                            </div>
                                            <p className="text-sm font-semibold text-green-600 dark:text-green-400">{formatCurrency(item.revenue)}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Top Profit Drivers */}
                        <div className="rounded-2xl bg-white overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/50 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                                        <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Top Profit Drivers</h3>
                                        <p className="text-xs text-gray-600">Products with highest margins</p>
                                    </div>
                                </div>
                            </div>
                            {topProfit.length === 0 ? (
                                <div className="p-6 text-center text-sm text-gray-600">
                                    No profit data yet
                                </div>
                            ) : (
                                <div className="p-4 space-y-3">
                                    {topProfit.slice(0, 5).map((item, idx) => (
                                        <div key={item.productId} className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-center">
                                                {idx + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.productName}</p>
                                                <p className="text-xs text-gray-600">{item.qtySold} units</p>
                                            </div>
                                            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">+{formatCurrency(item.profit)}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Slow Movers */}
                        <div className="rounded-2xl bg-white overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/50 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
                                        <Clock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Slow Movers</h3>
                                        <p className="text-xs text-gray-600">No sales in 30+ days</p>
                                    </div>
                                </div>
                            </div>
                            {slowMovers.length === 0 ? (
                                <div className="p-6 text-center text-sm text-gray-600">
                                    No slow-moving items detected
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-200 dark:divide-gray-700/50 max-h-[250px] overflow-y-auto">
                                    {slowMovers.slice(0, 5).map((item) => (
                                        <div key={item.productId} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{item.productName}</p>
                                                    <p className="text-xs text-gray-600">
                                                        {item.onHand} units • Last sold: {item.lastSaleDate ? new Date(item.lastSaleDate).toLocaleDateString() : 'Never'}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(item.cashTied)}</p>
                                                    <p className="text-xs text-gray-400 dark:text-gray-500">tied up</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
