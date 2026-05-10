import { jsPDF } from "jspdf";
import { configureJsPdfTypography } from "@/lib/pdf/jspdfTypography";

type TaxType =
  | "VAT"
  | "WHT"
  | "CIT"
  | "PIT"
  | "CGT"
  | "STAMP_DUTY"
  | "TET"
  | "POLICE_LEVY"
  | "NASENI"
  | "DEV_LEVY"
  | "OTHER";

export interface TaxRemittancePdfPayload {
  taxpayerName: string;
  businessName?: string;
  taxType: TaxType;
  period: string;
  dueDate: string;
  taxAmount: number;
  scheduleId: string;
  generatedAt?: string;
  paymentReference?: string;
}

const DARK_GREY: [number, number, number] = [50, 55, 60];
const BODY_TEXT: [number, number, number] = [40, 40, 40];
const MUTED_TEXT: [number, number, number] = [130, 130, 130];
const TABLE_BORDER: [number, number, number] = [180, 180, 180];
const WHITE: [number, number, number] = [255, 255, 255];

const formatCurrency = (amount: number): string =>
  `NGN ${Math.max(0, amount).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const makeFirsPaymentReference = (
  taxType: string,
  period: string,
  generatedAtIso: string,
  amount: number
): string => {
  const dateCode = generatedAtIso.slice(0, 10).replace(/-/g, "");
  const amountCode = Math.round(Math.abs(amount)).toString().slice(-4).padStart(4, "0");
  const periodCode = period.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `FIRS-${taxType}-${periodCode}-${dateCode}-${amountCode}`;
};

const cleanFileName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function drawHeader(
  doc: jsPDF,
  margin: number,
  contentWidth: number,
  payload: TaxRemittancePdfPayload,
  generatedAtIso: string
): number {
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text("TAX REMITTANCE RECORD", margin, y);
  y += 6.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED_TEXT);
  doc.text("Official payment record for statutory remittance processing", margin, y);
  y += 5.5;

  doc.setDrawColor(...TABLE_BORDER);
  doc.setLineWidth(0.35);
  doc.line(margin, y, margin + contentWidth, y);
  y += 4;

  const boxHeight = 24;
  const half = contentWidth / 2;
  const rowHeight = boxHeight / 3;
  const boxY = y;

  doc.setDrawColor(...TABLE_BORDER);
  doc.setLineWidth(0.3);
  doc.rect(margin, boxY, contentWidth, boxHeight);
  doc.line(margin + half, boxY, margin + half, boxY + boxHeight);
  doc.line(margin, boxY + rowHeight, margin + contentWidth, boxY + rowHeight);
  doc.line(margin, boxY + rowHeight * 2, margin + contentWidth, boxY + rowHeight * 2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...BODY_TEXT);
  doc.text(`Taxpayer: ${payload.taxpayerName || "Not provided"}`, margin + 2, boxY + 5.4);
  doc.text(`Business: ${payload.businessName || "Not provided"}`, margin + half + 2, boxY + 5.4);
  doc.text(`Tax Type: ${payload.taxType}`, margin + 2, boxY + rowHeight + 5.4);
  doc.text(`Period: ${payload.period}`, margin + half + 2, boxY + rowHeight + 5.4);
  doc.text(`Due Date: ${formatDate(payload.dueDate)}`, margin + 2, boxY + rowHeight * 2 + 5.4);
  doc.text(`Generated: ${formatDate(generatedAtIso)}`, margin + half + 2, boxY + rowHeight * 2 + 5.4);

  return boxY + boxHeight + 7;
}

function drawSectionTitle(doc: jsPDF, title: string, margin: number, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(0, 0, 0);
  doc.text(title, margin, y);
  y += 3.5;
  doc.setDrawColor(...TABLE_BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, y, doc.internal.pageSize.getWidth() - margin, y);
  return y + 4.2;
}

function drawReferenceBlock(
  doc: jsPDF,
  margin: number,
  contentWidth: number,
  y: number,
  paymentReference: string
): number {
  const blockHeight = 18;
  doc.setDrawColor(...TABLE_BORDER);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, blockHeight);
  doc.setFillColor(...DARK_GREY);
  doc.rect(margin, y, contentWidth, 6.8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.4);
  doc.setTextColor(...WHITE);
  doc.text("FIRS Payment Reference", margin + 2, y + 4.6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BODY_TEXT);
  doc.text(paymentReference, margin + 2, y + 13.3);

  return y + blockHeight + 8;
}

function drawRemittanceSummary(
  doc: jsPDF,
  margin: number,
  contentWidth: number,
  y: number,
  payload: TaxRemittancePdfPayload,
  paymentReference: string
): number {
  const rows: Array<[string, string]> = [
    ["Amount Payable", formatCurrency(payload.taxAmount)],
    ["Schedule ID", payload.scheduleId],
    ["Payment Authority", "Federal Inland Revenue Service (FIRS)"],
    ["Payment Reference", paymentReference],
  ];
  const labelWidth = contentWidth * 0.46;
  const valueWidth = contentWidth - labelWidth;
  const headerHeight = 8;
  const rowHeight = 7.8;
  const tableHeight = headerHeight + rows.length * rowHeight;

  doc.setDrawColor(...TABLE_BORDER);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, tableHeight);
  doc.line(margin + labelWidth, y, margin + labelWidth, y + tableHeight);

  doc.setFillColor(...DARK_GREY);
  doc.rect(margin, y, contentWidth, headerHeight, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...WHITE);
  doc.text("Description", margin + 2, y + 5.3);
  doc.text("Value", margin + labelWidth + 2, y + 5.3);
  y += headerHeight;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BODY_TEXT);
  rows.forEach(([label, value]) => {
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);
    const wrappedValue = doc.splitTextToSize(value, valueWidth - 4);
    doc.text(label, margin + 2, y + 5.1);
    doc.text(wrappedValue.slice(0, 2), margin + labelWidth + 2, y + 5.1);
    y += rowHeight;
  });

  return y + 8;
}

function drawInstructionsBox(doc: jsPDF, margin: number, contentWidth: number, y: number): number {
  const instructions = [
    "1. Use the payment reference above when initiating remittance.",
    "2. Submit payment through approved bank channels or FIRS digital rails.",
    "3. Keep bank confirmation and remittance evidence for compliance records.",
    "4. File and reconcile this remittance against the related schedule.",
  ];
  const boxTopPadding = 4.5;
  const lineGap = 4.6;
  const bodyLines = instructions.flatMap((line) => doc.splitTextToSize(line, contentWidth - 6));
  const boxHeight = boxTopPadding + bodyLines.length * lineGap + 4;

  doc.setDrawColor(...TABLE_BORDER);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, boxHeight);
  doc.setFillColor(...DARK_GREY);
  doc.rect(margin, y, contentWidth, 6.8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.4);
  doc.setTextColor(...WHITE);
  doc.text("Payment Instructions", margin + 2, y + 4.6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.3);
  doc.setTextColor(...BODY_TEXT);
  let lineY = y + 10.8;
  instructions.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, contentWidth - 6);
    doc.text(wrapped, margin + 2, lineY);
    lineY += wrapped.length * lineGap;
  });

  return y + boxHeight + 7;
}

function drawSignatureAndFooter(doc: jsPDF, margin: number, contentWidth: number, y: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const signatureY = Math.max(y + 2, pageHeight - 30);

  doc.setDrawColor(...TABLE_BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, signatureY, margin + 64, signatureY);
  doc.line(margin + 84, signatureY, margin + 134, signatureY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED_TEXT);
  doc.text("Authorized Signatory", margin, signatureY + 4.5);
  doc.text("Date", margin + 84, signatureY + 4.5);

  const footerY = pageHeight - 12;
  doc.line(margin, footerY - 3.5, margin + contentWidth, footerY - 3.5);
  doc.setFontSize(8);
  doc.text(
    `Generated by Bace Tax Workspace • ${new Date().toLocaleDateString("en-NG", { dateStyle: "long" })}`,
    margin,
    footerY
  );
}

export async function generateTaxRemittancePdf(payload: TaxRemittancePdfPayload): Promise<string> {
  const generatedAtIso = payload.generatedAt || new Date().toISOString();
  const paymentReference =
    payload.paymentReference ||
    makeFirsPaymentReference(payload.taxType, payload.period, generatedAtIso, payload.taxAmount);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  await configureJsPdfTypography(doc, "helvetica");

  const margin = 15;
  const contentWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = drawHeader(doc, margin, contentWidth, payload, generatedAtIso);

  const ensureSpace = (required = 40) => {
    if (y + required > pageHeight - 18) {
      doc.addPage();
      y = 18;
    }
  };

  ensureSpace(34);
  y = drawSectionTitle(doc, "FIRS Payment Reference", margin, y);
  y = drawReferenceBlock(doc, margin, contentWidth, y, paymentReference);

  ensureSpace(50);
  y = drawSectionTitle(doc, "Remittance Summary", margin, y);
  y = drawRemittanceSummary(doc, margin, contentWidth, y, payload, paymentReference);

  ensureSpace(44);
  y = drawInstructionsBox(doc, margin, contentWidth, y);

  drawSignatureAndFooter(doc, margin, contentWidth, y);

  const fileName = `remittance-${cleanFileName(payload.taxType)}-${cleanFileName(payload.period)}.pdf`;
  doc.save(fileName);
  return paymentReference;
}
