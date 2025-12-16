"use client";

import { useState } from "react";
import {
  UserProfile,
  TaxInputs,
  TaxResult,
  TaxpayerType,
  TaxOptimizationResult,
  WHTInput,
  WHTResult,
  CGTInput,
  TETResult,
  StampDutyInput,
  StampDutyResult,
  CompanyLeviesResult,
  WithholdingCertificate,
} from "@/lib/types";
import { NIGERIAN_STATES, DEFAULT_TAX_YEAR, VAT_RATE } from "@/lib/taxRules/config";
import { WHT_RATES } from "@/lib/taxRules/whtConfig";
import { STAMP_DUTY_RATES } from "@/lib/taxRules/stampDuty";
import { CGT_RATE } from "@/lib/taxRules/cgt";
import { TET_RATE } from "@/lib/taxRules/tet";
import { generatePDF } from "@/lib/pdfGenerator";
import dynamic from "next/dynamic";

const TaxAgentChat = dynamic(() => import("@/components/TaxAgentChat"), { ssr: false });

type Step = 1 | 2 | 3;

const initialProfile: UserProfile = {
  fullName: "",
  businessName: "",
  taxpayerType: "freelancer",
  taxYear: DEFAULT_TAX_YEAR,
  stateOfResidence: "Lagos",
  isVATRegistered: false,
  currency: "NGN",
};

const initialInputs: TaxInputs = {
  grossRevenue: 0,
  allowableExpenses: 0,
  pensionContributions: 0,
  nhfContributions: 0,
  lifeInsurancePremiums: 0,
  otherReliefs: 0,
  incomeEntries: [],
  payrollEntries: [],
  vatTaxablePurchases: 0,
  inputVATPaid: 0,
  withholdingTaxCredits: 0,
  withholdingCertificates: [],
  priorYearLosses: 0,
  investmentAllowance: 0,
  ruralInvestmentAllowance: 0,
  pioneerStatusRelief: 0,
  turnover: 0,
  costOfSales: 0,
  operatingExpenses: 0,
  capitalAllowance: 0,
};

