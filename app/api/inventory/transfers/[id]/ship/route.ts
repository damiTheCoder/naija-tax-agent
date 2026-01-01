import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/inventory/db';

// Ship transfer: CREATED → IN_TRANSIT (decreases from-location stock)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const transfer = await prisma.transfer.findUnique({
            where: { id },
            include: { lines: { include: { product: true } } },
        });

        if (!transfer) {
            return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
        }

        if (transfer.status !== 'CREATED') {
            return NextResponse.json(
                { error: `Cannot ship transfer with status: ${transfer.status}` },
                { status: 400 }
            );
        }

        // Decrease stock at from-location and create movements
        for (const line of transfer.lines) {
            // Update inventory balance
            await prisma.inventoryBalance.update({
                where: {
                    productId_locationId: {
                        productId: line.productId,
                        locationId: transfer.fromLocationId,
                    },
                },
                data: { onHand: { decrement: line.qty } },
            });

            // Create stock movement
            await prisma.stockMovement.create({
                data: {
                    companyId: transfer.companyId,
                    productId: line.productId,
                    fromLocationId: transfer.fromLocationId,
                    type: 'TRANSFER_OUT',
                    qty: line.qty,
                    unitCost: line.product?.costPrice || 0,
                    referenceType: 'Transfer',
                    referenceId: transfer.id,
                },
            });

            // Update line with unit cost
            await prisma.transferLine.update({
                where: { id: line.id },
                data: { unitCost: line.product?.costPrice || 0 },
            });
        }

        const updatedTransfer = await prisma.transfer.update({
            where: { id },
            data: { status: 'IN_TRANSIT' },
            include: {
                fromLocation: true,
                toLocation: true,
                lines: { include: { product: true } },
            },
        });

        return NextResponse.json(updatedTransfer);
    } catch (error) {
        console.error('Error shipping transfer:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
