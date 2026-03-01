import { jsPDF } from "jspdf";
import { configureJsPdfTypography } from "@/lib/pdf/jspdfTypography";

export interface TaxComputationPdfPayload {
  period: string;
  generatedAt: string;
  incomeTax: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    taxableProfitBeforeAdjustments: number;
    addBacks: number;
    deductions: number;
    adjustedTaxableProfit: number;
    taxRate: number;
    computedIncomeTax: number;
    minimumTax: number;
    taxPayable: number;
  };
  vat: {
    outputVat: number;
    inputVat: number;
    vatPayable: number;
    vatCredit: number;
  };
  wht: {
    totalDeducted: number;
    totalSuffered: number;
    netPosition: number;
    payable: number;
    receivable: number;
  };
  paye: {
    totalPayrollBase: number;
    totalPayeRecorded: number;
    totalPayeForDisplay: number;
    rows: Array<{
      period: string;
      payrollBase: number;
      payeForDisplay: number;
      status: "Recorded" | "Estimated";
    }>;
  };
}

const DARK_GREY: [number, number, number] = [50, 55, 60];
const BODY_TEXT: [number, number, number] = [40, 40, 40];
const MUTED_TEXT: [number, number, number] = [130, 130, 130];
const TABLE_BORDER: [number, number, number] = [180, 180, 180];
const WHITE: [number, number, number] = [255, 255, 255];

const formatCurrency = (value: number) =>
  `NGN ${Number.isFinite(value) ? value.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}`;

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const safeFilePart = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

type TwoColRow = {
  label: string;
  amount: string;
};

function drawHeader(
  doc: jsPDF,
  payload: TaxComputationPdfPayload,
  margin: number,
  contentWidth: number
): number {
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text("TAX COMPUTATION OUTPUT", margin, y);
  y += 6.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED_TEXT);
  doc.text("Statutory tax computation derived from ledger-backed schedules", margin, y);
  y += 5.5;

  doc.setDrawColor(...TABLE_BORDER);
  doc.setLineWidth(0.35);
  doc.line(margin, y, margin + contentWidth, y);
  y += 4;

  const boxY = y;
  const boxHeight = 16;
  const leftWidth = contentWidth * 0.55;
  doc.setLineWidth(0.3);
  doc.rect(margin, boxY, contentWidth, boxHeight);
  doc.line(margin + leftWidth, boxY, margin + leftWidth, boxY + boxHeight);
  doc.line(margin, boxY + boxHeight / 2, margin + contentWidth, boxY + boxHeight / 2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...BODY_TEXT);
  doc.text(`Period: ${payload.period || "current"}`, margin + 2, boxY + 5.2);
  doc.text(`Generated: ${formatDateTime(payload.generatedAt)}`, margin + 2, boxY + 13.2);
  doc.text(`Report ID: ${safeFilePart(payload.period || "current").toUpperCase()}`, margin + leftWidth + 2, boxY + 5.2);
  doc.text(`Engine: Tax Ledger v2`, margin + leftWidth + 2, boxY + 13.2);

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

function drawTwoColumnTable(params: {
  doc: jsPDF;
  margin: number;
  contentWidth: number;
  y: number;
  rows: TwoColRow[];
  totalRow?: TwoColRow;
}) {
  const { doc, margin, contentWidth, rows, totalRow } = params;
  let { y } = params;

  const labelWidth = contentWidth * 0.68;
  const headerHeight = 8;
  const rowHeight = 7.8;
  const totalHeight = totalRow ? 8.8 : 0;
  const tableHeight = headerHeight + rows.length * rowHeight + totalHeight;

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
  doc.text("Amount", margin + labelWidth + 2, y + 5.3);
  y += headerHeight;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BODY_TEXT);
  for (const row of rows) {
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);
    doc.text(row.label, margin + 2, y + 5.1);
    doc.text(row.amount, margin + labelWidth + 2, y + 5.1);
    y += rowHeight;
  }

  if (totalRow) {
    doc.setFillColor(...DARK_GREY);
    doc.rect(margin, y, contentWidth, totalHeight, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...WHITE);
    doc.text(totalRow.label, margin + 2, y + 5.9);
    doc.text(totalRow.amount, margin + labelWidth + 2, y + 5.9);
    y += totalHeight;
  }

  return y + 8;
}

