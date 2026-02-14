"use client";

import { useMode } from "@/lib/ModeContext";

export function DesktopModeToggle() {
  const { mode, toggleMode } = useMode();
  const isUser = mode === "user";

  return (
    <button
      onClick={toggleMode}
      className="relative isolate flex items-center gap-2 rounded-full px-2 py-1.5 text-xs font-semibold tracking-wide transition-all"
      style={{
        background: isUser ? "linear-gradient(135deg, #1f2937, #0f172a)" : "#ecf2ff",
        color: isUser ? "#e5e7ff" : "#1d4ed8",
        boxShadow: isUser ? "0 4px 25px rgba(15,23,42,0.35)" : "0 1px 2px rgba(15,23,42,0.1)",
      }}
      aria-label={isUser ? "Switch to enterprise experience" : "Switch to user experience"}
    >
      <span className={`relative z-10 flex items-center gap-1 px-3 py-1 rounded-full transition-all ${!isUser ? "bg-white text-[#1d4ed8]" : "text-white/70"}`}>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M3 6l9-4 9 4M4 10v11m16-11v11" />
        </svg>
        Enterprise
      </span>
      <span className={`relative z-10 flex items-center gap-1 px-3 py-1 rounded-full transition-all ${isUser ? "bg-white/10 text-white" : "text-[#64748b]"}`}>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20a7.5 7.5 0 0115 0" />
        </svg>
        Personal
      </span>
      <div
        className="absolute top-1 bottom-1 rounded-full bg-white transition-all duration-300"
        style={{
          width: "48%",
          left: isUser ? "50%" : "2%",
          boxShadow: "0 8px 15px rgba(0,0,0,0.12)",
          opacity: isUser ? 0.15 : 1,
          pointerEvents: "none",
          zIndex: 0,
        }}
        aria-hidden="true"
      />
    </button>
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
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20a7.5 7.5 0 0115 0" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-[#2264ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M3 6l9-4 9 4M4 10v11m16-11v11" />
        </svg>
      )}
    </button>
  );
}
