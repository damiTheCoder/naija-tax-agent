import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/inventory/db';

// Receive transfer: IN_TRANSIT → RECEIVED (increases to-location stock)
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

        if (transfer.status !== 'IN_TRANSIT') {
            return NextResponse.json(
                { error: `Cannot receive transfer with status: ${transfer.status}` },
                { status: 400 }
            );
        }

        // Increase stock at to-location and create movements
        for (const line of transfer.lines) {
            // Update or create inventory balance
            await prisma.inventoryBalance.upsert({
                where: {
                    productId_locationId: {
                        productId: line.productId,
                        locationId: transfer.toLocationId,
                    },
                },
                update: { onHand: { increment: line.qty } },
                create: {
                    productId: line.productId,
                    locationId: transfer.toLocationId,
                    onHand: line.qty,
                    reserved: 0,
                },
            });

            // Create stock movement
            await prisma.stockMovement.create({
                data: {
                    companyId: transfer.companyId,
                    productId: line.productId,
                    toLocationId: transfer.toLocationId,
                    type: 'TRANSFER_IN',
                    qty: line.qty,
                    unitCost: line.unitCost,
                    referenceType: 'Transfer',
                    referenceId: transfer.id,
                },
            });
        }

        const updatedTransfer = await prisma.transfer.update({
            where: { id },
            data: { status: 'RECEIVED' },
            include: {
                fromLocation: true,
                toLocation: true,
                lines: { include: { product: true } },
            },
        });

        return NextResponse.json(updatedTransfer);
    } catch (error) {
        console.error('Error receiving transfer:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
