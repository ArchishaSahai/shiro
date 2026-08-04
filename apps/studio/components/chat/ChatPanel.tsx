"use client";

import { MessageSquare, RefreshCw } from "lucide-react";
import { CONNECTION_LABELS } from "./chat-state";
import { ChatHistory } from "./ChatHistory";
import { ChatInput } from "./ChatInput";
import { useChatSession } from "./hooks/use-chat-session";
import type { ChatConnectionState } from "./types";

export function ChatPanel() {
  const {
    connection,
    emptyState,
    inputDisabled,
    messages,
    sendDisabled,
    sendMessage,
    showReconnectBanner,
  } = useChatSession();

  return (
    <section
      aria-label="Agent chat"
      className="flex h-[min(42vh,420px)] min-h-[280px] flex-col border-t border-white/[.08] bg-[#09090b]"
      id="chat-section"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/[.08] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <MessageSquare aria-hidden="true" className="h-4 w-4 text-[#ff4fd8]" />
          <h2 className="text-sm font-semibold text-white">Chat</h2>
          <ConnectionBadge state={connection} />
        </div>
        {messages.length > 0 ? (
          <p className="font-mono text-[10px] text-white/30">
            {String(messages.length)} message{messages.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      {showReconnectBanner ? (
        <div
          className="flex items-center gap-2 border-b border-amber-300/20 bg-amber-400/10 px-4 py-2 text-[12px] text-amber-50"
          role="status"
        >
          <RefreshCw aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span>
            Runtime disconnected — chat history preserved. Reconnect with{" "}
            <code className="font-mono text-amber-100">pnpm dev</code>, then send again.
          </span>
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <ChatHistory emptyState={emptyState} messages={messages} />
      </div>

      <ChatInput
        disabled={inputDisabled}
        onSend={sendMessage}
        sendDisabled={sendDisabled}
        streaming={connection === "streaming"}
      />
    </section>
  );
}

function ConnectionBadge({ state }: { readonly state: ChatConnectionState }) {
  const styles: Record<ChatConnectionState, string> = {
    disconnected: "border-white/[.08] bg-white/[.04] text-white/45",
    connecting: "border-amber-300/25 bg-amber-400/10 text-amber-100",
    connected: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
    streaming: "border-[#ff4fd8]/35 bg-[#ff4fd8]/12 text-[#ff4fd8]",
    error: "border-red-300/25 bg-red-400/10 text-red-100",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] ${styles[state]}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          state === "streaming"
            ? "animate-pulse bg-[#ff4fd8]"
            : state === "connected"
              ? "bg-emerald-300"
              : state === "connecting"
                ? "animate-pulse bg-amber-300"
                : state === "error"
                  ? "bg-red-300"
                  : "bg-white/35"
        }`}
      />
      {CONNECTION_LABELS[state]}
    </span>
  );
}
