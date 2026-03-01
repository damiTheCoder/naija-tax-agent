"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { calculateMonthlyPayroll } from "@/lib/payroll/calculator";
import type { EmployeeRecord } from "@/lib/payroll/types";

const MOCK_EMPLOYEES: EmployeeRecord[] = [
    {
        id: "emp-1",
        firstName: "Dami",
        lastName: "Oluwa",
        role: "CEO",
        email: "dami@example.com",
        basicSalary: 450000,
        housing: 150000,
        transport: 100000,
        otherAllowances: 50000,
        isActive: true,
        taxId: "TAX-123456",
        bankName: "Zenith Bank",
        accountNumber: "1234567890",
        department: "Executive",
        employmentType: "FULL_TIME"
    },
    {
        id: "emp-2",
        firstName: "Chioma",
        lastName: "Nnadi",
        role: "Accountant",
        email: "chioma@example.com",
        basicSalary: 250000,
        housing: 100000,
        transport: 50000,
        otherAllowances: 20000,
        isActive: true,
        taxId: "TAX-789012",
        bankName: "GTBank",
        accountNumber: "0987654321",
        department: "Finance",
        employmentType: "FULL_TIME"
    }
];

export default function EmployeesPage() {
    const [employees, setEmployees] = useState<EmployeeRecord[]>(() => {
        if (typeof window === "undefined") return MOCK_EMPLOYEES;
        const saved = window.localStorage.getItem("insight::employees");
        if (!saved) return MOCK_EMPLOYEES;
        try {
            const parsed = JSON.parse(saved);
            return Array.isArray(parsed) ? (parsed as EmployeeRecord[]) : MOCK_EMPLOYEES;
        } catch (e) {
            console.error("Failed to load employees", e);
            return MOCK_EMPLOYEES;
        }
    });

    useEffect(() => {
        window.localStorage.setItem("insight::employees", JSON.stringify(employees));
    }, [employees]);

    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);
    const [newEmployee, setNewEmployee] = useState<Omit<EmployeeRecord, "id" | "isActive">>({
        firstName: "",
        lastName: "",
        role: "STAFF",
        email: "",
        basicSalary: 0,
        housing: 0,
        transport: 0,
        otherAllowances: 0,
        taxId: "",
        bankName: "",
        accountNumber: "",
        department: "",
        employmentType: "FULL_TIME",
        hireDate: new Date().toISOString().split('T')[0]
    });

    const formatCurrency = (amt: number | null | undefined) => {
        if (amt === null || amt === undefined) return "₦0";
        return `₦${amt.toLocaleString()}`;
    };

    const handleAddEmployee = () => {
        if (!newEmployee.firstName || !newEmployee.lastName || newEmployee.basicSalary <= 0) {
            alert("Please fill in the required fields.");
            return;
        }
        const emp: EmployeeRecord = {
            ...newEmployee,
            id: `emp-${Date.now()}`,
            isActive: true,
        };
        setEmployees([...employees, emp]);
        setShowAddModal(false);
        setNewEmployee({
            firstName: "",
            lastName: "",
            role: "STAFF",
            email: "",
            basicSalary: 0,
            housing: 0,
            transport: 0,
            otherAllowances: 0,
            taxId: "",
            bankName: "",
            accountNumber: "",
            department: "",
            employmentType: "FULL_TIME",
            hireDate: new Date().toISOString().split('T')[0],
        });
    };

    const payrollCalculations = useMemo(() => {
        return employees.map(emp => ({
            id: emp.id,
            result: calculateMonthlyPayroll({
                basicSalary: emp.basicSalary,
                housing: emp.housing,
                transport: emp.transport,
                otherAllowances: emp.otherAllowances
            })
        }));
    }, [employees]);

    const totalStats = useMemo(() => {
        return payrollCalculations.reduce((acc, curr) => ({
            gross: acc.gross + curr.result.grossIncome,
            tax: acc.tax + curr.result.monthlyTax,
            pension: acc.pension + curr.result.pensionEmployee + curr.result.pensionEmployer,
            nhf: acc.nhf + curr.result.nhf,
            net: acc.net + curr.result.netSalary
        }), { gross: 0, tax: 0, pension: 0, nhf: 0, net: 0 });
    }, [payrollCalculations]);

    const activeCalc = selectedEmployee ? calculateMonthlyPayroll({
        basicSalary: selectedEmployee.basicSalary,
        housing: selectedEmployee.housing,
        transport: selectedEmployee.transport,
        otherAllowances: selectedEmployee.otherAllowances
    }) : null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gray-50 dark:bg-white/5 rounded-3xl p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
                <div>
                    <h1 className="text-3xl font-extrabold text-black dark:text-white tracking-tight">Staff Management</h1>
                    <p className="text-black dark:text-gray-400 mt-1 font-medium">Manage your team profiles and statutory tax compliance.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-6 py-3 bg-gray-200 dark:bg-white/10 text-black dark:text-white rounded-2xl font-bold text-sm hover:bg-gray-300 dark:hover:bg-white/20 transition-all active:scale-95"
                    >
                        Add New Staff
                    </button>
                    <Link
                        href="/accounting/payroll"
                        className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 shadow-md shadow-blue-100 dark:shadow-none transition-all active:scale-95 text-center"
                    >
                        Run Monthly Payroll
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Employee List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white dark:bg-white/5 rounded-3xl overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-gray-100/50 dark:bg-white/5 border-b border-gray-100 dark:border-gray-800">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black text-black dark:text-gray-400 uppercase tracking-widest">Employee Profile</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-black dark:text-gray-400 uppercase tracking-widest">Designation</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-black dark:text-gray-400 uppercase tracking-widest text-right">Gross Salary</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-black dark:text-gray-400 uppercase tracking-widest text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                {employees.map((emp) => {
                                    const gross = emp.basicSalary + emp.housing + emp.transport + emp.otherAllowances;
                                    const isSelected = selectedEmployee?.id === emp.id;
                                    return (
                                        <tr
                                            key={emp.id}
                                            onClick={() => setSelectedEmployee(emp)}
                                            className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                                        >
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black border border-blue-100/50 dark:border-blue-900/30 group-hover:scale-110 transition-transform">
                                                        {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-black dark:text-white truncate">{emp.firstName} {emp.lastName}</p>
                                                        <p className="text-xs text-black dark:text-gray-400 truncate">{emp.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-sm font-medium text-black dark:text-gray-400 underline decoration-gray-200 dark:decoration-gray-700 underline-offset-4">{emp.role}</td>
                                            <td className="px-8 py-5 text-sm font-bold text-black dark:text-white text-right font-mono">{formatCurrency(gross)}</td>
                                            <td className="px-8 py-5 text-center">
                                                <span className="px-3 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                                                    Active
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Sidebar - Details / Summary */}
                <div className="space-y-6">
                    {selectedEmployee ? (
                        <div className="bg-white dark:bg-white/5 border-2 border-blue-600 dark:border-blue-500 rounded-3xl p-8 shadow-xl shadow-blue-100 dark:shadow-none animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-start justify-between mb-8">
                                <div>
                                    <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Deduction Breakdown</p>
                                    <h3 className="text-xl font-black text-black dark:text-white">{selectedEmployee.firstName}&apos;s Payroll</h3>
                                </div>
                                <button onClick={() => setSelectedEmployee(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="space-y-5">
                                <div className="flex items-center justify-between text-sm py-3 border-b border-gray-50 dark:border-gray-800">
                                    <span className="text-black dark:text-gray-400 font-medium">Monthly Gross</span>
                                    <span className="text-black dark:text-white font-bold">{formatCurrency(activeCalc?.grossIncome || 0)}</span>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-black dark:text-gray-400 font-medium">PAYE Tax (PITA)</span>
                                        <span className="text-rose-600 dark:text-rose-400 font-bold">-{formatCurrency(activeCalc?.monthlyTax || 0)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-black dark:text-gray-400 font-medium">Employee Pension (8%)</span>
                                        <span className="text-rose-600 dark:text-rose-400 font-bold">-{formatCurrency(activeCalc?.pensionEmployee || 0)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-black dark:text-gray-400 font-medium">NHF (2.5% of Basic)</span>
                                        <span className="text-rose-600 dark:text-rose-400 font-bold">-{formatCurrency(activeCalc?.nhf || 0)}</span>
                                    </div>
                                </div>
                                <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                    <p className="text-[10px] uppercase font-black text-blue-600 dark:text-blue-400 tracking-widest mb-1">Take-Home Pay</p>
                                    <p className="text-3xl font-black text-blue-700 dark:text-blue-300">{formatCurrency(activeCalc?.netSalary || 0)}</p>
                                    <p className="text-[10px] text-blue-500 mt-2 font-bold uppercase tracking-wider italic">Audited by Compliance Engine</p>
                                </div>

                                <div className="mt-6 space-y-3 pt-6 border-t border-gray-100 dark:border-gray-800">
                                    <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        <span>Bank Details</span>
                                        <span className="text-black dark:text-white uppercase">{selectedEmployee.bankName || "Not Set"}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        <span>Account Number</span>
                                        <span className="text-black dark:text-white">{selectedEmployee.accountNumber || "Not Set"}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        <span>Tax ID (PITA)</span>
                                        <span className="text-black dark:text-white">{selectedEmployee.taxId || "Not Set"}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        <span>Department</span>
                                        <span className="text-black dark:text-white">{selectedEmployee.department || "General"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 dark:bg-white/5 rounded-3xl p-8 text-black dark:text-white shadow-sm relative overflow-hidden group">
                            <div className="relative z-10">
                                <div className="w-12 h-12 bg-gray-200 dark:bg-white/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                </div>
                                <h3 className="text-xl font-black mb-1 text-black dark:text-white">Payroll Forecast</h3>
                                <p className="text-black dark:text-gray-400 text-xs mb-8 opacity-70">Company-wide monthly obligation.</p>

                                <div className="space-y-6">
                                    <div>
                                        <p className="text-[10px] uppercase font-black text-black dark:text-gray-400 tracking-widest mb-1 opacity-60">Total Monthly Liability</p>
                                        <p className="text-3xl font-black tracking-tighter text-black dark:text-white">
                                            {formatCurrency(totalStats.gross)}
                                        </p>
                                    </div>
                                    <div className="pt-6 border-t border-gray-200 dark:border-white/10 grid grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-black dark:text-gray-400 tracking-widest opacity-60">Team Size</p>
                                            <p className="text-xl font-bold text-black dark:text-white">{employees.length}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-black dark:text-gray-400 tracking-widest opacity-60">Next Run</p>
                                            <p className="text-xl font-bold text-black dark:text-white">Feb 25</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="absolute top-[-20%] right-[-20%] w-64 h-64 bg-blue-600/5 rounded-full blur-3xl pointer-events-none"></div>
                        </div>
                    )}

                    <div className="bg-gray-50 dark:bg-white/5 rounded-3xl p-8 shadow-sm">
                        <h3 className="text-xs font-black text-black dark:text-white uppercase tracking-widest mb-6">Tax & Statutory Accruals</h3>
                        <div className="space-y-4">
                            {[
                                { label: "PAYE / INCOME TAX", amount: totalStats.tax, color: "bg-purple-500", progress: 65 },
                                { label: "PENSION FUND (18%)", amount: totalStats.pension, color: "bg-blue-500", progress: 40 },
                                { label: "NHF CONTRIBUTIONS", amount: totalStats.nhf, color: "bg-emerald-500", progress: 25 }
                            ].map((stat) => (
                                <div key={stat.label} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[9px] font-black text-black dark:text-gray-400 uppercase tracking-widest opacity-60">{stat.label}</p>
                                        <p className="text-xs font-bold text-black dark:text-white">{formatCurrency(stat.amount)}</p>
                                    </div>
                                    <div className="h-1.5 w-full bg-gray-50 dark:bg-white/5 rounded-full overflow-hidden">
                                        <div className={`h-full ${stat.color} rounded-full`} style={{ width: `${stat.progress}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Employee Modal (Simplified Overlay for Demo) */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#121212] w-full max-w-xl rounded-3xl p-10 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Onboard New Talent</h2>
                                <p className="text-sm text-gray-500 mt-1">Configure salary and staff profile details.</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 hover:bg-gray-200 active:scale-90 transition-all">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">First Name</label>
                                <input
                                    type="text"
                                    value={newEmployee.firstName}
                                    onChange={e => setNewEmployee({ ...newEmployee, firstName: e.target.value })}
                                    placeholder="e.g. Ebuka"
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Last Name</label>
                                <input
                                    type="text"
                                    value={newEmployee.lastName}
                                    onChange={e => setNewEmployee({ ...newEmployee, lastName: e.target.value })}
                                    placeholder="e.g. Okafor"
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Email Address</label>
                                <input
                                    type="email"
                                    value={newEmployee.email}
                                    onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })}
                                    placeholder="ebuka@company.com"
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Basic Monthly Salary</label>
                                <input
                                    type="number"
                                    value={newEmployee.basicSalary || ""}
                                    onChange={e => setNewEmployee({ ...newEmployee, basicSalary: parseFloat(e.target.value) || 0 })}
                                    placeholder="₦0.00"
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-3.5 text-sm font-black outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Housing Allowance</label>
                                <input
                                    type="number"
                                    value={newEmployee.housing || ""}
                                    onChange={e => setNewEmployee({ ...newEmployee, housing: parseFloat(e.target.value) || 0 })}
                                    placeholder="₦0.00"
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tax ID (JTB/PITA)</label>
                                <input
                                    type="text"
                                    value={newEmployee.taxId}
                                    onChange={e => setNewEmployee({ ...newEmployee, taxId: e.target.value })}
                                    placeholder="N-12345678"
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bank Name</label>
                                <input
                                    type="text"
                                    value={newEmployee.bankName}
                                    onChange={e => setNewEmployee({ ...newEmployee, bankName: e.target.value })}
                                    placeholder="e.g. Access Bank"
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Account Number</label>
                                <input
                                    type="text"
                                    value={newEmployee.accountNumber}
                                    onChange={e => setNewEmployee({ ...newEmployee, accountNumber: e.target.value })}
                                    placeholder="0123456789"
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Department</label>
                                <input
                                    type="text"
                                    value={newEmployee.department}
                                    onChange={e => setNewEmployee({ ...newEmployee, department: e.target.value })}
                                    placeholder="e.g. Sales"
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Employment Type</label>
                                <select
                                    value={newEmployee.employmentType}
                                    onChange={e => setNewEmployee({
                                        ...newEmployee,
                                        employmentType: e.target.value as EmployeeRecord["employmentType"],
                                    })}
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:border-blue-500 transition-colors"
                                >
                                    <option value="FULL_TIME">Full Time</option>
                                    <option value="PART_TIME">Part Time</option>
                                    <option value="CONTRACTOR">Contractor</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-12 flex gap-4">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 py-4 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded-2xl font-bold hover:bg-gray-200 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddEmployee}
                                className="flex-2 py-4 bg-gray-900 dark:bg-white dark:text-black text-white px-10 rounded-2xl font-black shadow-xl shadow-gray-200 dark:shadow-none hover:-translate-y-1 transition-all active:scale-95"
                            >
                                Confirm & Add Staff
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
