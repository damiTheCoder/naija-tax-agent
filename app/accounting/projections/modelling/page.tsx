"use client";

import Link from "next/link";
import { FINANCIAL_MODELS, type FinancialModelDefinition } from "@/lib/financial/modellingCatalog";

function ModelIcon({ icon }: { icon: FinancialModelDefinition["icon"] }) {
  const className = "w-5 h-5";

  switch (icon) {
    case "statements":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );
    case "forecast":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M4 18h16M6 15l4-4 3 3 5-6" />
          <circle cx="18" cy="8" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "dcf":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="8" />
          <path d="M9.2 14.8c.7.8 1.8 1.2 2.8 1.2 1.3 0 2.5-.8 2.5-2 0-2.7-5.2-1.6-5.2-4.3 0-1.2 1.1-2 2.4-2 1 0 1.9.3 2.6 1" />
        </svg>
      );
    case "budget":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M4 20h16M7 16V9M12 16V5M17 16v-3" />
        </svg>
      );
    case "startup":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M12 3l3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6z" />
        </svg>
      );
    case "cashflow":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M3 12h14M13 7l4 5-4 5" />
          <path d="M21 6v12" />
        </svg>
      );
    case "breakeven":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M4 18l6-6 3 3 7-8" />
          <path d="M4 20h16" />
        </svg>
      );
    case "scenario":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M4 6h16M4 12h10M4 18h16" />
          <circle cx="17" cy="12" r="2" />
        </svg>
      );
    case "valuation":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M12 3v18M7 8h7a2 2 0 110 4H10a2 2 0 100 4h7" />
        </svg>
      );
    case "unit":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="8" cy="8" r="3" />
          <circle cx="16" cy="16" r="3" />
          <path d="M10.5 10.5l3 3" />
        </svg>
      );
    default:
      return null;
  }
}

export default function FinancialModellingHubPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Financial Modelling</h1>
        <p className="text-sm text-gray-500">
          Select a model type. Each model is a dedicated software view with editable inputs and calculated outputs.
        </p>
        <Link href="/accounting/projections" className="inline-flex text-sm font-medium text-[#2264ff] hover:text-[#1a50cc]">
          Back to Financial Projections
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {FINANCIAL_MODELS.map((model) => (
          <article key={model.id} className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#2264ff]/10 text-[#2264ff]">
                <ModelIcon icon={model.icon} />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-gray-900">{model.name}</h2>
              <p className="mt-1 text-sm text-gray-600">{model.purpose}</p>
              <p className="mt-3 text-sm text-gray-500">{model.description}</p>
            </div>
            <Link
              href={`/accounting/projections/modelling/${model.id}`}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Open Model
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
