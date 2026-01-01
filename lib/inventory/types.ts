// ============================================================================
// INVENTORY INTELLIGENCE - TypeScript Types
// ============================================================================

// Location types
export type LocationType = 'WAREHOUSE' | 'BRANCH';

// User roles
export type UserRole = 'OWNER' | 'MANAGER' | 'STAFF';

// Stock movement types
export type StockMovementType =
    | 'PURCHASE_RECEIPT'
    | 'SALE'
    | 'ADJUSTMENT'
    | 'TRANSFER_OUT'
    | 'TRANSFER_IN';

// Purchase Order status
export type POStatus =
    | 'DRAFT'
    | 'PENDING'
    | 'PARTIALLY_RECEIVED'
    | 'RECEIVED'
    | 'CANCELLED';

// Transfer status
export type TransferStatus =
    | 'CREATED'
    | 'IN_TRANSIT'
    | 'RECEIVED'
    | 'CANCELLED';

// ============================================================================
// Base Entities
// ============================================================================

export interface Company {
    id: string;
    name: string;
    createdAt: Date;
}

export interface Location {
    id: string;
    companyId: string;
    type: LocationType;
    name: string;
    address?: string | null;
    createdAt: Date;
}

export interface User {
    id: string;
    companyId: string;
    locationId?: string | null;
    email: string;
    name: string;
    role: UserRole;
    createdAt: Date;
    location?: Location | null;
}

export interface Supplier {
    id: string;
    companyId: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    createdAt: Date;
}

export interface Category {
    id: string;
    companyId: string;
    name: string;
    createdAt: Date;
}

export interface Product {
    id: string;
    companyId: string;
    categoryId?: string | null;
    sku: string;
    name: string;
    unit: string;
    costPrice: number;
    sellingPrice: number;
    reorderLevel: number;
    trackExpiry: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    category?: Category | null;
}

export interface InventoryBalance {
    id: string;
    productId: string;
    locationId: string;
    onHand: number;
    reserved: number;
    updatedAt: Date;
    product?: Product;
    location?: Location;
}

export interface StockMovement {
    id: string;
    companyId: string;
    productId: string;
    fromLocationId?: string | null;
    toLocationId?: string | null;
    type: StockMovementType;
    qty: number;
    unitCost: number;
    referenceType?: string | null;
    referenceId?: string | null;
    notes?: string | null;
    createdAt: Date;
    product?: Product;
    fromLocation?: Location | null;
    toLocation?: Location | null;
}

// ============================================================================
// Purchase Orders
// ============================================================================

export interface PurchaseOrderLine {
    id: string;
    purchaseOrderId: string;
    productId: string;
    qtyOrdered: number;
    qtyReceived: number;
    unitCost: number;
    product?: Product;
}

export interface PurchaseOrder {
    id: string;
    companyId: string;
    supplierId: string;
    locationId: string;
    status: POStatus;
    notes?: string | null;
    createdAt: Date;
    updatedAt: Date;
    supplier?: Supplier;
    location?: Location;
    lines?: PurchaseOrderLine[];
}

// ============================================================================
// Transfers
// ============================================================================

export interface TransferLine {
    id: string;
    transferId: string;
    productId: string;
    qty: number;
    unitCost: number;
    product?: Product;
}

export interface Transfer {
    id: string;
    companyId: string;
    fromLocationId: string;
    toLocationId: string;
    status: TransferStatus;
    notes?: string | null;
    createdAt: Date;
    updatedAt: Date;
    fromLocation?: Location;
    toLocation?: Location;
    lines?: TransferLine[];
}

// ============================================================================
// Sales
// ============================================================================

export interface SaleLine {
    id: string;
    saleId: string;
    productId?: string | null;
    menuItemId?: string | null;
    qty: number;
    unitPrice: number;
    unitCost: number;
    product?: Product | null;
}

export interface Sale {
    id: string;
    companyId: string;
    locationId: string;
    totalAmount: number;
    createdAt: Date;
    location?: Location;
    lines?: SaleLine[];
}

// ============================================================================
// Restaurant Mode
// ============================================================================

export interface BomLine {
    id: string;
    menuItemId: string;
    productId: string;
    qtyPerUnit: number;
    product?: Product;
}

export interface MenuItem {
    id: string;
    companyId: string;
    name: string;
    sellingPrice: number;
    isActive: boolean;
    createdAt: Date;
    bomLines?: BomLine[];
}

// ============================================================================
// API Request/Response Types
// ============================================================================

// Pagination
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// Product requests
export interface CreateProductRequest {
    sku: string;
    name: string;
    categoryId?: string;
    unit?: string;
    costPrice: number;
    sellingPrice: number;
    reorderLevel?: number;
    trackExpiry?: boolean;
}

// Stock adjustment
export interface StockAdjustmentRequest {
    productId: string;
    locationId: string;
    qtyDelta: number;
    reason?: string;
}

// Purchase Order requests
export interface CreatePOLineRequest {
    productId: string;
    qtyOrdered: number;
    unitCost: number;
}

export interface CreatePurchaseOrderRequest {
    supplierId: string;
    locationId: string;
    notes?: string;
    lines: CreatePOLineRequest[];
}

export interface ReceivePOLineRequest {
    lineId: string;
    qtyReceived: number;
}

export interface ReceivePurchaseOrderRequest {
    lines: ReceivePOLineRequest[];
}

// Transfer requests
export interface CreateTransferLineRequest {
    productId: string;
    qty: number;
}

export interface CreateTransferRequest {
    fromLocationId: string;
    toLocationId: string;
    notes?: string;
    lines: CreateTransferLineRequest[];
}

// Sale requests
export interface CreateSaleLineRequest {
    productId?: string;
    menuItemId?: string;
    qty: number;
    unitPrice: number;
}

export interface CreateSaleRequest {
    locationId: string;
    lines: CreateSaleLineRequest[];
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface InventorySummary {
    totalProducts: number;
    totalStockValue: number;
    lowStockCount: number;
    pendingPOCount: number;
    inTransitTransferCount: number;
}

export interface TopSellerItem {
    productId: string;
    productName: string;
    sku: string;
    qtySold: number;
    revenue: number;
}

export interface TopProfitItem {
    productId: string;
    productName: string;
    sku: string;
    profit: number;
    qtySold: number;
}

export interface SlowMoverItem {
    productId: string;
    productName: string;
    sku: string;
    onHand: number;
    lastSaleDate: Date | null;
    daysSinceLastSale: number;
    cashTied: number;
}

export interface RestockSuggestion {
    productId: string;
    productName: string;
    sku: string;
    locationId: string;
    locationName: string;
    onHand: number;
    reorderLevel: number;
    dailyVelocity: number;
    daysOfCover: number;
    suggestedQty: number;
    urgency: 'critical' | 'soon' | 'normal';
    message: string;
}

export interface DeadStockItem {
    productId: string;
    productName: string;
    sku: string;
    locationId: string;
    locationName: string;
    onHand: number;
    cashTied: number;
    velocity: number;
    recommendation: string;
}

// Chart data
export interface SalesVsStockDataPoint {
    date: string;
    sales: number;
    stock: number;
}

export interface TurnoverDataPoint {
    date: string;
    turnoverRatio: number;
}

export interface StockoutDataPoint {
    date: string;
    stockoutCount: number;
}

export interface CashTiedByCategory {
    categoryId: string;
    categoryName: string;
    cashTied: number;
    percentage: number;
}