export default function HomePage() {
  const [step, setStep] = useState<Step>(1);
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [inputs, setInputs] = useState<TaxInputs>(initialInputs);
  const [result, setResult] = useState<TaxResult | null>(null);
  const [optimizations, setOptimizations] = useState<TaxOptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WHT state
  const [whtPayments, setWhtPayments] = useState<WHTInput[]>([]);
  const [whtResult, setWhtResult] = useState<WHTResult | null>(null);
  const [newWhtPayment, setNewWhtPayment] = useState<{
    paymentType: string;
    amount: string;
    isResident: boolean;
  }>({
    paymentType: "dividends",
    amount: "",
    isResident: true,
  });

  // CGT state
  const [cgtDisposals, setCgtDisposals] = useState<CGTInput[]>([]);
  const [cgtResult, setCgtResult] = useState<{ totalGain: number; totalCGT: number } | null>(null);
  const [newCgtDisposal, setNewCgtDisposal] = useState<{
    assetType: 'real_estate' | 'shares' | 'business_assets' | 'other';
    assetDescription: string;
    acquisitionCost: string;
    disposalProceeds: string;
  }>({
    assetType: "real_estate",
    assetDescription: "",
    acquisitionCost: "",
    disposalProceeds: "",
  });

  // TET state (for companies only)
  const [tetResult, setTetResult] = useState<TETResult | null>(null);

  // Stamp Duty state
  const [stampDutyDocs, setStampDutyDocs] = useState<StampDutyInput[]>([]);
  const [stampDutyResult, setStampDutyResult] = useState<{ documents: StampDutyResult[]; totalDuty: number } | null>(null);
  const [newStampDuty, setNewStampDuty] = useState<{
    documentType: StampDutyInput['documentType'];
    transactionValue: string;
  }>({
    documentType: "deed",
    transactionValue: "",
  });

  // Levies state (for companies only)
  const [leviesInput, setLeviesInput] = useState({
    industry: "other",
    monthlyPayroll: "",
    numberOfEmployees: "",
  });
  const [leviesResult, setLeviesResult] = useState<CompanyLeviesResult | null>(null);
  const [newIncomeEntry, setNewIncomeEntry] = useState({
    periodLabel: "",
    revenue: "",
    expenses: "",
  });
  const [newPayrollEntry, setNewPayrollEntry] = useState({
    month: "",
    payroll: "",
    employees: "",
  });
  const [withholdingCertificates, setWithholdingCertificates] = useState<WithholdingCertificate[]>([]);
  const [newCertificate, setNewCertificate] = useState({
    payerName: "",
    certificateNumber: "",
    issueDate: "",
    amount: "",
    fileName: "",
    fileData: "",
  });

  const SHOW_AUX_CALCULATORS = false;
  const validationSeverityClasses: Record<"info" | "warning" | "error", string> = {
    error: "border-red-200 bg-red-50 text-red-800",
    warning: "border-yellow-200 bg-yellow-50 text-yellow-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
  };

  const formatCurrency = (amount: number): string => {
    return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercent = (rate: number): string => {
    return `${(rate * 100).toFixed(1)}%`;
  };

  const handleProfileChange = (field: keyof UserProfile, value: string | number | boolean) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleInputChange = (field: keyof TaxInputs, value: string) => {
    const numValue = value === "" ? 0 : parseFloat(value.replace(/,/g, "")) || 0;
    setInputs((prev) => ({ ...prev, [field]: numValue }));
  };

  const parseCurrencyInput = (value: string): number => {
    if (!value) return 0;
    const numeric = parseFloat(value.replace(/,/g, ""));
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const parseIntegerInput = (value: string): number => {
    if (!value) return 0;
    const numeric = parseInt(value, 10);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const syncIncomeEntries = (entries: TaxInputs["incomeEntries"]) => {
    const safeEntries = entries || [];
    const totalRevenue = safeEntries.reduce((sum, entry) => sum + (entry?.revenue || 0), 0);
    const totalExpenses = safeEntries.reduce((sum, entry) => sum + (entry?.expenses || 0), 0);

    setInputs((prev) => ({
      ...prev,
      incomeEntries: safeEntries,
      grossRevenue: totalRevenue,
      allowableExpenses: totalExpenses,
    }));
  };

  const handleAddIncomeEntry = () => {
    if (!newIncomeEntry.periodLabel.trim()) {
      setError("Please provide a period label for the income entry");
      return;
    }

    const revenue = parseCurrencyInput(newIncomeEntry.revenue);
    const expenses = parseCurrencyInput(newIncomeEntry.expenses);
    if (revenue <= 0 && expenses <= 0) {
      setError("Please enter revenue or expenses for the period");
      return;
    }

    const entry = {
      periodLabel: newIncomeEntry.periodLabel.trim(),
      revenue,
      expenses,
    };

    const updatedEntries = [...(inputs.incomeEntries || []), entry];
    syncIncomeEntries(updatedEntries);
    setNewIncomeEntry({ periodLabel: "", revenue: "", expenses: "" });
    setError(null);
  };

  const handleRemoveIncomeEntry = (index: number) => {
    const updatedEntries = (inputs.incomeEntries || []).filter((_, i) => i !== index);
    syncIncomeEntries(updatedEntries);
  };

  const syncPayrollEntries = (entries: TaxInputs["payrollEntries"]) => {
    const safeEntries = entries || [];
    setInputs((prev) => ({
      ...prev,
      payrollEntries: safeEntries,
    }));

    if (safeEntries.length === 0) {
      setLeviesInput((prev) => ({ ...prev, monthlyPayroll: "", numberOfEmployees: "" }));
      return;
    }

    const totalPayroll = safeEntries.reduce((sum, entry) => sum + (entry?.grossPayroll || 0), 0);
    const monthlyAverage = totalPayroll / safeEntries.length;
    const totalEmployees = safeEntries.reduce((sum, entry) => sum + (entry?.employeeCount || 0), 0);
    const averageEmployees = safeEntries.length > 0 ? Math.round(totalEmployees / safeEntries.length) : 0;

    setLeviesInput((prev) => ({
      ...prev,
      monthlyPayroll: monthlyAverage ? monthlyAverage.toFixed(2) : "",
      numberOfEmployees: averageEmployees ? String(averageEmployees) : "",
    }));
  };

  const handleAddPayrollEntry = () => {
    if (!newPayrollEntry.month) {
      setError("Please select the month for this payroll entry");
      return;
    }

    const payrollAmount = parseCurrencyInput(newPayrollEntry.payroll);
    if (payrollAmount <= 0) {
      setError("Please enter a valid payroll amount");
      return;
    }

    const employees = Math.max(0, parseIntegerInput(newPayrollEntry.employees));
    const entry = {
      month: newPayrollEntry.month,
      grossPayroll: payrollAmount,
      employeeCount: employees,
    };

    const updatedEntries = [...(inputs.payrollEntries || []), entry];
    syncPayrollEntries(updatedEntries);
    setNewPayrollEntry({ month: "", payroll: "", employees: "" });
    setError(null);
  };

  const handleRemovePayrollEntry = (index: number) => {
    const updatedEntries = (inputs.payrollEntries || []).filter((_, i) => i !== index);
    syncPayrollEntries(updatedEntries);
  };

  const syncCertificates = (certs: WithholdingCertificate[]) => {
    setWithholdingCertificates(certs);
    const total = certs.reduce((sum, cert) => sum + (cert.amount || 0), 0);
    setInputs((prev) => ({
      ...prev,
      withholdingCertificates: certs,
      withholdingTaxCredits: total,
    }));
  };

  const handleCertificateFileChange = (file: File | null) => {
    if (!file) {
      setNewCertificate((prev) => ({ ...prev, fileName: "", fileData: "" }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileData = typeof event.target?.result === "string" ? event.target.result : "";
      setNewCertificate((prev) => ({ ...prev, fileName: file.name, fileData }));
    };
    reader.readAsDataURL(file);
  };

  const handleAddCertificate = () => {
    if (!newCertificate.payerName.trim() || !newCertificate.certificateNumber.trim()) {
      setError("Please enter payer name and certificate number");
      return;
    }

    const amount = parseCurrencyInput(newCertificate.amount);
    if (amount <= 0) {
      setError("Certificate amount must be greater than zero");
      return;
    }

    const certificate: WithholdingCertificate = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      payerName: newCertificate.payerName.trim(),
      certificateNumber: newCertificate.certificateNumber.trim(),
      issueDate: newCertificate.issueDate || new Date().toISOString().split('T')[0],
      amount,
      fileName: newCertificate.fileName || undefined,
      fileData: newCertificate.fileData || undefined,
    };

    syncCertificates([...withholdingCertificates, certificate]);
    setNewCertificate({ payerName: "", certificateNumber: "", issueDate: "", amount: "", fileName: "", fileData: "" });
    setError(null);
  };

  const handleRemoveCertificate = (id: string) => {
    const updated = withholdingCertificates.filter((cert) => cert.id !== id);
    syncCertificates(updated);
  };

  const validateStep1 = (): boolean => {
    if (!profile.fullName.trim()) {
      setError("Please enter your full name");
      return false;
    }
    setError(null);
    return true;
  };

  const validateStep2 = (): boolean => {
    if (inputs.grossRevenue <= 0) {
      setError("Please enter your gross revenue (must be greater than 0)");
      return false;
    }
    setError(null);
    return true;
  };

  // WHT handlers
  const handleAddWhtPayment = () => {
    const amount = parseFloat(newWhtPayment.amount.replace(/,/g, "")) || 0;
    if (amount <= 0) {
      setError("Please enter a valid WHT payment amount");
      return;
    }

    const payment: WHTInput = {
      paymentType: newWhtPayment.paymentType,
      amount,
      isResident: newWhtPayment.isResident,
    };

    setWhtPayments((prev) => [...prev, payment]);
    setNewWhtPayment({ paymentType: "dividends", amount: "", isResident: true });
    setError(null);
  };

  const handleRemoveWhtPayment = (index: number) => {
    setWhtPayments((prev) => prev.filter((_, i) => i !== index));
  };

  const getWhtRateInfo = (paymentType: string) => {
    return WHT_RATES.find((r) => r.paymentType === paymentType);
  };

  // CGT handlers
  const handleAddCgtDisposal = () => {
    const acquisitionCost = parseFloat(newCgtDisposal.acquisitionCost.replace(/,/g, "")) || 0;
    const disposalProceeds = parseFloat(newCgtDisposal.disposalProceeds.replace(/,/g, "")) || 0;

    if (acquisitionCost <= 0 || disposalProceeds <= 0) {
      setError("Please enter valid acquisition cost and disposal proceeds");
      return;
    }

    const disposal: CGTInput = {
      assetType: newCgtDisposal.assetType,
      assetDescription: newCgtDisposal.assetDescription || "Asset disposal",
      acquisitionDate: "2020-01-01",
      acquisitionCost,
      disposalDate: new Date().toISOString().split('T')[0],
      disposalProceeds,
    };

    setCgtDisposals((prev) => [...prev, disposal]);
    setNewCgtDisposal({ assetType: "real_estate", assetDescription: "", acquisitionCost: "", disposalProceeds: "" });
    setError(null);
  };

  const handleRemoveCgtDisposal = (index: number) => {
    setCgtDisposals((prev) => prev.filter((_, i) => i !== index));
  };

  // Stamp Duty handlers
  const handleAddStampDuty = () => {
    const transactionValue = parseFloat(newStampDuty.transactionValue.replace(/,/g, "")) || 0;

    if (transactionValue <= 0) {
      setError("Please enter a valid transaction value");
      return;
    }

    const doc: StampDutyInput = {
      documentType: newStampDuty.documentType as StampDutyInput['documentType'],
      transactionValue,
    };

    setStampDutyDocs((prev) => [...prev, doc]);
    setNewStampDuty({ documentType: "deed", transactionValue: "" });
    setError(null);
  };

  const handleRemoveStampDuty = (index: number) => {
    setStampDutyDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    setError(null);
  };

  const handleCalculate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/calculateTax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, inputs }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to calculate tax");
      }

      const taxResult: TaxResult = await response.json();
      setResult(taxResult);

      // Fetch optimization suggestions
      try {
        const optimizeResponse = await fetch("/api/optimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile, inputs, result: taxResult }),
        });

        if (optimizeResponse.ok) {
          const optimizationResult: TaxOptimizationResult = await optimizeResponse.json();
          setOptimizations(optimizationResult);
        }
      } catch {
        // Silently fail optimization - it's not critical
        console.warn("Could not fetch optimization suggestions");
      }

      // Calculate WHT if there are payments
      if (whtPayments.length > 0) {
        try {
          const whtResponse = await fetch("/api/wht", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payments: whtPayments }),
          });

          if (whtResponse.ok) {
            const whtData: WHTResult = await whtResponse.json();
            setWhtResult(whtData);
          }
        } catch {
          console.warn("Could not calculate WHT");
        }
      } else {
        setWhtResult(null);
      }

      // Calculate CGT if there are disposals
      if (cgtDisposals.length > 0) {
        try {
          const cgtResponse = await fetch("/api/cgt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ disposals: cgtDisposals }),
          });

          if (cgtResponse.ok) {
            const cgtData = await cgtResponse.json();
            setCgtResult({ totalGain: cgtData.totalGain, totalCGT: cgtData.totalCGT });
          }
        } catch {
          console.warn("Could not calculate CGT");
        }
      } else {
        setCgtResult(null);
      }

      // Calculate TET for companies
      if (profile.taxpayerType === "company" && taxResult.taxableIncome > 0) {
        try {
          const tetResponse = await fetch("/api/tet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assessableProfit: taxResult.taxableIncome, isCompany: true }),
          });

          if (tetResponse.ok) {
            const tetData: TETResult = await tetResponse.json();
            setTetResult(tetData);
          }
        } catch {
          console.warn("Could not calculate TET");
        }
      } else {
        setTetResult(null);
      }

      // Calculate Stamp Duties if there are documents
      if (stampDutyDocs.length > 0) {
        try {
          const stampResponse = await fetch("/api/stamp-duty", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documents: stampDutyDocs }),
          });

          if (stampResponse.ok) {
            const stampData = await stampResponse.json();
            setStampDutyResult(stampData);
          }
        } catch {
          console.warn("Could not calculate Stamp Duty");
        }
      } else {
        setStampDutyResult(null);
      }

      // Calculate Company Levies for companies
      if (profile.taxpayerType === "company" && taxResult.taxableIncome > 0) {
        try {
          const leviesResponse = await fetch("/api/levies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                netProfit: taxResult.taxableIncome,
                profitBeforeTax: taxResult.taxableIncome,
                industry: leviesInput.industry,
                monthlyPayroll: parseFloat(leviesInput.monthlyPayroll.replace(/,/g, "")) || 0,
                numberOfEmployees: parseInt(leviesInput.numberOfEmployees) || 0,
              annualTurnover: inputs.turnover || inputs.grossRevenue,
                payrollEntries: inputs.payrollEntries || [],
              }),
            });

          if (leviesResponse.ok) {
            const leviesData: CompanyLeviesResult = await leviesResponse.json();
            setLeviesResult(leviesData);
          }
        } catch {
          console.warn("Could not calculate levies");
        }
      } else {
        setLeviesResult(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to compute tax right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!result) return;

    setIsLoading(true);
    setError(null);

    try {
      generatePDF(
        profile,
        inputs,
        result,
        optimizations || undefined,
        whtResult || undefined,
        cgtResult || undefined,
        tetResult || undefined,
        stampDutyResult || undefined,
        leviesResult || undefined,
        withholdingCertificates || undefined
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate PDF. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartOver = () => {
    setStep(1);
    setProfile(initialProfile);
    setInputs(initialInputs);
    setResult(null);
    setOptimizations(null);
    // Reset WHT
    setWhtPayments([]);
    setWhtResult(null);
    setNewWhtPayment({ paymentType: "dividends", amount: "", isResident: true });
    // Reset CGT
    setCgtDisposals([]);
    setCgtResult(null);
    setNewCgtDisposal({ assetType: "real_estate", assetDescription: "", acquisitionCost: "", disposalProceeds: "" });
    // Reset TET
    setTetResult(null);
    // Reset Stamp Duty
    setStampDutyDocs([]);
    setStampDutyResult(null);
    setNewStampDuty({ documentType: "deed", transactionValue: "" });
    // Reset Levies
    setLeviesInput({ industry: "other", monthlyPayroll: "", numberOfEmployees: "" });
    setLeviesResult(null);
    setNewIncomeEntry({ periodLabel: "", revenue: "", expenses: "" });
    setNewPayrollEntry({ month: "", payroll: "", employees: "" });
    setWithholdingCertificates([]);
    setNewCertificate({ payerName: "", certificateNumber: "", issueDate: "", amount: "", fileName: "", fileData: "" });
    setError(null);
  };

  return (
    <>
    <section id="main-calculator" className="max-w-4xl mx-auto w-full">

      {/* Step indicator */}
      {!result && (
        <div className="step-indicator">
          <div className={`step ${step >= 1 ? "active" : ""} ${step > 1 ? "completed" : ""}`}>
            <span className="step-number">1</span>
            <span className="step-label">Profile</span>
          </div>
          <div className={`step-connector ${step > 1 ? "completed" : ""}`}></div>
          <div className={`step ${step >= 2 ? "active" : ""} ${step > 2 ? "completed" : ""}`}>
            <span className="step-number">2</span>
            <span className="step-label">Financial Info</span>
          </div>
          <div className={`step-connector ${step > 2 ? "completed" : ""}`}></div>
          <div className={`step ${step >= 3 ? "active" : ""}`}>
            <span className="step-number">3</span>
            <span className="step-label">Review & Calculate</span>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Form card */}
      {!result && (
        <div className="card">
          {/* Step 1: Profile */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-[var(--primary)]">Step 1: Your Profile</h2>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={profile.fullName}
                  onChange={(e) => handleProfileChange("fullName", e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Business Name <span className="text-[var(--muted)]">(optional)</span>
                </label>
                <input
                  type="text"
                  value={profile.businessName || ""}
                  onChange={(e) => handleProfileChange("businessName", e.target.value)}
                  placeholder="Enter your business name (if applicable)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Taxpayer Type <span className="text-red-500">*</span>
                </label>
                <div className="radio-group">
                  <label className={`radio-option ${profile.taxpayerType === "freelancer" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="taxpayerType"
                      checked={profile.taxpayerType === "freelancer"}
                      onChange={() => handleProfileChange("taxpayerType", "freelancer" as TaxpayerType)}
                    />
                    <div>
                      <div className="font-medium">Individual / Freelancer</div>
                      <div className="text-sm text-[var(--muted)]">Personal Income Tax (PIT)</div>
                    </div>
                  </label>
                  <label className={`radio-option ${profile.taxpayerType === "company" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="taxpayerType"
                      checked={profile.taxpayerType === "company"}
                      onChange={() => handleProfileChange("taxpayerType", "company" as TaxpayerType)}
                    />
                    <div>
                      <div className="font-medium">Company / SME</div>
                      <div className="text-sm text-[var(--muted)]">Company Income Tax (CIT)</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Tax Year <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={profile.taxYear}
                    onChange={(e) => handleProfileChange("taxYear", parseInt(e.target.value) || DEFAULT_TAX_YEAR)}
                    min={2020}
                    max={2030}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    State of Residence <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={profile.stateOfResidence}
                    onChange={(e) => handleProfileChange("stateOfResidence", e.target.value)}
                  >
                    {NIGERIAN_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Are you VAT registered? <span className="text-red-500">*</span>
                </label>
                <div className="radio-group">
                  <label className={`radio-option ${profile.isVATRegistered ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="vatRegistered"
                      checked={profile.isVATRegistered}
                      onChange={() => handleProfileChange("isVATRegistered", true)}
                    />
                    <span>Yes</span>
                  </label>
                  <label className={`radio-option ${!profile.isVATRegistered ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="vatRegistered"
                      checked={!profile.isVATRegistered}
                      onChange={() => handleProfileChange("isVATRegistered", false)}
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button className="btn btn-primary" onClick={handleNext}>
                  Next: Financial Info →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Financial Inputs */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-[var(--primary)]">Step 2: Financial Information</h2>
              <p className="text-[var(--muted)]">Enter all amounts in Nigerian Naira (₦)</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Total Business Income (before expenses) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                    <input
                      type="number"
                      value={inputs.grossRevenue || ""}
                      onChange={(e) => handleInputChange("grossRevenue", e.target.value)}
                      className="pl-8"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Allowable Business Expenses
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                    <input
                      type="number"
                      value={inputs.allowableExpenses || ""}
                      onChange={(e) => handleInputChange("allowableExpenses", e.target.value)}
                      className="pl-8"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[var(--background)] p-4 rounded-lg space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold">Detailed Periodic Income (optional)</h3>
                    <p className="text-sm text-[var(--muted)]">
                      Add monthly or project-based figures. We will keep the totals above in sync with these entries.
                    </p>
                  </div>
                  {inputs.incomeEntries && inputs.incomeEntries.length > 0 && (
                    <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      Auto totals active
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium mb-2">Period Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Jan 2024"
                      value={newIncomeEntry.periodLabel}
                      onChange={(e) => setNewIncomeEntry((prev) => ({ ...prev, periodLabel: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Revenue (₦)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                      <input
                        type="number"
                        min={0}
                        value={newIncomeEntry.revenue}
                        onChange={(e) => setNewIncomeEntry((prev) => ({ ...prev, revenue: e.target.value }))}
                        className="pl-8"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Expenses (₦)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                      <input
                        type="number"
                        min={0}
                        value={newIncomeEntry.expenses}
                        onChange={(e) => setNewIncomeEntry((prev) => ({ ...prev, expenses: e.target.value }))}
                        className="pl-8"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleAddIncomeEntry}
                  >
                    + Add Entry
                  </button>
                </div>

                {inputs.incomeEntries && inputs.incomeEntries.length > 0 && (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Period</th>
                          <th>Revenue</th>
                          <th>Expenses</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {inputs.incomeEntries.map((entry, index) => (
                          <tr key={`${entry.periodLabel}-${index}`}>
                            <td>{entry.periodLabel}</td>
                            <td>{formatCurrency(entry.revenue)}</td>
                            <td>{formatCurrency(entry.expenses)}</td>
                            <td>
                              <button
                                type="button"
                                className="text-red-500 text-sm"
                                onClick={() => handleRemoveIncomeEntry(index)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <h3 className="text-lg font-semibold mt-6">Tax Reliefs & Deductions</h3>
              <p className="text-sm text-[var(--muted)]">Optional — enter if applicable to reduce your taxable income</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Pension Contributions</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                    <input
                      type="number"
                      value={inputs.pensionContributions || ""}
                      onChange={(e) => handleInputChange("pensionContributions", e.target.value)}
                      className="pl-8"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">NHF Contributions</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                    <input
                      type="number"
                      value={inputs.nhfContributions || ""}
                      onChange={(e) => handleInputChange("nhfContributions", e.target.value)}
                      className="pl-8"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Life Insurance Premiums</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                    <input
                      type="number"
                      value={inputs.lifeInsurancePremiums || ""}
                      onChange={(e) => handleInputChange("lifeInsurancePremiums", e.target.value)}
                      className="pl-8"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Other Reliefs</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                    <input
                      type="number"
                      value={inputs.otherReliefs || ""}
                      onChange={(e) => handleInputChange("otherReliefs", e.target.value)}
                      className="pl-8"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {profile.isVATRegistered && (
                <div className="bg-[var(--background)] p-4 rounded-lg space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">VAT Inputs & Credits</h3>
                    <p className="text-sm text-[var(--muted)]">
                      Supply purchases or the actual input VAT you intend to claim. Leave the second field blank to let us infer it from purchases.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Vatable Purchases (₦)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                        <input
                          type="number"
                          value={inputs.vatTaxablePurchases || ""}
                          onChange={(e) => handleInputChange("vatTaxablePurchases", e.target.value)}
                          className="pl-8"
                          placeholder="0.00"
                          min={0}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Input VAT Claimed (₦)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                        <input
                          type="number"
                          value={inputs.inputVATPaid || ""}
                          onChange={(e) => handleInputChange("inputVATPaid", e.target.value)}
                          className="pl-8"
                          placeholder="Leave blank to derive"
                          min={0}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-[var(--background)] p-4 rounded-lg space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Tax Credits & Adjustments</h3>
                  <p className="text-sm text-[var(--muted)]">
                    Capture withholding tax credits, carried-forward losses, and statutory incentives that reduce your eventual tax bill.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Withholding Tax Credits</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                      <input
                        type="number"
                        value={inputs.withholdingTaxCredits || ""}
                        onChange={(e) => handleInputChange("withholdingTaxCredits", e.target.value)}
                        className="pl-8"
                        placeholder="Total WHT evidenced"
                        min={0}
                      />
                    </div>
                  </div>
                  {profile.taxpayerType === "company" && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Carried-Forward Losses</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                        <input
                          type="number"
                          value={inputs.priorYearLosses || ""}
                          onChange={(e) => handleInputChange("priorYearLosses", e.target.value)}
                          className="pl-8"
                          placeholder="0.00"
                          min={0}
                        />
                      </div>
                    </div>
                  )}
                  {profile.taxpayerType === "company" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-2">Investment Allowances</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                          <input
                            type="number"
                            value={inputs.investmentAllowance || ""}
                            onChange={(e) => handleInputChange("investmentAllowance", e.target.value)}
                            className="pl-8"
                            placeholder="0.00"
                            min={0}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Rural Investment Allowance</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                          <input
                            type="number"
                            value={inputs.ruralInvestmentAllowance || ""}
                            onChange={(e) => handleInputChange("ruralInvestmentAllowance", e.target.value)}
                            className="pl-8"
                            placeholder="0.00"
                            min={0}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Pioneer Status Relief</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                          <input
                            type="number"
                            value={inputs.pioneerStatusRelief || ""}
                            onChange={(e) => handleInputChange("pioneerStatusRelief", e.target.value)}
                            className="pl-8"
                            placeholder="0.00"
                            min={0}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {profile.taxpayerType === "company" && (
                  <p className="text-xs text-[var(--muted)]">
                    Carried-forward losses are capped at 4 assessment years for most companies under the Companies Income Tax Act.
                  </p>
                )}

                <div className="pt-4 border-t border-dashed border-[var(--border)] space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <h4 className="text-md font-semibold">Withholding Tax Certificates</h4>
                      <p className="text-sm text-[var(--muted)]">
                        Upload or log tax credit certificates so every ₦ claimed has a matching document.
                      </p>
                    </div>
                    <span className="text-xs text-[var(--muted)]">{withholdingCertificates.length} certificate(s)</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-2">Payer Name</label>
                      <input
                        type="text"
                        value={newCertificate.payerName}
                        onChange={(e) => setNewCertificate((prev) => ({ ...prev, payerName: e.target.value }))}
                        placeholder="Client or withholding agent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Certificate No.</label>
                      <input
                        type="text"
                        value={newCertificate.certificateNumber}
                        onChange={(e) => setNewCertificate((prev) => ({ ...prev, certificateNumber: e.target.value }))}
                        placeholder="e.g. WHT/123"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Issue Date</label>
                      <input
                        type="date"
                        value={newCertificate.issueDate}
                        onChange={(e) => setNewCertificate((prev) => ({ ...prev, issueDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Amount (₦)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                        <input
                          type="number"
                          min={0}
                          value={newCertificate.amount}
                          onChange={(e) => setNewCertificate((prev) => ({ ...prev, amount: e.target.value }))}
                          className="pl-8"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-2">Attach Certificate (PDF/Image)</label>
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) => handleCertificateFileChange(e.target.files?.[0] || null)}
                      />
                      {newCertificate.fileName && (
                        <p className="text-xs text-[var(--muted)] mt-1">Attached: {newCertificate.fileName}</p>
                      )}
                    </div>
                    <div className="md:col-span-1">
                      <button type="button" className="btn btn-secondary w-full" onClick={handleAddCertificate}>
                        + Save Certificate
                      </button>
                    </div>
                  </div>

                  {withholdingCertificates.length > 0 && (
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Payer</th>
                            <th>Certificate No.</th>
                            <th>Date</th>
                            <th>Amount</th>
                            <th>Attachment</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {withholdingCertificates.map((cert) => (
                            <tr key={cert.id}>
                              <td>{cert.payerName}</td>
                              <td>{cert.certificateNumber}</td>
                              <td>{cert.issueDate}</td>
                              <td>{formatCurrency(cert.amount)}</td>
                              <td>
                                {cert.fileData ? (
                                  <a
                                    href={cert.fileData}
                                    download={cert.fileName || `${cert.certificateNumber}.pdf`}
                                    className="text-[var(--accent)] text-sm"
                                  >
                                    Download
                                  </a>
                                ) : (
                                  <span className="text-xs text-[var(--muted)]">Not attached</span>
                                )}
                              </td>
                              <td>
                                <button className="text-red-500 text-sm" onClick={() => handleRemoveCertificate(cert.id)}>
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Company-specific fields */}
              {profile.taxpayerType === "company" && (
                <>
                  <h3 className="text-lg font-semibold mt-6">Company-Specific Information</h3>
                  <p className="text-sm text-[var(--muted)]">Optional — provide for more accurate CIT calculation</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Annual Turnover</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                        <input
                          type="number"
                          value={inputs.turnover || ""}
                          onChange={(e) => handleInputChange("turnover", e.target.value)}
                          className="pl-8"
                          placeholder="Leave blank to use gross revenue"
                          min={0}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Cost of Sales</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                        <input
                          type="number"
                          value={inputs.costOfSales || ""}
                          onChange={(e) => handleInputChange("costOfSales", e.target.value)}
                          className="pl-8"
                          placeholder="0.00"
                          min={0}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Operating Expenses</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                        <input
                          type="number"
                          value={inputs.operatingExpenses || ""}
                          onChange={(e) => handleInputChange("operatingExpenses", e.target.value)}
                          className="pl-8"
                          placeholder="Leave blank to use allowable expenses"
                          min={0}
                        />
                      </div>
                    </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Capital Allowance</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                      <input
                        type="number"
                        value={inputs.capitalAllowance || ""}
                        onChange={(e) => handleInputChange("capitalAllowance", e.target.value)}
                        className="pl-8"
                        placeholder="0.00"
                        min={0}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-[var(--background)] p-4 rounded-lg space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold">Payroll History (optional)</h4>
                    <p className="text-sm text-[var(--muted)]">
                      Log monthly payroll to auto-fill NSITF/ITF assumptions. We average the entries for levy calculations.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium mb-2">Month</label>
                      <input
                        type="month"
                        value={newPayrollEntry.month}
                        onChange={(e) => setNewPayrollEntry((prev) => ({ ...prev, month: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Payroll (₦)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                        <input
                          type="number"
                          min={0}
                          value={newPayrollEntry.payroll}
                          onChange={(e) => setNewPayrollEntry((prev) => ({ ...prev, payroll: e.target.value }))}
                          className="pl-8"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Employees</label>
                      <input
                        type="number"
                        min={0}
                        value={newPayrollEntry.employees}
                        onChange={(e) => setNewPayrollEntry((prev) => ({ ...prev, employees: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleAddPayrollEntry}
                    >
                      + Add Month
                    </button>
                  </div>

                  {inputs.payrollEntries && inputs.payrollEntries.length > 0 && (
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Month</th>
                            <th>Payroll</th>
                            <th>Employees</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {inputs.payrollEntries.map((entry, index) => (
                            <tr key={`${entry.month}-${index}`}>
                              <td>{entry.month}</td>
                              <td>{formatCurrency(entry.grossPayroll)}</td>
                              <td>{entry.employeeCount}</td>
                              <td>
                                <button
                                  type="button"
                                  className="text-red-500 text-sm"
                                  onClick={() => handleRemovePayrollEntry(index)}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                </>
              )}

              {SHOW_AUX_CALCULATORS && (
              <section id="wht-calculator" className="mt-8 pt-6 border-t border-[var(--border)]">
                <h3 className="text-lg font-semibold">Withholding Tax (WHT) Payments</h3>
                <p className="text-sm text-[var(--muted)] mb-4">
                  Optional — add payments you&apos;ve made/received that are subject to WHT
                </p>

                <div className="bg-[var(--background)] p-4 rounded-lg space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium mb-2">Payment Type</label>
                      <select
                        value={newWhtPayment.paymentType}
                        onChange={(e) =>
                          setNewWhtPayment((prev) => ({ ...prev, paymentType: e.target.value }))
                        }
                      >
                        {WHT_RATES.map((rate) => (
                          <option key={rate.paymentType} value={rate.paymentType}>
                            {rate.description}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Amount</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                        <input
                          type="number"
                          value={newWhtPayment.amount}
                          onChange={(e) =>
                            setNewWhtPayment((prev) => ({ ...prev, amount: e.target.value }))
                          }
                          className="pl-8"
                          placeholder="0.00"
                          min={0}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Residency</label>
                      <select
                        value={newWhtPayment.isResident ? "resident" : "non-resident"}
                        onChange={(e) =>
                          setNewWhtPayment((prev) => ({
                            ...prev,
                            isResident: e.target.value === "resident",
                          }))
                        }
                      >
                        <option value="resident">Resident</option>
                        <option value="non-resident">Non-Resident</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleAddWhtPayment}
                    >
                      + Add
                    </button>
                  </div>

                  {/* List of added payments */}
                  {whtPayments.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="text-sm font-medium text-[var(--muted)]">
                        Added Payments ({whtPayments.length})
                      </div>
                      {whtPayments.map((payment, index) => {
                        const rateInfo = getWhtRateInfo(payment.paymentType);
                        const rate = payment.isResident
                          ? rateInfo?.residentRate
                          : rateInfo?.nonResidentRate;
                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-white p-3 rounded-lg border"
                          >
                            <div className="flex-1">
                              <div className="font-medium">
                                {rateInfo?.description || payment.paymentType}
                              </div>
                              <div className="text-sm text-[var(--muted)]">
                                {formatCurrency(payment.amount)} •{" "}
                                {payment.isResident ? "Resident" : "Non-Resident"} •{" "}
                                {rate ? `${(rate * 100).toFixed(0)}% WHT` : ""}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="text-red-500 hover:text-red-700 text-sm font-medium ml-4"
                              onClick={() => handleRemoveWhtPayment(index)}
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
              )}

              {SHOW_AUX_CALCULATORS && (
              <section id="vat-calculator" className="mt-8 pt-6 border-t border-[var(--border)]">
                <h3 className="text-lg font-semibold">Value Added Tax (VAT) Quick Calculator</h3>
                <p className="text-sm text-[var(--muted)] mb-4">
                  Estimate output VAT on your taxable sales and offset with eligible input VAT credits.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Taxable Sales (₦)</label>
                    <input
                      type="number"
                      min={0}
                      value={vatSalesInput}
                      onChange={(e) => setVatSalesInput(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Input VAT Credits (₦)</label>
                    <input
                      type="number"
                      min={0}
                      value={vatInputCredit}
                      onChange={(e) => setVatInputCredit(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-4 mt-4">
                  <div className="rounded-lg border border-[var(--border)] p-4 bg-[var(--background)]">
                    <div className="text-sm text-[var(--muted)]">Output VAT ({(VAT_RATE * 100).toFixed(1)}%)</div>
                    <div className="text-2xl font-semibold mt-2">{formatCurrency(computedOutputVAT)}</div>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] p-4 bg-[var(--background)]">
                    <div className="text-sm text-[var(--muted)]">Input VAT Claimed</div>
                    <div className="text-2xl font-semibold mt-2">{formatCurrency(vatInputAmount)}</div>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] p-4 bg-[var(--background)]">
                    <div className="text-sm text-[var(--muted)]">Net VAT Position</div>
                    <div className={`text-2xl font-semibold mt-2 ${computedNetVAT < 0 ? "text-red-500" : "text-[var(--foreground)]"}`}>
                      {formatCurrency(Math.abs(computedNetVAT))}
                      {computedNetVAT < 0 ? " (Refund)" : ""}
                    </div>
                  </div>
                </div>
              </section>
              )}

              {SHOW_AUX_CALCULATORS && (
              <section id="cgt-calculator" className="mt-8 pt-6 border-t border-[var(--border)]">
                <h3 className="text-lg font-semibold">Capital Gains Tax (CGT)</h3>
                <p className="text-sm text-[var(--muted)] mb-4">
                  Optional — add asset disposals subject to CGT (10% rate)
                </p>

                <div className="bg-[var(--background)] p-4 rounded-lg space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium mb-2">Asset Type</label>
                      <select
                        value={newCgtDisposal.assetType}
                        onChange={(e) =>
                          setNewCgtDisposal((prev) => ({ ...prev, assetType: e.target.value as CGTInput['assetType'] }))
                        }
                      >
                        <option value="real_estate">Real Estate</option>
                        <option value="shares">Shares/Securities</option>
                        <option value="business_assets">Business Assets</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Acquisition Cost</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                        <input
                          type="number"
                          value={newCgtDisposal.acquisitionCost}
                          onChange={(e) =>
                            setNewCgtDisposal((prev) => ({ ...prev, acquisitionCost: e.target.value }))
                          }
                          className="pl-8"
                          placeholder="0.00"
                          min={0}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Disposal Proceeds</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                        <input
                          type="number"
                          value={newCgtDisposal.disposalProceeds}
                          onChange={(e) =>
                            setNewCgtDisposal((prev) => ({ ...prev, disposalProceeds: e.target.value }))
                          }
                          className="pl-8"
                          placeholder="0.00"
                          min={0}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleAddCgtDisposal}
                    >
                      + Add
                    </button>
                  </div>

                  {/* List of CGT disposals */}
                  {cgtDisposals.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="text-sm font-medium text-[var(--muted)]">
                        Asset Disposals ({cgtDisposals.length})
                      </div>
                      {cgtDisposals.map((disposal, index) => {
                        const gain = disposal.disposalProceeds - disposal.acquisitionCost;
                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-white p-3 rounded-lg border"
                          >
                            <div className="flex-1">
                              <div className="font-medium capitalize">
                                {disposal.assetType.replace('_', ' ')}
                              </div>
                              <div className="text-sm text-[var(--muted)]">
                                Cost: {formatCurrency(disposal.acquisitionCost)} → Proceeds: {formatCurrency(disposal.disposalProceeds)} •{" "}
                                <span className={gain > 0 ? "text-green-600" : "text-red-600"}>
                                  {gain > 0 ? "Gain" : "Loss"}: {formatCurrency(Math.abs(gain))}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="text-red-500 hover:text-red-700 text-sm font-medium ml-4"
                              onClick={() => handleRemoveCgtDisposal(index)}
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
              )}

              {/* Stamp Duty Section */}
              <div className="mt-8 pt-6 border-t border-[var(--border)]">
                <h3 className="text-lg font-semibold">Stamp Duties</h3>
                <p className="text-sm text-[var(--muted)] mb-4">
                  Optional — add documents requiring stamp duties
                </p>

                <div className="bg-[var(--background)] p-4 rounded-lg space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium mb-2">Document Type</label>
                      <select
                        value={newStampDuty.documentType}
                        onChange={(e) =>
                          setNewStampDuty((prev) => ({ ...prev, documentType: e.target.value as StampDutyInput['documentType'] }))
                        }
                      >
                        {STAMP_DUTY_RATES.map((rate) => (
                          <option key={rate.documentType} value={rate.documentType}>
                            {rate.description}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Transaction Value</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                        <input
                          type="number"
                          value={newStampDuty.transactionValue}
                          onChange={(e) =>
                            setNewStampDuty((prev) => ({ ...prev, transactionValue: e.target.value }))
                          }
                          className="pl-8"
                          placeholder="0.00"
                          min={0}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleAddStampDuty}
                    >
                      + Add
                    </button>
                  </div>

                  {/* List of stamp duty documents */}
                  {stampDutyDocs.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="text-sm font-medium text-[var(--muted)]">
                        Documents ({stampDutyDocs.length})
                      </div>
                      {stampDutyDocs.map((doc, index) => {
                        const rateInfo = STAMP_DUTY_RATES.find(r => r.documentType === doc.documentType);
                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-white p-3 rounded-lg border"
                          >
                            <div className="flex-1">
                              <div className="font-medium">
                                {rateInfo?.description || doc.documentType}
                              </div>
                              <div className="text-sm text-[var(--muted)]">
                                Transaction Value: {formatCurrency(doc.transactionValue)}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="text-red-500 hover:text-red-700 text-sm font-medium ml-4"
                              onClick={() => handleRemoveStampDuty(index)}
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Company Levies Section - Only for Companies */}
              {profile.taxpayerType === "company" && (
                <div className="mt-8 pt-6 border-t border-[var(--border)]">
                  <h3 className="text-lg font-semibold">Company Levies</h3>
                  <p className="text-sm text-[var(--muted)] mb-4">
                    Additional statutory levies for companies (Police, NASENI, NSITF, ITF)
                  </p>

                  <div className="bg-[var(--background)] p-4 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Industry</label>
                        <select
                          value={leviesInput.industry}
                          onChange={(e) =>
                            setLeviesInput((prev) => ({ ...prev, industry: e.target.value }))
                          }
                        >
                          <option value="other">Other</option>
                          <option value="banking">Banking</option>
                          <option value="mobile_telecom">Mobile Telecom</option>
                          <option value="ict">ICT</option>
                          <option value="aviation">Aviation</option>
                          <option value="maritime">Maritime</option>
                          <option value="oil_gas">Oil & Gas</option>
                        </select>
                        <p className="text-xs text-[var(--muted)] mt-1">
                          NASENI levy (0.25%) applies to banking, telecom, ICT, aviation, maritime, oil & gas
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Monthly Payroll</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">₦</span>
                          <input
                            type="number"
                            value={leviesInput.monthlyPayroll}
                            onChange={(e) =>
                              setLeviesInput((prev) => ({ ...prev, monthlyPayroll: e.target.value }))
                            }
                            className="pl-8"
                            placeholder="0.00"
                            min={0}
                          />
                        </div>
                        <p className="text-xs text-[var(--muted)] mt-1">For NSITF (1%) and ITF (1%)</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Number of Employees</label>
                        <input
                          type="number"
                          value={leviesInput.numberOfEmployees}
                          onChange={(e) =>
                            setLeviesInput((prev) => ({ ...prev, numberOfEmployees: e.target.value }))
                          }
                          placeholder="0"
                          min={0}
                        />
                        <p className="text-xs text-[var(--muted)] mt-1">ITF applies if 5+ employees</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between mt-6">
                <button className="btn btn-secondary" onClick={handleBack}>
                  ← Back
                </button>
                <button className="btn btn-primary" onClick={handleNext}>
                  Next: Review →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Calculate */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-[var(--primary)]">Step 3: Review & Calculate</h2>
              <p className="text-[var(--muted)]">Please review your information before calculating</p>

              <div className="bg-[var(--background)] p-4 rounded-lg space-y-4">
                <h3 className="font-semibold">Profile Summary</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-[var(--muted)]">Full Name:</div>
                  <div>{profile.fullName}</div>
                  {profile.businessName && (
                    <>
                      <div className="text-[var(--muted)]">Business Name:</div>
                      <div>{profile.businessName}</div>
                    </>
                  )}
                  <div className="text-[var(--muted)]">Taxpayer Type:</div>
                  <div>{profile.taxpayerType === "freelancer" ? "Individual/Freelancer" : "Company/SME"}</div>
                  <div className="text-[var(--muted)]">Tax Year:</div>
                  <div>{profile.taxYear}</div>
                  <div className="text-[var(--muted)]">State:</div>
                  <div>{profile.stateOfResidence}</div>
                  <div className="text-[var(--muted)]">VAT Registered:</div>
                  <div>{profile.isVATRegistered ? "Yes" : "No"}</div>
                </div>
              </div>

              <div className="bg-[var(--background)] p-4 rounded-lg space-y-4">
                <h3 className="font-semibold">Financial Summary</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-[var(--muted)]">Gross Revenue:</div>
                  <div>{formatCurrency(inputs.grossRevenue)}</div>
                  <div className="text-[var(--muted)]">Allowable Expenses:</div>
                  <div>{formatCurrency(inputs.allowableExpenses)}</div>
                  {(inputs.pensionContributions ?? 0) > 0 && (
                    <>
                      <div className="text-[var(--muted)]">Pension:</div>
                      <div>{formatCurrency(inputs.pensionContributions ?? 0)}</div>
                    </>
                  )}
                  {(inputs.nhfContributions ?? 0) > 0 && (
                    <>
                      <div className="text-[var(--muted)]">NHF:</div>
                      <div>{formatCurrency(inputs.nhfContributions ?? 0)}</div>
                    </>
                  )}
                  {(inputs.lifeInsurancePremiums ?? 0) > 0 && (
                    <>
                      <div className="text-[var(--muted)]">Life Insurance:</div>
                      <div>{formatCurrency(inputs.lifeInsurancePremiums ?? 0)}</div>
                    </>
                  )}
                  {(inputs.otherReliefs ?? 0) > 0 && (
                    <>
                      <div className="text-[var(--muted)]">Other Reliefs:</div>
                      <div>{formatCurrency(inputs.otherReliefs ?? 0)}</div>
                    </>
                  )}
                </div>
              </div>

              {inputs.incomeEntries && inputs.incomeEntries.length > 0 && (
                <div className="bg-[var(--background)] p-4 rounded-lg space-y-3">
                  <h3 className="font-semibold">Detailed Income Entries ({inputs.incomeEntries.length})</h3>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Period</th>
                          <th>Revenue</th>
                          <th>Expenses</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inputs.incomeEntries.map((entry, index) => (
                          <tr key={`${entry.periodLabel}-${index}`}>
                            <td>{entry.periodLabel}</td>
                            <td>{formatCurrency(entry.revenue)}</td>
                            <td>{formatCurrency(entry.expenses)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {profile.taxpayerType === "company" && inputs.payrollEntries && inputs.payrollEntries.length > 0 && (
                <div className="bg-[var(--background)] p-4 rounded-lg space-y-3">
                  <h3 className="font-semibold">Payroll Snapshot</h3>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th>Payroll</th>
                          <th>Employees</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inputs.payrollEntries.map((entry, index) => (
                          <tr key={`${entry.month}-${index}`}>
                            <td>{entry.month}</td>
                            <td>{formatCurrency(entry.grossPayroll)}</td>
                            <td>{entry.employeeCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {profile.isVATRegistered && (
                <div className="bg-[var(--background)] p-4 rounded-lg space-y-2">
                  <h3 className="font-semibold">VAT Inputs</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-[var(--muted)]">Vatable Purchases:</div>
                    <div>{formatCurrency(inputs.vatTaxablePurchases || 0)}</div>
                    <div className="text-[var(--muted)]">Input VAT Claimed:</div>
                    <div>{formatCurrency(typeof inputs.inputVATPaid === "number" ? inputs.inputVATPaid : (inputs.vatTaxablePurchases || 0) * VAT_RATE)}</div>
                  </div>
                </div>
              )}

              {(inputs.withholdingTaxCredits ?? 0) > 0 ||
                (profile.taxpayerType === "company" && ((inputs.priorYearLosses ?? 0) > 0 || (inputs.investmentAllowance ?? 0) > 0 || (inputs.ruralInvestmentAllowance ?? 0) > 0 || (inputs.pioneerStatusRelief ?? 0) > 0)) ? (
                <div className="bg-[var(--background)] p-4 rounded-lg space-y-2">
                  <h3 className="font-semibold">Credits & Adjustments</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {(inputs.withholdingTaxCredits ?? 0) > 0 && (
                      <>
                        <div className="text-[var(--muted)]">WHT Credits:</div>
                        <div>{formatCurrency(inputs.withholdingTaxCredits ?? 0)}</div>
                      </>
                    )}
                    {profile.taxpayerType === "company" && (inputs.priorYearLosses ?? 0) > 0 && (
                      <>
                        <div className="text-[var(--muted)]">Carried-Forward Losses:</div>
                        <div>{formatCurrency(inputs.priorYearLosses ?? 0)}</div>
                      </>
                    )}
                    {profile.taxpayerType === "company" && (inputs.investmentAllowance ?? 0) > 0 && (
                      <>
                        <div className="text-[var(--muted)]">Investment Allowance:</div>
                        <div>{formatCurrency(inputs.investmentAllowance ?? 0)}</div>
                      </>
                    )}
                    {profile.taxpayerType === "company" && (inputs.ruralInvestmentAllowance ?? 0) > 0 && (
                      <>
                        <div className="text-[var(--muted)]">Rural Investment Allowance:</div>
                        <div>{formatCurrency(inputs.ruralInvestmentAllowance ?? 0)}</div>
                      </>
                    )}
                    {profile.taxpayerType === "company" && (inputs.pioneerStatusRelief ?? 0) > 0 && (
                      <>
                        <div className="text-[var(--muted)]">Pioneer Relief:</div>
                        <div>{formatCurrency(inputs.pioneerStatusRelief ?? 0)}</div>
                      </>
                    )}
                  </div>
                </div>
              ) : null}

              {withholdingCertificates.length > 0 && (
                <div className="bg-[var(--background)] p-4 rounded-lg space-y-3">
                  <h3 className="font-semibold">WHT Certificates</h3>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Payer</th>
                          <th>Certificate No.</th>
                          <th>Date</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {withholdingCertificates.map((cert) => (
                          <tr key={cert.id}>
                            <td>{cert.payerName}</td>
                            <td>{cert.certificateNumber}</td>
                            <td>{cert.issueDate}</td>
                            <td>{formatCurrency(cert.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-between mt-6">
                <button className="btn btn-secondary" onClick={handleBack}>
                  ← Back
                </button>
                <button
                  className="btn btn-accent"
                  onClick={handleCalculate}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner mr-2"></span>
                      Calculating...
                    </>
                  ) : (
                    "Calculate Tax 🧮"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-[var(--primary)]">Tax Computation Results</h2>
              <button className="btn btn-secondary text-sm" onClick={handleStartOver}>
                Start Over
              </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-[var(--background)] p-4 rounded-lg text-center">
                <div className="text-sm text-[var(--muted)]">Taxable Income</div>
                <div className="text-2xl font-bold text-[var(--primary)]">
                  {formatCurrency(result.taxableIncome)}
                </div>
              </div>
              <div className="bg-[var(--accent)] text-white p-4 rounded-lg text-center">
                <div className="text-sm opacity-80">Total Tax Due</div>
                <div className="text-2xl font-bold">
                  {formatCurrency(result.totalTaxDue)}
                </div>
              </div>
              <div className="bg-[var(--background)] p-4 rounded-lg text-center">
                <div className="text-sm text-[var(--muted)]">Effective Rate</div>
                <div className="text-2xl font-bold text-[var(--primary)]">
                  {formatPercent(result.effectiveRate)}
                </div>
              </div>
            </div>

            <div className="bg-[var(--background)] p-4 rounded-lg mb-6">
              <div className="text-sm text-[var(--muted)]">Rule Set</div>
              <div className="font-semibold">{result.taxRuleMetadata.version}</div>
              <div className="text-sm text-[var(--muted)]">
                Source: {result.taxRuleMetadata.source}
                {result.taxRuleMetadata.lastUpdated && ` • Updated ${new Date(result.taxRuleMetadata.lastUpdated).toLocaleDateString()}`}
              </div>
              {result.taxRuleMetadata.remoteUrl && (
                <div className="text-xs text-[var(--muted)] break-words">Remote: {result.taxRuleMetadata.remoteUrl}</div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-[var(--background)] p-4 rounded-lg text-center">
                <div className="text-sm text-[var(--muted)]">Tax Before Credits</div>
                <div className="text-2xl font-bold text-[var(--primary)]">
                  {formatCurrency(result.taxBeforeCredits)}
                </div>
              </div>
              <div className="bg-[var(--background)] p-4 rounded-lg text-center">
                <div className="text-sm text-[var(--muted)]">Credits Applied</div>
                <div className="text-2xl font-bold text-[var(--primary)]">
                  {formatCurrency(result.taxCreditsApplied)}
                </div>
              </div>
            </div>

            {result.validationIssues.length > 0 && (
              <div className="space-y-3 mb-6">
                <h3 className="text-lg font-semibold">Data Quality Checks</h3>
                {result.validationIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`p-3 rounded-lg border ${validationSeverityClasses[issue.severity]}`}
                  >
                    <div className="text-xs uppercase tracking-wide font-semibold">
                      {issue.severity.toUpperCase()} • {issue.field}
                    </div>
                    <div className="text-sm">{issue.message}</div>
                  </div>
                ))}
                <p className="text-xs text-[var(--muted)]">
                  Resolve critical errors before relying on this computation for statutory filings.
                </p>
              </div>
            )}

            {/* Tax breakdown table */}
            <h3 className="text-lg font-semibold mb-3">Tax Breakdown by Band</h3>
            <div className="table-container mb-6">
              <table>
                <thead>
                  <tr>
                    <th>Band</th>
                    <th>Rate</th>
                    <th>Base Amount</th>
                    <th>Tax Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {result.bands.map((band, index) => (
                    <tr key={index}>
                      <td>{band.bandLabel}</td>
                      <td>{formatPercent(band.rate)}</td>
                      <td>{formatCurrency(band.baseAmount)}</td>
                      <td className="font-medium">{formatCurrency(band.taxAmount)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-[var(--background)]">
                    <td colSpan={3}>Total Tax Due</td>
                    <td>{formatCurrency(result.totalTaxDue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {result.calculationTrace.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mb-3">Calculation Trace</h3>
                <div className="table-container mb-6">
                  <table>
                    <thead>
                      <tr>
                        <th>Step</th>
                        <th>Detail</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.calculationTrace.map((entry, index) => (
                        <tr key={`${entry.step}-${index}`}>
                          <td>{entry.step}</td>
                          <td>{entry.detail}</td>
                          <td>{entry.amount !== undefined ? formatCurrency(entry.amount) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* VAT Summary */}
            {result.vat && (
              <>
                <h3 className="text-lg font-semibold mb-3">VAT Summary</h3>
                <div className="bg-[var(--background)] p-4 rounded-lg mb-6">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-[var(--muted)]">VAT Rate:</div>
                    <div>{formatPercent(result.vat.vatRate)}</div>
                    <div className="text-[var(--muted)]">Output VAT (on sales):</div>
                    <div>{formatCurrency(result.vat.outputVAT)}</div>
                    {result.vat.inputVAT !== undefined && (
                      <>
                        <div className="text-[var(--muted)]">Input VAT (on purchases):</div>
                        <div>{formatCurrency(result.vat.inputVAT)}</div>
                      </>
                    )}
                    <div className="text-[var(--muted)] font-semibold">Net VAT Payable:</div>
                    <div className="font-semibold">{formatCurrency(result.vat.netVATPayable)}</div>
                  </div>
                </div>
              </>
            )}

            {/* WHT Summary */}
            {SHOW_AUX_CALCULATORS && whtResult && whtResult.calculations.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mb-3">Withholding Tax (WHT) Summary</h3>
                <div className="table-container mb-6">
                  <table>
                    <thead>
                      <tr>
                        <th>Payment Type</th>
                        <th>Gross Amount</th>
                        <th>Rate</th>
                        <th>WHT Deducted</th>
                        <th>Net Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {whtResult.calculations.map((calc, index) => (
                        <tr key={index}>
                          <td>
                            {calc.paymentDescription}
                            <span className="text-xs text-[var(--muted)] ml-1">
                              ({calc.isResident ? "R" : "NR"})
                            </span>
                          </td>
                          <td>{formatCurrency(calc.grossAmount)}</td>
                          <td>{formatPercent(calc.rate)}</td>
                          <td className="text-red-600">{formatCurrency(calc.whtAmount)}</td>
                          <td className="font-medium">{formatCurrency(calc.netAmount)}</td>
                        </tr>
                      ))}
                      <tr className="font-bold bg-[var(--background)]">
                        <td>Totals</td>
                        <td>{formatCurrency(whtResult.totalGrossAmount)}</td>
                        <td></td>
                        <td className="text-red-600">{formatCurrency(whtResult.totalWHTDeducted)}</td>
                        <td>{formatCurrency(whtResult.totalNetAmount)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {withholdingCertificates.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mb-3">WHT Certificates on File</h3>
                <div className="table-container mb-6">
                  <table>
                    <thead>
                      <tr>
                        <th>Payer</th>
                        <th>Certificate No.</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {withholdingCertificates.map((cert) => (
                        <tr key={cert.id}>
                          <td>{cert.payerName}</td>
                          <td>{cert.certificateNumber}</td>
                          <td>{cert.issueDate}</td>
                          <td>{formatCurrency(cert.amount)}</td>
                          <td>{cert.fileData ? "Attachment" : "No attachment"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* CGT Summary */}
            {SHOW_AUX_CALCULATORS && cgtResult && cgtResult.totalGain > 0 && (
              <>
                <h3 className="text-lg font-semibold mb-3">Capital Gains Tax (CGT) Summary</h3>
                <div className="summary-box mb-6">
                  <div className="summary-item">
                    <span className="summary-label">Total Chargeable Gains</span>
                    <span className="summary-value">{formatCurrency(cgtResult.totalGain)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">CGT Rate</span>
                    <span className="summary-value">{formatPercent(CGT_RATE)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">CGT Payable</span>
                    <span className="summary-value text-red-600 font-bold">{formatCurrency(cgtResult.totalCGT)}</span>
                  </div>
                </div>
              </>
            )}

            {/* TET Summary - Companies only */}
            {tetResult && tetResult.isApplicable && (
              <>
                <h3 className="text-lg font-semibold mb-3">Tertiary Education Tax (TET)</h3>
                <div className="summary-box mb-6">
                  <div className="summary-item">
                    <span className="summary-label">Assessable Profit</span>
                    <span className="summary-value">{formatCurrency(tetResult.assessableProfit)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">TET Rate</span>
                    <span className="summary-value">{formatPercent(TET_RATE)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">TET Payable</span>
                    <span className="summary-value text-red-600 font-bold">{formatCurrency(tetResult.tetPayable)}</span>
                  </div>
                </div>
              </>
            )}

            {/* Stamp Duty Summary */}
            {stampDutyResult && stampDutyResult.totalDuty > 0 && (
              <>
                <h3 className="text-lg font-semibold mb-3">Stamp Duties Summary</h3>
                <div className="table-container mb-6">
                  <table>
                    <thead>
                      <tr>
                        <th>Document Type</th>
                        <th>Transaction Value</th>
                        <th>Rate</th>
                        <th>Duty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stampDutyResult.documents.map((doc, index) => (
                        <tr key={index}>
                          <td>{doc.documentDescription}</td>
                          <td>{formatCurrency(doc.transactionValue)}</td>
                          <td>{doc.rate}</td>
                          <td className="font-medium">{formatCurrency(doc.stampDuty)}</td>
                        </tr>
                      ))}
                      <tr className="font-bold bg-[var(--background)]">
                        <td colSpan={3}>Total Stamp Duties</td>
                        <td className="text-red-600">{formatCurrency(stampDutyResult.totalDuty)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Company Levies Summary */}
            {leviesResult && leviesResult.totalLevies > 0 && (
              <>
                <h3 className="text-lg font-semibold mb-3">Company Levies Summary</h3>
                <div className="table-container mb-6">
                  <table>
                    <thead>
                      <tr>
                        <th>Levy Type</th>
                        <th>Rate</th>
                        <th>Amount Payable</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Police Trust Fund</td>
                        <td>{formatPercent(leviesResult.policeLevy.rate)}</td>
                        <td>{formatCurrency(leviesResult.policeLevy.levyPayable)}</td>
                        <td>{leviesResult.policeLevy.isApplicable ? "✓ Applicable" : "—"}</td>
                      </tr>
                      <tr>
                        <td>NASENI Levy</td>
                        <td>{formatPercent(leviesResult.naseniLevy.rate)}</td>
                        <td>{formatCurrency(leviesResult.naseniLevy.levyPayable)}</td>
                        <td>{leviesResult.naseniLevy.isApplicable ? "✓ Applicable" : "— Not applicable"}</td>
                      </tr>
                      <tr>
                        <td>NSITF Contribution</td>
                        <td>{formatPercent(leviesResult.nsitf.rate)}</td>
                        <td>{formatCurrency(leviesResult.nsitf.contributionPayable)}</td>
                        <td>✓ Applicable</td>
                      </tr>
                      <tr>
                        <td>ITF Levy</td>
                        <td>{formatPercent(leviesResult.itf.rate)}</td>
                        <td>{formatCurrency(leviesResult.itf.levyPayable)}</td>
                        <td>{leviesResult.itf.isApplicable ? "✓ Applicable" : "— Not applicable"}</td>
                      </tr>
                      <tr className="font-bold bg-[var(--background)]">
                        <td colSpan={2}>Total Levies</td>
                        <td className="text-red-600">{formatCurrency(leviesResult.totalLevies)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {result.statutoryReferences.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mb-3">Statutory References</h3>
                <ul className="list-disc list-inside text-sm text-[var(--muted)] mb-6 space-y-1">
                  {result.statutoryReferences.map((ref, index) => (
                    <li key={`${ref.citation}-${index}`}>
                      <span className="font-semibold text-[var(--foreground)]">{ref.title}</span> — {ref.citation}. {ref.description}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Notes */}
            {result.notes.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mb-3">Notes</h3>
                <ul className="list-disc list-inside text-sm text-[var(--muted)] mb-6 space-y-1">
                  {result.notes.map((note, index) => (
                    <li key={index}>{note}</li>
                  ))}
                </ul>
              </>
            )}

            {/* Tax Optimization Suggestions */}
            {optimizations && optimizations.suggestions.length > 0 && (
              <div className="optimization-section mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[var(--accent)]">
                    💡 Tax Optimization Tips
                  </h3>
                  {optimizations.totalPotentialSavings > 0 && (
                    <span className="text-sm bg-[var(--accent)] text-white px-3 py-1 rounded-full">
                      Potential Savings: {formatCurrency(optimizations.totalPotentialSavings)}
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  {optimizations.suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-l-4 ${suggestion.priority === "high"
                        ? "bg-green-50 border-green-500"
                        : suggestion.priority === "medium"
                          ? "bg-yellow-50 border-yellow-500"
                          : "bg-gray-50 border-gray-400"
                        }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-[var(--foreground)]">
                            {suggestion.title}
                          </div>
                          <p className="text-sm text-[var(--muted)] mt-1">
                            {suggestion.description}
                          </p>
                        </div>
                        {suggestion.potentialSavings && suggestion.potentialSavings > 0 && (
                          <div className="text-sm font-medium text-[var(--accent)] whitespace-nowrap ml-4">
                            Save ~{formatCurrency(suggestion.potentialSavings)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Download button */}
            <div className="flex justify-center">
              <button
                className="btn btn-primary text-lg px-8"
                onClick={handleDownloadPDF}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner mr-2"></span>
                    Generating PDF...
                  </>
                ) : (
                  "📄 Download PDF Computation Sheet"
                )}
              </button>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="disclaimer">
            <strong>⚠️ Disclaimer:</strong> This computation is an ESTIMATE generated by software based on
            simplified rules and does not constitute tax, legal, or financial advice. Please confirm all
            calculations with the Federal Inland Revenue Service (FIRS), your State Board of Internal Revenue
            (SBIRS), or a qualified tax professional before making any tax-related decisions or filings.
          </div>
        </div>
      )}
      <p className="text-center text-[var(--muted)] mt-10 text-base">
        NaijaTaxAgent helps Nigerian freelancers and small businesses estimate their annual tax and
        generate a printable computation sheet for FIRS or your State Board of Internal Revenue (SBIRS).
      </p>
    </section>
    <TaxAgentChat />
    </>
  );
}
