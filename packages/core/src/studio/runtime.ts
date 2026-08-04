import type { EventBus, EventHandler, ShiroEvent, ShiroEventType } from "../events/index.js";
import { ShiroEventType as EventType } from "../events/index.js";
import type { Disposable } from "../events/index.js";
import { createId } from "../engine/ids.js";
import { mapShiroEventToStudio } from "./map-event.js";
import type {
  StudioExecuteHandler,
  StudioRuntimeOptions,
  StudioWireEvent,
  StudioWireJson,
} from "./types.js";

const DEFAULT_URL = "ws://127.0.0.1:4317";

/**
 * EventBus that streams Shiro lifecycle events to a Studio runtime hub over WebSocket.
 * Also accepts remote execute requests from Studio when {@link bind} is used.
 */
export class StudioRuntime implements EventBus {
  readonly #url: string;
  readonly #handlers = new Map<ShiroEventType, Set<EventHandler<ShiroEventType>>>();
  readonly #runOffsets = new Map<string, number>();
  #socket: WebSocket | null = null;
  #executeHandler: StudioExecuteHandler | null = null;
  #agentName: string;
  #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  #closed = false;
  #connectPromise: Promise<void> | null = null;

  constructor(options: StudioRuntimeOptions = {}) {
    this.#url = options.url ?? process.env.SHIRO_STUDIO_URL ?? DEFAULT_URL;
    this.#agentName = options.agentName ?? "agent";
  }

  /** WebSocket URL of the Studio runtime hub. */
  get url(): string {
    return this.#url;
  }

  /** Whether the socket is currently open. */
  get connected(): boolean {
    return this.#socket?.readyState === 1;
  }

  /**
   * Opens the WebSocket connection (idempotent). Safe to call before Engine.execute.
   */
  connect(): Promise<void> {
    if (this.#connectPromise !== null) {
      return this.#connectPromise;
    }

    this.#connectPromise = new Promise((resolve, reject) => {
      try {
        const socket = new WebSocket(this.#url);
        this.#socket = socket;

        socket.addEventListener("open", () => {
          this.#send({
            type: "hello",
            role: "agent",
            agentName: this.#agentName,
          });
          resolve();
        });

        socket.addEventListener("message", (message) => {
          void this.#onMessage(String(message.data));
        });

        socket.addEventListener("close", () => {
          this.#socket = null;
          this.#connectPromise = null;
          this.#scheduleReconnect();
        });

        socket.addEventListener("error", () => {
          if (socket.readyState !== 1) {
            reject(new Error(`Studio runtime failed to connect to ${this.#url}`));
          }
        });
      } catch (error) {
        this.#connectPromise = null;
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    return this.#connectPromise;
  }

  /**
   * Registers the local agent execution callback used when Studio sends prompts.
   */
  bind(handler: StudioExecuteHandler): this {
    this.#executeHandler = handler;
    return this;
  }

  /** Updates the agent name advertised to Studio. */
  setAgentName(name: string): this {
    this.#agentName = name;
    if (this.connected) {
      this.#send({ type: "hello", role: "agent", agentName: name });
    }
    return this;
  }

  async publish(event: ShiroEvent): Promise<void> {
    await this.#notify(event);

    if (!this.connected) {
      void this.connect().catch(() => {
        // Studio may be offline — agent still runs normally.
      });
    }

    const startedAt = this.#runOffsets.get(event.runId) ?? event.timestamp.getTime();
    if (!this.#runOffsets.has(event.runId)) {
      this.#runOffsets.set(event.runId, startedAt);
    }

    const wire = mapShiroEventToStudio(event, {
      agentName: this.#agentName,
      offsetMs: Math.max(0, event.timestamp.getTime() - startedAt),
    });

    for (const entry of wire) {
      this.#send({ type: "event", event: entry });
    }

    if (event.type === EventType.RunCompleted || event.type === EventType.RunFailed) {
      this.#runOffsets.delete(event.runId);
    }
  }

  subscribe<TType extends ShiroEventType>(type: TType, handler: EventHandler<TType>): Disposable {
    const handlers = this.#handlers.get(type) ?? new Set<EventHandler<ShiroEventType>>();
    handlers.add(handler as unknown as EventHandler<ShiroEventType>);
    this.#handlers.set(type, handlers);

    return Object.freeze({
      dispose: () => {
        handlers.delete(handler as unknown as EventHandler<ShiroEventType>);
      },
    });
  }