function drawPayeBreakdown(params: {
  doc: jsPDF;
  margin: number;
  contentWidth: number;
  y: number;
  rows: TaxComputationPdfPayload["paye"]["rows"];
}) {
  const { doc, margin, contentWidth, rows } = params;
  let { y } = params;
  const pageHeight = doc.internal.pageSize.getHeight();
  const headerHeight = 8;
  const rowHeight = 7.2;
  const p1 = margin;
  const p2 = margin + contentWidth * 0.3;
  const p3 = margin + contentWidth * 0.58;
  const p4 = margin + contentWidth * 0.82;

  const safeRows =
    rows.length > 0
      ? rows
      : [{ period: "N/A", payrollBase: 0, payeForDisplay: 0, status: "Estimated" as const }];

  const drawHeaderRow = () => {
    doc.setDrawColor(...TABLE_BORDER);
    doc.setLineWidth(0.3);
    doc.setFillColor(...DARK_GREY);
    doc.rect(margin, y, contentWidth, headerHeight, "F");
    doc.rect(margin, y, contentWidth, headerHeight, "S");
    doc.line(p2, y, p2, y + headerHeight);
    doc.line(p3, y, p3, y + headerHeight);
    doc.line(p4, y, p4, y + headerHeight);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.3);
    doc.setTextColor(...WHITE);
    doc.text("Period", p1 + 2, y + 5.3);
    doc.text("Payroll Base", p2 + 2, y + 5.3);
    doc.text("PAYE", p3 + 2, y + 5.3);
    doc.text("Status", p4 + 2, y + 5.3);
    y += headerHeight;
  };

  drawHeaderRow();

  for (const row of safeRows) {
    if (y + rowHeight > pageHeight - 20) {
      doc.addPage();
      y = 18;
      y = drawSectionTitle(doc, "PAYE Monthly Breakdown", margin, y);
      drawHeaderRow();
    }

    doc.setDrawColor(...TABLE_BORDER);
    doc.setLineWidth(0.25);
    doc.rect(margin, y, contentWidth, rowHeight);
    doc.line(p2, y, p2, y + rowHeight);
    doc.line(p3, y, p3, y + rowHeight);
    doc.line(p4, y, p4, y + rowHeight);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.2);
    doc.setTextColor(...BODY_TEXT);
    doc.text(row.period, p1 + 2, y + 4.8);
    doc.text(formatCurrency(row.payrollBase), p2 + 2, y + 4.8);
    doc.text(formatCurrency(row.payeForDisplay), p3 + 2, y + 4.8);
    doc.text(row.status, p4 + 2, y + 4.8);
    y += rowHeight;
  }

  return y + 7;
}

function drawFooter(doc: jsPDF, margin: number, contentWidth: number) {
  const footerY = doc.internal.pageSize.getHeight() - 12;
  doc.setDrawColor(...TABLE_BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 3.5, margin + contentWidth, footerY - 3.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_TEXT);
  doc.text(
    `Generated by Quantum Ledger Tax Module • ${new Date().toLocaleDateString("en-NG", { dateStyle: "long" })}`,
    margin,
    footerY
  );
}

