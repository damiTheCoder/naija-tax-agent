import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/inventory/db';
import type { InventoryBalance, PaginatedResponse } from '@/lib/inventory/types';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const locationId = searchParams.get('locationId');
        const categoryId = searchParams.get('categoryId');
        const q = searchParams.get('q');
        const belowReorder = searchParams.get('belowReorder') === 'true';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const skip = (page - 1) * limit;

        // Build query filters
        const where: Record<string, unknown> = {};

        if (locationId) {
            where.locationId = locationId;
        }

        // Product filters
        const productWhere: Record<string, unknown> = { isActive: true };
        if (categoryId) {
            productWhere.categoryId = categoryId;
        }
        if (q) {
            productWhere.OR = [
                { name: { contains: q } },
                { sku: { contains: q } },
            ];
        }
        where.product = productWhere;

        // Get inventory balances
        let balances = await prisma.inventoryBalance.findMany({
            where,
            include: {
                product: { include: { category: true } },
                location: true,
            },
            orderBy: [
                { location: { name: 'asc' } },
                { product: { name: 'asc' } },
            ],
        });

        // Filter below reorder level
        if (belowReorder) {
            balances = balances.filter((b) => b.onHand < (b.product?.reorderLevel || 0));
        }

        const total = balances.length;
        const paginatedBalances = balances.slice(skip, skip + limit);

        const data: InventoryBalance[] = paginatedBalances.map((b) => ({
            id: b.id,
            productId: b.productId,
            locationId: b.locationId,
            onHand: b.onHand,
            reserved: b.reserved,
            updatedAt: b.updatedAt,
            product: b.product ? {
                id: b.product.id,
                companyId: b.product.companyId,
                categoryId: b.product.categoryId,
                sku: b.product.sku,
                name: b.product.name,
                unit: b.product.unit,
                costPrice: b.product.costPrice,
                sellingPrice: b.product.sellingPrice,
                reorderLevel: b.product.reorderLevel,
                trackExpiry: b.product.trackExpiry,
                isActive: b.product.isActive,
                createdAt: b.product.createdAt,
                updatedAt: b.product.updatedAt,
                category: b.product.category ? {
                    id: b.product.category.id,
                    companyId: b.product.category.companyId,
                    name: b.product.category.name,
                    createdAt: b.product.category.createdAt,
                } : null,
            } : undefined,
            location: b.location ? {
                id: b.location.id,
                companyId: b.location.companyId,
                type: b.location.type as 'WAREHOUSE' | 'BRANCH',
                name: b.location.name,
                address: b.location.address,
                createdAt: b.location.createdAt,
            } : undefined,
        }));

        const response: PaginatedResponse<InventoryBalance> = {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching inventory:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
