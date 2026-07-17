"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/workspace/types";

const DISMISSAL_STORAGE_KEY = "ql::temporary-login-dismissed-permanent";

export default function TemporaryLoginReminder() {
  const [isTemporary, setIsTemporary] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const syncTemporaryState = () => {
      const temporary = window.localStorage.getItem(STORAGE_KEYS.TEMPORARY_ACCESS) === "true";
      setIsTemporary(temporary);
      if (!temporary) {
        setIsOpen(false);
        window.localStorage.removeItem(DISMISSAL_STORAGE_KEY);
      }
    };

    syncTemporaryState();
    window.addEventListener("storage", syncTemporaryState);
    window.addEventListener("focus", syncTemporaryState);

    return () => {
      window.removeEventListener("storage", syncTemporaryState);
      window.removeEventListener("focus", syncTemporaryState);
    };
  }, []);

  useEffect(() => {
    const dismissed = window.localStorage.getItem(DISMISSAL_STORAGE_KEY) === "true";
    if (dismissed && isOpen) setIsOpen(false);
  }, [isOpen]);

  if (!isTemporary || !isOpen) return null;

  const continueTemporarily = () => {
    setIsOpen(false);
    window.localStorage.setItem(DISMISSAL_STORAGE_KEY, "true");
  };

  const loginTemporarily = () => {
    window.localStorage.setItem(DISMISSAL_STORAGE_KEY, "true");
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="temporary-login-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-950 shadow-2xl dark:bg-[#101010] dark:text-white"
      >
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#446b00] dark:text-[#8fff00]">
          Temporary access
        </p>
        <h2 id="temporary-login-title" className="mt-3 text-2xl font-black tracking-normal text-slate-950 dark:text-white">
          Save your progress
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-gray-300">
          You are using temporary access. Sign in or create an account to save your work permanently. Data in temporary
          mode can be lost if this browser is cleared or you switch devices.
        </p>
        <div className="mt-6 grid gap-3">
          <Link
            href="/auth/login?next=%2Fprofile"
            onClick={loginTemporarily}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#8fff00] px-4 text-sm font-black text-black transition hover:bg-[#7be000]"
          >
            Login / signup
          </Link>
          <button
            type="button"
            onClick={continueTemporarily}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
          >
            Continue temporarily
          </button>
        </div>
      </section>
    </div>
  );
}
