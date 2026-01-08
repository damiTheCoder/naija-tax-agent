/**
 * Accounting PDF Generator for CashOS
 * 
 * Generates clean, minimal, professional PDF reports for financial statements, journals, and trial balance.
 * Design uses grey headers, left-aligned content, and Helvetica font for clean appearance.
 */

import { jsPDF } from "jspdf";
import { JournalEntry } from "./accounting/doubleEntry";

// ============= DESIGN CONSTANTS =============

// Colors - Clean grey palette
const DARK_GREY: [number, number, number] = [50, 55, 60];       // #32373c - Header/totals background
const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];
const BODY_TEXT: [number, number, number] = [40, 40, 40];       // Body text
const LIGHT_GREY: [number, number, number] = [130, 130, 130];   // Secondary text
const TABLE_BORDER: [number, number, number] = [180, 180, 180]; // Light border

/**
 * Format number as Nigerian Naira currency
 * Uses simple string formatting to avoid character spacing issues in PDF
 */
function formatCurrency(amount: number | undefined | null): string {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return "N0.00";
    }
    const absAmount = Math.abs(amount);
    // Format number with commas - simple approach
    const fixed = absAmount.toFixed(2);
    const [whole, decimal] = fixed.split('.');
    // Add commas to whole number part
    let formatted = '';
    const digits = whole.split('').reverse();
    for (let i = 0; i < digits.length; i++) {
        if (i > 0 && i % 3 === 0) {
            formatted = ',' + formatted;
        }
        formatted = digits[i] + formatted;
    }
    return 'N' + formatted + '.' + decimal;
}


/**
 * Format date string
 */
function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-NG", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

/**
 * Draw a professional header - left aligned
 */
function drawHeader(
    doc: jsPDF,
    businessName: string,
    documentTitle: string,
    margin: number
): number {
    let y = 20;

    // Document title - Left side, bold
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...BLACK);
    doc.text(documentTitle, margin, y);
    y += 8;

    // Company name - Left side, below title
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...LIGHT_GREY);
    doc.text(businessName, margin, y);

    return y + 15;
}

/**
 * Draw period field with border - left aligned
 */
function drawPeriodField(
    doc: jsPDF,
    periodLabel: string,
    periodValue: string,
    margin: number,
    y: number
): number {
    const fieldWidth = 120;

    // Border box - left aligned
    doc.setDrawColor(...TABLE_BORDER);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, fieldWidth, 8);

    // Label and value
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...BODY_TEXT);
    doc.text(periodLabel, margin + 3, y + 5.5);
    doc.text(periodValue, margin + 50, y + 5.5);

    return y + 15;
}

/**
 * Draw table header row with grey background - left aligned
 */
function drawTableHeader(
    doc: jsPDF,
    columns: { label: string; x: number; width: number }[],
    y: number,
    margin: number,
    contentWidth: number
): number {
    const headerHeight = 8;

    // Grey background
    doc.setFillColor(...DARK_GREY);
    doc.rect(margin, y, contentWidth, headerHeight, "F");

    // Header text - all left aligned
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...WHITE);

    for (const col of columns) {
        doc.text(col.label, col.x + 2, y + 5.5);
    }

    return y + headerHeight;
}

/**
 * Draw table row with optional bottom border - left aligned
 */
function drawTableRow(
    doc: jsPDF,
    cells: { text: string; x: number; width: number }[],
    y: number,
    margin: number,
    contentWidth: number,
    showBorder: boolean = true
): number {
    const rowHeight = 7;

    // Row text - all left aligned
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...BODY_TEXT);

    for (const cell of cells) {
        doc.text(cell.text, cell.x + 2, y + 5);
    }

    // Bottom border
    if (showBorder) {
        doc.setDrawColor(...TABLE_BORDER);
        doc.setLineWidth(0.2);
        doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);
    }

    return y + rowHeight;
}

/**
 * Draw totals row with grey background - left aligned
 */
function drawTotalsRow(
    doc: jsPDF,
    cells: { text: string; x: number; width: number }[],
    y: number,
    margin: number,
    contentWidth: number
): number {
    const rowHeight = 8;

    // Grey background
    doc.setFillColor(...DARK_GREY);
    doc.rect(margin, y, contentWidth, rowHeight, "F");

    // Total text - all left aligned
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...WHITE);

    for (const cell of cells) {
        doc.text(cell.text, cell.x + 2, y + 5.5);
    }

    return y + rowHeight;
}

/**
 * Draw footer with generation info
 */
