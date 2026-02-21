import { jsPDF } from "jspdf";
import { configureJsPdfTypography } from "@/lib/pdf/jspdfTypography";
import type { FilingPackResult, TaxSchedule } from "./types";
import { loadFilingPacks, saveFilingPacks } from "./store";
import { recordAuditLog } from "./audit";

const makeId = () => `pack-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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

    doc.setFontSize(18);
    doc.text("Tax Filing Pack", 20, 20);
    doc.setFontSize(12);
    doc.text(`Tax Type: ${params.schedule.taxType}`, 20, 30);
    doc.text(`Period: ${params.schedule.period}`, 20, 38);
    doc.text(`Due Date: ${params.schedule.dueDate}`, 20, 46);
    doc.text(`Total Tax: NGN ${params.schedule.totalTax.toLocaleString()}`, 20, 54);
    doc.text(`Carry Forward: NGN ${params.schedule.carryForward.toLocaleString()}`, 20, 62);

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
