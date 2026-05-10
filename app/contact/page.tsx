import Link from "next/link";

const contactChannels = [
  {
    id: "support",
    name: "Product Support",
    detail: "Use the in-app assistant inside the accounting workspace for fastest response.",
    ctaLabel: "Open Workspace",
    ctaHref: "/accounting",
  },
  {
    id: "partnerships",
    name: "Partnerships",
    detail: "Reach out through the app and include your organization name and integration goals.",
    ctaLabel: "Go to Marketplace",
    ctaHref: "/marketplace",
  },
];

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-14">
      <h1 className="text-3xl font-bold text-slate-900">Contact Bace</h1>
      <p className="mt-3 text-slate-600">
        Choose a channel below based on what you need.
      </p>

      <section className="mt-8 grid gap-4">
        {contactChannels.map((channel) => (
          <article key={channel.id} id={channel.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">{channel.name}</h2>
            <p className="mt-2 text-sm text-slate-600">{channel.detail}</p>
            <Link
              href={channel.ctaHref}
              className="mt-4 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              {channel.ctaLabel}
            </Link>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-lg font-semibold text-slate-900">Social</h2>
        <p className="mt-2 text-sm text-slate-600">
          This page is linked from the footer social icons.
        </p>
        <ul className="mt-4 grid gap-2 text-sm text-slate-700">
          <li id="x">X (Twitter): Product updates and release notes.</li>
          <li id="linkedin">LinkedIn: Company and partnership updates.</li>
          <li id="instagram">Instagram: Brand and community highlights.</li>
        </ul>
      </section>
    </main>
  );
}
