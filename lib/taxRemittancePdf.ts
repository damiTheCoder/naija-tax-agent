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

const formatCurrency = (amount: number): string =>
  `NGN ${Math.max(0, amount).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

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

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;
  const lineHeight = 6.2;

  await configureJsPdfTypography(doc, "helvetica");

  const ensureSpace = (required = 24) => {
    if (y + required > pageHeight - 18) {
      doc.addPage();
      y = 20;
    }
  };

  const drawSectionHeader = (title: string) => {
    ensureSpace(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(32, 45, 68);
    doc.text(title, margin, y);
    y += 4;
    doc.setDrawColor(218, 225, 235);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  };

  const drawLabelValue = (label: string, value: string) => {
    ensureSpace(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(44, 56, 78);
    doc.text(`${label}:`, margin, y);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    const wrapped = doc.splitTextToSize(value || "N/A", contentWidth - 42);
    doc.text(wrapped, margin + 40, y);
    y += Math.max(lineHeight, wrapped.length * lineHeight);
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(17, 24, 39);
  doc.text("Tax Remittance Record", margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Official payment record for tax remittance processing", margin, y);
  y += 9;

  doc.setDrawColor(218, 225, 235);
  doc.setLineWidth(0.45);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  drawSectionHeader("FIRS Payment Reference");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(30, 64, 175);
  const refLines = doc.splitTextToSize(paymentReference, contentWidth);
  doc.text(refLines, margin, y);
  y += refLines.length * lineHeight + 4;

  drawSectionHeader("Remittance Slip");

  const slipRows: Array<[string, string]> = [
    ["Taxpayer", payload.taxpayerName || "Not provided"],
    ["Business", payload.businessName || "Not provided"],
    ["Tax Type", payload.taxType],
    ["Tax Period", payload.period],
    ["Amount Payable", formatCurrency(payload.taxAmount)],
    ["Due Date", formatDate(payload.dueDate)],
    ["Generated On", formatDate(generatedAtIso)],
    ["Schedule ID", payload.scheduleId],
    ["Payment Authority", "Federal Inland Revenue Service (FIRS)"],
  ];

  for (const [label, value] of slipRows) {
    drawLabelValue(label, value);
  }

  y += 2;
  drawSectionHeader("Payment Instructions");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  const instructions = [
    "1. Use the FIRS payment reference above when initiating payment.",
    "2. Submit payment through approved bank channels or FIRS digital rails.",
    "3. Keep bank confirmation and remittance evidence for compliance records.",
    "4. File and reconcile this remittance against the related tax schedule.",
  ];

  instructions.forEach((line) => {
    ensureSpace(12);
    const wrapped = doc.splitTextToSize(line, contentWidth);
    doc.text(wrapped, margin, y);
    y += wrapped.length * lineHeight + 1.4;
  });

  y += 2;
  drawSectionHeader("Integration Note");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  const integrationText =
    "Possible integration point: FIRS ATRS / TaxPro Max payment flow or designated bank payment gateway.";
  const wrappedIntegration = doc.splitTextToSize(integrationText, contentWidth);
  doc.text(wrappedIntegration, margin, y);
  y += wrappedIntegration.length * lineHeight + 4;

  doc.setDrawColor(218, 225, 235);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9.5);
  doc.text("Generated by Quantum Ledger Tax Workspace", margin, y);

  const fileName = `remittance-${cleanFileName(payload.taxType)}-${cleanFileName(payload.period)}.pdf`;
  doc.save(fileName);
  return paymentReference;
}
