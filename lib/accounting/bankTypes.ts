/**
 * =============================================================================
 * BANK CONNECTION TYPES & API SERVICE INTERFACE
 * =============================================================================
 * 
 * This file contains all types and interfaces needed for bank integration.
 * Backend developers can use this as a reference for implementing the API.
 * 
 * API Endpoints to Implement:
 * 
 * GET    /api/bank-connections           - List all bank connections
 * POST   /api/bank-connections           - Create new bank connection
 * GET    /api/bank-connections/:id       - Get single connection details
 * DELETE /api/bank-connections/:id       - Disconnect/remove bank
 * POST   /api/bank-connections/:id/sync  - Trigger manual sync
 * GET    /api/bank-connections/:id/sync-history - Get sync history
 * PATCH  /api/bank-connections/:id/settings - Update sync settings
 * GET    /api/bank-connections/:id/transactions - Get imported transactions
 * 
 * OAuth Callback:
 * GET    /api/bank-connections/callback  - Handle OAuth redirect from bank
 * 
 * Statement Upload:
 * POST   /api/bank-connections/upload    - Upload bank statement PDF/CSV
 * 
 * =============================================================================
 */

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Bank connection status
 */
export type BankConnectionStatus = 
  | "connected"     // Active and syncing
  | "pending"       // Awaiting OAuth completion or verification
  | "error"         // Sync failed, needs attention
  | "disconnected"  // Manually disconnected
  | "expired";      // OAuth token expired, needs re-auth

/**
 * Type of bank account
 */
export type BankAccountType = 
  | "current"       // Current/checking account
  | "savings"       // Savings account
  | "domiciliary"   // Foreign currency account
  | "corporate"     // Business/corporate account
  | "merchant";     // Merchant settlement account

/**
 * Supported currencies
 */
export type SupportedCurrency = "NGN" | "USD" | "GBP" | "EUR";

/**
 * How often to sync transactions
 */
export type SyncFrequency = 
  | "realtime"      // Webhook-based, as transactions occur
  | "hourly"        // Every hour
  | "daily"         // Once daily at midnight
  | "manual";       // Only when user triggers

/**
 * Connection method
 */
export type ConnectionType = 
  | "open_banking"      // Via Open Banking API (recommended)
  | "statement_upload"  // Manual statement upload
  | "api_direct"        // Direct API integration
  | "coming_soon";      // Not yet supported

// =============================================================================
// MAIN ENTITIES
// =============================================================================

/**
 * Bank account linked to a connection
 */
export interface BankAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  accountType: BankAccountType;
  currency: SupportedCurrency;
  balance?: number;
  availableBalance?: number;
  lastSynced?: string; // ISO date string
  isDefault: boolean;
  metadata?: Record<string, unknown>; // Additional bank-specific data
}

/**
 * Bank connection - represents a linked bank
 */
export interface BankConnection {
  id: string;
  userId: string;          // Owner of this connection
  companyId?: string;      // Optional company/organization
  
  // Bank info
  bankCode: string;        // Internal bank code (e.g., "zenith")
  bankName: string;        // Display name
  bankLogo?: string;       // URL to bank logo
  
  // Connection status
  status: BankConnectionStatus;
  errorMessage?: string;   // Error details if status is "error"
  
  // Linked accounts
  accounts: BankAccount[];
  
  // Timestamps
  connectedAt: string;     // ISO date string
  lastSyncAt?: string;     // ISO date string
  nextSyncAt?: string;     // ISO date string (scheduled)
  
  // Settings
  syncFrequency: SyncFrequency;
  autoClassify: boolean;   // Auto-classify imported transactions
  defaultAccountId?: string; // Default account for imports
  
  // Stats
  transactionCount: number;
  
  // OAuth tokens (should be encrypted in DB)
  metadata?: {
    consentId?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: string;
    scope?: string[];
  };
}

/**
 * Supported bank provider
 */
export interface BankProvider {
  code: string;
  name: string;
  shortName: string;
  logo?: string;
  color: string;          // Brand color for UI
  supported: boolean;
  connectionType: ConnectionType;
  features: string[];
  
