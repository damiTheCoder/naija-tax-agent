import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/inventory/db';
import type {
    InventorySummary,
    TopSellerItem,
    TopProfitItem,
    SlowMoverItem,
    RestockSuggestion
} from '@/lib/inventory/types';

// Helper to parse date range
function getDateRange(from?: string | null, to?: string | null) {
    const now = new Date();
    const fromDate = from ? new Date(from) : new Date(now.setDate(now.getDate() - 30));
    const toDate = to ? new Date(to) : new Date();
    return { fromDate, toDate };
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'summary';
        const locationId = searchParams.get('locationId');
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const days = parseInt(searchParams.get('days') || '30');
        const limit = parseInt(searchParams.get('limit') || '10');

        const { fromDate, toDate } = getDateRange(from, to);

        switch (type) {
            case 'summary':
                return NextResponse.json(await getSummary(locationId));
            case 'top-sellers':
                return NextResponse.json(await getTopSellers(locationId, fromDate, toDate, limit));
            case 'top-profit':
                return NextResponse.json(await getTopProfit(locationId, fromDate, toDate, limit));
            case 'slow-movers':
                return NextResponse.json(await getSlowMovers(locationId, days));
            case 'restock':
                return NextResponse.json(await getRestockSuggestions(locationId));
            default:
                return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }
    } catch (error) {
        console.error('Error fetching analytics:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

async function getSummary(locationId?: string | null): Promise<InventorySummary> {
    const balanceWhere = locationId ? { locationId } : {};

    const [balances, lowStock, pendingPOs, inTransit] = await Promise.all([
        prisma.inventoryBalance.findMany({
            where: balanceWhere,
            include: { product: true },
        }),
        prisma.inventoryBalance.findMany({
            where: {
                ...balanceWhere,
                product: { isActive: true },
            },
            include: { product: true },
        }),
        prisma.purchaseOrder.count({ where: { status: 'PENDING' } }),
        prisma.transfer.count({ where: { status: 'IN_TRANSIT' } }),
    ]);

    const totalProducts = new Set(balances.map(b => b.productId)).size;
    const totalStockValue = balances.reduce(
        (sum, b) => sum + b.onHand * (b.product?.costPrice || 0),
        0
    );
    const lowStockCount = lowStock.filter(
        b => b.onHand < (b.product?.reorderLevel || 0)
    ).length;

    return {
        totalProducts,
        totalStockValue,
        lowStockCount,
        pendingPOCount: pendingPOs,
        inTransitTransferCount: inTransit,
    };
}

async function getTopSellers(
    locationId: string | null,
    fromDate: Date,
    toDate: Date,
    limit: number
): Promise<TopSellerItem[]> {
    const saleWhere: Record<string, unknown> = {
        createdAt: { gte: fromDate, lte: toDate },
    };
    if (locationId) saleWhere.locationId = locationId;

    const sales = await prisma.sale.findMany({
        where: saleWhere,
        include: {
            lines: { include: { product: true } },
        },
    });

    // Aggregate by product
    const productSales = new Map<string, { name: string; sku: string; qty: number; revenue: number }>();

    for (const sale of sales) {
        for (const line of sale.lines) {
            if (!line.productId || !line.product) continue;
            const existing = productSales.get(line.productId) || {
                name: line.product.name,
                sku: line.product.sku,
                qty: 0,
                revenue: 0,
            };
            existing.qty += line.qty;
            existing.revenue += line.qty * line.unitPrice;
            productSales.set(line.productId, existing);
        }
    }

    return Array.from(productSales.entries())
        .map(([productId, data]) => ({
            productId,
            productName: data.name,
            sku: data.sku,
            qtySold: data.qty,
            revenue: data.revenue,
        }))
        .sort((a, b) => b.qtySold - a.qtySold)
        .slice(0, limit);
}

async function getTopProfit(
    locationId: string | null,
    fromDate: Date,
    toDate: Date,
    limit: number
): Promise<TopProfitItem[]> {
    const saleWhere: Record<string, unknown> = {
        createdAt: { gte: fromDate, lte: toDate },
    };
    if (locationId) saleWhere.locationId = locationId;

    const sales = await prisma.sale.findMany({
        where: saleWhere,
        include: {
            lines: { include: { product: true } },
        },
    });

    const productProfit = new Map<string, { name: string; sku: string; profit: number; qty: number }>();

    for (const sale of sales) {
        for (const line of sale.lines) {
            if (!line.productId || !line.product) continue;
            const existing = productProfit.get(line.productId) || {
                name: line.product.name,
                sku: line.product.sku,
                profit: 0,
                qty: 0,
            };
            existing.profit += line.qty * (line.unitPrice - line.unitCost);
            existing.qty += line.qty;
            productProfit.set(line.productId, existing);
        }
    }

    return Array.from(productProfit.entries())
        .map(([productId, data]) => ({
            productId,
            productName: data.name,
            sku: data.sku,
            profit: data.profit,
            qtySold: data.qty,
        }))
        .sort((a, b) => b.profit - a.profit)
        .slice(0, limit);
}

async function getSlowMovers(locationId: string | null, days: number): Promise<SlowMoverItem[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const balanceWhere = locationId ? { locationId } : {};

    const balances = await prisma.inventoryBalance.findMany({
        where: { ...balanceWhere, product: { isActive: true } },
        include: { product: true, location: true },
    });

    const result: SlowMoverItem[] = [];

    for (const balance of balances) {
        if (!balance.product || balance.onHand === 0) continue;

        // Check last sale
        const lastSale = await prisma.saleLine.findFirst({
            where: {
                productId: balance.productId,
                sale: locationId ? { locationId } : undefined,
            },
            orderBy: { sale: { createdAt: 'desc' } },
            include: { sale: true },
        });

        const lastSaleDate = lastSale?.sale?.createdAt || null;
        const daysSinceLastSale = lastSaleDate
            ? Math.floor((Date.now() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24))
            : 999;

        if (daysSinceLastSale >= days) {
            result.push({
                productId: balance.productId,
                productName: balance.product.name,
                sku: balance.product.sku,
                onHand: balance.onHand,
                lastSaleDate,
                daysSinceLastSale,
                cashTied: balance.onHand * balance.product.costPrice,
            });
        }
    }

    return result.sort((a, b) => b.cashTied - a.cashTied);
}

async function getRestockSuggestions(locationId: string | null): Promise<RestockSuggestion[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const balanceWhere = locationId ? { locationId } : {};

    const balances = await prisma.inventoryBalance.findMany({
        where: { ...balanceWhere, product: { isActive: true } },
        include: { product: true, location: true },
    });

    const result: RestockSuggestion[] = [];

    for (const balance of balances) {
        if (!balance.product || !balance.location) continue;

        // Calculate sales velocity (last 30 days)
        const salesLines = await prisma.saleLine.findMany({
            where: {
                productId: balance.productId,
                sale: {
                    locationId: balance.locationId,
                    createdAt: { gte: thirtyDaysAgo },
                },
            },
        });

        const qtySold30Days = salesLines.reduce((sum, l) => sum + l.qty, 0);
        const dailyVelocity = qtySold30Days / 30;
        const daysOfCover = dailyVelocity > 0 ? balance.onHand / dailyVelocity : 999;

        // Only suggest if below reorder or low days of cover
        if (balance.onHand < balance.product.reorderLevel || daysOfCover < 14) {
            let urgency: 'critical' | 'soon' | 'normal' = 'normal';
            let message = '';

            if (daysOfCover < 3 || balance.onHand === 0) {
                urgency = 'critical';
                message = balance.onHand === 0
                    ? 'Out of stock! Reorder immediately.'
                    : `Only ${Math.round(daysOfCover)} days of stock left. Reorder now.`;
            } else if (daysOfCover < 7) {
                urgency = 'soon';
                message = `${Math.round(daysOfCover)} days of stock remaining. Order soon.`;
            } else {
                message = `Stock below reorder level. ${Math.round(daysOfCover)} days remaining.`;
            }

            // Suggest quantity (14 days of stock + buffer)
            const suggestedQty = Math.max(
                balance.product.reorderLevel - balance.onHand,
                Math.ceil(dailyVelocity * 14)
            );

            result.push({
                productId: balance.productId,
                productName: balance.product.name,
                sku: balance.product.sku,
                locationId: balance.locationId,
                locationName: balance.location.name,
                onHand: balance.onHand,
                reorderLevel: balance.product.reorderLevel,
                dailyVelocity: Math.round(dailyVelocity * 100) / 100,
                daysOfCover: Math.round(daysOfCover),
                suggestedQty,
                urgency,
                message,
            });
        }
    }

    return result.sort((a, b) => {
        const urgencyOrder = { critical: 0, soon: 1, normal: 2 };
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });
}
