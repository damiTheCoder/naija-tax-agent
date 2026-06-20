"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";

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

  const loadFloatingChat = useCallback(async () => {
    if (FloatingChat || hasStartedLoadingRef.current) return;

    hasStartedLoadingRef.current = true;
    setIsLoading(true);

    try {
      const loadedModule = await import("@/components/FloatingChatButton");
      setFloatingChat(() => loadedModule.default);
    } catch {
      hasStartedLoadingRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [FloatingChat]);

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
  }, [loadFloatingChat]);

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
    <section className="relative w-full max-w-full scroll-mt-24 overflow-visible lg:sticky lg:top-0 lg:overflow-hidden">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-full flex-col lg:h-[calc(100vh-2rem)] lg:min-h-[26rem]">
        <div className="px-0 py-5">
          <div className="h-3 w-28 rounded-full bg-gray-200" />
          <div className="mt-4 h-8 w-56 rounded-full bg-gray-100" />
          <div className="mt-3 h-4 w-full max-w-xl rounded-full bg-gray-100" />
        </div>

        <div className="px-0 py-3">
          <div className="flex gap-2 overflow-hidden">
            <div className="h-9 w-24 rounded-full bg-gray-100" />
            <div className="h-9 w-32 rounded-full bg-gray-100" />
            <div className="h-9 w-28 rounded-full bg-gray-100" />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-8 text-center lg:py-0">
          <div className="mx-auto max-w-2xl px-2">
            <h3 className="text-xl font-semibold tracking-tight text-[#1f1f1f] sm:text-2xl">
              Preparing the assistant
            </h3>
            <p className="mt-3 text-sm leading-7 text-gray-500">
              The chat now loads inline inside the page. Your conversation history and page context will appear here in a moment.
            </p>
            <button
              type="button"
              onClick={() => {
                pendingOpenRef.current = { newChat: true };
                void loadFloatingChat();
              }}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#8fff00] px-4 py-2.5 text-sm font-semibold text-[#101010] shadow-[0_14px_35px_rgba(143,255,0,0.22)] transition-colors hover:bg-[#7fe000]"
            >
              {isLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : null}
              Open assistant
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
