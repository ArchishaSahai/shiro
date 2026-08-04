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

function getWSUrl(): string {
  if (typeof window === "undefined") {
    return "ws://127.0.0.1:4317";
  }
  if (process.env.NEXT_PUBLIC_SHIRO_STUDIO_URL) {
    return process.env.NEXT_PUBLIC_SHIRO_STUDIO_URL;
  }
  let hostname = window.location.hostname || "127.0.0.1";
  if (hostname === "localhost") {
    hostname = "127.0.0.1";
  }
  const port = window.location.port ? Number(window.location.port) : 3001;
  const runtimePort = port + 1316;
  return `ws://${hostname}:${String(runtimePort)}`;
}

const DEFAULT_WS_URL = getWSUrl();

const LOG_PREFIX = "[shiro:studio:ws]";

function log(message: string, detail?: unknown): void {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  if (detail === undefined) {
    console.info(LOG_PREFIX, message);
    return;
  }
  console.info(LOG_PREFIX, message, detail);
}

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
  /** True only while an intentional disconnect() is in effect (not mid reconnect). */
  #closed = false;
  #connectAttempt = 0;

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

    // Remount / reconnect after Strict Mode cleanup must be allowed again.
    this.#closed = false;

    if (this.#reconnectTimer !== null) {
      window.clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }

    if (this.#socket !== null && this.#socket.readyState <= WebSocket.OPEN) {
      log("connect skipped — socket already open/connecting", {
        readyState: this.#socket.readyState,
      });
      return;
    }

    this.#connectAttempt += 1;
    const attempt = this.#connectAttempt;
    if (attempt === 1) {
      log("First WebSocket connect attempt", { url: this.#url });
    } else {
      log("WebSocket connect attempt", { attempt, url: this.#url });
    }

    const socket = new WebSocket(this.#url);
    this.#socket = socket;

    socket.addEventListener("open", () => {
      if (this.#socket !== socket) {
        return;
      }
      log("WebSocket open", { attempt });
      socket.send(JSON.stringify({ type: "hello", role: "studio" }));
      log("Handshake sent (hello/studio)", { attempt });
    });

    socket.addEventListener("message", (event) => {
      if (this.#socket !== socket) {
        return;
      }
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
        log("Handshake received (status)", {
          mode: parsed.mode,
          agents: parsed.agents,
        });
        if (parsed.mode === "live" && parsed.agents > 0) {
          log("Runtime connected", { agents: parsed.agents });
        }
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
      // Ignore stale sockets from React Strict Mode remount races.
      if (this.#socket !== socket) {
        log("Ignoring stale WebSocket close", { attempt });
        return;
      }
      this.#socket = null;
      this.#mode = "demo";
      log("WebSocket closed", { attempt, intentional: this.#closed });
      for (const listener of this.#listeners) {
        listener({ type: "status", mode: "demo", agents: 0 });
      }
      this.#scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      if (this.#socket !== socket) {
        return;
      }
      log("WebSocket error", { attempt, url: this.#url });
    });
  }

  disconnect(): void {
    this.#closed = true;
    if (this.#reconnectTimer !== null) {
      window.clearTimeout(this.#reconnectTimer);
      this.#reconnectTimer = null;
    }
    const socket = this.#socket;
    // Clear before close so the close handler treats this socket as intentional/stale
    // and does not wipe a newer socket created by a subsequent connect().
    this.#socket = null;
    this.#mode = "demo";
    if (socket !== null) {
      log("WebSocket disconnect (intentional)");
      socket.close();
    }
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
      log("WebSocket reconnect scheduled fire");
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