  // OAuth config (for backend)
  oauth?: {
    authUrl: string;
    tokenUrl: string;
    clientId: string;
    scopes: string[];
  };
}

/**
 * Sync history entry
 */
export interface SyncHistoryEntry {
  id: string;
  connectionId: string;
  
  // Timing
  startedAt: string;       // ISO date string
  completedAt?: string;    // ISO date string
  
  // Result
  status: "success" | "partial" | "failed" | "in_progress";
  
  // Stats
  transactionsImported: number;
  transactionsSkipped: number;
  duplicatesFound: number;
  
  // Error info
  errorDetails?: string;
  failedAccounts?: string[];
}

/**
 * Imported bank transaction
 */
export interface BankTransaction {
  id: string;
  connectionId: string;
  accountId: string;
  
  // Transaction data
  date: string;            // ISO date string
  description: string;
  narration?: string;      // Additional description from bank
  amount: number;          // Positive for credit, negative for debit
  balance?: number;        // Running balance after transaction
  type: "credit" | "debit";
  
  // Reference
  reference?: string;      // Bank reference number
  transactionRef?: string; // Our internal reference
  
  // Classification
  category?: string;       // AI-assigned or user-assigned category
  classificationConfidence?: number; // 0-1
  isReconciled: boolean;   // Matched with book entry
  reconciledWith?: string; // ID of matched journal entry
  
  // Timestamps
  importedAt: string;
  
  // Raw data
  rawData?: Record<string, unknown>;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Request to create new bank connection
 */
export interface CreateConnectionRequest {
  bankCode: string;
  redirectUrl?: string;    // Where to redirect after OAuth
  credentials?: {          // For non-OAuth banks
    username?: string;
    password?: string;
    accountNumber?: string;
  };
}

/**
 * Response from creating connection
 */
export interface CreateConnectionResponse {
  connection?: BankConnection;
  redirectUrl?: string;    // OAuth URL to redirect user to
  requiresVerification?: boolean;
  verificationMethod?: "otp" | "email" | "security_question";
}

/**
 * OAuth callback parameters
 */
export interface OAuthCallbackParams {
  code: string;           // Authorization code
  state: string;          // State parameter for CSRF protection
  error?: string;
  error_description?: string;
}

/**
 * Request to update connection settings
 */
export interface UpdateConnectionSettingsRequest {
  syncFrequency?: SyncFrequency;
  defaultAccountId?: string;
  autoClassify?: boolean;
}

/**
 * Transaction list filters
 */
export interface TransactionFilters {
  startDate?: string;     // ISO date string
  endDate?: string;       // ISO date string
  accountId?: string;
  type?: "credit" | "debit" | "all";
  category?: string;
  isReconciled?: boolean;
  minAmount?: number;
  maxAmount?: number;
  search?: string;        // Search in description/narration
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Statement upload request
 */
export interface StatementUploadRequest {
  bankCode: string;
  accountNumber?: string;
  file: File;             // PDF or CSV file
  fileType: "pdf" | "csv";
  dateFormat?: string;    // e.g., "DD/MM/YYYY"
  password?: string;      // If PDF is password-protected
}

/**
 * Statement upload response
 */
export interface StatementUploadResponse {
  connectionId: string;
  transactionsFound: number;
  transactionsImported: number;
  duplicatesSkipped: number;
  dateRange: {
    start: string;
    end: string;
  };
  errors?: Array<{
    row: number;
    message: string;
  }>;
}

// =============================================================================
// API SERVICE INTERFACE
// =============================================================================

/**
 * Bank Connection Service
 * 
 * Backend developers should implement this interface.
 * All methods should include proper authentication and error handling.
 */
export interface BankConnectionService {
  // -------------------------------------------------------------------------
  // Connection Management
  // -------------------------------------------------------------------------
  
  /**
   * List all bank connections for the current user/company
   * GET /api/bank-connections
   */
  listConnections(): Promise<BankConnection[]>;
  
  /**
   * Get a single connection by ID
   * GET /api/bank-connections/:id
   */
  getConnection(connectionId: string): Promise<BankConnection>;
  
