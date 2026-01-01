import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/inventory/db';
import type { Location } from '@/lib/inventory/types';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const q = searchParams.get('q');

        // Build query filters
        const where: Record<string, unknown> = {};

        if (type) {
            where.type = type;
        }

        if (q) {
            where.name = { contains: q };
        }

        const locations = await prisma.location.findMany({
            where,
            orderBy: [
                { type: 'asc' }, // WAREHOUSE first
                { name: 'asc' },
            ],
        });

        const response: Location[] = locations.map((loc) => ({
            id: loc.id,
            companyId: loc.companyId,
            type: loc.type as Location['type'],
            name: loc.name,
            address: loc.address,
            createdAt: loc.createdAt,
        }));

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching locations:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
