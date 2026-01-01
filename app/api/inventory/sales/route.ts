import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/inventory/db';
import type { CreateSaleRequest } from '@/lib/inventory/types';

export async function POST(request: NextRequest) {
    try {
        const body: CreateSaleRequest = await request.json();

        if (!body.locationId || !body.lines?.length) {
            return NextResponse.json(
                { error: 'Missing required fields: locationId, lines' },
                { status: 400 }
            );
        }

        const company = await prisma.company.findFirst();
        if (!company) {
            return NextResponse.json({ error: 'No company found' }, { status: 500 });
        }

        // Validate stock availability and calculate costs
        const processedLines: Array<{
            productId: string;
            qty: number;
            unitPrice: number;
            unitCost: number;
        }> = [];

        for (const line of body.lines) {
            if (!line.productId) continue;

            const balance = await prisma.inventoryBalance.findUnique({
                where: {
                    productId_locationId: {
                        productId: line.productId,
                        locationId: body.locationId,
                    },
                },
                include: { product: true },
            });

            if (!balance || balance.onHand < line.qty) {
                return NextResponse.json(
                    { error: `Insufficient stock for product ${line.productId}. Available: ${balance?.onHand || 0}, Requested: ${line.qty}` },
                    { status: 400 }
                );
            }

            processedLines.push({
                productId: line.productId,
                qty: line.qty,
                unitPrice: line.unitPrice,
                unitCost: balance.product?.costPrice || 0,
            });
        }

        // Calculate total
        const totalAmount = processedLines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);

        // Create sale
        const sale = await prisma.sale.create({
            data: {
                companyId: company.id,
                locationId: body.locationId,
                totalAmount,
                lines: {
                    create: processedLines.map((l) => ({
                        productId: l.productId,
                        qty: l.qty,
                        unitPrice: l.unitPrice,
                        unitCost: l.unitCost,
                    })),
                },
            },
            include: {
                location: true,
                lines: { include: { product: true } },
            },
        });

        // Decrease stock and create movements
        for (const line of processedLines) {
            await prisma.inventoryBalance.update({
                where: {
                    productId_locationId: {
                        productId: line.productId,
                        locationId: body.locationId,
                    },
                },
                data: { onHand: { decrement: line.qty } },
            });

            await prisma.stockMovement.create({
                data: {
                    companyId: company.id,
                    productId: line.productId,
                    fromLocationId: body.locationId,
                    type: 'SALE',
                    qty: line.qty,
                    unitCost: line.unitCost,
                    referenceType: 'Sale',
                    referenceId: sale.id,
                },
            });
        }

        return NextResponse.json(sale, { status: 201 });
    } catch (error) {
        console.error('Error creating sale:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