  /**
   * Initiate a new bank connection
   * POST /api/bank-connections
   * 
   * For OAuth banks: Returns redirectUrl for user to authorize
   * For statement upload banks: Creates pending connection
   */
  createConnection(request: CreateConnectionRequest): Promise<CreateConnectionResponse>;
  
  /**
   * Handle OAuth callback after user authorizes
   * GET /api/bank-connections/callback
   */
  handleOAuthCallback(params: OAuthCallbackParams): Promise<BankConnection>;
  
  /**
   * Disconnect and remove a bank connection
   * DELETE /api/bank-connections/:id
   */
  disconnectBank(connectionId: string): Promise<void>;
  
  // -------------------------------------------------------------------------
  // Sync Operations
  // -------------------------------------------------------------------------
  
  /**
   * Trigger manual sync for a connection
   * POST /api/bank-connections/:id/sync
   */
  syncConnection(connectionId: string): Promise<SyncHistoryEntry>;
  
  /**
   * Get sync history for a connection
   * GET /api/bank-connections/:id/sync-history
   */
  getSyncHistory(connectionId: string, limit?: number): Promise<SyncHistoryEntry[]>;
  
  // -------------------------------------------------------------------------
  // Transaction Management
  // -------------------------------------------------------------------------
  
  /**
   * Get imported transactions for a connection
   * GET /api/bank-connections/:id/transactions
   */
  getTransactions(
    connectionId: string, 
    filters?: TransactionFilters,
    page?: number,
    limit?: number
  ): Promise<PaginatedResponse<BankTransaction>>;
  
  /**
   * Classify/categorize a transaction
   * PATCH /api/bank-connections/:connectionId/transactions/:transactionId
   */
  classifyTransaction(
    connectionId: string,
    transactionId: string,
    category: string
  ): Promise<BankTransaction>;
  
  /**
   * Reconcile transaction with journal entry
   * POST /api/bank-connections/:connectionId/transactions/:transactionId/reconcile
   */
  reconcileTransaction(
    connectionId: string,
    transactionId: string,
    journalEntryId: string
  ): Promise<BankTransaction>;
  
  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------
  
  /**
   * Update connection settings
   * PATCH /api/bank-connections/:id/settings
   */
  updateSettings(
    connectionId: string, 
    settings: UpdateConnectionSettingsRequest
  ): Promise<BankConnection>;
  
  // -------------------------------------------------------------------------
  // Statement Upload
  // -------------------------------------------------------------------------
  
  /**
   * Upload bank statement file
   * POST /api/bank-connections/upload
   */
  uploadStatement(request: StatementUploadRequest): Promise<StatementUploadResponse>;
  
  // -------------------------------------------------------------------------
  // Bank Providers
  // -------------------------------------------------------------------------
  
  /**
   * Get list of supported bank providers
   * GET /api/bank-providers
   */
  listBankProviders(): Promise<BankProvider[]>;
}

// =============================================================================
// WEBHOOK TYPES (for real-time sync)
// =============================================================================

/**
 * Webhook event types
 */
export type WebhookEventType = 
  | "transaction.created"
  | "transaction.updated"
  | "balance.updated"
  | "connection.status_changed"
  | "consent.expired";

/**
 * Webhook payload
 */
export interface WebhookPayload {
  id: string;
  type: WebhookEventType;
  timestamp: string;
  data: {
    connectionId: string;
    accountId?: string;
    transaction?: BankTransaction;
    balance?: number;
    status?: BankConnectionStatus;
  };
  signature: string;       // HMAC signature for verification
}

// =============================================================================
// NIGERIAN BANK CODES
// =============================================================================

export const NIGERIAN_BANK_CODES = {
  zenith: "057",
  gtbank: "058",
  access: "044",
  firstbank: "011",
  uba: "033",
  stanbic: "221",
  fcmb: "214",
  fidelity: "070",
  ecobank: "050",
  sterling: "232",
  wema: "035",
  polaris: "076",
  union: "032",
  keystone: "082",
  providus: "101",
  jaiz: "301",
  taj: "302",
  kuda: "090267",
  opay: "100004",
  moniepoint: "50515",
} as const;

export type NigerianBankCode = keyof typeof NIGERIAN_BANK_CODES;
