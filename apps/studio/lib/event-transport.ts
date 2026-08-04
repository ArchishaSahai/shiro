/**
 * Replaceable Studio event transport.
 * UI code depends on this interface — never on mock JSON loaders directly.
 */

import type { StudioRuntimeEvent } from "@/lib/runtime-events";

export type ConnectionMode = "demo" | "live";

export interface TransportStatusMessage {
  readonly type: "status";
  readonly mode: ConnectionMode;
  readonly agents: number;
}

export interface TransportEventMessage {
  readonly type: "event";
  readonly event: StudioRuntimeEvent;
}

export interface TransportExecuteResultMessage {
  readonly type: "execute.result";
  readonly requestId: string;
  readonly ok: boolean;
  readonly error?: string;
}

export type TransportInboundMessage =
  TransportStatusMessage | TransportEventMessage | TransportExecuteResultMessage;

export interface EventTransport {
  readonly mode: ConnectionMode;
  readonly connected: boolean;
  connect(): void;
  disconnect(): void;
  execute(prompt: string): Promise<void>;
  subscribe(listener: (message: TransportInboundMessage) => void): () => void;
}

const DEFAULT_WS_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_SHIRO_STUDIO_URL ?? "ws://127.0.0.1:4317")
    : "ws://127.0.0.1:4317";

/**
 * Browser WebSocket transport to the local (or remote) Studio runtime hub.
 */
export class WebSocketEventTransport implements EventTransport {
  readonly #url: string;
  readonly #listeners = new Set<(message: TransportInboundMessage) => void>();
  #socket: WebSocket | null = null;
  #mode: ConnectionMode = "demo";
  #pending = new Map<string, { resolve: () => void; reject: (error: Error) => void }>();
  #reconnectTimer: number | null = null;
  #closed = false;

  constructor(url = DEFAULT_WS_URL) {
    this.#url = url;
  }

  get mode(): ConnectionMode {
    return this.#mode;
  }

  get connected(): boolean {
    return this.#socket?.readyState === WebSocket.OPEN;
  }

  connect(): void {
    if (typeof window === "undefined") {
      return;
    }
    if (this.#socket !== null && this.#socket.readyState <= WebSocket.OPEN) {
      return;
    }

    const socket = new WebSocket(this.#url);
    this.#socket = socket;

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "hello", role: "studio" }));
    });

    socket.addEventListener("message", (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (!isInbound(parsed)) {
        return;
      }
      if (parsed.type === "status") {
        this.#mode = parsed.mode;
      }
      if (parsed.type === "execute.result") {
        const pending = this.#pending.get(parsed.requestId);
        if (pending !== undefined) {
          this.#pending.delete(parsed.requestId);
          if (parsed.ok) {
            pending.resolve();
          } else {
            pending.reject(new Error(parsed.error ?? "Execute failed"));
          }
        }
      }
      for (const listener of this.#listeners) {
        listener(parsed);
      }
    });

    socket.addEventListener("close", () => {
      this.#socket = null;
      this.#mode = "demo";
      for (const listener of this.#listeners) {
        listener({ type: "status", mode: "demo", agents: 0 });
      }
      this.#scheduleReconnect();
    });
  }

  disconnect(): void {
    this.#closed = true;
    if (this.#reconnectTimer !== null) {
      window.clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
    this.#socket?.close();
    this.#socket = null;
  }

  execute(prompt: string): Promise<void> {
    if (!this.connected || this.#mode !== "live") {
      return Promise.reject(new Error("Runtime is not live"));
    }

    const requestId = `req_${String(Date.now())}_${Math.random().toString(16).slice(2)}`;
    return new Promise((resolve, reject) => {
      this.#pending.set(requestId, { reject, resolve });
      this.#socket?.send(
        JSON.stringify({
          type: "execute",
          requestId,
          prompt,
        })
      );
      window.setTimeout(() => {
        if (this.#pending.has(requestId)) {
          this.#pending.delete(requestId);
          reject(new Error("Execute timed out waiting for the agent"));
        }
      }, 120_000);
    });
  }

  subscribe(listener: (message: TransportInboundMessage) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #scheduleReconnect(): void {
    if (this.#closed || this.#reconnectTimer !== null) {
      return;
    }
    this.#reconnectTimer = window.setTimeout(() => {
      this.#reconnectTimer = null;
      this.connect();
    }, 1500);
  }
}

function isInbound(value: unknown): value is TransportInboundMessage {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false;
  }
  const type = value.type;
  return type === "status" || type === "event" || type === "execute.result";
}
