import { notFound } from "next/navigation";
import ModelDetailClient from "./ModelDetailClient";
import { FINANCIAL_MODELS, FINANCIAL_MODELS_BY_ID, isFinancialModelId } from "@/lib/financial/modellingCatalog";

export function generateStaticParams() {
  return FINANCIAL_MODELS.map((model) => ({ model: model.id }));
}

export default async function FinancialModelPage({ params }: { params: Promise<{ model: string }> }) {
  const { model } = await params;

  if (!isFinancialModelId(model) || !FINANCIAL_MODELS_BY_ID[model]) {
    notFound();
  }

  return <ModelDetailClient modelId={model} />;
}
