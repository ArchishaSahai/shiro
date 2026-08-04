"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRuntime } from "@/hooks/use-runtime";
import {
  appendStreamingAssistant,
  appendUserMessage,
  deriveChatConnectionState,
  finalizeAssistant,
  updateAssistantContent,
} from "../chat-state";
import type { ChatConnectionState, ChatMessage } from "../types";

interface ChatContextValue {
  readonly messages: readonly ChatMessage[];
  readonly connection: ChatConnectionState;
  readonly inputDisabled: boolean;
  readonly sendDisabled: boolean;
  readonly showReconnectBanner: boolean;
  readonly emptyState: boolean;
  readonly wasConnected: boolean;
  readonly sendMessage: (content: string) => Promise<void>;
  readonly clearMessages: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { readonly children: ReactNode }) {
  const { agentsConnected, error, executePrompt, live, mode, status, transportConnected } =
    useRuntime();
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [isChatRequestActive, setIsChatRequestActive] = useState(false);
  const [wasConnected, setWasConnected] = useState(false);
  const assistantIdRef = useRef<string | null>(null);
  const liveRef = useRef(live);

  useEffect(() => {
    liveRef.current = live;
  }, [live]);

  const connection = deriveChatConnectionState({
    agentsConnected,
    error,
    isChatRequestActive,
    mode,
    status,
    transportConnected,
  });

  useEffect(() => {
    if (mode === "live" && agentsConnected > 0) {
      setWasConnected(true);
    }
  }, [agentsConnected, mode]);

  useEffect(() => {
    const assistantId = assistantIdRef.current;
    if (!isChatRequestActive || assistantId === null) {
      return;
    }
    const next = live.responseMarkdown;
    if (next === null || next.length === 0) {
      return;
    }
    setMessages((current) =>
      updateAssistantContent(current, assistantId, next, { streaming: true })
    );
  }, [isChatRequestActive, live.responseMarkdown]);

  // Synchronously finalize the assistant message when the chat request finishes
  useEffect(() => {
    if (!isChatRequestActive && wasConnected) {
      setMessages((current) => {
        const last = current[current.length - 1];
        if (last?.role === "assistant" && last.streaming) {
          const finalContent = live.responseMarkdown?.trim() ?? "";
          return finalizeAssistant(
            current,
            last.id,
            finalContent.length > 0
              ? finalContent
              : "Agent finished without a text response. Check the timeline for details.",
            status === "failed"
          );
        }
        return current;
      });
    }
  }, [isChatRequestActive, wasConnected, live.responseMarkdown, status]);

  const sendMessage = useCallback(
    async (raw: string) => {
      const content = raw.trim();
      if (content.length === 0 || mode !== "live" || agentsConnected === 0 || isChatRequestActive) {
        return;
      }

      setMessages((current) => {
        const withUser = appendUserMessage(current, content);
        const next = appendStreamingAssistant(withUser);
        assistantIdRef.current = next.assistantId;
        return next.messages;
      });
      setIsChatRequestActive(true);

      try {
        await executePrompt(content);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setMessages((current) => {
          const last = current[current.length - 1];
          if (last?.role === "assistant" && last.streaming) {
            return finalizeAssistant(
              current,
              last.id,
              message.length > 0 ? message : "Request failed",
              true
            );
          }
          return current;
        });
      } finally {
        setIsChatRequestActive(false);
        assistantIdRef.current = null;
      }
    },
    [agentsConnected, executePrompt, isChatRequestActive, mode]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    assistantIdRef.current = null;
  }, []);

  const emptyState = mode !== "live" || agentsConnected === 0;
  const inputDisabled = emptyState;
  const sendDisabled = inputDisabled || isChatRequestActive;
  const showReconnectBanner = wasConnected && emptyState && messages.length > 0;

  const value = useMemo<ChatContextValue>(
    () => ({
      clearMessages,
      connection,
      emptyState,
      inputDisabled,
      messages,
      sendDisabled,
      sendMessage,
      showReconnectBanner,
      wasConnected,
    }),
    [
      clearMessages,
      connection,
      emptyState,
      inputDisabled,
      messages,
      sendDisabled,
      sendMessage,
      showReconnectBanner,
      wasConnected,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatSession(): ChatContextValue {
  const value = useContext(ChatContext);
  if (value === null) {
    throw new Error("useChatSession must be used within ChatProvider");
  }
  return value;
}
