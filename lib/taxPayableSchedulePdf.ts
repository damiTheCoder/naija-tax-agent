/**
 * Tax Payable Schedule PDF Generator
 * 
 * Generates a professional PDF export of tax payable schedules
 * derived from financial statements and accounting records.
 */

import { jsPDF } from "jspdf";
import { TaxScheduleEntry, TaxComputationResult } from "./tax/taxEngine";
import { CONFIDENCE_INDICATORS, TaxConfidenceLevel } from "./ai/nigerianTaxAgentPrompt";
import { configureJsPdfTypography } from "@/lib/pdf/jspdfTypography";

/**
 * Format number as Nigerian Naira currency
 */
function formatCurrency(amount: number): string {
    return `₦${Math.abs(amount).toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

/**
 * Tax Payable Schedule data structure
 */
export interface TaxPayableScheduleData {
    taxpayerName: string;
    businessName?: string;
    taxYear: number;
    period: string;
    generatedDate: string;
    schedules: TaxScheduleEntry[];
    computations: TaxComputationResult[];
    summary: {
        totalVAT: number;
        totalWHT: number;
        totalCGT: number;
        totalStampDuty: number;
        totalOtherTaxes: number;
        grandTotal: number;
        inputVATCredit: number;
        netVATPayable: number;
    };
    confidence: TaxConfidenceLevel;
    warnings?: string[];
    assumptions?: string[];
}

/**
 * Generate Tax Payable Schedule PDF
 */
export async function generateTaxPayableSchedulePDF(data: TaxPayableScheduleData): Promise<void> {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });
    await configureJsPdfTypography(doc, "times");

    // Page dimensions
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    // Colors
    const primaryColor: [number, number, number] = [26, 54, 93]; // #1a365d
    const accentColor: [number, number, number] = [44, 82, 130]; // #2c5282
    const grayColor: [number, number, number] = [74, 85, 104]; // #4a5568
    const black: [number, number, number] = [0, 0, 0];
    const greenColor: [number, number, number] = [16, 185, 129]; // #10b981
    const yellowColor: [number, number, number] = [245, 158, 11]; // #f59e0b
    const redColor: [number, number, number] = [239, 68, 68]; // #ef4444

    const lineHeight = 7;
    const sectionGap = 12;
    let y = 25;

    const checkNewPage = (requiredSpace: number = 30) => {
        if (y > pageHeight - requiredSpace) {
            doc.addPage();
            y = 25;
        }
    };

    // ========== HEADER ==========
    doc.setFont("times", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...primaryColor);
    doc.text("Atom Ledger", pageWidth / 2, y, { align: "center" });
    y += 10;

    doc.setFont("times", "normal");
    doc.setFontSize(16);
    doc.setTextColor(...accentColor);
    doc.text("TAX PAYABLE SCHEDULE", pageWidth / 2, y, { align: "center" });
    y += 8;

    doc.setFontSize(12);
    doc.text(`Tax Year: ${data.taxYear}`, pageWidth / 2, y, { align: "center" });
    y += 6;

    doc.setFontSize(10);
    doc.setTextColor(...grayColor);
    doc.text(`Generated: ${data.generatedDate}`, pageWidth / 2, y, { align: "center" });
    y += sectionGap;

    // ========== CONFIDENCE STATUS ==========
    const confidence = CONFIDENCE_INDICATORS[data.confidence];
    const statusColor =
        data.confidence === "complete"
            ? greenColor
            : data.confidence === "assumptive"
                ? yellowColor
                : redColor;

    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...statusColor);
    doc.text(
        `Status: ${confidence.emoji} ${confidence.label} — ${confidence.description}`,
        pageWidth / 2,
        y,
        { align: "center" }
    );
    y += sectionGap;

    // ========== TAXPAYER DETAILS ==========
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...primaryColor);
    doc.text("TAXPAYER DETAILS", margin, y);
    y += 3;

    doc.setDrawColor(...accentColor);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(...black);

    const details: [string, string][] = [
        ["Taxpayer Name:", data.taxpayerName || "N/A"],
        ["Business Name:", data.businessName || "N/A"],
        ["Tax Year:", data.taxYear.toString()],
        ["Period:", data.period],
    ];

    for (const [label, value] of details) {
        doc.setFont("times", "bold");
        doc.text(label, margin, y);
        doc.setFont("times", "normal");
        doc.text(value, margin + 45, y);
        y += lineHeight;
    }
    y += sectionGap - lineHeight;

    // ========== TAX PAYABLE SUMMARY ==========
    checkNewPage(60);
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...primaryColor);
    doc.text("TAX PAYABLE SUMMARY", margin, y);
    y += 3;

    doc.setDrawColor(...accentColor);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Summary table headers
    const col1 = margin;
    const col2 = margin + 80;
    const col3 = margin + 130;

    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...grayColor);
    doc.text("Tax Type", col1, y);
    doc.text("Amount Payable", col2, y);
    doc.text("Status", col3, y);
    y += lineHeight;

    doc.setTextColor(...black);
    doc.setFont("times", "normal");

    const summaryRows: [string, number, string][] = [
        ["Value Added Tax (VAT)", data.summary.netVATPayable, "Pending"],
        ["Withholding Tax (WHT)", data.summary.totalWHT, "Pending"],
        ["Capital Gains Tax (CGT)", data.summary.totalCGT, "Pending"],
        ["Stamp Duties", data.summary.totalStampDuty, "Pending"],
        ["Other Taxes/Levies", data.summary.totalOtherTaxes, "Pending"],
    ];

    for (const [taxType, amount, status] of summaryRows) {
        if (amount > 0) {
            doc.text(taxType, col1, y);
            doc.text(formatCurrency(amount), col2, y);
            doc.text(status, col3, y);
            y += lineHeight;
        }
    }

    // Total row
    y += 2;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.text("TOTAL TAX PAYABLE:", col1, y);
    doc.text(formatCurrency(data.summary.grandTotal), col2, y);
    y += sectionGap;

    // ========== VAT BREAKDOWN ==========
    if (data.summary.totalVAT > 0 || data.summary.inputVATCredit > 0) {
        checkNewPage(50);
        doc.setFont("times", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...primaryColor);
        doc.text("VAT BREAKDOWN", margin, y);
        y += 3;

        doc.setDrawColor(...accentColor);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        doc.setFontSize(10);
        doc.setTextColor(...black);

        const vatDetails: [string, string][] = [
            ["Output VAT (Collected)", formatCurrency(data.summary.totalVAT)],
            ["Input VAT (Credit)", formatCurrency(data.summary.inputVATCredit)],
            ["Net VAT Payable", formatCurrency(data.summary.netVATPayable)],
        ];

        for (const [label, value] of vatDetails) {
            doc.setFont("times", "bold");
            doc.text(label + ":", margin, y);
            doc.setFont("times", "normal");
            doc.text(value, margin + 55, y);
            y += lineHeight;
        }
        y += sectionGap - lineHeight;
    }

    // ========== SCHEDULE DETAILS ==========
    if (data.schedules.length > 0) {
        checkNewPage(60);
        doc.setFont("times", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...primaryColor);
        doc.text("TAX SCHEDULE DETAILS", margin, y);
        y += 3;

        doc.setDrawColor(...accentColor);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        // Table headers
        const schedCol1 = margin;
        const schedCol2 = margin + 35;
        const schedCol3 = margin + 70;
        const schedCol4 = margin + 105;
        const schedCol5 = margin + 140;

        doc.setFont("times", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...grayColor);
        doc.text("Tax Type", schedCol1, y);
        doc.text("Period", schedCol2, y);
        doc.text("Gross Amount", schedCol3, y);
        doc.text("Tax Amount", schedCol4, y);
        doc.text("Due Date", schedCol5, y);
        y += lineHeight;

        doc.setTextColor(...black);
        doc.setFont("times", "normal");

        for (const schedule of data.schedules) {
            checkNewPage();
            doc.text(schedule.taxType, schedCol1, y);
            doc.text(schedule.period, schedCol2, y);
            doc.text(formatCurrency(schedule.grossAmount), schedCol3, y);
            doc.text(formatCurrency(schedule.taxAmount), schedCol4, y);
            doc.text(schedule.dueDate, schedCol5, y);
            y += lineHeight;
        }
        y += sectionGap - lineHeight;
    }

    // ========== WARNINGS (if any) ==========
    if (data.warnings && data.warnings.length > 0) {
        checkNewPage(40);
        doc.setFont("times", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...yellowColor);
        doc.text("⚠️ WARNINGS & RISK FLAGS", margin, y);
        y += 3;

        doc.setDrawColor(...yellowColor);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        doc.setFontSize(10);
        doc.setTextColor(...black);
        doc.setFont("times", "normal");

        for (const warning of data.warnings) {
            checkNewPage(15);
            const lines = doc.splitTextToSize(`• ${warning}`, contentWidth);
            doc.text(lines, margin, y);
            y += lines.length * 5 + 2;
        }
        y += sectionGap - lineHeight;
    }

    // ========== ASSUMPTIONS (if any) ==========
    if (data.assumptions && data.assumptions.length > 0) {
        checkNewPage(40);
        doc.setFont("times", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...grayColor);
        doc.text("ASSUMPTIONS MADE", margin, y);
        y += 3;

        doc.setDrawColor(...grayColor);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        doc.setFontSize(10);
        doc.setTextColor(...black);
        doc.setFont("times", "normal");

        for (const assumption of data.assumptions) {
            checkNewPage(15);
            const lines = doc.splitTextToSize(`• ${assumption}`, contentWidth);
            doc.text(lines, margin, y);
            y += lines.length * 5 + 2;
        }
        y += sectionGap - lineHeight;
    }

    // ========== DISCLAIMER ==========
    checkNewPage(35);
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.setTextColor(180, 50, 50);
    doc.text("DISCLAIMER", margin, y);
    y += 6;

    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...grayColor);

    const disclaimer = `This Tax Payable Schedule is generated based on the financial data provided and Nigerian tax laws applicable for the ${data.taxYear} tax year. This is an estimate only and should be reviewed by a qualified tax professional before filing. Atom Ledger and its developers are not liable for any errors, omissions, or tax liabilities arising from the use of this document. All tax figures must be reconciled back to the underlying financial statements.`;

    const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth);
    doc.text(disclaimerLines, margin, y);
    y += disclaimerLines.length * 4 + 10;

    // ========== FOOTER ==========
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(...grayColor);
        doc.text(
            `Page ${i} of ${totalPages} | Generated by Atom Ledger Tax Engine`,
            pageWidth / 2,
            pageHeight - 10,
            { align: "center" }
        );
    }

    // Save the PDF
    const filename = `Tax_Payable_Schedule_${data.taxYear}_${data.period.replace(/\s/g, "_")}.pdf`;
    doc.save(filename);
}
