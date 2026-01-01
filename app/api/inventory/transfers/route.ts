import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/inventory/db';
import type { Transfer, PaginatedResponse, CreateTransferRequest } from '@/lib/inventory/types';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = {};
        if (status) where.status = status;

        const [transfers, total] = await Promise.all([
            prisma.transfer.findMany({
                where,
                include: {
                    fromLocation: true,
                    toLocation: true,
                    lines: { include: { product: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.transfer.count({ where }),
        ]);

        const data: Transfer[] = transfers.map((t) => ({
            id: t.id,
            companyId: t.companyId,
            fromLocationId: t.fromLocationId,
            toLocationId: t.toLocationId,
            status: t.status as Transfer['status'],
            notes: t.notes,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
            fromLocation: t.fromLocation ? {
                id: t.fromLocation.id,
                companyId: t.fromLocation.companyId,
                type: t.fromLocation.type as 'WAREHOUSE' | 'BRANCH',
                name: t.fromLocation.name,
                address: t.fromLocation.address,
                createdAt: t.fromLocation.createdAt,
            } : undefined,
            toLocation: t.toLocation ? {
                id: t.toLocation.id,
                companyId: t.toLocation.companyId,
                type: t.toLocation.type as 'WAREHOUSE' | 'BRANCH',
                name: t.toLocation.name,
                address: t.toLocation.address,
                createdAt: t.toLocation.createdAt,
            } : undefined,
            lines: t.lines.map((line) => ({
                id: line.id,
                transferId: line.transferId,
                productId: line.productId,
                qty: line.qty,
                unitCost: line.unitCost,
                product: line.product ? {
                    id: line.product.id,
                    companyId: line.product.companyId,
                    categoryId: line.product.categoryId,
                    sku: line.product.sku,
                    name: line.product.name,
                    unit: line.product.unit,
                    costPrice: line.product.costPrice,
                    sellingPrice: line.product.sellingPrice,
                    reorderLevel: line.product.reorderLevel,
                    trackExpiry: line.product.trackExpiry,
                    isActive: line.product.isActive,
                    createdAt: line.product.createdAt,
                    updatedAt: line.product.updatedAt,
                } : undefined,
            })),
        }));

        const response: PaginatedResponse<Transfer> = {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching transfers:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body: CreateTransferRequest = await request.json();

        if (!body.fromLocationId || !body.toLocationId || !body.lines?.length) {
            return NextResponse.json(
                { error: 'Missing required fields: fromLocationId, toLocationId, lines' },
                { status: 400 }
            );
        }

        if (body.fromLocationId === body.toLocationId) {
            return NextResponse.json(
                { error: 'Cannot transfer to the same location' },
                { status: 400 }
            );
        }

        const company = await prisma.company.findFirst();
        if (!company) {
            return NextResponse.json({ error: 'No company found' }, { status: 500 });
        }

        // Validate stock availability
        for (const line of body.lines) {
            const balance = await prisma.inventoryBalance.findUnique({
                where: {
                    productId_locationId: {
                        productId: line.productId,
                        locationId: body.fromLocationId,
                    },
                },
            });

            if (!balance || balance.onHand < line.qty) {
                return NextResponse.json(
                    { error: `Insufficient stock for product ${line.productId}. Available: ${balance?.onHand || 0}, Requested: ${line.qty}` },
                    { status: 400 }
                );
            }
        }

        const transfer = await prisma.transfer.create({
            data: {
                companyId: company.id,
                fromLocationId: body.fromLocationId,
                toLocationId: body.toLocationId,
                status: 'CREATED',
                notes: body.notes || null,
                lines: {
                    create: body.lines.map((line) => ({
                        productId: line.productId,
                        qty: line.qty,
                        unitCost: 0,
                    })),
                },
            },
            include: {
                fromLocation: true,
                toLocation: true,
                lines: { include: { product: true } },
            },
        });

        return NextResponse.json(transfer, { status: 201 });
    } catch (error) {
        console.error('Error creating transfer:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
