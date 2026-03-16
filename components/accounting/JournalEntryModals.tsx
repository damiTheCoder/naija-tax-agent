"use client";

type AccountOption = {
  code: string;
  name: string;
};

type JournalEntryFormLine = {
  id: string;
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
};

type JournalEntryTotals = {
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
};

type AuditResult = {
  isValid?: boolean;
  fixed?: boolean;
  reasoning?: string;
  suggestedCorrections?: {
    lines: Array<{
      accountCode: string;
      accountName: string;
      debit: number;
      credit: number;
    }>;
  };
} | null;

type PostJournalEntryModalProps = {
  narration: string;
  date: string;
  lines: JournalEntryFormLine[];
  totals: JournalEntryTotals;
  error: string;
  isAuditing: boolean;
  auditResult: AuditResult;
  allAccountsForSelect: AccountOption[];
  isAgentMirroredAlreadyPosted: boolean;
  agentMirroredEntryId: string | null;
  onClose: () => void;
  onNarrationChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onAddLine: () => void;
  onUpdateLine: (id: string, field: string, value: string) => void;
  onRemoveLine: (id: string) => void;
  onAudit: () => void;
  onApplySuggestion: () => void;
  onSubmit: () => void;
};

type EditJournalEntryModalProps = {
  entryId: string | null;
  narration: string;
  date: string;
  lines: JournalEntryFormLine[];
  totals: JournalEntryTotals;
  error: string;
  allAccountsForSelect: AccountOption[];
  onClose: () => void;
  onNarrationChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onAddLine: () => void;
  onUpdateLine: (id: string, field: string, value: string) => void;
  onRemoveLine: (id: string) => void;
  onDelete: () => void;
  onSave: () => void;
};

