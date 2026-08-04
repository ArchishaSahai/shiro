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
import {
  WebSocketEventTransport,
  type ConnectionMode,
  type EventTransport,
} from "@/lib/event-transport";
import type { MockTraceDefinition, RuntimeStatus, TerminalLine } from "@/lib/runtime-events";
import { findTraceByCommand, listMockTraces } from "@/lib/traces";

interface RuntimeContextValue {
  readonly status: RuntimeStatus;
  readonly live: LiveRunState;
  readonly mode: ConnectionMode;
  readonly agentsConnected: number;
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
  readonly executePrompt: (prompt: string) => Promise<void>;
  readonly transportConnected: boolean;
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

const SPEEDS = [0.5, 1, 1.5, 2] as const;
const DEFAULT_TRACE = listMockTraces()[0] ?? null;

export function RuntimeProvider({
  children,
  transport,
}: {
  readonly children: ReactNode;
  readonly transport?: EventTransport;
}) {
  const transportRef = useRef<EventTransport>(transport ?? new WebSocketEventTransport());
  const [mode, setMode] = useState<ConnectionMode>("demo");
  const [agentsConnected, setAgentsConnected] = useState(0);
  const [transportConnected, setTransportConnected] = useState(false);
  // Keep initial state deterministic for SSR/hydration — seed demo in useEffect only.
  // Seeding with `new Date()` here caused timestamp hydration mismatches.
  const [status, setStatus] = useState<RuntimeStatus>("idle");
  const [live, setLive] = useState<LiveRunState>(() => createEmptyLiveState());
  const [command, setCommand] = useState(
    DEFAULT_TRACE !== null ? DEFAULT_TRACE.command : "Plan me a 5 day trip to Japan."
  );
  const [activeTrace, setActiveTrace] = useState<MockTraceDefinition | null>(null);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const indexRef = useRef(0);
  const traceRef = useRef<MockTraceDefinition | null>(null);
  const speedRef = useRef(speed);
  const statusRef = useRef<RuntimeStatus>("idle");
  const liveRunIdRef = useRef<string | null>(null);

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
    liveRunIdRef.current = null;
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
      liveRunIdRef.current = null;
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

      setLive(reduceRuntimeEvent(createEmptyLiveState(), first));
      indexRef.current = 1;
      scheduleNext();
    },
    [clearTimer, scheduleNext]
  );

  const submitLivePrompt = useCallback(
    async (prompt: string) => {
      clearTimer();
      traceRef.current = null;
      setActiveTrace(null);
      setError(null);
      setStatus("running");
      statusRef.current = "running";
      liveRunIdRef.current = `live_${String(Date.now())}`;

      setLive({
        ...createEmptyLiveState(),
        terminalLines: [
          {
            id: "cmd",
            kind: "command",
            text: prompt.startsWith(">") || prompt.startsWith("$") ? prompt : `> ${prompt}`,
          },
          {
            id: "wait",
            kind: "muted",
            text: "streaming from connected agent…",
          },
        ],
      });

      try {
        await transportRef.current.execute(prompt);
        setStatus((current) => (current === "running" ? "completed" : current));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setStatus("failed");
        setLive((current) => ({
          ...current,
          terminalLines: [
            ...current.terminalLines,
            { id: `err-${String(Date.now())}`, kind: "error", text: message },
          ],
        }));
      }
    },
    [clearTimer]
  );

  const submitCommand = useCallback(
    (raw?: string) => {
      const value = (raw ?? command).trim();
      if (value.length === 0) {
        return;
      }

      setCommand(value);
      const help = tryHelp(value, mode);
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

      // Live mode: treat input as an agent prompt (not a mock CLI command).
      if (mode === "live") {
        void submitLivePrompt(value.replace(/^>\s*/, ""));
        return;
      }

      const trace = findTraceByCommand(value);
      if (trace === null) {
        // Free-form demo prompt → default travel / first mock if it looks like a chat prompt
        if (!value.startsWith("shiro ") && !value.startsWith("$")) {
          const fallback = findTraceByCommand("shiro run travel-agent") ?? DEFAULT_TRACE;
          if (fallback !== null) {
            startTrace(fallback);
            return;
          }
        }

        setError(`Unknown command. Try: shiro run support-agent`);
        setLive({
          ...createEmptyLiveState(),
          terminalLines: [
            { id: "cmd", kind: "command", text: value.startsWith("$") ? value : `$ ${value}` },
            {
              id: "err",
              kind: "error",
              text: `command not found — try shiro run support-agent (Demo Mode)`,
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
    [clearTimer, command, mode, startTrace, submitLivePrompt]
  );

  const replay = useCallback(() => {
    if (mode === "live") {
      void submitLivePrompt(command.replace(/^>\s*/, ""));
      return;
    }
    const trace = activeTrace ?? findTraceByCommand(command) ?? DEFAULT_TRACE;
    if (trace !== null) {
      startTrace(trace);
    }
  }, [activeTrace, command, mode, startTrace, submitLivePrompt]);

  const selectTool = useCallback((toolName: string) => {
    setLive((current) => ({ ...current, selectedTool: toolName }));
  }, []);

  // Connect transport and auto-switch Demo ↔ Live.
  useEffect(() => {
    const transport = transportRef.current;
    transport.connect();
    setTransportConnected(transport.connected);
    const unsubscribe = transport.subscribe((message) => {
      setTransportConnected(transport.connected);
      if (message.type === "status") {
        const nextMode = message.mode;
        setMode(nextMode);
        setAgentsConnected(message.agents);
        if (nextMode === "live") {
          clearTimer();
          traceRef.current = null;
          setActiveTrace(null);
          setStatus("idle");
          setLive({
            ...createEmptyLiveState(),
            terminalLines: [
              {
                id: "live-ready",
                kind: "success",
                text: `Live Mode — ${String(message.agents)} agent(s) connected`,
              },
              {
                id: "live-hint",
                kind: "muted",
                text: "Type a prompt and press Enter to execute the connected agent.",
              },
            ],
          });
          setCommand("Plan me a 5 day trip to Japan.");
        } else if (statusRef.current !== "running") {
          if (
            DEFAULT_TRACE !== null &&
            traceRef.current === null &&
            liveRunIdRef.current === null
          ) {
            startTrace(DEFAULT_TRACE);
          }
        }
        return;
      }

      if (message.type === "event") {
        setMode("live");
        setStatus("running");
        statusRef.current = "running";
        setLive((current) => reduceRuntimeEvent(current, message.event));
        if (
          message.event.type === "run.completed" ||
          message.event.type === "trace.end" ||
          message.event.type === "response.completed"
        ) {
          setStatus("completed");
        }
        if (message.event.type === "run.failed") {
          setStatus("failed");
        }
      }
    });

    return () => {
      unsubscribe();
      clearTimer();
      transport.disconnect();
    };
  }, [clearTimer, startTrace]);

  // Seed demo when starting in demo mode.
  useEffect(() => {
    if (mode !== "demo") {
      return;
    }
    if (traceRef.current === null) {
      if (DEFAULT_TRACE !== null) {
        startTrace(DEFAULT_TRACE);
      }
      return;
    }
    if (statusRef.current === "running" && timerRef.current === null) {
      scheduleNext();
    }
  }, [mode, scheduleNext, startTrace]);

  const value = useMemo<RuntimeContextValue>(
    () => ({
      activeTrace,
      agentsConnected,
      availableTraces: listMockTraces(),
      clear,
      command,
      error,
      live,
      mode,
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
      executePrompt: submitLivePrompt,
      transportConnected,
    }),
    [
      activeTrace,
      agentsConnected,
      clear,
      command,
      error,
      live,
      mode,
      replay,
      selectTool,
      speed,
      status,
      stop,
      submitCommand,
      submitLivePrompt,
      transportConnected,
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

function tryHelp(value: string, mode: ConnectionMode): TerminalLine[] | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^\$\s*/, "")
    .replace(/^>\s*/, "");
  if (normalized !== "help" && normalized !== "shiro help" && normalized !== "shiro --help") {
    return null;
  }

  const traces = listMockTraces();
  return [
    { id: "help-cmd", kind: "command", text: "$ shiro help" },
    {
      id: "help-1",
      kind: "muted",
      text: mode === "live" ? "Shiro Studio · Live Mode" : "Shiro Studio · Demo Mode",
    },
    { id: "help-2", kind: "event", text: "Usage:" },
    {
      id: "help-3",
      kind: "pink",
      text:
        mode === "live"
          ? "  <prompt>                 run connected agent"
          : "  shiro run <agent>        replay demo trace",
    },
    { id: "help-4", kind: "pink", text: "  shiro replay traces/<name>" },
    { id: "help-5", kind: "event", text: "Demo agents:" },
    ...traces.map((trace, index) => ({
      id: `help-trace-${String(index)}`,
      kind: "success" as const,
      text: `  ${trace.id.padEnd(18)} ${trace.description}`,
    })),
  ];
}
