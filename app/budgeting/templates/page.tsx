"use client";

import { useState } from "react";
import Link from "next/link";
import { formatNairaCompact } from "@/lib/budgeting/engine";
import { useBudgetingData } from "@/lib/budgeting/useBudgetingData";

export default function BudgetTemplatesPage() {
  const { isReady, templates, createFromTemplate } = useBudgetingData();
  const [createdMessage, setCreatedMessage] = useState<string | null>(null);

  if (!isReady) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading templates...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Budget Templates</h1>
        <p className="text-sm text-gray-500">Pre-built templates you can reuse for faster budget setup.</p>
      </div>

      {createdMessage ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{createdMessage}</div> : null}

      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => (
          <div key={template.id} className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">{template.name}</h2>
            <p className="mt-1 text-sm text-gray-500">{template.description}</p>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Period</p>
                <p className="mt-1 font-semibold text-gray-900">{template.period}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Default Amount</p>
                <p className="mt-1 font-semibold text-gray-900">{formatNairaCompact(template.defaultAmount)}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2 border-t border-gray-200 pt-3 text-sm text-gray-700">
              {template.categories.map((category) => (
                <div key={`${template.id}-${category.category}`} className="flex items-center justify-between">
                  <span>{category.category}</span>
                  <span className="font-medium">{Math.round(category.share * 100)}%</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  createFromTemplate(template.id);
                  setCreatedMessage(`${template.name} created in Budgets.`);
                }}
                className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Use Template
              </button>
              <Link href="/budgeting/budgets" className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                View Budgets
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
