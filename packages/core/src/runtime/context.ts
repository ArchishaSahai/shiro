import type { EventBus } from "../events/index.js";
import type { MemoryProvider } from "../memory/index.js";
import type { Provider } from "../provider/index.js";
import type { SessionStore } from "../session/index.js";
import type { Metadata } from "../shared/index.js";
import type { Tracer } from "../tracing/index.js";

/**
 * Long-lived services available to Shiro orchestration.
 */
export interface RuntimeContext {
  readonly provider: Provider;
  readonly sessionStore?: SessionStore;
  readonly memory?: MemoryProvider;
  readonly tracer?: Tracer;
  readonly events?: EventBus;
  readonly metadata?: Metadata;
}

/**
 * Per-execution context shared across lifecycle hooks.
 */
export interface RunContext {
  readonly runId: string;
  readonly agentName: string;
  readonly sessionId?: string;
  readonly runtime: RuntimeContext;
  readonly signal?: AbortSignal;
  readonly metadata?: Metadata;
}
