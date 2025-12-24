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

  // VAT State (Local UI state for inputs)
  const [vatSalesInput, setVatSalesInput] = useState("");
  const [vatInputCredit, setVatInputCredit] = useState("");

  // Derived VAT calculations
  const vatInputAmount = parseFloat(vatInputCredit.replace(/,/g, "") || "0");
  const computedOutputVAT = (inputs.grossRevenue || 0) * (VAT_RATE || 0.075);
  const computedNetVAT = computedOutputVAT - vatInputAmount;

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
      <section id="main-calculator" className="max-w-4xl mx-auto w-full px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Tax Computation Engine</h1>
          <p className="text-sm text-gray-500 mt-1">Complete your profile and financial inputs to generate precise tax estimates.</p>
        </div>

        {/* Step Progress */}
        {!result && (
          <nav aria-label="Progress" className="mb-8">
            <ol role="list" className="space-y-4 md:flex md:space-y-0 md:space-x-8">
              <li className="md:flex-1">
                <div className={`group flex flex-col border-l-4 ${step >= 1 ? 'border-primary' : 'border-gray-200'} py-2 pl-4 hover:border-primary-dark transition-colors md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4`}>
                  <span className={`text-sm font-medium ${step >= 1 ? 'text-primary' : 'text-gray-500'}`}>Step 1</span>
                  <span className="text-sm font-bold text-gray-900">Profile & Entity</span>
                </div>
              </li>
              <li className="md:flex-1">
                <div className={`group flex flex-col border-l-4 ${step >= 2 ? 'border-primary' : 'border-gray-200'} py-2 pl-4 hover:border-primary-dark transition-colors md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4`}>
                  <span className={`text-sm font-medium ${step >= 2 ? 'text-primary' : 'text-gray-500'}`}>Step 2</span>
                  <span className="text-sm font-bold text-gray-900">Financial Data</span>
                </div>
              </li>
              <li className="md:flex-1">
                <div className={`group flex flex-col border-l-4 ${step >= 3 ? 'border-primary' : 'border-gray-200'} py-2 pl-4 hover:border-primary-dark transition-colors md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4`}>
                  <span className={`text-sm font-medium ${step >= 3 ? 'text-primary' : 'text-gray-500'}`}>Step 3</span>
                  <span className="text-sm font-bold text-gray-900">Review & Calculate</span>
                </div>
              </li>
            </ol>
          </nav>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4 border border-red-200">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">There were validation errors</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form card */}
        {!result && (
          <div className="bg-white shadow sm:rounded-lg overflow-hidden border border-gray-200">
            {/* Step 1: Profile */}
            {step === 1 && (
              <div className="space-y-6 px-4 py-5 sm:p-6">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Profile Information</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Tell us about your entity type to configure the correct tax rules (CIT vs PIT).
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  <div className="sm:col-span-3">
                    <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        name="fullName"
                        id="fullName"
                        value={profile.fullName}
                        onChange={(e) => handleProfileChange("fullName", e.target.value)}
                        className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2"
                        placeholder="Enter your full name"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label htmlFor="businessName" className="block text-sm font-medium text-gray-700">
                      Business Name <span className="text-gray-400 text-xs">(Optional)</span>
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        name="businessName"
                        id="businessName"
                        value={profile.businessName || ""}
                        onChange={(e) => handleProfileChange("businessName", e.target.value)}
                        className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2"
                        placeholder="e.g. Acme Corp"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Taxpayer Type <span className="text-red-500">*</span>
                    </label>
                    <div className="bg-white rounded-md -space-y-px">
                      {/* Radio Group Replacement */}
                      <fieldset>
                        <legend className="sr-only">Taxpayer Type</legend>
                        <div className="space-y-4 sm:flex sm:items-center sm:space-y-0 sm:space-x-4">
                          <div className={`relative flex items-center px-4 py-3 border rounded-lg cursor-pointer hover:bg-gray-50 focus:outline-none ${profile.taxpayerType === 'freelancer' ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'border-gray-200'}`}>
                            <div className="flex items-center h-5">
                              <input
                                id="type-freelancer"
                                name="taxpayerType"
                                type="radio"
                                checked={profile.taxpayerType === "freelancer"}
                                onChange={() => handleProfileChange("taxpayerType", "freelancer" as TaxpayerType)}
                                className="focus:ring-primary h-4 w-4 text-primary border-gray-300"
                              />
                            </div>
                            <div className="ml-3 flex flex-col">
                              <label htmlFor="type-freelancer" className="block text-sm font-medium text-gray-900">
                                Individual / Freelancer
                              </label>
                              <span className="text-xs text-gray-500">Personal Income Tax (PIT)</span>
                            </div>
                          </div>

                          <div className={`relative flex items-center px-4 py-3 border rounded-lg cursor-pointer hover:bg-gray-50 focus:outline-none ${profile.taxpayerType === 'company' ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'border-gray-200'}`}>
                            <div className="flex items-center h-5">
                              <input
                                id="type-company"
                                name="taxpayerType"
                                type="radio"
                                checked={profile.taxpayerType === "company"}
                                onChange={() => handleProfileChange("taxpayerType", "company" as TaxpayerType)}
                                className="focus:ring-primary h-4 w-4 text-primary border-gray-300"
                              />
                            </div>
                            <div className="ml-3 flex flex-col">
                              <label htmlFor="type-company" className="block text-sm font-medium text-gray-900">
                                Company / SME
                              </label>
                              <span className="text-xs text-gray-500">Company Income Tax (CIT)</span>
                            </div>
                          </div>
                        </div>
                      </fieldset>
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label htmlFor="taxYear" className="block text-sm font-medium text-gray-700">
                      Tax Year <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      <input
                        type="number"
                        name="taxYear"
                        id="taxYear"
                        value={profile.taxYear}
                        onChange={(e) => handleProfileChange("taxYear", parseInt(e.target.value) || DEFAULT_TAX_YEAR)}
                        min={2020}
                        max={2030}
                        className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label htmlFor="stateOfResidence" className="block text-sm font-medium text-gray-700">
                      State of Residence <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1">
                      <select
                        id="stateOfResidence"
                        name="stateOfResidence"
                        value={profile.stateOfResidence}
                        onChange={(e) => handleProfileChange("stateOfResidence", e.target.value)}
                        className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2"
                      >
                        {NIGERIAN_STATES.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="sm:col-span-6">
                    <span className="block text-sm font-medium text-gray-700 mb-2">VAT Status</span>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center">
                        <input
                          id="vat-yes"
                          name="vatRegistered"
                          type="radio"
                          checked={profile.isVATRegistered}
                          onChange={() => handleProfileChange("isVATRegistered", true)}
                          className="focus:ring-primary h-4 w-4 text-primary border-gray-300"
                        />
                        <label htmlFor="vat-yes" className="ml-3 block text-sm font-medium text-gray-700">
                          Registered for VAT
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          id="vat-no"
                          name="vatRegistered"
                          type="radio"
                          checked={!profile.isVATRegistered}
                          onChange={() => handleProfileChange("isVATRegistered", false)}
                          className="focus:ring-primary h-4 w-4 text-primary border-gray-300"
                        />
                        <label htmlFor="vat-no" className="ml-3 block text-sm font-medium text-gray-700">
                          Not Registered
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
            {/* Step 1: Manual Next Button */}
            {step === 1 && (
              <div className="px-4 py-3 bg-gray-50 text-right sm:px-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex justify-center py-2.5 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-black bg-[var(--primary)] hover:bg-[var(--primary)]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)] transition-all flex items-center gap-2 ml-auto"
                >
                  Next: Financial Data <span aria-hidden="true">→</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Financial Inputs */}
        {
          step === 2 && (
            <div className="bg-white shadow sm:rounded-lg overflow-hidden border border-gray-200">
              <div className="px-4 py-5 sm:p-6 space-y-8">

                {/* Header */}
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Step 2: Financial Information</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Provide your financials to let us calculate your tax obligations. All amounts in Nigerian Naira (₦).
                  </p>
                </div>

                {/* Core Revenue Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Business Income <span className="text-red-500">*</span>
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">₦</span>
                      </div>
                      <input
                        type="number"
                        value={inputs.grossRevenue || ""}
                        onChange={(e) => handleInputChange("grossRevenue", e.target.value)}
                        className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                        placeholder="0.00"
                        min={0}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Gross revenue before any deductions.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Allowable Business Expenses
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">₦</span>
                      </div>
                      <input
                        type="number"
                        value={inputs.allowableExpenses || ""}
                        onChange={(e) => handleInputChange("allowableExpenses", e.target.value)}
                        className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                        placeholder="0.00"
                        min={0}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Expenses wholly and exclusively incurred for business.</p>
                  </div>
                </div>

                {/* Periodic Income Section */}
                <div className="bg-gray-50/50 rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Detailed Periodic Entries <span className="font-normal text-gray-500">(Optional)</span></h3>
                      <p className="text-xs text-gray-500">Break down income by month or project. Auto-updates totals above.</p>
                    </div>
                    {inputs.incomeEntries && inputs.incomeEntries.length > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Auto-calcs active
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end mb-4">
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Period Label</label>
                      <input
                        type="text"
                        placeholder="e.g. Jan 2024"
                        value={newIncomeEntry.periodLabel}
                        onChange={(e) => setNewIncomeEntry((prev) => ({ ...prev, periodLabel: e.target.value }))}
                        className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Revenue</label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-xs">₦</span>
                        </div>
                        <input
                          type="number"
                          min={0}
                          value={newIncomeEntry.revenue}
                          onChange={(e) => setNewIncomeEntry((prev) => ({ ...prev, revenue: e.target.value }))}
                          className="focus:ring-primary focus:border-primary block w-full pl-6 sm:text-sm border-gray-300 rounded-md"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Expenses</label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-xs">₦</span>
                        </div>
                        <input
                          type="number"
                          min={0}
                          value={newIncomeEntry.expenses}
                          onChange={(e) => setNewIncomeEntry((prev) => ({ ...prev, expenses: e.target.value }))}
                          className="focus:ring-primary focus:border-primary block w-full pl-6 sm:text-sm border-gray-300 rounded-md"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddIncomeEntry}
                        className="w-full inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {inputs.incomeEntries && inputs.incomeEntries.length > 0 && (
                    <div className="overflow-hidden border border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                            <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                            <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Expenses</th>
                            <th scope="col" className="relative px-3 py-2">
                              <span className="sr-only">Remove</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {inputs.incomeEntries.map((entry, index) => (
                            <tr key={`${entry.periodLabel}-${index}`}>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{entry.periodLabel}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-500">{formatCurrency(entry.revenue)}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-500">{formatCurrency(entry.expenses)}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() => handleRemoveIncomeEntry(index)}
                                  className="text-red-500 hover:text-red-700 text-xs"
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

                {/* Separator */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-2 text-sm text-gray-500">Deductions & Adjustments</span>
                  </div>
                </div>

                {/* Reliefs & Deductions */}
                <div>
                  <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Tax Reliefs</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pension Contributions</label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">₦</span>
                        </div>
                        <input
                          type="number"
                          value={inputs.pensionContributions || ""}
                          onChange={(e) => handleInputChange("pensionContributions", e.target.value)}
                          className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                          placeholder="0.00"
                          min={0}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">NHF Contributions</label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">₦</span>
                        </div>
                        <input
                          type="number"
                          value={inputs.nhfContributions || ""}
                          onChange={(e) => handleInputChange("nhfContributions", e.target.value)}
                          className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                          placeholder="0.00"
                          min={0}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Life Insurance Premiums</label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">₦</span>
                        </div>
                        <input
                          type="number"
                          value={inputs.lifeInsurancePremiums || ""}
                          onChange={(e) => handleInputChange("lifeInsurancePremiums", e.target.value)}
                          className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                          placeholder="0.00"
                          min={0}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Other Reliefs</label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">₦</span>
                        </div>
                        <input
                          type="number"
                          value={inputs.otherReliefs || ""}
                          onChange={(e) => handleInputChange("otherReliefs", e.target.value)}
                          className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                          placeholder="0.00"
                          min={0}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* VAT Section */}
                {profile.isVATRegistered && (
                  <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-2">VAT Inputs & Credits</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Enter your input VAT details to correctly calculate net VAT payable.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Vatable Purchases</label>
                        <div className="relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">₦</span>
                          </div>
                          <input
                            type="number"
                            value={inputs.vatTaxablePurchases || ""}
                            onChange={(e) => handleInputChange("vatTaxablePurchases", e.target.value)}
                            className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                            placeholder="0.00"
                            min={0}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Input VAT Claimed</label>
                        <div className="relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">₦</span>
                          </div>
                          <input
                            type="number"
                            value={inputs.inputVATPaid || ""}
                            onChange={(e) => handleInputChange("inputVATPaid", e.target.value)}
                            className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                            placeholder="Leave blank to derive"
                            min={0}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tax Credits & Adjustments */}
                <div>
                  <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Credits & Incentives</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Withholding Tax Credits</label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">₦</span>
                        </div>
                        <input
                          type="number"
                          value={inputs.withholdingTaxCredits || ""}
                          onChange={(e) => handleInputChange("withholdingTaxCredits", e.target.value)}
                          className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                          placeholder="Total WHT evidenced"
                          min={0}
                        />
                      </div>
                    </div>

                    {profile.taxpayerType === "company" && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Carried-Forward Losses</label>
                          <div className="relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 sm:text-sm">₦</span>
                            </div>
                            <input
                              type="number"
                              value={inputs.priorYearLosses || ""}
                              onChange={(e) => handleInputChange("priorYearLosses", e.target.value)}
                              className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                              placeholder="0.00"
                              min={0}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Investment Allowances</label>
                          <div className="relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 sm:text-sm">₦</span>
                            </div>
                            <input
                              type="number"
                              value={inputs.investmentAllowance || ""}
                              onChange={(e) => handleInputChange("investmentAllowance", e.target.value)}
                              className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                              placeholder="0.00"
                              min={0}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Rural Investment Allowance</label>
                          <div className="relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 sm:text-sm">₦</span>
                            </div>
                            <input
                              type="number"
                              value={inputs.ruralInvestmentAllowance || ""}
                              onChange={(e) => handleInputChange("ruralInvestmentAllowance", e.target.value)}
                              className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                              placeholder="0.00"
                              min={0}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Pioneer Status Relief</label>
                          <div className="relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 sm:text-sm">₦</span>
                            </div>
                            <input
                              type="number"
                              value={inputs.pioneerStatusRelief || ""}
                              onChange={(e) => handleInputChange("pioneerStatusRelief", e.target.value)}
                              className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                              placeholder="0.00"
                              min={0}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* WHT Certificates Section */}
                <div className="bg-gray-50/50 rounded-lg border border-gray-200 p-4">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Withholding Tax Certificates</h3>
                      <p className="text-xs text-gray-500">Attach evidence for your WHT credits.</p>
                    </div>
                    <span className="text-xs font-medium text-gray-500">{withholdingCertificates.length} attached</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end mb-4">
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Payer Name</label>
                      <input
                        type="text"
                        value={newCertificate.payerName}
                        onChange={(e) => setNewCertificate((prev) => ({ ...prev, payerName: e.target.value }))}
                        className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                        placeholder="Payer Name"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Cert No.</label>
                      <input
                        type="text"
                        value={newCertificate.certificateNumber}
                        onChange={(e) => setNewCertificate((prev) => ({ ...prev, certificateNumber: e.target.value }))}
                        className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                        placeholder="WHT/..."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={newCertificate.issueDate}
                        onChange={(e) => setNewCertificate((prev) => ({ ...prev, issueDate: e.target.value }))}
                        className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-xs">₦</span>
                        </div>
                        <input
                          type="number"
                          min={0}
                          value={newCertificate.amount}
                          onChange={(e) => setNewCertificate((prev) => ({ ...prev, amount: e.target.value }))}
                          className="focus:ring-primary focus:border-primary block w-full pl-6 sm:text-sm border-gray-300 rounded-md"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">File</label>
                      <div className="flex gap-2">
                        <input
                          type="file"
                          className="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800"
                          accept="application/pdf,image/*"
                          onChange={(e) => handleCertificateFileChange(e.target.files?.[0] || null)}
                        />
                        <button
                          type="button"
                          onClick={handleAddCertificate}
                          className="inline-flex items-center px-3 py-1 border border-transparent shadow-sm text-xs font-medium rounded-md text-white bg-black hover:bg-gray-800 focus:outline-none"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>

                  {withholdingCertificates.length > 0 && (
                    <div className="overflow-hidden border border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payer</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ref</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Doc</th>
                            <th className="relative px-3 py-2"><span className="sr-only">Delete</span></th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {withholdingCertificates.map((cert) => (
                            <tr key={cert.id}>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{cert.payerName}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{cert.certificateNumber}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-900">{formatCurrency(cert.amount)}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-center text-xs">
                                {cert.fileData ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                    PDF
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() => handleRemoveCertificate(cert.id)}
                                  className="text-red-600 hover:text-red-900 text-xs"
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

                {/* Company Specific Extras */}
                {profile.taxpayerType === "company" && (
                  <div className="pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Additional Company Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Annual Turnover</label>
                        <div className="relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">₦</span>
                          </div>
                          <input
                            type="number"
                            value={inputs.turnover || ""}
                            onChange={(e) => handleInputChange("turnover", e.target.value)}
                            className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                            placeholder="If different from gross revenue"
                            min={0}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cost of Sales</label>
                        <div className="relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">₦</span>
                          </div>
                          <input
                            type="number"
                            value={inputs.costOfSales || ""}
                            onChange={(e) => handleInputChange("costOfSales", e.target.value)}
                            className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                            placeholder="Direct costs"
                            min={0}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Operating Expenses</label>
                        <div className="relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">₦</span>
                          </div>
                          <input
                            type="number"
                            value={inputs.operatingExpenses || ""}
                            onChange={(e) => handleInputChange("operatingExpenses", e.target.value)}
                            className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                            placeholder="OpEx"
                            min={0}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Capital Allowance</label>
                        <div className="relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">₦</span>
                          </div>
                          <input
                            type="number"
                            value={inputs.capitalAllowance || ""}
                            onChange={(e) => handleInputChange("capitalAllowance", e.target.value)}
                            className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                            placeholder="Claimable allowance"
                            min={0}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Payroll History */}
                    <div className="bg-gray-50/50 rounded-lg p-4 border border-gray-200 mt-6">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">Payroll History <span className="font-normal text-gray-500">(Optional)</span></h4>
                        <p className="text-xs text-gray-500 mb-3">
                          Log monthly payroll to auto-fill NSITF/ITF assumptions.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Month</label>
                          <input
                            type="month"
                            value={newPayrollEntry.month}
                            onChange={(e) => setNewPayrollEntry((prev) => ({ ...prev, month: e.target.value }))}
                            className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Payroll (₦)</label>
                          <div className="relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                              <span className="text-gray-500 sm:text-xs">₦</span>
                            </div>
                            <input
                              type="number"
                              min={0}
                              value={newPayrollEntry.payroll}
                              onChange={(e) => setNewPayrollEntry((prev) => ({ ...prev, payroll: e.target.value }))}
                              className="focus:ring-primary focus:border-primary block w-full pl-6 sm:text-sm border-gray-300 rounded-md"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Employees</label>
                          <input
                            type="number"
                            min={0}
                            value={newPayrollEntry.employees}
                            onChange={(e) => setNewPayrollEntry((prev) => ({ ...prev, employees: e.target.value }))}
                            className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                            placeholder="0"
                          />
                        </div>
                        <button
                          type="button"
                          className="w-full inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                          onClick={handleAddPayrollEntry}
                        >
                          Add
                        </button>
                      </div>

                      {inputs.payrollEntries && inputs.payrollEntries.length > 0 && (
                        <div className="mt-4 overflow-hidden border border-gray-200 rounded-lg">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payroll</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employees</th>
                                <th className="relative px-3 py-2"><span className="sr-only">Delete</span></th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {inputs.payrollEntries.map((entry, index) => (
                                <tr key={`${entry.month}-${index}`}>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{entry.month}</td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{formatCurrency(entry.grossPayroll)}</td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{entry.employeeCount}</td>
                                  <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                      type="button"
                                      className="text-red-500 hover:text-red-700 text-xs"
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
                  </div>
                )}



                {SHOW_AUX_CALCULATORS && (
                  <section id="wht-calculator" className="mt-8 pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Withholding Tax (WHT) Payments</h3>
                    <p className="mt-1 text-sm text-gray-500 mb-4">
                      Optional: Add payments you&apos;ve made or received that are subject to WHT.
                    </p>

                    <div className="bg-gray-50/50 rounded-lg border border-gray-200 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Payment Type</label>
                          <select
                            value={newWhtPayment.paymentType}
                            onChange={(e) =>
                              setNewWhtPayment((prev) => ({ ...prev, paymentType: e.target.value }))
                            }
                            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                          >
                            {WHT_RATES.map((rate) => (
                              <option key={rate.paymentType} value={rate.paymentType}>
                                {rate.description}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
                          <div className="relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 sm:text-xs">₦</span>
                            </div>
                            <input
                              type="number"
                              value={newWhtPayment.amount}
                              onChange={(e) =>
                                setNewWhtPayment((prev) => ({ ...prev, amount: e.target.value }))
                              }
                              className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                              placeholder="0.00"
                              min={0}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Residency</label>
                          <select
                            value={newWhtPayment.isResident ? "resident" : "non-resident"}
                            onChange={(e) =>
                              setNewWhtPayment((prev) => ({
                                ...prev,
                                isResident: e.target.value === "resident",
                              }))
                            }
                            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                          >
                            <option value="resident">Resident</option>
                            <option value="non-resident">Non-Resident</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                          onClick={handleAddWhtPayment}
                        >
                          + Add
                        </button>
                      </div>

                      {/* List of added payments */}
                      {whtPayments.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                                className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 shadow-sm"
                              >
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900">
                                    {rateInfo?.description || payment.paymentType}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {formatCurrency(payment.amount)} •{" "}
                                    {payment.isResident ? "Resident" : "Non-Resident"} •{" "}
                                    {rate ? `${(rate * 100).toFixed(0)}% WHT` : ""}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="text-red-500 hover:text-red-700 text-xs font-medium ml-4"
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
                  <section id="vat-calculator" className="mt-8 pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Value Added Tax (VAT) Quick Calculator</h3>
                    <p className="mt-1 text-sm text-gray-500 mb-4">
                      Estimate output VAT on your taxable sales and offset with eligible input VAT credits.
                    </p>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Taxable Sales</label>
                        <div className="relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">₦</span>
                          </div>
                          <input
                            type="number"
                            min={0}
                            value={vatSalesInput}
                            onChange={(e) => setVatSalesInput(e.target.value)}
                            className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Input VAT Credits</label>
                        <div className="relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">₦</span>
                          </div>
                          <input
                            type="number"
                            min={0}
                            value={vatInputCredit}
                            onChange={(e) => setVatInputCredit(e.target.value)}
                            className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4 mt-4">
                      <div className="rounded-lg border border-gray-200 p-4 bg-gray-50/50 text-center">
                        <div className="text-xs font-medium text-gray-500 uppercase">Output VAT ({(VAT_RATE * 100).toFixed(1)}%)</div>
                        <div className="text-xl font-bold text-gray-900 mt-2">{formatCurrency(computedOutputVAT)}</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 p-4 bg-gray-50/50 text-center">
                        <div className="text-xs font-medium text-gray-500 uppercase">Input VAT Claimed</div>
                        <div className="text-xl font-bold text-gray-900 mt-2">{formatCurrency(vatInputAmount)}</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 p-4 bg-gray-50/50 text-center">
                        <div className="text-xs font-medium text-gray-500 uppercase">Net VAT Position</div>
                        <div className={`text-xl font-bold mt-2 ${computedNetVAT < 0 ? "text-green-600" : "text-gray-900"}`}>
                          {formatCurrency(Math.abs(computedNetVAT))}
                          {computedNetVAT < 0 ? " (Refund)" : ""}
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {SHOW_AUX_CALCULATORS && (
                  <section id="cgt-calculator" className="mt-8 pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Capital Gains Tax (CGT)</h3>
                    <p className="mt-1 text-sm text-gray-500 mb-4">
                      Optional: Add asset disposals subject to CGT (10% rate).
                    </p>

                    <div className="bg-gray-50/50 rounded-lg border border-gray-200 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Asset Type</label>
                          <select
                            value={newCgtDisposal.assetType}
                            onChange={(e) =>
                              setNewCgtDisposal((prev) => ({ ...prev, assetType: e.target.value as CGTInput['assetType'] }))
                            }
                            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                          >
                            <option value="real_estate">Real Estate</option>
                            <option value="shares">Shares/Securities</option>
                            <option value="business_assets">Business Assets</option>
                            <option value="other">Other</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Acquisition Cost</label>
                          <div className="relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 sm:text-xs">₦</span>
                            </div>
                            <input
                              type="number"
                              value={newCgtDisposal.acquisitionCost}
                              onChange={(e) =>
                                setNewCgtDisposal((prev) => ({ ...prev, acquisitionCost: e.target.value }))
                              }
                              className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                              placeholder="0.00"
                              min={0}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Disposal Proceeds</label>
                          <div className="relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 sm:text-xs">₦</span>
                            </div>
                            <input
                              type="number"
                              value={newCgtDisposal.disposalProceeds}
                              onChange={(e) =>
                                setNewCgtDisposal((prev) => ({ ...prev, disposalProceeds: e.target.value }))
                              }
                              className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                              placeholder="0.00"
                              min={0}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                          onClick={handleAddCgtDisposal}
                        >
                          + Add
                        </button>
                      </div>

                      {/* List of CGT disposals */}
                      {cgtDisposals.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Asset Disposals ({cgtDisposals.length})
                          </div>
                          {cgtDisposals.map((disposal, index) => {
                            const gain = disposal.disposalProceeds - disposal.acquisitionCost;
                            return (
                              <div
                                key={index}
                                className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 shadow-sm"
                              >
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900 capitalize">
                                    {disposal.assetType.replace('_', ' ')}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    Cost: {formatCurrency(disposal.acquisitionCost)} → Proceeds: {formatCurrency(disposal.disposalProceeds)} •{" "}
                                    <span className={gain > 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                      {gain > 0 ? "Gain" : "Loss"}: {formatCurrency(Math.abs(gain))}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="text-red-500 hover:text-red-700 text-xs font-medium ml-4"
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
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">Stamp Duties</h3>
                  <p className="mt-1 text-sm text-gray-500 mb-4">
                    Optional: Add documents requiring stamp duties.
                  </p>

                  <div className="bg-gray-50/50 rounded-lg border border-gray-200 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Document Type</label>
                        <select
                          value={newStampDuty.documentType}
                          onChange={(e) =>
                            setNewStampDuty((prev) => ({ ...prev, documentType: e.target.value as StampDutyInput['documentType'] }))
                          }
                          className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                        >
                          {STAMP_DUTY_RATES.map((rate) => (
                            <option key={rate.documentType} value={rate.documentType}>
                              {rate.description}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Transaction Value</label>
                        <div className="relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-xs">₦</span>
                          </div>
                          <input
                            type="number"
                            value={newStampDuty.transactionValue}
                            onChange={(e) =>
                              setNewStampDuty((prev) => ({ ...prev, transactionValue: e.target.value }))
                            }
                            className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                            placeholder="0.00"
                            min={0}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                        onClick={handleAddStampDuty}
                      >
                        + Add
                      </button>
                    </div>

                    {/* List of stamp duty documents */}
                    {stampDutyDocs.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Documents ({stampDutyDocs.length})
                        </div>
                        {stampDutyDocs.map((doc, index) => {
                          const rateInfo = STAMP_DUTY_RATES.find(r => r.documentType === doc.documentType);
                          return (
                            <div
                              key={index}
                              className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 shadow-sm"
                            >
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">
                                  {rateInfo?.description || doc.documentType}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Transaction Value: {formatCurrency(doc.transactionValue)}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="text-red-500 hover:text-red-700 text-xs font-medium ml-4"
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
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Company Levies</h3>
                    <p className="mt-1 text-sm text-gray-500 mb-4">
                      Additional statutory levies for companies (Police, NASENI, NSITF, ITF).
                    </p>

                    <div className="bg-gray-50/50 rounded-lg border border-gray-200 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                          <select
                            value={leviesInput.industry}
                            onChange={(e) =>
                              setLeviesInput((prev) => ({ ...prev, industry: e.target.value }))
                            }
                            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                          >
                            <option value="other">Other</option>
                            <option value="banking">Banking</option>
                            <option value="mobile_telecom">Mobile Telecom</option>
                            <option value="ict">ICT</option>
                            <option value="aviation">Aviation</option>
                            <option value="maritime">Maritime</option>
                            <option value="oil_gas">Oil & Gas</option>
                          </select>
                          <p className="text-xs text-gray-500 mt-1">
                            NASENI levy (0.25%) applies to certain sectors.
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Payroll</label>
                          <div className="relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 sm:text-sm">₦</span>
                            </div>
                            <input
                              type="number"
                              value={leviesInput.monthlyPayroll}
                              onChange={(e) =>
                                setLeviesInput((prev) => ({ ...prev, monthlyPayroll: e.target.value }))
                              }
                              className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                              placeholder="0.00"
                              min={0}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">For NSITF and ITF calculations</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Number of Employees</label>
                          <input
                            type="number"
                            value={leviesInput.numberOfEmployees}
                            onChange={(e) =>
                              setLeviesInput((prev) => ({ ...prev, numberOfEmployees: e.target.value }))
                            }
                            className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                            placeholder="0"
                            min={0}
                          />
                          <p className="text-xs text-gray-500 mt-1">ITF applies if 5+ employees</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between mt-6 pt-6 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)] transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-6 py-2.5 text-sm font-medium text-black bg-[var(--primary)] rounded-lg hover:bg-[var(--primary)]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)] transition-all shadow-sm flex items-center gap-2"
                  >
                    Next: Review <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* Step 3: Review & Calculate */}
        {step === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Review & Calculate</h2>
              <p className="text-[var(--muted)]">Please review your information carefully before generating the final tax computation.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="font-semibold text-gray-900">Profile Summary</h3>
                </div>
                <div className="p-6 space-y-4">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                      <dd className="mt-1 text-sm text-gray-900">{profile.fullName}</dd>
                    </div>
                    {profile.businessName && (
                      <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-gray-500">Business Name</dt>
                        <dd className="mt-1 text-sm text-gray-900">{profile.businessName}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Taxpayer Type</dt>
                      <dd className="mt-1 text-sm text-gray-900">{profile.taxpayerType === "freelancer" ? "Individual/Freelancer" : "Company/SME"}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Tax Year</dt>
                      <dd className="mt-1 text-sm text-gray-900">{profile.taxYear}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">State</dt>
                      <dd className="mt-1 text-sm text-gray-900">{profile.stateOfResidence}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">VAT Registered</dt>
                      <dd className="mt-1 text-sm text-gray-900">{profile.isVATRegistered ? "Yes" : "No"}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="font-semibold text-gray-900">Financial Summary</h3>
                </div>
                <div className="p-6 space-y-4">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Gross Revenue</dt>
                      <dd className="mt-1 text-sm font-semibold text-gray-900">{formatCurrency(inputs.grossRevenue)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Allowable Expenses</dt>
                      <dd className="mt-1 text-sm font-semibold text-gray-900">{formatCurrency(inputs.allowableExpenses)}</dd>
                    </div>
                    {(inputs.pensionContributions ?? 0) > 0 && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Pension</dt>
                        <dd className="mt-1 text-sm text-gray-900">{formatCurrency(inputs.pensionContributions ?? 0)}</dd>
                      </div>
                    )}
                    {(inputs.nhfContributions ?? 0) > 0 && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">NHF</dt>
                        <dd className="mt-1 text-sm text-gray-900">{formatCurrency(inputs.nhfContributions ?? 0)}</dd>
                      </div>
                    )}
                    {(inputs.lifeInsurancePremiums ?? 0) > 0 && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Life Insurance</dt>
                        <dd className="mt-1 text-sm text-gray-900">{formatCurrency(inputs.lifeInsurancePremiums ?? 0)}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-gray-100">
              <button
                onClick={handleBack}
                className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)] transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCalculate}
                disabled={isLoading}
                className="flex items-center gap-2 px-8 py-2.5 text-sm font-medium text-black bg-[var(--primary)] rounded-lg hover:bg-[var(--primary)]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    Calculate Tax
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {/* Results View */}
        {result && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">

            {/* Main Result Card */}
            <div className="relative overflow-hidden bg-white rounded-2xl border border-gray-200 shadow-xl">
              <div className="absolute top-0 left-0 w-full h-2 bg-[var(--primary)]" />
              <div className="p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">Tax Computation Results</h2>
                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                      <span>Reference: {result.taxRuleMetadata.version}</span>
                      <span>•</span>
                      <span>{new Date().toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleStartOver}
                      className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Start Over
                    </button>
                    <button
                      onClick={handleDownloadPDF}
                      disabled={isLoading}
                      className="px-4 py-2 text-sm font-medium text-black bg-[var(--primary)] rounded-lg hover:bg-[var(--primary)]/90 transition-colors shadow-sm flex items-center gap-2"
                    >
                      Download Report
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="p-6 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Taxable Income</div>
                    <div className="text-3xl font-bold text-gray-900">{formatCurrency(result.taxableIncome)}</div>
                  </div>

                  <div className="p-6 bg-[var(--primary)]/10 rounded-xl border border-[var(--primary)]/20 relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-[var(--primary)]/10 rounded-full group-hover:scale-110 transition-transform" />
                    <div className="text-sm font-medium text-gray-600 uppercase tracking-wide mb-1">Net Tax Payable</div>
                    <div className="text-4xl font-extrabold text-[#111827]">{formatCurrency(result.totalTaxDue)}</div>
                    {result.effectiveRate > 0 && (
                      <div className="mt-2 text-sm font-medium text-gray-600">
                        Effective Rate: <span className="text-black">{formatPercent(result.effectiveRate)}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-6 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Tax Credits Applied</div>
                    <div className="text-3xl font-bold text-gray-900">{formatCurrency(result.taxCreditsApplied)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Validation Issues */}
            {result.validationIssues.length > 0 && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-r-xl shadow-sm">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="ml-4 w-full">
                    <h3 className="text-lg font-medium text-yellow-800">Attention Needed</h3>
                    <div className="mt-3 space-y-3">
                      {result.validationIssues.map((issue) => (
                        <div key={issue.id} className="flex gap-2 text-sm text-yellow-700 bg-yellow-100/50 p-2 rounded">
                          <span className="font-bold uppercase text-xs tracking-wider px-2 py-0.5 bg-yellow-200 rounded text-yellow-800 self-start mt-0.5">{issue.severity}</span>
                          <span><span className="font-semibold">{issue.field}:</span> {issue.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Breakdown & Calcs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Tax Bands Table */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="font-semibold text-gray-900">Tax Calculation Breakdown</h3>
                </div>
                <div className="p-0">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Band</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {result.bands.map((band, index) => (
                        <tr key={index} className="hover:bg-gray-50/50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{band.bandLabel}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatPercent(band.rate)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">{formatCurrency(band.taxAmount)}</td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-semibold">
                        <td colSpan={2} className="px-6 py-4 text-sm text-gray-900 text-right">Total Tax:</td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(result.totalTaxDue)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Optimizations */}
              {optimizations && optimizations.suggestions.length > 0 && (
                <div className="bg-indigo-50/50 rounded-xl border border-indigo-100 shadow-sm overflow-hidden h-full">
                  <div className="px-6 py-4 border-b border-indigo-100 bg-indigo-50/80 flex justify-between items-center">
                    <h3 className="font-semibold text-indigo-900 flex items-center gap-2">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Optimization Opportunities
                    </h3>
                    {optimizations.totalPotentialSavings > 0 && (
                      <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full border border-indigo-200">
                        Save up to {formatCurrency(optimizations.totalPotentialSavings)}
                      </span>
                    )}
                  </div>
                  <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                    {optimizations.suggestions.map((suggestion, index) => (
                      <div key={index} className="bg-white p-4 rounded-lg border border-indigo-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <h4 className="font-medium text-gray-900 text-sm">{suggestion.title}</h4>
                            <p className="text-xs text-gray-500 mt-1">{suggestion.description}</p>
                          </div>
                          {suggestion.potentialSavings && (
                            <div className="text-indigo-600 font-bold text-sm bg-indigo-50 px-2 py-1 rounded">
                              {formatCurrency(suggestion.potentialSavings)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Auxiliary Logic */}
            {(whtResult || cgtResult || stampDutyResult || leviesResult) && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 border-b pb-2">Additional Tax Obligations</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* WHT */}
                  {whtResult && whtResult.calculations.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between">
                        <h4 className="font-semibold text-gray-900">Withholding Tax (WHT)</h4>
                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{formatCurrency(whtResult.totalWHTDeducted)}</span>
                      </div>
                      <div className="p-4">
                        <ul className="space-y-2">
                          {whtResult.calculations.map((c, i) => (
                            <li key={i} className="text-sm flex justify-between border-b border-gray-50 last:border-0 pb-2 last:pb-0">
                              <span className="text-gray-600">{c.paymentDescription}</span>
                              <span className="font-medium">{formatCurrency(c.whtAmount)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* CGT */}
                  {cgtResult && cgtResult.totalGain > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between">
                        <h4 className="font-semibold text-gray-900">Capital Gains Tax (CGT)</h4>
                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{formatCurrency(cgtResult.totalCGT)}</span>
                      </div>
                      <div className="p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Gain</span>
                          <span>{formatCurrency(cgtResult.totalGain)}</span>
                        </div>
                        <div className="flex justify-between font-medium text-[var(--primary)]">
                          <span>Tax Payable (10%)</span>
                          <span>{formatCurrency(cgtResult.totalCGT)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Levies */}
                  {leviesResult && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between">
                        <h4 className="font-semibold text-gray-900">Company Levies</h4>
                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{formatCurrency(leviesResult.totalLevies)}</span>
                      </div>
                      <div className="p-4 space-y-2 text-sm">
                        {leviesResult.itf.isApplicable && (
                          <div className="flex justify-between"><span>ITF (1%)</span><span>{formatCurrency(leviesResult.itf.levyPayable)}</span></div>
                        )}
                        {leviesResult.nsitf.isApplicable && (
                          <div className="flex justify-between"><span>NSITF (1%)</span><span>{formatCurrency(leviesResult.nsitf.contributionPayable)}</span></div>
                        )}
                        {leviesResult.policeLevy.isApplicable && (
                          <div className="flex justify-between"><span>Police Fund (0.005%)</span><span>{formatCurrency(leviesResult.policeLevy.levyPayable)}</span></div>
                        )}
                        {leviesResult.naseniLevy.isApplicable && (
                          <div className="flex justify-between"><span>NASENI (0.25%)</span><span>{formatCurrency(leviesResult.naseniLevy.levyPayable)}</span></div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Helper functions for disclaimer footer */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-xs text-gray-500 max-w-4xl mx-auto">
              <p>
                <strong>Disclaimer:</strong> This computation is an estimate based on current Nigerian tax laws (Finance Act 2023).
                Results should be verified by a qualified tax professional before filing.
                NaijaTaxAgent is not liable for any inaccuracies.
              </p>
            </div>

          </div>
        )}

        <div className="hidden">
          {/* Hidden helper for state debug if needed */}
        </div>

      </section>
    </>
  );
}
