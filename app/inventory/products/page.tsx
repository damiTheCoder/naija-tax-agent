'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Package, Search, Plus, Filter } from 'lucide-react';
import type { Product, PaginatedResponse, Category } from '@/lib/inventory/types';

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        fetchProducts();
    }, [page, categoryFilter]);

    useEffect(() => {
        fetchCategories();
    }, []);

    async function fetchCategories() {
        try {
            const res = await fetch('/api/inventory/products?limit=100');
            const data: PaginatedResponse<Product> = await res.json();
            const uniqueCategories = new Map<string, Category>();
            data.data.forEach(p => {
                if (p.category) {
                    uniqueCategories.set(p.category.id, p.category);
                }
            });
            setCategories(Array.from(uniqueCategories.values()));
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    }

    async function fetchProducts() {
        setLoading(true);
        try {
            let url = `/api/inventory/products?page=${page}&limit=20`;
            if (categoryFilter) url += `&categoryId=${categoryFilter}`;
            if (search) url += `&q=${encodeURIComponent(search)}`;

            const res = await fetch(url);
            const data: PaginatedResponse<Product> = await res.json();
            setProducts(data.data);
            setTotalPages(data.totalPages);
            setTotal(data.total);
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchProducts();
    };

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
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Products</h1>
                        <p className="text-xs text-gray-600">{total} products in catalog</p>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors">
                        <Plus className="w-4 h-4" />
                        Add Product
                    </button>
                </div>

                {/* Search and Filter */}
                <div className="rounded-2xl bg-white p-4">
                    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by name or SKU..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <select
                                    value={categoryFilter}
                                    onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                                    className="pl-10 pr-8 py-2.5 rounded-xl bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                                >
                                    <option value="">All Categories</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <button type="submit" className="px-4 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                                Search
                            </button>
                        </div>
                    </form>
                </div>

                {/* Products List */}
                <div className="rounded-2xl bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/50 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                                <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Product Catalog</h3>
                                <p className="text-xs text-gray-600">Showing {products.length} of {total}</p>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="animate-pulse text-gray-600">Loading products...</div>
                        </div>
                    ) : products.length === 0 ? (
                        <div className="p-8 text-center">
                            <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-600">No products found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700/50">
                            {products.map((product) => {
                                const margin = product.sellingPrice > 0
                                    ? ((product.sellingPrice - product.costPrice) / product.sellingPrice * 100)
                                    : 0;
                                return (
                                    <div key={product.id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{product.sku}</span>
                                                    {product.category && (
                                                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700 text-gray-900">
                                                            {product.category.name}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{product.name}</p>
                                                <p className="text-xs text-gray-600">Per {product.unit}</p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(product.sellingPrice)}</p>
                                                <p className="text-xs text-gray-600">Cost: {formatCurrency(product.costPrice)}</p>
                                                <span className={`text-xs font-medium ${margin >= 20 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                                    {margin.toFixed(1)}% margin
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700/50 bg-white }} flex items-center justify-between">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 text-sm rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1.5 text-sm rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
