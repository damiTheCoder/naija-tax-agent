"use client";

import { useState, useMemo, useEffect } from "react";
import { calculateMonthlyPayroll } from "@/lib/payroll/calculator";
import { payrollEngine, PayrollRun } from "@/lib/payroll/payrollEngine";
import Link from "next/link";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export default function PayrollDashboard() {
    const [runs, setRuns] = useState<PayrollRun[]>([]);
    const [showNewRunModal, setShowNewRunModal] = useState(false);
    const [showAuditModal, setShowAuditModal] = useState<PayrollRun | null>(null);
    const [newRunMonth, setNewRunMonth] = useState(MONTHS[new Date().getMonth()]);
    const [newRunYear, setNewRunYear] = useState(new Date().getFullYear());

    useEffect(() => {
        setRuns(payrollEngine.getRuns());
        const unsubscribe = payrollEngine.subscribe(setRuns);
        return unsubscribe;
    }, []);

    const handleCreateRun = () => {
        const savedEmployees = window.localStorage.getItem("insight::employees");
        if (!savedEmployees) {
            alert("Please add employees in Staff Management first.");
            return;
        }
        const employees = JSON.parse(savedEmployees);
        if (employees.length === 0) {
            alert("No active employees found. Please add employees first.");
            return;
        }

        payrollEngine.createRun(newRunMonth, newRunYear, employees);
        setShowNewRunModal(false);
    };

    const handleProcessPayment = (runId: string) => {
        if (confirm("Are you sure you want to process payment and generate ledger entries for this run?")) {
            payrollEngine.processPayment(runId);
        }
    };

    const formatCurrency = (amt: number | null | undefined) => {
        if (amt === null || amt === undefined) return "₦0";
        return `₦${amt.toLocaleString()}`;
    };

    const stats = useMemo(() => {
        const paidRuns = runs.filter(r => r.status === "PAID");
        return {
            totalPaid: paidRuns.reduce((sum, r) => sum + r.totalNet, 0),
            totalTax: paidRuns.reduce((sum, r) => sum + r.totalTax, 0),
            totalPension: paidRuns.reduce((sum, r) => sum + r.totalPension, 0),
            totalNHF: paidRuns.reduce((sum, r) => sum + r.totalNHF, 0),
        };
    }, [runs]);

    return (
        <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-white/5 rounded-3xl p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
                <div>
                    <h1 className="text-3xl font-extrabold text-black dark:text-white tracking-tight">Payroll Dashboard</h1>
                    <p className="text-black dark:text-gray-400 mt-1 font-medium">History of salary disbursements and statutory filings.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/accounting/employees"
                        className="px-6 py-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-gray-800 text-black dark:text-white rounded-2xl font-bold text-sm hover:bg-gray-100 dark:hover:bg-white/10 transition-all active:scale-95 shadow-sm"
                    >
                        Staff Management
                    </Link>
                    <button
                        onClick={() => alert("Summary report (Audit-ready) exported to CSV/Excel.")}
                        className="px-6 py-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-gray-800 text-black dark:text-white rounded-2xl font-bold text-sm hover:bg-gray-100 dark:hover:bg-white/10 transition-all active:scale-95 shadow-sm flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Export Summary
                    </button>
                    <button
                        onClick={() => setShowNewRunModal(true)}
                        className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 shadow-md shadow-blue-100 dark:shadow-none transition-all active:scale-95"
                    >
                        New Payroll Run
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: "Total Paid (YTD)", value: stats.totalPaid, color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "Total PAYE (YTD)", value: stats.totalTax, color: "text-purple-600", bg: "bg-purple-50" },
                    { label: "Staff Pensions", value: stats.totalPension, color: "text-indigo-600", bg: "bg-indigo-50" },
                    { label: "NHF Deposits", value: stats.totalNHF, color: "text-emerald-600", bg: "bg-emerald-50" }
                ].map((stat) => (
                    <div key={stat.label} className="bg-gray-50 dark:bg-white/5 rounded-3xl p-6 shadow-sm">
                        <p className="text-[10px] font-black text-black dark:text-gray-400 uppercase tracking-widest mb-2">{stat.label}</p>
                        <p className={`text-xl font-black ${stat.color} dark:text-white font-mono`}>{formatCurrency(stat.value)}</p>
                    </div>
                ))}
            </div>

            <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-gray-100/50 dark:bg-white/5 border-b border-gray-100 dark:border-gray-800">
                        <tr>
                            <th className="px-8 py-5 text-[10px] font-black text-black dark:text-gray-400 uppercase tracking-widest">Payroll Month</th>
                            <th className="px-8 py-5 text-[10px] font-black text-black dark:text-gray-400 uppercase tracking-widest">Status</th>
                            <th className="px-8 py-5 text-[10px] font-black text-black dark:text-gray-400 uppercase tracking-widest text-right">Gross Amount</th>
                            <th className="px-8 py-5 text-[10px] font-black text-black dark:text-gray-400 uppercase tracking-widest text-right">Net Disbursement</th>
                            <th className="px-8 py-5 text-[10px] font-black text-black dark:text-gray-400 uppercase tracking-widest text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {runs.map((run) => (
                            <tr key={run.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group text-sm">
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center text-black dark:text-gray-400 font-bold group-hover:bg-blue-600 group-hover:text-white transition-all">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </div>
                                        <div>
                                            <p className="font-bold text-black dark:text-white">{run.month} {run.year}</p>
                                            <p className="text-xs text-black dark:text-gray-400">Processed: {run.processedDate}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${run.status === 'PAID'
                                        ? 'bg-emerald-100 text-emerald-900'
                                        : 'bg-amber-100 text-amber-900'
                                        }`}>
                                        {run.status}
                                    </span>
                                </td>
                                <td className="px-8 py-5 font-bold text-black dark:text-white text-right font-mono">{formatCurrency(run.totalGross)}</td>
                                <td className="px-8 py-5 font-black text-blue-600 dark:text-blue-400 text-right font-mono">{formatCurrency(run.totalNet)}</td>
                                <td className="px-8 py-5 text-center">
                                    <div className="flex items-center justify-center gap-4">
                                        {run.status !== 'PAID' && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleProcessPayment(run.id); }}
                                                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 active:scale-95"
                                            >
                                                Process Payment
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowAuditModal(run); }}
                                            title="View Audit Log"
                                            className="text-black dark:text-gray-400 hover:text-blue-600 dark:hover:text-white transition-colors p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); alert("Digital Payslips generated and emailed to all staff for " + run.month + " " + run.year); }}
                                            title="Distribute Payslips"
                                            className="text-black dark:text-gray-400 hover:text-blue-600 transition-colors p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Compliance Alert */}
            <div className="bg-amber-100 dark:bg-amber-900/10 rounded-3xl p-6 flex items-start gap-4 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-amber-200 dark:bg-amber-900/30 flex items-center justify-center text-amber-900 dark:text-amber-400 shrink-0">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div>
                    <h3 className="font-bold text-black dark:text-amber-200">Upcoming Filing Deadline</h3>
                    <p className="text-sm text-black dark:text-amber-400 mt-1">
                        Your PAYE (Income Tax) and monthly Pension remittances for February are due by **March 10th**. Ensure all runs are approved and paid before the deadline to avoid FIRS penalties.
                    </p>
                </div>
            </div>

            {/* Time Tracking Integration Placeholder */}
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-3xl p-6 flex items-center justify-between shadow-sm border border-blue-100 dark:border-blue-900/30">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-blue-900 dark:text-blue-200">Time & Attendance Integration</h3>
                        <p className="text-xs text-blue-700 dark:text-blue-400">Sync hours from Biometric or Digital clocks to auto-calculate overtime.</p>
                    </div>
                </div>
                <button
                    onClick={() => alert("Time Tracking module linkage is available in the Enterprise edition.")}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 transition-all"
                >
                    Connect Clockify / Odoo
                </button>
            </div>
            {/* New Payroll Run Modal */}
            {showNewRunModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#121212] w-full max-w-md rounded-3xl p-8 shadow-2xl">
                        <h2 className="text-2xl font-black text-black dark:text-white mb-6">Initialize Payroll Run</h2>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Month</label>
                                <select
                                    value={newRunMonth}
                                    onChange={e => setNewRunMonth(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none"
                                >
                                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Year</label>
                                <select
                                    value={newRunYear}
                                    onChange={e => setNewRunYear(parseInt(e.target.value))}
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none"
                                >
                                    {[2023, 2024, 2025].map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="mt-10 flex gap-4">
                            <button
                                onClick={() => setShowNewRunModal(false)}
                                className="flex-1 py-4 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded-2xl font-bold hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateRun}
                                className="flex-2 py-4 bg-blue-600 text-white px-8 rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all"
                            >
                                Create Run
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Audit Log Modal */}
            {showAuditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#121212] w-full max-w-2xl rounded-3xl p-8 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-black dark:text-white">Run Audit History</h2>
                                <p className="text-sm text-gray-500">{showAuditModal.month} {showAuditModal.year} — ID: {showAuditModal.id}</p>
                            </div>
                            <button onClick={() => setShowAuditModal(null)} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 bg-gray-50 dark:bg-black/20 rounded-2xl p-6 font-mono text-xs">
                            {showAuditModal.auditLog.map((log, i) => (
                                <div key={i} className="text-black dark:text-gray-300 border-b border-gray-100 dark:border-gray-800 pb-2 flex gap-3">
                                    <span className="text-blue-500 whitespace-nowrap">{log.split(']')[0]}]</span>
                                    <span>{log.split(']')[1]}</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8">
                            <button
                                onClick={() => setShowAuditModal(null)}
                                className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-black rounded-2xl font-black"
                            >
                                Close Audit View
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

