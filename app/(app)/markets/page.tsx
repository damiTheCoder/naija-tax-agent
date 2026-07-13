import {
  ArrowUpRight,
  BadgePercent,
  Gift,
  PackageCheck,
  Plus,
  ShoppingBag,
  Sparkles,
  TicketPercent,
  Users,
  WalletCards,
} from "lucide-react";

const fundingStats = [
  { label: "Market wallet", value: "₦18.4M", hint: "+24% this month" },
  { label: "Live SME raises", value: "42", hint: "9 close this week" },
  { label: "Funder batches", value: "1,286", hint: "Avg. batch ₦28K" },
  { label: "Reward redemptions", value: "73%", hint: "Products, fees, access" },
];

const campaigns = [
  {
    name: "Ayo Fresh Foods",
    category: "Cold-chain groceries",
    raised: 8200000,
    target: 12000000,
    batch: "₦25K",
    funders: 328,
    reward: "Free product boxes",
    color: "#14b8a6",
  },
  {
    name: "CraftLab Studio",
    category: "Local fashion production",
    raised: 5100000,
    target: 8000000,
    batch: "₦15K",
    funders: 241,
    reward: "Early access drops",
    color: "#f97316",
  },
  {
    name: "MedRoute Clinics",
    category: "Community diagnostics",
    raised: 14300000,
    target: 18000000,
    batch: "₦50K",
    funders: 286,
    reward: "Discount vouchers",
    color: "#8fff00",
  },
];

const rewardMix = [
  { label: "Free products", value: 38, icon: Gift, color: "#446b00" },
  { label: "Thank-you fees", value: 24, icon: WalletCards, color: "#0f766e" },
  { label: "Early access", value: 21, icon: Sparkles, color: "#c2410c" },
  { label: "Discounts", value: 17, icon: TicketPercent, color: "#101010" },
];

const weeklyFunding = [
  { day: "Mon", value: 32 },
  { day: "Tue", value: 46 },
  { day: "Wed", value: 38 },
  { day: "Thu", value: 64 },
  { day: "Fri", value: 82 },
  { day: "Sat", value: 58 },
  { day: "Sun", value: 74 },
];

const walletActivity = [
  { title: "Batch settled", detail: "MedRoute Clinics batch MRC-092", amount: "+₦1.5M", status: "Cleared" },
  { title: "Reward pool funded", detail: "Ayo Fresh product boxes", amount: "-₦420K", status: "Reserved" },
  { title: "Thank-you fees paid", detail: "CraftLab Studio supporters", amount: "-₦185K", status: "Paid" },
];

function formatNaira(value: number) {
  return `₦${(value / 1000000).toFixed(value >= 10000000 ? 1 : 2)}M`;
}

function FundingBarChart() {
  const max = Math.max(...weeklyFunding.map((item) => item.value));

  return (
    <div className="grid h-52 min-w-0 grid-cols-7 items-end gap-2">
      {weeklyFunding.map((item) => (
        <div key={item.day} className="flex min-w-0 flex-col items-center gap-2">
          <div className="flex h-40 w-full items-end rounded-lg border border-[#ece8df] p-1">
            <div
              className="w-full rounded-md border border-[#b9ef74] bg-[#dfffbf]"
              style={{ height: `${Math.max(12, (item.value / max) * 100)}%` }}
              aria-label={`${item.day} funding activity ${item.value}%`}
            />
          </div>
          <span className="text-[11px] font-semibold text-[#6b675f]">{item.day}</span>
        </div>
      ))}
    </div>
  );
}