  /** Closes the WebSocket and stops reconnecting. */
  close(): void {
    this.#closed = true;
    if (this.#reconnectTimer !== null) {
      clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
    this.#socket?.close();
    this.#socket = null;
  }

  async #onMessage(raw: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return;
    }

    if (!isRecord(parsed) || typeof parsed.type !== "string") {
      return;
    }

    if (parsed.type === "execute" && typeof parsed.requestId === "string") {
      const prompt = typeof parsed.prompt === "string" ? parsed.prompt : "";
      const requestId = parsed.requestId;
      if (this.#executeHandler === null) {
        this.#send({
          type: "execute.result",
          requestId,
          ok: false,
          error: "No agent is bound to StudioRuntime. Call studio.bind(...).",
        });
        return;
      }

      try {
        const result = await this.#executeHandler(prompt);
        this.#emitOutput(result);
        this.#send({ type: "execute.result", requestId, ok: true });
      } catch (error) {
        this.#send({
          type: "execute.result",
          requestId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  #emitOutput(result: unknown): void {
    const output = extractOutput(result);
    const markdown = typeof output === "string" ? output : safeStringify(output);
    const finalOutput = toWireJsonValue(output);
    const runId = extractRunId(result) ?? createId("run");

    this.#send({
      type: "event",
      event: {
        id: createId("evt"),
        offsetMs: Date.now() % 100000,
        runId,
        type: "output",
        message: "output",
        terminalKind: "markdown",
        payload: {
          markdown,
          finalStatus: "completed",
          ...(finalOutput === undefined ? {} : { finalOutput }),
        },
      },
    });
    this.#send({
      type: "event",
      event: {
        id: createId("evt"),
        offsetMs: Date.now() % 100000,
        runId,
        type: "response.completed",
        terminalKind: "markdown",
        payload: {
          markdown,
          finalStatus: "completed",
          ...(finalOutput === undefined ? {} : { finalOutput }),
        },
      },
    });
  }

  #send(message: StudioHubOutbound): void {
    if (this.#socket?.readyState !== 1) {
      return;
    }
    this.#socket.send(JSON.stringify(message));
  }

  #scheduleReconnect(): void {
    if (this.#closed || this.#reconnectTimer !== null) {
      return;
    }
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = null;
      void this.connect().catch(() => {
        this.#scheduleReconnect();
      });
    }, 1500);
  }

  async #notify(event: ShiroEvent): Promise<void> {
    const handlers = this.#handlers.get(event.type);
    if (handlers === undefined) {
      return;
    }
    for (const handler of handlers) {
      await handler(event);
    }
  }
}

/**
 * Creates a StudioRuntime when SHIRO_STUDIO_URL (or options.url) is available.
 * Returns null when Studio is not configured — callers should fall back normally.
 */
export function createStudioRuntime(options: StudioRuntimeOptions = {}): StudioRuntime | null {
  const url = options.url ?? process.env.SHIRO_STUDIO_URL;
  if (url === undefined || url.trim().length === 0) {
    return null;
  }
  return new StudioRuntime({ ...options, url });
}

/**
 * Convenience: connect and return an EventBus suitable for `new Engine({ events })`.
 * Throws only if an explicit url was provided and connection fails immediately.
 */
export async function connectStudio(options: StudioRuntimeOptions = {}): Promise<StudioRuntime> {
  const runtime = new StudioRuntime(options);
  await runtime.connect().catch(() => {
    // Keep running offline; Studio UI will show Demo Mode until reconnect.
  });
  return runtime;
}

type StudioHubOutbound =
  | { type: "hello"; role: "agent"; agentName: string }
  | { type: "event"; event: StudioWireEvent }
  | { type: "execute.result"; requestId: string; ok: boolean; error?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractOutput(result: unknown): unknown {
  if (isRecord(result) && "output" in result) {
    return result.output;
  }
  return result;
}

function extractRunId(result: unknown): string | null {
  if (isRecord(result) && typeof result.runId === "string") {
    return result.runId;
  }
  return null;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return "[unserializable]";
  }
}

function toWireJsonValue(value: unknown): StudioWireJson | undefined {
  if (value === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(JSON.stringify(value)) as StudioWireJson;
  } catch {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return null;
  }
}