export function PostJournalEntryModal({
  narration,
  date,
  lines,
  totals,
  error,
  isAuditing,
  auditResult,
  allAccountsForSelect,
  isAgentMirroredAlreadyPosted,
  agentMirroredEntryId,
  onClose,
  onNarrationChange,
  onDateChange,
  onAddLine,
  onUpdateLine,
  onRemoveLine,
  onAudit,
  onApplySuggestion,
  onSubmit,
}: PostJournalEntryModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Post Journal Entry</h2>
              <p className="text-sm text-gray-500">Create a double-entry transaction</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                data-agent-target="post-entry-date"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Narration</label>
              <input
                type="text"
                value={narration}
                onChange={(e) => onNarrationChange(e.target.value)}
                placeholder="e.g., Purchased office equipment"
                data-agent-target="post-entry-narration"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">Entry Lines</label>
              <button onClick={onAddLine} data-agent-target="post-entry-add-line" className="text-sm text-purple-600 hover:text-purple-700 font-medium">
                + Add Line
              </button>
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">Debit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">Credit</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map((line, index) => (
                    <tr key={line.id}>
                      <td className="px-4 py-3">
                        <select
                          value={line.accountCode}
                          onChange={(e) => onUpdateLine(line.id, "accountCode", e.target.value)}
                          data-agent-target={`post-entry-line-${index + 1}-account`}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                          <option value="">Select account...</option>
                          {allAccountsForSelect.map((acc) => (
                            <option key={acc.code} value={acc.code}>
                              {acc.code} - {acc.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={line.debit}
                          onChange={(e) => onUpdateLine(line.id, "debit", e.target.value)}
                          placeholder="0"
                          data-agent-target={`post-entry-line-${index + 1}-debit`}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={line.credit}
                          onChange={(e) => onUpdateLine(line.id, "credit", e.target.value)}
                          placeholder="0"
                          data-agent-target={`post-entry-line-${index + 1}-credit`}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </td>
                      <td className="px-3 py-3">
                        {lines.length > 2 ? (
                          <button
                            onClick={() => onRemoveLine(line.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                    <td className="px-4 py-3 text-sm font-bold text-right text-gray-900">₦{totals.totalDebit.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-bold text-right text-gray-900">₦{totals.totalCredit.toLocaleString()}</td>
                    <td className="px-3 py-3">
                      {totals.isBalanced ? (
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : totals.totalDebit > 0 || totals.totalCredit > 0 ? (
                        <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                          <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">AI Accountant</h3>
                  <p className="text-xs text-gray-500">Verify your entry against accounting standards</p>
                </div>
              </div>
              <button
                onClick={onAudit}
                disabled={isAuditing}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm"
              >
                {isAuditing ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Analysing...
                  </>
                ) : (
                  <>Verify Entry</>
                )}
              </button>
            </div>

            {auditResult ? (
              <div
                className={`mt-3 p-3 rounded-lg text-sm border ${
                  auditResult.isValid || auditResult.fixed
                    ? "bg-blue-50 border-blue-100 text-green-800"
                    : "bg-amber-50 border-amber-100 text-amber-800"
                }`}
              >
                <div className="flex items-start gap-2">
                  {auditResult.isValid || auditResult.fixed ? (
                    <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{auditResult.fixed ? "Entry corrected based on AI suggestions." : auditResult.reasoning}</p>

                    {!auditResult.isValid && !auditResult.fixed && auditResult.suggestedCorrections ? (
                      <div className="mt-2">
                        <button
                          onClick={onApplySuggestion}
                          className="text-xs font-semibold bg-white border border-amber-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-amber-50 transition-colors"
                        >
                          Apply Suggested Fix
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
          ) : null}

          {isAgentMirroredAlreadyPosted ? (
            <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 px-4 py-3 rounded-lg border border-blue-100">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5-1a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Entry {agentMirroredEntryId ? `${agentMirroredEntryId} ` : ""}was already posted by the agent.
            </div>
          ) : null}

          {!totals.isBalanced && totals.totalDebit > 0 ? (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-lg">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Entry not balanced: DR ₦{totals.totalDebit.toLocaleString()} ≠ CR ₦{totals.totalCredit.toLocaleString()}
            </div>
          ) : null}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={() => {
                onSubmit();
                if (totals.isBalanced && narration.trim()) {
                  onClose();
                }
              }}
              data-agent-target="post-entry-submit"
              disabled={!totals.isBalanced || !narration.trim() || isAgentMirroredAlreadyPosted}
              className="px-5 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAgentMirroredAlreadyPosted ? "Already Posted" : "Post Entry"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EditJournalEntryModal({
  entryId,
  narration,
  date,
  lines,
  totals,
  error,
  allAccountsForSelect,
  onClose,
  onNarrationChange,
  onDateChange,
  onAddLine,
  onUpdateLine,
  onRemoveLine,
  onDelete,
  onSave,
}: EditJournalEntryModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Edit Journal Entry</h2>
              <p className="text-sm text-gray-500">Modify entry {entryId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Narration</label>
              <input
                type="text"
                value={narration}
                onChange={(e) => onNarrationChange(e.target.value)}
                placeholder="e.g., Purchased office equipment"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">Entry Lines</label>
              <button onClick={onAddLine} className="text-sm text-amber-600 hover:text-amber-700 font-medium">
                + Add Line
              </button>
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">Debit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">Credit</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-3">
                        <select
                          value={line.accountCode}
                          onChange={(e) => onUpdateLine(line.id, "accountCode", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        >
                          <option value="">Select account...</option>
                          {allAccountsForSelect.map((acc) => (
                            <option key={acc.code} value={acc.code}>
                              {acc.code} - {acc.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={line.debit}
                          onChange={(e) => onUpdateLine(line.id, "debit", e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={line.credit}
                          onChange={(e) => onUpdateLine(line.id, "credit", e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                      </td>
                      <td className="px-3 py-3">
                        {lines.length > 2 ? (
                          <button
                            onClick={() => onRemoveLine(line.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                    <td className="px-4 py-3 text-sm font-bold text-right text-gray-900">₦{totals.totalDebit.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-bold text-right text-gray-900">₦{totals.totalCredit.toLocaleString()}</td>
                    <td className="px-3 py-3">
                      {totals.isBalanced ? (
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : totals.totalDebit > 0 || totals.totalCredit > 0 ? (
                        <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                          <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {error ? (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
          ) : null}

          {!totals.isBalanced && totals.totalDebit > 0 ? (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-lg">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Entry not balanced: DR ₦{totals.totalDebit.toLocaleString()} ≠ CR ₦{totals.totalCredit.toLocaleString()}
            </div>
          ) : null}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <button onClick={onDelete} className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              Delete Entry
            </button>
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={!totals.isBalanced || !narration.trim()}
                className="px-5 py-2.5 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
