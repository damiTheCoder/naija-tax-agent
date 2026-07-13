"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GoogleMark from "@/components/GoogleMark";
import { getPocketBaseBrowserClient } from "@/lib/pocketbase/browserClient";
import { ALLOWED_OAUTH_PROVIDERS, POCKETBASE_USER_COLLECTION, isAdminRole } from "@/lib/pocketbase/config";
import { STORAGE_KEYS, type UserProfile } from "@/lib/workspace/types";

type Provider = { name: string; displayName: string };
type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
};

function syncUserToLocalProfile(user: Partial<AuthUser> | null | undefined) {
  if (typeof window === "undefined" || !user) return;
  const id = user.id || "user-1";
  const name = user.name?.trim() || "User";
  const email = user.email?.trim() || "";

  try {
    const currentRaw = window.localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    const current = currentRaw ? (JSON.parse(currentRaw) as Partial<UserProfile>) : {};
    const nextProfile: UserProfile = {
      id,
      name,
      email,
      phone: current.phone || "",
      company: current.company || "",
      avatar: current.avatar,
    };
    window.localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(nextProfile));
  } catch {
    window.localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify({ id, name, email }));
  }
}

function resolvePostLoginPath(next: string, user: Partial<AuthUser> | null | undefined): string {
  if (next.startsWith("/admin") && !isAdminRole(user?.role)) {
    return "/profile";
  }
  return next || "/profile";
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get("next") || "/profile", [searchParams]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { authenticated?: boolean; session?: { role?: string } };
        if (!active || !data.authenticated) return;
        syncUserToLocalProfile({
          id: data.session && "userId" in data.session ? String(data.session.userId) : undefined,
          email: data.session && "email" in data.session ? String(data.session.email || "") : "",
          name: data.session && "name" in data.session ? String(data.session.name || "") : "",
          role: data.session?.role || "user",
          status: data.session && "status" in data.session ? String(data.session.status || "active") : "active",
        });
        router.replace(resolvePostLoginPath(next, data.session as Partial<AuthUser> | undefined));
        router.refresh();
      } catch {
        // Ignore session check failures and allow manual sign-in.
      }
    };

    const loadProviders = async () => {
      try {
        const response = await fetch("/api/auth/providers", { cache: "no-store" });
        const data = (await response.json()) as { success?: boolean; providers?: Provider[] };
        if (!active) return;
        if (data.success && Array.isArray(data.providers)) {
          setProviders(data.providers.filter((provider) => ALLOWED_OAUTH_PROVIDERS.has(provider.name.toLowerCase())));
        } else {
          setProviders([]);
        }
      } catch {
        if (active) setProviders([]);
      } finally {
        if (active) setIsLoadingProviders(false);
      }
    };

    void loadSession();
    void loadProviders();
    return () => {
      active = false;
    };
  }, [next, router]);

  const handlePasswordLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Login failed");
      }
      const user = "user" in data ? (data.user as AuthUser) : null;
      syncUserToLocalProfile(user);
      router.replace(resolvePostLoginPath(next, user));
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
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
      if (!token) throw new Error("PocketBase did not return an auth token.");

      const response = await fetch("/api/auth/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to complete social login.");
      }
      const user = "user" in result ? (result.user as AuthUser) : null;
      syncUserToLocalProfile(user);
      router.replace(resolvePostLoginPath(next, user));
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Social login failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white px-4 py-6 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl items-center justify-center">
        <section className="w-full rounded-[32px] border border-transparent bg-white p-6 shadow-none sm:p-8">
          <p className="text-[11px] font-black uppercase tracking-[0.32em] text-[#446b00]">Welcome back</p>
          <h2 className="mt-5 text-[2.65rem] font-black leading-none tracking-tight text-[#07091a] sm:text-5xl">
            Login to Bace
          </h2>
          <p className="mt-5 max-w-md text-base leading-8 text-slate-500">
            Access your profile, support account, and backend-connected workspace.
          </p>

          <form onSubmit={handlePasswordLogin} className="mt-8 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-100"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-[18px] bg-[#8fff00] px-4 py-4 text-base font-black text-[#101010] transition hover:bg-[#7be600] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="my-7 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="space-y-2">
            {isLoadingProviders ? (
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
                  className="flex w-full items-center justify-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-4 text-base font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <GoogleMark />
                  Continue with {provider.displayName}
                </button>
              ))
            )}
          </div>

          <p className="mt-7 text-base text-slate-500">
            New here?{" "}
            <Link href={`/auth/register?next=${encodeURIComponent(next)}`} className="font-black text-[#446b00]">
              Create account
            </Link>
          </p>

          {next.startsWith("/admin") ? null : (
            <p className="mt-3 text-sm text-slate-500">
              Admin team?{" "}
              <Link href="/auth/login?next=%2Fadmin" className="font-bold text-slate-700">
                Continue to admin login
              </Link>
            </p>
          )}

          {error ? (
            <p className="mt-5 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
