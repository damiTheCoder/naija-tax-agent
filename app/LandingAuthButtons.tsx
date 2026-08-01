"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import GoogleMark from "@/components/GoogleMark";
import { getPocketBaseBrowserClient } from "@/lib/pocketbase/browserClient";
import { ALLOWED_OAUTH_PROVIDERS, POCKETBASE_USER_COLLECTION, isAdminRole } from "@/lib/pocketbase/config";
import { STORAGE_KEYS, type UserProfile } from "@/lib/workspace/types";

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
};

const NEXT_PATH = "/accounting";

function saveAnonymousLocalProfile() {
  window.localStorage.removeItem(STORAGE_KEYS.TEMPORARY_ACCESS);
  window.localStorage.setItem(
    STORAGE_KEYS.USER_PROFILE,
    JSON.stringify({
      id: "anonymous-user",
      name: "Guest",
      email: "",
    } satisfies UserProfile)
  );
}

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
  window.localStorage.removeItem(STORAGE_KEYS.TEMPORARY_ACCESS);
}

function resolvePostLoginPath(next: string, user: Partial<AuthUser> | null | undefined): string {
  if (next.startsWith("/admin") && !isAdminRole(user?.role)) return "/accounting";
  return next || "/accounting";
}

function QrCodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path d="M14 14h3v3h-3z" />
      <path d="M17.5 14h.5v.5h-.5z" />
      <path d="M14 17.5h.5v.5h-.5z" />
      <path d="M17.5 17.5h.5v.5h-.5z" />
      <path d="M20 14h.5v7h-.5z" />
      <path d="M14 20.5h6v.5h-6z" />
    </svg>
  );
}

export default function LandingAuthButtons() {
  const router = useRouter();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const syncExistingProfile = () => {
      if (!window.localStorage.getItem(STORAGE_KEYS.USER_PROFILE)) {
        saveAnonymousLocalProfile();
      }
    };

    void syncExistingProfile();
    return () => {
      active = false;
    };
  }, [router]);

  const handleUseApp = async () => {
    saveAnonymousLocalProfile();
    try {
      await fetch("/api/auth/temporary", { method: "POST" });
    } catch {
      // Continue anyway; the local profile enables client-side usage.
    }
    router.replace(NEXT_PATH);
  };

  const handleGoogleLogin = async () => {
    const provider = "google";
    if (!ALLOWED_OAUTH_PROVIDERS.has(provider)) {
      setError("Google login is not enabled yet.");
      return;
    }

    setIsGoogleLoading(true);
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
      const result = (await response.json()) as { success?: boolean; error?: string; user?: AuthUser };
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to complete Google login.");
      }

      syncUserToLocalProfile(result.user);
      router.replace(resolvePostLoginPath(NEXT_PATH, result.user));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google login failed.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="single-landing-actions">
      <button
        type="button"
        className="single-landing-primary"
        onClick={handleUseApp}
      >
        <span className="single-landing-qr" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <path d="M14 14h3v3h-3z" />
            <path d="M17.5 14h.5v.5h-.5z" />
            <path d="M14 17.5h.5v.5h-.5z" />
            <path d="M17.5 17.5h.5v.5h-.5z" />
            <path d="M20 14h.5v7h-.5z" />
            <path d="M14 20.5h6v.5h-6z" />
          </svg>
        </span>
        <span className="single-landing-primary-text">Use app</span>
      </button>

      <div className="single-landing-row">
        <Link href={`/auth/login?next=${encodeURIComponent(NEXT_PATH)}`} className="single-landing-secondary">
          Login / signup
        </Link>
        <button
          type="button"
          className="single-landing-temporary"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
        >
          <GoogleMark className="h-5 w-5" />
          <span>{isGoogleLoading ? "Connecting..." : "Google"}</span>
        </button>
      </div>

      {error ? <p className="single-landing-error">{error}</p> : null}
    </div>
  );
}
