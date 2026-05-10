import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-14">
      <h1 className="text-3xl font-bold text-slate-900">Terms of Use</h1>
      <p className="mt-3 text-slate-600">
        These terms summarize expected use of Bace and its financial tooling.
      </p>

      <section className="mt-8 grid gap-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Acceptable use</h2>
          <p className="mt-2 text-sm text-slate-600">
            Use the platform for lawful business operations, reporting, and tax compliance workflows.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Account responsibility</h2>
          <p className="mt-2 text-sm text-slate-600">
            You are responsible for credentials, permissions, and data entered by your team members.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Service changes</h2>
          <p className="mt-2 text-sm text-slate-600">
            Features may evolve as integrations, regulations, and product capabilities improve.
          </p>
        </article>
      </section>

      <div className="mt-8">
        <Link href="/privacy" className="text-sm font-semibold text-[#446b00]">
          Read Privacy Policy
        </Link>
      </div>
    </main>
  );
}
