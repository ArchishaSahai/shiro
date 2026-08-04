"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { MarkdownOutput } from "@/components/markdown-output";
import { formatMessageTime } from "./chat-state";
import type { ChatMessage } from "./types";

interface MessageBubbleProps {
  readonly message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const isStreaming = message.streaming === true && message.content.length === 0;

  const handleCopy = async () => {
    if (message.content.length === 0 || typeof navigator === "undefined") {
      return;
    }
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article
      className={`group flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}
      data-role={message.role}
    >
      <div className="flex items-center gap-2 px-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
          {isUser ? "User" : "Assistant"}
        </span>
        <time
          className="font-mono text-[10px] text-white/28"
          dateTime={new Date(message.createdAt).toISOString()}
        >
          {formatMessageTime(message.createdAt)}
        </time>
        {message.content.length > 0 ? (
          <button
            aria-label="Copy message"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-white/28 opacity-0 transition hover:text-white/70 group-hover:opacity-100"
            onClick={() => {
              void handleCopy();
            }}
            type="button"
          >
            {copied ? (
              <Check aria-hidden="true" className="h-3 w-3 text-emerald-300" />
            ) : (
              <Copy aria-hidden="true" className="h-3 w-3" />
            )}
          </button>
        ) : null}
      </div>

      <div
        className={`max-w-[min(100%,42rem)] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
          isUser
            ? "bg-[#ff4fd8]/12 text-white/90"
            : message.error === true
              ? "border border-red-300/25 bg-red-400/10 text-red-50"
              : "border border-white/[.08] bg-[#0e0e11] text-white/80"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : isStreaming ? (
          <StreamingIndicator />
        ) : (
          <MarkdownOutput className="[&_.markdown-body]:text-[13px]" content={message.content} />
        )}
        {message.streaming === true && message.content.length > 0 ? (
          <span
            aria-hidden="true"
            className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-[#ff4fd8]/80 align-middle"
          />
        ) : null}
      </div>
    </article>
  );
}

function StreamingIndicator() {
  return (
    <div aria-live="polite" className="flex items-center gap-2 text-white/45" role="status">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#ff4fd8]/80 [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#ff4fd8]/80 [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#ff4fd8]/80" />
      </span>
      <span className="font-mono text-[11px]">Thinking…</span>
    </div>
  );
}
