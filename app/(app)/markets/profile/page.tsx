import {
  ArrowUpRight,
  BadgePercent,
  Gift,
  PackageCheck,
  ShieldCheck,
  TicketPercent,
  Users,
  WalletCards,
} from "lucide-react";

const profileStats = [
  { label: "Target", value: "₦12.0M", hint: "Cold-room expansion" },
  { label: "Raised", value: "₦8.2M", hint: "68% funded" },
  { label: "Funder batches", value: "328", hint: "₦25K minimum" },
  { label: "Reward liability", value: "₦640K", hint: "Reserved for fulfillment" },
];

const batchLedger = [
  { id: "AYF-118", funders: 46, amount: "₦1.15M", reward: "Free product boxes", status: "Open" },
  { id: "AYF-117", funders: 52, amount: "₦1.30M", reward: "Discount vouchers", status: "Settled" },
  { id: "AYF-116", funders: 38, amount: "₦950K", reward: "Thank-you fees", status: "Reserved" },
  { id: "AYF-115", funders: 64, amount: "₦1.60M", reward: "Early access", status: "Fulfilled" },
];

const rewardPlan = [
  { label: "Free product boxes", value: "38%", icon: Gift },
  { label: "Thank-you fees", value: "24%", icon: WalletCards },
  { label: "Early access", value: "21%", icon: ShieldCheck },
  { label: "Discount vouchers", value: "17%", icon: TicketPercent },
];

const fundingTrend = [
  { month: "Jan", value: 28 },
  { month: "Feb", value: 36 },
  { month: "Mar", value: 44 },
  { month: "Apr", value: 52 },
  { month: "May", value: 61 },
  { month: "Jun", value: 68 },
];

function FundingTrend() {
  const max = Math.max(...fundingTrend.map((item) => item.value));

  return (
    <div className="grid h-48 min-w-0 grid-cols-6 items-end gap-2">
      {fundingTrend.map((item) => (
        <div key={item.month} className="flex min-w-0 flex-col items-center gap-2">
          <div className="flex h-36 w-full items-end rounded-lg border border-[#ece8df] p-1">
            <div
              className="w-full rounded-md border border-[#b9ef74] bg-[#dfffbf]"
              style={{ height: `${Math.max(12, (item.value / max) * 100)}%` }}
              aria-label={`${item.month} funding ${item.value}%`}
            />
          </div>
          <span className="text-[11px] font-semibold text-[#6b675f]">{item.month}</span>
        </div>
      ))}
    </div>
  );
}

export default function MarketsProfilePage() {
  return (
    <div className="mx-auto flex w-full max-w-full min-w-0 flex-col gap-5 overflow-hidden">
      <section className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="min-w-0 rounded-lg border border-[#ece8df] p-5 sm:p-6">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#ece8df] px-3 py-1.5 text-xs font-semibold text-[#0f766e]">
            <PackageCheck className="h-3.5 w-3.5" />
            SME funding profile
          </div>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold leading-tight text-[#101010] sm:text-4xl">Ayo Fresh Foods</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6b675f]">
                Funding cold-chain storage and last-mile delivery for fresh grocery orders. Supporters join fixed batches and receive the SME-selected reward mix.
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d8efb9] px-2.5 py-1 text-xs font-semibold text-[#446b00]">
              <ArrowUpRight className="h-3.5 w-3.5" />
              68% funded
            </span>
          </div>

          <div className="mt-6 grid min-w-0 gap-3 sm:grid-cols-2">
            {profileStats.map((stat) => (
              <div key={stat.label} className="min-w-0 rounded-lg border border-[#ece8df] p-4">
                <p className="text-xs font-semibold uppercase text-[#6b675f]">{stat.label}</p>
                <p className="mt-2 text-2xl font-semibold text-[#101010]">{stat.value}</p>
                <p className="mt-1 text-xs text-[#6b675f]">{stat.hint}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-[#ece8df] p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[#101010]">Funding progress</h2>
              <p className="text-sm text-[#6b675f]">Monthly raised percentage against the target.</p>
            </div>
            <WalletCards className="h-5 w-5 shrink-0 text-[#0f766e]" />
          </div>
          <FundingTrend />
        </div>
      </section>

      <section className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <div className="min-w-0 rounded-lg border border-[#ece8df] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#101010]">Batch ledger</h2>
              <p className="text-sm text-[#6b675f]">Funder batches tied to this SME.</p>
            </div>
            <Users className="h-5 w-5 text-[#0f766e]" />
          </div>

          <div className="grid gap-3">
            {batchLedger.map((batch) => (
              <article key={batch.id} className="grid min-w-0 gap-3 rounded-lg border border-[#ece8df] p-4 md:grid-cols-[1fr_0.8fr_0.8fr_1fr_0.7fr] md:items-center">
                <div className="min-w-0">
                  <p className="text-xs text-[#6b675f]">Batch</p>
                  <p className="truncate text-sm font-semibold text-[#101010]">{batch.id}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b675f]">Funders</p>
                  <p className="text-sm font-semibold text-[#101010]">{batch.funders}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b675f]">Amount</p>
                  <p className="text-sm font-semibold text-[#101010]">{batch.amount}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[#6b675f]">Reward</p>
                  <p className="truncate text-sm font-semibold text-[#101010]">{batch.reward}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b675f]">Status</p>
                  <p className="text-sm font-semibold text-[#0f766e]">{batch.status}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-[#ece8df] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#101010]">Reward setup</h2>
            <BadgePercent className="h-5 w-5 text-[#0f766e]" />
          </div>
          <div className="grid gap-3">
            {rewardPlan.map((reward) => {
              const Icon = reward.icon;
              return (
                <div key={reward.label} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[#ece8df] p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#ece8df] text-[#0f766e]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="truncate text-sm font-semibold text-[#101010]">{reward.label}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-[#6b675f]">{reward.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
