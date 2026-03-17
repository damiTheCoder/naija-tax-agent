"use client";

import type { AuditLogEntry, FilingPackResult } from "@/lib/tax/compliance";
import type {
  ChangeEventHandler,
  DragEventHandler,
  RefObject,
} from "react";
import {
  formatCurrency,
  formatCurrencyFull,
  formatFileSize,
  type TaxWorkspacePayment,
  type WorkspaceDocument,
} from "@/components/tax/workspace/shared";

type TaxDocumentsTabProps = {
  dragActive: boolean;
  isUploading: boolean;
  statusMessage: string | null;
  error: string | null;
  documents: WorkspaceDocument[];
  filingPacks: FilingPackResult[];
  auditLogs: AuditLogEntry[];
  payments: TaxWorkspacePayment[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFilesSelected: ChangeEventHandler<HTMLInputElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  onDragEnter: DragEventHandler<HTMLDivElement>;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  onBrowse: () => void;
};

export default function TaxDocumentsTab({
  dragActive,
  isUploading,
  statusMessage,
  error,
  documents,
  filingPacks,
  auditLogs,
  payments,
  fileInputRef,
  onFilesSelected,
  onDrop,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onBrowse,
}: TaxDocumentsTabProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-12 transition-colors ${dragActive ? "bg-blue-50" : "bg-white"}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900">Upload Financial Documents</h3>
      <p className="text-sm text-gray-500 max-w-sm text-center mt-2">
        Drop bank statements (PDF/CSV), audited accounts, or payroll spreadsheets here to auto-extract transactions.
      </p>

      <input
        type="file"
        multiple
        ref={fileInputRef}
        className="hidden"
        onChange={onFilesSelected}
        accept=".csv,.pdf,.xlsx,.xls,.json"
      />

      <button
        onClick={onBrowse}
        disabled={isUploading}
        className="mt-6 px-6 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
      >
        {isUploading ? "Processing..." : "Select Files"}
      </button>

      {statusMessage ? (
        <div className="mt-6 p-4 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 text-sm max-w-md text-center">
          {statusMessage}
        </div>
      ) : null}
      {error ? (
        <div className="mt-6 p-4 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm max-w-md text-center">
          {error}
        </div>
      ) : null}

      {documents.length > 0 ? (
        <div className="mt-12 w-full max-w-2xl">
          <h4 className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-3">Recently Uploaded</h4>
          <div className="grid gap-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(doc.size)} • {new Date(doc.uploadedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">Parsed</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-12 w-full max-w-4xl">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900">Filing Packs</h4>
              <span className="text-xs text-gray-400">{filingPacks.length} generated</span>
            </div>
            {filingPacks.length === 0 ? (
              <p className="text-xs text-gray-500 mt-3">No filing packs generated yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {filingPacks.slice(0, 5).map((pack) => (
                  <div key={pack.id} className="p-2 rounded-lg border border-gray-100 bg-gray-50/60">
                    <p className="text-xs font-medium text-gray-900">{pack.taxType} • {pack.period}</p>
                    <p className="text-[11px] text-gray-500">{pack.fileName}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900">Audit Log</h4>
              <span className="text-xs text-gray-400">{auditLogs.length} entries</span>
            </div>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-gray-500 mt-3">No audit activity logged yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {auditLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="p-2 rounded-lg border border-gray-100 bg-gray-50/60">
                    <p className="text-xs font-medium text-gray-900">{log.action}</p>
                    <p className="text-[11px] text-gray-500">{new Date(log.createdAt).toLocaleString("en-NG")}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">Payments</h4>
            <span className="text-xs text-gray-400">{payments.length} records</span>
          </div>
          {payments.length === 0 ? (
            <p className="text-xs text-gray-500 mt-3">No payments recorded yet.</p>
          ) : (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {payments.slice(0, 6).map((payment) => (
                <div key={payment.id} className="p-3 rounded-lg border border-gray-100 bg-gray-50/60">
                  <p className="text-xs font-semibold text-gray-900">{payment.taxType} • {payment.period}</p>
                  <p className="text-[11px] text-gray-500">
                    <span title={formatCurrencyFull(payment.amount)}>{formatCurrency(payment.amount)}</span> • {payment.status}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