export async function generateTaxComputationPdf(payload: TaxComputationPdfPayload): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  await configureJsPdfTypography(doc, "helvetica");

  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let y = drawHeader(doc, payload, margin, contentWidth);

  const ensureSpace = (required = 36) => {
    if (y + required > pageHeight - 18) {
      doc.addPage();
      y = 18;
    }
  };

  ensureSpace(70);
  y = drawSectionTitle(doc, "A. Income Tax Computation", margin, y);
  y = drawTwoColumnTable({
    doc,
    margin,
    contentWidth,
    y,
    rows: [
      { label: "Revenue", amount: formatCurrency(payload.incomeTax.revenue) },
      { label: "Less: Cost of Goods Sold", amount: formatCurrency(payload.incomeTax.cogs) },
      { label: "Gross Profit", amount: formatCurrency(payload.incomeTax.grossProfit) },
      { label: "Less: Operating Expenses", amount: formatCurrency(payload.incomeTax.operatingExpenses) },
      {
        label: "Taxable Profit Before Adjustments",
        amount: formatCurrency(payload.incomeTax.taxableProfitBeforeAdjustments),
      },
      { label: "Add-backs", amount: formatCurrency(payload.incomeTax.addBacks) },
      { label: "Deductions", amount: formatCurrency(payload.incomeTax.deductions) },
      {
        label: "Adjusted Taxable Profit",
        amount: formatCurrency(payload.incomeTax.adjustedTaxableProfit),
      },
      {
        label: `Tax @ ${(payload.incomeTax.taxRate * 100).toFixed(1)}%`,
        amount: formatCurrency(payload.incomeTax.computedIncomeTax),
      },
      { label: "Minimum Tax Check", amount: formatCurrency(payload.incomeTax.minimumTax) },
    ],
    totalRow: { label: "Income Tax Payable", amount: formatCurrency(payload.incomeTax.taxPayable) },
  });

  ensureSpace(56);
  y = drawSectionTitle(doc, "B. VAT Computation", margin, y);
  y = drawTwoColumnTable({
    doc,
    margin,
    contentWidth,
    y,
    rows: [
      { label: "Output VAT", amount: formatCurrency(payload.vat.outputVat) },
      { label: "Input VAT", amount: formatCurrency(payload.vat.inputVat) },
      { label: "VAT Credit", amount: formatCurrency(payload.vat.vatCredit) },
    ],
    totalRow: { label: "VAT Payable", amount: formatCurrency(payload.vat.vatPayable) },
  });

  ensureSpace(60);
  y = drawSectionTitle(doc, "C. Withholding Tax (WHT)", margin, y);
  y = drawTwoColumnTable({
    doc,
    margin,
    contentWidth,
    y,
    rows: [
      { label: "Total WHT Deducted", amount: formatCurrency(payload.wht.totalDeducted) },
      { label: "Total WHT Suffered", amount: formatCurrency(payload.wht.totalSuffered) },
      { label: "WHT Payable", amount: formatCurrency(payload.wht.payable) },
      { label: "WHT Receivable", amount: formatCurrency(payload.wht.receivable) },
    ],
    totalRow: { label: "Net WHT Position", amount: formatCurrency(payload.wht.netPosition) },
  });

  ensureSpace(62);
  y = drawSectionTitle(doc, "D. Payroll Tax (PAYE)", margin, y);
  y = drawTwoColumnTable({
    doc,
    margin,
    contentWidth,
    y,
    rows: [
      { label: "Payroll Base", amount: formatCurrency(payload.paye.totalPayrollBase) },
      { label: "PAYE Recorded", amount: formatCurrency(payload.paye.totalPayeRecorded) },
    ],
    totalRow: { label: "Employee Tax Total", amount: formatCurrency(payload.paye.totalPayeForDisplay) },
  });

  ensureSpace(30);
  y = drawSectionTitle(doc, "PAYE Monthly Breakdown", margin, y);
  y = drawPayeBreakdown({
    doc,
    margin,
    contentWidth,
    y,
    rows: payload.paye.rows,
  });

  // Keep footer visible on last page.
  if (y > pageHeight - 20) {
    doc.addPage();
  }
  drawFooter(doc, margin, contentWidth);

  const dateCode = payload.generatedAt.slice(0, 10);
  const fileName = `tax-computation-${safeFilePart(payload.period || "current")}-${dateCode}.pdf`;
  doc.save(fileName);
}
