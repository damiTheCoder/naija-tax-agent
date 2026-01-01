import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/inventory/db';
import type { PurchaseOrder, PaginatedResponse, CreatePurchaseOrderRequest } from '@/lib/inventory/types';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const locationId = searchParams.get('locationId');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const skip = (page - 1) * limit;

        // Build query filters
        const where: Record<string, unknown> = {};
        if (status) where.status = status;
        if (locationId) where.locationId = locationId;

        const [orders, total] = await Promise.all([
            prisma.purchaseOrder.findMany({
                where,
                include: {
                    supplier: true,
                    location: true,
                    lines: { include: { product: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.purchaseOrder.count({ where }),
        ]);

        const data: PurchaseOrder[] = orders.map((po) => ({
            id: po.id,
            companyId: po.companyId,
            supplierId: po.supplierId,
            locationId: po.locationId,
            status: po.status as PurchaseOrder['status'],
            notes: po.notes,
            createdAt: po.createdAt,
            updatedAt: po.updatedAt,
            supplier: po.supplier ? {
                id: po.supplier.id,
                companyId: po.supplier.companyId,
                name: po.supplier.name,
                phone: po.supplier.phone,
                email: po.supplier.email,
                address: po.supplier.address,
                createdAt: po.supplier.createdAt,
            } : undefined,
            location: po.location ? {
                id: po.location.id,
                companyId: po.location.companyId,
                type: po.location.type as 'WAREHOUSE' | 'BRANCH',
                name: po.location.name,
                address: po.location.address,
                createdAt: po.location.createdAt,
            } : undefined,
            lines: po.lines.map((line) => ({
                id: line.id,
                purchaseOrderId: line.purchaseOrderId,
                productId: line.productId,
                qtyOrdered: line.qtyOrdered,
                qtyReceived: line.qtyReceived,
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

        const response: PaginatedResponse<PurchaseOrder> = {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching purchase orders:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body: CreatePurchaseOrderRequest = await request.json();

        if (!body.supplierId || !body.locationId || !body.lines?.length) {
            return NextResponse.json(
                { error: 'Missing required fields: supplierId, locationId, lines' },
                { status: 400 }
            );
        }

        const company = await prisma.company.findFirst();
        if (!company) {
            return NextResponse.json({ error: 'No company found' }, { status: 500 });
        }

        const po = await prisma.purchaseOrder.create({
            data: {
                companyId: company.id,
                supplierId: body.supplierId,
                locationId: body.locationId,
                status: 'DRAFT',
                notes: body.notes || null,
                lines: {
                    create: body.lines.map((line) => ({
                        productId: line.productId,
                        qtyOrdered: line.qtyOrdered,
                        qtyReceived: 0,
                        unitCost: line.unitCost,
                    })),
                },
            },
            include: {
                supplier: true,
                location: true,
                lines: { include: { product: true } },
            },
        });

        return NextResponse.json(po, { status: 201 });
    } catch (error) {
        console.error('Error creating purchase order:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
