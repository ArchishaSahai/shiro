import type { ChatConnectionState, ChatMessage } from "./types";

export function createMessageId(prefix: string): string {
  return `${prefix}_${String(Date.now())}_${Math.random().toString(16).slice(2, 8)}`;
}

export function deriveChatConnectionState(input: {
  readonly mode: "demo" | "live";
  readonly agentsConnected: number;
  readonly transportConnected: boolean;
  readonly status: "idle" | "running" | "completed" | "failed";
  readonly error: string | null;
  readonly isChatRequestActive: boolean;
}): ChatConnectionState {
  if (input.isChatRequestActive) {
    return "streaming";
  }
  if (input.error !== null && input.status === "failed") {
    return "error";
  }
  // Prefer agent presence over socket polling — Live Mode is the source of truth.
  if (input.mode === "live" && input.agentsConnected > 0) {
    return "connected";
  }
  // Only show Connecting while the browser socket is actually down.
  if (!input.transportConnected) {
    return "connecting";
  }
  return "disconnected";
}

export function appendUserMessage(
  messages: readonly ChatMessage[],
  content: string,
  now = Date.now()
): readonly ChatMessage[] {
  return [
    ...messages,
    {
      id: createMessageId("user"),
      role: "user",
      content,
      createdAt: now,
    },
  ];
}

export function appendStreamingAssistant(
  messages: readonly ChatMessage[],
  now = Date.now()
): { readonly messages: readonly ChatMessage[]; readonly assistantId: string } {
  const assistantId = createMessageId("assistant");
  return {
    assistantId,
    messages: [
      ...messages,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: now,
        streaming: true,
      },
    ],
  };
}

export function updateAssistantContent(
  messages: readonly ChatMessage[],
  assistantId: string,
  content: string,
  options: { readonly streaming?: boolean; readonly error?: boolean } = {}
): readonly ChatMessage[] {
  return messages.map((message) => {
    if (message.id !== assistantId) {
      return message;
    }
    return {
      ...message,
      content,
      streaming: options.streaming === true,
      error: options.error === true,
    };
  });
}

export function finalizeAssistant(
  messages: readonly ChatMessage[],
  assistantId: string,
  content: string,
  failed = false
): readonly ChatMessage[] {
  return updateAssistantContent(messages, assistantId, content, {
    error: failed,
    streaming: false,
  });
}

export function formatMessageTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

export const CONNECTION_LABELS: Record<ChatConnectionState, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting",
  connected: "Connected",
  streaming: "Streaming",
  error: "Error",
};
