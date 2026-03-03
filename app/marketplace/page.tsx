"use client";

import { useMemo, useState } from "react";

interface Professional {
  id: string;
  name: string;
  title: string;
  experience: string;
  skills: string[];
  bio: string;
  whatsapp: string;
  location: string;
  followers: string;
  recommendations: number;
  availability: "Open to projects" | "Limited capacity";
  verified: boolean;
  latestPost: string;
}

const MOCK_PROFESSIONALS: Professional[] = [
  {
    id: "1",
    name: "Abiodun Okonjo",
    title: "Chartered Accountant (ICAN)",
    experience: "12 years",
    skills: ["Corporate Tax", "Audit", "Financial Planning"],
    bio: "Helping SMEs build audit-ready books and defend assessments confidently during FIRS reviews.",
    whatsapp: "https://wa.me/2348000000001",
    location: "Lagos, NG",
    followers: "2.3k",
    recommendations: 48,
    availability: "Open to projects",
    verified: true,
    latestPost:
      "If your VAT control account and bank collections are not reconciled weekly, month-end filing becomes guesswork.",
  },
  {
    id: "2",
    name: "Chinwe Egwu",
    title: "Senior Tax Consultant",
    experience: "8 years",
    skills: ["VAT", "Withholding Tax", "Payroll"],
    bio: "I design filing workflows for startup finance teams that need speed without compromising compliance quality.",
    whatsapp: "https://wa.me/2348000000002",
    location: "Abuja, NG",
    followers: "1.7k",
    recommendations: 36,
    availability: "Open to projects",
    verified: true,
    latestPost:
      "WHT is not a mere deduction line. Treat it as a liability stream with period-level reconciliation.",
  },
  {
    id: "3",
    name: "Tunde Balogun",
    title: "Financial Auditor",
    experience: "15 years",
    skills: ["Management Accounting", "Internal Audit", "Cost Analysis"],
    bio: "Supporting growing companies with internal controls, board-grade reporting, and clean close processes.",
    whatsapp: "https://wa.me/2348000000003",
    location: "Port Harcourt, NG",
    followers: "3.1k",
    recommendations: 64,
    availability: "Limited capacity",
    verified: false,
    latestPost:
      "Close your books with evidence trails, not just balances. Controls reduce future tax disputes.",
  },
];

const getInitials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

const toHandle = (name: string) => `@${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSkill, setActiveSkill] = useState<string>("All");

  const skillFilters = useMemo(() => {
    const seen = new Set<string>();
    MOCK_PROFESSIONALS.forEach((pro) => {
      pro.skills.forEach((skill) => seen.add(skill));
    });
    return ["All", ...Array.from(seen)];
  }, []);

  const filteredProfessionals = useMemo(() => {
    return MOCK_PROFESSIONALS.filter((pro) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery =
        query.length === 0 ||
        pro.name.toLowerCase().includes(query) ||
        pro.title.toLowerCase().includes(query) ||
        pro.bio.toLowerCase().includes(query) ||
        pro.skills.some((skill) => skill.toLowerCase().includes(query));

      const matchesSkill = activeSkill === "All" || pro.skills.includes(activeSkill);
      return matchesQuery && matchesSkill;
    });
  }, [activeSkill, searchQuery]);

  return (
    <div
      className="min-h-screen -m-2 lg:-m-8 px-4 py-6 lg:px-8 lg:py-8"
      style={{
        background:
          "linear-gradient(165deg, rgba(244,248,255,1) 0%, rgba(250,252,255,1) 50%, rgba(245,247,252,1) 100%)",
        fontFamily: '"Sora","Manrope","Avenir Next",sans-serif',
      }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-[0_10px_40px_rgba(15,23,42,0.06)] backdrop-blur-md lg:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Quantum Professionals
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 lg:text-4xl">
                Browse Professionals
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600 lg:text-base">
                Social feed style discovery with professional depth. Find auditors, accountants, and tax advisors ready
                to work on your books.
              </p>
            </div>
            <div className="text-left lg:text-right">
              <p className="text-sm text-slate-500">Available experts</p>
              <p className="text-3xl font-semibold text-slate-900">{filteredProfessionals.length}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_280px]">
          <aside className="rounded-3xl border border-slate-200 bg-white/85 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)] backdrop-blur-md lg:sticky lg:top-5 lg:h-fit">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Skill Channels</p>
            <div className="mt-3 flex flex-wrap gap-2 lg:flex-col">
              {skillFilters.map((skill) => (
                <button
                  key={skill}
                  onClick={() => setActiveSkill(skill)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition lg:rounded-xl lg:text-left ${
                    activeSkill === skill
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </aside>

          <main className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white/85 p-4 shadow-[0_8px_28px_rgba(15,23,42,0.06)] backdrop-blur-md lg:p-5">
              <label className="sr-only" htmlFor="professional-search">
                Search professionals
              </label>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-4.35-4.35m1.1-4.4a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z"
                    />
                  </svg>
                </div>
                <input
                  id="professional-search"
                  type="text"
                  placeholder="Search by name, role, or skill..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                />
              </div>
            </div>

            <div className="space-y-4">
              {filteredProfessionals.map((pro) => (
                <article
                  key={pro.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)] transition hover:border-blue-200"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-semibold text-white">
                      {getInitials(pro.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-slate-900">{pro.name}</h2>
                        {pro.verified ? (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                            Verified
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-slate-500">
                        {toHandle(pro.name)} • {pro.location}
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-slate-700">{pro.title}</p>
                    </div>
                    <a
                      href={pro.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      Connect
                    </a>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-slate-700">{pro.latestPost}</p>
                  <p className="mt-3 text-sm text-slate-600">{pro.bio}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {pro.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
                      >
                        #{skill.replace(/\s+/g, "")}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs text-slate-600 sm:grid-cols-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Experience</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{pro.experience}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Followers</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{pro.followers}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Recommendations</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{pro.recommendations}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Availability</p>
                      <p
                        className={`mt-1 text-sm font-semibold ${
                          pro.availability === "Open to projects" ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {pro.availability}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {filteredProfessionals.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-10 text-center">
                <p className="text-lg font-semibold text-slate-900">No professionals matched your search.</p>
                <p className="mt-2 text-sm text-slate-600">Try a different keyword or choose another skill channel.</p>
              </div>
            ) : null}
          </main>

          <aside className="hidden space-y-4 xl:block">
            <div className="rounded-3xl border border-slate-200 bg-white/85 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)] backdrop-blur-md">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Top Voices</p>
              <div className="mt-3 space-y-3">
                {MOCK_PROFESSIONALS.slice(0, 3).map((pro) => (
                  <div key={pro.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-900">{pro.name}</p>
                    <p className="text-xs text-slate-500">{pro.title}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Why This Feed</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-100">
                Fast discovery like Twitter, decision confidence like LinkedIn. Profile depth + live professional
                insights in one flow.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
