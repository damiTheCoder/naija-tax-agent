/**
 * AI Classification API Route
 * Handles dual rule-based + AI transaction classification
 */

import { NextRequest, NextResponse } from "next/server";
import {
  classifyTransaction,
  classifyTransactions,
  analyzeTransaction,
  AIClassificationResult,
  AIConfig
} from "@/lib/accounting/aiEngine";
import {
  generateStatementDraft,
  generateStatementDraftWithAI,
  analyzeForCompliance
} from "@/lib/accounting/statementEngine";
import { RawTransaction, StatementDraft } from "@/lib/accounting/types";
import { runComplianceChecks } from "@/lib/accounting/standards";

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

interface ClassifyRequest {
  action: "classify" | "classify-batch" | "analyze" | "generate-statement" | "compliance-check";
  transaction?: RawTransaction;
  transactions?: RawTransaction[];
  statement?: StatementDraft;
  complianceData?: Record<string, unknown>;
  useAI?: boolean;
  aiConfig?: Partial<AIConfig>;
}

interface ClassifyResponse {
  success: boolean;
  data?: {
    classification?: AIClassificationResult;
    classifications?: Record<string, AIClassificationResult>;
    analysis?: Awaited<ReturnType<typeof analyzeTransaction>>;
    statement?: StatementDraft;
    complianceResults?: ReturnType<typeof runComplianceChecks>;
    statementAnalysis?: Awaited<ReturnType<typeof analyzeForCompliance>>;
  };
  error?: string;
  meta?: {
    processingTime: number;
    source: "rule" | "ai" | "hybrid";
    confidence?: number;
  };
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<ClassifyResponse>> {
  const startTime = Date.now();

  try {
    const body: ClassifyRequest = await request.json();

    // Get AI config from request or environment
    const aiConfig: Partial<AIConfig> = {
      useAI: body.useAI ?? true,
      apiEndpoint: body.aiConfig?.apiEndpoint || process.env.AI_API_ENDPOINT,
      apiKey: body.aiConfig?.apiKey || process.env.AI_API_KEY,
      model: body.aiConfig?.model || process.env.AI_MODEL || "gpt-4",
      confidenceThreshold: body.aiConfig?.confidenceThreshold || 0.75,
      aiTimeout: 10000,
    };

    switch (body.action) {
      // Single transaction classification
      case "classify": {
        if (!body.transaction) {
          return NextResponse.json({
            success: false,
            error: "Transaction is required for classify action",
          }, { status: 400 });
        }

        const classification = await classifyTransaction(body.transaction, aiConfig);

        return NextResponse.json({
          success: true,
          data: { classification },
          meta: {
            processingTime: Date.now() - startTime,
            source: classification.source,
            confidence: classification.confidence,
          },
        });
      }

      // Batch transaction classification
      case "classify-batch": {
        if (!body.transactions || body.transactions.length === 0) {
          return NextResponse.json({
            success: false,
            error: "Transactions array is required for classify-batch action",
          }, { status: 400 });
        }

        const classificationsMap = await classifyTransactions(body.transactions, aiConfig);
        const classifications: Record<string, AIClassificationResult> = {};
        classificationsMap.forEach((value, key) => {
          classifications[key] = value;
        });

        // Calculate average confidence
        const values = Object.values(classifications);
        const avgConfidence = values.reduce((sum, c) => sum + c.confidence, 0) / values.length;
        const sources = new Set(values.map(c => c.source));
        const overallSource = sources.size > 1 ? "hybrid" : values[0]?.source || "rule";

        return NextResponse.json({
          success: true,
          data: { classifications },
          meta: {
            processingTime: Date.now() - startTime,
            source: overallSource as "rule" | "ai" | "hybrid",
            confidence: avgConfidence,
          },
        });
      }

      // Full transaction analysis
      case "analyze": {
        if (!body.transaction) {
          return NextResponse.json({
            success: false,
            error: "Transaction is required for analyze action",
          }, { status: 400 });
        }

        const analysis = await analyzeTransaction(
          body.transaction,
          aiConfig,
          body.complianceData
        );

        return NextResponse.json({
          success: true,
          data: { analysis },
          meta: {
            processingTime: Date.now() - startTime,
            source: analysis.classification.source,
            confidence: analysis.classification.confidence,
          },
        });
      }

      // Generate financial statement
      case "generate-statement": {
        if (!body.transactions || body.transactions.length === 0) {
          return NextResponse.json({
            success: false,
            error: "Transactions array is required for generate-statement action",
          }, { status: 400 });
        }

        if (body.useAI !== false && aiConfig.useAI) {
          const result = await generateStatementDraftWithAI(body.transactions, aiConfig);
          const classifications: Record<string, AIClassificationResult> = {};
          result.classifications.forEach((value, key) => {
            classifications[key] = value;
          });

          return NextResponse.json({
            success: true,
            data: {
              statement: result.statement,
              classifications,
            },
            meta: {
              processingTime: Date.now() - startTime,
              source: result.statement.analysisSource as "rule" | "ai" | "hybrid",
              confidence: result.statement.analysisConfidence,
            },
          });
        } else {
          const statement = generateStatementDraft(body.transactions, { includeLineItems: true });

          return NextResponse.json({
            success: true,
            data: { statement },
            meta: {
              processingTime: Date.now() - startTime,
              source: "rule",
              confidence: 0.7,
            },
          });
        }
      }

      // Compliance check
      case "compliance-check": {
        if (body.statement) {
          const statementAnalysis = await analyzeForCompliance(body.statement, aiConfig);

          return NextResponse.json({
            success: true,
            data: { statementAnalysis },
            meta: {
              processingTime: Date.now() - startTime,
              source: "rule",
            },
          });
        } else if (body.complianceData) {
          const complianceResults = runComplianceChecks(body.complianceData);

          return NextResponse.json({
            success: true,
            data: { complianceResults },
            meta: {
              processingTime: Date.now() - startTime,
              source: "rule",
            },
          });
        } else {
          return NextResponse.json({
            success: false,
            error: "Either statement or complianceData is required for compliance-check action",
          }, { status: 400 });
        }
      }

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${body.action}. Valid actions are: classify, classify-batch, analyze, generate-statement, compliance-check`,
        }, { status: 400 });
    }

  } catch (error) {
    console.error("AI Classification API Error:", error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      meta: {
        processingTime: Date.now() - startTime,
        source: "rule",
      },
    }, { status: 500 });
  }
}

// ============================================================================
// GET - API Info
// ============================================================================

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    name: "CashOS AI Classification API",
    version: "1.0.0",
    description: "Dual rule-based + AI transaction classification for Nigerian accounting",
    endpoints: {
      POST: {
        actions: {
          classify: {
            description: "Classify a single transaction",
            body: { transaction: "RawTransaction", useAI: "boolean (optional)" },
          },
          "classify-batch": {
            description: "Classify multiple transactions",
            body: { transactions: "RawTransaction[]", useAI: "boolean (optional)" },
          },
          analyze: {
            description: "Full analysis including classification, journal entry, and tax implications",
            body: { transaction: "RawTransaction", complianceData: "object (optional)" },
          },
          "generate-statement": {
            description: "Generate financial statement from transactions",
            body: { transactions: "RawTransaction[]", useAI: "boolean (optional)" },
          },
          "compliance-check": {
            description: "Run compliance checks on statement or data",
            body: { statement: "StatementDraft", complianceData: "object" },
          },
        },
      },
    },
    compliance: {
      standards: ["FIRS", "CAMA 2020", "IFRS for SMEs", "SAS"],
      taxTypes: ["CIT", "VAT", "WHT", "CGT", "PAYE", "TET"],
    },
  });
}
