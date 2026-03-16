"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

export default function ProfilePage() {
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
  const [supportAuthenticated, setSupportAuthenticated] = useState(false);
  const [supportSession, setSupportSession] = useState<SupportSessionSnapshot | null>(null);
  const [recentSupportComplaints, setRecentSupportComplaints] = useState<SupportComplaintSnapshot[]>([]);
  const [supportError, setSupportError] = useState<string | null>(null);

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
  }, []);

  const resetEditFormFromProfile = () => {
    setEditName(profile.name);
    setEditEmail(profile.email);
    setEditPhone(profile.phone || "");
    setEditCompany(profile.company || "");
  };

  const handleSaveProfile = () => {
    updateProfile({
      name: editName.trim() || "User",
      email: editEmail.trim(),
      phone: editPhone.trim(),
      company: editCompany.trim(),
    });
    setIsEditing(false);
    setStatusMessage("Profile updated.");
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
      <section
        className={`relative overflow-hidden rounded-[28px] border px-5 py-6 sm:px-7 sm:py-8 ${
          isDark ? "border-gray-700 bg-[#0c111a]" : "border-[#dbe4ff] bg-[#f6f9ff]"
        }`}
      >
        <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-[#2264ff]/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-[-60px] h-44 w-44 rounded-full bg-[#0b0f19]/10 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <div>
            <p className={`text-[11px] uppercase tracking-[0.2em] ${isDark ? "text-blue-300" : "text-blue-700"}`}>
              Profile Command Center
            </p>
            <div className="mt-3 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2264ff] to-[#0b0f19] text-xl font-bold text-white shadow-lg">
                {initials}
              </div>
              <div>
                <h1 className={`text-2xl font-bold sm:text-3xl ${isDark ? "text-white" : "text-[#0b1220]"}`}>
                  {profile.name || "User"}
                </h1>
                <p className={`text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                  {profile.email || "No email added yet"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MetricTile label="Completion" value={`${profileCompletion}%`} isDark={isDark} />
              <MetricTile label="Workspaces" value={`${workspaces.length}`} isDark={isDark} />
              <MetricTile label="Account Age" value={`${accountAgeDays}d`} isDark={isDark} />
            </div>
          </div>

          <div className={`rounded-2xl border p-4 ${isDark ? "border-gray-700 bg-black/30" : "border-white bg-white/80"}`}>
            <p className={`text-xs uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-500"}`}>Environment</p>
            <p className={`mt-1 text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
              Active workspace: {currentWorkspace?.name || "None"}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setTheme("light")}
                className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                  theme === "light"
                    ? "border-[#2264ff] bg-[#e9f0ff] text-[#1e4fd6]"
                    : isDark
                      ? "border-gray-700 bg-[#111827] text-gray-200 hover:border-gray-500"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                Daylight
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                  theme === "dark"
                    ? "border-[#2264ff] bg-[#15213d] text-[#8fb0ff]"
                    : isDark
                      ? "border-gray-700 bg-[#111827] text-gray-200 hover:border-gray-500"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                Night Shift
              </button>
            </div>
          </div>
        </div>
      </section>

      {statusMessage && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${isDark ? "border-gray-700 bg-[#0b1220] text-blue-200" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
          {statusMessage}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        <section className={`rounded-3xl border p-5 sm:p-6 lg:col-span-7 ${isDark ? "border-gray-700 bg-[#0a0a0a]" : "border-gray-200 bg-white"}`}>
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
                  if (isEditing) handleSaveProfile();
                  else {
                    resetEditFormFromProfile();
                    setIsEditing(true);
                  }
                }}
                className="rounded-lg bg-[#2264ff] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1c52d4]"
              >
                {isEditing ? "Save Changes" : "Edit Profile"}
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

          <div className={`mt-5 rounded-2xl border px-4 py-3 ${isDark ? "border-[#1d2945] bg-[#0b1220]" : "border-[#d7e4ff] bg-[#f7faff]"}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-blue-300" : "text-blue-700"}`}>
              Data Isolation
            </p>
            <p className={`mt-1 text-xs ${isDark ? "text-blue-200/80" : "text-blue-800/80"}`}>
              Each workspace keeps separate accounting, tax, and reporting records.
            </p>
          </div>
        </section>

        <section className={`rounded-3xl border p-5 sm:p-6 lg:col-span-5 ${isDark ? "border-gray-700 bg-[#0a0a0a]" : "border-gray-200 bg-white"}`}>
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
                isDark ? "border-gray-600 bg-[#111827] text-white placeholder:text-gray-500" : "border-gray-200 bg-white text-gray-900 placeholder:text-gray-400"
              }`}
            />
            <button
              onClick={handleCreateWorkspace}
              disabled={!newWorkspaceName.trim()}
              className="rounded-xl bg-[#2264ff] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1c52d4] disabled:cursor-not-allowed disabled:opacity-50"
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
                        ? "border-[#3056d8] bg-[#0f1f4a]"
                        : "border-[#bcd0ff] bg-[#edf3ff]"
                      : isDark
                        ? "border-gray-700 bg-[#0b0f1a] hover:border-gray-500"
                        : "border-gray-200 bg-white hover:border-gray-300"
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
                              isDark ? "border-gray-600 bg-[#111827] text-white" : "border-gray-200 bg-white text-gray-900"
                            }`}
                            autoFocus
                          />
                          <button
                            onClick={() => handleRenameWorkspace(workspace.id)}
                            className="rounded-lg bg-[#2264ff] px-2.5 py-1.5 text-[11px] font-semibold text-white"
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
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isDark ? "bg-[#1f3b8a] text-blue-200" : "bg-[#dbe7ff] text-[#1f4dd8]"}`}>
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

      <section className={`rounded-3xl border p-5 sm:p-6 ${isDark ? "border-gray-700 bg-[#0a0a0a]" : "border-gray-200 bg-white"}`}>
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
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${isDark ? "border-rose-900 bg-rose-950/30 text-rose-200" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
            {supportError}
          </div>
        ) : null}

        {supportLoading ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className={`h-32 animate-pulse rounded-2xl ${isDark ? "bg-[#111827]" : "bg-slate-100"}`} />
            <div className={`h-32 animate-pulse rounded-2xl ${isDark ? "bg-[#111827]" : "bg-slate-100"}`} />
          </div>
        ) : supportAuthenticated ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className={`rounded-2xl border px-4 py-4 ${isDark ? "border-gray-700 bg-[#0f172a]" : "border-gray-200 bg-[#fafcff]"}`}>
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

            <div className={`rounded-2xl border px-4 py-4 ${isDark ? "border-gray-700 bg-[#0f172a]" : "border-gray-200 bg-[#fafcff]"}`}>
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
                          ? "border-gray-700 bg-[#0b0f1a] hover:border-gray-500"
                          : "border-gray-200 bg-white hover:border-gray-300"
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
          <div className={`mt-4 rounded-2xl border px-4 py-4 ${isDark ? "border-gray-700 bg-[#0f172a]" : "border-gray-200 bg-[#fafcff]"}`}>
            <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Support account not connected</p>
            <p className={`mt-1 text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}>
              Sign in or register to submit complaints, reply to support, and track resolutions directly from the product.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/auth/sign-in?next=%2Fsupport"
                className="rounded-xl bg-[#2264ff] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1c52d4]"
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
    <div className={`rounded-2xl border px-3 py-3 ${isDark ? "border-gray-700 bg-black/30" : "border-white bg-white/75"}`}>
      <p className={`text-[11px] uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-500"}`}>{label}</p>
      <p className={`mt-1 text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{value}</p>
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
          isDark ? "border-gray-600 bg-[#111827] text-white placeholder:text-gray-500" : "border-gray-200 bg-white text-gray-900 placeholder:text-gray-400"
        }`}
      />
    </div>
  );
}

function InfoCell({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${isDark ? "border-gray-700 bg-[#0f172a]" : "border-gray-200 bg-[#fafcff]"}`}>
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
    new: isDark ? "bg-blue-950/40 text-blue-200" : "bg-blue-50 text-blue-700",
    triaged: isDark ? "bg-indigo-950/40 text-indigo-200" : "bg-indigo-50 text-indigo-700",
    investigating: isDark ? "bg-amber-950/40 text-amber-200" : "bg-amber-50 text-amber-700",
    waiting_user: isDark ? "bg-orange-950/40 text-orange-200" : "bg-orange-50 text-orange-700",
    resolved: isDark ? "bg-emerald-950/40 text-emerald-200" : "bg-emerald-50 text-emerald-700",
    closed: isDark ? "bg-gray-800 text-gray-200" : "bg-slate-100 text-slate-700",
  }[status || "new"];

  return tone || (isDark ? "bg-gray-800 text-gray-200" : "bg-slate-100 text-slate-700");
}