export default function MarketsPage() {
  return (
    <div className="mx-auto flex w-full max-w-full min-w-0 flex-col gap-5 overflow-hidden">
      <section className="min-w-0 overflow-hidden rounded-lg border border-[#ece8df] text-[#101010]">
        <div className="grid min-w-0 gap-6 p-5 sm:p-6 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="flex min-w-0 flex-col justify-between gap-8">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#ece8df] px-3 py-1.5 text-xs font-semibold text-[#0f766e]">
                <ShoppingBag className="h-3.5 w-3.5" />
                SME crowdfunding market
              </div>
              <h1 className="max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
                Markets
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6b675f] sm:text-base">
                Funders buy into SME batches while each business selects its own reward system: free products, thank-you fees, early access, discounts, and partner perks.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#101010] px-4 text-sm font-semibold text-[#101010] transition">
                <Plus className="h-4 w-4" />
                Create raise
              </button>
              <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#ece8df] px-4 text-sm font-semibold text-[#101010] transition">
                <Users className="h-4 w-4" />
                Funder batches
              </button>
              <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#ece8df] px-4 text-sm font-semibold text-[#101010] transition">
                <BadgePercent className="h-4 w-4" />
                Rewards
              </button>
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-[#ece8df] p-4 text-[#101010]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-[#6b675f]">Funding velocity</p>
                <p className="mt-1 text-2xl font-semibold">₦7.8M</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#d8efb9] px-2.5 py-1 text-xs font-semibold text-[#446b00]">
                <ArrowUpRight className="h-3.5 w-3.5" />
                +18.6%
              </span>
            </div>
            <FundingBarChart />
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {fundingStats.map((stat) => (
          <div key={stat.label} className="min-w-0 rounded-lg border border-[#ece8df] p-4 text-[#101010]">
            <p className="text-xs font-semibold uppercase opacity-65">{stat.label}</p>
            <p className="mt-3 text-2xl font-semibold">{stat.value}</p>
            <p className="mt-2 text-xs opacity-65">{stat.hint}</p>
          </div>
        ))}
      </section>

      <section className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <div className="min-w-0 rounded-lg border border-[#ece8df] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#101010]">Live SME raises</h2>
              <p className="text-sm text-[#6b675f]">Batch-based crowdfunding with SME-selected rewards.</p>
            </div>
            <button className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#ece8df] text-[#101010] transition" aria-label="Open markets">
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3">
            {campaigns.map((campaign) => {
              const percent = Math.round((campaign.raised / campaign.target) * 100);
              return (
                <article key={campaign.name} className="rounded-lg border border-[#ece8df] p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="h-10 w-10 shrink-0 rounded-lg border-2" style={{ borderColor: campaign.color }} />
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-[#101010]">{campaign.name}</h3>
                          <p className="truncate text-xs text-[#6b675f]">{campaign.category}</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-right sm:w-[330px]">
                      <div>
                        <p className="text-xs text-[#6b675f]">Batch</p>
                        <p className="text-sm font-semibold text-[#101010]">{campaign.batch}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#6b675f]">Funders</p>
                        <p className="text-sm font-semibold text-[#101010]">{campaign.funders}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#6b675f]">Reward</p>
                        <p className="truncate text-sm font-semibold text-[#101010]">{campaign.reward}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#6b675f]">
                      <span>{formatNaira(campaign.raised)} raised</span>
                      <span>{percent}% of {formatNaira(campaign.target)}</span>
                    </div>
                    <div className="h-2 rounded-full border border-[#ece8df]">
                      <div className="h-2 rounded-full border border-[#0a0a0a]" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="grid min-w-0 gap-5">
          <div className="min-w-0 rounded-lg border border-[#ece8df] p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-[#101010]">Reward mix</h2>
            <div className="mt-4 grid gap-3">
              {rewardMix.map((reward) => {
                const Icon = reward.icon;
                return (
                  <div key={reward.label} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#ece8df]" style={{ color: reward.color }}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-[#101010]">{reward.label}</p>
                        <p className="text-xs font-semibold text-[#6b675f]">{reward.value}%</p>
                      </div>
                      <div className="h-2 rounded-full border border-[#ece8df]">
                        <div className="h-2 rounded-full border border-[#0a0a0a]" style={{ width: `${reward.value}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-[#ece8df] p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#101010]">Wallet flow</h2>
              <WalletCards className="h-5 w-5 text-[#0f766e]" />
            </div>
            <div className="space-y-3">
              {walletActivity.map((item) => (
                <div key={item.detail} className="flex items-start justify-between gap-3 rounded-lg border border-[#ece8df] p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#101010]">{item.title}</p>
                    <p className="truncate text-xs text-[#6b675f]">{item.detail}</p>
                    <p className="mt-1 text-[11px] font-semibold text-[#0f766e]">{item.status}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-[#101010]">{item.amount}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { title: "Batch ledger", value: "982 active units", icon: PackageCheck },
          { title: "SME choice", value: "5 reward systems", icon: Gift },
          { title: "Market trust", value: "96.4% verified", icon: Users },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex items-center gap-3 rounded-lg border border-[#ece8df] p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#ece8df] text-[#0f766e]">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#101010]">{item.title}</p>
                <p className="truncate text-xs text-[#6b675f]">{item.value}</p>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
