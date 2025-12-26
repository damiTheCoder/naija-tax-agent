"use client";

import { useState, useRef, useEffect } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export default function TaxAgentChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Connected to the NaijaTaxAgent logic. Drop a payment, sale, or disposal and I'll tag VAT, WHT, CGT, and stamp duties instantly.",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const togglePanel = () => {
    setIsOpen((prev) => !prev);
  };

  const handleSend = async () => {
    const question = input.trim();
    if (!question) return;
    setInput("");
    setError(null);

    const newMessages = [...messages, { role: "user" as const, content: question, timestamp: Date.now() }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages.map(({ role, content }) => ({ role, content })) }),
      });

      if (!response.ok) {
        throw new Error("Unable to reach the tax assistant right now.");
      }

      const data = await response.json();
      const answer = data.answer || "I could not generate a useful response. Please try again.";

      setMessages((prev) => [...prev, { role: "assistant", content: answer, timestamp: Date.now() }]);
    } catch (err) {
      const fallback = err instanceof Error ? err.message : "Tax assistant unavailable.";
      setError(fallback);
      setMessages((prev) => [...prev, { role: "assistant", content: fallback, timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const docsCount = 0;
  const draftsPending = isLoading ? "Running" : "Pending";
  const auditStatus = messages.length > 1 ? "In review" : "Waiting";

  return (
    <div className="tax-agent-chat">
      <button className="tax-agent-toggle" onClick={togglePanel}>
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="mr-2"
        >
          <rect x="5" y="7" width="14" height="10" rx="3" strokeLinecap="round" />
          <path d="M9 7V5a3 3 0 016 0v2" strokeLinecap="round" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="15" cy="12" r="1" />
          <path d="M12 15v2" strokeLinecap="round" />
        </svg>
        Tax Assistant
      </button>
      {isOpen && (
        <div className="tax-agent-panel">
          <div className="tax-agent-header">
            <div>
              <p className="eyebrow">TAX AGENT CHAT</p>
              <h3>One stream for uploads, journals, and tax clarifications.</h3>
              <p>Trained on VAT, WHT, CGT, stamp duties, and audit overrides.</p>
            </div>
            <button onClick={togglePanel} aria-label="Close chat">
              ✕
            </button>
          </div>

          <div className="tax-agent-statuses">
            <span className="status-pill">Docs {docsCount}</span>
            <span className="status-pill warning">Draft {draftsPending}</span>
            <span className="status-pill danger">Audit {auditStatus}</span>
          </div>

          <div className="info-card">
            <div className="icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="info-title">Uploaded documents</p>
              <p className="info-meta">0 files attached • Use + to add</p>
            </div>
          </div>

          <div className="info-card purple">
            <div className="icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
              </svg>
            </div>
            <div>
              <p className="info-title">Tax entries</p>
              <p className="info-meta">{messages.length - 1} notes • Linked to schedules</p>
            </div>
            <span className="badge">Live</span>
          </div>

          <div className="tax-agent-messages">
            {messages.map((msg, index) => (
              <div key={msg.timestamp + index} className={`tax-agent-message ${msg.role}`}>
                <div className="bubble">{msg.content}</div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          {error && <div className="tax-agent-error">{error}</div>}
          <div className="tax-agent-input">
            <button className="circle-btn" type="button" aria-label="Add attachment">
              +
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the tax agent..."
              rows={2}
            />
            <button className="circle-btn" type="button" aria-label="Voice input">
              🎙
            </button>
            <button className="send-btn" onClick={handleSend} disabled={isLoading}>
              {isLoading ? "…" : "➜"}
            </button>
          </div>
        </div>
      )}
      <style jsx>{`
        .tax-agent-chat {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          z-index: 50;
        }
        .tax-agent-toggle {
          background: linear-gradient(120deg, #fef102, #ffd642);
          color: #0f172a;
          border: none;
          border-radius: 9999px;
          padding: 0.75rem 1.5rem;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
          cursor: pointer;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }
        .tax-agent-panel {
          width: min(400px, 92vw);
          height: 520px;
          background: #f8f9fb;
          border-radius: 24px;
          box-shadow: 0 25px 80px rgba(15, 23, 42, 0.25);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          margin-top: 0.75rem;
          border: 1px solid #e2e8f0;
        }
        .tax-agent-header {
          padding: 1.2rem 1.5rem 1rem;
          display: flex;
          justify-content: space-between;
          gap: 1rem;
        }
        .tax-agent-header h3 {
          margin: 0.15rem 0;
          font-size: 1rem;
          font-weight: 600;
          color: #0f172a;
        }
        .tax-agent-header p {
          margin: 0;
          color: #64748b;
          font-size: 0.85rem;
        }
        .tax-agent-header button {
          border: none;
          background: rgba(15, 23, 42, 0.05);
          width: 32px;
          height: 32px;
          border-radius: 12px;
          cursor: pointer;
        }
        .eyebrow {
          margin: 0;
          font-size: 0.75rem;
          letter-spacing: 0.35em;
          color: #a0aec0;
        }
        .tax-agent-statuses {
          display: flex;
          gap: 0.5rem;
          padding: 0 1.5rem 0.5rem;
          flex-wrap: wrap;
        }
        .status-pill {
          font-size: 0.75rem;
          border-radius: 999px;
          padding: 0.3rem 0.9rem;
          background: #edf2f7;
          color: #475569;
          font-weight: 500;
        }
        .status-pill.warning {
          background: #fff4d6;
          color: #a16207;
        }
        .status-pill.danger {
          background: #fee2e2;
          color: #b91c1c;
        }
        .info-card {
          margin: 0 1.5rem 0.75rem;
          border: 1px solid #e2e8f0;
          background: #fff;
          border-radius: 18px;
          padding: 0.85rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.8rem;
        }
        .info-card.purple {
          border-color: #ddd6fe;
          background: #f5f3ff;
        }
        .icon-wrap {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: #ecf2ff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #3b82f6;
        }
        .info-card.purple .icon-wrap {
          background: #ede9fe;
          color: #7c3aed;
        }
        .info-title {
          margin: 0;
          font-size: 0.9rem;
          font-weight: 600;
          color: #0f172a;
        }
        .info-meta {
          margin: 0;
          font-size: 0.78rem;
          color: #64748b;
        }
        .badge {
          margin-left: auto;
          background: #d1fae5;
          color: #065f46;
          padding: 0.2rem 0.75rem;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 600;
        }
        .tax-agent-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1rem 1.5rem;
        }
        .tax-agent-message {
          margin-bottom: 0.75rem;
          display: flex;
        }
        .tax-agent-message.user {
          justify-content: flex-end;
        }
        .tax-agent-message.assistant {
          justify-content: flex-start;
        }
        .bubble {
          padding: 0.75rem 1rem;
          border-radius: 1rem;
          max-width: 85%;
          font-size: 0.9rem;
          line-height: 1.35;
          background: #fff;
          color: #0f172a;
          border: 1px solid #e2e8f0;
          box-shadow: 0 5px 15px rgba(15, 23, 42, 0.08);
        }
        .tax-agent-message.user .bubble {
          background: #111827;
          color: white;
          border-color: #111827;
        }
        .tax-agent-error {
          color: #dc2626;
          font-size: 0.8rem;
          padding: 0 1.5rem;
        }
        .tax-agent-input {
          padding: 0.9rem 1.5rem;
          border-top: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #fff;
        }
        .tax-agent-input textarea {
          flex: 1;
          border: none;
          background: #f5f5f7;
          border-radius: 16px;
          padding: 0.75rem 1rem;
          resize: none;
          font-family: inherit;
          font-size: 0.9rem;
        }
        .circle-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: #f1f5f9;
          color: #111827;
          font-size: 1rem;
          cursor: pointer;
        }
        .send-btn {
          width: 42px;
          height: 42px;
          border: none;
          border-radius: 50%;
          background: #0f172a;
          color: white;
          font-size: 1.2rem;
          cursor: pointer;
        }
        .send-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        @media (max-width: 640px) {
          .tax-agent-panel {
            width: min(95vw, 380px);
            height: 500px;
          }
        }
      `}</style>
    </div>
  );
}
