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
  WHTRate,
} from "@/lib/types";
import { NIGERIAN_STATES, DEFAULT_TAX_YEAR } from "@/lib/taxRules/config";
import { WHT_RATES } from "@/lib/taxRules/whtConfig";
import { generatePDF } from "@/lib/pdfGenerator";

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

  const getWhtRateInfo = (paymentType: string): WHTRate | undefined => {
    return WHT_RATES.find((r) => r.paymentType === paymentType);
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
      generatePDF(profile, inputs, result, optimizations || undefined, whtResult || undefined);
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
    setWhtPayments([]);
    setWhtResult(null);
    setNewWhtPayment({ paymentType: "dividends", amount: "", isResident: true });
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Intro text */}
      <div className="text-center mb-8">
        <p className="text-[var(--muted)] text-lg">
          NaijaTaxAgent helps Nigerian freelancers and small businesses estimate their annual tax
          and generate a printable computation sheet for FIRS or your State Board of Internal Revenue (SBIRS).
        </p>
      </div>

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
                </>
              )}

              {/* WHT Payments Section */}
              <div className="mt-8 pt-6 border-t border-[var(--border)]">
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
              </div>

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
            {whtResult && whtResult.calculations.length > 0 && (
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
                          ? "bg-blue-50 border-blue-500"
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
    </div>
  );
}
