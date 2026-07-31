import Link from "next/link";

export default function SecurityPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-14">
      <h1 className="text-3xl font-bold text-slate-900">Security</h1>
      <p className="mt-3 text-slate-600">
        Bace is designed to protect financial records, user access, and system operations.
      </p>

      <section className="mt-8 grid gap-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Access controls</h2>
          <p className="mt-2 text-sm text-slate-600">
            Access is scoped by workspace and role-based permissions to reduce unauthorized actions.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Auditability</h2>
          <p className="mt-2 text-sm text-slate-600">
            Core accounting and tax workflows maintain records that support review and reconciliation.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Data safeguards</h2>
          <p className="mt-2 text-sm text-slate-600">
            Integrations and ingestion paths are validated, and sensitive operations are logged for traceability.
          </p>
        </article>
      </section>

      <div className="mt-8">
        <Link href="/contact" className="text-sm font-semibold text-[#1e3a8a]">
          Report a Security Concern
        </Link>
      </div>
    </main>
  );
}
