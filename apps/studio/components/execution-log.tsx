"use client";

import { motion } from "framer-motion";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { StudioRunTrace, StudioTraceEvent } from "@/lib/trace-utils";

const speeds = [0.5, 1, 2] as const;

import { Terminal } from "@/components/ui/terminal";

export function ExecutionLog({ trace }: { readonly trace: StudioRunTrace }) {
  const lines = useMemo(() => createLogLines(trace), [trace]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [visibleCount, setVisibleCount] = useState(1);
  const speed = speeds[speedIndex] ?? 1;

  useEffect(() => {
    setVisibleCount(1);
    setIsPlaying(true);
  }, [trace.runId]);

  useEffect(() => {
    if (!isPlaying || visibleCount >= lines.length) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setVisibleCount((value) => Math.min(lines.length, value + 1));
    }, 520 / speed);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isPlaying, lines.length, speed, visibleCount]);

  const copyText = lines
    .map((line) => `${line.timestamp.toLocaleTimeString()} [${line.type}] ${line.detail}`)
    .join("\n");

  const terminalActions = (
    <div className="flex items-center gap-1.5 mr-2">
      <button
        className="terminal-action"
        onClick={() => {
          setVisibleCount(1);
          setIsPlaying(true);
        }}
        type="button"
        title="Replay"
      >
        <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button
        className="terminal-action"
        onClick={() => {
          setIsPlaying((value) => !value);
        }}
        type="button"
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <Pause aria-hidden="true" className="h-3.5 w-3.5" />
        ) : (
          <Play aria-hidden="true" className="h-3.5 w-3.5" />
        )}
      </button>
      <button
        className="terminal-action"
        onClick={() => {
          setSpeedIndex((value) => (value + 1) % speeds.length);
        }}
        type="button"
        title="Speed"
      >
        {speed}x
      </button>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-white">Live Execution Log</h2>
          <p className="text-xs text-white/50 mt-1">
            A replayable terminal log of the run lifecycle.
          </p>
        </div>
      </div>
      <Terminal
        title={`shiro execute --run-id ${trace.runId}`}
        copyText={copyText}
        actions={terminalActions}
      >
        <div className="h-[320px] overflow-y-auto space-y-2 pr-2 text-xs">
          {lines.slice(0, visibleCount).map((line, index) => (
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="grid grid-cols-[80px_130px_1fr] gap-3 font-mono"
              initial={{ opacity: 0, x: -8 }}
              key={`${line.eventId}-${String(index)}`}
              transition={{ duration: 0.16 }}
            >
              <span className="text-white/30">{line.timestamp.toLocaleTimeString()}</span>
              <span className={lineTone(line.type)}>{line.type}</span>
              <span className="truncate text-white/80">{line.detail}</span>
            </motion.div>
          ))}
          {visibleCount >= lines.length ? (
            <motion.div
              animate={{ opacity: 1 }}
              className="pt-2 text-emerald-400 font-mono"
              initial={{ opacity: 0 }}
            >
              ✓ {trace.finalStatus === "failed" ? "failed" : "success"}
            </motion.div>
          ) : (
            <span className="inline-block h-3.5 w-1.5 animate-pulse bg-[#ff4fd8] ml-2" />
          )}
        </div>
      </Terminal>
    </div>
  );
}

interface LogLine extends StudioTraceEvent {
  readonly detail: string;
}

function createLogLines(trace: StudioRunTrace): readonly LogLine[] {
  const eventLines = trace.timeline.events.map((event) => ({
    ...event,
    detail: detailForEvent(event.type, trace),
  }));

  return [...eventLines].sort(
    (left, right) => left.timestamp.getTime() - right.timestamp.getTime()
  );
}

function detailForEvent(type: string, trace: StudioRunTrace): string {
  if (type.includes("provider")) {
    return `${trace.provider ?? "provider"}.${trace.model ?? trace.modelCalls[0]?.model ?? "model"}`;
  }

  if (type.includes("tool")) {
    return trace.toolExecutions.map((tool) => tool.toolName).join(", ") || "tool";
  }

  if (type.includes("handoff")) {
    return trace.handoffs
      .map((handoff) => `${handoff.sourceAgent} -> ${handoff.destinationAgent}`)
      .join(", ");
  }

  if (type.includes("approval")) {
    return trace.approvals.map((approval) => approval.toolName).join(", ") || "approval";
  }

  if (type.includes("memory")) {
    return trace.sessionId ?? "session";
  }

  return trace.agentName ?? trace.runId;
}

function lineTone(type: string): string {
  if (type.includes("failed") || type.includes("rejected")) {
    return "text-red-400";
  }

  if (type.includes("approval")) {
    return "text-[#ff4fd8]";
  }

  if (type.includes("tool")) {
    return "text-white/90";
  }

  if (type.includes("handoff")) {
    return "text-white/60 font-medium";
  }

  if (type.includes("completed") || type.includes("granted")) {
    return "text-emerald-400";
  }

  return "text-white/40";
}
