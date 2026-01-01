# Inventory Intelligence Backend Documentation

This document describes the backend architecture for the **Inventory Intelligence** module — a multi-branch inventory management system for supermarkets and restaurants.

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [Business Rules](#business-rules)
5. [API Endpoints](#api-endpoints)
6. [Role-Based Access](#role-based-access)
7. [Development Setup](#development-setup)
8. [Testing](#testing)

---

## Overview

Inventory Intelligence is a standalone module within the CashOS application that provides:

- **Multi-location inventory tracking** (warehouse + branches)
- **Purchase Order management** with receiving workflow
- **Stock transfers** between locations
- **Sales tracking** with automatic inventory deduction
- **Analytics** (top sellers, slow movers, restock suggestions)
- **Restaurant mode** (optional) with Bill of Materials (BOM) for menu items

### Key Principle

> **Inventory increases ONLY when stock is received, not when a Purchase Order is created.**

---

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| ORM | Prisma | 5.x |
| Database | SQLite (dev) / PostgreSQL (prod) | - |
| Framework | Next.js API Routes | 16.x |
| Validation | Zod | 4.x |
| State | Zustand | 5.x |

### File Structure

```
prisma/
├── schema.prisma      # Database schema
├── seed.ts            # Sample data seed script
├── dev.db             # SQLite database (generated)
└── migrations/        # Migration history

lib/inventory/
├── db.ts              # Prisma client singleton
├── types.ts           # TypeScript types (to be created)
├── analytics.ts       # Business logic for insights (to be created)
└── hooks.ts           # React hooks for data fetching (to be created)

app/api/inventory/
├── me/route.ts        # GET current user (mock auth)
├── locations/route.ts # GET locations
├── products/route.ts  # GET/POST products
├── stock/route.ts     # GET inventory balances
├── stock/adjust/route.ts  # POST stock adjustments
├── purchase-orders/route.ts  # GET/POST purchase orders
├── purchase-orders/[id]/receive/route.ts  # POST receive stock
├── transfers/route.ts # GET/POST transfers
├── transfers/[id]/ship/route.ts   # POST ship transfer
├── transfers/[id]/receive/route.ts # POST receive transfer
├── sales/route.ts     # POST sales
└── analytics/route.ts # GET analytics data
```

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Company   │───────│   Location  │───────│    User     │
└─────────────┘       └─────────────┘       └─────────────┘
       │                     │
       │                     │
       ▼                     ▼
┌─────────────┐       ┌─────────────────────┐
│  Category   │       │  InventoryBalance   │
└─────────────┘       └─────────────────────┘
       │                     ▲
       │                     │
       ▼                     │
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Product   │───────│StockMovement│       │   Supplier  │
└─────────────┘       └─────────────┘       └─────────────┘
       │                                           │
       │                                           │
       ▼                                           ▼
┌─────────────────┐                    ┌─────────────────┐
│ PurchaseOrder   │◄───────────────────│PurchaseOrderLine│
└─────────────────┘                    └─────────────────┘
       
┌─────────────┐       ┌─────────────┐
│  Transfer   │───────│TransferLine │
└─────────────┘       └─────────────┘

┌─────────────┐       ┌─────────────┐
│    Sale     │───────│  SaleLine   │
└─────────────┘       └─────────────┘

┌─────────────┐       ┌─────────────┐
│  MenuItem   │───────│   BomLine   │ (Restaurant Mode)
└─────────────┘       └─────────────┘
```

### Tables Summary

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `Company` | Tenant/organization | `id`, `name` |
| `Location` | Warehouse or branch | `type` (WAREHOUSE/BRANCH), `companyId` |
| `User` | System users | `role` (OWNER/MANAGER/STAFF), `locationId` |
| `Supplier` | Vendors | `name`, `phone`, `email` |
| `Category` | Product categories | `name` |
| `Product` | Inventory items | `sku`, `costPrice`, `sellingPrice`, `reorderLevel` |
| `InventoryBalance` | Stock levels per location | `productId`, `locationId`, `onHand`, `reserved` |
| `StockMovement` | Audit trail for all stock changes | `type`, `qty`, `referenceType`, `referenceId` |
| `PurchaseOrder` | Orders to suppliers | `status`, `supplierId`, `locationId` |
| `PurchaseOrderLine` | PO line items | `qtyOrdered`, `qtyReceived` |
| `Transfer` | Stock transfers between locations | `fromLocationId`, `toLocationId`, `status` |
| `TransferLine` | Transfer line items | `qty` |
| `Sale` | Sales transactions | `locationId`, `totalAmount` |
| `SaleLine` | Sale line items | `productId`, `qty`, `unitPrice` |
| `MenuItem` | Restaurant menu items | `name`, `sellingPrice` |
| `BomLine` | Ingredients per menu item | `menuItemId`, `productId`, `qtyPerUnit` |

---

## Business Rules

### 1. Purchase Order Flow

```
┌────────┐     ┌─────────┐     ┌──────────────────┐     ┌──────────┐
│ DRAFT  │────▶│ PENDING │────▶│ PARTIALLY_RECEIVED│────▶│ RECEIVED │
└────────┘     └─────────┘     └──────────────────┘     └──────────┘
     │              │                                         │
     │              │                                         │
     ▼              ▼                                         │
┌────────────────────────────────────────────────────────────┐
│                      CANCELLED                              │
└────────────────────────────────────────────────────────────┘
```

| Status | Description | Inventory Impact |
|--------|-------------|------------------|
| `DRAFT` | PO created, not yet sent to supplier | None |
| `PENDING` | PO submitted, awaiting delivery | None |
| `PARTIALLY_RECEIVED` | Some items received | **Increases** by received qty |
| `RECEIVED` | All items received | **Increases** by received qty |
| `CANCELLED` | PO cancelled | None |

**Key Rule**: Stock is added to `InventoryBalance` and a `StockMovement` (type: `PURCHASE_RECEIPT`) is created **only** when the `/receive` endpoint is called.

### 2. Transfer Flow

```
┌─────────┐     ┌───────────┐     ┌──────────┐
│ CREATED │────▶│ IN_TRANSIT│────▶│ RECEIVED │
└─────────┘     └───────────┘     └──────────┘
     │                                  │
     ▼                                  │
┌────────────────────────────────────────┐
│              CANCELLED                 │
└────────────────────────────────────────┘
```

| Status | From Location | To Location |
|--------|---------------|-------------|
| `CREATED` | No change | No change |
| `IN_TRANSIT` | **Decreases** (TRANSFER_OUT) | No change yet |
| `RECEIVED` | Already decreased | **Increases** (TRANSFER_IN) |
| `CANCELLED` | Reversed if shipped | No change |

### 3. Sales Flow

When a sale is recorded:
1. Create `Sale` and `SaleLine` records
2. For each line:
   - Decrease `InventoryBalance.onHand` at the sale location
   - Create `StockMovement` (type: `SALE`)
3. If restaurant mode and line has `menuItemId`:
   - Look up `BomLine` for that menu item
   - Decrease inventory for each ingredient (product)

### 4. Stock Adjustments

Used for:
- Damage/shrinkage
- Physical count corrections
- Returns

Creates a `StockMovement` (type: `ADJUSTMENT`) with positive or negative `qty`.

---

## API Endpoints

### Authentication (Mock)

```
GET /api/inventory/me
```

Returns current user (hardcoded for MVP). Response:

```json
{
  "id": "user_123",
  "name": "John Owner",
  "email": "owner@freshmart.com",
  "role": "OWNER",
  "companyId": "company_abc",
  "locationId": null
}
```

### Locations

```
GET /api/inventory/locations?type=BRANCH&q=search
```

Query params:
- `type` (optional): `WAREHOUSE` or `BRANCH`
- `q` (optional): Search by name

### Products

```
GET /api/inventory/products?categoryId=xxx&q=search&page=1&limit=20
POST /api/inventory/products
```

POST body:
```json
{
  "sku": "BEV006",
  "name": "New Product",
  "categoryId": "cat_123",
  "unit": "bottle",
  "costPrice": 100,
  "sellingPrice": 150,
  "reorderLevel": 50,
  "trackExpiry": false
}
```

### Inventory

```
GET /api/inventory/stock?locationId=xxx&categoryId=xxx&belowReorder=true&q=search&page=1
```

Returns inventory balances with product details. `belowReorder=true` filters to products where `onHand < reorderLevel`.

```
POST /api/inventory/stock/adjust
```

Body:
```json
{
  "productId": "prod_123",
  "locationId": "loc_456",
  "qtyDelta": -5,
  "reason": "Damaged in transit"
}
```

### Purchase Orders

```
GET /api/inventory/purchase-orders?status=PENDING&locationId=xxx&page=1
POST /api/inventory/purchase-orders
```

POST body:
```json
{
  "supplierId": "sup_123",
  "locationId": "loc_456",
  "lines": [
    { "productId": "prod_1", "qtyOrdered": 100, "unitCost": 150 },
    { "productId": "prod_2", "qtyOrdered": 50, "unitCost": 200 }
  ]
}
```

```
POST /api/inventory/purchase-orders/:id/submit  // DRAFT → PENDING
POST /api/inventory/purchase-orders/:id/receive
```

Receive body:
```json
{
  "lines": [
    { "lineId": "pol_1", "qtyReceived": 100 },
    { "lineId": "pol_2", "qtyReceived": 40 }
  ]
}
```

### Transfers

```
GET /api/inventory/transfers?status=IN_TRANSIT&page=1
POST /api/inventory/transfers
```

POST body:
```json
{
  "fromLocationId": "loc_warehouse",
  "toLocationId": "loc_branch1",
  "lines": [
    { "productId": "prod_1", "qty": 50 }
  ]
}
```

```
POST /api/inventory/transfers/:id/ship    // CREATED → IN_TRANSIT
POST /api/inventory/transfers/:id/receive // IN_TRANSIT → RECEIVED
```

### Sales

```
POST /api/inventory/sales
```

Body:
```json
{
  "locationId": "loc_branch1",
  "lines": [
    { "productId": "prod_1", "qty": 2, "unitPrice": 200 },
    { "productId": "prod_2", "qty": 1, "unitPrice": 500 }
  ]
}
```

### Analytics

```
GET /api/inventory/analytics/summary?locationId=xxx&from=2024-01-01&to=2024-12-31
GET /api/inventory/analytics/top-sellers?locationId=xxx&from=xxx&to=xxx&limit=10
GET /api/inventory/analytics/top-profit?locationId=xxx&from=xxx&to=xxx&limit=10
GET /api/inventory/analytics/slow-movers?days=30&locationId=xxx
GET /api/inventory/analytics/restock-suggestions?locationId=xxx
```

#### Restock Suggestion Logic

```typescript
// Calculate daily velocity
const qtySoldLast30Days = sum of sales in last 30 days
const dailyVelocity = qtySoldLast30Days / 30

// Calculate days of cover
const daysOfCover = onHand / Math.max(dailyVelocity, 0.01)

// Suggest restock if running low
if (daysOfCover < 7) {
  // "Restock soon - only X days of stock left"
}
```

#### Dead Stock Logic

```typescript
const cashTied = onHand * costPrice
const velocity = qtySoldLast30Days / 30

if (cashTied > 50000 && velocity < 0.5) {
  // "Dead stock risk - ₦X tied up with low sales"
}
```

---

## Role-Based Access

| Role | Locations | Capabilities |
|------|-----------|--------------|
| `OWNER` | All | Full access: view all, create POs, approve transfers, see analytics |
| `MANAGER` | Assigned branch | View own branch, receive stock, create transfer requests |
| `STAFF` | Assigned branch | Record sales, view stock levels |

### Implementation

```typescript
// Middleware pattern for API routes
function checkRole(requiredRoles: string[]) {
  return (user: User) => {
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
  };
}

// Location filtering
function filterByLocation(user: User, query: Query) {
  if (user.role !== 'OWNER' && user.locationId) {
    query.locationId = user.locationId;
  }
  return query;
}
```

---

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
cd naija-tax-agent

# Install dependencies (already done)
npm install

# Run database migration
npx prisma migrate dev

# Seed sample data
npm run db:seed

# View database in Prisma Studio
npm run db:studio

# Start dev server
npm run dev
```

### Environment Variables (for production)

```env
DATABASE_URL="postgresql://user:pass@host:5432/inventory?schema=public"
```

### Useful Commands

```bash
# Reset database (delete all data + recreate)
npx prisma migrate reset

# Generate Prisma client after schema changes
npm run db:generate

# Open database GUI
npm run db:studio
```

---

## Testing

### Manual Testing with Prisma Studio

```bash
npm run db:studio
```

Opens a web UI at `http://localhost:5555` where you can:
- View all tables
- Add/edit/delete records
- Verify relationships

### Sample Data (from seed)

| Entity | Count |
|--------|-------|
| Company | 1 (FreshMart Supermarkets) |
| Locations | 4 (1 warehouse + 3 branches) |
| Products | 24 |
| Inventory Balances | 96 (24 products × 4 locations) |
| Purchase Orders | 3 (different statuses) |
| Transfers | 2 |
| Sales | ~450 (30 days × 3 branches × 5 avg/day) |

---

## Next Steps

Once this documentation is approved, the following will be implemented:

1. **API Routes** - All endpoints listed above
2. **TypeScript Types** - Shared types for frontend/backend
3. **Navigation** - Add "Inventory" mode to app
4. **Frontend Pages** - Dashboard, Products, Stock, POs, Transfers, Insights, Charts
5. **Zustand Store** - Global state for location filter, user role
6. **React Hooks** - Data fetching with SWR or React Query pattern
