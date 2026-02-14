"use client";

import { useMode } from "@/lib/ModeContext";

function EnterpriseIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21h16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21V7.5A1.5 1.5 0 018.5 6h7A1.5 1.5 0 0117 7.5V21" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 10h.01M14 10h.01M10 13h.01M14 13h.01M10 16h.01M14 16h.01" />
    </svg>
  );
}

function PersonalIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20a7.5 7.5 0 0115 0" />
    </svg>
  );
}

export function DesktopModeToggle() {
  const { mode, toggleMode } = useMode();
  const isUser = mode === "user";
  const activeModeLabel = isUser ? "Personal" : "Enterprise";

  return (
    <div className="flex items-center gap-2">
      <span
        className="text-sm font-semibold tracking-wide"
        style={{ color: "#1e3a8a" }}
      >
        {activeModeLabel}
      </span>
      <button
        onClick={toggleMode}
        role="switch"
        aria-checked={isUser}
        className="relative inline-flex h-9 w-16 items-center rounded-full transition-colors"
        style={{
          background: isUser ? "#1e3a8a" : "#dbe2ea",
          boxShadow: "none",
        }}
        aria-label={isUser ? "Switch to enterprise experience" : "Switch to personal experience"}
      >
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-300 ${isUser ? "translate-x-8" : "translate-x-1"}`}
          style={{
            background: "#ffffff",
            color: "#1e3a8a",
            boxShadow: "none",
          }}
        >
          {isUser ? (
            <PersonalIcon className="w-3.5 h-3.5" />
          ) : (
            <EnterpriseIcon className="w-3.5 h-3.5" />
          )}
        </span>
      </button>
    </div>
  );
}

export function MobileModeToggle() {
  const { mode, toggleMode } = useMode();
  const isUser = mode === "user";

  return (
    <button
      onClick={toggleMode}
      className="flex items-center justify-center w-8 h-8 rounded-full border transition-all"
      style={{
        borderColor: isUser ? "rgba(255,255,255,0.4)" : "rgba(34,100,255,0.15)",
        background: isUser ? "rgba(15,23,42,0.5)" : "#f1f5f9",
      }}
      aria-label={isUser ? "Switch to enterprise experience" : "Switch to user experience"}
    >
      {isUser ? (
        <PersonalIcon className="w-4 h-4 text-white" />
      ) : (
        <EnterpriseIcon className="w-4 h-4 text-[#1e3a8a]" />
      )}
    </button>
  );
}
