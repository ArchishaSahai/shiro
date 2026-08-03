"use client";

import { motion } from "framer-motion";
import { Check, CopyCheck, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export interface TerminalLine {
  readonly kind?: "command" | "event" | "success" | "warning" | "muted" | "pink" | "purple";
  readonly text: string;
}

const defaultLines: readonly TerminalLine[] = [
  { kind: "command", text: "$ npm install @shiro/core @shiro/openai" },
  { kind: "success", text: "installed @shiro/core, @shiro/openai" },
  { kind: "command", text: "$ shiro run support-agent --studio" },
  { kind: "pink", text: "run.started support-agent" },
  { kind: "event", text: "provider.call model=gpt-5" },
  { kind: "event", text: "tool.execute weather.lookup" },
  { kind: "purple", text: "handoff support -> research" },
  { kind: "warning", text: "approval.required deploy.production" },
  { kind: "event", text: "studio.trace linked run_01J8" },
  { kind: "success", text: "response.complete 2.4s" },
];

export function TerminalReplay({
  autoReplay = false,
  lines = defaultLines,
  showReplay = false,
  title = "shiro terminal",
}: {
  readonly autoReplay?: boolean;
  readonly lines?: readonly TerminalLine[];
  readonly showReplay?: boolean;
  readonly title?: string;
  readonly language?: string;
}) {
  const [cycle, setCycle] = useState(0);
  const [copied, setCopied] = useState(false);
  const replay = useTypedReplay(lines, cycle);
  const replayMs = useMemo(() => estimateReplayMs(lines), [lines]);
  const complete = replay.completeLines.length === lines.length;

  useEffect(() => {
    if (!autoReplay) {
      return;
    }

    const id = window.setInterval(() => {
      setCycle((value) => value + 1);
    }, replayMs + 2200);

    return () => {
      window.clearInterval(id);
    };
  }, [autoReplay, replayMs]);

  return (
    <motion.div
      className="terminal-frame group overflow-hidden rounded-[18px] border border-[#2a2a2a] bg-[#09090B] shadow-[0_18px_48px_rgba(0,0,0,.40),0_0_42px_rgba(255,79,216,.09)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_56px_rgba(0,0,0,.44),0_0_58px_rgba(255,79,216,.13)]"
      initial={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.46, ease: [0.16, 1, 0.3, 1] }}
      viewport={{ once: true, amount: 0.18 }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className="relative flex h-10 items-center border-b border-white/[.065] bg-[#0D0D10] px-4 pr-32">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <p className="truncate font-mono text-[11px] font-medium text-white/42">{title}</p>
        </div>
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
          {showReplay ? (
            <button
              aria-label="Replay terminal output"
              className="terminal-action terminal-action-run"
              onClick={() => {
                setCycle((value) => value + 1);
              }}
              type="button"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            aria-label="Copy terminal output"
            className="terminal-action terminal-copy-action"
            onClick={() => {
              void copyText(lines.map((line) => line.text).join("\n"));
              setCopied(true);
              window.setTimeout(() => {
                setCopied(false);
              }, 1300);
            }}
            type="button"
          >
            {copied ? (
              <>
                <Check aria-hidden="true" className="h-3.5 w-3.5 text-[#ff7adf]" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <CopyCheck aria-hidden="true" className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      <div className="min-h-[330px] px-7 py-7 font-mono text-[13.5px] leading-[1.9] text-white/70 sm:px-9 sm:py-8 sm:text-sm">
        {replay.completeLines.map((line, index) => (
          <TerminalRow key={`${line.text}-${String(index)}-${String(cycle)}`} line={line} />
        ))}
        {replay.activeLine ? (
          <TerminalRow line={{ ...replay.activeLine, text: replay.activeText }} />
        ) : null}
        {!complete ? (
          <span className="terminal-cursor ml-4 mt-1 inline-block h-5 w-2 bg-[#ff4fd8]" />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-white/[.055] px-7 py-2.5 font-mono text-[11px] text-white/35 sm:px-9">
        <span>exit 0</span>
        <span>2.4s</span>
        <span className="text-[#ff7adf]">trace linked</span>
      </div>
    </motion.div>
  );
}

function TerminalRow({ line }: { readonly line: TerminalLine }) {
  return (
    <motion.div
      animate={{ opacity: 1, x: 0 }}
      className={`flex min-w-0 items-start gap-3 ${lineColor(line.kind)}`}
      initial={{ opacity: 0, x: -6 }}
      transition={{ duration: 0.18 }}
    >
      <span className="mt-3.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
      <span className="min-w-0 break-words">
        {line.kind === "success" ? "ok  " : ""}
        {line.text}
      </span>
    </motion.div>
  );
}

function useTypedReplay(lines: readonly TerminalLine[], cycle: number) {
  const [visibleCharacters, setVisibleCharacters] = useState(0);
  const totalCharacters = useMemo(
    () => lines.reduce((sum, line) => sum + line.text.length + 1, 0),
    [lines]
  );

  useEffect(() => {
    setVisibleCharacters(0);
    let current = 0;
    const id = window.setInterval(() => {
      current += 1;
      setVisibleCharacters(current);
      if (current >= totalCharacters) {
        window.clearInterval(id);
      }
    }, 18);

    return () => {
      window.clearInterval(id);
    };
  }, [cycle, totalCharacters]);

  let remaining = visibleCharacters;
  const completeLines: TerminalLine[] = [];

  for (const line of lines) {
    if (remaining > line.text.length) {
      completeLines.push(line);
      remaining -= line.text.length + 1;
      continue;
    }

    return {
      activeLine: line,
      activeText: line.text.slice(0, Math.max(0, remaining)),
      completeLines,
    };
  }

  return {
    activeLine: null,
    activeText: "",
    completeLines,
  };
}

function estimateReplayMs(lines: readonly TerminalLine[]): number {
  return lines.reduce((sum, line) => sum + line.text.length * 18 + 18, 0);
}

function lineColor(kind: TerminalLine["kind"]): string {
  if (kind === "command") return "text-white";
  if (kind === "success") return "text-white";
  if (kind === "warning") return "text-[#ff7adf]";
  if (kind === "pink") return "text-[#ff4fd8]";
  if (kind === "purple") return "text-white/72";
  if (kind === "muted") return "text-white/38";
  return "text-white/58";
}

async function copyText(text: string): Promise<void> {
  if (typeof navigator === "undefined" || !("clipboard" in navigator)) {
    return;
  }

  await navigator.clipboard.writeText(text).catch(() => undefined);
}
