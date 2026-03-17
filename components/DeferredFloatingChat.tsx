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
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] left-1/2 z-40 flex -translate-x-1/2 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#2264ff] to-[#1a4fd6] px-2.5 py-1.5 text-white shadow-[0_16px_34px_rgba(34,100,255,0.28)] transition-transform duration-200 hover:scale-[1.03] focus:outline-none focus:ring-4 focus:ring-[#2264ff]/25 lg:hidden"
      >
        {isLoading ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        ) : (
          <img src="/google-logo.jpg" alt="Google" className="h-8 w-8 rounded-full object-cover ring-2 ring-white/95" />
        )}
        <span className="pr-0.5 text-[15px] font-semibold tracking-tight">Chat</span>
      </button>

      <div className="hidden lg:block">
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
          className="group fixed bottom-8 right-8 z-40 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#2264ff] to-[#1a4fd6] px-2.5 py-1.5 text-white shadow-[0_16px_34px_rgba(34,100,255,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_42px_rgba(34,100,255,0.32)] focus:outline-none focus:ring-4 focus:ring-[#2264ff]/15"
        >
          <span className="flex items-center">
            {isLoading ? (
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/35 border-t-white" />
            ) : (
              <img src="/google-logo.jpg" alt="Google" className="h-8 w-8 rounded-full object-cover ring-2 ring-white/95" />
            )}
          </span>
          <span className="pr-0.5 text-[15px] font-semibold tracking-tight">Chat</span>
        </button>
      </div>
    </>
  );
}
