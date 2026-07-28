"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GoogleMark from "@/components/GoogleMark";
import { APP_LOGO_ALT, APP_LOGO_SRC } from "@/lib/constants";
import { getPocketBaseBrowserClient } from "@/lib/pocketbase/browserClient";
import { ALLOWED_OAUTH_PROVIDERS, POCKETBASE_USER_COLLECTION } from "@/lib/pocketbase/config";
import { STORAGE_KEYS, type UserProfile } from "@/lib/workspace/types";

type Provider = { name: string; displayName: string };
type AuthUser = {
  id: string;
  email: string;
  name: string;
};

function syncUserToLocalProfile(user: Partial<AuthUser> | null | undefined) {
  if (typeof window === "undefined" || !user) return;
  const id = user.id || "user-1";
  const name = user.name?.trim() || "User";
  const email = user.email?.trim() || "";

  try {
    const currentRaw = window.localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    const current = currentRaw ? (JSON.parse(currentRaw) as Partial<UserProfile>) : {};
    window.localStorage.setItem(
      STORAGE_KEYS.USER_PROFILE,
      JSON.stringify({
        id,
        name,
        email,
        phone: current.phone || "",
        company: current.company || "",
        avatar: current.avatar,
      }),
    );
  } catch {
    window.localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify({ id, name, email }));
  }
}

export default function UserRegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get("next") || "/accounting", [searchParams]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        const meResponse = await fetch("/api/auth/me", { cache: "no-store" });
        if (meResponse.ok) {
          const meData = (await meResponse.json()) as { authenticated?: boolean };
          if (active && meData.authenticated) {
            router.replace(next);
            router.refresh();
            return;
          }
        }

        const providersResponse = await fetch("/api/auth/providers", { cache: "no-store" });
        const providersData = (await providersResponse.json()) as { success?: boolean; providers?: Provider[] };
        if (!active) return;
        if (providersData.success && Array.isArray(providersData.providers)) {
          setProviders(providersData.providers.filter((provider) => ALLOWED_OAUTH_PROVIDERS.has(provider.name.toLowerCase())));
        }
      } catch {
        if (active) setProviders([]);
      } finally {
        if (active) setLoadingProviders(false);
      }
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, [next, router]);

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !password || !passwordConfirm) {
      setError("Name, email, password, and password confirmation are required.");
      return;
    }
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Password confirmation does not match.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, passwordConfirm }),
      });
      const data = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Registration failed");
      }
      router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: string) => {
    if (!ALLOWED_OAUTH_PROVIDERS.has(provider.toLowerCase())) {
      setError("Only Google login is enabled.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const pb = getPocketBaseBrowserClient();
      const authData = await pb.collection(POCKETBASE_USER_COLLECTION).authWithOAuth2({ provider });
      const token = authData.token || pb.authStore.token;
      if (!token) throw new Error("Missing social auth token");

      const response = await fetch("/api/auth/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to complete social login");
      }
      const user = "user" in result ? (result.user as AuthUser) : null;
      syncUserToLocalProfile(user);
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Social sign up failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white px-4 py-4 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md items-center justify-center">
      <section className="w-full rounded-[24px] border border-transparent bg-white p-5 shadow-none sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#4a3880]">Get started</p>
        <div className="mt-3 flex items-center gap-2.5">
          <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl sm:h-10 sm:w-10">
            <Image src={APP_LOGO_SRC} alt={APP_LOGO_ALT} fill className="object-contain" sizes="40px" priority />
          </span>
          <h1 className="text-[2rem] font-black leading-none tracking-tight text-[#07091a] sm:text-[2.45rem]">
            Create account
          </h1>
        </div>
        <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
          Create your Bace account and save your profile in PocketBase.
        </p>

        <form onSubmit={handleRegister} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1.5 w-full rounded-[14px] border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
              placeholder="Your name"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-[14px] border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 w-full rounded-[14px] border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700">Confirm password</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              className="mt-1.5 w-full rounded-[14px] border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
              placeholder="Repeat your password"
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-[15px] bg-[#9080ee] px-4 py-3 text-sm font-black text-[#101010] transition hover:bg-[#6f5ce0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">or</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="space-y-2">
          {loadingProviders ? (
            <p className="text-sm text-slate-500">Loading social providers...</p>
          ) : providers.length === 0 ? (
            <p className="text-sm text-slate-500">Google login is not configured in PocketBase.</p>
          ) : (
            providers.map((provider) => (
              <button
                key={provider.name}
                type="button"
                onClick={() => handleSocialLogin(provider.name)}
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2.5 rounded-[15px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <GoogleMark />
                Continue with {provider.displayName}
              </button>
            ))
          )}
        </div>

        <p className="mt-5 text-sm text-slate-500">
          Already have an account?{" "}
          <Link href={`/auth/login?next=${encodeURIComponent(next)}`} className="font-black text-[#4a3880]">
            Sign in
          </Link>
        </p>

        {error ? (
          <p className="mt-4 rounded-[14px] border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
            {error}
          </p>
        ) : null}
      </section>
      </div>
    </div>
  );
}
