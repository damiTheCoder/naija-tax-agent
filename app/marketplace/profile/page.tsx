"use client";

import { useState } from "react";

export default function ProfessionalProfilePage() {
    const [saved, setSaved] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] -m-2 lg:-m-8 px-4 py-8 lg:p-12">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-3">Professional Listing</h1>
                    <p className="text-gray-400">
                        Manage your professional profile and WhatsApp link to connect with businesses on Atom Ledger.
                    </p>
                </div>

                <div className="bg-[#121212] rounded-2xl border border-gray-800 shadow-sm overflow-hidden">
                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-300">Full Name</label>
                                <input
                                    type="text"
                                    defaultValue="Abiodun Okonjo"
                                    className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-white"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-300">Professional Title</label>
                                <input
                                    type="text"
                                    defaultValue="Chartered Accountant (ICAN)"
                                    className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-white"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-300">Years of Experience</label>
                                <input
                                    type="text"
                                    defaultValue="12 years"
                                    className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-white"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-300">WhatsApp Link (https://wa.me/...)</label>
                                <input
                                    type="url"
                                    defaultValue="https://wa.me/2348000000001"
                                    className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-white"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-300">Bio & Work Experience</label>
                            <textarea
                                rows={4}
                                defaultValue="Specializing in SME growth and tax compliance. I help businesses optimize their financial records for FIRS audit readiness."
                                className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none text-white"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-300">Specialized Skills (Comma separated)</label>
                            <input
                                type="text"
                                defaultValue="Corporate Tax, Audit, Financial Planning"
                                className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-white"
                                required
                            />
                        </div>

                        <div className="pt-4 flex flex-col md:flex-row items-center gap-4">
                            <button
                                type="submit"
                                className="w-full md:w-auto px-10 py-4 bg-[#2264ff] hover:bg-[#1e56db] text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                            >
                                Save Changes
                            </button>
                            {saved && (
                                <div className="flex items-center gap-2 text-green-400 font-semibold animate-in fade-in slide-in-from-left-4">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Profile updated successfully!
                                </div>
                            )}
                        </div>
                    </form>
                </div>

                <div className="mt-8 p-6 bg-blue-900/10 rounded-2xl border border-blue-900/20">
                    <div className="flex gap-4">
                        <div className="text-blue-400 shrink-0">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="font-bold text-blue-300 mb-1 text-sm">Visibility Note</h4>
                            <p className="text-blue-400/70 text-xs leading-relaxed">
                                Once you save your profile, it will be visible to all businesses using Atom Ledger. Make sure your WhatsApp link is correct so they can reach you directly.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
