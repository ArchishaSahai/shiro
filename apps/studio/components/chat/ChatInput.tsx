"use client";

import { SendHorizontal } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type SyntheticEvent,
} from "react";

interface ChatInputProps {
  readonly disabled: boolean;
  readonly sendDisabled: boolean;
  readonly streaming: boolean;
  readonly onSend: (content: string) => Promise<void> | void;
  readonly placeholder?: string;
}

export function ChatInput({
  disabled,
  onSend,
  placeholder = "Ask your agent…",
  sendDisabled,
  streaming,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = !disabled && !sendDisabled && !sending && value.trim().length > 0;

  const resize = useCallback(() => {
    const node = textareaRef.current;
    if (node === null) {
      return;
    }
    node.style.height = "0px";
    node.style.height = `${String(Math.min(node.scrollHeight, 140))}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [resize, value]);

  const isSendingRef = useRef(false);

  const submit = useCallback(async () => {
    if (!canSend || isSendingRef.current) {
      return;
    }
    const content = value.trim();
    isSendingRef.current = true;
    setSending(true);
    setValue("");
    try {
      await onSend(content);
    } finally {
      isSendingRef.current = false;
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [canSend, onSend, value]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  return (
    <form
      className="flex items-end gap-2 border-t border-white/[.08] bg-[#0b0b0d] px-3 py-3"
      onSubmit={onSubmit}
    >
      <label className="sr-only" htmlFor="studio-chat-input">
        Ask your agent
      </label>
      <textarea
        ref={textareaRef}
        className="max-h-[140px] min-h-[42px] flex-1 resize-none rounded-xl border border-white/[.08] bg-[#0e0e11] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#ff4fd8]/40 focus:ring-2 focus:ring-[#ff4fd8]/10 disabled:cursor-not-allowed disabled:opacity-45"
        disabled={disabled || streaming || sending}
        id="studio-chat-input"
        onChange={(event) => {
          setValue(event.currentTarget.value);
        }}
        onKeyDown={onKeyDown}
        placeholder={disabled ? "Connect an agent to chat…" : placeholder}
        rows={1}
        spellCheck
        value={value}
      />
      <button
        aria-label="Send message"
        className="inline-flex h-[42px] shrink-0 items-center gap-2 rounded-xl border border-[#ff4fd8]/35 bg-[#ff4fd8]/15 px-3.5 text-sm font-medium text-[#ff4fd8] transition hover:bg-[#ff4fd8]/22 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canSend}
        type="submit"
      >
        <SendHorizontal aria-hidden="true" className="h-4 w-4" />
        <span className="hidden sm:inline">{streaming || sending ? "Sending…" : "Send"}</span>
      </button>
    </form>
  );
}
