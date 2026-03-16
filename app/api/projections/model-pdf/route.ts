import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";

type PdfAssumption = {
  key: string;
  label: string;
  helper?: string;
  kind?: string;
  value?: number;
  formattedValue?: string;
};

type PdfMetric = {
  label: string;
  value: string;
  hint?: string;
};

type PdfTableRow = {
  label: string;
  value: string;
};

type PdfTableSection = {
  title: string;
  rows: PdfTableRow[];
};

type ModelPdfPayload = {
  modelId: string;
  modelName: string;
  purpose?: string;
  description?: string;
  summary?: string;
  assumptions: PdfAssumption[];
  metrics: PdfMetric[];
  tables: PdfTableSection[];
};

type PdfDoc = InstanceType<typeof PDFDocument>;

function safeText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function resolveFontPath(fileName: string): string | null {
  const candidates = [
    path.join(process.cwd(), "app", "fonts", fileName),
    path.join(process.cwd(), "public", "fonts", fileName),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function configureTypography(doc: PdfDoc): { regular: string; bold: string } {
  const regularPath = resolveFontPath("GlacialIndifference-Regular.ttf");
  const boldPath = resolveFontPath("GlacialIndifference-Bold.ttf");

  if (regularPath && boldPath) {
    doc.registerFont("GlacialRegular", regularPath);
    doc.registerFont("GlacialBold", boldPath);
    doc.font("GlacialRegular");
    return { regular: "GlacialRegular", bold: "GlacialBold" };
  }

  doc.font("Helvetica");
  return { regular: "Helvetica", bold: "Helvetica-Bold" };
}

function ensureSpace(doc: PdfDoc, requiredHeight = 80): void {
  if (doc.y + requiredHeight > doc.page.height - 50) {
    doc.addPage();
  }
}

function drawSectionHeader(doc: PdfDoc, text: string, fonts: { regular: string; bold: string }): void {
  ensureSpace(doc, 44);
  doc
    .moveDown(0.45)
    .font(fonts.bold)
    .fontSize(13)
    .fillColor("#1f2937")
    .text(text);

  doc.moveDown(0.18);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(1).stroke("#dbe3ee");
  doc.moveDown(0.45);
}

function drawLabeledValue(
  doc: PdfDoc,
  label: string,
  value: string,
  fonts: { regular: string; bold: string },
  options?: { helper?: string }
): void {
  ensureSpace(doc, 52);
  doc.font(fonts.bold).fontSize(10.2).fillColor("#334155").text(label, 50, doc.y, { continued: true });
  doc.font(fonts.regular).fontSize(10.2).fillColor("#111827").text(`  ${value || "N/A"}`, 50, doc.y, {
    width: 495,
    align: "left",
    lineGap: 2,
  });

  const helper = safeText(options?.helper);
  if (helper) {
    doc
      .font(fonts.regular)
      .fontSize(8.8)
      .fillColor("#64748b")
      .text(helper, 50, doc.y + 2, { width: 495, lineGap: 1.4 });
  }
  doc.moveDown(0.35);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Partial<ModelPdfPayload>;

    const modelId = safeText(body.modelId, "financial-model");
    const modelName = safeText(body.modelName, "Financial Model");
    const purpose = safeText(body.purpose);
    const description = safeText(body.description);
    const summary = safeText(body.summary);
    const assumptions = Array.isArray(body.assumptions) ? body.assumptions : [];
    const metrics = Array.isArray(body.metrics) ? body.metrics : [];
    const tables = Array.isArray(body.tables) ? body.tables : [];

    if (!modelName || assumptions.length === 0 || metrics.length === 0) {
      return NextResponse.json(
        { error: "modelName, assumptions, and metrics are required" },
        { status: 400 }
      );
    }

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `${modelName} - Financial Model`,
        Author: "Atom Ledger",
        Subject: "Financial Modelling Export",
        Creator: "Atom Ledger",
      },
    });

    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));

    const fonts = configureTypography(doc);

    doc
      .font(fonts.bold)
      .fontSize(22)
      .fillColor("#0f172a")
      .text("Atom Ledger", { align: "left" });

    doc
      .moveDown(0.25)
      .font(fonts.bold)
      .fontSize(17)
      .fillColor("#1e293b")
      .text(modelName, { width: 495 });

    if (purpose || description) {
      doc
        .moveDown(0.2)
        .font(fonts.regular)
        .fontSize(10.4)
        .fillColor("#475569")
        .text([purpose, description].filter(Boolean).join(" - "), { width: 495, lineGap: 2 });
    }

    doc
      .moveDown(0.2)
      .font(fonts.regular)
      .fontSize(9.2)
      .fillColor("#64748b")
      .text(`Generated: ${new Date().toLocaleString("en-NG")}`);

    drawSectionHeader(doc, "Key Metrics", fonts);
    metrics.forEach((metric) => {
      drawLabeledValue(
        doc,
        safeText(metric.label, "Metric"),
        safeText(metric.value, "N/A"),
        fonts,
        { helper: safeText(metric.hint) }
      );
    });

    drawSectionHeader(doc, "Assumptions", fonts);
    assumptions.forEach((assumption) => {
      drawLabeledValue(
        doc,
        safeText(assumption.label, assumption.key || "Assumption"),
        safeText(assumption.formattedValue, String(assumption.value ?? "")),
        fonts,
        { helper: safeText(assumption.helper) }
      );
    });

    tables.forEach((table) => {
      drawSectionHeader(doc, safeText(table.title, "Model Table"), fonts);
      const rows = Array.isArray(table.rows) ? table.rows : [];
      rows.forEach((row) => {
        drawLabeledValue(doc, safeText(row.label, "Line Item"), safeText(row.value, "N/A"), fonts);
      });
    });

    if (summary) {
      drawSectionHeader(doc, "Summary", fonts);
      ensureSpace(doc, 70);
      doc
        .font(fonts.regular)
        .fontSize(10.4)
        .fillColor("#1e293b")
        .text(summary, { width: 495, lineGap: 2.4 });
    }

    doc.end();

    await new Promise<void>((resolve) => doc.on("end", resolve));
    const pdfBuffer = Buffer.concat(chunks);
    const filename = `${slugify(modelId || modelName)}-report.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[Model PDF] Failed to generate PDF:", error);
    return NextResponse.json(
      { error: "Unable to generate model PDF" },
      { status: 500 }
    );
  }
}

