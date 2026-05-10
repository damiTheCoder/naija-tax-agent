/**
 * API Route: /api/pdf
 * POST endpoint for generating tax computation PDF sheets.
 */

import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { GeneratePdfRequest } from "@/lib/types";

type PdfDoc = InstanceType<typeof PDFDocument>;

type PdfFonts = {
  regular: string;
  bold: string;
};

function formatCurrency(amount: number): string {
  return `NGN ${amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
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

function configureTypography(doc: PdfDoc): PdfFonts {
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

function ensureSpace(doc: PdfDoc, requiredHeight = 72): void {
  if (doc.y + requiredHeight > doc.page.height - 50) {
    doc.addPage();
  }
}

function drawSectionHeader(doc: PdfDoc, title: string, fonts: PdfFonts): void {
  ensureSpace(doc, 48);
  doc
    .moveDown(0.4)
    .font(fonts.bold)
    .fontSize(13)
    .fillColor("#1f2937")
    .text(title, { width: 495 });

  doc.moveDown(0.2);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(1).stroke("#dbe3ee");
  doc.moveDown(0.45);
}

function drawKeyValue(doc: PdfDoc, label: string, value: string, fonts: PdfFonts): void {
  ensureSpace(doc, 30);
  const top = doc.y;
  doc
    .font(fonts.bold)
    .fontSize(10.3)
    .fillColor("#334155")
    .text(label, 50, top, { width: 175, lineGap: 1.8 });

  doc
    .font(fonts.regular)
    .fontSize(10.3)
    .fillColor("#111827")
    .text(value || "N/A", 225, top, { width: 320, lineGap: 2 });

  const consumedHeight = Math.max(
    doc.heightOfString(label, { width: 175, lineGap: 1.8 }),
    doc.heightOfString(value || "N/A", { width: 320, lineGap: 2 })
  );
  doc.y = top + consumedHeight + 4;
}

function drawParagraph(doc: PdfDoc, text: string, fonts: PdfFonts, color = "#334155"): void {
  ensureSpace(doc, 40);
  doc
    .font(fonts.regular)
    .fontSize(10.1)
    .fillColor(color)
    .text(text, { width: 495, lineGap: 2.5, align: "left" });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as GeneratePdfRequest;
    const { profile, inputs, result } = body;

    if (!profile || !inputs || !result) {
      return NextResponse.json(
        { error: "Profile, inputs, and result are required" },
        { status: 400 }
      );
    }

    const generatedAt = new Date().toLocaleDateString("en-NG", { dateStyle: "long" });
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `Tax Computation - ${result.taxYear}`,
        Author: "Bace",
        Subject: "Estimated Tax Computation",
        Creator: "Bace",
      },
    });

    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    const fonts = configureTypography(doc);

    // Header
    doc
      .font(fonts.bold)
      .fontSize(23)
      .fillColor("#0f172a")
      .text("Bace", { width: 495, align: "left" });

    doc
      .moveDown(0.22)
      .font(fonts.bold)
      .fontSize(16)
      .fillColor("#1e40af")
      .text(`Estimated Tax Computation - ${result.taxYear}`, { width: 495, align: "left" });

    doc
      .moveDown(0.2)
      .font(fonts.regular)
      .fontSize(10)
      .fillColor("#64748b")
      .text(`Generated: ${generatedAt}`, { width: 495, align: "left" });

    drawSectionHeader(doc, "Taxpayer Details", fonts);
    drawKeyValue(doc, "Full Name", profile.fullName || "N/A", fonts);
    drawKeyValue(doc, "Business Name", profile.businessName || "N/A", fonts);
    drawKeyValue(
      doc,
      "Taxpayer Type",
      profile.taxpayerType === "freelancer" ? "Individual / Freelancer" : "Company / SME",
      fonts
    );
    drawKeyValue(doc, "Tax Year", String(result.taxYear), fonts);
    drawKeyValue(doc, "State of Residence", profile.stateOfResidence || "N/A", fonts);
    drawKeyValue(doc, "VAT Registered", profile.isVATRegistered ? "Yes" : "No", fonts);

    drawSectionHeader(doc, "Financial Inputs", fonts);
    const inputRows: Array<[string, string]> = [
      ["Gross Revenue", formatCurrency(inputs.grossRevenue || 0)],
      ["Allowable Expenses", formatCurrency(inputs.allowableExpenses || 0)],
    ];

    if (inputs.pensionContributions) inputRows.push(["Pension Contributions", formatCurrency(inputs.pensionContributions)]);
    if (inputs.nhfContributions) inputRows.push(["NHF Contributions", formatCurrency(inputs.nhfContributions)]);
    if (inputs.lifeInsurancePremiums) inputRows.push(["Life Insurance Premiums", formatCurrency(inputs.lifeInsurancePremiums)]);
    if (inputs.otherReliefs) inputRows.push(["Other Reliefs", formatCurrency(inputs.otherReliefs)]);
    if (profile.taxpayerType === "company") {
      if (inputs.turnover) inputRows.push(["Turnover", formatCurrency(inputs.turnover)]);
      if (inputs.costOfSales) inputRows.push(["Cost of Sales", formatCurrency(inputs.costOfSales)]);
      if (inputs.operatingExpenses) inputRows.push(["Operating Expenses", formatCurrency(inputs.operatingExpenses)]);
      if (inputs.capitalAllowance) inputRows.push(["Capital Allowance", formatCurrency(inputs.capitalAllowance)]);
    }
    inputRows.forEach(([label, value]) => drawKeyValue(doc, label, value, fonts));

    drawSectionHeader(doc, "Tax Rule Data Source", fonts);
    drawKeyValue(doc, "Version", result.taxRuleMetadata.version || "N/A", fonts);
    drawKeyValue(doc, "Source", result.taxRuleMetadata.source || "N/A", fonts);
    if (result.taxRuleMetadata.lastUpdated) {
      drawKeyValue(
        doc,
        "Last Updated",
        new Date(result.taxRuleMetadata.lastUpdated).toLocaleString("en-NG"),
        fonts
      );
    }
    if (result.taxRuleMetadata.remoteUrl) {
      drawKeyValue(doc, "Remote URL", result.taxRuleMetadata.remoteUrl, fonts);
    }

    drawSectionHeader(doc, "Tax Breakdown", fonts);
    ensureSpace(doc, 84);

    const headerTop = doc.y;
    const colBand = 50;
    const colRate = 255;
    const colBase = 340;
    const colTax = 445;

    doc
      .font(fonts.bold)
      .fontSize(9.8)
      .fillColor("#475569")
      .text("Band", colBand, headerTop)
      .text("Rate", colRate, headerTop)
      .text("Base Amount", colBase, headerTop)
      .text("Tax Amount", colTax, headerTop);

    doc.moveTo(50, headerTop + 16).lineTo(545, headerTop + 16).lineWidth(0.9).stroke("#dbe3ee");
    doc.y = headerTop + 22;

    for (const band of result.bands) {
      ensureSpace(doc, 30);
      const rowTop = doc.y;

      const bandHeight = doc.heightOfString(band.bandLabel, {
        width: colRate - colBand - 14,
        lineGap: 1.8,
      });
      const rowHeight = Math.max(20, bandHeight + 8);

      doc
        .font(fonts.regular)
        .fontSize(10)
        .fillColor("#111827")
        .text(band.bandLabel, colBand, rowTop, { width: colRate - colBand - 14, lineGap: 1.8 })
        .text(formatPercent(band.rate), colRate, rowTop, { width: colBase - colRate - 10, align: "left" })
        .text(formatCurrency(band.baseAmount), colBase, rowTop, { width: colTax - colBase - 10, align: "left" })
        .text(formatCurrency(band.taxAmount), colTax, rowTop, { width: 100, align: "left" });

      doc.moveTo(50, rowTop + rowHeight).lineTo(545, rowTop + rowHeight).lineWidth(0.5).stroke("#e5e7eb");
      doc.y = rowTop + rowHeight + 3;
    }

    ensureSpace(doc, 36);
    doc
      .font(fonts.bold)
      .fontSize(11.2)
      .fillColor("#0f172a")
      .text("Total Tax Due", 50, doc.y)
      .text(formatCurrency(result.totalTaxDue), 445, doc.y, { width: 100, align: "left" });

    if (result.vat) {
      drawSectionHeader(doc, "VAT Summary", fonts);
      drawKeyValue(doc, "VAT Rate", formatPercent(result.vat.vatRate), fonts);
      drawKeyValue(doc, "Output VAT (Sales)", formatCurrency(result.vat.outputVAT), fonts);
      if (typeof result.vat.inputVAT === "number") {
        drawKeyValue(doc, "Input VAT (Purchases)", formatCurrency(result.vat.inputVAT), fonts);
      }
      drawKeyValue(doc, "Net VAT Payable", formatCurrency(result.vat.netVATPayable), fonts);
    }

    drawSectionHeader(doc, "Computation Summary", fonts);
    drawKeyValue(doc, "Taxable Income", formatCurrency(result.taxableIncome), fonts);
    drawKeyValue(doc, "Total Tax Due", formatCurrency(result.totalTaxDue), fonts);
    drawKeyValue(doc, "Effective Tax Rate", formatPercent(result.effectiveRate), fonts);
    if (result.vat) {
      drawKeyValue(doc, "VAT Payable", formatCurrency(result.vat.netVATPayable), fonts);
    }

    if (result.notes.length > 0) {
      drawSectionHeader(doc, "Notes", fonts);
      result.notes.forEach((note) => {
        drawParagraph(doc, `- ${note}`, fonts, "#475569");
        doc.moveDown(0.1);
      });
    }

    drawSectionHeader(doc, "Disclaimer", fonts);
    drawParagraph(
      doc,
      "This computation is an estimate generated by software using available tax rules and supplied inputs. It is for information purposes only and does not constitute tax, legal, or financial advice.",
      fonts,
      "#7f1d1d"
    );
    doc.moveDown(0.2);
    drawParagraph(
      doc,
      "Confirm all figures with FIRS, your State Board of Internal Revenue, or a qualified tax professional before filing or payment.",
      fonts,
      "#7f1d1d"
    );

    ensureSpace(doc, 28);
    doc
      .moveDown(0.5)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .lineWidth(0.8)
      .stroke("#dbe3ee");
    doc
      .moveDown(0.25)
      .font(fonts.regular)
      .fontSize(8.8)
      .fillColor("#64748b")
      .text("Generated by Bace", { width: 495, align: "center" });

    doc.end();

    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
    });

    const filename = `quantum-ledger-tax-computation-${result.taxYear}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("[PDF Route] Error generating PDF:", error);
    return NextResponse.json(
      { error: "Unable to generate PDF. Please try again." },
      { status: 500 }
    );
  }
}

