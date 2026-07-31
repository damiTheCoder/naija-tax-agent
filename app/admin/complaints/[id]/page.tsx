"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type ComplaintMessage = {
  id: string;
  message?: string;
  internalNote?: boolean;
  created?: string;
  expand?: {
    sender?: { name?: string; fullName?: string; email?: string };
  };
};

type ComplaintItem = {
  id: string;
  subject?: string;
  description?: string;
  status?: string;
  priority?: string;
  resolution?: string;
  assignee?: string;
  created?: string;
  expand?: {
    user?: { id?: string; email?: string; name?: string; fullName?: string };
    assignee?: { id?: string; email?: string; name?: string; fullName?: string };
  };
};

type ComplaintResponse = {
  success: boolean;
  item?: ComplaintItem;
  messages?: ComplaintMessage[];
  error?: string;
};

export default function ComplaintDetailPage() {
  const params = useParams<{ id: string }>();
  const complaintId = params.id;
  const router = useRouter();

  const [complaint, setComplaint] = useState<ComplaintItem | null>(null);
  const [messages, setMessages] = useState<ComplaintMessage[]>([]);
  const [status, setStatus] = useState("new");
  const [priority, setPriority] = useState("medium");
  const [resolution, setResolution] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadComplaint = useCallback(async () => {
    const response = await fetch(`/api/admin/complaints/${complaintId}`, { cache: "no-store" });
    const data = (await response.json()) as ComplaintResponse;
    if (!response.ok || !data.success || !data.item) {
      throw new Error(data.error || "Failed to load complaint");
    }
    setComplaint(data.item);
    setMessages(data.messages || []);
    setStatus(data.item.status || "new");
    setPriority(data.item.priority || "medium");
    setResolution(data.item.resolution || "");
  }, [complaintId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        await loadComplaint();
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load complaint");
      } finally {
        if (active) setLoading(false);
      }
    };
    if (complaintId) void load();
    return () => {
      active = false;
    };
  }, [complaintId, loadComplaint]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/complaints/${complaintId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          priority,
          resolution,
          internalNote: internalNote.trim() || undefined,
        }),
      });
      const data = (await response.json()) as ComplaintResponse;
      if (!response.ok || !data.success || !data.item) {
        throw new Error(data.error || "Failed to update complaint");
      }

      setComplaint(data.item);
      setInternalNote("");
      setMessage("Complaint updated successfully.");
      await loadComplaint();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update complaint";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handlePostMessage = async () => {
    if (!replyMessage.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/complaints/${complaintId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyMessage.trim(), internalNote: false }),
      });
      const data = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to add message");
      }
      setReplyMessage("");
      await loadComplaint();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add message";
      setError(msg);
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading complaint...</div>;
  }

  if (!complaint) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        {error || "Complaint not found."}
      </div>
    );
  }

  const userLabel =
    complaint.expand?.user?.name ||
    complaint.expand?.user?.fullName ||
    complaint.expand?.user?.email ||
    "Unknown user";

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{complaint.subject || "Untitled complaint"}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {userLabel} · {complaint.created ? new Date(complaint.created).toLocaleString() : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/admin/complaints")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Back
          </button>
        </div>

        <p className="mt-4 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
          {complaint.description || "No description provided."}
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Status</label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
            >
              <option value="new">New</option>
              <option value="triaged">Triaged</option>
              <option value="investigating">Investigating</option>
              <option value="waiting_user">Waiting user</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Priority</label>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Resolution summary</label>
            <input
              value={resolution}
              onChange={(event) => setResolution(event.target.value)}
              placeholder="Optional resolution note"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700">Internal note (not user-facing)</label>
          <textarea
            value={internalNote}
            onChange={(event) => setInternalNote(event.target.value)}
            rows={3}
            placeholder="Add investigation details or steps taken"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-4 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>

        {message ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Conversation</h2>
        </div>

        <div className="space-y-3 px-5 py-4">
          {messages.length === 0 ? (
            <p className="text-sm text-slate-500">No messages yet.</p>
          ) : (
            messages.map((msg) => (
              <article
                key={msg.id}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  msg.internalNote
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-slate-200 bg-slate-50 text-slate-800"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.message}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {(msg.expand?.sender?.name || msg.expand?.sender?.fullName || msg.expand?.sender?.email || "Support")}
                  {" · "}
                  {msg.created ? new Date(msg.created).toLocaleString() : ""}
                  {msg.internalNote ? " · Internal note" : ""}
                </p>
              </article>
            ))
          )}
        </div>

        <div className="border-t border-slate-200 px-5 py-4">
          <label className="block text-sm font-medium text-slate-700">Post update</label>
          <textarea
            value={replyMessage}
            onChange={(event) => setReplyMessage(event.target.value)}
            rows={3}
            placeholder="Write a response or progress update"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
          />
          <button
            type="button"
            onClick={handlePostMessage}
            disabled={posting || !replyMessage.trim()}
            className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            {posting ? "Posting..." : "Post message"}
          </button>
        </div>
      </section>
    </div>
  );
}
