/**
 * Client-side PDF Generator for CashOS
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
    TETResult,
    StampDutyResult,
    CompanyLeviesResult,
    WithholdingCertificate,
} from "./types";
import { CGT_RATE } from "./taxRules/cgt";
import { TET_RATE } from "./taxRules/tet";
import { APP_LOGO_SRC } from "./constants";

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

type LevyEntry = CompanyLeviesResult["policeLevy"]
    | CompanyLeviesResult["naseniLevy"]
    | CompanyLeviesResult["nsitf"]
    | CompanyLeviesResult["itf"];

function levyIsApplicable(data: LevyEntry): boolean {
    if ("isApplicable" in data) {
        return data.isApplicable;
    }
    return data.contributionPayable > 0;
}

function levyAmountPayable(data: LevyEntry): number {
    if ("levyPayable" in data) {
        return data.levyPayable;
    }
    return data.contributionPayable;
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
    leviesResult?: CompanyLeviesResult,
    withholdingCertificates?: WithholdingCertificate[]
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
    const severityColorMap: Record<string, [number, number, number]> = {
        error: [185, 28, 28],
        warning: [202, 138, 4],
        info: [37, 99, 235],
    };

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
    if (typeof document !== "undefined") {
        try {
            const img = document.createElement("img");
            img.src = APP_LOGO_SRC;
            img.onload = () => {
                doc.addImage(img, "PNG", pageWidth / 2 - 12, y - 18, 24, 24);
            };
        } catch {
            // ignore if logo can't load
        }
    }

    doc.text("CashOS", pageWidth / 2, y + 5, { align: "center" });
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

    // ========== TAX RULE METADATA ==========
    const metadata = result.taxRuleMetadata;
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...primaryColor);
    doc.text("TAX RULE DATA SOURCE", margin, y);
    y += 3;

    doc.setDrawColor(...accentColor);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(...black);
    doc.setFont("times", "bold");
    doc.text("Version:", margin, y);
    doc.setFont("times", "normal");
    doc.text(metadata.version, margin + 40, y);
    y += lineHeight;
    doc.setFont("times", "bold");
    doc.text("Source:", margin, y);
    doc.setFont("times", "normal");
    doc.text(metadata.source, margin + 40, y);
    y += lineHeight;
    if (metadata.lastUpdated) {
        doc.setFont("times", "bold");
        doc.text("Last Updated:", margin, y);
        doc.setFont("times", "normal");
        doc.text(new Date(metadata.lastUpdated).toLocaleString(), margin + 40, y);
        y += lineHeight;
    }
    if (metadata.remoteUrl) {
        doc.setFont("times", "bold");
        doc.text("Remote:", margin, y);
        doc.setFont("times", "normal");
        const lines = doc.splitTextToSize(metadata.remoteUrl, contentWidth - 50);
        doc.text(lines, margin + 40, y);
        y += lines.length * 5;
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
    y += lineHeight;

    doc.setFont("times", "bold");
    doc.text("Tax Before Credits:", margin, y);
    doc.setFont("times", "normal");
    doc.text(formatCurrency(result.taxBeforeCredits), margin + 55, y);
    y += lineHeight;

    doc.setFont("times", "bold");
    doc.text("Credits Applied:", margin, y);
    doc.setFont("times", "normal");
    doc.text(formatCurrency(result.taxCreditsApplied), margin + 55, y);
    y += sectionGap - lineHeight;

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
        ];

        if (typeof result.vat.inputVAT === "number") {
            vatDetails.push(["Input VAT", formatCurrency(result.vat.inputVAT)]);
        }

        vatDetails.push(["Net VAT Payable", formatCurrency(result.vat.netVATPayable)]);

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

    if (withholdingCertificates && withholdingCertificates.length > 0) {
        checkNewPage(40);
        doc.setFont("times", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...primaryColor);
        doc.text("WITHHOLDING TAX CERTIFICATES", margin, y);
        y += 3;

        doc.setDrawColor(...accentColor);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        const certCol1 = margin;
        const certCol2 = margin + 60;
        const certCol3 = margin + 110;
        const certCol4 = margin + 140;
        const certCol5 = margin + 170;

        doc.setFont("times", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...grayColor);
        doc.text("Payer", certCol1, y);
        doc.text("Certificate No.", certCol2, y);
        doc.text("Date", certCol3, y);
        doc.text("Amount", certCol4, y);
        doc.text("Attachment", certCol5, y);
        y += lineHeight;

        doc.setTextColor(...black);
        doc.setFont("times", "normal");

        for (const cert of withholdingCertificates) {
            checkNewPage();
            doc.text(cert.payerName.substring(0, 25), certCol1, y);
            doc.text(cert.certificateNumber, certCol2, y);
            doc.text(cert.issueDate, certCol3, y);
            doc.text(formatCurrency(cert.amount), certCol4, y);
            doc.text(cert.fileData ? "Attached" : "Pending", certCol5, y);
            y += lineHeight;
        }
        y += sectionGap - lineHeight;
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

        const levies: { name: string; data: LevyEntry }[] = [
            { name: "Police Trust Fund", data: leviesResult.policeLevy },
            { name: "NASENI Levy", data: leviesResult.naseniLevy },
            { name: "NSITF Contribution", data: leviesResult.nsitf }, // NSITF/ITF structure slightly different but fields match enough for display
            { name: "ITF Levy", data: leviesResult.itf },
        ];

        for (const levy of levies) {
            // Check applicability for each levy. NSITF uses contribution value instead of boolean flag.
            const isApplicable = levyIsApplicable(levy.data);
            const amount = levyAmountPayable(levy.data);

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

    if (result.validationIssues.length > 0) {
        checkNewPage(40);
        doc.setFont("times", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...primaryColor);
        doc.text("DATA QUALITY CHECKS", margin, y);
        y += 3;

        doc.setDrawColor(...accentColor);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        doc.setFontSize(10);
        for (const issue of result.validationIssues) {
            checkNewPage(20);
            const color = severityColorMap[issue.severity] || grayColor;
            doc.setFont("times", "bold");
            doc.setTextColor(...color);
            doc.text(`${issue.severity.toUpperCase()} • ${issue.field}`, margin, y);
            y += lineHeight;
            doc.setFont("times", "normal");
            doc.setTextColor(...black);
            const lines = doc.splitTextToSize(issue.message, contentWidth);
            doc.text(lines, margin, y);
            y += lines.length * 5 + 2;
        }
        y += 4;
    }

    if (result.calculationTrace.length > 0) {
        checkNewPage(40);
        doc.setFont("times", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...primaryColor);
        doc.text("CALCULATION TRACE", margin, y);
        y += 3;

        doc.setDrawColor(...accentColor);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        doc.setFontSize(10);
        doc.setTextColor(...black);

        for (const entry of result.calculationTrace) {
            checkNewPage(18);
            doc.setFont("times", "bold");
            doc.text(`• ${entry.step}`, margin, y);
            y += lineHeight;
            doc.setFont("times", "normal");
            const detailLines = doc.splitTextToSize(entry.detail, contentWidth - 10);
            doc.text(detailLines, margin + 5, y);
            y += detailLines.length * 5;
            if (typeof entry.amount === "number") {
                doc.setFont("times", "italic");
                doc.text(`Amount: ${formatCurrency(entry.amount)}`, margin + 5, y + 2);
                doc.setFont("times", "normal");
                y += lineHeight;
            } else {
                y += 4;
            }
        }
        y += 2;
    }

    if (result.statutoryReferences.length > 0) {
        checkNewPage(40);
        doc.setFont("times", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...primaryColor);
        doc.text("STATUTORY REFERENCES", margin, y);
        y += 3;

        doc.setDrawColor(...accentColor);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        doc.setFontSize(10);
        doc.setTextColor(...black);

        for (const reference of result.statutoryReferences) {
            checkNewPage(15);
            doc.setFont("times", "bold");
            doc.text(`${reference.title} — ${reference.citation}`, margin, y);
            y += lineHeight;
            doc.setFont("times", "normal");
            const lines = doc.splitTextToSize(reference.description, contentWidth);
            doc.text(lines, margin + 5, y);
            y += lines.length * 5 + 2;
        }
        y += 5;
    }

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
    doc.text("Generated by CashOS", pageWidth / 2, pageHeight - 15, { align: "center" });

    // Save the PDF
    doc.save(`cashos-tax-computation-${result.taxYear}.pdf`);
}
