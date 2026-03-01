/**
 * =============================================================================
 * BANKING MODULE — PUBLIC API
 * =============================================================================
 *
 * Re-exports the complete banking transaction pipeline.
 *
 * Usage:
 *   import {
 *     processTransaction,
 *     processTransactions,
 *     classifyBankTransaction,
 *     parseCSVStatement,
 *   } from "@/lib/banking";
 */

// Types
export type {
    InboundBankTransaction,
    ClassificationResult,
    TransactionNature,
    PipelineResult,
    BatchPipelineResult,
    PipelineOptions,
    WebhookEvent,
    WebhookEventType,
} from "./types";

// Pipeline (primary entry points)
export {
    processTransaction,
    processTransactions,
    parseCSVStatement,
} from "./transactionPipeline";

// Classifier (for advanced / direct use)
export {
    classifyBankTransaction,
    classifyBankTransactions,
} from "./aiClassifier";

// Router (for advanced / direct use)
export { routeTransaction } from "./crossModuleRouter";
