import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-14">
      <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
      <p className="mt-3 text-slate-600">
        This summary describes how Atom Ledger handles business and user information.
      </p>

      <section className="mt-8 grid gap-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">What we collect</h2>
          <p className="mt-2 text-sm text-slate-600">
            Transaction records, tax settings, workspace metadata, and operational usage events needed
            to provide accounting and compliance features.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">How data is used</h2>
          <p className="mt-2 text-sm text-slate-600">
            Data is used to power bookkeeping automation, reporting, tax workflows, and product support.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Access and control</h2>
          <p className="mt-2 text-sm text-slate-600">
            Workspace owners control who can access financial records and can remove connections at any time.
          </p>
        </article>
      </section>

      <div className="mt-8">
        <Link href="/terms" className="text-sm font-semibold text-[#2264ff]">
          Read Terms of Use
        </Link>
      </div>
    </main>
  );
}
