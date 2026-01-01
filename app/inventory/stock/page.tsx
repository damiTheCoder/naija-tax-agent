'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Search, AlertTriangle, CheckCircle2, MapPin } from 'lucide-react';
import type { InventoryBalance, PaginatedResponse, Location } from '@/lib/inventory/types';

export default function StockPage() {
    const [stock, setStock] = useState<InventoryBalance[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [locationFilter, setLocationFilter] = useState('');
    const [showLowStock, setShowLowStock] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchLocations();
    }, []);

    useEffect(() => {
        fetchStock();
    }, [locationFilter, showLowStock]);

    async function fetchLocations() {
        try {
            const res = await fetch('/api/inventory/locations');
            const data = await res.json();
            setLocations(data);
        } catch (error) {
            console.error('Error fetching locations:', error);
        }
    }

    async function fetchStock() {
        setLoading(true);
        try {
            let url = `/api/inventory/stock?limit=100`;
            if (locationFilter) url += `&locationId=${locationFilter}`;
            if (showLowStock) url += `&belowReorder=true`;
            if (search) url += `&q=${encodeURIComponent(search)}`;

            const res = await fetch(url);
            const data: PaginatedResponse<InventoryBalance> = await res.json();
            setStock(data.data);
        } catch (error) {
            console.error('Error fetching stock:', error);
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

    const totalValue = stock.reduce((sum, item) => sum + (item.onHand * (item.product?.costPrice || 0)), 0);
    const lowStockCount = stock.filter(s => s.onHand < (s.product?.reorderLevel || 0)).length;

    return (
        <div className="space-y-6 pb-32">
            <main className="px-3 space-y-4">
                {/* Header */}
                <div>
                    <Link href="/inventory" className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mb-1">
                        <ArrowLeft className="w-3 h-3" /> Dashboard
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock Levels</h1>
                    <p className="text-xs text-gray-600">View and manage inventory across locations</p>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white p-4">
                        <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center mb-2">
                            <BarChart3 className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </div>
                        <p className="text-xs text-gray-900">Total Value</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(totalValue)}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mb-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <p className="text-xs text-gray-900">Low Stock Items</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{lowStockCount}</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="rounded-2xl bg-white p-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchStock()}
                                placeholder="Search products..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex gap-2">
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <select
                                    value={locationFilter}
                                    onChange={(e) => setLocationFilter(e.target.value)}
                                    className="pl-10 pr-8 py-2.5 rounded-xl bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                                >
                                    <option value="">All Locations</option>
                                    {locations.map((loc) => (
                                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={() => setShowLowStock(!showLowStock)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${showLowStock
                                        ? 'bg-amber-100 dark:bg-amber-900/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400'
                                        : 'bg-gray-200 dark:bg-gray-700 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                                    }`}
                            >
                                <AlertTriangle className="w-4 h-4" />
                                Low Stock
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stock List */}
                <div className="rounded-2xl bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/50 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                                <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Inventory Balances</h3>
                                <p className="text-xs text-gray-600">{stock.length} items</p>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="animate-pulse text-gray-600">Loading stock...</div>
                        </div>
                    ) : stock.length === 0 ? (
                        <div className="p-8 text-center">
                            <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-600">No stock found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700/50">
                            {stock.map((item) => {
                                const isLow = item.onHand < (item.product?.reorderLevel || 0);
                                const value = item.onHand * (item.product?.costPrice || 0);
                                return (
                                    <div key={item.id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLow ? 'bg-amber-100 dark:bg-amber-900/50' : 'bg-green-100 dark:bg-green-900/50'
                                                    }`}>
                                                    {isLow
                                                        ? <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                                        : <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                                                    }
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.product?.name}</p>
                                                    <p className="text-xs text-gray-600">
                                                        {item.location?.name} • SKU: {item.product?.sku}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className={`text-sm font-bold ${isLow ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                                                    {item.onHand} {item.product?.unit}
                                                </p>
                                                <p className="text-xs text-gray-600">
                                                    Reorder: {item.product?.reorderLevel}
                                                </p>
                                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                                    {formatCurrency(value)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
