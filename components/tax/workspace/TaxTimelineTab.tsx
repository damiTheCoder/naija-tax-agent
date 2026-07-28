"use client";

import { formatCurrency, formatCurrencyFull, formatDate, type TimelineTransactionGroup } from "@/components/tax/workspace/shared";

type TaxTimelineTabProps = {
  timelineGroups: TimelineTransactionGroup[];
  ledgerEntryCount: number;
  selectedYear: number;
  onOpenDocuments: () => void;
};

export default function TaxTimelineTab({
  timelineGroups,
  ledgerEntryCount,
  selectedYear,
  onOpenDocuments,
}: TaxTimelineTabProps) {
  return (
    <div>
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Tax Computation Timeline</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {timelineGroups.length} transaction{timelineGroups.length === 1 ? "" : "s"} • {ledgerEntryCount} tax line{ledgerEntryCount === 1 ? "" : "s"} for {selectedYear}
          </p>
        </div>
      </div>
      {timelineGroups.length === 0 ? (
        <div className="px-6 py-12 text-center text-gray-400">
          <p>No tax ledger activity found for this period</p>
          <button onClick={onOpenDocuments} className="text-xs mt-2 text-[#4a3880] hover:underline">
            Upload documents to start
          </button>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {timelineGroups.map((entry) => (
            <div key={entry.id} className="p-4 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {(entry.transactionId || entry.id).slice(-6)}
                    </span>
                    {entry.lines.map((line) => (
                      <span key={line.id} className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                        {line.taxType} {line.ledger}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm font-medium text-gray-900 mt-1">{entry.description || "Ledger adjustment"}</p>
                </div>
                <span className="text-xs text-gray-400">{formatDate(entry.date)}</span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                <span className="text-xs text-gray-500">
                  Base Amount:{" "}
                  <span className="text-gray-900 font-medium" title={formatCurrencyFull(entry.baseAmount)}>
                    {formatCurrency(entry.baseAmount)}
                  </span>
                </span>
                <div className="text-right">
                  <span className="text-xs text-gray-500 block">Net Tax Ledger Amount</span>
                  <span className="text-sm font-mono font-bold text-gray-900" title={formatCurrencyFull(entry.netTaxAmount)}>
                    {formatCurrency(entry.netTaxAmount)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
