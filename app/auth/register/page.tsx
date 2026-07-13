"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GoogleMark from "@/components/GoogleMark";
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
  const next = useMemo(() => searchParams.get("next") || "/profile", [searchParams]);
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
      const user = "user" in data ? (data.user as AuthUser) : null;
      syncUserToLocalProfile(user);
      router.replace(next);
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
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Create Account</h1>
        <p className="mt-1 text-sm text-slate-600">Create your Bace account and save your profile in PocketBase.</p>

        <form onSubmit={handleRegister} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#8fff00] focus:outline-none focus:ring-2 focus:ring-[#8fff00]/20"
              placeholder="Your name"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#8fff00] focus:outline-none focus:ring-2 focus:ring-[#8fff00]/20"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#8fff00] focus:outline-none focus:ring-2 focus:ring-[#8fff00]/20"
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Confirm password</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#8fff00] focus:outline-none focus:ring-2 focus:ring-[#8fff00]/20"
              placeholder="Repeat your password"
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-[#8fff00] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6fcc00] disabled:opacity-60"
          >
            {isLoading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs uppercase tracking-wide text-slate-500">or</span>
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
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <GoogleMark />
                Continue with {provider.displayName}
              </button>
            ))
          )}
        </div>

        <p className="mt-5 text-sm text-slate-600">
          Already have an account?{" "}
          <Link href={`/auth/login?next=${encodeURIComponent(next)}`} className="font-semibold text-[#446b00]">
            Sign in
          </Link>
        </p>

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
