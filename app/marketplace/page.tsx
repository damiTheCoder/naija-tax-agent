"use client";

import { useState } from "react";
import { NavIconBadge } from "@/components/NavIconBadge";

interface Professional {
    id: string;
    name: string;
    title: string;
    experience: string;
    skills: string[];
    bio: string;
    whatsapp: string;
}

const MOCK_PROFESSIONALS: Professional[] = [
    {
        id: "1",
        name: "Abiodun Okonjo",
        title: "Chartered Accountant (ICAN)",
        experience: "12 years",
        skills: ["Corporate Tax", "Audit", "Financial Planning"],
        bio: "Specializing in SME growth and tax compliance. I help businesses optimize their financial records for FIRS audit readiness.",
        whatsapp: "https://wa.me/2348000000001",
    },
    {
        id: "2",
        name: "Chinwe Egwu",
        title: "Tax Consultant",
        experience: "8 years",
        skills: ["VAT", "Withholding Tax", "Payroll"],
        bio: "Expert in Nigerian tax laws and regulations. Providing tailored tax advisory services for startups and established firms.",
        whatsapp: "https://wa.me/2348000000002",
    },
    {
        id: "3",
        name: "Tunde Balogun",
        title: "Financial Auditor",
        experience: "15 years",
        skills: ["Management Accounting", "Internal Audit", "Cost Analysis"],
        bio: "Passionate about financial transparency. I provide deep-dive audits and internal control assessments for diverse sectors.",
        whatsapp: "https://wa.me/2348000000003",
    },
];

export default function MarketplacePage() {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredProfessionals = MOCK_PROFESSIONALS.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="min-h-screen bg-[var(--app-bg)] -m-2 lg:-m-8 px-4 py-8 lg:p-12 transition-colors duration-300 relative overflow-hidden">
            {/* Background Decorative Blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="max-w-6xl mx-auto relative z-10">
                <div className="mb-12 text-center lg:text-left">
                    <h1 className="text-4xl lg:text-5xl font-extrabold text-black dark:text-white mb-4 tracking-tight">
                        Marketplace
                    </h1>
                    <p className="text-black dark:text-gray-400 max-w-2xl text-lg lg:text-xl font-medium">
                        Connect with certified accountants and tax consultants to help manage your business finances.
                    </p>
                </div>

                {/* Search Bar - Premium Glassmorphism */}
                <div className="relative mb-16 max-w-3xl">
                    <input
                        type="text"
                        placeholder="Search by name, title, or skill (e.g. VAT, Audit)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-6 py-5 rounded-2xl bg-white/80 dark:bg-[#121212]/80 backdrop-blur-md border border-gray-200 dark:border-gray-800 shadow-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 font-medium"
                        style={{ paddingLeft: '4.5rem' }}
                    />
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-blue-500 dark:text-blue-400 pointer-events-none">
                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {/* Professionals Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredProfessionals.map((pro) => (
                        <div
                            key={pro.id}
                            className="bg-white dark:bg-[#121212] rounded-3xl border border-gray-100 dark:border-gray-800 p-8 flex flex-col shadow-sm hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 group"
                        >
                            <div className="flex items-start gap-5 mb-6">
                                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                                    <span className="text-2xl font-black">{pro.name.charAt(0)}</span>
                                </div>
                                <div className="min-w-0 pt-1">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{pro.name}</h3>
                                    <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold tracking-wide uppercase">{pro.title}</p>
                                </div>
                            </div>

                            <div className="space-y-4 flex-1 mb-8">
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 w-fit px-3 py-1.5 rounded-full">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>{pro.experience} EXPERIENCE</span>
                                </div>

                                <p className="text-base text-gray-600 dark:text-gray-300 line-clamp-3 leading-relaxed font-light">
                                    {pro.bio}
                                </p>

                                <div className="flex flex-wrap gap-2 pt-2">
                                    {pro.skills.map(skill => (
                                        <span
                                            key={skill}
                                            className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-white/5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-white/5"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <a
                                href={pro.whatsapp}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba56] text-white py-4 rounded-2xl font-bold transition-all shadow-md hover:shadow-xl active:scale-[0.98]"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                                Connect via WhatsApp
                            </a>
                        </div>
                    ))}
                </div>

                {filteredProfessionals.length === 0 && (
                    <div className="text-center py-24 bg-white/50 dark:bg-[#121212]/50 backdrop-blur-sm rounded-[2rem] border border-dashed border-gray-200 dark:border-gray-800">
                        <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400 dark:text-gray-500 shadow-inner">
                            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-black dark:text-white mb-3">No professionals found</h3>
                        <p className="text-black dark:text-gray-400 text-lg">Try adjusting your search query or filters.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
