"use client";

import { useState, useRef, useEffect } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export default function TaxAgentChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: "assistant",
    content: "Hi! I am your Tax Assistant. Ask me about PIT/CIT flows, VAT, WHT certificates, or the PDF audit trail.",
    timestamp: Date.now(),
  }]);
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

  return (
    <div className="tax-agent-chat">
      <button className="tax-agent-toggle" onClick={togglePanel}>
        🤖 Tax Assistant
      </button>
      {isOpen && (
        <div className="tax-agent-panel">
          <div className="tax-agent-header">
            <div>
              <strong>Tax Assistant</strong>
              <p>Trained on this calculator's rules, overrides, and audit trail.</p>
            </div>
            <button onClick={togglePanel} aria-label="Close chat">✕</button>
          </div>
          <div className="tax-agent-messages">
            {messages.map((msg, index) => (
              <div key={msg.timestamp + index} className={`tax-agent-message ${msg.role}`}>
                <div className="bubble">
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          {error && (
            <div className="tax-agent-error">
              {error}
            </div>
          )}
          <div className="tax-agent-input">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about PIT, VAT, certificates, overrides..."
              rows={2}
            />
            <button onClick={handleSend} disabled={isLoading}>
              {isLoading ? "..." : "Send"}
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
          background: #1a365d;
          color: #fff;
          border: none;
          border-radius: 9999px;
          padding: 0.75rem 1.5rem;
          box-shadow: 0 10px 25px rgba(0,0,0,0.15);
          cursor: pointer;
          font-weight: 600;
        }
        .tax-agent-panel {
          width: min(360px, 90vw);
          height: 480px;
          background: #fff;
          border-radius: 1rem;
          box-shadow: 0 25px 60px rgba(0,0,0,0.25);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          margin-top: 0.75rem;
        }
        .tax-agent-header {
          padding: 1rem;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }
        .tax-agent-header p {
          margin: 0;
          color: #64748b;
          font-size: 0.85rem;
        }
        .tax-agent-header button {
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 1rem;
        }
        .tax-agent-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          background: #f8fafc;
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
          padding: 0.65rem 0.9rem;
          border-radius: 0.75rem;
          max-width: 85%;
          font-size: 0.9rem;
          line-height: 1.3;
          background: #fff;
          color: #0f172a;
          border: 1px solid #e2e8f0;
        }
        .tax-agent-message.user .bubble {
          background: #1a365d;
          color: white;
          border-color: #1a365d;
        }
        .tax-agent-error {
          color: #dc2626;
          font-size: 0.8rem;
          padding: 0 1rem;
        }
        .tax-agent-input {
          padding: 0.75rem 1rem;
          border-top: 1px solid #e2e8f0;
          display: flex;
          gap: 0.5rem;
        }
        .tax-agent-input textarea {
          flex: 1;
          border: 1px solid #cbd5f5;
          border-radius: 0.75rem;
          padding: 0.5rem 0.75rem;
          resize: none;
          font-family: inherit;
        }
        .tax-agent-input button {
          border: none;
          background: #1a365d;
          color: white;
          border-radius: 0.75rem;
          padding: 0 1rem;
          cursor: pointer;
        }
        @media (max-width: 640px) {
          .tax-agent-panel {
            width: min(95vw, 360px);
            height: 420px;
          }
        }
      `}</style>
    </div>
  );
}
