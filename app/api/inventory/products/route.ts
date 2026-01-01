import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/inventory/db';
import type { Product, PaginatedResponse, CreateProductRequest } from '@/lib/inventory/types';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const categoryId = searchParams.get('categoryId');
        const q = searchParams.get('q');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const skip = (page - 1) * limit;

        // Build query filters
        const where: Record<string, unknown> = { isActive: true };

        if (categoryId) {
            where.categoryId = categoryId;
        }

        if (q) {
            where.OR = [
                { name: { contains: q } },
                { sku: { contains: q } },
            ];
        }

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                include: { category: true },
                orderBy: { name: 'asc' },
                skip,
                take: limit,
            }),
            prisma.product.count({ where }),
        ]);

        const data: Product[] = products.map((p) => ({
            id: p.id,
            companyId: p.companyId,
            categoryId: p.categoryId,
            sku: p.sku,
            name: p.name,
            unit: p.unit,
            costPrice: p.costPrice,
            sellingPrice: p.sellingPrice,
            reorderLevel: p.reorderLevel,
            trackExpiry: p.trackExpiry,
            isActive: p.isActive,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            category: p.category ? {
                id: p.category.id,
                companyId: p.category.companyId,
                name: p.category.name,
                createdAt: p.category.createdAt,
            } : null,
        }));

        const response: PaginatedResponse<Product> = {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching products:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body: CreateProductRequest = await request.json();

        // Validate required fields
        if (!body.sku || !body.name || body.costPrice === undefined || body.sellingPrice === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields: sku, name, costPrice, sellingPrice' },
                { status: 400 }
            );
        }

        // Check for duplicate SKU
        const existing = await prisma.product.findUnique({
            where: { sku: body.sku },
        });

        if (existing) {
            return NextResponse.json(
                { error: `Product with SKU ${body.sku} already exists` },
                { status: 409 }
            );
        }

        // Get company ID from first company (in production, from auth)
        const company = await prisma.company.findFirst();
        if (!company) {
            return NextResponse.json(
                { error: 'No company found' },
                { status: 500 }
            );
        }

        const product = await prisma.product.create({
            data: {
                companyId: company.id,
                sku: body.sku,
                name: body.name,
                categoryId: body.categoryId || null,
                unit: body.unit || 'pcs',
                costPrice: body.costPrice,
                sellingPrice: body.sellingPrice,
                reorderLevel: body.reorderLevel || 10,
                trackExpiry: body.trackExpiry || false,
            },
            include: { category: true },
        });

        // Create initial inventory balance at all locations (zero stock)
        const locations = await prisma.location.findMany({
            where: { companyId: company.id },
        });

        await prisma.inventoryBalance.createMany({
            data: locations.map((loc) => ({
                productId: product.id,
                locationId: loc.id,
                onHand: 0,
                reserved: 0,
            })),
        });

        return NextResponse.json(product, { status: 201 });
    } catch (error) {
        console.error('Error creating product:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
