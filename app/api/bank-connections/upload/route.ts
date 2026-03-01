/**
 * =============================================================================
 * BANK STATEMENT UPLOAD API
 * =============================================================================
 *
 * POST /api/bank-connections/upload - Upload bank statement CSV
 *
 * Parses CSV bank statements, extracts transactions, and runs them through
 * the full cross-module pipeline:
 *   CSV → Parse → Classify → Accounting → Tax → Budgeting → Cashflow
 *
 * Supported formats:
 * - CSV exports from Nigerian bank portals
 * - Tab-separated files
 *
 * PDF and Excel support can be added by installing pdf-parse / xlsx packages.
 * =============================================================================
 */

import { NextRequest, NextResponse } from "next/server";
import { parseCSVStatement } from "@/lib/banking/transactionPipeline";
import { processTransactions } from "@/lib/banking/transactionPipeline";

export async function POST(request: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const bankCode = formData.get("bankCode") as string | null;
    const accountNumber = formData.get("accountNumber") as string | null;
    const dateFormat = formData.get("dateFormat") as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    if (!bankCode) {
      return NextResponse.json(
        { success: false, error: "Bank code is required" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "text/plain",
      "text/tab-separated-values",
    ];

    // Be lenient with MIME types (browsers are inconsistent)
    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith(".csv") || fileName.endsWith(".tsv") || fileName.endsWith(".txt");
    if (!allowedTypes.includes(file.type) && !isCSV) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file type. Currently supported: CSV, TSV. PDF/XLSX coming soon.",
        },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: "File too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    // Read file content
    const csvText = await file.text();
    if (!csvText.trim()) {
      return NextResponse.json(
        { success: false, error: "File is empty" },
        { status: 400 }
      );
    }

    // Generate connection & account IDs
    const connectionId = `conn_${bankCode}_upload_${Date.now()}`;
    const accountId = accountNumber
      ? `acc_${accountNumber}`
      : `acc_${bankCode}_${Date.now()}`;

    // Parse CSV into InboundBankTransactions
    const parsedFormat = (dateFormat as "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD") || "DD/MM/YYYY";
    const transactions = parseCSVStatement(csvText, connectionId, accountId, {
      currency: "NGN",
      dateFormat: parsedFormat,
    });

    if (transactions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No transactions could be extracted from the file. " +
            "Please ensure it has columns like: Date, Description, Debit, Credit, Balance",
        },
        { status: 422 }
      );
    }

    // Run through the full cross-module pipeline
    const pipelineResult = processTransactions(transactions, {
      entityId: connectionId,
      autoPost: true,
      runTaxClassification: true,
      updateBudgets: true,
      updateCashflow: true,
      bankAccountCode: "1000",
    });

    // Compute date range
    const dates = transactions.map((t) => new Date(t.date).getTime()).filter((d) => !isNaN(d));
    const startDate = dates.length
      ? new Date(Math.min(...dates)).toISOString().split("T")[0]
      : "";
    const endDate = dates.length
      ? new Date(Math.max(...dates)).toISOString().split("T")[0]
      : "";

    return NextResponse.json({
      success: true,
      data: {
        connectionId,
        fileName: file.name,
        transactionsFound: transactions.length,
        transactionsImported: pipelineResult.processed,
        duplicatesSkipped: pipelineResult.duplicatesSkipped,
        failed: pipelineResult.failed,
        dateRange: { start: startDate, end: endDate },
        pipeline: {
          summary: pipelineResult.summary,
          details: pipelineResult.results.map((r) => ({
            bankTxId: r.bankTransactionId,
            journalId: r.accounting.journalId,
            category: r.classification.categoryLabel,
            nature: r.classification.nature,
            confidence: Math.round(r.classification.confidence * 100),
            taxClassified: r.tax.classified,
            budgetCategory: r.budgeting.categoryMatch,
            warnings: r.warnings,
          })),
        },
      },
    });
  } catch (error) {
    console.error("Failed to upload statement:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process bank statement" },
      { status: 500 }
    );
  }
}
