"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type SubmitEvent } from "react";
import { MarkdownOutput } from "@/components/markdown-output";
import { useRuntime } from "@/hooks/use-runtime";
import type { TerminalLine } from "@/lib/runtime-events";

export function StudioTerminal() {
  const {
    activeTrace,
    clear,
    command,
    live,
    mode,
    replay,
    setCommand,
    setSpeed,
    speed,
    status,
    stop,
    submitCommand,
  } = useRuntime();
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const lines = live.terminalLines;
  const isRunning = status === "running";

  useEffect(() => {
    const node = scrollRef.current;
    if (node !== null) {
      node.scrollTop = node.scrollHeight;
    }
  }, [lines.length, live.responseMarkdown]);

  const visibleLines = lines;

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitCommand();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "l" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      clear();
    }
  };

  const copyText = visibleLines
    .map((line) => (line.kind === "markdown" ? (line.markdown ?? line.text) : line.text))
    .join("\n");

  return (
    <div className="terminal-frame overflow-hidden">
      <div className="flex h-10 items-center justify-between border-b border-white/[.06] bg-[#0b0b0d] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57] transition hover:brightness-110" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e] transition hover:brightness-110" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840] transition hover:brightness-110" />
          </div>
          <p className="truncate font-mono text-[11px] font-medium text-white/40">
            {activeTrace !== null ? `shiro · ${activeTrace.id}` : "shiro · terminal"}
          </p>
          <StatusPill status={status} />
          <span
            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
              mode === "live"
                ? "border-[#ff4fd8]/35 text-[#ff4fd8]"
                : "border-white/[.08] text-white/40"
            }`}
          >
            {mode === "live" ? "Live" : "Demo"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            aria-label="Replay"
            className="terminal-action"
            onClick={() => {
              replay();
            }}
            type="button"
          >
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
          <button
            aria-label={isRunning ? "Pause" : "Resume"}
            className="terminal-action"
            onClick={() => {
              if (isRunning) {
                stop();
              } else {
                replay();
              }
            }}
            type="button"
          >
            {isRunning ? (
              <Pause aria-hidden="true" className="h-3.5 w-3.5" />
            ) : (
              <Play aria-hidden="true" className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            aria-label="Cycle speed"
            className="terminal-action"
            onClick={() => {
              const next = speed >= 2 ? 0.5 : speed + 0.5;
              setSpeed(next);
            }}
            type="button"
          >
            {speed}x
          </button>
          <button
            aria-label="Copy output"
            className="terminal-action terminal-copy-action"
            onClick={() => {
              void navigator.clipboard.writeText(copyText);
              setCopied(true);
              window.setTimeout(() => {
                setCopied(false);
              }, 1200);
            }}
            type="button"
          >
            {copied ? (
              <>
                <Check aria-hidden="true" className="h-3.5 w-3.5 text-[#ff4fd8]" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div
        className="max-h-[min(560px,58vh)] min-h-[360px] overflow-y-auto bg-[#0b0b0d] px-5 py-5 font-mono text-[13px] leading-[1.85] sm:px-6"
        onClick={() => {
          inputRef.current?.focus();
        }}
        ref={scrollRef}
      >
        <AnimatePresence initial={false}>
          {visibleLines.map((line) => (
            <TerminalRow key={line.id} line={line} />
          ))}
        </AnimatePresence>

        {isRunning ? (
          <span className="terminal-cursor mt-1 inline-block h-4 w-[2px] bg-[#ff4fd8]" />
        ) : null}

        <form className="mt-3 flex items-center gap-2" onSubmit={handleSubmit}>
          <span className="text-[#ff4fd8]">$</span>
          <input
            aria-label="Studio command"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-white outline-none placeholder:text-white/28"
            onChange={(event) => {
              setCommand(event.currentTarget.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="shiro run support-agent"
            ref={inputRef}
            spellCheck={false}
            value={command}
          />
          {!isRunning ? (
            <span className="terminal-cursor inline-block h-4 w-[2px] bg-[#ff4fd8]" />
          ) : null}
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-white/[.055] px-5 py-2.5 font-mono text-[11px] text-white/35 sm:px-6">
        <span>
          {status === "failed" ? "exit 1" : status === "completed" ? "exit 0" : "running"}
        </span>
        <span>{(live.metrics.elapsedMs / 1000).toFixed(1)}s</span>
        <span>{live.metrics.tokens > 0 ? `${String(live.metrics.tokens)} tok` : "—"}</span>
        {activeTrace !== null ? (
          <span className="text-[#ff7adf]">trace {activeTrace.id}</span>
        ) : (
          <span>type help</span>
        )}
      </div>
    </div>
  );
}

function TerminalRow({ line }: { readonly line: TerminalLine }) {
  if (line.kind === "markdown" && line.markdown !== undefined) {
    return (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="my-4 rounded-xl border border-white/[.08] bg-[#09090b] px-4 py-4"
        initial={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[#ff4fd8]/80">
          assistant
        </p>
        <MarkdownOutput content={line.markdown} />
      </motion.div>
    );
  }

  return (
    <motion.div
      animate={{ opacity: 1, x: 0 }}
      className={`flex min-w-0 items-start gap-3 ${lineColor(line.kind)}`}
      initial={{ opacity: 0, x: -6 }}
      transition={{ duration: 0.18 }}
    >
      <span className="mt-[0.7rem] h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
      <span className="min-w-0 break-words whitespace-pre-wrap">{line.text}</span>
    </motion.div>
  );
}

function StatusPill({ status }: { readonly status: string }) {
  const label =
    status === "running"
      ? "live"
      : status === "completed"
        ? "done"
        : status === "failed"
          ? "failed"
          : "idle";
  const tone =
    status === "running"
      ? "text-[#ff4fd8] border-[#ff4fd8]/30 bg-[#ff4fd8]/10"
      : status === "failed"
        ? "text-red-300 border-red-400/30 bg-red-500/10"
        : "text-white/45 border-white/[.08] bg-white/[.03]";

  return (
    <span
      className={`hidden rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide sm:inline ${tone}`}
    >
      {label}
    </span>
  );
}

function lineColor(kind: TerminalLine["kind"]): string {
  if (kind === "command") return "text-white";
  if (kind === "success") return "text-white/90";
  if (kind === "warning") return "text-[#ff7adf]";
  if (kind === "pink") return "text-[#ff4fd8]";
  if (kind === "error") return "text-red-300";
  if (kind === "muted") return "text-white/38";
  return "text-white/58";
}
