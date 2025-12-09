/**
 * Client-side PDF Generator for NaijaTaxAgent
 * 
 * Uses jsPDF to generate tax computation PDFs directly in the browser.
 * Font: Times Roman for professional document appearance.
 */

import { jsPDF } from "jspdf";
import {
    UserProfile,
    TaxInputs,
    TaxResult,
    TaxOptimizationResult,
    WHTResult,
    CGTResult,
    TETResult,
    StampDutyResult,
    CompanyLeviesResult
} from "./types";
import { CGT_RATE } from "./taxRules/cgt";
import { TET_RATE } from "./taxRules/tet";

/**
 * Format number as Nigerian Naira currency
 */
function formatCurrency(amount: number): string {
    return `NGN ${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format percentage for display
 */
function formatPercent(rate: number): string {
    return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Generate PDF tax computation sheet
 */
export function generatePDF(
    profile: UserProfile,
    inputs: TaxInputs,
    result: TaxResult,
    optimizations?: TaxOptimizationResult,
    whtResult?: WHTResult,
    cgtResult?: { totalGain: number; totalCGT: number },
    tetResult?: TETResult,
    stampDutyResult?: { documents: StampDutyResult[]; totalDuty: number },
    leviesResult?: CompanyLeviesResult
): void {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    // Page dimensions
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    // Colors
    const primaryColor: [number, number, number] = [26, 54, 93];   // #1a365d
    const accentColor: [number, number, number] = [44, 82, 130];   // #2c5282
    const grayColor: [number, number, number] = [74, 85, 104];     // #4a5568
    const black: [number, number, number] = [0, 0, 0];

    // Line heights for better spacing
    const lineHeight = 7;
    const sectionGap = 12;

    let y = 25;

    // Helper function to check and add new page if needed
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
    doc.text("NaijaTaxAgent", pageWidth / 2, y, { align: "center" });
    y += 10;

    doc.setFont("times", "normal");
    doc.setFontSize(14);
    doc.setTextColor(...accentColor);
    doc.text(`Estimated Tax Computation - ${result.taxYear}`, pageWidth / 2, y, { align: "center" });
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(...grayColor);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-NG", { dateStyle: "long" })}`, pageWidth / 2, y, { align: "center" });
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

    const labelWidth = 50;
    const details: [string, string][] = [
        ["Full Name", profile.fullName],
        ["Business Name", profile.businessName || "N/A"],
        ["Taxpayer Type", profile.taxpayerType === "freelancer" ? "Individual/Freelancer" : "Company/SME"],
        ["Tax Year", result.taxYear.toString()],
        ["State of Residence", profile.stateOfResidence],
        ["VAT Registered", profile.isVATRegistered ? "Yes" : "No"],
    ];

    for (const [label, value] of details) {
        doc.setFont("times", "bold");
        doc.text(`${label}:`, margin, y);
        doc.setFont("times", "normal");
        doc.text(value, margin + labelWidth, y);
        y += lineHeight;
    }
    y += sectionGap - lineHeight;

    // ========== FINANCIAL INPUTS ==========
    checkNewPage();
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...primaryColor);
    doc.text("FINANCIAL INPUTS", margin, y);
    y += 3;

    doc.setDrawColor(...accentColor);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(...black);

    const inputDetails: [string, string][] = [
        ["Gross Revenue", formatCurrency(inputs.grossRevenue)],
        ["Allowable Expenses", formatCurrency(inputs.allowableExpenses)],
    ];

    if (inputs.pensionContributions) inputDetails.push(["Pension Contributions", formatCurrency(inputs.pensionContributions)]);
    if (inputs.nhfContributions) inputDetails.push(["NHF Contributions", formatCurrency(inputs.nhfContributions)]);
    if (inputs.lifeInsurancePremiums) inputDetails.push(["Life Insurance", formatCurrency(inputs.lifeInsurancePremiums)]);
    if (inputs.otherReliefs) inputDetails.push(["Other Reliefs", formatCurrency(inputs.otherReliefs)]);

    for (const [label, value] of inputDetails) {
        doc.setFont("times", "bold");
        doc.text(`${label}:`, margin, y);
        doc.setFont("times", "normal");
        doc.text(value, margin + 55, y);
        y += lineHeight;
    }
    y += sectionGap - lineHeight;

    // ========== TAX BREAKDOWN ==========
    checkNewPage(50);
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...primaryColor);
    doc.text("TAX BREAKDOWN", margin, y);
    y += 3;

    doc.setDrawColor(...accentColor);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Table columns - properly spaced
    const col1 = margin;           // Band
    const col2 = margin + 50;      // Rate
    const col3 = margin + 75;      // Base Amount
    const col4 = margin + 120;     // Tax Amount

    // Table header
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...grayColor);
    doc.text("Band", col1, y);
    doc.text("Rate", col2, y);
    doc.text("Base Amount", col3, y);
    doc.text("Tax Amount", col4, y);
    y += lineHeight;

    // Table rows
    doc.setTextColor(...black);
    doc.setFont("times", "normal");

    for (const band of result.bands) {
        checkNewPage();
        const bandLabel = band.bandLabel.length > 25 ? band.bandLabel.substring(0, 22) + "..." : band.bandLabel;
        doc.text(bandLabel, col1, y);
        doc.text(formatPercent(band.rate), col2, y);
        doc.text(formatCurrency(band.baseAmount), col3, y);
        doc.text(formatCurrency(band.taxAmount), col4, y);
        y += lineHeight;
    }

    // Total row
    y += 2;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFont("times", "bold");
    doc.text("TOTAL TAX DUE:", col1, y);
    doc.text(formatCurrency(result.totalTaxDue), col4, y);
    y += sectionGap;

    // ========== VAT SUMMARY ==========
    if (result.vat) {
        checkNewPage();
        doc.setFont("times", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...primaryColor);
        doc.text("VAT SUMMARY", margin, y);
        y += 3;

        doc.setDrawColor(...accentColor);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        doc.setFontSize(10);
        doc.setTextColor(...black);

        const vatDetails: [string, string][] = [
            ["VAT Rate", formatPercent(result.vat.vatRate)],
            ["Output VAT", formatCurrency(result.vat.outputVAT)],
            ["Net VAT Payable", formatCurrency(result.vat.netVATPayable)],
        ];

        for (const [label, value] of vatDetails) {
            doc.setFont("times", "bold");
            doc.text(`${label}:`, margin, y);
            doc.setFont("times", "normal");
            doc.text(value, margin + 50, y);
            y += lineHeight;
        }
        y += sectionGap - lineHeight;
    }

    // ========== WHT SUMMARY ==========
    if (whtResult && whtResult.calculations.length > 0) {
        checkNewPage(50);
        doc.setFont("times", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...primaryColor);
        doc.text("WITHHOLDING TAX (WHT) SUMMARY", margin, y);
        y += 3;

        doc.setDrawColor(...accentColor);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        // WHT Table columns - properly spaced for A4
        const whtCol1 = margin;            // Payment Type
        const whtCol2 = margin + 55;       // Gross
        const whtCol3 = margin + 95;       // Rate
        const whtCol4 = margin + 115;      // WHT
        const whtCol5 = margin + 145;      // Net

        // Table header
        doc.setFont("times", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...grayColor);
        doc.text("Payment Type", whtCol1, y);
        doc.text("Gross", whtCol2, y);
        doc.text("Rate", whtCol3, y);
        doc.text("WHT", whtCol4, y);
        doc.text("Net", whtCol5, y);
        y += lineHeight;

        // Table rows
        doc.setTextColor(...black);
        doc.setFont("times", "normal");
        doc.setFontSize(9);

        for (const calc of whtResult.calculations) {
            checkNewPage();
            const paymentLabel = calc.paymentDescription.substring(0, 22) + (calc.isResident ? " (R)" : " (NR)");
            doc.text(paymentLabel, whtCol1, y);
            doc.text(formatCurrency(calc.grossAmount), whtCol2, y);
            doc.text(formatPercent(calc.rate), whtCol3, y);
            doc.text(formatCurrency(calc.whtAmount), whtCol4, y);
            doc.text(formatCurrency(calc.netAmount), whtCol5, y);
            y += lineHeight;
        }

        // Total row
        y += 2;
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageWidth - margin, y);
        y += 6;

        doc.setFont("times", "bold");
        doc.setFontSize(10);
        doc.text("TOTAL WHT DEDUCTED:", whtCol1, y);
        doc.text(formatCurrency(whtResult.totalWHTDeducted), whtCol4, y);
        y += sectionGap;
    }

    // ========== CGT SUMMARY ==========
    if (cgtResult && cgtResult.totalGain > 0) {
        checkNewPage(40);
        doc.setFont("times", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...primaryColor);
        doc.text("CAPITAL GAINS TAX (CGT) SUMMARY", margin, y);
        y += 3;

        doc.setDrawColor(...accentColor);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        doc.setFontSize(10);
        doc.setTextColor(...black);

        const cgtDetails: [string, string][] = [
            ["Total Chargeable Gains", formatCurrency(cgtResult.totalGain)],
            ["CGT Rate", formatPercent(CGT_RATE)],
            ["CGT Payable", formatCurrency(cgtResult.totalCGT)],
        ];

        for (const [label, value] of cgtDetails) {
            doc.setFont("times", "bold");
            doc.text(`${label}:`, margin, y);
            doc.setFont("times", "normal");
            doc.text(value, margin + 50, y);
            y += lineHeight;
        }
        y += sectionGap - lineHeight;
    }

    // ========== TET SUMMARY ==========
    if (tetResult && tetResult.isApplicable) {
        checkNewPage(40);
        doc.setFont("times", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...primaryColor);
        doc.text("TERTIARY EDUCATION TAX (TET) SUMMARY", margin, y);
        y += 3;

        doc.setDrawColor(...accentColor);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        doc.setFontSize(10);
        doc.setTextColor(...black);

        const tetDetails: [string, string][] = [
            ["Assessable Profit", formatCurrency(tetResult.assessableProfit)],
            ["TET Rate", formatPercent(TET_RATE)],
            ["TET Payable", formatCurrency(tetResult.tetPayable)],
        ];

        for (const [label, value] of tetDetails) {
            doc.setFont("times", "bold");
            doc.text(`${label}:`, margin, y);
            doc.setFont("times", "normal");
            doc.text(value, margin + 50, y);
            y += lineHeight;
        }
        y += sectionGap - lineHeight;
    }

    // ========== STAMP DUTY SUMMARY ==========
    if (stampDutyResult && stampDutyResult.totalDuty > 0) {
        checkNewPage(50);
        doc.setFont("times", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...primaryColor);
        doc.text("STAMP DUTIES SUMMARY", margin, y);
        y += 3;

        doc.setDrawColor(...accentColor);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        // Table columns
        const sdCol1 = margin;
        const sdCol2 = margin + 80;
        const sdCol3 = margin + 120;
        const sdCol4 = margin + 145;

        // Header
        doc.setFont("times", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...grayColor);
        doc.text("Document Type", sdCol1, y);
        doc.text("Value", sdCol2, y);
        doc.text("Rate", sdCol3, y);
        doc.text("Duty", sdCol4, y);
        y += lineHeight;

        // Rows
        doc.setTextColor(...black);
        doc.setFont("times", "normal");

        for (const docItem of stampDutyResult.documents) {
            checkNewPage();
            doc.text(docItem.documentDescription.substring(0, 35), sdCol1, y);
            doc.text(formatCurrency(docItem.transactionValue), sdCol2, y);
            doc.text(docItem.rate, sdCol3, y);
            doc.text(formatCurrency(docItem.stampDuty), sdCol4, y);
            y += lineHeight;
        }

        // Total
        y += 2;
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageWidth - margin, y);
        y += 6;

        doc.setFont("times", "bold");
        doc.setFontSize(10);
        doc.text("TOTAL STAMP DUTIES:", sdCol1, y);
        doc.text(formatCurrency(stampDutyResult.totalDuty), sdCol4, y);
        y += sectionGap;
    }

    // ========== COMPANY LEVIES SUMMARY ==========
    if (leviesResult && leviesResult.totalLevies > 0) {
        checkNewPage(60);
        doc.setFont("times", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...primaryColor);
        doc.text("COMPANY LEVIES SUMMARY", margin, y);
        y += 3;

        doc.setDrawColor(...accentColor);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        // Table columns
        const lvyCol1 = margin;
        const lvyCol2 = margin + 70;
        const lvyCol3 = margin + 95;
        const lvyCol4 = margin + 130;

        // Header
        doc.setFont("times", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...grayColor);
        doc.text("Levy Type", lvyCol1, y);
        doc.text("Rate", lvyCol2, y);
        doc.text("Amount Payable", lvyCol3, y);
        doc.text("Status", lvyCol4, y);
        y += lineHeight;

        // Rows
        doc.setTextColor(...black);
        doc.setFont("times", "normal");

        const levies = [
            { name: "Police Trust Fund", data: leviesResult.policeLevy },
            { name: "NASENI Levy", data: leviesResult.naseniLevy },
            { name: "NSITF Contribution", data: leviesResult.nsitf }, // NSITF/ITF structure slightly different but fields match enough for display
            { name: "ITF Levy", data: leviesResult.itf },
        ];

        for (const levy of levies) {
            // Check if applicable - NSITF always applicable if calculated, others implement check
            // For NSITFResult, we treat it as applicable if contribution > 0
            const isApplicable = 'isApplicable' in levy.data ? levy.data.isApplicable : (levy.data as any).contributionPayable > 0;
            const amount = 'levyPayable' in levy.data ? levy.data.levyPayable : (levy.data as any).contributionPayable;

            doc.text(levy.name, lvyCol1, y);
            doc.text(formatPercent(levy.data.rate), lvyCol2, y);
            doc.text(formatCurrency(amount), lvyCol3, y);
            doc.text(isApplicable ? "Applicable" : "Not Applicable", lvyCol4, y);
            y += lineHeight;
        }

        // Total
        y += 2;
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageWidth - margin, y);
        y += 6;

        doc.setFont("times", "bold");
        doc.setFontSize(10);
        doc.text("TOTAL LEVIES:", lvyCol1, y);
        doc.text(formatCurrency(leviesResult.totalLevies), lvyCol3, y);
        y += sectionGap;
    }

    // ========== SUMMARY ==========
    checkNewPage();
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...primaryColor);
    doc.text("SUMMARY", margin, y);
    y += 3;

    doc.setDrawColor(...accentColor);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(11);
    doc.setTextColor(...black);

    const summaryDetails: [string, string][] = [
        ["Taxable Income", formatCurrency(result.taxableIncome)],
        ["Total Tax Due", formatCurrency(result.totalTaxDue)],
        ["Effective Tax Rate", formatPercent(result.effectiveRate)],
    ];

    for (const [label, value] of summaryDetails) {
        doc.setFont("times", "bold");
        doc.text(`${label}:`, margin, y);
        doc.setFont("times", "normal");
        doc.text(value, margin + 55, y);
        y += lineHeight + 1;
    }
    y += sectionGap;

    // ========== TAX OPTIMIZATION TIPS ==========
    if (optimizations && optimizations.suggestions.length > 0) {
        checkNewPage(40);
        doc.setFont("times", "bold");
        doc.setFontSize(12);
        doc.setTextColor(5, 150, 105); // green
        doc.text("TAX OPTIMIZATION TIPS", margin, y);
        y += 3;

        doc.setDrawColor(5, 150, 105);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        doc.setFontSize(10);
        doc.setTextColor(...black);

        for (const suggestion of optimizations.suggestions.slice(0, 3)) {
            checkNewPage(20);
            doc.setFont("times", "bold");
            doc.text(`- ${suggestion.title}`, margin, y);
            y += lineHeight;
            doc.setFont("times", "normal");

            // Wrap long text properly
            const lines = doc.splitTextToSize(suggestion.description, contentWidth - 5);
            doc.text(lines, margin + 5, y);
            y += lines.length * 5 + 4;
        }
        y += 5;
    }

    // ========== DISCLAIMER ==========
    checkNewPage(35);
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.setTextColor(180, 50, 50); // red
    doc.text("DISCLAIMER", margin, y);
    y += 7;

    doc.setFont("times", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...grayColor);

    const disclaimerText = "This computation is an ESTIMATE generated by software based on simplified rules and does not constitute tax, legal, or financial advice. Please confirm all calculations with the Federal Inland Revenue Service (FIRS), your State Board of Internal Revenue (SBIRS), or a qualified tax professional before making any tax-related decisions or filings.";

    const disclaimerLines = doc.splitTextToSize(disclaimerText, contentWidth);
    doc.text(disclaimerLines, margin, y);
    y += disclaimerLines.length * 5 + 10;

    // ========== FOOTER ==========
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.text("Generated by NaijaTaxAgent", pageWidth / 2, pageHeight - 15, { align: "center" });

    // Save the PDF
    doc.save(`naijatagent-tax-computation-${result.taxYear}.pdf`);
}
