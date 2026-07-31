"use client";

import type { ComplianceStatusStage, TaxSchedule } from "@/lib/tax/compliance";
import {
  formatCurrency,
  formatCurrencyFull,
  type ComplianceStatusEntry,
  type RemittanceAuditRecord,
} from "@/components/tax/workspace/shared";

type TaxSchedulesTabProps = {
  schedules: TaxSchedule[];
  complianceStatuses: ComplianceStatusEntry[];
  isLoadingRemittanceHistory: boolean;
  remittanceHistory: RemittanceAuditRecord[];
  onGenerateRemittance: (schedule: TaxSchedule) => void;
  onGenerateFilingPack: (schedule: TaxSchedule, format: "pdf" | "csv") => void;
  onStatusChange: (schedule: TaxSchedule, stage: ComplianceStatusStage) => void;
  onMarkPaid: (schedule: TaxSchedule) => void;
  onRefreshRemittanceHistory: () => void;
};

export default function TaxSchedulesTab({
  schedules,
  complianceStatuses,
  isLoadingRemittanceHistory,
  remittanceHistory,
  onGenerateRemittance,
  onGenerateFilingPack,
  onStatusChange,
  onMarkPaid,
  onRefreshRemittanceHistory,
}: TaxSchedulesTabProps) {
  return (
    <div>
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="font-semibold text-gray-900">Statutory Schedules</h2>
        <p className="text-xs text-gray-500 mt-0.5">Upcoming tax filing obligations</p>
      </div>
      {schedules.length === 0 ? (
        <div className="px-6 py-12 text-center text-gray-400">
          <p>No active schedules generated</p>
        </div>
      ) : (
        <div>
          <div className="divide-y divide-gray-100">
            {[...schedules].reverse().map((schedule) => {
              const status = complianceStatuses.find(
                (item) => item.period === schedule.period && item.taxType === schedule.taxType
              );

              return (
                <div key={schedule.id} className="p-4 flex items-center justify-between hover:bg-gray-50/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{schedule.taxType} Schedule</h3>
                      <span className="px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 text-xs uppercase tracking-wide font-medium">
                        {status?.stage || schedule.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Period: {schedule.period} • Due: {schedule.dueDate}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900" title={formatCurrencyFull(schedule.totalTax)}>
                      {formatCurrency(schedule.totalTax)}
                    </p>
                    <button
                      type="button"
                      onClick={() => onGenerateRemittance(schedule)}
                      className="text-xs text-[#1e3a8a] hover:underline font-medium mt-1"
                    >
                      Generate Remittance
                    </button>
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onGenerateFilingPack(schedule, "pdf")}
                        className="text-[11px] px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:border-gray-300"
                      >
                        Download PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => onGenerateFilingPack(schedule, "csv")}
                        className="text-[11px] px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:border-gray-300"
                      >
                        Export CSV
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <select
                        value={status?.stage || schedule.status}
                        onChange={(event) => onStatusChange(schedule, event.target.value as ComplianceStatusStage)}
                        className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600"
                      >
                        {["draft", "review", "ready", "filed", "paid", "reconciled"].map((stage) => (
                          <option key={stage} value={stage}>
                            {stage}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => onMarkPaid(schedule)}
                        className="text-xs px-2 py-1 rounded-md border border-emerald-200 text-emerald-700 bg-emerald-50"
                      >
                        Mark Paid
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/40">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">Remittance Audit History</h3>
              <button
                type="button"
                onClick={onRefreshRemittanceHistory}
                className="text-xs text-[#1e3a8a] hover:underline font-medium"
              >
                Refresh
              </button>
            </div>

            {isLoadingRemittanceHistory ? (
              <p className="text-xs text-gray-500 mt-3">Loading remittance history...</p>
            ) : remittanceHistory.length === 0 ? (
              <p className="text-xs text-gray-500 mt-3">No remittance records yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {remittanceHistory.slice(0, 8).map((record) => (
                  <div key={record.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] sm:text-xs font-mono text-gray-700">{record.paymentReference}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {record.taxType} • {record.period} • Due {record.dueDate}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-gray-900" title={formatCurrencyFull(record.taxAmount)}>
                          {formatCurrency(record.taxAmount)}
                        </p>
                        <p className="text-[11px] text-gray-400">{record.createdAt.slice(0, 16).replace("T", " ")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
