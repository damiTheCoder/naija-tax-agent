/**
 * API Route: /api/pdf
 * POST endpoint for generating PDF tax computation sheets
 */

import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { GeneratePdfRequest } from "@/lib/types";

/**
 * Format number as Nigerian Naira currency
 */
function formatCurrency(amount: number): string {
    return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format percentage for display
 */
function formatPercent(rate: number): string {
    return `${(rate * 100).toFixed(1)}%`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body = await request.json() as GeneratePdfRequest;

        const { profile, inputs, result } = body;

        // Validate required data
        if (!profile || !inputs || !result) {
            return NextResponse.json(
                { error: "Profile, inputs, and result are required" },
                { status: 400 }
            );
        }

        // Create PDF document
        const doc = new PDFDocument({
            size: "A4",
            margin: 50,
            info: {
                Title: `Tax Computation - ${result.taxYear}`,
                Author: "NaijaTaxAgent",
                Subject: "Estimated Tax Computation",
                Creator: "NaijaTaxAgent",
            },
        });

        // Collect PDF chunks
        const chunks: Uint8Array[] = [];
        doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));

        // Colors
        const primaryColor = "#1a365d";
        const accentColor = "#2c5282";
        const grayColor = "#4a5568";

        // Header
        doc
            .font("Helvetica-Bold")
            .fontSize(24)
            .fillColor(primaryColor)
            .text("NaijaTaxAgent", { align: "center" });

        doc
            .fontSize(16)
            .fillColor(accentColor)
            .text(`Estimated Tax Computation – ${result.taxYear}`, { align: "center" });

        doc.moveDown(0.5);

        doc
            .fontSize(10)
            .fillColor(grayColor)
            .text(`Generated: ${new Date().toLocaleDateString("en-NG", { dateStyle: "long" })}`, { align: "center" });

        doc.moveDown(1.5);

        // Section: Taxpayer Details
        doc
            .font("Helvetica-Bold")
            .fontSize(14)
            .fillColor(primaryColor)
            .text("TAXPAYER DETAILS");

        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke(accentColor);
        doc.moveDown(0.5);

        doc.font("Helvetica").fontSize(11).fillColor("#000000");

        const details = [
            ["Full Name", profile.fullName],
            ["Business Name", profile.businessName || "N/A"],
            ["Taxpayer Type", profile.taxpayerType === "freelancer" ? "Individual/Freelancer" : "Company/SME"],
            ["Tax Year", result.taxYear.toString()],
            ["State of Residence", profile.stateOfResidence],
            ["VAT Registered", profile.isVATRegistered ? "Yes" : "No"],
        ];

        for (const [label, value] of details) {
            doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
            doc.font("Helvetica").text(value);
        }

        doc.moveDown(1);

        // Section: Financial Inputs
        doc
            .font("Helvetica-Bold")
            .fontSize(14)
            .fillColor(primaryColor)
            .text("FINANCIAL INPUTS");

        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke(accentColor);
        doc.moveDown(0.5);

        doc.font("Helvetica").fontSize(11).fillColor("#000000");

        const inputDetails = [
            ["Gross Revenue", formatCurrency(inputs.grossRevenue)],
            ["Allowable Expenses", formatCurrency(inputs.allowableExpenses)],
        ];

        if (inputs.pensionContributions) {
            inputDetails.push(["Pension Contributions", formatCurrency(inputs.pensionContributions)]);
        }
        if (inputs.nhfContributions) {
            inputDetails.push(["NHF Contributions", formatCurrency(inputs.nhfContributions)]);
        }
        if (inputs.lifeInsurancePremiums) {
            inputDetails.push(["Life Insurance Premiums", formatCurrency(inputs.lifeInsurancePremiums)]);
        }
        if (inputs.otherReliefs) {
            inputDetails.push(["Other Reliefs", formatCurrency(inputs.otherReliefs)]);
        }

        if (profile.taxpayerType === "company") {
            if (inputs.turnover) inputDetails.push(["Turnover", formatCurrency(inputs.turnover)]);
            if (inputs.costOfSales) inputDetails.push(["Cost of Sales", formatCurrency(inputs.costOfSales)]);
            if (inputs.operatingExpenses) inputDetails.push(["Operating Expenses", formatCurrency(inputs.operatingExpenses)]);
            if (inputs.capitalAllowance) inputDetails.push(["Capital Allowance", formatCurrency(inputs.capitalAllowance)]);
        }

        for (const [label, value] of inputDetails) {
            doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
            doc.font("Helvetica").text(value);
        }

        doc.moveDown(1);

        // Section: Tax Breakdown
        doc
            .font("Helvetica-Bold")
            .fontSize(14)
            .fillColor(primaryColor)
            .text("TAX BREAKDOWN");

        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke(accentColor);
        doc.moveDown(0.5);

        // Table header
        const tableTop = doc.y;
        const col1 = 50;
        const col2 = 200;
        const col3 = 320;
        const col4 = 440;

        doc.font("Helvetica-Bold").fontSize(10).fillColor(grayColor);
        doc.text("Band", col1, tableTop);
        doc.text("Rate", col2, tableTop);
        doc.text("Base Amount", col3, tableTop);
        doc.text("Tax Amount", col4, tableTop);

        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#e2e8f0");
        doc.moveDown(0.3);

        doc.font("Helvetica").fontSize(10).fillColor("#000000");

        let yPos = doc.y;
        for (const band of result.bands) {
            doc.text(band.bandLabel, col1, yPos, { width: 140 });
            doc.text(formatPercent(band.rate), col2, yPos);
            doc.text(formatCurrency(band.baseAmount), col3, yPos);
            doc.text(formatCurrency(band.taxAmount), col4, yPos);
            yPos += 18;
        }

        doc.y = yPos;
        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#e2e8f0");
        doc.moveDown(0.5);

        // Total row
        doc.font("Helvetica-Bold").fontSize(11);
        doc.text("TOTAL TAX DUE:", col1, doc.y, { continued: true });
        doc.text("", col3);
        doc.text(formatCurrency(result.totalTaxDue), col4, doc.y - 11);

        doc.moveDown(1);

        // Section: VAT Summary (if applicable)
        if (result.vat) {
            doc
                .font("Helvetica-Bold")
                .fontSize(14)
                .fillColor(primaryColor)
                .text("VAT SUMMARY");

            doc.moveDown(0.3);
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke(accentColor);
            doc.moveDown(0.5);

            doc.font("Helvetica").fontSize(11).fillColor("#000000");

            const vatDetails = [
                ["VAT Rate", formatPercent(result.vat.vatRate)],
                ["Output VAT (on sales)", formatCurrency(result.vat.outputVAT)],
            ];

            if (result.vat.inputVAT !== undefined) {
                vatDetails.push(["Input VAT (on purchases)", formatCurrency(result.vat.inputVAT)]);
            }

            vatDetails.push(["Net VAT Payable", formatCurrency(result.vat.netVATPayable)]);

            for (const [label, value] of vatDetails) {
                doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
                doc.font("Helvetica").text(value);
            }

            doc.moveDown(1);
        }

        // Section: Summary
        doc
            .font("Helvetica-Bold")
            .fontSize(14)
            .fillColor(primaryColor)
            .text("SUMMARY");

        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke(accentColor);
        doc.moveDown(0.5);

        doc.font("Helvetica").fontSize(12).fillColor("#000000");

        doc.font("Helvetica-Bold").text("Taxable Income: ", { continued: true });
        doc.font("Helvetica").text(formatCurrency(result.taxableIncome));

        doc.font("Helvetica-Bold").text("Total Tax Due: ", { continued: true });
        doc.font("Helvetica").text(formatCurrency(result.totalTaxDue));

        doc.font("Helvetica-Bold").text("Effective Tax Rate: ", { continued: true });
        doc.font("Helvetica").text(formatPercent(result.effectiveRate));

        if (result.vat) {
            doc.font("Helvetica-Bold").text("VAT Payable: ", { continued: true });
            doc.font("Helvetica").text(formatCurrency(result.vat.netVATPayable));
        }

        doc.moveDown(1);

        // Section: Notes
        if (result.notes.length > 0) {
            doc
                .font("Helvetica-Bold")
                .fontSize(12)
                .fillColor(primaryColor)
                .text("NOTES");

            doc.moveDown(0.3);

            doc.font("Helvetica").fontSize(10).fillColor(grayColor);

            for (const note of result.notes) {
                doc.text(`• ${note}`);
            }

            doc.moveDown(1);
        }

        // Section: Disclaimer
        doc
            .font("Helvetica-Bold")
            .fontSize(12)
            .fillColor("#c53030")
            .text("DISCLAIMER");

        doc.moveDown(0.3);

        doc.font("Helvetica").fontSize(9).fillColor(grayColor);
        doc.text(
            "This computation is an ESTIMATE generated by software based on simplified rules and does not constitute tax, legal, or financial advice. The figures presented are for informational purposes only and may not reflect your actual tax liability.",
            { align: "justify" }
        );
        doc.moveDown(0.5);
        doc.text(
            "Please confirm all calculations with the Federal Inland Revenue Service (FIRS), your State Board of Internal Revenue (SBIRS), or a qualified tax professional before making any tax-related decisions or filings.",
            { align: "justify" }
        );
        doc.moveDown(0.5);
        doc.text(
            "Tax laws and rates are subject to change. This estimate is based on information available as of the document generation date.",
            { align: "justify" }
        );

        // Footer
        doc.moveDown(2);
        doc.font("Helvetica").fontSize(8).fillColor(grayColor);
        doc.text("Generated by NaijaTaxAgent | https://naijatagent.com", { align: "center" });

        // Finalize PDF
        doc.end();

        // Wait for PDF to be fully generated
        const pdfBuffer = await new Promise<Buffer>((resolve) => {
            doc.on("end", () => {
                resolve(Buffer.concat(chunks));
            });
        });

        // Return PDF response
        const filename = `naijatagent-tax-computation-${result.taxYear}.pdf`;

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Content-Length": pdfBuffer.length.toString(),
            },
        });
    } catch (error) {
        console.error("Error generating PDF:", error);
        return NextResponse.json(
            { error: "Unable to generate PDF. Please try again." },
            { status: 500 }
        );
    }
}
