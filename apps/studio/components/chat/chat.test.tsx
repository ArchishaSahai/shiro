import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  appendStreamingAssistant,
  appendUserMessage,
  deriveChatConnectionState,
  finalizeAssistant,
  updateAssistantContent,
} from "./chat-state";
import { ChatHistory } from "./ChatHistory";
import { ChatInput } from "./ChatInput";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage } from "./types";

describe("deriveChatConnectionState", () => {
  it("reports disconnected when hub is up but no agent is live", () => {
    expect(
      deriveChatConnectionState({
        agentsConnected: 0,
        error: null,
        isChatRequestActive: false,
        mode: "demo",
        status: "idle",
        transportConnected: true,
      })
    ).toBe("disconnected");
  });

  it("reports connecting when the transport socket is down", () => {
    expect(
      deriveChatConnectionState({
        agentsConnected: 0,
        error: null,
        isChatRequestActive: false,
        mode: "demo",
        status: "idle",
        transportConnected: false,
      })
    ).toBe("connecting");
  });

  it("reports connected in live mode with agents", () => {
    expect(
      deriveChatConnectionState({
        agentsConnected: 1,
        error: null,
        isChatRequestActive: false,
        mode: "live",
        status: "idle",
        transportConnected: true,
      })
    ).toBe("connected");
  });

  it("reports streaming while a chat request is active", () => {
    expect(
      deriveChatConnectionState({
        agentsConnected: 1,
        error: null,
        isChatRequestActive: true,
        mode: "live",
        status: "running",
        transportConnected: true,
      })
    ).toBe("streaming");
  });

  it("reports error after a failed live run", () => {
    expect(
      deriveChatConnectionState({
        agentsConnected: 1,
        error: "boom",
        isChatRequestActive: false,
        mode: "live",
        status: "failed",
        transportConnected: true,
      })
    ).toBe("error");
  });
});

describe("chat message reducer helpers", () => {
  it("appends a user message when sending", () => {
    const next = appendUserMessage([], "Hello agent", 1_700_000_000_000);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      content: "Hello agent",
      createdAt: 1_700_000_000_000,
      role: "user",
    });
  });

  it("streams assistant content updates then finalizes", () => {
    const withUser = appendUserMessage([], "Plan a trip", 1);
    const { assistantId, messages } = appendStreamingAssistant(withUser, 2);
    expect(messages[1]?.streaming).toBe(true);

    const streamed = updateAssistantContent(messages, assistantId, "## Draft\n\n- Tokyo", {
      streaming: true,
    });
    expect(streamed[1]?.content).toContain("Tokyo");
    expect(streamed[1]?.streaming).toBe(true);

    const done = finalizeAssistant(streamed, assistantId, "## Final\n\nDone");
    expect(done[1]).toMatchObject({
      content: "## Final\n\nDone",
      error: false,
      streaming: false,
    });
  });

  it("preserves history across reconnect-style finalize failure", () => {
    let messages: readonly ChatMessage[] = appendUserMessage([], "first", 1);
    const seeded = appendStreamingAssistant(messages, 2);
    messages = seeded.messages;
    messages = finalizeAssistant(messages, seeded.assistantId, "ok");

    const secondUser = appendUserMessage(messages, "second", 3);
    const second = appendStreamingAssistant(secondUser, 4);
    const afterFail = finalizeAssistant(
      second.messages,
      second.assistantId,
      "Runtime is not live",
      true
    );

    expect(afterFail.map((m) => m.content)).toEqual([
      "first",
      "ok",
      "second",
      "Runtime is not live",
    ]);
    expect(afterFail[3]?.error).toBe(true);
  });
});

describe("ChatHistory empty state", () => {
  it("shows pnpm dev waiting copy when disconnected with no messages", () => {
    const html = renderToStaticMarkup(<ChatHistory emptyState messages={[]} />);
    expect(html).toContain("start your agent");
    expect(html).toContain("pnpm dev");
    expect(html).toContain("Live Mode");
  });

  it("keeps prior messages visible during reconnect empty-state mode", () => {
    const messages: readonly ChatMessage[] = [
      {
        id: "u1",
        role: "user",
        content: "still here",
        createdAt: 1,
      },
    ];
    const html = renderToStaticMarkup(<ChatHistory emptyState messages={messages} />);
    expect(html).toContain("still here");
    expect(html).not.toContain("Waiting for runtime");
  });
});

describe("ChatInput disabled state", () => {
  it("disables the textarea and send button when disconnected", () => {
    const html = renderToStaticMarkup(
      <ChatInput disabled onSend={vi.fn()} sendDisabled streaming={false} />
    );
    expect(html).toContain("disabled");
    expect(html).toContain("Connect an agent to chat");
  });
});

describe("MessageBubble markdown rendering", () => {
  it("renders markdown lists and code fences for assistant messages", () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        message={{
          id: "a1",
          role: "assistant",
          content:
            "Hello\n\n- one\n- two\n\n```ts\nconst x = 1;\n```\n\n| a | b |\n| - | - |\n| 1 | 2 |",
          createdAt: 1,
        }}
      />
    );
    expect(html).toContain("<li");
    expect(html).toContain("<pre");
    expect(html).toContain("<table");
    expect(html).toContain("Copy message");
  });
});
