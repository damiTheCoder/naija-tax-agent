import Link from "next/link";

const openRoles = [
  {
    title: "Frontend Engineer",
    location: "Remote",
    summary: "Build and polish accounting, tax, and cashflow workflows in the web app.",
  },
  {
    title: "Backend Engineer",
    location: "Remote",
    summary: "Scale transaction processing, integrations, and reporting APIs.",
  },
  {
    title: "Product Designer",
    location: "Remote",
    summary: "Design focused UX for business owners and finance operators.",
  },
];

export default function CareersPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-14">
      <h1 className="text-3xl font-bold text-slate-900">Careers at Bace</h1>
      <p className="mt-3 text-slate-600">
        We are building practical financial tooling for small and mid-sized businesses.
      </p>

      <section className="mt-8 grid gap-4">
        {openRoles.map((role) => (
          <article key={role.title} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900">{role.title}</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {role.location}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{role.summary}</p>
          </article>
        ))}
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/contact" className="rounded-lg bg-[#9080ee] px-4 py-2 text-sm font-semibold text-white">
          Contact Hiring Team
        </Link>
        <Link href="/" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
          Back to Home
        </Link>
      </div>
    </main>
  );
}
