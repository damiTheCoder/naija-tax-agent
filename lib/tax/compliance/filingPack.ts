import { jsPDF } from "jspdf";
import { configureJsPdfTypography } from "@/lib/pdf/jspdfTypography";
import type { FilingPackResult, TaxSchedule } from "./types";
import { loadFilingPacks, saveFilingPacks } from "./store";
import { recordAuditLog } from "./audit";

const makeId = () => `pack-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const DARK_GREY: [number, number, number] = [50, 55, 60];
const MID_GREY: [number, number, number] = [130, 130, 130];
const LIGHT_BORDER: [number, number, number] = [190, 190, 190];
const WHITE: [number, number, number] = [255, 255, 255];

const formatDateDisplay = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatCurrency = (value: number) => {
  const normalized = Number.isFinite(value) ? value : 0;
  return `NGN ${normalized.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const drawHeader = (
  doc: jsPDF,
  schedule: TaxSchedule,
  entityId: string,
  generatedAt: string,
  margin: number,
  contentWidth: number
) => {
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text("TAX RETURN FILING DOCUMENT", margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MID_GREY);
  doc.text(`Entity: ${entityId}`, margin, y);
  y += 6;

  doc.setDrawColor(...LIGHT_BORDER);
  doc.setLineWidth(0.35);
  doc.line(margin, y, margin + contentWidth, y);
  y += 4;

  const boxY = y;
  const boxHeight = 24;
  const half = contentWidth / 2;
  const rowHeight = boxHeight / 3;

  doc.setDrawColor(...LIGHT_BORDER);
  doc.setLineWidth(0.3);
  doc.rect(margin, boxY, contentWidth, boxHeight);
  doc.line(margin + half, boxY, margin + half, boxY + boxHeight);
  doc.line(margin, boxY + rowHeight, margin + contentWidth, boxY + rowHeight);
  doc.line(margin, boxY + rowHeight * 2, margin + contentWidth, boxY + rowHeight * 2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(40, 40, 40);
  doc.text(`Tax Type: ${schedule.taxType}`, margin + 2, boxY + 5.5);
  doc.text(`Period: ${schedule.period}`, margin + half + 2, boxY + 5.5);
  doc.text(`Due Date: ${formatDateDisplay(schedule.dueDate)}`, margin + 2, boxY + rowHeight + 5.5);
  doc.text(`Status: ${String(schedule.status || "draft").toUpperCase()}`, margin + half + 2, boxY + rowHeight + 5.5);
  doc.text(`Generated: ${formatDateDisplay(generatedAt)}`, margin + 2, boxY + rowHeight * 2 + 5.5);
  doc.text(`Schedule ID: ${schedule.id.slice(-10)}`, margin + half + 2, boxY + rowHeight * 2 + 5.5);

  return boxY + boxHeight + 8;
};

const drawSummaryTable = (
  doc: jsPDF,
  schedule: TaxSchedule,
  margin: number,
  contentWidth: number,
  y: number
) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("RETURN SUMMARY", margin, y);
  y += 5;

  const col1 = contentWidth * 0.62;
  const headerHeight = 8;
  const rowHeight = 8;
  const rows: Array<[string, string]> = [
    ["Total Base", formatCurrency(schedule.totalBase)],
    ["Carry Forward", formatCurrency(schedule.carryForward)],
  ];
  const totalRowHeight = 9;
  const tableHeight = headerHeight + rows.length * rowHeight + totalRowHeight;

  doc.setDrawColor(...LIGHT_BORDER);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, tableHeight);
  doc.line(margin + col1, y, margin + col1, y + tableHeight);

  doc.setFillColor(...DARK_GREY);
  doc.rect(margin, y, contentWidth, headerHeight, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...WHITE);
  doc.text("Description", margin + 2, y + 5.5);
  doc.text("Amount", margin + col1 + 2, y + 5.5);

  doc.setTextColor(35, 35, 35);
  doc.setFont("helvetica", "normal");
  let rowY = y + headerHeight;
  for (const [label, amount] of rows) {
    doc.line(margin, rowY + rowHeight, margin + contentWidth, rowY + rowHeight);
    doc.text(label, margin + 2, rowY + 5.5);
    doc.text(amount, margin + col1 + 2, rowY + 5.5);
    rowY += rowHeight;
  }

  const amountPayable = Math.max(0, schedule.totalTax || 0);
  doc.setFillColor(...DARK_GREY);
  doc.rect(margin, rowY, contentWidth, totalRowHeight, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text("Total Tax Payable", margin + 2, rowY + 6);
  doc.text(formatCurrency(amountPayable), margin + col1 + 2, rowY + 6);

  return y + tableHeight + 10;
};

const drawChecklistAndFooter = (doc: jsPDF, margin: number, contentWidth: number, y: number) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  doc.text("Pre-Filing Checklist", margin, y);
  y += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(55, 55, 55);
  const checklist = [
    "Reconcile this return to underlying accounting ledgers and schedules.",
    "Confirm due date and approval workflow before submission.",
    "Retain this document with supporting schedules for audit trail.",
  ];
  checklist.forEach((line) => {
    doc.text(`- ${line}`, margin + 1, y);
    y += 4.5;
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  const signatureY = Math.max(y + 5, pageHeight - 34);
  doc.setDrawColor(...LIGHT_BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, signatureY, margin + 64, signatureY);
  doc.line(margin + 80, signatureY, margin + 130, signatureY);
  doc.setFontSize(8.5);
  doc.setTextColor(...MID_GREY);
  doc.text("Authorized Signatory", margin, signatureY + 4.5);
  doc.text("Date", margin + 80, signatureY + 4.5);

  const footerY = pageHeight - 12;
  doc.line(margin, footerY - 3.5, margin + contentWidth, footerY - 3.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `Generated by Quantum Ledger • ${new Date().toLocaleDateString("en-NG", { dateStyle: "long" })}`,
    margin,
    footerY
  );
};

export async function generateFilingPack(params: {
  entityId: string;
  schedule: TaxSchedule;
  format: "pdf" | "csv" | "xlsx";
}): Promise<FilingPackResult> {
  const generatedAt = new Date().toISOString();
  const id = makeId();
  const fileName = `tax-${params.schedule.taxType}-${params.schedule.period}.${params.format}`;

  let blob: Blob | undefined;

  if (params.format === "pdf") {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    await configureJsPdfTypography(doc, "helvetica");
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;

    let y = drawHeader(doc, params.schedule, params.entityId, generatedAt, margin, contentWidth);
    y = drawSummaryTable(doc, params.schedule, margin, contentWidth, y);
    drawChecklistAndFooter(doc, margin, contentWidth, y);

    const pdfBlob = doc.output("blob");
    blob = pdfBlob;
  }

  if (params.format === "csv") {
    const rows = [
      ["tax_type", "period", "due_date", "total_tax", "carry_forward"],
      [
        params.schedule.taxType,
        params.schedule.period,
        params.schedule.dueDate,
        params.schedule.totalTax.toFixed(2),
        params.schedule.carryForward.toFixed(2),
      ],
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    blob = new Blob([csv], { type: "text/csv" });
  }

  const pack: FilingPackResult = {
    id,
    entityId: params.entityId,
    period: params.schedule.period,
    taxType: params.schedule.taxType,
    format: params.format,
    fileName,
    generatedAt,
    metadata: {
      totalTax: params.schedule.totalTax,
      scheduleId: params.schedule.id,
    },
    blob,
  };

  const existing = loadFilingPacks();
  saveFilingPacks([pack, ...existing].slice(0, 50));

  recordAuditLog({
    entityId: params.entityId,
    actor: "system",
    action: "filing_pack.generated",
    resourceType: "tax_filing_package",
    resourceId: pack.id,
    metadata: {
      scheduleId: params.schedule.id,
      format: params.format,
    },
  });

  return pack;
}
