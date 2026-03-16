"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";

const CHAT_MODAL_OPEN_EVENT = "ql:chat-open";

type ChatModalOpenDetail = {
  module?: string;
  prompt?: string;
  newChat?: boolean;
};

function scheduleIdleLoad(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  if ("requestIdleCallback" in window) {
    const idleId = window.requestIdleCallback(callback, { timeout: 2500 });
    return () => window.cancelIdleCallback(idleId);
  }

  const timeoutId = globalThis.setTimeout(callback, 1800);
  return () => globalThis.clearTimeout(timeoutId);
}

export default function DeferredFloatingChat() {
  const [FloatingChat, setFloatingChat] = useState<ComponentType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const pendingOpenRef = useRef<ChatModalOpenDetail | null>(null);
  const hasStartedLoadingRef = useRef(false);

  const loadFloatingChat = async () => {
    if (FloatingChat || hasStartedLoadingRef.current) return;

    hasStartedLoadingRef.current = true;
    setIsLoading(true);

    try {
      const module = await import("@/components/FloatingChatButton");
      setFloatingChat(() => module.default);
    } catch {
      hasStartedLoadingRef.current = false;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleExternalChatOpen = (event: Event) => {
      const customEvent = event as CustomEvent<ChatModalOpenDetail>;
      pendingOpenRef.current = customEvent.detail || { newChat: true };
      void loadFloatingChat();
    };

    window.addEventListener(CHAT_MODAL_OPEN_EVENT, handleExternalChatOpen as EventListener);
    const cancelIdleLoad = scheduleIdleLoad(() => {
      void loadFloatingChat();
    });

    return () => {
      window.removeEventListener(CHAT_MODAL_OPEN_EVENT, handleExternalChatOpen as EventListener);
      cancelIdleLoad();
    };
  }, [FloatingChat]);

  useEffect(() => {
    if (!FloatingChat || !pendingOpenRef.current) return;

    const detail = pendingOpenRef.current;
    pendingOpenRef.current = null;
    window.dispatchEvent(new CustomEvent(CHAT_MODAL_OPEN_EVENT, { detail }));
  }, [FloatingChat]);

  if (FloatingChat) {
    return <FloatingChat />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          pendingOpenRef.current = { newChat: true };
          void loadFloatingChat();
        }}
        onPointerEnter={() => {
          void loadFloatingChat();
        }}
        aria-label="Open assistant"
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] left-1/2 z-40 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-[#2264ff] text-white shadow-[0_18px_40px_rgba(34,100,255,0.28)] transition-transform duration-200 hover:scale-[1.03] focus:outline-none focus:ring-4 focus:ring-[#2264ff]/25 lg:hidden"
      >
        {isLoading ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        ) : (
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 10h8M8 14h5m6 6-3.8-2.1a3 3 0 0 0-1.45-.37H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v6a4 4 0 0 1-2 3.46Z"
            />
          </svg>
        )}
      </button>

      <div className="hidden lg:flex lg:min-h-[calc(100vh-7rem)] lg:items-end lg:justify-end">
        <button
          type="button"
          onClick={() => {
            pendingOpenRef.current = { newChat: true };
            void loadFloatingChat();
          }}
          onPointerEnter={() => {
            void loadFloatingChat();
          }}
          aria-label="Open assistant"
          className="group relative flex w-full max-w-[5.75rem] flex-col items-center gap-2 rounded-[28px] border border-gray-200 bg-white px-3 py-4 text-slate-700 shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_22px_50px_rgba(34,100,255,0.16)] focus:outline-none focus:ring-4 focus:ring-[#2264ff]/15"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r from-[#2264ff] to-[#1a4fd6] text-white shadow-[0_14px_30px_rgba(34,100,255,0.24)]">
            {isLoading ? (
              <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/35 border-t-white" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 10h8M8 14h5m6 6-3.8-2.1a3 3 0 0 0-1.45-.37H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v6a4 4 0 0 1-2 3.46Z"
                />
              </svg>
            )}
          </span>
          <span className="text-[11px] font-semibold tracking-[0.18em] text-[#2264ff] uppercase">Chat</span>
        </button>
      </div>
    </>
  );
}
