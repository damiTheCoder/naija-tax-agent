"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

const NEXT_PATH = "/profile";

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
  if (next.startsWith("/admin") && !isAdminRole(user?.role)) return "/profile";
  return next || "/profile";
}

export default function LandingAuthButtons() {
  const router = useRouter();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <Link href={`/auth/login?next=${encodeURIComponent(NEXT_PATH)}`} className="single-landing-primary">
        Login / signup
      </Link>
      <button
        type="button"
        className="single-landing-secondary"
        onClick={handleGoogleLogin}
        disabled={isGoogleLoading}
      >
        <GoogleMark className="h-5 w-5" />
        <span>{isGoogleLoading ? "Connecting..." : "Continue with Google"}</span>
      </button>
      {error ? <p className="single-landing-error">{error}</p> : null}
    </div>
  );
}
