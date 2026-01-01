'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRightLeft, Plus, Truck, Package, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import type { Transfer, PaginatedResponse } from '@/lib/inventory/types';

export default function TransfersPage() {
    const [transfers, setTransfers] = useState<Transfer[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');

    useEffect(() => {
        fetchTransfers();
    }, [statusFilter]);

    async function fetchTransfers() {
        setLoading(true);
        try {
            let url = `/api/inventory/transfers?limit=50`;
            if (statusFilter) url += `&status=${statusFilter}`;

            const res = await fetch(url);
            const data: PaginatedResponse<Transfer> = await res.json();
            setTransfers(data.data);
        } catch (error) {
            console.error('Error fetching transfers:', error);
        } finally {
            setLoading(false);
        }
    }

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'CREATED': return {
                icon: <Package className="w-4 h-4" />,
                bgClass: 'bg-gray-100 dark:bg-gray-700',
                textClass: 'text-gray-900',
                label: 'Ready'
            };
            case 'IN_TRANSIT': return {
                icon: <Truck className="w-4 h-4" />,
                bgClass: 'bg-blue-100 dark:bg-blue-900/50',
                textClass: 'text-blue-600 dark:text-blue-400',
                label: 'In Transit'
            };
            case 'RECEIVED': return {
                icon: <CheckCircle2 className="w-4 h-4" />,
                bgClass: 'bg-green-100 dark:bg-green-900/50',
                textClass: 'text-green-600 dark:text-green-400',
                label: 'Complete'
            };
            case 'CANCELLED': return {
                icon: <XCircle className="w-4 h-4" />,
                bgClass: 'bg-red-100 dark:bg-red-900/50',
                textClass: 'text-red-600 dark:text-red-400',
                label: 'Cancelled'
            };
            default: return {
                icon: <Package className="w-4 h-4" />,
                bgClass: 'bg-gray-100',
                textClass: 'text-gray-600',
                label: status
            };
        }
    };

    const statusTabs = [
        { value: '', label: 'All' },
        { value: 'CREATED', label: 'Ready' },
        { value: 'IN_TRANSIT', label: 'In Transit' },
        { value: 'RECEIVED', label: 'Complete' },
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
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock Transfers</h1>
                        <p className="text-xs text-gray-600">Move inventory between locations</p>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors">
                        <Plus className="w-4 h-4" />
                        New Transfer
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

                {/* Transfers List */}
                <div className="rounded-2xl bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/50 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                                <ArrowRightLeft className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Transfers</h3>
                                <p className="text-xs text-gray-600">{transfers.length} transfers</p>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="animate-pulse text-gray-600">Loading transfers...</div>
                        </div>
                    ) : transfers.length === 0 ? (
                        <div className="p-8 text-center">
                            <ArrowRightLeft className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-600">No transfers found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700/50">
                            {transfers.map((transfer) => {
                                const statusConfig = getStatusConfig(transfer.status);

                                return (
                                    <div key={transfer.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-3">
                                                <div className={`w-10 h-10 rounded-xl ${statusConfig.bgClass} flex items-center justify-center ${statusConfig.textClass}`}>
                                                    {statusConfig.icon}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                                                            #{transfer.id.slice(0, 8)}
                                                        </span>
                                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.bgClass} ${statusConfig.textClass}`}>
                                                            {statusConfig.label}
                                                        </span>
                                                    </div>

                                                    {/* From → To */}
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="font-medium text-gray-900 dark:text-white">
                                                            {transfer.fromLocation?.name}
                                                        </span>
                                                        <ArrowRight className="w-4 h-4 text-gray-400" />
                                                        <span className="font-medium text-gray-900 dark:text-white">
                                                            {transfer.toLocation?.name}
                                                        </span>
                                                    </div>

                                                    <p className="text-xs text-gray-600 mt-1">
                                                        {transfer.lines?.length || 0} items • {new Date(transfer.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {(transfer.status === 'CREATED' || transfer.status === 'IN_TRANSIT') && (
                                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50 flex gap-2">
                                                {transfer.status === 'CREATED' && (
                                                    <button className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors flex items-center justify-center gap-2">
                                                        <Truck className="w-4 h-4" />
                                                        Ship Transfer
                                                    </button>
                                                )}
                                                {transfer.status === 'IN_TRANSIT' && (
                                                    <button className="flex-1 px-3 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors flex items-center justify-center gap-2">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        Receive Transfer
                                                    </button>
                                                )}
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
