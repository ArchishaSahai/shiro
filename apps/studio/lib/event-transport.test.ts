/**
 * Unit coverage for the Strict Mode remount race that left Studio stuck on Connecting.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocketEventTransport } from "./event-transport";

type Listener = (this: WebSocket, ev: Event) => void;

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  readonly url: string;
  readonly #listeners = new Map<string, Set<Listener>>();

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const set = this.#listeners.get(type) ?? new Set();
    set.add(listener);
    this.#listeners.set(type, set);
  }

  send(): void {
    // no-op
  }

  close(): void {
    if (this.readyState === FakeWebSocket.CLOSED) {
      return;
    }
    this.readyState = FakeWebSocket.CLOSED;
    this.#emit("close");
  }

  /** Emit close even if already closed — models a late async close event. */
  emitStaleClose(): void {
    this.#emit("close");
  }

  openNow(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.#emit("open");
  }

  #emit(type: string): void {
    const set = this.#listeners.get(type);
    if (set === undefined) {
      return;
    }
    for (const listener of set) {
      listener.call(this as unknown as WebSocket, new Event(type));
    }
  }
}

describe("WebSocketEventTransport remount race", () => {
  const OriginalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    vi.stubGlobal("window", globalThis);
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    FakeWebSocket.instances = [];
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
    FakeWebSocket.instances = [];
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps the remounted socket after Strict Mode disconnect+close race", () => {
    const transport = new WebSocketEventTransport("ws://127.0.0.1:4317");

    transport.connect();
    expect(FakeWebSocket.instances).toHaveLength(1);
    const first = FakeWebSocket.instances[0];
    expect(first).toBeDefined();
    first?.openNow();
    expect(transport.connected).toBe(true);

    // Strict Mode cleanup
    transport.disconnect();
    expect(transport.connected).toBe(false);

    // Remount
    transport.connect();
    expect(FakeWebSocket.instances).toHaveLength(2);
    const second = FakeWebSocket.instances[1];
    expect(second).toBeDefined();
    second?.openNow();
    expect(transport.connected).toBe(true);

    // Late stale close from the first socket must not wipe the active socket.
    first?.emitStaleClose();
    expect(transport.connected).toBe(true);
  });

  it("allows connect after intentional disconnect (resets closed flag)", () => {
    const transport = new WebSocketEventTransport("ws://127.0.0.1:4317");
    transport.connect();
    FakeWebSocket.instances[0]?.openNow();
    transport.disconnect();

    transport.connect();
    FakeWebSocket.instances.at(-1)?.openNow();
    expect(transport.connected).toBe(true);
  });
});
