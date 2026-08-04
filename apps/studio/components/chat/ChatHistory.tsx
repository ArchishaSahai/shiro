"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage } from "./types";

interface ChatHistoryProps {
  readonly messages: readonly ChatMessage[];
  readonly emptyState: boolean;
}

export function ChatHistory({ emptyState, messages }: ChatHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  if (emptyState && messages.length === 0) {
    return (
      <div className="flex h-full min-h-[160px] flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-white/55">In another terminal, start your agent:</p>
        <pre className="mt-3 rounded-xl border border-white/[.08] bg-[#08080a] px-4 py-2.5 font-mono text-[13px] text-[#ff7adf]">
          pnpm dev
        </pre>
        <p className="mt-3 max-w-sm text-[12px] leading-5 text-white/40">
          Keep that process running. When Live Mode shows an agent connected, Chat unlocks
          automatically.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollerRef}
      className="h-full min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 py-3 scroll-smooth"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div aria-hidden="true" ref={bottomRef} />
    </div>
  );
}
