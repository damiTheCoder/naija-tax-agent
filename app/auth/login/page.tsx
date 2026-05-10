"use client";

import { FormEvent, useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getPocketBaseBrowserClient } from "@/lib/pocketbase/browserClient";
import { POCKETBASE_USER_COLLECTION, isAdminRole } from "@/lib/pocketbase/config";

type Provider = { name: string; displayName: string };

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get("next") || "/admin", [searchParams]);
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
        if (isAdminRole(data.session?.role)) {
          router.replace(next);
          router.refresh();
          return;
        }
        setError("You are signed in but do not have admin dashboard access.");
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
          setProviders(data.providers);
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
      router.replace(next);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: string) => {
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
      router.replace(next);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Social login failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Admin Sign In</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sign in with your account to access support and user management tools.
        </p>

        <form onSubmit={handlePasswordLogin} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#8fff00] focus:outline-none focus:ring-2 focus:ring-[#8fff00]/20"
              placeholder="you@company.com"
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
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-[#8fff00] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6fcc00] disabled:opacity-60"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs uppercase tracking-wide text-slate-500">or</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="space-y-2">
          {isLoadingProviders ? (
            <p className="text-sm text-slate-500">Loading social providers...</p>
          ) : providers.length === 0 ? (
            <p className="text-sm text-slate-500">
              No social providers configured in PocketBase.
            </p>
          ) : (
            providers.map((provider) => (
              <button
                key={provider.name}
                type="button"
                onClick={() => handleSocialLogin(provider.name)}
                disabled={isLoading}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Continue with {provider.displayName}
              </button>
            ))
          )}
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
