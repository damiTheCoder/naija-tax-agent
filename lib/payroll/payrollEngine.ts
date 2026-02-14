
import { accountingEngine } from "../accounting/transactionBridge";
import { calculateMonthlyPayroll, PayrollResult } from "./calculator";
import { generateJournalId } from "../accounting/doubleEntry";

export interface PayrollRun {
    id: string;
    month: string;
    year: number;
    status: "DRAFT" | "APPROVED" | "PAID";
    totalGross: number;
    totalNet: number;
    totalTax: number;
    totalPension: number;
    totalNHF: number;
    processedDate: string;
    employeeResults: Record<string, PayrollResult>;
    auditLog: string[];
    paymentReference?: string;
}

class PayrollEngine {
    private runs: PayrollRun[] = [];
    private listeners: Set<(runs: PayrollRun[]) => void> = new Set();

    constructor() {
        this.load();
    }

    private load() {
        if (typeof window === "undefined") return;
        const saved = window.localStorage.getItem("insight::payroll-runs");
        if (saved) {
            try {
                this.runs = JSON.parse(saved);
            } catch (e) {
                console.error("Failed to load payroll runs", e);
            }
        }
    }

    private persist() {
        if (typeof window === "undefined") return;
        window.localStorage.setItem("insight::payroll-runs", JSON.stringify(this.runs));
    }

    private notify() {
        this.listeners.forEach(l => l(this.runs));
        this.persist();
    }

    subscribe(listener: (runs: PayrollRun[]) => void) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    getRuns() {
        return this.runs;
    }

    createRun(month: string, year: number, employees: any[]): PayrollRun {
        const id = `run-${month.toLowerCase()}-${year}-${Date.now().toString().slice(-4)}`;

        const employeeResults: Record<string, PayrollResult> = {};
        let totalGross = 0;
        let totalNet = 0;
        let totalTax = 0;
        let totalPension = 0;
        let totalNHF = 0;

        employees.forEach(emp => {
            const result = calculateMonthlyPayroll({
                basicSalary: emp.basicSalary,
                housing: emp.housingAllowance || emp.housing || 0,
                transport: emp.transportAllowance || emp.transport || 0,
                otherAllowances: emp.otherAllowances || 0
            });
            employeeResults[emp.id] = result;
            totalGross += result.grossIncome;
            totalNet += result.netSalary;
            totalTax += result.monthlyTax;
            totalPension += (result.pensionEmployee + result.pensionEmployer);
            totalNHF += result.nhf;
        });

        const newRun: PayrollRun = {
            id,
            month,
            year,
            status: "DRAFT",
            totalGross,
            totalNet,
            totalTax,
            totalPension,
            totalNHF,
            processedDate: "Not Processed",
            employeeResults,
            auditLog: [`[${new Date().toISOString()}] Payroll run initialized for ${month} ${year}`]
        };

        this.runs = [newRun, ...this.runs];
        this.notify();
        return newRun;
    }

    processPayment(runId: string) {
        const runIndex = this.runs.findIndex(r => r.id === runId);
        if (runIndex === -1) return;

        const run = this.runs[runIndex];
        if (run.status === "PAID") return;

        const reference = `PAY-${run.month.slice(0, 3).toUpperCase()}-${run.year}-${Math.random().toString(36).substring(7).toUpperCase()}`;

        run.status = "PAID";
        run.processedDate = new Date().toLocaleDateString("en-NG", { day: 'numeric', month: 'short', year: 'numeric' });
        run.paymentReference = reference;
        run.auditLog.push(`[${new Date().toISOString()}] Payment processed. Ref: ${reference}`);

        // Generate Journal Entry
        this.postPayrollToLedger(run);

        this.notify();

        // Trigger accounting update event for other components
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("accounting-update"));
        }
    }

    private postPayrollToLedger(run: PayrollRun) {
        const narration = `Payroll Disbursement - ${run.month} ${run.year} (Ref: ${run.paymentReference})`;
        const date = new Date().toISOString().split("T")[0];
        const roundCurrency = (value: number) => Math.round(value * 100) / 100;
        const totalEmployeePension = Math.max(0, roundCurrency(run.totalGross - run.totalNet - run.totalNHF - run.totalTax));
        const employerPension = Math.max(0, roundCurrency(run.totalPension - totalEmployeePension));

        // Lines for the journal entry
        const lines = [
            // DR Salaries and Wages (Gross)
            {
                accountCode: "5500",
                accountName: "Salaries and Wages",
                debit: run.totalGross,
                credit: 0
            },
            // DR Employer Pension Expense (employer share)
            ...(employerPension > 0 ? [{
                accountCode: "5520",
                accountName: "Pension Expense",
                debit: employerPension,
                credit: 0
            }] : []),
            // CR PAYE Payable
            {
                accountCode: "2210",
                accountName: "PAYE Payable",
                debit: 0,
                credit: run.totalTax
            },
            // CR Pension Payable
            {
                accountCode: "2230",
                accountName: "Pension Payable",
                debit: 0,
                credit: run.totalPension
            },
            // CR NHF Payable
            {
                accountCode: "2240",
                accountName: "NHF Payable",
                debit: 0,
                credit: run.totalNHF
            },
            // CR Bank (Net Disbursement)
            {
                accountCode: "1020",
                accountName: "Bank",
                debit: 0,
                credit: run.totalNet
            }
        ];

        try {
            accountingEngine.postManualJournalEntry({
                narration,
                date,
                lines
            });
            run.auditLog.push(`[${new Date().toISOString()}] Accounting journal posted successfully.`);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : "Unknown error";
            run.auditLog.push(`[${new Date().toISOString()}] FAILED to post accounting journal: ${errorMsg}`);
            console.error("Failed to post payroll journal entry", e);
        }
    }
}

export const payrollEngine = new PayrollEngine();