function drawFooter(doc: jsPDF, pageWidth: number, pageHeight: number): void {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...LIGHT_GREY);
    doc.text(
        `Generated by CashOS on ${new Date().toLocaleDateString("en-NG", { dateStyle: "long" })}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
    );
}

// ============= INTERFACES =============

export interface CashFlowData {
    year: number;
    cashFromOperations: number;
    cashFromInvesting: number;
    cashFromFinancing: number;
}

export interface EquityStatementData {
    year: number;
    openingBalance: number;
    additions: number;
    netIncome: number;
    drawings: number;
    closingBalance: number;
}

export interface FinancialStatementData {
    year: number;
    revenue: number;
    costOfSales: number;
    grossProfit: number;
    operatingExpenses: number;
    netIncome: number;
    assets: number;
    liabilities: number;
    equity: number;
    // Optional cash flow and equity data for complete statements
    cashFlow?: CashFlowData;
    equityStatement?: EquityStatementData;
}

interface TrialBalanceRow {
    code: string;
    name: string;
    debit: number;
    credit: number;
}

interface TrialBalanceData {
    accounts: TrialBalanceRow[];
    totals: { debit: number; credit: number };
}

// ============= PDF GENERATORS =============


/**
 * Generate PDF for Income Statement only
 */
export function generateIncomeStatementPDF(
    data: FinancialStatementData,
    businessName: string = "CashOS Business"
): void {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    let y = drawHeader(doc, businessName, "INCOME STATEMENT", margin);
    y = drawPeriodField(doc, "For Period", `Year Ended ${data.year}`, margin, y);

    // Table columns
    const col1 = margin;
    const col1Width = contentWidth * 0.55;
    const col2 = margin + col1Width;
    const col2Width = contentWidth * 0.22;
    const col3 = col2 + col2Width;
    const col3Width = contentWidth * 0.23;

    const columns = [
        { label: "Account Title", x: col1, width: col1Width },
        { label: "Debit", x: col2, width: col2Width },
        { label: "Credit", x: col3, width: col3Width },
    ];

    y = drawTableHeader(doc, columns, y, margin, contentWidth);

    // Income Statement rows
    const incomeRows: { name: string; debit: string; credit: string }[] = [
        { name: "Revenue", debit: "-", credit: formatCurrency(data.revenue) },
        { name: "Less: Cost of Sales", debit: formatCurrency(data.costOfSales), credit: "-" },
        { name: "Gross Profit", debit: "-", credit: formatCurrency(data.grossProfit) },
        { name: "Less: Operating Expenses", debit: formatCurrency(data.operatingExpenses), credit: "-" },
    ];

    for (const row of incomeRows) {
        y = drawTableRow(doc, [
            { text: row.name, x: col1, width: col1Width },
            { text: row.debit, x: col2, width: col2Width },
            { text: row.credit, x: col3, width: col3Width },
        ], y, margin, contentWidth);
    }

    // Net Income row
    y += 2;
    const netIncomeLabel = data.netIncome >= 0 ? "Net Income" : "Net Loss";
    y = drawTotalsRow(doc, [
        { text: netIncomeLabel, x: col1, width: col1Width },
        { text: "-", x: col2, width: col2Width },
        { text: formatCurrency(Math.abs(data.netIncome)), x: col3, width: col3Width },
    ], y, margin, contentWidth);

    drawFooter(doc, pageWidth, pageHeight);
    doc.save(`income-statement-${data.year}.pdf`);
}

/**
 * Generate PDF for Balance Sheet only
 */
export function generateBalanceSheetPDF(
    data: FinancialStatementData,
    businessName: string = "CashOS Business"
): void {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    let y = drawHeader(doc, businessName, "STATEMENT OF FINANCIAL POSITION", margin);
    y = drawPeriodField(doc, "As at", `31 December ${data.year}`, margin, y);

    // Table columns
    const col1 = margin;
    const col1Width = contentWidth * 0.55;
    const col2 = margin + col1Width;
    const col2Width = contentWidth * 0.22;
    const col3 = col2 + col2Width;
    const col3Width = contentWidth * 0.23;

    const columns = [
        { label: "Account Title", x: col1, width: col1Width },
        { label: "Debit", x: col2, width: col2Width },
        { label: "Credit", x: col3, width: col3Width },
    ];

    y = drawTableHeader(doc, columns, y, margin, contentWidth);

    // Balance Sheet rows
    const balanceRows: { name: string; debit: string; credit: string }[] = [
        { name: "Total Assets", debit: formatCurrency(data.assets), credit: "-" },
        { name: "Total Liabilities", debit: "-", credit: formatCurrency(data.liabilities) },
        { name: "Total Equity", debit: "-", credit: formatCurrency(data.equity) },
    ];

    for (const row of balanceRows) {
        y = drawTableRow(doc, [
            { text: row.name, x: col1, width: col1Width },
            { text: row.debit, x: col2, width: col2Width },
            { text: row.credit, x: col3, width: col3Width },
        ], y, margin, contentWidth);
    }

    y += 2;
    y = drawTotalsRow(doc, [
        { text: "Total", x: col1, width: col1Width },
        { text: formatCurrency(data.assets), x: col2, width: col2Width },
        { text: formatCurrency(data.liabilities + data.equity), x: col3, width: col3Width },
    ], y, margin, contentWidth);

    drawFooter(doc, pageWidth, pageHeight);
    doc.save(`balance-sheet-${data.year}.pdf`);
}

/**
 * Generate PDF for Financial Statements (Income Statement + Balance Sheet)
 */
export function generateFinancialStatementsPDF(
    data: FinancialStatementData,
    businessName: string = "CashOS Business"
): void {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    // ========== PAGE 1: INCOME STATEMENT ==========

    let y = drawHeader(doc, businessName, "INCOME STATEMENT", margin);
    y = drawPeriodField(doc, "For Period", `Year Ended ${data.year}`, margin, y);

    // Table columns - left aligned, numbers closer together
    const col1 = margin;
    const col1Width = contentWidth * 0.55;
    const col2 = margin + col1Width;
    const col2Width = contentWidth * 0.22;
    const col3 = col2 + col2Width;
    const col3Width = contentWidth * 0.23;

    const columns = [
        { label: "Account Title", x: col1, width: col1Width },
        { label: "Debit", x: col2, width: col2Width },
        { label: "Credit", x: col3, width: col3Width },
    ];

    y = drawTableHeader(doc, columns, y, margin, contentWidth);

    // Income Statement rows
    const incomeRows: { name: string; debit: string; credit: string }[] = [
        { name: "Revenue", debit: "-", credit: formatCurrency(data.revenue) },
        { name: "Less: Cost of Sales", debit: formatCurrency(data.costOfSales), credit: "-" },
        { name: "Gross Profit", debit: "-", credit: formatCurrency(data.grossProfit) },
        { name: "Less: Operating Expenses", debit: formatCurrency(data.operatingExpenses), credit: "-" },
    ];

    for (const row of incomeRows) {
        y = drawTableRow(doc, [
            { text: row.name, x: col1, width: col1Width },
            { text: row.debit, x: col2, width: col2Width },
            { text: row.credit, x: col3, width: col3Width },
        ], y, margin, contentWidth);
    }

    // Net Income row
    y += 2;
    const netIncomeLabel = data.netIncome >= 0 ? "Net Income" : "Net Loss";
    y = drawTotalsRow(doc, [
        { text: netIncomeLabel, x: col1, width: col1Width },
        { text: "-", x: col2, width: col2Width },
        { text: formatCurrency(Math.abs(data.netIncome)), x: col3, width: col3Width },
    ], y, margin, contentWidth);

    y += 20;

    // ========== BALANCE SHEET SECTION ==========

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...BLACK);
    doc.text("STATEMENT OF FINANCIAL POSITION", margin, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...LIGHT_GREY);
    doc.text(`As at 31 December ${data.year}`, margin, y);
    y += 10;

    y = drawTableHeader(doc, columns, y, margin, contentWidth);

    // Balance Sheet rows
    const balanceRows: { name: string; debit: string; credit: string }[] = [
        { name: "Total Assets", debit: formatCurrency(data.assets), credit: "-" },
        { name: "Total Liabilities", debit: "-", credit: formatCurrency(data.liabilities) },
        { name: "Total Equity", debit: "-", credit: formatCurrency(data.equity) },
    ];

    for (const row of balanceRows) {
        y = drawTableRow(doc, [
            { text: row.name, x: col1, width: col1Width },
            { text: row.debit, x: col2, width: col2Width },
            { text: row.credit, x: col3, width: col3Width },
        ], y, margin, contentWidth);
    }

    y += 2;
    y = drawTotalsRow(doc, [
        { text: "Total", x: col1, width: col1Width },
        { text: formatCurrency(data.assets), x: col2, width: col2Width },
        { text: formatCurrency(data.liabilities + data.equity), x: col3, width: col3Width },
    ], y, margin, contentWidth);

    // ========== PAGE 2: CASH FLOW STATEMENT (if data available) ==========
    if (data.cashFlow) {
        doc.addPage();
        y = drawHeader(doc, businessName, "STATEMENT OF CASH FLOWS", margin);
        y = drawPeriodField(doc, "For Period", `Year Ended ${data.year}`, margin, y);

        const cfCol1 = margin;
        const cfCol1Width = contentWidth * 0.7;
        const cfCol2 = margin + cfCol1Width;
        const cfCol2Width = contentWidth * 0.3;

        const cfColumns = [
            { label: "Description", x: cfCol1, width: cfCol1Width },
            { label: "Amount", x: cfCol2, width: cfCol2Width },
        ];

        y = drawTableHeader(doc, cfColumns, y, margin, contentWidth);

        const cfRows = [
            { name: "Operating Activities", amount: "" },
            { name: "  Net Cash from Operations", amount: formatCurrency(data.cashFlow.cashFromOperations) },
            { name: "Investing Activities", amount: "" },
            { name: "  Net Cash from Investing", amount: formatCurrency(data.cashFlow.cashFromInvesting) },
            { name: "Financing Activities", amount: "" },
            { name: "  Net Cash from Financing", amount: formatCurrency(data.cashFlow.cashFromFinancing) },
        ];

        for (const row of cfRows) {
            y = drawTableRow(doc, [
                { text: row.name, x: cfCol1, width: cfCol1Width },
                { text: row.amount, x: cfCol2, width: cfCol2Width },
            ], y, margin, contentWidth);
        }

        y += 2;
        const netChange = data.cashFlow.cashFromOperations + data.cashFlow.cashFromInvesting + data.cashFlow.cashFromFinancing;
        y = drawTotalsRow(doc, [
            { text: "Net Change in Cash", x: cfCol1, width: cfCol1Width },
            { text: formatCurrency(netChange), x: cfCol2, width: cfCol2Width },
        ], y, margin, contentWidth);
    }

    // ========== PAGE 3: STATEMENT OF CHANGES IN EQUITY (if data available) ==========
    if (data.equityStatement) {
        doc.addPage();
        y = drawHeader(doc, businessName, "STATEMENT OF CHANGES IN EQUITY", margin);
        y = drawPeriodField(doc, "For Period", `Year Ended ${data.year}`, margin, y);

        const eqCol1 = margin;
        const eqCol1Width = contentWidth * 0.7;
        const eqCol2 = margin + eqCol1Width;
        const eqCol2Width = contentWidth * 0.3;

        const eqColumns = [
            { label: "Description", x: eqCol1, width: eqCol1Width },
            { label: "Amount", x: eqCol2, width: eqCol2Width },
        ];

        y = drawTableHeader(doc, eqColumns, y, margin, contentWidth);

        const eqRows = [
            { name: "Opening Balance", amount: formatCurrency(data.equityStatement.openingBalance) },
            { name: "Add: Capital Introduced", amount: formatCurrency(data.equityStatement.additions) },
            { name: "Add: Net Income for the Year", amount: formatCurrency(data.equityStatement.netIncome) },
            { name: "Less: Drawings", amount: `(${formatCurrency(data.equityStatement.drawings)})` },
        ];

        for (const row of eqRows) {
            y = drawTableRow(doc, [
                { text: row.name, x: eqCol1, width: eqCol1Width },
                { text: row.amount, x: eqCol2, width: eqCol2Width },
            ], y, margin, contentWidth);
        }

        y += 2;
        y = drawTotalsRow(doc, [
            { text: "Closing Balance", x: eqCol1, width: eqCol1Width },
            { text: formatCurrency(data.equityStatement.closingBalance), x: eqCol2, width: eqCol2Width },
        ], y, margin, contentWidth);
    }

    drawFooter(doc, pageWidth, pageHeight);
    doc.save(`financial-statements-${data.year}.pdf`);
}

/**
 * Generate PDF for Journal Entries
 */
export function generateJournalsPDF(
    entries: JournalEntry[],
    year: number,
    businessName: string = "CashOS Business"
): void {
    const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;

    let y = drawHeader(doc, businessName, "GENERAL JOURNAL", margin);
    y = drawPeriodField(doc, "For Period", `Year ${year}`, margin, y);

    // Table columns - left aligned, compact spacing for debit/credit
    const col1 = margin;
    const col1Width = 22;   // Date
    const col2 = col1 + col1Width;
    const col2Width = 35;   // Entry ID
    const col3 = col2 + col2Width;
    const col3Width = 90;   // Account
    const col4 = col3 + col3Width;
    const col4Width = 32;   // Debit - closer to Credit
    const col5 = col4 + col4Width;
    const col5Width = 32;   // Credit - closer to Debit
    const col6 = col5 + col5Width;
    const col6Width = contentWidth - col1Width - col2Width - col3Width - col4Width - col5Width;   // Narration

    const columns = [
        { label: "Date", x: col1, width: col1Width },
        { label: "Entry ID", x: col2, width: col2Width },
        { label: "Account", x: col3, width: col3Width },
        { label: "Debit", x: col4, width: col4Width },
        { label: "Credit", x: col5, width: col5Width },
        { label: "Narration", x: col6, width: col6Width },
    ];

    y = drawTableHeader(doc, columns, y, margin, contentWidth);

    // Helper to check if we need a new page
    const checkNewPage = (requiredSpace: number = 25) => {
        if (y > pageHeight - requiredSpace) {
            doc.addPage();
            y = 20;
            y = drawTableHeader(doc, columns, y, margin, contentWidth);
        }
    };

    let totalDebits = 0;
    let totalCredits = 0;

    // Entries
    for (const entry of entries) {
        checkNewPage(entry.lines.length * 7 + 10);

        // First line of entry - with date and narration
        const narration = entry.narration.length > 35 ? entry.narration.substring(0, 32) + "..." : entry.narration;

        // Entry lines - draw all lines without borders first
        let isFirstLine = true;
        const linesCount = entry.lines.length;
        let lineIndex = 0;

        for (const line of entry.lines) {
            const accountName = line.accountName.length > 45 ? line.accountName.substring(0, 42) + "..." : line.accountName;
            const indent = line.credit > 0 ? "  " : "";
            lineIndex++;

            // Only show border after the LAST line of the transaction
            const isLastLineOfEntry = lineIndex === linesCount;

            y = drawTableRow(doc, [
                { text: isFirstLine ? formatDate(entry.date) : "", x: col1, width: col1Width },
                { text: isFirstLine ? entry.id : "", x: col2, width: col2Width },
                { text: `${indent}${line.accountCode} - ${accountName}`, x: col3, width: col3Width },
                { text: line.debit > 0 ? formatCurrency(line.debit) : "-", x: col4, width: col4Width },
                { text: line.credit > 0 ? formatCurrency(line.credit) : "-", x: col5, width: col5Width },
                { text: isFirstLine ? narration : "", x: col6, width: col6Width },
            ], y, margin, contentWidth, isLastLineOfEntry);

            if (line.debit > 0) totalDebits += line.debit;
            if (line.credit > 0) totalCredits += line.credit;

            isFirstLine = false;
        }

        // Small gap after each complete transaction
        y += 1;
    }

    // Totals row
    y += 3;
    y = drawTotalsRow(doc, [
        { text: "Total", x: col1, width: col1Width + col2Width + col3Width },
        { text: "", x: col2, width: 0 },
        { text: "", x: col3, width: 0 },
        { text: formatCurrency(totalDebits), x: col4, width: col4Width },
        { text: formatCurrency(totalCredits), x: col5, width: col5Width },
        { text: "", x: col6, width: col6Width },
    ], y, margin, contentWidth);

    drawFooter(doc, pageWidth, pageHeight);
    doc.save(`journal-entries-${year}.pdf`);
}

/**
 * Generate PDF for Trial Balance
 */
export function generateTrialBalancePDF(
    data: TrialBalanceData,
    asAtDate: string,
    businessName: string = "CashOS Business"
): void {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    let y = drawHeader(doc, businessName, "TRIAL BALANCE", margin);
    y = drawPeriodField(doc, "As at", asAtDate, margin, y);

    // Table columns - left aligned, numbers closer together
    const col1 = margin;
    const col1Width = contentWidth * 0.55;
    const col2 = margin + col1Width;
    const col2Width = contentWidth * 0.22;
    const col3 = col2 + col2Width;
    const col3Width = contentWidth * 0.23;

    const columns = [
        { label: "Account Title", x: col1, width: col1Width },
        { label: "Debit", x: col2, width: col2Width },
        { label: "Credit", x: col3, width: col3Width },
    ];

    y = drawTableHeader(doc, columns, y, margin, contentWidth);

    // Helper to check if we need a new page
    const checkNewPage = (requiredSpace: number = 25) => {
        if (y > pageHeight - requiredSpace) {
            doc.addPage();
            y = 20;
            y = drawTableHeader(doc, columns, y, margin, contentWidth);
        }
    };

    // Account rows
    for (const row of data.accounts) {
        checkNewPage();

        const accountDisplay = row.name.length > 50 ? row.name.substring(0, 47) + "..." : row.name;

        y = drawTableRow(doc, [
            { text: `${row.code} - ${accountDisplay}`, x: col1, width: col1Width },
            { text: row.debit > 0 ? formatCurrency(row.debit) : "-", x: col2, width: col2Width },
            { text: row.credit > 0 ? formatCurrency(row.credit) : "-", x: col3, width: col3Width },
        ], y, margin, contentWidth);
    }

    // Totals row
    y += 3;
    y = drawTotalsRow(doc, [
        { text: "Total", x: col1, width: col1Width },
        { text: formatCurrency(data.totals.debit), x: col2, width: col2Width },
        { text: formatCurrency(data.totals.credit), x: col3, width: col3Width },
    ], y, margin, contentWidth);

    // Balance check indicator
    y += 10;
    const isBalanced = Math.abs(data.totals.debit - data.totals.credit) < 0.01;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    if (isBalanced) {
        doc.setTextColor(34, 139, 34); // Green
        doc.text("✓ Trial Balance is balanced", margin, y);
    } else {
        doc.setTextColor(220, 20, 60); // Red
        doc.text("✗ Trial Balance is NOT balanced", margin, y);
        y += 5;
        doc.setFontSize(9);
        doc.text(`Difference: ${formatCurrency(Math.abs(data.totals.debit - data.totals.credit))}`, margin, y);
    }

    drawFooter(doc, pageWidth, pageHeight);
    doc.save(`trial-balance-${asAtDate.replace(/\s/g, "-")}.pdf`);
}

/**
 * Generate PDF for Cash Flow Statement only
 */
export function generateCashFlowStatementPDF(
    data: CashFlowData,
    businessName: string = "CashOS Business"
): void {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    let y = drawHeader(doc, businessName, "STATEMENT OF CASH FLOWS", margin);
    y = drawPeriodField(doc, "For Period", `Year Ended ${data.year}`, margin, y);

    // Table columns
    const col1 = margin;
    const col1Width = contentWidth * 0.7;
    const col2 = margin + col1Width;
    const col2Width = contentWidth * 0.3;

    const columns = [
        { label: "Description", x: col1, width: col1Width },
        { label: "Amount", x: col2, width: col2Width },
    ];

    y = drawTableHeader(doc, columns, y, margin, contentWidth);

    // Cash Flow rows
    const rows = [
        { name: "Operating Activities", amount: "" },
        { name: "  Net Cash from Operations", amount: formatCurrency(data.cashFromOperations) },
        { name: "Investing Activities", amount: "" },
        { name: "  Net Cash from Investing", amount: formatCurrency(data.cashFromInvesting) },
        { name: "Financing Activities", amount: "" },
        { name: "  Net Cash from Financing", amount: formatCurrency(data.cashFromFinancing) },
    ];

    for (const row of rows) {
        y = drawTableRow(doc, [
            { text: row.name, x: col1, width: col1Width },
            { text: row.amount, x: col2, width: col2Width },
        ], y, margin, contentWidth);
    }

    // Net Change row
    y += 2;
    const netChange = data.cashFromOperations + data.cashFromInvesting + data.cashFromFinancing;
    y = drawTotalsRow(doc, [
        { text: "Net Change in Cash", x: col1, width: col1Width },
        { text: formatCurrency(netChange), x: col2, width: col2Width },
    ], y, margin, contentWidth);

    drawFooter(doc, pageWidth, pageHeight);
    doc.save(`cash-flow-statement-${data.year}.pdf`);
}

/**
 * Generate PDF for Statement of Changes in Equity only
 */
export function generateEquityStatementPDF(
    data: EquityStatementData,
    businessName: string = "CashOS Business"
): void {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    let y = drawHeader(doc, businessName, "STATEMENT OF CHANGES IN EQUITY", margin);
    y = drawPeriodField(doc, "For Period", `Year Ended ${data.year}`, margin, y);

    // Table columns
    const col1 = margin;
    const col1Width = contentWidth * 0.7;
    const col2 = margin + col1Width;
    const col2Width = contentWidth * 0.3;

    const columns = [
        { label: "Description", x: col1, width: col1Width },
        { label: "Amount", x: col2, width: col2Width },
    ];

    y = drawTableHeader(doc, columns, y, margin, contentWidth);

    // Equity Statement rows
    const rows = [
        { name: "Opening Balance", amount: formatCurrency(data.openingBalance) },
        { name: "Add: Capital Introduced", amount: formatCurrency(data.additions) },
        { name: "Add: Net Income for the Year", amount: formatCurrency(data.netIncome) },
        { name: "Less: Drawings", amount: `(${formatCurrency(data.drawings)})` },
    ];

    for (const row of rows) {
        y = drawTableRow(doc, [
            { text: row.name, x: col1, width: col1Width },
            { text: row.amount, x: col2, width: col2Width },
        ], y, margin, contentWidth);
    }

    // Closing Balance row
    y += 2;
    y = drawTotalsRow(doc, [
        { text: "Closing Balance", x: col1, width: col1Width },
        { text: formatCurrency(data.closingBalance), x: col2, width: col2Width },
    ], y, margin, contentWidth);

    drawFooter(doc, pageWidth, pageHeight);
    doc.save(`equity-statement-${data.year}.pdf`);
}

export function generateAccountingPackagePDF(
    statements: FinancialStatementData,
    journals: JournalEntry[],
    trialBalance: TrialBalanceData,
    businessName: string = "CashOS Business"
): void {
    // For now, generate individual PDFs
    // In the future, could combine into single PDF with multiple sections
    generateFinancialStatementsPDF(statements, businessName);
}

/**
 * Tax Payables Data Interface - Based on 2026 Nigerian Tax Laws
 */
export interface TaxPayablesData {
    year: number;
    revenue: number;
    payrollExpenses: number;
    netProfit: number;
    vatPayable: number;
    whtPayable: number;
    payePayable: number;
    citPayable: number;
    developmentLevy: number;
    totalTaxPayable: number;
}

/**
 * Generate PDF for Tax Payables Report
 * Based on 2026 Nigerian Tax Laws:
 * - VAT: 7.5% on taxable supplies
 * - WHT: 5-10% on various payments
 * - PAYE: Progressive rates (0% up to ₦800K, max 25%)
 * - CIT: 30% on profits (small companies exempt)
 * - Development Levy: 4% on assessable profits
 */
import { TaxPayablesSchedule } from "./accounting/transactionTaxAnalyzer";

/**
 * Generate PDF for Tax Payables Report
 * Based on 2026 Nigerian Tax Laws with Traceable Schedule
 */
/**
 * Generate PDF for Tax Payables Report
 * Based on 2026 Nigerian Tax Laws with Traceable Schedule
 */
export function generateTaxPayablesPDF(
    schedule: TaxPayablesSchedule,
    businessName: string = "CashOS Business"
): void {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    let y = drawHeader(doc, businessName, "TAX PAYABLES SCHEDULE", margin);
    y = drawPeriodField(doc, "As At", schedule.asAtDate, margin, y);

    // Add legal reference
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...LIGHT_GREY);
    doc.text("Based on 2026 Nigerian Tax Laws (Nigeria Tax Reform Acts)", margin, y);
    y += 8;

    // Table columns for summaries
    const col1 = margin;
    const col1Width = contentWidth * 0.6;
    const col2 = margin + col1Width;
    const col2Width = contentWidth * 0.4;

    // === SECTION 1: FINANCIAL PERIOD SUMMARY ===
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BLACK);
    doc.text("1. Financial Period Summary (Accounting Basis)", margin, y);
    y += 6;

    const financialRows = [
        { name: "Total Revenue", amount: formatCurrency(schedule.periodSummary.totalRevenue) },
        { name: "Total Expenses", amount: formatCurrency(schedule.periodSummary.totalExpenses) },
        { name: "Payroll Costs", amount: formatCurrency(schedule.periodSummary.payrollExpense) },
        { name: "Net Profit (Before Tax)", amount: formatCurrency(schedule.periodSummary.netProfitBeforeTax) },
    ];

    doc.setFont("helvetica", "normal");
    for (const row of financialRows) {
        y = drawTableRow(doc, [
            { text: row.name, x: col1, width: col1Width },
            { text: row.amount, x: col2, width: col2Width },
        ], y, margin, contentWidth);
    }
    y += 8;

    // === SECTION 2: PERIOD TAX ASSESSMENT ===
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BLACK);
    doc.text("2. Period Tax Assessment (Direct Taxes)", margin, y);
    y += 6;

    const periodRows = [
        {
            name: `Company Income Tax (CIT) ${schedule.periodTaxes.citAssessment.applies ? '' : '(Exempt/None)'}`,
            amount: formatCurrency(schedule.summary.citPayable)
        },
        {
            name: `Development Levy ${schedule.periodTaxes.devLevyAssessment.applies ? '' : '(Exempt/None)'}`,
            amount: formatCurrency(schedule.summary.developmentLevy)
        },
        {
            name: "PAYE Liability (Estimated)",
            amount: formatCurrency(schedule.summary.payePayable)
        },
    ];

    for (const row of periodRows) {
        y = drawTableRow(doc, [
            { text: row.name, x: col1, width: col1Width },
            { text: row.amount, x: col2, width: col2Width },
        ], y, margin, contentWidth);
    }
    y += 8;

    // === SECTION 3: TRANSACTION TAX SUMMARY ===
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BLACK);
    doc.text("3. Transaction Tax Summary (Indirect Taxes)", margin, y);
    y += 6;

    const txSummaryRows = [
        { name: "Value Added Tax (VAT)", amount: formatCurrency(schedule.summary.vatPayable) },
        { name: "Withholding Tax (WHT)", amount: formatCurrency(schedule.summary.whtPayable) },
        { name: "Capital Gains Tax (CGT)", amount: formatCurrency(schedule.summary.cgtPayable) },
    ];

    for (const row of txSummaryRows) {
        y = drawTableRow(doc, [
            { text: row.name, x: col1, width: col1Width },
            { text: row.amount, x: col2, width: col2Width },
        ], y, margin, contentWidth);
    }
    y += 4;

    // Total Summary Row
    y = drawTotalsRow(doc, [
        { text: "TOTAL TAX LIABILITY", x: col1, width: col1Width },
        { text: formatCurrency(schedule.summary.totalPayable), x: col2, width: col2Width },
    ], y, margin, contentWidth);

    y += 10;

    // === SECTION 4: ASSUMPTIONS ===
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...LIGHT_GREY);

    for (const assumption of schedule.assumptions) {
        doc.text(`• ${assumption}`, margin + 2, y);
        y += 4;
    }
    y += 8;

    // === SECTION 5: TRANSACTION TRACE ===
    // If not enough space for header + 1 row, new page
    if (y + 30 > pageHeight) {
        doc.addPage();
        y = margin;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...BLACK);
    doc.text("Transaction Tax Trace (VAT / WHT / CGT)", margin, y);
    y += 6;

    // Trace columns
    const tCol1 = margin;
    const tCol1Width = 20; // Date
    const tCol2 = tCol1 + tCol1Width;
    const tCol2Width = 45; // Narration
    const tCol3 = tCol2 + tCol2Width;
    const tCol3Width = 25; // Amount
    const tCol4 = tCol3 + tCol3Width;
    const tCol4Width = 65; // Tax Impact
    const tCol5 = tCol4 + tCol4Width;
    const tCol5Width = 25; // Payable

    const traceColumns = [
        { label: "Date", x: tCol1, width: tCol1Width },
        { label: "Narration", x: tCol2, width: tCol2Width },
        { label: "Amount", x: tCol3, width: tCol3Width },
        { label: "Applicable Taxes", x: tCol4, width: tCol4Width },
        { label: "Payable", x: tCol5, width: tCol5Width },
    ];

    y = drawTableHeader(doc, traceColumns, y, margin, contentWidth);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...LIGHT_GREY);

    if (schedule.analyses.length === 0) {
        y = drawTableRow(doc, [
            { text: "No transactions found", x: tCol1, width: contentWidth }
        ], y, margin, contentWidth);
    } else {
        for (const analysis of schedule.analyses) {
            // Check for page break
            if (y + 15 > pageHeight - margin) {
                doc.addPage();
                y = margin;
                y = drawTableHeader(doc, traceColumns, y, margin, contentWidth);
                doc.setFontSize(7);
            }

            const applicableTaxes = analysis.taxAssessments.filter(t => t.applies);
            const totalTax = analysis.totalTaxForTransaction;

            const taxImpact = applicableTaxes.length > 0
                ? applicableTaxes.map(t => `${t.taxType} @ ${t.legalRate}`).join(", ")
                : "None";

            y = drawTableRow(doc, [
                { text: new Date(analysis.transactionDate).toLocaleDateString("en-NG"), x: tCol1, width: tCol1Width },
                { text: analysis.transactionNarration.substring(0, 30) + (analysis.transactionNarration.length > 30 ? "..." : ""), x: tCol2, width: tCol2Width },
                { text: formatCurrency(analysis.transactionAmount), x: tCol3, width: tCol3Width },
                { text: taxImpact, x: tCol4, width: tCol4Width },
                { text: totalTax !== 0 ? formatCurrency(totalTax) : "-", x: tCol5, width: tCol5Width },
            ], y, margin, contentWidth);
        }
    }

    drawFooter(doc, pageWidth, pageHeight);
    doc.save(`tax-payables-schedule-${schedule.asAtDate}.pdf`);
}
