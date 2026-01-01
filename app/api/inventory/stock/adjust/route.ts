import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/inventory/db';
import type { StockAdjustmentRequest } from '@/lib/inventory/types';

export async function POST(request: NextRequest) {
    try {
        const body: StockAdjustmentRequest = await request.json();

        // Validate required fields
        if (!body.productId || !body.locationId || body.qtyDelta === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields: productId, locationId, qtyDelta' },
                { status: 400 }
            );
        }

        // Get current inventory balance
        const balance = await prisma.inventoryBalance.findUnique({
            where: {
                productId_locationId: {
                    productId: body.productId,
                    locationId: body.locationId,
                },
            },
            include: { product: true },
        });

        if (!balance) {
            return NextResponse.json(
                { error: 'Inventory balance not found for this product/location' },
                { status: 404 }
            );
        }

        // Check if adjustment would result in negative stock
        const newOnHand = balance.onHand + body.qtyDelta;
        if (newOnHand < 0) {
            return NextResponse.json(
                { error: `Cannot reduce stock below zero. Current: ${balance.onHand}, Adjustment: ${body.qtyDelta}` },
                { status: 400 }
            );
        }

        // Update inventory balance
        const updatedBalance = await prisma.inventoryBalance.update({
            where: { id: balance.id },
            data: { onHand: newOnHand },
        });

        // Create stock movement record
        const company = await prisma.company.findFirst();
        await prisma.stockMovement.create({
            data: {
                companyId: company!.id,
                productId: body.productId,
                fromLocationId: body.qtyDelta < 0 ? body.locationId : null,
                toLocationId: body.qtyDelta > 0 ? body.locationId : null,
                type: 'ADJUSTMENT',
                qty: Math.abs(body.qtyDelta),
                unitCost: balance.product?.costPrice || 0,
                referenceType: 'Adjustment',
                notes: body.reason || null,
            },
        });

        return NextResponse.json({
            success: true,
            previousOnHand: balance.onHand,
            newOnHand: updatedBalance.onHand,
            adjustment: body.qtyDelta,
        });
    } catch (error) {
        console.error('Error adjusting stock:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
