/**
 * =============================================================================
 * BANK CONNECTION TRANSACTIONS API
 * =============================================================================
 * 
 * GET /api/bank-connections/[id]/transactions - Get imported transactions
 * 
 * Query Parameters:
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - accountId: Filter by specific account
 * - type: "credit" | "debit" | "all"
 * - category: Filter by category
 * - isReconciled: true | false
 * - page: Page number (default 1)
 * - limit: Items per page (default 50)
 * - search: Search in description
 * 
 * =============================================================================
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: connectionId } = await params;
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const filters = {
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      accountId: searchParams.get("accountId"),
      type: searchParams.get("type") as "credit" | "debit" | "all" | null,
      category: searchParams.get("category"),
      isReconciled: searchParams.get("isReconciled") === "true" ? true : 
                    searchParams.get("isReconciled") === "false" ? false : null,
      search: searchParams.get("search"),
    };
    
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // TODO: Verify user owns this connection
    // const user = await getAuthenticatedUser(request);
    // const connection = await db.bankConnections.findFirst({
    //   where: { id: connectionId, userId: user.id }
    // });
    // if (!connection) throw new Error("Connection not found");

    // TODO: Build query with filters
    // const where: any = { connectionId };
    // if (filters.startDate) where.date = { gte: new Date(filters.startDate) };
    // if (filters.endDate) where.date = { ...where.date, lte: new Date(filters.endDate) };
    // if (filters.accountId) where.accountId = filters.accountId;
    // if (filters.type && filters.type !== 'all') where.type = filters.type;
    // if (filters.category) where.category = filters.category;
    // if (filters.isReconciled !== null) where.isReconciled = filters.isReconciled;
    // if (filters.search) {
    //   where.OR = [
    //     { description: { contains: filters.search, mode: 'insensitive' } },
    //     { narration: { contains: filters.search, mode: 'insensitive' } }
    //   ];
    // }

    // TODO: Fetch from database with pagination
    // const [transactions, total] = await Promise.all([
    //   db.bankTransactions.findMany({
    //     where,
    //     orderBy: { date: 'desc' },
    //     skip: (page - 1) * limit,
    //     take: limit
    //   }),
    //   db.bankTransactions.count({ where })
    // ]);

    // Mock response
    const mockTransactions = generateMockTransactions(connectionId, 20);
    const total = 156;

    return NextResponse.json({
      success: true,
      data: {
        transactions: mockTransactions.slice((page - 1) * limit, page * limit),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Failed to get transactions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get transactions" },
      { status: 500 }
    );
  }
}

// =============================================================================
// HELPER: Generate mock transactions for development
// =============================================================================

function generateMockTransactions(connectionId: string, count: number) {
  const categories = [
    "sales", "inventory", "payroll", "rent", "utilities", 
    "subscription", "equipment", "marketing", "travel", "other"
  ];
  
  const descriptions = [
    "POS Payment - Customer",
    "Transfer from client",
    "Payroll batch payment",
    "Office rent - December",
    "AWS monthly subscription",
    "Inventory purchase - Vendor",
    "Utility payment - NEPA",
    "Staff salary - November",
    "Equipment purchase",
    "Marketing campaign - Meta",
  ];

  const transactions = [];
  const baseDate = Date.now();

  for (let i = 0; i < count; i++) {
    const isCredit = Math.random() > 0.4;
    const amount = Math.floor(Math.random() * 500000) + 10000;
    
    transactions.push({
      id: `txn_${baseDate}_${i}`,
      connectionId,
      accountId: "acc_001",
      date: new Date(baseDate - i * 86400000 * Math.random() * 3).toISOString(),
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
      narration: `REF: ${Math.random().toString(36).substring(7).toUpperCase()}`,
      amount: isCredit ? amount : -amount,
      balance: 15750000 - i * 50000,
      type: isCredit ? "credit" : "debit",
      reference: `BNK${Date.now()}${i}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      classificationConfidence: Math.random() * 0.3 + 0.7,
      isReconciled: Math.random() > 0.7,
      importedAt: new Date(baseDate - 100000).toISOString(),
    });
  }

  return transactions.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
