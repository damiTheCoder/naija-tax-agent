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

const formatCurrency = (value: number) =>
  `NGN ${Math.round(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const safeFilePart = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export async function generateTaxComputationPdf(payload: TaxComputationPdfPayload): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const activeFont = await configureJsPdfTypography(doc, "helvetica");

  const setBodyFont = () => doc.setFont(activeFont, "normal");
  const setBoldFont = () => doc.setFont(activeFont, "bold");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const lineHeight = 6;

  const colors = {
    title: [17, 24, 39] as const,
    body: [55, 65, 81] as const,
    muted: [107, 114, 128] as const,
    rule: [209, 213, 219] as const,
    rowRule: [229, 231, 235] as const,
    headerFill: [249, 250, 251] as const,
  };

  let y = 18;

  const ensureSpace = (required = 20) => {
    if (y + required > pageHeight - 16) {
      doc.addPage();
      y = 18;
    }
  };

  const drawRule = (yPos: number, color: readonly [number, number, number] = colors.rule) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.35);
    doc.line(margin, yPos, pageWidth - margin, yPos);
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(12);

    setBoldFont();
    doc.setFontSize(12);
    doc.setTextColor(...colors.title);
    doc.text(title, margin, y);
    y += 4;

    drawRule(y);
    y += 4;
  };

  const addStatementRow = (label: string, value: string, emphasis = false) => {
    ensureSpace(12);
    const rowTop = y;

    setBodyFont();
    doc.setFontSize(10);
    doc.setTextColor(...colors.body);
    const labelLines = doc.splitTextToSize(label, contentWidth * 0.54);
    doc.text(labelLines, margin, rowTop + 4.6);

    if (emphasis) {
      setBoldFont();
      doc.setTextColor(...colors.title);
    } else {
      setBoldFont();
      doc.setTextColor(...colors.body);
    }

    const valueLines = doc.splitTextToSize(value, contentWidth * 0.4);
    doc.text(valueLines, pageWidth - margin, rowTop + 4.6, { align: "right" });

    const rowHeight = Math.max(labelLines.length, valueLines.length) * lineHeight;
    const rowBottom = rowTop + rowHeight + 2;
    drawRule(rowBottom, colors.rowRule);
    y = rowBottom + 2.2;
  };

  const drawPayeTable = (
    rows: Array<{
      period: string;
      payrollBase: number;
      payeForDisplay: number;
      status: "Recorded" | "Estimated";
    }>
  ) => {
    const tableRows = rows.length
      ? rows
      : [{ period: "N/A", payrollBase: 0, payeForDisplay: 0, status: "Estimated" as const }];

    const tableLeft = margin;
    const tableRight = pageWidth - margin;
    const tableWidth = tableRight - tableLeft;
    const headerHeight = 8;
    const rowHeight = 7;

    const colPeriod = tableLeft + 2;
    const colPayroll = tableLeft + 72;
    const colPaye = tableLeft + 126;
    const colStatusRight = tableRight - 2;

    const drawHeader = () => {
      ensureSpace(headerHeight + 2);

      doc.setFillColor(...colors.headerFill);
      doc.setDrawColor(...colors.rule);
      doc.rect(tableLeft, y, tableWidth, headerHeight, "F");

      drawRule(y);
      drawRule(y + headerHeight);

      setBoldFont();
      doc.setFontSize(9.5);
      doc.setTextColor(...colors.body);
      doc.text("Period", colPeriod, y + 5.2);
      doc.text("Payroll Base", colPayroll, y + 5.2);
      doc.text("PAYE", colPaye, y + 5.2);
      doc.text("Status", colStatusRight, y + 5.2, { align: "right" });

      y += headerHeight;
    };

    drawHeader();

    for (const row of tableRows) {
      if (y + rowHeight > pageHeight - 16) {
        doc.addPage();
        y = 18;
        drawHeader();
      }

      doc.setDrawColor(...colors.rule);
      drawRule(y + rowHeight, colors.rowRule);

      setBodyFont();
      doc.setFontSize(9.4);
      doc.setTextColor(...colors.title);
      doc.text(row.period, colPeriod, y + 4.8);
      doc.text(formatCurrency(row.payrollBase), colPayroll, y + 4.8);
      doc.text(formatCurrency(row.payeForDisplay), colPaye, y + 4.8);
      doc.text(row.status, colStatusRight, y + 4.8, { align: "right" });

      y += rowHeight;
    }
  };

  setBoldFont();
  doc.setFontSize(18);
  doc.setTextColor(...colors.title);
  doc.text("Tax Computation Output", margin, y);
  y += 8;

  setBodyFont();
  doc.setFontSize(10);
  doc.setTextColor(...colors.muted);
  doc.text(`Period: ${payload.period || "current"}`, margin, y);
  y += 5;
  doc.text(`Generated: ${formatDateTime(payload.generatedAt)}`, margin, y);
  y += 4.5;
  drawRule(y);
  y += 5;

  addSectionTitle("A. Income Tax Computation");
  addStatementRow("Revenue", formatCurrency(payload.incomeTax.revenue));
  addStatementRow("Less: Cost of goods sold", formatCurrency(payload.incomeTax.cogs));
  addStatementRow("Gross profit", formatCurrency(payload.incomeTax.grossProfit), true);
  addStatementRow("Less: Expenses", formatCurrency(payload.incomeTax.operatingExpenses));
  addStatementRow("Taxable profit", formatCurrency(payload.incomeTax.taxableProfitBeforeAdjustments), true);
  addStatementRow("Add-backs", formatCurrency(payload.incomeTax.addBacks));
  addStatementRow("Deductions", formatCurrency(payload.incomeTax.deductions));
  addStatementRow("Adjusted taxable profit", formatCurrency(payload.incomeTax.adjustedTaxableProfit), true);
  addStatementRow(
    `Tax @ ${(payload.incomeTax.taxRate * 100).toFixed(1)}%`,
    formatCurrency(payload.incomeTax.computedIncomeTax)
  );
  addStatementRow("Minimum tax check", formatCurrency(payload.incomeTax.minimumTax));
  addStatementRow("Tax payable", formatCurrency(payload.incomeTax.taxPayable), true);

  addSectionTitle("B. VAT Computation");
  addStatementRow("Output VAT", formatCurrency(payload.vat.outputVat));
  addStatementRow("Input VAT", formatCurrency(payload.vat.inputVat));
  addStatementRow("VAT payable", formatCurrency(payload.vat.vatPayable), true);
  if (payload.vat.vatCredit > 0) {
    addStatementRow("VAT credit", formatCurrency(payload.vat.vatCredit));
  }

  addSectionTitle("C. Withholding Tax (WHT)");
  addStatementRow("Total WHT deducted", formatCurrency(payload.wht.totalDeducted));
  addStatementRow("Total WHT suffered", formatCurrency(payload.wht.totalSuffered));
  addStatementRow("Net WHT position", formatCurrency(payload.wht.netPosition), true);
  addStatementRow("WHT payable", formatCurrency(payload.wht.payable));
  addStatementRow("WHT receivable", formatCurrency(payload.wht.receivable));

  addSectionTitle("D. Payroll Tax (PAYE)");
  addStatementRow("Payroll base", formatCurrency(payload.paye.totalPayrollBase));
  addStatementRow("PAYE recorded", formatCurrency(payload.paye.totalPayeRecorded));
  addStatementRow("Employee tax total", formatCurrency(payload.paye.totalPayeForDisplay), true);

  ensureSpace(14);
  setBoldFont();
  doc.setFontSize(10);
  doc.setTextColor(...colors.body);
  doc.text("PAYE monthly breakdown", margin, y);
  y += 5;
  drawPayeTable(payload.paye.rows);

  ensureSpace(10);
  y += 4;
  drawRule(y);
  y += 5;
  setBodyFont();
  doc.setFontSize(9);
  doc.setTextColor(...colors.muted);
  doc.text("Generated by Quantum Ledger Tax Module", margin, y);

  const dateCode = payload.generatedAt.slice(0, 10);
  const fileName = `tax-computation-${safeFilePart(payload.period || "current")}-${dateCode}.pdf`;
  doc.save(fileName);
}
