import { TaxInputs, UserProfile, ValidationIssue } from "../types";

export interface IncomeAggregationSummary {
    totalRevenue: number;
    totalExpenses: number;
    entryCount: number;
}

export function validateTaxScenario(
    profile: UserProfile,
    inputs: TaxInputs,
    incomeSummary: IncomeAggregationSummary,
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    let counter = 0;
    const makeIssue = (field: string, severity: ValidationIssue["severity"], message: string): ValidationIssue => {
        counter += 1;
        return {
            id: `${field}-${counter}`,
            field,
            severity,
            message,
        };
    };

    if (!profile.fullName.trim()) {
        issues.push(makeIssue("profile.fullName", "error", "Taxpayer name is required."));
    }

    if (incomeSummary.totalRevenue <= 0) {
        issues.push(makeIssue("inputs.grossRevenue", "warning", "Gross revenue is zero; minimum tax rules may apply."));
    }

    if (incomeSummary.totalExpenses > incomeSummary.totalRevenue && incomeSummary.totalRevenue > 0) {
        issues.push(makeIssue("inputs.allowableExpenses", "info", "Allowable expenses exceed recorded revenue; ensure supporting documentation is retained."));
    }

    if (profile.taxpayerType === "company" && !inputs.turnover) {
        issues.push(makeIssue("inputs.turnover", "warning", "Turnover is required for accurate company income tax thresholds."));
    }

    if (profile.isVATRegistered && incomeSummary.totalRevenue <= 0) {
        issues.push(makeIssue("inputs.vat", "info", "VAT registration flagged but no vatable revenue supplied."));
    }

    if (inputs.withholdingTaxCredits && inputs.withholdingTaxCredits > incomeSummary.totalRevenue * 0.25) {
        issues.push(makeIssue("inputs.withholdingTaxCredits", "info", "WHT credits appear unusually high relative to income; confirm certificates before filing."));
    }

    if (inputs.priorYearLosses && inputs.priorYearLosses > incomeSummary.totalRevenue) {
        issues.push(makeIssue("inputs.priorYearLosses", "info", "Carried-forward losses exceed current revenue; ensure they are within statutory limits (max 4 years for CIT)."));
    }

    if (inputs.payrollEntries && inputs.payrollEntries.length && profile.taxpayerType !== "company") {
        issues.push(makeIssue("inputs.payrollEntries", "info", "Payroll data supplied for an individual taxpayer; confirm entity structure."));
    }

    const certificateTotal = (inputs.withholdingCertificates || []).reduce((sum, cert) => sum + (cert.amount || 0), 0);
    if ((inputs.withholdingTaxCredits || 0) > 0 && (!inputs.withholdingCertificates || inputs.withholdingCertificates.length === 0)) {
        issues.push(makeIssue("inputs.withholdingCertificates", "warning", "Add WHT certificates to support the credits applied."));
    }

    if (certificateTotal > 0 && Math.abs(certificateTotal - (inputs.withholdingTaxCredits || 0)) > 1) {
        issues.push(makeIssue("inputs.withholdingTaxCredits", "warning", "Sum of WHT certificates does not match credits claimed."));
    }

    return issues;
}
