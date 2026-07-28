"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  role: string;
  status: string;
};

type ComplaintItem = {
  id: string;
  subject?: string;
  description?: string;
  category?: string;
  priority?: string;
  status?: string;
  resolution?: string;
  created?: string;
  updated?: string;
  expand?: {
    assignee?: { name?: string; fullName?: string; email?: string };
  };
};

type ComplaintMessage = {
  id: string;
  message?: string;
  internalNote?: boolean;
  created?: string;
  expand?: {
    sender?: { name?: string; fullName?: string; email?: string };
  };
};

type ComplaintListResponse = {
  success?: boolean;
  items?: ComplaintItem[];
  error?: string;
};

type ComplaintDetailResponse = {
  success?: boolean;
  item?: ComplaintItem;
  error?: string;
};

type ComplaintMessagesResponse = {
  success?: boolean;
  items?: ComplaintMessage[];
  error?: string;
};

const OPEN_STATUSES = new Set(["new", "triaged", "investigating", "waiting_user"]);

export default function SupportPage() {
  const searchParams = useSearchParams();
  const requestedTicketId = useMemo(() => searchParams.get("ticket"), [searchParams]);

  const [authStatus, setAuthStatus] = useState<"loading" | "authenticated" | "guest">("loading");
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintItem | null>(null);
  const [messages, setMessages] = useState<ComplaintMessage[]>([]);

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [replyMessage, setReplyMessage] = useState("");

  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [replyLoading, setReplyLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetToGuest = useCallback(() => {
    setAuthStatus("guest");
    setSession(null);
    setComplaints([]);
    setSelectedId(null);
    setSelectedComplaint(null);
    setMessages([]);
  }, []);

  const loadComplaints = useCallback(
    async ({
      preferredId,
      status = statusFilter,
      search = query,
    }: {
      preferredId?: string | null;
      status?: string;
      search?: string;
    } = {}) => {
      setListLoading(true);
      try {
        const params = new URLSearchParams({ page: "1", perPage: "50" });
        if (status) params.set("status", status);
        if (search) params.set("query", search);

        const response = await fetch(`/api/complaints?${params.toString()}`, { cache: "no-store" });
        if (response.status === 401) {
          resetToGuest();
          return;
        }

        const data = (await response.json()) as ComplaintListResponse;
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to load complaints");
        }

        const nextItems = Array.isArray(data.items) ? data.items : [];
        setComplaints(nextItems);
        setSelectedId((current) => {
          const target = preferredId ?? current ?? requestedTicketId;
          if (target && nextItems.some((item) => item.id === target)) return target;
          return nextItems[0]?.id || null;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load complaints");
      } finally {
        setListLoading(false);
      }
    },
    [query, requestedTicketId, resetToGuest, statusFilter],
  );

  const loadComplaintDetail = useCallback(
    async (complaintId: string) => {
      setDetailLoading(true);
      try {
        const [detailResponse, messagesResponse] = await Promise.all([
          fetch(`/api/complaints/${complaintId}`, { cache: "no-store" }),
          fetch(`/api/complaints/${complaintId}/messages`, { cache: "no-store" }),
        ]);

        if (detailResponse.status === 401 || messagesResponse.status === 401) {
          resetToGuest();
          return;
        }

        const detailData = (await detailResponse.json()) as ComplaintDetailResponse;
        const messagesData = (await messagesResponse.json()) as ComplaintMessagesResponse;

        if (!detailResponse.ok || !detailData.success || !detailData.item) {
          throw new Error(detailData.error || "Failed to load complaint");
        }
        if (!messagesResponse.ok || !messagesData.success) {
          throw new Error(messagesData.error || "Failed to load complaint messages");
        }

        setSelectedComplaint(detailData.item);
        setMessages(Array.isArray(messagesData.items) ? messagesData.items : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load complaint");
      } finally {
        setDetailLoading(false);
      }
    },
    [resetToGuest],
  );

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!active) return;

        if (!response.ok) {
          resetToGuest();
          return;
        }

        const data = (await response.json()) as {
          success?: boolean;
          authenticated?: boolean;
          session?: SessionPayload;
        };

        if (data.success && data.authenticated && data.session) {
          setSession(data.session);
          setAuthStatus("authenticated");
          return;
        }

        resetToGuest();
      } catch {
        if (active) resetToGuest();
      }
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, [resetToGuest]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setListLoading(false);
      return;
    }
    void loadComplaints();
  }, [authStatus, loadComplaints]);

  useEffect(() => {
    if (authStatus !== "authenticated" || !selectedId) {
      setSelectedComplaint(null);
      setMessages([]);
      setDetailLoading(false);
      return;
    }
    void loadComplaintDetail(selectedId);
  }, [authStatus, loadComplaintDetail, selectedId]);

  const visibleOpenCount = useMemo(
    () => complaints.filter((item) => OPEN_STATUSES.has(item.status || "")).length,
    [complaints],
  );
  const waitingCount = useMemo(
    () => complaints.filter((item) => item.status === "waiting_user").length,
    [complaints],
  );
  const resolvedCount = useMemo(
    () => complaints.filter((item) => item.status === "resolved" || item.status === "closed").length,
    [complaints],
  );

  const handleCreateComplaint = async (event: FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setError("Subject and description are required.");
      return;
    }

    setSubmitLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          description: description.trim(),
          category,
          priority,
        }),
      });

      if (response.status === 401) {
        resetToGuest();
        return;
      }

      const data = (await response.json()) as { success?: boolean; item?: ComplaintItem; error?: string };
      if (!response.ok || !data.success || !data.item) {
        throw new Error(data.error || "Unable to submit complaint");
      }

      const newComplaintId = data.item.id;
      setSubject("");
      setDescription("");
      setCategory("general");
      setPriority("medium");
      setStatusFilter("");
      setQuery("");
      setQueryInput("");
      setSelectedId(newComplaintId);
      setMessage("Complaint submitted. You can now track updates and reply here.");
      await loadComplaints({ preferredId: newComplaintId, status: "", search: "" });
      await loadComplaintDetail(newComplaintId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit complaint");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || !replyMessage.trim()) return;

    setReplyLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/complaints/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyMessage.trim() }),
      });

      if (response.status === 401) {
        resetToGuest();
        return;
      }

      const data = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to post reply");
      }

      setReplyMessage("");
      setMessage("Reply sent to support.");
      await Promise.all([
        loadComplaints({ preferredId: selectedId }),
        loadComplaintDetail(selectedId),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to post reply");
    } finally {
      setReplyLoading(false);
    }
  };

  const handleCloseComplaint = async () => {
    if (!selectedId) return;

    setClosing(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/complaints/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });

      if (response.status === 401) {
        resetToGuest();
        return;
      }

      const data = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to close complaint");
      }

      setMessage("Complaint closed.");
      await Promise.all([
        loadComplaints({ preferredId: selectedId }),
        loadComplaintDetail(selectedId),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to close complaint");
    } finally {
      setClosing(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    setError(null);
    setMessage(null);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      resetToGuest();
      setMessage("Support account signed out.");
    } catch {
      setError("Unable to sign out right now.");
    } finally {
      setLoggingOut(false);
    }
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery(queryInput.trim());
  };

  if (authStatus === "loading") {
    return (
      <div className="space-y-4 pb-24">
        <div className="h-40 animate-pulse rounded-3xl border border-slate-200 bg-white" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-[32rem] animate-pulse rounded-3xl border border-slate-200 bg-white" />
          <div className="h-[32rem] animate-pulse rounded-3xl border border-slate-200 bg-white" />
        </div>
      </div>
    );
  }

  if (authStatus === "guest") {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-24">
        <section className="overflow-hidden rounded-[28px] border border-[#dbe4ff] bg-[#f6f9ff] px-6 py-8 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-blue-700">Support Operations</p>
              <h1 className="mt-3 text-3xl font-bold text-[#0b1220] sm:text-4xl">Track issues, replies, and resolutions in one place.</h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
                Create a support account, sign in with social login, raise complaints, and keep the full ticket history attached to your project usage.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/auth/login?next=%2Fsupport"
                  className="rounded-xl bg-[#9080ee] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6f5ce0]"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/register?next=%2Fsupport"
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white"
                >
                  Create account
                </Link>
              </div>
            </div>

            <div className="grid gap-3">
              <InfoPanel title="Social auth ready" body="Use PocketBase social providers such as Google or GitHub once they are configured." />
              <InfoPanel title="Complaint timeline" body="Every reply, resolution note, and status change stays attached to the ticket." />
              <InfoPanel title="Admin follow-through" body="Support agents can triage, investigate, and resolve issues from the admin console you already have." />
            </div>
          </div>
        </section>

        {message ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>
        ) : null}
        {error ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <section className="overflow-hidden rounded-[28px] border border-[#dbe4ff] bg-[#f6f9ff] px-5 py-6 sm:px-7 sm:py-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-blue-700">Support Desk</p>
            <h1 className="mt-3 text-2xl font-bold text-[#0b1220] sm:text-3xl">User complaint portal</h1>
            <p className="mt-2 text-sm text-slate-600">
              Signed in as <span className="font-semibold text-slate-900">{session?.name || session?.email || "Support user"}</span>. Submit new tickets, follow replies, and close issues once they are resolved.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <MetricCard label="Visible tickets" value={String(complaints.length)} />
            <MetricCard label="Open" value={String(visibleOpenCount)} />
            <MetricCard label="Waiting on you" value={String(waitingCount)} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/profile" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white">
            Open profile
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white disabled:opacity-60"
          >
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
          <span className="text-sm text-slate-500">Resolved: {resolvedCount}</span>
        </div>
      </section>

      {message ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Open a new complaint</h2>
              <p className="mt-1 text-sm text-slate-500">Include enough detail for support to reproduce the issue quickly.</p>
            </div>

            <form onSubmit={handleCreateComplaint} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Subject</label>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Brief title for the issue"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-[#9080ee] focus:outline-none focus:ring-2 focus:ring-[#9080ee]/20"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Category</label>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-[#9080ee] focus:outline-none focus:ring-2 focus:ring-[#9080ee]/20"
                  >
                    <option value="general">General</option>
                    <option value="billing">Billing</option>
                    <option value="accounting">Accounting</option>
                    <option value="tax">Tax</option>
                    <option value="performance">Performance</option>
                    <option value="security">Security</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Priority</label>
                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-[#9080ee] focus:outline-none focus:ring-2 focus:ring-[#9080ee]/20"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe what happened, what you expected, and any error text you saw."
                  rows={6}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-[#9080ee] focus:outline-none focus:ring-2 focus:ring-[#9080ee]/20"
                />
              </div>

              <button
                type="submit"
                disabled={submitLoading || !subject.trim() || !description.trim()}
                className="rounded-xl bg-[#9080ee] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6f5ce0] disabled:opacity-60"
              >
                {submitLoading ? "Submitting..." : "Submit complaint"}
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Your tickets</h2>
                <p className="mt-1 text-sm text-slate-500">Filter by status or search by title and description.</p>
              </div>
              <button
                type="button"
                onClick={() => void loadComplaints({ preferredId: selectedId })}
                disabled={listLoading}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Refresh
              </button>
            </div>

            <form onSubmit={handleSearch} className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
              <input
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="Search complaints"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-[#9080ee] focus:outline-none focus:ring-2 focus:ring-[#9080ee]/20"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-[#9080ee] focus:outline-none focus:ring-2 focus:ring-[#9080ee]/20"
              >
                <option value="">All statuses</option>
                <option value="new">New</option>
                <option value="triaged">Triaged</option>
                <option value="investigating">Investigating</option>
                <option value="waiting_user">Waiting for you</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <button
                type="submit"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Apply
              </button>
            </form>

            <div className="mt-4 space-y-3">
              {listLoading ? (
                <p className="text-sm text-slate-500">Loading tickets...</p>
              ) : complaints.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No complaints match the current filter.
                </div>
              ) : (
                complaints.map((item) => {
                  const isSelected = item.id === selectedId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? "border-[#bcd0ff] bg-[#edf3ff]"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{item.subject || "Untitled complaint"}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description || "No description provided."}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <StatusBadge status={item.status} />
                          <PriorityBadge priority={item.priority} />
                        </div>
                      </div>
                      <p className="mt-3 text-[11px] text-slate-500">
                        {item.created ? new Date(item.created).toLocaleString() : "Unknown date"}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
          {!selectedId ? (
            <div className="flex h-full min-h-[32rem] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
              Select a complaint to review the full thread, reply, or close it.
            </div>
          ) : detailLoading ? (
            <div className="space-y-4">
              <div className="h-8 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
            </div>
          ) : !selectedComplaint ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Unable to load complaint details.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Ticket #{selectedComplaint.id.slice(0, 8).toUpperCase()}</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">{selectedComplaint.subject || "Untitled complaint"}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Opened {selectedComplaint.created ? new Date(selectedComplaint.created).toLocaleString() : "recently"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selectedComplaint.status} />
                  <PriorityBadge priority={selectedComplaint.priority} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <DetailCell label="Category" value={selectedComplaint.category || "General"} />
                <DetailCell
                  label="Assigned to"
                  value={
                    selectedComplaint.expand?.assignee?.name ||
                    selectedComplaint.expand?.assignee?.fullName ||
                    selectedComplaint.expand?.assignee?.email ||
                    "Unassigned"
                  }
                />
                <DetailCell label="Latest update" value={selectedComplaint.updated ? new Date(selectedComplaint.updated).toLocaleString() : "Pending"} />
              </div>

              <article className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Original complaint</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{selectedComplaint.description || "No description provided."}</p>
              </article>

              {selectedComplaint.resolution ? (
                <article className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Resolution note</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-900">{selectedComplaint.resolution}</p>
                </article>
              ) : null}

              <div className="rounded-2xl border border-slate-200">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-900">Conversation</h3>
                </div>
                <div className="space-y-3 px-4 py-4">
                  {messages.length === 0 ? (
                    <p className="text-sm text-slate-500">No follow-up messages yet.</p>
                  ) : (
                    messages.map((item) => (
                      <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="whitespace-pre-wrap text-sm text-slate-800">{item.message}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          {item.expand?.sender?.name || item.expand?.sender?.fullName || item.expand?.sender?.email || "Support"}
                          {" · "}
                          {item.created ? new Date(item.created).toLocaleString() : "Unknown time"}
                        </p>
                      </article>
                    ))
                  )}
                </div>
              </div>

              <form onSubmit={handleReply} className="rounded-2xl border border-slate-200 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Send an update</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Add more context, answer a follow-up, or reopen a resolved ticket with new evidence.
                    </p>
                  </div>
                  {selectedComplaint.status !== "closed" ? (
                    <button
                      type="button"
                      onClick={handleCloseComplaint}
                      disabled={closing}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {closing ? "Closing..." : "Close ticket"}
                    </button>
                  ) : null}
                </div>

                <textarea
                  value={replyMessage}
                  onChange={(event) => setReplyMessage(event.target.value)}
                  rows={4}
                  placeholder="Write your reply or add additional details"
                  className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-[#9080ee] focus:outline-none focus:ring-2 focus:ring-[#9080ee]/20"
                />

                <button
                  type="submit"
                  disabled={replyLoading || !replyMessage.trim()}
                  className="mt-3 rounded-xl bg-[#9080ee] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6f5ce0] disabled:opacity-60"
                >
                  {replyLoading ? "Sending..." : selectedComplaint.status === "closed" ? "Reply and reopen" : "Send reply"}
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function InfoPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white bg-white/75 px-4 py-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white bg-white/80 px-4 py-3 shadow-sm">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const label = formatStatus(status);
  const styles = {
    new: "border-blue-200 bg-blue-50 text-blue-700",
    triaged: "border-indigo-200 bg-indigo-50 text-indigo-700",
    investigating: "border-amber-200 bg-amber-50 text-amber-800",
    waiting_user: "border-orange-200 bg-orange-50 text-orange-700",
    resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
    closed: "border-slate-200 bg-slate-100 text-slate-700",
  }[status || "new"] || "border-slate-200 bg-slate-100 text-slate-700";

  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles}`}>{label}</span>;
}

function PriorityBadge({ priority }: { priority?: string }) {
  const label = priority ? `${capitalize(priority)} priority` : "Medium priority";
  const styles = {
    low: "border-slate-200 bg-slate-100 text-slate-700",
    medium: "border-blue-200 bg-blue-50 text-blue-700",
    high: "border-amber-200 bg-amber-50 text-amber-800",
    urgent: "border-rose-200 bg-rose-50 text-rose-700",
  }[priority || "medium"] || "border-blue-200 bg-blue-50 text-blue-700";

  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles}`}>{label}</span>;
}

function formatStatus(status?: string): string {
  if (!status) return "New";
  if (status === "waiting_user") return "Waiting for you";
  return status
    .split("_")
    .map((part) => capitalize(part))
    .join(" ");
}

function capitalize(value: string): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
