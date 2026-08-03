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
import { createEmptyLiveState, reduceRuntimeEvent, type LiveRunState } from "@/lib/event-reducer";
import type { MockTraceDefinition, RuntimeStatus, TerminalLine } from "@/lib/runtime-events";
import { findTraceByCommand, listMockTraces } from "@/lib/traces";

interface RuntimeContextValue {
  readonly status: RuntimeStatus;
  readonly live: LiveRunState;
  readonly availableTraces: readonly MockTraceDefinition[];
  readonly activeTrace: MockTraceDefinition | null;
  readonly command: string;
  readonly setCommand: (value: string) => void;
  readonly submitCommand: (raw?: string) => void;
  readonly replay: () => void;
  readonly stop: () => void;
  readonly clear: () => void;
  readonly selectTool: (toolName: string) => void;
  readonly speed: number;
  readonly setSpeed: (speed: number) => void;
  readonly error: string | null;
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

const SPEEDS = [0.5, 1, 1.5, 2] as const;
const DEFAULT_TRACE = listMockTraces()[0] ?? null;

export function RuntimeProvider({ children }: { readonly children: ReactNode }) {
  const [status, setStatus] = useState<RuntimeStatus>(() =>
    DEFAULT_TRACE !== null ? "running" : "idle"
  );
  const [live, setLive] = useState<LiveRunState>(() =>
    DEFAULT_TRACE !== null ? seedFirstEvent(DEFAULT_TRACE) : createEmptyLiveState()
  );
  const [command, setCommand] = useState(
    DEFAULT_TRACE !== null ? DEFAULT_TRACE.command : "shiro run support-agent"
  );
  const [activeTrace, setActiveTrace] = useState<MockTraceDefinition | null>(DEFAULT_TRACE);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const indexRef = useRef(DEFAULT_TRACE !== null && DEFAULT_TRACE.events.length > 0 ? 1 : 0);
  const traceRef = useRef<MockTraceDefinition | null>(DEFAULT_TRACE);
  const speedRef = useRef(speed);
  const statusRef = useRef<RuntimeStatus>(DEFAULT_TRACE !== null ? "running" : "idle");

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    clearTimer();
    indexRef.current = 0;
    traceRef.current = null;
    setActiveTrace(null);
    setLive(createEmptyLiveState());
    setStatus("idle");
    setError(null);
  }, [clearTimer]);

  const stop = useCallback(() => {
    clearTimer();
    setStatus((current) => (current === "running" ? "completed" : current));
  }, [clearTimer]);

  const scheduleNext = useCallback(() => {
    const trace = traceRef.current;
    if (trace === null) {
      return;
    }

    const index = indexRef.current;
    if (index >= trace.events.length) {
      setStatus("completed");
      timerRef.current = null;
      return;
    }

    const event = trace.events[index];
    if (event === undefined) {
      setStatus("completed");
      return;
    }

    const previousOffset = index === 0 ? 0 : (trace.events[index - 1]?.offsetMs ?? 0);
    const delay = Math.max(28, (event.offsetMs - previousOffset) / speedRef.current);

    timerRef.current = window.setTimeout(() => {
      if (statusRef.current !== "running" || traceRef.current !== trace) {
        return;
      }

      setLive((current) => reduceRuntimeEvent(current, event));
      indexRef.current = index + 1;

      if (event.type === "run.failed") {
        setStatus("failed");
        return;
      }

      if (index + 1 >= trace.events.length) {
        setStatus("completed");
        return;
      }

      scheduleNext();
    }, delay);
  }, []);

  const startTrace = useCallback(
    (trace: MockTraceDefinition) => {
      clearTimer();
      traceRef.current = trace;
      setActiveTrace(trace);
      setCommand(trace.command);
      setError(null);
      setStatus("running");
      statusRef.current = "running";

      const first = trace.events[0];
      if (first === undefined) {
        indexRef.current = 0;
        setLive(createEmptyLiveState());
        return;
      }

      // Show the first line immediately so Studio is never empty on boot/replay.
      setLive(reduceRuntimeEvent(createEmptyLiveState(), first));
      indexRef.current = 1;
      scheduleNext();
    },
    [clearTimer, scheduleNext]
  );

  const submitCommand = useCallback(
    (raw?: string) => {
      const value = (raw ?? command).trim();
      if (value.length === 0) {
        return;
      }

      setCommand(value);
      const help = tryHelp(value);
      if (help !== null) {
        clearTimer();
        setActiveTrace(null);
        setStatus("idle");
        setLive({
          ...createEmptyLiveState(),
          terminalLines: help,
        });
        setError(null);
        return;
      }

      const trace = findTraceByCommand(value);
      if (trace === null) {
        setError(`Unknown command. Try: shiro run support-agent`);
        setLive({
          ...createEmptyLiveState(),
          terminalLines: [
            { id: "cmd", kind: "command", text: value.startsWith("$") ? value : `$ ${value}` },
            {
              id: "err",
              kind: "error",
              text: `command not found — try shiro run support-agent`,
            },
            {
              id: "hint",
              kind: "muted",
              text: `available: ${listMockTraces()
                .map((entry) => entry.id)
                .join(", ")}`,
            },
          ],
        });
        setStatus("idle");
        return;
      }

      startTrace(trace);
    },
    [clearTimer, command, startTrace]
  );

  const replay = useCallback(() => {
    const trace = activeTrace ?? findTraceByCommand(command) ?? DEFAULT_TRACE;
    if (trace !== null) {
      startTrace(trace);
    }
  }, [activeTrace, command, startTrace]);

  const selectTool = useCallback((toolName: string) => {
    setLive((current) => ({ ...current, selectedTool: toolName }));
  }, []);

  // Continue the seeded demo after mount (and recover from Strict Mode remounts).
  useEffect(() => {
    if (traceRef.current === null) {
      if (DEFAULT_TRACE !== null) {
        startTrace(DEFAULT_TRACE);
      }
      return;
    }

    if (statusRef.current === "running" && timerRef.current === null) {
      scheduleNext();
    }

    return () => {
      clearTimer();
    };
  }, [clearTimer, scheduleNext, startTrace]);

  const value = useMemo<RuntimeContextValue>(
    () => ({
      activeTrace,
      availableTraces: listMockTraces(),
      clear,
      command,
      error,
      live,
      replay,
      selectTool,
      setCommand,
      setSpeed: (next) => {
        setSpeed(SPEEDS.includes(next as (typeof SPEEDS)[number]) ? next : 1);
      },
      speed,
      status,
      stop,
      submitCommand,
    }),
    [
      activeTrace,
      clear,
      command,
      error,
      live,
      replay,
      selectTool,
      speed,
      status,
      stop,
      submitCommand,
    ]
  );

  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function useRuntime(): RuntimeContextValue {
  const value = useContext(RuntimeContext);
  if (value === null) {
    throw new Error("useRuntime must be used within RuntimeProvider");
  }
  return value;
}

function seedFirstEvent(trace: MockTraceDefinition): LiveRunState {
  const first = trace.events[0];
  if (first === undefined) {
    return createEmptyLiveState();
  }
  return reduceRuntimeEvent(createEmptyLiveState(), first);
}

function tryHelp(value: string): TerminalLine[] | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^\$\s*/, "");
  if (normalized !== "help" && normalized !== "shiro help" && normalized !== "shiro --help") {
    return null;
  }

  const traces = listMockTraces();
  return [
    { id: "help-cmd", kind: "command", text: "$ shiro help" },
    { id: "help-1", kind: "muted", text: "Shiro Studio mock runtime" },
    { id: "help-2", kind: "event", text: "Usage:" },
    { id: "help-3", kind: "pink", text: "  shiro run <agent>" },
    { id: "help-4", kind: "pink", text: "  shiro replay traces/<name>" },
    { id: "help-5", kind: "event", text: "Agents:" },
    ...traces.map((trace, index) => ({
      id: `help-trace-${String(index)}`,
      kind: "success" as const,
      text: `  ${trace.id.padEnd(18)} ${trace.description}`,
    })),
  ];
}
