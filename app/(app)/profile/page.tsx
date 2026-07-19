"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { useTheme } from "@/lib/ThemeContext";

const PROFILE_PAGE_RENDERED_AT = Date.now();

type SupportSessionSnapshot = {
  name: string;
  email: string;
  role: string;
  status: string;
};

type SupportComplaintSnapshot = {
  id: string;
  subject?: string;
  status?: string;
  created?: string;
};

type BackendProfileSnapshot = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const {
    profile,
    updateProfile,
    workspaces,
    currentWorkspace,
    createWorkspace,
    deleteWorkspace,
    renameWorkspace,
    switchWorkspace,
    isLoaded,
  } = useWorkspace();
  const { theme, setTheme, mounted } = useTheme();

  const [isEditing, setIsEditing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [editName, setEditName] = useState(profile.name);
  const [editEmail, setEditEmail] = useState(profile.email);
  const [editPhone, setEditPhone] = useState(profile.phone || "");
  const [editCompany, setEditCompany] = useState(profile.company || "");

  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editingWorkspaceName, setEditingWorkspaceName] = useState("");
  const [supportLoading, setSupportLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [supportAuthenticated, setSupportAuthenticated] = useState(false);
  const [supportSession, setSupportSession] = useState<SupportSessionSnapshot | null>(null);
  const [recentSupportComplaints, setRecentSupportComplaints] = useState<SupportComplaintSnapshot[]>([]);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isDark = mounted ? theme === "dark" : false;

  const initials = useMemo(() => {
    const value = profile.name?.trim() || "User";
    return value
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [profile.name]);

  const profileCompletion = useMemo(() => {
    const fields = [profile.name, profile.email, profile.phone, profile.company];
    const completed = fields.filter((value) => String(value || "").trim().length > 0).length;
    return Math.round((completed / fields.length) * 100);
  }, [profile.company, profile.email, profile.name, profile.phone]);

  const accountAgeDays = useMemo(() => {
    if (!workspaces.length) return 0;
    const earliest = Math.min(
      ...workspaces.map((workspace) => {
        const date = new Date(workspace.createdAt);
        return Number.isNaN(date.getTime()) ? PROFILE_PAGE_RENDERED_AT : date.getTime();
      })
    );
    const diff = PROFILE_PAGE_RENDERED_AT - earliest;
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }, [workspaces]);

  useEffect(() => {
    let active = true;

    const loadSupportSnapshot = async () => {
      try {
        setSupportLoading(true);
        setSupportError(null);

        const meResponse = await fetch("/api/auth/me", { cache: "no-store" });
        if (!active) return;

        if (!meResponse.ok) {
          setSupportAuthenticated(false);
          setSupportSession(null);
          setRecentSupportComplaints([]);
          return;
        }

        const meData = (await meResponse.json()) as {
          success?: boolean;
          authenticated?: boolean;
          session?: SupportSessionSnapshot;
        };
        if (!active) return;

        if (!meData.success || !meData.authenticated || !meData.session) {
          setSupportAuthenticated(false);
          setSupportSession(null);
          setRecentSupportComplaints([]);
          return;
        }

        const profileResponse = await fetch("/api/auth/profile", { cache: "no-store" });
        if (!active) return;
        if (profileResponse.ok) {
          const profileData = (await profileResponse.json()) as {
            success?: boolean;
            profile?: BackendProfileSnapshot;
          };
          if (profileData.success && profileData.profile) {
            updateProfile({
              id: profileData.profile.id,
              name: profileData.profile.name || meData.session.name || "User",
              email: profileData.profile.email || meData.session.email || "",
              phone: profileData.profile.phone || "",
              company: profileData.profile.company || "",
            });
          }
        }

        const complaintsResponse = await fetch("/api/complaints?page=1&perPage=3", { cache: "no-store" });
        if (!active) return;

        let nextComplaints: SupportComplaintSnapshot[] = [];
        if (complaintsResponse.ok) {
          const complaintsData = (await complaintsResponse.json()) as {
            success?: boolean;
            items?: SupportComplaintSnapshot[];
          };
          if (complaintsData.success && Array.isArray(complaintsData.items)) {
            nextComplaints = complaintsData.items;
          }
        }

        setSupportAuthenticated(true);
        setSupportSession(meData.session);
        setRecentSupportComplaints(nextComplaints);
      } catch {
        if (!active) return;
        setSupportAuthenticated(false);
        setSupportSession(null);
        setRecentSupportComplaints([]);
        setSupportError("Unable to load support account snapshot.");
      } finally {
        if (active) setSupportLoading(false);
      }
    };

    void loadSupportSnapshot();
    return () => {
      active = false;
    };
  }, [updateProfile]);

  const resetEditFormFromProfile = () => {
    setEditName(profile.name);
    setEditEmail(profile.email);
    setEditPhone(profile.phone || "");
    setEditCompany(profile.company || "");
  };

  const handleSaveProfile = async () => {
    const nextProfile = {
      name: editName.trim() || "User",
      email: editEmail.trim(),
      phone: editPhone.trim(),
      company: editCompany.trim(),
    };

    setIsSavingProfile(true);
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextProfile),
      });
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        profile?: BackendProfileSnapshot;
      };
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to save profile to PocketBase.");
      }

      updateProfile({
        id: data.profile?.id || profile.id,
        name: data.profile?.name || nextProfile.name,
        email: data.profile?.email || nextProfile.email,
        phone: data.profile?.phone || nextProfile.phone,
        company: data.profile?.company || nextProfile.company,
      });
      setIsEditing(false);
      setStatusMessage("Profile saved to PocketBase.");
    } catch (error) {
      updateProfile(nextProfile);
      setStatusMessage(error instanceof Error ? `${error.message} Local cache updated.` : "Local cache updated.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCreateWorkspace = () => {
    const name = newWorkspaceName.trim();
    if (!name) return;
    const workspace = createWorkspace(name);
    setNewWorkspaceName("");
    setStatusMessage(`Workspace "${workspace.name}" created.`);
    switchWorkspace(workspace.id);
  };

  const handleRenameWorkspace = (id: string) => {
    const value = editingWorkspaceName.trim();
    if (!value) return;
    renameWorkspace(id, value);
    setEditingWorkspaceId(null);
    setEditingWorkspaceName("");
    setStatusMessage("Workspace renamed.");
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setStatusMessage(null);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/auth/login");
      router.refresh();
    } catch {
      setStatusMessage("Unable to log out right now.");
      setIsLoggingOut(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="space-y-4 pb-24">
        <div className="h-36 animate-pulse rounded-3xl border border-gray-200 bg-white" />
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="h-80 animate-pulse rounded-3xl border border-gray-200 bg-white lg:col-span-7" />
          <div className="h-80 animate-pulse rounded-3xl border border-gray-200 bg-white lg:col-span-5" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <section className={`rounded-[28px] border px-5 py-6 sm:px-7 sm:py-8 ${isDark ? "border-gray-700" : "border-gray-200"}`}>
        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <div>
            <p className={`text-[11px] uppercase tracking-[0.2em] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Profile
            </p>
            <div className="mt-3 flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${isDark ? "bg-white/10 text-white" : "bg-gray-100 text-[#101010]"}`}>
                  {initials}
                </div>
                <div className="min-w-0">
                  <h1 className={`truncate text-lg font-bold sm:text-xl ${isDark ? "text-white" : "text-[#0b1220]"}`}>
                    {profile.name || "User"}
                  </h1>
                  <p className={`truncate text-xs ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                    {profile.email || "No email added yet"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${
                  isDark
                    ? "bg-gray-700 text-white hover:bg-gray-600"
                    : "bg-gray-300 text-[#101010] hover:bg-gray-400"
                }`}
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>

            <div
              className={`mt-5 flex overflow-hidden rounded-2xl border ${
                isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-100"
              }`}
            >
              <MetricTile label="Completion" value={`${profileCompletion}%`} isDark={isDark} />
              <MetricTile label="Workspaces" value={`${workspaces.length}`} isDark={isDark} />
              <MetricTile label="Account Age" value={`${accountAgeDays}d`} isDark={isDark} />
            </div>
          </div>
        </div>
      </section>

      {statusMessage && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${isDark ? "border-gray-700 text-gray-200" : "border-gray-200 text-gray-700"}`}>
          {statusMessage}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        <section className={`rounded-3xl border p-5 sm:p-6 lg:col-span-7 ${isDark ? "border-gray-700" : "border-gray-200"}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Personal Profile</h2>
              <p className={`mt-1 text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                Update your identity and business details used across the platform.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isEditing && (
                <button
                  onClick={() => {
                    setIsEditing(false);
                    resetEditFormFromProfile();
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${isDark ? "border-gray-600 text-gray-300 hover:bg-gray-800" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => {
                  if (isEditing) void handleSaveProfile();
                  else {
                    resetEditFormFromProfile();
                    setIsEditing(true);
                  }
                }}
                disabled={isSavingProfile}
                className="rounded-lg bg-[#8fff00] px-3.5 py-1.5 text-xs font-semibold text-[#101010] hover:bg-[#7be600] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingProfile ? "Saving..." : isEditing ? "Save Changes" : "Edit Profile"}
              </button>
            </div>
          </div>

          {isEditing ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field label="Full Name" value={editName} onChange={setEditName} isDark={isDark} />
              <Field label="Email Address" type="email" value={editEmail} onChange={setEditEmail} isDark={isDark} />
              <Field label="Phone Number" value={editPhone} onChange={setEditPhone} isDark={isDark} />
              <Field label="Company Name" value={editCompany} onChange={setEditCompany} isDark={isDark} />
            </div>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InfoCell label="Full Name" value={profile.name || "Not set"} isDark={isDark} />
              <InfoCell label="Email Address" value={profile.email || "Not set"} isDark={isDark} />
              <InfoCell label="Phone Number" value={profile.phone || "Not set"} isDark={isDark} />
              <InfoCell label="Company Name" value={profile.company || "Not set"} isDark={isDark} />
            </div>
          )}

          <div className={`mt-5 rounded-2xl border px-4 py-3 ${isDark ? "border-gray-700" : "border-gray-200"}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Data Isolation
            </p>
            <p className={`mt-1 text-xs ${isDark ? "text-gray-300" : "text-gray-600"}`}>
              Each workspace keeps separate accounting, tax, and reporting records.
            </p>
          </div>
        </section>

        <section className={`rounded-3xl border p-5 sm:p-6 lg:col-span-5 ${isDark ? "border-gray-700" : "border-gray-200"}`}>
          <div>
            <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Workspace Studio</h2>
            <p className={`mt-1 text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Create, rename, switch, and manage your workspaces.
            </p>
          </div>

          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(event) => setNewWorkspaceName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleCreateWorkspace();
              }}
              placeholder="New workspace name"
              className={`min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm ${
                isDark ? "border-gray-600 text-white placeholder:text-gray-500" : "border-gray-200 text-gray-900 placeholder:text-gray-400"
              }`}
            />
            <button
              onClick={handleCreateWorkspace}
              disabled={!newWorkspaceName.trim()}
              className="rounded-xl bg-[#8fff00] px-3 py-2 text-xs font-semibold text-[#101010] hover:bg-[#7be600] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Create
            </button>
          </div>

          <div className="sidebar-nav-scrollbar mt-4 max-h-[430px] space-y-2 overflow-y-auto pr-1">
            {workspaces.map((workspace) => {
              const isCurrent = workspace.id === currentWorkspace?.id;
              return (
                <div
                  key={workspace.id}
                  className={`rounded-2xl border p-3 transition ${
                    isCurrent
                      ? isDark
                        ? "border-[#8fff00]"
                        : "border-[#8fff00]"
                      : isDark
                        ? "border-gray-700 hover:border-gray-500"
                        : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {editingWorkspaceId === workspace.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingWorkspaceName}
                            onChange={(event) => setEditingWorkspaceName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") handleRenameWorkspace(workspace.id);
                              if (event.key === "Escape") {
                                setEditingWorkspaceId(null);
                                setEditingWorkspaceName("");
                              }
                            }}
                            className={`min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-xs ${
                              isDark ? "border-gray-600 text-white" : "border-gray-200 text-gray-900"
                            }`}
                            autoFocus
                          />
                          <button
                            onClick={() => handleRenameWorkspace(workspace.id)}
                            className="rounded-lg bg-[#8fff00] px-2.5 py-1.5 text-[11px] font-semibold text-[#101010]"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className={`truncate text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                            {workspace.name}
                          </p>
                          <p className={`mt-1 text-[11px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                            Created {new Date(workspace.createdAt).toLocaleDateString("en-NG")}
                          </p>
                        </>
                      )}
                    </div>

                    {isCurrent ? (
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${isDark ? "border-gray-700 text-gray-200" : "border-gray-200 text-[#446b00]"}`}>
                        Active
                      </span>
                    ) : (
                      <button
                        onClick={() => switchWorkspace(workspace.id)}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                          isDark ? "border-gray-600 text-gray-200 hover:bg-gray-800" : "border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        Switch
                      </button>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingWorkspaceId(workspace.id);
                        setEditingWorkspaceName(workspace.name);
                      }}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                        isDark ? "border-gray-600 text-gray-300 hover:bg-gray-800" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Rename
                    </button>
                    {workspaces.length > 1 && !isCurrent && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${workspace.name}"? This cannot be undone.`)) {
                            deleteWorkspace(workspace.id);
                            setStatusMessage(`Workspace "${workspace.name}" deleted.`);
                          }
                        }}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                          isDark ? "border-rose-900 text-rose-300 hover:bg-rose-950/40" : "border-rose-200 text-rose-600 hover:bg-rose-50"
                        }`}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className={`rounded-3xl border p-5 sm:p-6 ${isDark ? "border-gray-700" : "border-gray-200"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Support Desk</h2>
            <p className={`mt-1 text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Access your PocketBase support account, recent complaints, and direct ticket links.
            </p>
          </div>
          <Link
            href="/support"
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${
              isDark
                ? "border border-gray-600 text-gray-200 hover:bg-gray-800"
                : "border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Open Support Center
          </Link>
        </div>

        {supportError ? (
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${isDark ? "border-rose-900 text-rose-200" : "border-rose-200 text-rose-700"}`}>
            {supportError}
          </div>
        ) : null}

        {supportLoading ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className={`h-32 animate-pulse rounded-2xl border ${isDark ? "border-gray-700" : "border-gray-200"}`} />
            <div className={`h-32 animate-pulse rounded-2xl border ${isDark ? "border-gray-700" : "border-gray-200"}`} />
          </div>
        ) : supportAuthenticated ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className={`rounded-2xl border px-4 py-4 ${isDark ? "border-gray-700" : "border-gray-200"}`}>
              <p className={`text-[11px] uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-500"}`}>Connected Account</p>
              <p className={`mt-2 text-base font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                {supportSession?.name || supportSession?.email || "Support user"}
              </p>
              <p className={`mt-1 text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                {supportSession?.email || "No email"}
              </p>
              <p className={`mt-3 text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                Role: {formatSupportRole(supportSession?.role || "user")} · Status: {supportSession?.status || "active"}
              </p>
            </div>

            <div className={`rounded-2xl border px-4 py-4 ${isDark ? "border-gray-700" : "border-gray-200"}`}>
              <div className="flex items-center justify-between gap-3">
                <p className={`text-[11px] uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-500"}`}>Recent Tickets</p>
                <span className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>{recentSupportComplaints.length} loaded</span>
              </div>

              {recentSupportComplaints.length === 0 ? (
                <div className={`mt-3 rounded-xl border border-dashed px-3 py-4 text-sm ${isDark ? "border-gray-700 text-gray-400" : "border-gray-300 text-gray-500"}`}>
                  No support tickets yet. Open the support center to create your first complaint.
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {recentSupportComplaints.map((complaint) => (
                    <Link
                      key={complaint.id}
                      href={`/support?ticket=${encodeURIComponent(complaint.id)}`}
                      className={`block rounded-xl border px-3 py-3 transition ${
                        isDark
                          ? "border-gray-700 hover:border-gray-500"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                            {complaint.subject || "Untitled complaint"}
                          </p>
                          <p className={`mt-1 text-[11px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                            {complaint.created ? new Date(complaint.created).toLocaleString("en-NG") : "Recently opened"}
                          </p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getProfileStatusBadgeClass(isDark, complaint.status)}`}>
                          {formatComplaintStatus(complaint.status)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={`mt-4 rounded-2xl border px-4 py-4 ${isDark ? "border-gray-700" : "border-gray-200"}`}>
            <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Support account not connected</p>
            <p className={`mt-1 text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
              Sign in or register to submit complaints, reply to support, and track resolutions directly from the product.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/auth/login?next=%2Fsupport"
                className="rounded-xl bg-[#8fff00] px-3 py-2 text-sm font-semibold text-[#101010] hover:bg-[#7be600]"
              >
                Sign In
              </Link>
              <Link
                href="/auth/register?next=%2Fsupport"
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                  isDark
                    ? "border border-gray-600 text-gray-200 hover:bg-gray-800"
                    : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                Create Account
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function MetricTile({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <div
      className={`flex-1 px-2 py-2 text-center ${
        isDark ? "border-white/10" : "border-gray-200/80"
      } [&:not(:last-child)]:border-r`}
    >
      <p className={`text-[10px] uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-500"}`}>{label}</p>
      <p className={`mt-0.5 text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  isDark,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isDark: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className={`mb-1 block text-xs font-semibold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-500"}`}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-xl border px-3 py-2 text-sm ${
          isDark ? "border-gray-600 text-white placeholder:text-gray-500" : "border-gray-200 text-gray-900 placeholder:text-gray-400"
        }`}
      />
    </div>
  );
}

function InfoCell({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${isDark ? "border-gray-700" : "border-gray-200"}`}>
      <p className={`text-[11px] uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-500"}`}>{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function formatSupportRole(role: string): string {
  return role
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatComplaintStatus(status?: string): string {
  if (!status) return "New";
  if (status === "waiting_user") return "Waiting for You";
  return status
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getProfileStatusBadgeClass(isDark: boolean, status?: string): string {
  const tone = {
    new: isDark ? "border border-gray-700 text-gray-200" : "border border-gray-200 text-gray-700",
    triaged: isDark ? "border border-gray-700 text-gray-200" : "border border-gray-200 text-gray-700",
    investigating: isDark ? "border border-gray-700 text-gray-200" : "border border-gray-200 text-gray-700",
    waiting_user: isDark ? "border border-gray-700 text-gray-200" : "border border-gray-200 text-gray-700",
    resolved: isDark ? "border border-gray-700 text-gray-200" : "border border-gray-200 text-gray-700",
    closed: isDark ? "border border-gray-700 text-gray-200" : "border border-gray-200 text-gray-700",
  }[status || "new"];

  return tone || (isDark ? "border border-gray-700 text-gray-200" : "border border-gray-200 text-gray-700");
}
