import { NextResponse } from 'next/server';
import prisma from '@/lib/inventory/db';
import type { User } from '@/lib/inventory/types';

// Mock authenticated user - in production, this would come from session/JWT
export async function GET() {
    try {
        // Get the owner user from the database
        const user = await prisma.user.findFirst({
            where: { role: 'OWNER' },
            include: { location: true },
        });

        if (!user) {
            return NextResponse.json(
                { error: 'No user found' },
                { status: 404 }
            );
        }

        const response: User = {
            id: user.id,
            companyId: user.companyId,
            locationId: user.locationId,
            email: user.email,
            name: user.name,
            role: user.role as User['role'],
            createdAt: user.createdAt,
            location: user.location ? {
                id: user.location.id,
                companyId: user.location.companyId,
                type: user.location.type as 'WAREHOUSE' | 'BRANCH',
                name: user.location.name,
                address: user.location.address,
                createdAt: user.location.createdAt,
            } : null,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching user:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
