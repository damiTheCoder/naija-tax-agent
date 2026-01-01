'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShoppingCart, Plus, Package, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { PurchaseOrder, PaginatedResponse } from '@/lib/inventory/types';

export default function PurchaseOrdersPage() {
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');

    useEffect(() => {
        fetchOrders();
    }, [statusFilter]);

    async function fetchOrders() {
        setLoading(true);
        try {
            let url = `/api/inventory/purchase-orders?limit=50`;
            if (statusFilter) url += `&status=${statusFilter}`;

            const res = await fetch(url);
            const data: PaginatedResponse<PurchaseOrder> = await res.json();
            setOrders(data.data);
        } catch (error) {
            console.error('Error fetching orders:', error);
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

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'DRAFT': return {
                icon: <Clock className="w-4 h-4" />,
                bgClass: 'bg-gray-100 dark:bg-gray-700',
                textClass: 'text-gray-900'
            };
            case 'PENDING': return {
                icon: <AlertCircle className="w-4 h-4" />,
                bgClass: 'bg-blue-100 dark:bg-blue-900/50',
                textClass: 'text-blue-600 dark:text-blue-400'
            };
            case 'PARTIALLY_RECEIVED': return {
                icon: <Package className="w-4 h-4" />,
                bgClass: 'bg-amber-100 dark:bg-amber-900/50',
                textClass: 'text-amber-600 dark:text-amber-400'
            };
            case 'RECEIVED': return {
                icon: <CheckCircle2 className="w-4 h-4" />,
                bgClass: 'bg-green-100 dark:bg-green-900/50',
                textClass: 'text-green-600 dark:text-green-400'
            };
            case 'CANCELLED': return {
                icon: <XCircle className="w-4 h-4" />,
                bgClass: 'bg-red-100 dark:bg-red-900/50',
                textClass: 'text-red-600 dark:text-red-400'
            };
            default: return {
                icon: <Clock className="w-4 h-4" />,
                bgClass: 'bg-gray-100',
                textClass: 'text-gray-600'
            };
        }
    };

    const statusTabs = [
        { value: '', label: 'All' },
        { value: 'PENDING', label: 'Pending' },
        { value: 'PARTIALLY_RECEIVED', label: 'Partial' },
        { value: 'RECEIVED', label: 'Complete' },
        { value: 'DRAFT', label: 'Draft' },
    ];

    return (
        <div className="space-y-6 pb-32">
            <main className="px-3 space-y-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <Link href="/inventory" className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mb-1">
                            <ArrowLeft className="w-3 h-3" /> Dashboard
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Purchase Orders</h1>
                        <p className="text-xs text-gray-600">Order stock from suppliers</p>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors">
                        <Plus className="w-4 h-4" />
                        Create PO
                    </button>
                </div>

                {/* Status Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                    {statusTabs.map((tab) => (
                        <button
                            key={tab.value}
                            onClick={() => setStatusFilter(tab.value)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${statusFilter === tab.value
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Orders List */}
                <div className="rounded-2xl bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/50 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                                <ShoppingCart className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Purchase Orders</h3>
                                <p className="text-xs text-gray-600">{orders.length} orders</p>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="animate-pulse text-gray-600">Loading orders...</div>
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="p-8 text-center">
                            <ShoppingCart className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-600">No purchase orders found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700/50">
                            {orders.map((order) => {
                                const total = order.lines?.reduce((sum, l) => sum + l.qtyOrdered * l.unitCost, 0) || 0;
                                const received = order.lines?.reduce((sum, l) => sum + l.qtyReceived * l.unitCost, 0) || 0;
                                const statusConfig = getStatusConfig(order.status);

                                return (
                                    <div key={order.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-3">
                                                <div className={`w-10 h-10 rounded-xl ${statusConfig.bgClass} flex items-center justify-center ${statusConfig.textClass}`}>
                                                    {statusConfig.icon}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                                                            #{order.id.slice(0, 8)}
                                                        </span>
                                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.bgClass} ${statusConfig.textClass}`}>
                                                            {order.status.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {order.supplier?.name}
                                                    </p>
                                                    <p className="text-xs text-gray-600">
                                                        To: {order.location?.name} • {order.lines?.length || 0} items
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                    {formatCurrency(total)}
                                                </p>
                                                {order.status === 'PARTIALLY_RECEIVED' && (
                                                    <p className="text-xs text-amber-600 dark:text-amber-400">
                                                        Received: {formatCurrency(received)}
                                                    </p>
                                                )}
                                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                                    {new Date(order.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>

                                        {(order.status === 'PENDING' || order.status === 'PARTIALLY_RECEIVED') && (
                                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50 flex gap-2">
                                                <button className="flex-1 px-3 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors">
                                                    Receive Stock
                                                </button>
                                                <button className="px-3 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                                                    Details
                                                </button>
                                            </div>
                                        )}
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
