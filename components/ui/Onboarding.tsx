"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { APP_LOGO_SRC, APP_LOGO_ALT } from "@/lib/constants";

// ============================================
// ONBOARDING COMPONENT
// ============================================

interface OnboardingStep {
    title: string;
    description: string;
    icon: React.ReactNode;
}

const onboardingSteps: OnboardingStep[] = [
    {
        title: "AI-Powered Accounting",
        description: "Chat with our AI to record transactions, ask questions about your finances, and get real-time insights.",
        icon: (
            <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
        ),
    },
    {
        title: "Smart Tax Computation",
        description: "Tax Pro Max automatically calculates your Nigerian taxes with PITA and CITA compliance. Auto-fill from your accounting data.",
        icon: (
            <svg className="w-12 h-12 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
        ),
    },
    {
        title: "Cashflow Intelligence",
        description: "Monitor your burn rate, set up automations for recurring transactions, and get AI-powered cash forecasting.",
        icon: (
            <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
        ),
    },
    {
        title: "Bank-Grade Security",
        description: "Your data is encrypted and protected. We're FIRS compliant and follow best practices for financial data security.",
        icon: (
            <svg className="w-12 h-12 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
        ),
    },
];

const ONBOARDING_KEY = "cashos_onboarding_completed";

interface OnboardingProps {
    onComplete?: () => void;
    forceShow?: boolean;
}

export function Onboarding({ onComplete, forceShow = false }: OnboardingProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        // Check if onboarding was already completed
        if (forceShow) {
            setIsOpen(true);
            return;
        }

        const completed = localStorage.getItem(ONBOARDING_KEY);
        if (!completed) {
            setIsOpen(true);
        }
    }, [forceShow]);

    const handleNext = () => {
        if (currentStep < onboardingSteps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handleSkip = () => {
        handleComplete();
    };

    const handleComplete = () => {
        localStorage.setItem(ONBOARDING_KEY, "true");
        setIsOpen(false);
        onComplete?.();
    };

    if (!isOpen) return null;

    const step = onboardingSteps[currentStep];
    const isLastStep = currentStep === onboardingSteps.length - 1;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Header with logo */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-8 text-center">
                    <div className="w-16 h-16 mx-auto bg-white rounded-2xl flex items-center justify-center shadow-lg mb-4">
                        <Image src={APP_LOGO_SRC} alt={APP_LOGO_ALT} width={48} height={48} className="rounded-xl" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Welcome to CashOS</h2>
                    <p className="text-blue-100 text-sm mt-1">Your AI-powered financial operating system</p>
                </div>

                {/* Step content */}
                <div className="p-6">
                    <div className="text-center mb-6">
                        <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
                            {step.icon}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            {step.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                            {step.description}
                        </p>
                    </div>

                    {/* Progress dots */}
                    <div className="flex justify-center gap-2 mb-6">
                        {onboardingSteps.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentStep(index)}
                                className={`w-2 h-2 rounded-full transition-all ${index === currentStep
                                        ? "bg-blue-600 w-6"
                                        : index < currentStep
                                            ? "bg-blue-300"
                                            : "bg-gray-300 dark:bg-gray-600"
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleSkip}
                            className="flex-1 px-4 py-2.5 text-gray-600 dark:text-gray-400 text-sm font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            Skip
                        </button>
                        <button
                            onClick={handleNext}
                            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                            {isLastStep ? "Get Started" : "Next"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Hook to check if onboarding is complete
 */
export function useOnboardingComplete(): boolean {
    const [isComplete, setIsComplete] = useState(true); // Default to true to avoid flash

    useEffect(() => {
        const completed = localStorage.getItem(ONBOARDING_KEY);
        setIsComplete(!!completed);
    }, []);

    return isComplete;
}

/**
 * Function to reset onboarding (for testing)
 */
export function resetOnboarding() {
    localStorage.removeItem(ONBOARDING_KEY);
}
