"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";

type WalletAction = "send" | "receive" | "add";

const actionCopy: Record<WalletAction, { title: string; detail: string; amountLabel: string; helper: string }> = {
  send: {
    title: "Send money",
    detail: "Move funds to a supplier, staff member, or saved recipient.",
    amountLabel: "Amount to send",
    helper: "Transfers are prepared here and can be reviewed before release.",
  },
  receive: {
    title: "Receive money",
    detail: "Create a payment request or share your business wallet details.",
    amountLabel: "Expected amount",
    helper: "Use this for customer receipts, invoice payments, and deposits.",
  },
  add: {
    title: "Add money",
    detail: "Top up your wallet from bank transfer or connected account.",
    amountLabel: "Amount to add",
    helper: "Added funds appear in available balance after confirmation.",
  },
};

const activity = [
  { title: "Customer receipt", amount: "+₦120,000", time: "Today", tone: "credit" },
  { title: "Office rent transfer", amount: "-₦50,000", time: "Yesterday", tone: "debit" },
  { title: "Wallet top up", amount: "+₦300,000", time: "Jul 12", tone: "credit" },
];

export default function WalletPage() {
  const [activeAction, setActiveAction] = useState<WalletAction>("send");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const selected = actionCopy[activeAction];
  const ActiveActionIcon = activeAction === "send" ? ArrowUpRight : activeAction === "receive" ? ArrowDownLeft : Plus;

  return (
    <main className="wallet-page space-y-5 px-2 pb-10 md:px-0">
      <section className="p-1 text-gray-950 sm:p-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Business wallet</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">₦2,450,000</h1>
            <p className="mt-2 text-sm text-gray-500">Available balance for payments and collections</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {([
            ["send", "Send", ArrowUpRight],
            ["receive", "Receive", ArrowDownLeft],
            ["add", "Add", Plus],
          ] as const).map(([key, label]) => {
            const isActive = activeAction === key;
            const Icon = key === "send" ? ArrowUpRight : key === "receive" ? ArrowDownLeft : Plus;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveAction(key)}
                className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl px-2 text-center transition-colors ${
                  isActive ? "text-[#101010]" : "text-gray-600 hover:text-gray-950"
                }`}
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-full ${isActive ? "bg-[#9080ee] text-[#101010]" : "bg-transparent text-gray-700"}`}>
                  <Icon className="h-5 w-5" strokeWidth={2.3} />
                </span>
                <span className="text-xs font-black sm:text-sm">{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="p-1 sm:p-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-gray-950">{selected.title}</h2>
              <p className="mt-1 text-sm text-gray-500">{selected.detail}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#9080ee] text-xl font-black text-[#101010]">
              <ActiveActionIcon className="h-6 w-6" strokeWidth={2.4} />
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{selected.amountLabel}</span>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="mt-2 h-14 w-full rounded-2xl border border-gray-100 bg-transparent px-4 text-lg font-bold text-gray-950 outline-none focus:border-[#9080ee]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                {activeAction === "receive" ? "Customer or note" : "Recipient or source"}
              </span>
              <input
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                placeholder={activeAction === "receive" ? "Invoice payment" : "Name, phone, or bank"}
                className="mt-2 h-14 w-full rounded-2xl border border-gray-100 bg-transparent px-4 text-sm font-semibold text-gray-950 outline-none focus:border-[#9080ee]"
              />
            </label>
          </div>

          <button
            type="button"
            className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-[#9080ee] text-sm font-black text-[#101010] transition-colors hover:bg-[#7be000]"
          >
            {selected.title}
          </button>
          <p className="mt-3 text-xs text-gray-500">{selected.helper}</p>
        </div>

        <div className="p-1 sm:p-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-gray-950">Wallet activity</h2>
            <span className="rounded-full border border-gray-100 px-3 py-1 text-xs font-bold text-gray-500">Latest</span>
          </div>
          <div className="mt-4 space-y-2">
            {activity.map((item) => (
              <div key={`${item.title}-${item.time}`} className="flex items-center justify-between rounded-2xl border border-gray-100 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.time}</p>
                </div>
                <p className={`text-sm font-black ${item.tone === "credit" ? "text-[#4f8f00]" : "text-gray-950"}`}>
                  {item.amount}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
