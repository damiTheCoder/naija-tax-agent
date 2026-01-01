import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/inventory/db';
import type { ReceivePurchaseOrderRequest } from '@/lib/inventory/types';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body: ReceivePurchaseOrderRequest = await request.json();

        // Get the PO
        const po = await prisma.purchaseOrder.findUnique({
            where: { id },
            include: { lines: true },
        });

        if (!po) {
            return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
        }

        if (po.status === 'CANCELLED' || po.status === 'RECEIVED') {
            return NextResponse.json(
                { error: `Cannot receive PO with status: ${po.status}` },
                { status: 400 }
            );
        }

        if (!body.lines?.length) {
            return NextResponse.json({ error: 'No lines to receive' }, { status: 400 });
        }

        // Process each line
        for (const receiveLine of body.lines) {
            const poLine = po.lines.find((l) => l.id === receiveLine.lineId);
            if (!poLine) continue;

            const qtyToReceive = Math.min(
                receiveLine.qtyReceived,
                poLine.qtyOrdered - poLine.qtyReceived
            );

            if (qtyToReceive <= 0) continue;

            // Update PO line
            await prisma.purchaseOrderLine.update({
                where: { id: poLine.id },
                data: { qtyReceived: poLine.qtyReceived + qtyToReceive },
            });

            // Update inventory balance
            await prisma.inventoryBalance.upsert({
                where: {
                    productId_locationId: {
                        productId: poLine.productId,
                        locationId: po.locationId,
                    },
                },
                update: { onHand: { increment: qtyToReceive } },
                create: {
                    productId: poLine.productId,
                    locationId: po.locationId,
                    onHand: qtyToReceive,
                    reserved: 0,
                },
            });

            // Create stock movement
            await prisma.stockMovement.create({
                data: {
                    companyId: po.companyId,
                    productId: poLine.productId,
                    toLocationId: po.locationId,
                    type: 'PURCHASE_RECEIPT',
                    qty: qtyToReceive,
                    unitCost: poLine.unitCost,
                    referenceType: 'PurchaseOrder',
                    referenceId: po.id,
                },
            });
        }

        // Update PO status
        const updatedLines = await prisma.purchaseOrderLine.findMany({
            where: { purchaseOrderId: id },
        });

        const totalOrdered = updatedLines.reduce((sum, l) => sum + l.qtyOrdered, 0);
        const totalReceived = updatedLines.reduce((sum, l) => sum + l.qtyReceived, 0);

        let newStatus = po.status;
        if (totalReceived === 0) {
            newStatus = 'PENDING';
        } else if (totalReceived < totalOrdered) {
            newStatus = 'PARTIALLY_RECEIVED';
        } else {
            newStatus = 'RECEIVED';
        }

        const updatedPO = await prisma.purchaseOrder.update({
            where: { id },
            data: { status: newStatus },
            include: {
                supplier: true,
                location: true,
                lines: { include: { product: true } },
            },
        });

        return NextResponse.json(updatedPO);
    } catch (error) {
        console.error('Error receiving purchase order:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
