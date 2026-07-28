"use client";

import { useMode } from "@/lib/ModeContext";

export function DesktopModeToggle() {
  const { mode, toggleMode } = useMode();
  const isUser = mode === "user";
  const activeModeLabel = isUser ? "Personal" : "Enterprise";
  const brandAccent = "#9080ee";

  return (
    <div className="flex h-8 items-center gap-2">
      <span
        className="text-sm font-semibold tracking-wide leading-none"
        style={{ color: brandAccent }}
      >
        {activeModeLabel}
      </span>
      <button
        onClick={toggleMode}
        role="switch"
        aria-checked={isUser}
        className="relative inline-flex h-8 w-14 items-center rounded-full transition-colors"
        style={{
          background: brandAccent,
          boxShadow: "none",
        }}
        aria-label={isUser ? "Switch to enterprise experience" : "Switch to personal experience"}
      >
        <span
          className={`inline-flex h-6 w-6 rounded-full transition-transform duration-300 ${isUser ? "translate-x-7" : "translate-x-1"}`}
          style={{
            background: "#ffffff",
            boxShadow: "none",
          }}
        />
      </button>
    </div>
  );
}

export function MobileModeToggle() {
  const { mode, toggleMode } = useMode();
  const isUser = mode === "user";
  const brandAccent = "#9080ee";

  return (
    <button
      onClick={toggleMode}
      role="switch"
      aria-checked={isUser}
      className="relative inline-flex h-7 w-11 items-center rounded-full transition-colors"
      style={{
        background: brandAccent,
      }}
      aria-label={isUser ? "Switch to enterprise experience" : "Switch to user experience"}
    >
      <span
        className={`inline-flex h-5 w-5 rounded-full bg-white transition-transform duration-300 ${isUser ? "translate-x-5" : "translate-x-1"}`}
      />
    </button>
  );
}
